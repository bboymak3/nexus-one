# Nexus One — Panel multi-negocio

Panel SaaS para administrar los negocios que usan el punto de venta
[MyeCommerce POS](https://github.com/bboymak3/MyeCommerce-Cloudflare). Aquí se
crean los negocios, sus usuarios y su suscripción (plan, ciclo de cobro y
fecha de corte). Desde aquí cada negocio entra a su POS con un clic, sin volver
a iniciar sesión.

Desplegado en **Cloudflare Pages**, comparte la misma base **D1** (`ok_db`) con
el POS:

```
            ┌────────────── D1 compartida "ok_db" ──────────────┐
            │  tablas nx_*  (nexus-one)   tablas pos_* (POS)    │
            └───────▲───────────────────────────────▲───────────┘
                    │                               │ (filas con tenant_id)
       Nexus One (este repo)  ── token SSO ──►  MyeCommerce POS
```

## Stack

- **Next.js 15** (App Router) + **React 19**, Edge Runtime
- **Cloudflare D1** con SQL directo (`env.DB.prepare(...)`), sin ORM
- **jose** para los JWT (sesión y SSO), **Web Crypto** (PBKDF2-SHA256) para las claves
- **Tailwind CSS**, **lucide-react**
- **@cloudflare/next-on-pages** para el build de Cloudflare Pages

## Roles y pantallas

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | todos | Inicio: elegir **Mi Negocio** (usuario + clave) o **Admin** (`/?mode=admin` va directo) |
| `/<slug>` | negocio | Mismo login con el negocio ya elegido |
| `/<slug>/dashboard` | usuario del negocio | Estado de la licencia, usuarios y botón **Abrir Punto de Venta** |
| `/admin` | super admin | CRUD de negocios, usuarios, plan, suspender/activar, renovar suscripción |

`src/middleware.ts` protege `/admin/*` (solo `super_admin`) y
`/<slug>/dashboard/*` (solo usuarios de ese mismo negocio).

## Base de datos (`prisma/schema.sql`)

Tablas con prefijo `nx_` (las del POS usan `pos_`, en la misma D1):

| Tabla | Contenido |
|---|---|
| `nx_super_admins` | Administradores de la plataforma |
| `nx_tenants` | Negocios: nombre, `slug`, plan (`basic`/`business`/`premium`), `status` (`active`/`suspended`), límites, `billing_cycle`, `subscription_expires_at`, `pos_url` opcional |
| `nx_tenant_users` | Usuarios de cada negocio (`admin`, `vendedor`, `cajero`), únicos por negocio |
| `nx_activity_logs` | Bitácora (creación de negocios, accesos al POS, etc.) |

El `id` de `nx_tenants` es el `tenant_id` con el que el POS separa los datos de
cada negocio.

## Suscripción y licencia

`src/lib/subscription.ts`:

- **Ciclo de cobro:** `monthly`, `annual` o `none` (sin corte).
- **Fecha de corte:** al crear el negocio se pone un periodo desde hoy. Al
  **renovar**, se suma un periodo desde el corte actual o desde hoy si ya venció.
- Un negocio está **habilitado** si `status = 'active'` y su corte no pasó.

Un negocio suspendido o vencido **sí** puede entrar a su panel para ver el
aviso, pero no puede abrir el POS (`getActiveTenantSession` en
`src/lib/guards.ts`). El POS lee las mismas columnas de `nx_tenants` para
derivar su licencia. Los planes `business` y `premium` dan licencia
"profesional"; `basic` da "básica".

## Acceso al POS (SSO)

1. En su panel, el usuario pulsa **Abrir Punto de Venta** → `POST /api/sso`.
2. Se verifica que el usuario siga activo y el negocio habilitado.
3. Se firma un JWT de 5 minutos con `NEXUS_SSO_SECRET` (`iss: nexus-one`,
   `aud: myecommerce-pos`) y se redirige a
   `<URL del POS>/api/nexus-sso?token=…`.
4. El POS valida el token con el mismo secreto y abre la sesión en ese negocio.

La URL del POS es `nx_tenants.pos_url` si el negocio la tiene, o
`MYECOMMERCE_URL` de `wrangler.toml` (debe ser `https://`).

## API

| Endpoint | Uso |
|---|---|
| `POST /api/auth` | `action`: `admin_login`, `tenant_login` (con o sin `tenantSlug`; sin él busca el usuario en todos los negocios), `create_tenant_user`, `change_admin_password` |
| `GET /api/auth` | Valida el token y devuelve usuario + estado del negocio |
| `GET/POST/PUT/DELETE /api/tenants` | Super admin: listar (`?status=`, `?search=`), crear (con usuario dueño `<slug>-admin`), actualizar (`renew: true` renueva), eliminar |
| `GET /api/tenants/[id]` | Super admin: un negocio con sus usuarios |
| `GET/POST/DELETE /api/tenants/users` | Usuarios de un negocio (respeta `max_users`) |
| `POST /api/sso` | Genera el enlace de acceso al POS |

Las sesiones son JWT de 24 h firmados con `JWT_SECRET`, enviados como
`Authorization: Bearer` o en la cookie `session_token`.

## Configuración

`wrangler.toml` trae el binding `DB` (D1 `ok_db`) y la variable
`MYECOMMERCE_URL`. Se pone ahí y no en el panel porque, si el proyecto tiene
`wrangler.toml`, Cloudflare ignora las variables normales definidas en el panel
(los secretos sí se respetan).

Secretos (nunca en el repo):

| Secreto | Uso |
|---|---|
| `JWT_SECRET` | Firma las sesiones. Mientras no exista se usa una clave anterior (con aviso en el log): configúralo |
| `NEXUS_SSO_SECRET` | Firma el token de acceso al POS. **Mismo valor** en el proyecto `myecommerce-pos` |
| `SUPERADMIN_INITIAL_PASSWORD` | Clave del `superadmin` en su primer login (mín. 8 caracteres). Luego se guarda su hash y ya no se usa |

```bash
npx wrangler pages secret put JWT_SECRET --project-name=nexus-one
npx wrangler pages secret put NEXUS_SSO_SECRET --project-name=nexus-one
npx wrangler pages secret put SUPERADMIN_INITIAL_PASSWORD --project-name=nexus-one
```

## Desarrollo y despliegue

```bash
npm install
npm run db:local        # aplica prisma/schema.sql a la D1 local
npm run pages:build     # build de Cloudflare Pages (next-on-pages)
npm run preview         # wrangler pages dev sobre .vercel/output/static

npm run db:schema       # aplica el esquema a la D1 remota (idempotente)
npm run pages:deploy    # build + deploy al proyecto nexus-one
```

`npm run dev` (Next.js normal) no tiene binding D1, así que las rutas API
responden "Database not available". Para probar con datos usa
`pages:build` + `preview`.

## Estructura

```
src/
├── middleware.ts            protección de /admin y /<slug>/dashboard
├── app/
│   ├── page.tsx             login (negocio / super admin)
│   ├── [slug]/              login del negocio y su dashboard
│   ├── admin/page.tsx       panel del super admin
│   └── api/                 auth, tenants, tenants/[id], tenants/users, sso
├── components/tenant-dashboard.tsx
└── lib/
    ├── session.ts           JWT de sesión y de SSO, lectura de secretos
    ├── auth.ts              hash/verificación PBKDF2
    ├── guards.ts            sesión de negocio (activa o no)
    ├── subscription.ts      ciclos, corte y renovación
    └── response.ts          helpers de respuesta JSON
prisma/schema.sql            esquema nx_* + semilla del superadmin
```
