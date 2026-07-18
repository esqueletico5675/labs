# Guía para poner en marcha el PILOTO

Objetivo: que el taller piloto use el sistema de verdad — panel para el
personal, portal para los clientes, y recordatorios automáticos.

**DECISIÓN DEL MVP: el canal de recordatorios es el CORREO.** Ya está
construido, es gratis y no depende de aprobaciones de nadie. WhatsApp
(paso 4) queda como opcional para después — el código ya lo soporta, así
que activarlo más adelante no requiere programar nada.

El orden importa: cada paso deja algo funcionando que el siguiente necesita.

---

## Paso 0 — ¿Dónde va a vivir la app? (decisión)

El portal y el panel necesitan una **URL pública** (los clientes abren su
enlace desde el celular). Opción recomendada, gratis para empezar:

- **Base de datos:** Supabase (PostgreSQL, plan gratis).
- **Servidor:** Render.com (plan gratis; se "duerme" tras 15 min sin uso y
  tarda ~30 s en despertar — aceptable para el piloto).

Alternativa: un computador del taller con la app en la red local. NO la
recomiendo: sin URL pública no hay portal ni enlaces para clientes.

## Paso 1 — Base de datos (Supabase)

1. Crea cuenta en https://supabase.com → New project (región `South America`).
2. Guarda la contraseña de la base de datos que te pide (¡en un lugar seguro!).
3. Botón **Connect** → pestaña **Session pooler** → copia la URI. Se ve así:
   `postgresql://postgres.xxxx:[TU-CLAVE]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
4. Esa URI será la variable de entorno `DATABASE_URL` (paso 3).

Nota: usa siempre el **Session pooler**, no la conexión directa (la directa
es solo IPv6 y falla en muchas redes).

## Paso 2 — Correo (Gmail) — EL CANAL DEL MVP

1. Crea o usa un Gmail del taller (ej. `recordatorios.taller@gmail.com`).
2. Actívale verificación en dos pasos → luego genera una **contraseña de
   aplicación**: https://myaccount.google.com/apppasswords
3. Variables: `SMTP_HOST=smtp.gmail.com`, `SMTP_USUARIO=<el gmail>`,
   `SMTP_CLAVE=<la contraseña de aplicación>`.

Con esto los recordatorios ya salen de verdad (límite de Gmail: ~500/día,
de sobra para el piloto). Regla de oro del taller: **pedir SIEMPRE el
correo al registrar un cliente** — sin correo no hay recordatorio
automático, y ese cliente queda solo en el tablero de llamadas.

Prueba rápida: botón "Enviar recordatorios" en el tablero del panel; el
resumen dice cuántos correos salieron.

## Paso 3 — Servidor (Render)

1. Sube el proyecto a GitHub (sin `taller.db`, `venv/` ni `llaves_push.json`
   — el `.gitignore` ya los excluye).
2. En https://render.com → New → **Blueprint** → conecta el repositorio.
   El archivo `render.yaml` del repo ya trae toda la configuración
   (build, start, plan gratis); Render solo te preguntará los secretos.
3. Variables que Render pedirá en pantalla (las demás vienen del Blueprint):

   | Variable | Valor |
   |---|---|
   | `ENTORNO` | `produccion` (ya viene en el Blueprint) |
   | `JWT_SECRETO` | Render la genera sola (Blueprint) |
   | `DATABASE_URL` | la URI del pooler de Supabase (paso 1) |
   | `PORTAL_URL` | la URL que Render te dé, ej. `https://taller-diesel.onrender.com` |
   | `SMTP_HOST` / `SMTP_USUARIO` / `SMTP_CLAVE` | las del paso 2 |
   | `VAPID_PUBLICA` / `VAPID_PRIVADA` | corre local `python generar_llaves_push.py` y copia las llaves |

4. Despliega. Al abrir la URL: `/panel/` (personal) y `/app/` (clientes).
5. Primer uso real: entra a `/panel/` → **"¿Taller nuevo? Abre tu cuenta
   aquí"** → registra el taller piloto. Las tablas se crean solas.

## Paso 4 — WhatsApp (OPCIONAL — para después del MVP)

El MVP funciona completo sin este paso. Cuando el piloto ya ruede con
correo y quieran subir de nivel, WhatsApp se activa solo con variables de
entorno (el código ya lo soporta). Dos etapas. La A sirve para DEMOSTRAR
en 15 minutos; la B es la definitiva.

### Etapa A — Número de prueba de Meta (hoy, gratis, 15 minutos)

1. Cuenta en https://developers.facebook.com → **Create App** → tipo
   "Business" → agrega el producto **WhatsApp**.
2. Meta te regala un **número de prueba**. En "API Setup" verás:
   - **Temporary access token** → variable `WHATSAPP_TOKEN`
   - **Phone number ID** (número largo, NO es el teléfono) → `WHATSAPP_PHONE_ID`
