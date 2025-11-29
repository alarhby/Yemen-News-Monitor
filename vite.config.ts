import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This injects the API key from your local .env file or system environment
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "YOUR_GEMINI_API_KEY_HERE"),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});