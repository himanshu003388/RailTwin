// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";

const isVercel = !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  site: isVercel ? 'https://rail-twin.vercel.app' : 'https://himanshu003388.github.io',
  base: isVercel ? '/' : '/RailTwin',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] }
});