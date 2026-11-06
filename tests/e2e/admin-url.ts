// PR previews gate /admin behind ?key= (scripts/preview-config.mjs); the
// preview workflow passes that key in as E2E_ADMIN_KEY. Locally it's unset.
const key = process.env.E2E_ADMIN_KEY;
export const ADMIN_URL = key
  ? `/admin?key=${encodeURIComponent(key)}`
  : "/admin";
