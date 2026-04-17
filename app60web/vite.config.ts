import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
    define: {
      global: "globalThis",
    },
    plugins: [react()],
    server: proxyTarget
      ? {
          proxy: {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
            "/bootstrap": {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
            "/health": {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
  };
});
