import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  assetsInclude: ['**/*.txt.gz'],
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
})
