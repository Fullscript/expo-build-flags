// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightBlog from "starlight-blog";

// https://astro.build/config
export default defineConfig({
  site: "https://fullscript.github.io",
  base: "/expo-build-flags",
  integrations: [
    starlight({
      title: "expo-build-flags",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/fullscript/expo-build-flags",
        },
      ],
      plugins: [starlightBlog({ title: "Blog" })],
      sidebar: [
        { label: "Quick Start", slug: "quick-start" },
        { label: "CLI Reference", slug: "cli" },
        {
          label: "Recipes",
          items: [
            { slug: "recipes/config-plugin" },
            { slug: "recipes/babel-plugin" },
            { slug: "recipes/flagged-autolinking" },
            { slug: "recipes/flag-inversion" },
          ],
        },
        { label: "Roadmap", slug: "roadmap" },
        { label: "Contributing", slug: "contributing" },
      ],
    }),
  ],
});
