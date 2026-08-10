# Peregrinación a Luján — App de inscripción, micros y asistencia

Next.js (App Router) + Supabase (Postgres/Auth/Storage) + Mercado Pago Checkout Pro.
PWA offline-first para la toma de asistencia de los capitanes de micro.

Ver el plan completo en `../../.claude/plans/crea-una-app-para-floofy-wave.md` (o pedile a
Claude que te lo resuma) para el diseño completo. Este README es la guía práctica de puesta
en marcha.

## 1. Crear los servicios externos

1. **Supabase**: creá un proyecto en https://supabase.com. Anotá `Project URL`, `anon key` y
   `service_role key` (Settings → API).
2. **Mercado Pago**: creá una aplicación en https://www.mercadopago.com.ar/developers.
   Usá las credenciales de **prueba** (sandbox) mientras desarrollás; recién pasá a
   producción cerca de abrir la inscripción real.
3. **Vercel**: conectá este repo a un proyecto de Vercel para el deploy.

## 2. Variables de entorno

Copiá `.env.local.example` a `.env.local` y completá:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (¡nunca la expongas al cliente!) |
| `MP_ACCESS_TOKEN` | Mercado Pago → Tus integraciones → Credenciales |
| `MP_WEBHOOK_SECRET` | Mercado Pago → Tus integraciones → Webhooks → Firma secreta |
| `NEXT_PUBLIC_SITE_URL` | La URL pública del deploy (`https://...vercel.app` o dominio propio) |
| `MAGIC_LINK_SECRET` | Cualquier string largo y random (`openssl rand -hex 32`) |
| `CRON_SECRET` | Cualquier string random — Vercel Cron lo manda automático si está seteado |

En Vercel, configurá las mismas variables en Project Settings → Environment Variables.

## 3. Base de datos

Con la [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
supabase link --project-ref <tu-project-ref>
supabase db push          # aplica supabase/migrations/*.sql
```

Para cargar el evento real (Peregrinación 3 de octubre de 2026) de ejemplo:

```bash
psql "$(supabase db url --linked)" -f supabase/seed.sql
```

(o pegá el contenido de `supabase/seed.sql` en el SQL Editor del dashboard de Supabase).

El evento se crea en estado `draft` — cambialo a `open` desde
`/admin/eventos/[id]/config` cuando quieras abrir la inscripción pública.

### Storage

La migración `20260809000001_rls_and_security.sql` crea el bucket privado
`registration-documents`. No hace falta ninguna configuración manual adicional: todo el
acceso (subida y lectura) pasa por rutas server-side con la service role key, nunca
directo desde el cliente.

## 4. Primer usuario admin

Como el alta de usuarios normalmente se hace desde `/admin/usuarios` (que requiere ya ser
admin), el primerísimo admin hay que crearlo a mano una vez:

1. Supabase Dashboard → Authentication → Users → "Add user" (con email + contraseña).
2. SQL Editor → `update public.profiles set role = 'admin' where id = '<user-id>';`

De ahí en más, todo alta de usuarios (admin o capitanes) se hace desde `/admin/usuarios`.

## 5. Desarrollo local

```bash
npm install
npm run dev
```

> Nota: el service worker (PWA) usa webpack, no Turbopack (Serwist todavía no lo soporta).
> Por eso `dev`/`build` corren con `--webpack`. En desarrollo el service worker está
> deshabilitado (`disable: NODE_ENV === "development"` en `next.config.ts`) para no pelear
> con el hot reload — probalo con `npm run build && npm run start`.

## 6. Cron de expiración de inscripciones

`vercel.json` ya declara el cron diario de `/api/cron/expire-registrations`. Si el proyecto
no se despliega en Vercel, hay que disparar ese endpoint diariamente por otro medio (GitHub
Actions, un cron externo, etc.), siempre mandando `Authorization: Bearer $CRON_SECRET`.

## 7. Lo que falta para producción (no incluido en este alcance)

- **Envío de emails reales** (confirmación de pago con el link mágico de
  `/mi-inscripcion/[id]`, hoy ese link solo se muestra en la pantalla de resultado del
  pago). Integrar un proveedor tipo Resend desde el webhook de Mercado Pago
  (`app/api/webhooks/mercadopago/route.ts`) cuando `confirm_payment` confirma la
  inscripción.
- **Íconos reales de la PWA** (`public/icons/icon-192.png` y `icon-512.png` son
  placeholders generados por código, reemplazar por arte real antes de publicar).
- Probar el flujo offline completo con los celulares reales de los capitanes antes del
  3 de octubre (ver la sección de verificación del plan).
