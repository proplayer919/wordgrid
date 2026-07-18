import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  assetsInclude: ['**/*.txt.gz'],
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
      common: path.resolve(__dirname, 'common'),
      components: path.resolve(__dirname, 'src/components'),
      pages: path.resolve(__dirname, 'src/pages'),
    },
  },
});
