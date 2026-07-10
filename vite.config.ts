import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  base: "/vbt/",
  root: ".",
  build: { outDir: "dist" },
  plugins: [basicSsl()],
  test: {
    environment: "happy-dom",
  },
});
