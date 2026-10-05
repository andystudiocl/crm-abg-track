# CRM ABG Car Boutique

CRM interno de ABG Car Boutique para gestionar leads (Meta Lead Ads, WhatsApp y sitio web), inventario de autos con fotos, catálogo público para el sitio existente y agenda de reuniones con Google Calendar.

**Stack:** Next.js 14 (App Router, TypeScript estricto, Server Actions) · Supabase (Postgres, Auth, Storage) · WhatsApp Business Cloud API · Meta Graph API v21.0 · Google Calendar API · CSS propio (sin Tailwind ni librerías de UI) · despliegue en Vercel.

---

## Índice

1. [Supabase: proyecto y base de datos](#1-supabase-proyecto-y-base-de-datos)
2. [Crear usuarios asesores](#2-crear-usuarios-asesores)
3. [Variables de entorno y desarrollo local](#3-variables-de-entorno-y-desarrollo-local)
4. [Meta: Lead Ads y WhatsApp](#4-meta-lead-ads-y-whatsapp)
5. [Google Calendar](#5-google-calendar)
6. [Conectar el sitio web existente](#6-conectar-el-sitio-web-existente)
7. [Desplegar en Vercel](#7-desplegar-en-vercel)
8. [Probar webhooks en local con un túnel](#8-probar-webhooks-en-local-con-un-túnel)
9. [Estructura del proyecto](#9-estructura-del-proyecto)
10. [Seguridad](#10-seguridad)
11. [Siguientes pasos](#11-siguientes-pasos)

---

## 1. Supabase: proyecto y base de datos

1. Crea un proyecto en [supabase.com](https://supabase.com). Te conviene la región **South America (São Paulo)** por cercanía.
2. Ve a **SQL Editor → New query**, pega todo [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo. El script se puede volver a correr sin problemas. Crea:
   - las tablas `advisors`, `vehicles`, `vehicle_photos`, `leads`, `lead_messages` y `appointments`, con sus enums e índices;
   - el trigger que crea la fila en `advisors` cuando se crea un usuario (el primer usuario queda como `admin`);
   - el trigger que, al marcar un auto como `vendido`, registra `sold_at` y lo despublica;
   - RLS activado en todas las tablas: el equipo autenticado lee y escribe, y el rol `anon` no tiene acceso;
   - el bucket público `vehicles` en Storage (cualquiera puede leer; solo usuarios autenticados pueden subir, modificar o borrar).
3. **Importante: desactiva los registros públicos.** En **Authentication → Sign In / Providers → Email**, apaga **"Allow new users to sign up"**. Si no lo haces, cualquiera con la clave anon (que es pública) podría crearse una cuenta y entrar al CRM.
4. En **Project Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (es secreta y solo se usa en el servidor)

> El token de Google de cada asesor (`advisors.google_refresh_token`) **no se puede leer desde el navegador**: el SQL revoca el permiso de esa columna para el rol `authenticated`. Solo el servidor lo lee, con service_role. La UI usa la columna calculada `google_connected`.

## 2. Crear usuarios asesores

Como los registros públicos quedan apagados, los usuarios se crean a mano:

1. Ve a **Authentication → Users → Add user → Create new user**.
2. Ingresa el correo y una contraseña, y marca **Auto Confirm User**.
3. El **primer usuario** que crees queda como `admin` y el resto como `asesor`. Por ahora los dos roles tienen los mismos permisos (ver [Siguientes pasos](#11-siguientes-pasos)).
4. El nombre visible se toma de `user_metadata.name` si existe; si no, se usa la parte del correo antes de la @. Puedes cambiarlo en **Table Editor → advisors → name**.

Cada asesor entra en `/login` con su correo y contraseña.

## 3. Variables de entorno y desarrollo local

```bash
cp .env.example .env.local   # y completa los valores
npm install
npm run dev                   # http://localhost:3000
npm run build                 # build de producción
npm test                      # pruebas de lógica pura (requiere Node 22.18+)
```

| Variable | Para qué sirve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión a Supabase. Son públicas y quedan protegidas por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: la usan los webhooks, la API pública y el guardado del token de Google. |
| `APP_URL` | URL pública del CRM, sin `/` al final. Se usa para el redirect de Google y los enlaces en los eventos. |
| `SITE_ORIGIN` | Origen del sitio web que consume la API pública (CORS). Admite varios separados por coma: `https://abg.cl,https://www.abg.cl`. |
| `META_APP_SECRET` | Valida la firma `X-Hub-Signature-256` de los webhooks de Meta. |
| `META_VERIFY_TOKEN` | Texto que inventas tú y que también pegas en Meta para verificar los webhooks. |
| `META_PAGE_ACCESS_TOKEN` | Token de la página de Facebook para leer los leads de Lead Ads. |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | Envío de mensajes por WhatsApp Cloud API. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth de Google Calendar. |

## 4. Meta: Lead Ads y WhatsApp

Usa **una sola app de Meta** para las dos integraciones, porque comparten el `META_APP_SECRET`.

### 4.1 Crear la app

1. Entra a [developers.facebook.com/apps](https://developers.facebook.com/apps), crea una app de tipo **Business** y asóciala al portafolio comercial (Business Manager) de ABG.
2. En **App settings → Basic** copia el **App secret** → `META_APP_SECRET`.
3. Inventa un texto largo y aleatorio para `META_VERIFY_TOKEN`.

### 4.2 Lead Ads (webhook `leadgen`)

1. Agrega el producto **Webhooks**, elige el objeto **Page** y configura:
   - **Callback URL:** `{APP_URL}/api/webhooks/meta`
   - **Verify token:** el valor de `META_VERIFY_TOKEN`
   - Suscríbete al campo **`leadgen`**.
2. Permisos que necesita la app: `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata` y `pages_manage_ads`. Agrega `ads_read` si quieres que lleguen los nombres de campaña y anuncio; sin ese permiso el CRM guarda igual el lead, con los IDs. Para producción, la app debe pasar la revisión de Meta (*App Review*) o usarse con usuarios que tengan rol en la app.
3. **Token de página:** lo recomendable es crear un **usuario del sistema** en Business Manager (Configuración → Usuarios del sistema), asignarle la página y la app, y generar un token sin vencimiento con esos permisos. Ese es `META_PAGE_ACCESS_TOKEN`.
4. **Suscribe la página a la app** (es un solo paso, con el token de página):
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen" \
     -H "Authorization: Bearer {META_PAGE_ACCESS_TOKEN}"
   ```
5. En **Meta Business Suite → Configuración → Integraciones → Acceso a clientes potenciales**, confirma que la app (o el CRM) tenga acceso a los formularios.
6. Prueba con la [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing): crea un lead de prueba y debería aparecer en la columna **Nuevo** del tablero.

Cómo se procesan los leads: el CRM consulta cada lead en Graph API v21.0 y lo guarda con `source = meta_ads` y `external_id = meta:<leadgen_id>`. Toma el nombre, teléfono y correo de los campos comunes (`full_name`, `phone_number`, `email` y sus variantes en español). Todas las demás respuestas del formulario, junto con la campaña y el anuncio, quedan en **notas**. Si la consulta a Graph falla, el webhook responde 500 para que Meta reintente; los reintentos no duplican leads gracias a `external_id`.

### 4.3 WhatsApp Business Cloud API

1. Agrega el producto **WhatsApp** a la misma app y registra el número de ABG (o usa el número de prueba para empezar).
2. En **WhatsApp → API Setup** copia el **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. **Token permanente:** con un usuario del sistema que tenga asignada la cuenta de WhatsApp y la app, genera un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese es `WHATSAPP_ACCESS_TOKEN`. El token temporal de la página de API Setup vence en 24 h.
4. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL:** `{APP_URL}/api/webhooks/whatsapp`
   - **Verify token:** el mismo `META_VERIFY_TOKEN`
   - En **Webhook fields**, suscríbete a **`messages`**.

Cómo funciona:
- **Mensajes entrantes:** se ignora un mensaje si su `wa_message_id` ya existe. El lead se busca por teléfono o se crea (`source = whatsapp`, con el nombre del perfil de WhatsApp). Luego se guarda el mensaje y se actualiza `last_message_at`. Los mensajes que no son texto quedan como marcador, por ejemplo `[image] texto del pie de foto`.
- **Envío:** desde la ficha del lead, solo con texto libre y **solo dentro de las 24 h posteriores al último mensaje del cliente**, que es una regla de WhatsApp. Fuera de esa ventana el CRM bloquea el envío y lo explica. Si el lead estaba en *Nuevo*, al responderle pasa a *Contactado*.
- La ficha revisa si llegaron mensajes nuevos cada 20 segundos mientras está abierta.

## 5. Google Calendar

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto y activa la **Google Calendar API** (APIs & Services → Library).
2. Configura la **pantalla de consentimiento de OAuth** (OAuth consent screen):
   - Si ABG usa **Google Workspace**, elige **Internal**: es lo más simple y no requiere verificación.
   - Si usan cuentas `@gmail.com`, elige **External**, agrega el scope `.../auth/calendar.events` y, mientras esté en modo *Testing*, agrega a cada asesor como *test user*. **Ojo:** en modo Testing, Google invalida los tokens después de 7 días. Para uso continuo hay que pasar la app a *In production* (Google puede pedir verificación).
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized redirect URI:** `{APP_URL}/api/google/callback`, por ejemplo `https://crm.abgcarboutique.cl/api/google/callback`. Para desarrollo agrega también `http://localhost:3000/api/google/callback`.
   - Copia el client ID y el client secret a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
4. Cada asesor entra a **Agenda → Conectar mi Google Calendar**.

Cómo funciona:
- **OAuth:** se pide `access_type=offline`, `prompt=consent` y el scope `calendar.events`. El `state` lleva el id del asesor más un nonce guardado en una cookie httpOnly. El callback solo acepta el código si el usuario con sesión coincide con el `state` y el nonce también coincide. Así nadie puede conectar su propia cuenta de Google en la sesión de otro asesor.
- **Al agendar** (desde la ficha del lead o desde `/calendar`) se crea el evento en el calendario `primary` del asesor, en zona `America/Santiago`. El título es «Visita ABG: cliente · auto», el teléfono va en la descripción y el correo del lead se agrega como invitado (con envío de invitación).
- Si el asesor no conectó Google o la API falla, la reunión **se guarda igual en el CRM** y aparece como «Solo en CRM». Si Google revocó el permiso, el CRM borra el token y pide reconectar.
- Al agendar, si el lead estaba en *Nuevo* o *Contactado*, pasa a *Agendado*.
- Al cancelar una reunión en el CRM también se borra el evento en Google, si existe.

## 6. Conectar el sitio web existente

La API pública solo acepta peticiones del navegador que vengan de `SITE_ORIGIN` (CORS).

### Catálogo: `GET {APP_URL}/api/public/vehicles`

Devuelve solo los autos con `published = true` que no están vendidos. La foto de portada va primero y todas las fotos vienen como URL pública. La respuesta queda en caché del CDN por 60 segundos.

```json
{
  "vehicles": [
    {
      "id": "1b0c…",
      "marca": "Porsche", "modelo": "911", "version": "Carrera S", "anio": 2021,
      "km": 18000, "precio_clp": 129990000,
      "combustible": "Bencina", "transmision": "Automática", "color": "Gris",
      "descripcion": "…", "status": "disponible", "arrived_at": "2026-09-30",
      "updated_at": "…",
      "cover": "https://xxxx.supabase.co/storage/v1/object/public/vehicles/…jpg",
      "photos": ["https://…jpg", "https://…jpg"]
    }
  ]
}
```

Para pedir un solo auto usa `GET /api/public/vehicles?id=<uuid>`, que responde `{ "vehicle": {...} }` o 404. La patente no se publica.

```html
<div id="catalogo"></div>
<script>
  const CRM = 'https://crm.abgcarboutique.cl';
  const clp = (n) => '$' + Math.round(n).toLocaleString('es-CL');

  fetch(CRM + '/api/public/vehicles')
    .then((r) => r.json())
    .then(({ vehicles }) => {
      document.getElementById('catalogo').innerHTML = vehicles.map((v) => `
        <article>
          <img src="${v.cover ?? ''}" alt="${v.marca} ${v.modelo}" loading="lazy">
          <h3>${v.marca} ${v.modelo} ${v.version ?? ''} ${v.anio}</h3>
          <p>${v.km.toLocaleString('es-CL')} km · ${clp(v.precio_clp)}</p>
        </article>`).join('');
    });
</script>
```

> Si tu plataforma permite datos del CMS, escapa los textos antes de insertarlos como HTML.

### Formulario de contacto: `POST {APP_URL}/api/public/lead`

Cuerpo en JSON (también acepta `application/x-www-form-urlencoded`):

```json
{ "name": "Ana Pérez", "phone": "+56 9 1234 5678", "email": "ana@correo.cl",
  "message": "¿Aceptan parte de pago?", "vehicle_id": "1b0c…", "website": "" }
```

- Exige **teléfono o correo** válido (responde 422 si falta).
- Cada campo se recorta a un largo máximo y el cuerpo completo no puede pasar de 16 KB.
- `website` es un **campo trampa**: déjalo oculto y vacío. Si llega con texto, la API responde `ok` pero no guarda nada.
- Crea el lead con `source = web`, anota el auto consultado y el mensaje en las notas, y evita duplicados por teléfono.

```html
<form id="contacto">
  <input name="name" placeholder="Nombre" maxlength="120">
  <input name="phone" placeholder="Teléfono" maxlength="30">
  <input name="email" type="email" placeholder="Correo" maxlength="254">
  <textarea name="message" maxlength="2000"></textarea>
  <input type="hidden" name="vehicle_id" value="ID_DEL_AUTO">
  <!-- campo trampa: oculto para personas, visible para bots -->
  <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <button>Enviar</button>
</form>
<script>
  document.getElementById('contacto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await fetch('https://crm.abgcarboutique.cl/api/public/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    alert(json.ok ? '¡Gracias! Te contactaremos pronto.' : json.error);
  });
</script>
```

## 7. Desplegar en Vercel

1. Sube el repositorio a GitHub e impórtalo en [vercel.com/new](https://vercel.com/new). Vercel detecta Next.js automáticamente.
2. En **Settings → Environment Variables** carga todas las variables de `.env.example`, con `APP_URL` igual al dominio final.
3. Despliega. Después:
   - agrega el dominio propio (por ejemplo `crm.abgcarboutique.cl`) y actualiza `APP_URL`;
   - actualiza las URLs de callback en Meta (Lead Ads y WhatsApp) y el redirect URI en Google;
   - en Supabase → **Authentication → URL Configuration**, pon `APP_URL` como Site URL.
4. Cada vez que cambies variables de entorno, haz un **Redeploy**.

## 8. Probar webhooks en local con un túnel

Meta necesita una URL HTTPS pública. Con [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (gratis y sin cuenta):

```bash
npm run dev
cloudflared tunnel --url http://localhost:3000
# entrega algo como https://random-words.trycloudflare.com
```

También sirve `ngrok http 3000`. Después:

1. En Meta, usa temporalmente `https://<túnel>/api/webhooks/meta` y `https://<túnel>/api/webhooks/whatsapp` como Callback URL, con el mismo verify token.
2. Prueba Lead Ads con la *Lead Ads Testing Tool* y WhatsApp escribiéndole al número desde tu teléfono.
3. Para simular un webhook firmado sin pasar por Meta:
   ```bash
   BODY='{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"contacts":[{"wa_id":"56912345678","profile":{"name":"Prueba"}}],"messages":[{"from":"56912345678","id":"wamid.TEST1","timestamp":"'$(date +%s)'","type":"text","text":{"body":"Hola, me interesa el 911"}}]}}]}]}'
   SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -hex | sed 's/.*= //')"
   curl -X POST http://localhost:3000/api/webhooks/whatsapp -H "X-Hub-Signature-256: $SIG" -H 'Content-Type: application/json' --data-raw "$BODY"
   ```
4. Recuerda volver a poner las URLs de producción en Meta cuando termines.

## 9. Estructura del proyecto

```
supabase/schema.sql          Esquema completo (tablas, RLS, triggers, bucket)
middleware.ts                Refresca la sesión y redirige a /login
app/login/                   Login con correo y contraseña
app/(crm)/                   Pantallas protegidas: resumen, leads, autos, agenda
app/api/webhooks/meta        Lead Ads (GET verificación, POST firmado)
app/api/webhooks/whatsapp    WhatsApp entrante (GET verificación, POST firmado)
app/api/public/vehicles      Catálogo para el sitio (CORS)
app/api/public/lead          Formulario del sitio (CORS, antispam)
app/api/google/auth|callback OAuth de Google por asesor
actions/                     Server Actions (mutaciones)
components/                  Componentes de UI (gestor de fotos, kanban, chat…)
lib/                         Supabase, formato CLP/fechas, teléfonos, Meta, WhatsApp, Google
tests/                       Pruebas de lógica pura (npm test)
```

Nombres de columnas: la tabla `vehicles` usa nombres en español (`marca`, `modelo`, `anio`, `precio_clp`, `transmision`…). Las tablas de leads usan nombres en inglés (`name`, `phone`, `email`, `campaign`, `notes`) para coincidir con la API pública.

## 10. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` y los tokens de Meta, WhatsApp y Google solo se leen en el servidor. Los módulos que los usan importan `server-only`, así que el build falla si alguien los importa desde código del navegador.
- Los webhooks validan `X-Hub-Signature-256` con HMAC-SHA256 sobre el cuerpo crudo, con comparación en tiempo constante. Si la firma falla responden 401.
- Las rutas públicas validan, recortan y limitan el largo de toda entrada. Los logs nunca imprimen tokens ni datos de contacto.
- Las fotos se reducen en el navegador (máximo 1920 px, JPEG 0,85) y se suben directo a Storage. El bucket solo acepta JPEG, PNG y WebP de hasta 10 MB.
- Recuerda **desactivar los registros públicos** en Supabase Auth (ver paso 1.3).

## 11. Siguientes pasos

Fuera del alcance de esta versión:

- **Plantillas de WhatsApp** para escribir fuera de la ventana de 24 h (por ejemplo, el primer contacto con un lead de Meta Ads).
- **Asignación automática de leads** entre asesores (round-robin).
- **Roles con permisos distintos** para admin y asesor. Hoy ambos pueden ver y editar todo; el campo `role` ya existe.
- **Reportes de costo por lead por campaña de Meta**, cruzando con la Marketing API.

Otras mejoras recomendadas:

- **Actualizar a Next.js 15 o 16.** Next 14.2.35 (la última versión 14) tiene avisos de seguridad en `npm audit` que solo se corrigen en versiones mayores. Varios no aplican a este proyecto (optimizador de imágenes, Pages Router, servidores Windows), pero otros sí afectan a Server Components y Server Actions (riesgo de denegación de servicio).
- Limitar la frecuencia de peticiones (*rate limiting*) en `POST /api/public/lead`, por ejemplo con Vercel Firewall o Upstash.
- Mostrar en el chat las imágenes que manda el cliente (hoy queda solo el marcador `[image]`).
- Pantalla para que el admin gestione asesores sin entrar a Supabase.
