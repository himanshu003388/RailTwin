// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

const isVercel = !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  site: isVercel ? 'https://rail-twin.vercel.app' : 'https://himanshu003388.github.io',
  base: isVercel ? '/' : '/RailTwin',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // Node built-ins used by RailwayDatasetService (server-side only)
      external: ['fs', 'path'],
      noExternal: [],
    },
    optimizeDeps: {
      exclude: ['fs', 'path'],
    },
  },
  output: 'static',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' })
});