3. En la misma pantalla agrega hasta **5 números destino verificados**
   (el tuyo, el de tu socio, el del dueño del taller). Solo a esos puede
   escribir el número de prueba.
4. Prueba desde tu computador:
   ```
   set WHATSAPP_TOKEN=EAAG...
   set WHATSAPP_PHONE_ID=1234567890
   python probar_whatsapp.py 3001234567
   ```
   Si te llega el mensaje: el canal funciona. Esto basta para el demo del MVP.

   Ojo: el token temporal vence cada 23 horas. Para no renovarlo a diario,
   crea un **token permanente**: Business Settings → System users → Add →
   genera token con permiso `whatsapp_business_messaging`.

### Etapa B — Número propio + plantilla (el piloto real)

La regla de Meta: texto libre SOLO dentro de las 24 h siguientes al último
mensaje DEL cliente. Un recordatorio proactivo necesita **plantilla aprobada**.

1. En el panel de WhatsApp → agrega el **número real del taller** (un número
   que NO esté usando WhatsApp normal; puede ser una SIM nueva) y completa
   la **verificación del negocio** en Meta (nombre, dirección, sitio web o
   Facebook del taller; tarda de horas a pocos días).
2. Crea la plantilla: WhatsApp Manager → Message templates → Create:
   - Nombre: `recordatorio_mantenimiento` · Categoría: **Utility** · Idioma: `es_CO`
   - Cuerpo:
     ```
     Hola {{1}}, del taller te recordamos que tu vehículo {{2}} tiene pendiente: {{3}}. Responde este mensaje para agendar tu cita.
     ```
   - La aprobación tarda de minutos a 24 h.
3. Cuando esté aprobada, agrega en Render:
   - `WHATSAPP_PLANTILLA=recordatorio_mantenimiento`
   - (y `WHATSAPP_IDIOMA=es_CO` si usaste otro código de idioma)
4. Desde ese momento `enviar_recordatorios` usa la plantilla automáticamente
   con las 3 variables (nombre, placa, pendientes). Sin tocar código.

**Costos (Colombia, orden de magnitud):** las plantillas *Utility* cuestan
centavos de dólar por mensaje y las 1.000 primeras conversaciones de
servicio al mes son gratis. Para un taller piloto son unos pocos dólares
al mes. Si el cliente responde, se abre la ventana de 24 h y las respuestas
son texto libre gratis.

## Paso 5 — Tareas diarias

- **Recordatorios:** Render → **Cron Job** (o "Scheduled Job") →
  `python enviar_recordatorios.py`, todos los días a una hora decente
  (ej. 8:00 am Colombia = `0 13 * * *` en UTC).
- **Backups:** Supabase gratis NO respalda solo. `python respaldar_bd.py`
  ya cubre los dos casos leyendo `DATABASE_URL`: sin ella respalda el SQLite
  local; con la URL de Supabase respalda la base remota (usa `pg_dump` si
  está instalado; si no, un plan B en Python exporta todos los datos a un
  `.sql`). Programarlo en el PC del taller con el Programador de tareas de
  Windows (diario, igual que los recordatorios), con `DATABASE_URL` en el
  `.env`. Las copias quedan en `respaldos/` con rotación automática; cómo
  restaurar está explicado al inicio de `respaldar_bd.py`.

## Paso 6 — Checklist de arranque con el taller

- [ ] Registrar el taller real en `/panel/` (borrar datos de prueba si los hay).
- [ ] Ajustar las **Reglas** a los intervalos que use el taller (manda el manual del fabricante).
- [ ] Crear 2-3 usuarios: el admin y los mecánicos.
- [ ] Cargar los primeros 10-20 clientes y vehículos REALES, **siempre con
      correo** (con el checkbox de consentimiento: mostrarle al cliente la
      política de `/app/privacidad.html`).
- [ ] A cada cliente: compartirle su **enlace del portal** por WhatsApp.
- [ ] Verificar que el primer envío de recordatorios salga bien (botón
      "Enviar recordatorios" del tablero, antes de confiar en el cron).
- [ ] Verificar que el correo de recordatorio llegue a un correo tuyo
      (regístrate como cliente de prueba con un vehículo "vencido").
- [ ] (Solo si activaron WhatsApp) probar `probar_whatsapp.py` con el
      número del dueño del taller.

## Si algo falla

- **El servidor no arranca:** revisa que `JWT_SECRETO` esté definida
  (con `ENTORNO=produccion` es obligatoria, a propósito).
- **WhatsApp no llega:** corre `probar_whatsapp.py`; imprime el motivo
  exacto de Meta (token vencido, número no verificado, plantilla no aprobada).
- **La BD no conecta:** ¿usaste la URI del *Session pooler*? ¿La contraseña
  va dentro de la URI sin corchetes?
