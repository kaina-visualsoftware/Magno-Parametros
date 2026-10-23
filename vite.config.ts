/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build de produção vai para o GitHub Pages, sob o caminho do repositório.
// No desenvolvimento (npm run dev) a raiz continua sendo "/".
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Magno-Parametros/' : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.teste.ts'],
  },
}));
