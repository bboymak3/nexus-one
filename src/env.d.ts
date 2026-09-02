/// <reference types="@cloudflare/next-on-pages" />

interface CloudflareEnv {
  DB: D1Database;
  JWT_SECRET: string;
  NODE_ENV: string;
}