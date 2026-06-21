import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: path.resolve(__dirname, "./src/routes"),
      generatedRouteTree: path.resolve(__dirname, "./src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
