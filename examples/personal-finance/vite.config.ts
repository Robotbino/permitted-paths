import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web application. In development Vite serves it on port 5173 and sends /api to the server.
// 127.0.0.1 and not "localhost": Node can resolve "localhost" to ::1, where the server does not listen.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
