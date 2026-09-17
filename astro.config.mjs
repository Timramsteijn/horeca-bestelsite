import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Static output: no server-side state, no D1/KV, no Astro Actions needed.
// Cloudflare adapter kept for parity with onderhoud-astro's deploy target,
// but sessions/KV and the Images binding are explicitly opted out (this
// project has no server state and only ever serves plain <img> assets).
export default defineConfig({
  output: "static",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react()],
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
