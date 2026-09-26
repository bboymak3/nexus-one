/// <reference types="@cloudflare/next-on-pages" />

interface CloudflareEnv {
  DB: D1Database;
  NODE_ENV: string;
  MYECOMMERCE_URL?: string;
  // Secretos (wrangler pages secret put ...)
  JWT_SECRET: string;
  NEXUS_SSO_SECRET: string;
  SUPERADMIN_INITIAL_PASSWORD?: string;
}
