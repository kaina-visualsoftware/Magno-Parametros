-- Leitura aditiva: clientes antigos continuam funcionando. Aplicar antes do frontend.
-- Sem índices especulativos: medir EXPLAIN no ambiente de homologação primeiro.
create or replace function public.listar_parametros_catalogo(
  p_filtros jsonb default '{}'::jsonb, p_cursor jsonb default null, p_limite integer default 50
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  termo text; tipo text; status text; origem text; ativo boolean; aba text;
  tags uuid[]; sem_tag boolean; operador text; coluna text; direcao text;
  filtros jsonb; assinatura text; comparador text; expressao_cursor text;
  registros jsonb; itens jsonb; ultimo jsonb; proximo jsonb := null;
begin
  if p_filtros is null or jsonb_typeof(p_filtros) <> 'object'
    or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'Filtros ou limite inválidos.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_filtros) k where k not in
    ('termo','tipo','status','origem','ativo','aba','tags','semTag','operador','ordem','direcao')) then
    raise exception 'Filtro desconhecido.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_each(p_filtros) e where e.key in
    ('termo','tipo','status','origem','aba','operador','ordem','direcao') and jsonb_typeof(e.value) <> 'string')
    or (p_filtros ? 'tags' and jsonb_typeof(p_filtros->'tags') <> 'array')
    or (p_filtros ? 'semTag' and jsonb_typeof(p_filtros->'semTag') <> 'boolean')
    or (p_filtros ? 'ativo' and jsonb_typeof(p_filtros->'ativo') not in ('boolean','null')) then
    raise exception 'Tipo de filtro inválido.' using errcode = '22023';
  end if;
  termo := btrim(regexp_replace(normalize(lower(coalesce(p_filtros->>'termo','')), NFD), U&'[\0300-\036f]', '', 'g'));
  tipo := nullif(p_filtros->>'tipo',''); status := nullif(p_filtros->>'status','');
  origem := nullif(p_filtros->>'origem',''); aba := nullif(p_filtros->>'aba','');
  ativo := case when p_filtros ? 'ativo' then (p_filtros->>'ativo')::boolean else true end;
  sem_tag := coalesce((p_filtros->>'semTag')::boolean, false);
  operador := coalesce(p_filtros->>'operador', 'OU');
  coluna := coalesce(p_filtros->>'ordem','nome'); direcao := coalesce(p_filtros->>'direcao','asc');
  if char_length(termo) > 200 or char_length(coalesce(tipo,'')) > 100
    or char_length(coalesce(aba,'')) > 500
    or (status is not null and status not in ('pendente','documentado','revisado'))
    or (origem is not null and origem not in ('manual','importado'))
    or operador not in ('E','OU') or coluna not in ('nome','grupo','caminho','ordem')
    or direcao not in ('asc','desc') or jsonb_array_length(coalesce(p_filtros->'tags','[]'::jsonb)) > 50 then
    raise exception 'Valor de filtro inválido.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct valor::uuid order by valor::uuid), '{}'::uuid[]) into tags
    from jsonb_array_elements_text(coalesce(p_filtros->'tags','[]'::jsonb)) t(valor);
  if array_position(tags, null) is not null or (sem_tag and cardinality(tags) > 0) then
    raise exception 'Escolha tags ou sem tag, não ambos.' using errcode = '22023';
  end if;
  filtros := jsonb_build_object('termo',termo,'tipo',tipo,'status',status,'origem',origem,
    'ativo',ativo,'aba',aba,'tags',tags,'semTag',sem_tag,'operador',operador,'ordem',coluna,'direcao',direcao);
  assinatura := md5(filtros::text);
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) <> 'object' or p_cursor->>'v' is distinct from '1'
      or p_cursor->>'f' is distinct from assinatura or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or coalesce(p_cursor->>'id','') = '' or char_length(p_cursor->>'id') > 500
      or jsonb_typeof(p_cursor->'valor') is distinct from (case when coluna = 'ordem' then 'number' else 'string' end) then
      raise exception 'Cursor inválido ou incompatível com os filtros.' using errcode = '22023';
    end if;
    if coluna = 'ordem' then perform (p_cursor->>'valor')::integer; end if;
  end if;
  comparador := case when direcao = 'asc' then '>' else '<' end;
  expressao_cursor := case when coluna = 'ordem' then '($10->>''valor'')::integer' else '($10->>''valor'')' end;
  -- Identificador/direção vêm de allowlists; todos os valores permanecem parâmetros.
  execute format($sql$
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
      select p.id, p.nome, p.tipo, p.grupo, p.caminho, p.status_documentacao as "statusDocumentacao",
        p.origem, p.ativo, p.%1$I as "valorCursor"
      from public.parametros p
      where ($1 = '' or p.texto_busca ilike ('%%' || replace(replace(replace($1, E'\\', E'\\\\'), '%%', E'\\%%'), '_', E'\\_') || '%%'))
        and ($2 is null or p.tipo = $2) and ($3 is null or p.status_documentacao = $3)
        and ($4 is null or p.origem = $4) and ($5 is null or p.ativo = $5)
        and ($6 is null or p.aba_id = $6)
        and (not $7 or not exists(select 1 from public.parametro_tags pt where pt.parametro_id = p.id))
        and (cardinality($8) = 0 or
          ($9 = 'OU' and exists(select 1 from public.parametro_tags pt where pt.parametro_id = p.id and pt.tag_id = any($8))) or
          ($9 = 'E' and not exists(select 1 from unnest($8) t(id) where not exists
            (select 1 from public.parametro_tags pt where pt.parametro_id = p.id and pt.tag_id = t.id))))
        and ($10 is null or p.%1$I %2$s %3$s or (p.%1$I = %3$s and p.id > ($10->>'id')))
      order by p.%1$I %4$s, p.id asc limit $11
    ) r
  $sql$, coluna, comparador, expressao_cursor, direcao)
  into registros using termo,tipo,status,origem,ativo,aba,sem_tag,tags,operador,p_cursor,p_limite+1;
  select coalesce(jsonb_agg(e.value - 'valorCursor' order by e.ordinality), '[]'::jsonb) into itens
    from jsonb_array_elements(registros) with ordinality e where e.ordinality <= p_limite;
  if jsonb_array_length(registros) > p_limite then
    ultimo := registros->(p_limite-1);
    proximo := jsonb_build_object('v',1,'f',assinatura,'id',ultimo->>'id','valor',ultimo->'valorCursor');
  end if;
  return jsonb_build_object('itens',itens,'proximoCursor',proximo);
end $$;
revoke all on function public.listar_parametros_catalogo(jsonb,jsonb,integer) from public;
grant execute on function public.listar_parametros_catalogo(jsonb,jsonb,integer) to anon, authenticated;

create or replace function public.listar_tags_com_contagem() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.nome, t.id), '[]'::jsonb) from (
    select tags.id, tags.nome, tags.slug, tags.descricao, tags.cor, count(pt.parametro_id) as "totalVinculos"
    from public.tags tags left join public.parametro_tags pt on pt.tag_id = tags.id
    group by tags.id
  ) t;
$$;
revoke all on function public.listar_tags_com_contagem() from public;
grant execute on function public.listar_tags_com_contagem() to anon, authenticated;
