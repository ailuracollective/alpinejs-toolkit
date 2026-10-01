import { defineConfig } from "astro/config";

import { createUrls } from "./src/config/urls.ts";

export default defineConfig(({ mode }) => {
  const { repoUrl, docsUrl } = createUrls({ MODE: mode });
  // eslint-disable-next-line no-console
  console.log("PROBE", JSON.stringify({ repoUrl, docsUrl, mode }));
  return { site: docsUrl };
});
