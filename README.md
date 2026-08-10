# Peregrinación a Luján — App de inscripción, micros y asistencia

Next.js (App Router) + Supabase (Postgres/Auth/Storage). PWA offline-first para la toma de
asistencia de los capitanes de micro. El cobro es manual: alias o efectivo en Secretaría
Parroquial, confirmado a mano por un admin al recibir el comprobante (Mercado Pago quedó
integrado pero desconectado del flujo — ver más abajo).

Ver el plan completo en `../../.claude/plans/crea-una-app-para-floofy-wave.md` (o pedile a
Claude que te lo resuma) para el diseño completo. Este README es la guía práctica de puesta
en marcha.

## Estado actual

- Supabase ya está creado y linkeado (`supabase/migrations/` aplicadas, evento real
  cargado en `draft`).
- Ya existe una cuenta admin (`sebastian@tiendago.com.ar`).
- Faltan cargar: el alias de pago / instrucciones de Secretaría (`/admin/eventos/[id]/config`),
  y abrir la inscripción (`status: open`) cuando esté todo listo.

## 1. Variables de entorno

Copiá `.env.local.example` a `.env.local` y completá:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (¡nunca la expongas al cliente!) |
| `NEXT_PUBLIC_SITE_URL` | La URL pública del deploy (`https://...vercel.app` o dominio propio) |
| `MAGIC_LINK_SECRET` | Cualquier string largo y random |
| `CRON_SECRET` | Cualquier string random — Vercel Cron lo manda automático si está seteado |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | No hacen falta con el flujo actual (pago manual) — solo si en algún momento se reactiva Mercado Pago |

En Vercel, configurá las mismas variables en Project Settings → Environment Variables.

## 2. Base de datos

Con la Supabase CLI (no hace falta instalarla global, `npx supabase` alcanza) y un
[access token personal](https://supabase.com/dashboard/account/tokens):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase link --project-ref <tu-project-ref>
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db push          # aplica supabase/migrations/*.sql
```

Para cargar el evento real de ejemplo (ya cargado en el proyecto actual):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked -f supabase/seed.sql
```

El evento se crea en estado `draft` — cambialo a `open` desde `/admin/eventos/[id]/config`
cuando quieras abrir la inscripción pública. Ahí mismo se cargan el **alias de
transferencia** y las **instrucciones de pago** (efectivo en Secretaría, a qué mail mandar
el comprobante, horarios) que ve el peregrino en `/mi-inscripcion/[id]`.

### Storage

La migración `20260809000001_rls_and_security.sql` crea el bucket privado
`registration-documents`. No hace falta ninguna configuración manual adicional: todo el
acceso (subida y lectura) pasa por rutas server-side con la service role key, nunca
directo desde el cliente.

## 3. Primer usuario admin

Como el alta de usuarios normalmente se hace desde `/admin/usuarios` (que requiere ya ser
admin), el primerísimo admin hay que crearlo a mano una vez, vía la Admin API de Supabase
Auth (`auth.admin.inviteUserByEmail` / `updateUserById`) o directo desde el dashboard
(Authentication → Users → "Add user", y después `update public.profiles set role = 'admin'
where id = '<user-id>'` en el SQL Editor).

## 4. Desarrollo local

```bash
npm install
npm run dev
```

**Importante**: corré esto en tu propia terminal, no a través de un entorno con red
restringida — el server necesita conexión real a `*.supabase.co` para que el login y
cualquier página funcionen (si ves `AuthRetryableFetchError: fetch failed` en la consola,
es exactamente eso).

> Nota: el service worker (PWA) usa webpack, no Turbopack (Serwist todavía no lo soporta).
> Por eso `dev`/`build` corren con `--webpack`. En desarrollo el service worker está
> deshabilitado (`disable: NODE_ENV === "development"` en `next.config.ts`) — probalo con
> `npm run build && npm run start`.

## 5. Cron de expiración de inscripciones

`vercel.json` ya declara el cron diario de `/api/cron/expire-registrations` (marca como
`expired` las inscripciones que quedaron muchos días en `pending_payment` sin que se
confirme el pago). Si el proyecto no se despliega en Vercel, hay que disparar ese endpoint
diariamente por otro medio, siempre mandando `Authorization: Bearer $CRON_SECRET`.

## 6. Sobre Mercado Pago (desconectado, no eliminado)

La integración completa (creación de preferencia, webhook con verificación de firma e
idempotencia, reconciliación manual) sigue en `lib/mercadopago/` y
`app/api/webhooks/mercadopago/`, pero no la llama nadie — el formulario de inscripción
(`app/api/registrations/route.ts`) hoy termina directo en el link mágico de
`/mi-inscripcion/[id]` con las instrucciones de pago manual. Si más adelante se quiere
ofrecer Mercado Pago como opción adicional, es cuestión de volver a invocar
`createRegistrationPreference` desde ese mismo endpoint.

## 7. Lo que falta para producción

- **Envío de emails reales** (hoy el link mágico de `/mi-inscripcion/[id]` solo se muestra
  en pantalla al terminar de inscribirse, no se manda por mail). Integrar un proveedor tipo
  Resend.
- Cargar el logo/colores definitivos si cambian respecto a los actuales (paleta en
  `app/globals.css`, íconos en `public/icons/` y `app/icon.png` generados desde
  `Documents/Logos Parroquia/Logo Parroquia.jpeg`).
- Probar el flujo offline completo con los celulares reales de los capitanes antes del
  3 de octubre (ver la sección de verificación del plan).
