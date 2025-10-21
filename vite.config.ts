// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This function ensures Vercel's environment variables are available.
// It also ensures the variable is treated as a string by using JSON.stringify().
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY),
  },
});
