import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // ⭐️ This line forces Vercel's environment variable (process.env) 
    // to be injected into the Vite environment variable (import.meta.env) 
    // during the build, allowing your client code to see it.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY),
  },
});
