import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Spectre marketing landing — a pure static SPA. The demo form writes directly
// to Supabase from the browser (see src/components/landing/submitDemo.ts), so
// there is no server-side component to configure.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
