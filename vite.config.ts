import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // host: true lets you open the dev server from a phone on the same Wi-Fi.
    // NOTE: camera + geolocation need a secure context. Plain http://<lan-ip>:5173
    // will NOT grant them. See README.md — test on the Vercel preview URL.
    host: true,
    port: 5173,
  },
});
