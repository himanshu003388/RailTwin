// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: 'https://himanshu003388.github.io',
  base: '/RailTwin',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] }
});