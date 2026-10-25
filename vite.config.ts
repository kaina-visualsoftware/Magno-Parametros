/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Build de produção vai para o GitHub Pages, sob o caminho do repositório.
// No desenvolvimento (npm run dev) a raiz continua sendo "/".
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/kaina-visualsoftware/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.teste.ts'],
  },
}));
