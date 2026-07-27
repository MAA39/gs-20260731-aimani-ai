import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ plugins: [cloudflare({ viteEnvironment: { name: 'ssr' }, auxiliaryWorkers: [{ configPath: '../api/wrangler.jsonc' }] }), tanstackStart(), react(), tailwindcss()] });
