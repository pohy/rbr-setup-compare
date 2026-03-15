/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function umamiPlugin(): Plugin {
  let isProd = false;
  return {
    name: "umami",
    configResolved(config) {
      isProd = config.command === "build";
    },
    transformIndexHtml() {
      if (!isProd) return [];
      return [
        {
          tag: "script",
          attrs: {
            async: true,
            src: "https://umami.pohy.eu/script.js",
            "data-website-id": "e97d5592-ac38-49b4-9e43-c353517012b0",
          },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  base: "/rbr-setup-compare/",
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    umamiPlugin(),
  ],
  test: {
    setupFiles: ["./src/test-setup.ts"],
  },
});
