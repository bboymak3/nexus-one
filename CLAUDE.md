# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Panel SaaS multi-negocio en **Cloudflare Pages** (Next.js 15 App Router + React 19, Edge Runtime). Crea y administra los negocios que usan el POS **MyeCommerce** (repo `bboymak3/MyeCommerce-Cloudflare`): sus usuarios, su plan y su suscripción (ciclo y fecha de corte). Desde aquí cada negocio entra a su POS por SSO. Los dos proyectos comparten la D1 `ok_db`: este usa tablas `nx_*` y el POS tablas `pos_*`. `README.md` documenta rutas, API y secretos.

Código, comentarios y mensajes en español. Producción: `https://nexus-one-3xf.pages.dev`; cada push a `main` despliega solo.

## Comandos

```bash
npm install
npx tsc --noEmit                 # typecheck (no hay tests ni linter)
npm run pages:build              # build de Cloudflare (@cloudflare/next-on-pages) -> .vercel/output/static
npm run db:local                 # aplica prisma/schema.sql a la D1 local
npx wrangler pages dev .vercel/output/static --port 8789 --persist-to <dir> \
  --binding JWT_SECRET=x NEXUS_SSO_SECRET=y SUPERADMIN_INITIAL_PASSWORD=ClaveDe8+ MYECOMMERCE_URL=https://pos.ejemplo
npm run db:schema                # aplica el esquema a la D1 remota (idempotente)
```

- `npm run dev` no tiene binding D1: la API responde "Database not available". Para probar, usar `pages:build` + `wrangler pages dev`.
- Si `npm run db:local` no usa el mismo directorio que `wrangler pages dev --persist-to <dir>`, cargar el esquema con `npx wrangler d1 execute ok_db --local --persist-to <dir> --file=./prisma/schema.sql`.
- Para probar junto con el POS: levantar los dos con el mismo `--persist-to` y el mismo `NEXUS_SSO_SECRET`. Si corren dos `wrangler pages dev` a la vez, al segundo hay que darle otro `--inspector-port`. `MYECOMMERCE_URL` debe ser https: en local se pone una ficticia, se toma el `token` del enlace que devuelve `/api/sso` y se llama al `/api/nexus-sso` del POS directamente.

## Arquitectura

- **Datos:** SQL directo sobre D1 (`getRequestContext().env.DB.prepare(...)`). Prisma está en `package.json` pero **no se usa**. Cada ruta API define su propio `getDB()` y responde con los helpers de `src/lib/response.ts` (`jsonResponse`, `errorResponse`, `unauthorizedResponse`; los errores van como `{ error }`). Toda ruta lleva `export const runtime = 'edge'`.
- **Esquema:** `prisma/schema.sql` (solo `CREATE ... IF NOT EXISTS`) con `nx_super_admins`, `nx_tenants`, `nx_tenant_users` y `nx_activity_logs`. Aquí no hay migración automática (el POS sí la tiene para sus tablas): una columna nueva requiere `ALTER TABLE` en la D1 remota. El `id` de `nx_tenants` es el `tenant_id` con el que el POS aísla los datos de cada negocio.
- **Sesión:** JWT de 24 h (`src/lib/session.ts`, jose) firmado con `JWT_SECRET`. Si ese secreto no existe se usa una clave anterior, `LEGACY_SECRET`. El token viaja como `Authorization: Bearer` o en la cookie `session_token`; `userType` es `super_admin` o `tenant`. `src/middleware.ts` protege `/admin/*` (solo super_admin) y `/:slug/dashboard/*` (solo usuarios de ese slug). Las rutas API validan el token por su cuenta.
- **Suscripción:** `src/lib/subscription.ts` define el ciclo (`monthly`/`annual`/`none`), la fecha de corte y la renovación. Renovar suma un periodo desde el corte actual, o desde hoy si ya venció. Un negocio está habilitado si `status = 'active'` y el corte no pasó.
- **Guards** (`src/lib/guards.ts`): `getTenantSession` sirve para lo que el usuario puede *ver*: un negocio suspendido o vencido sigue entrando a su panel para ver el aviso. `getActiveTenantSession` sirve para lo que puede *hacer*, como abrir el POS: lo corta de inmediato aunque el token siga vigente.
- **SSO al POS** (`POST /api/sso`): exige negocio activo, firma un JWT de 5 min con `NEXUS_SSO_SECRET` (`iss: nexus-one`, `aud: myecommerce-pos`, `purpose: pos_sso`) y devuelve `<pos_url o MYECOMMERCE_URL>/api/nexus-sso?token=...`. **Contrato compartido con el POS:** si cambian los claims, el secreto o la ruta, hay que cambiar también el `verifyNexusSsoToken` del POS.
- **Roles de usuarios de negocio:** `admin` y `cajero` (`vendedor` se fusionó en cajero; `normalizeTenantRole`). **Permisos del cajero** por negocio en `nx_tenants.settings.cajeroPermissions` (botón "Permisos del cajero" del panel admin, `PUT /api/tenants` con `cajeroPermissions`; `settings` se mezcla, no se reemplaza). Catálogo en `src/lib/cajero-permissions.ts`, **sincronizado** con `src/lib/permissions.ts` del POS, que los aplica.
- **El POS lee `nx_tenants` directamente** (status, plan, `billing_cycle`, `subscription_expires_at`, slug, `settings`) para su licencia y para bloquear negocios suspendidos o vencidos. Renombrar o cambiar esas columnas rompe el POS. Los planes `business`/`premium` equivalen a la licencia "profesional" del POS; `basic` a "básica".
- **Login:** `POST /api/auth` con `action` (`admin_login`, `tenant_login`, `create_tenant_user`, `change_admin_password`). `tenant_login` sin `tenantSlug` busca el usuario en todos los negocios. Al crear un negocio con `ownerPassword` se crea su usuario dueño `<slug>-admin`.
- **Superadmin inicial:** la semilla trae una clave marcador inutilizable (contiene `fixedsalt`). En el primer login se reemplaza por el hash de `SUPERADMIN_INITIAL_PASSWORD` (mínimo 8 caracteres).
- **Claves:** PBKDF2-SHA256 con Web Crypto (`src/lib/auth.ts`), con 100k iteraciones: el límite de Workers impide usar más.
- **Fechas:** el negocio opera en hora de Venezuela (UTC-4). `formatDate` usa `timeZone: 'America/Caracas'`.

## Configuración
- `wrangler.toml`: binding `DB` (D1 `ok_db`) y la variable `MYECOMMERCE_URL`. Con `wrangler.toml` presente, Cloudflare ignora las variables normales del panel: las variables van en el toml y los secretos con `npx wrangler pages secret put <NOMBRE> --project-name=nexus-one`.
- Secretos: `JWT_SECRET`, `NEXUS_SSO_SECRET` (mismo valor que en el POS) y `SUPERADMIN_INITIAL_PASSWORD`.
- `next.config.js` deja vacíos los módulos de Node (`fs`, `crypto`, ...) que no existen en Edge.
