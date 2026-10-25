import { useEffect, useRef } from 'react';

/**
 * Hook de debounce com trailing behavior.
 * Garante que a última chamada seja executada mesmo se houver novas chamadas imediatas.
 *
 * @param func Função a ser debounced
 * @param delay Tempo de espera em ms
 * @returns Função debounced
 */
export function useDebounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
