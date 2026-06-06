// astro.config.mjs
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://cocos-puppy-tales.mjclyde.com",
  output: "static", // pages prerender; endpoints opt out per-file
  adapter: vercel(),
  image: {
    // Codec-level defaults applied to every transformed image at build time.
    // Per-image `format`/`quality` are set on each <Image> component; these
    // tune how the chosen encoder does its job.
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        // Source photos run up to ~4032x3024; keep Sharp from refusing them.
        limitInputPixels: false,
        // Spend more CPU at build for smaller WebP output (0-6, default 4).
        webp: { effort: 6 },
        // If any image ever falls back to JPEG, use the better encoder.
        jpeg: { mozjpeg: true },
      },
    },
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/admin") && !page.includes("/unsubscribe"),
    }),
  ],
});
