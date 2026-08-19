import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache override yet: this is a mostly-static marketing site.
// If ISR/revalidation is needed later, add the R2 incremental cache per
// https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
