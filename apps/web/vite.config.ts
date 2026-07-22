import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: "../../",
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:8787",
        ws: true,
      },
    },
  },
});
