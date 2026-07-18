# Contexto del proyecto — App de mantenimiento para taller diésel

Este archivo le da contexto a Claude Code. Léelo al inicio de cada sesión.

## Qué es el proyecto

Una plataforma **SaaS multi-inquilino** para talleres de mecánica diésel. Le
recuerda a los clientes cuándo hacerle mantenimiento a su vehículo (aceite,
pastillas, filtros, etc.) y lleva el historial de ingresos y procedimientos.

- Cada **taller** es un inquilino (tenant) con sus propios datos, aislados.
- Dos tipos de usuario: **personal del taller** (registra ingresos y km) y
  **dueño del carro** (recibe recordatorios y consulta su historial).
- Se venderá a varios talleres. Se empieza con **un taller piloto**.

## Quiénes lo construyen (importante para cómo respondes)

Somos **dos personas aprendiendo**, con pocos recursos. Sabemos **FastAPI** y
un poco de HTML. Por eso:

- **Explica mientras construyes.** No solo entregues código: di qué hace y por qué.
- Prefiere soluciones **simples y baratas** sobre lo "más avanzado".
- Ve **paso a paso**; no metas muchas cosas nuevas de golpe.
- Cuando introduzcas un concepto nuevo, dilo en una frase antes de usarlo.

## Decisiones técnicas ya tomadas

- **Backend:** FastAPI (Python). Ya lo sabemos, es la base.
- **Base de datos:** SQLite para desarrollar; PostgreSQL para producción
  (**Supabase**, plan gratis). Se elige con la variable de entorno
  `DATABASE_URL` (sin definirla = SQLite local). Usar la URI del "Session
  pooler" de Supabase (la conexión directa es solo IPv6). Driver:
  `psycopg2-binary` (ya instalado en el venv).
- **Frontend / "app":** PWA (app web instalable) para cubrir Android e iPhone
  con un solo código. Nada de apps nativas separadas por ahora.
- **Ir a las tiendas (Play/App Store):** después, envolviendo la PWA con Capacitor.
- **Notificaciones:** correo + push primero. WhatsApp más adelante (tiene costo
  y requiere verificación con Meta).
- **Cobro a talleres:** probablemente suscripción mensual. Sin definir aún.

## Qué YA está construido (Fase 1)

Backend de FastAPI funcionando. Estructura:

- `app/database.py` — conexión a la BD (SQLite).
- `app/models.py` — tablas: Taller, Usuario, Cliente, Vehiculo, Ingreso,
  TipoMantenimiento, MantenimientoRealizado. Todo cuelga de `taller_id`.
- `app/schemas.py` — validación de entradas/salidas (Pydantic).
- `app/security.py` — cifrado de contraseñas con bcrypt.
- `app/mantenimiento.py` — **el motor de recordatorios**: estima el km de hoy
  y decide si cada mantenimiento está vencido / próximo / al día.
- `app/notificaciones.py` — Fase 2: redacta y envía correos (o los simula sin SMTP).
- `app/utilidades.py` — `ahora_utc()` (reemplazo moderno de `datetime.utcnow`).
- `app/main.py` — la API (todos los endpoints, CRUD completo + tablero del
  taller + dependencias de seguridad JWT + endpoints del portal).
- `portal/` — la PWA del cliente (index.html, manifest.json, sw.js, icono.svg).
- `panel/` — Fase 4: el panel web del PERSONAL del taller (servido en `/panel`):
  login JWT, tablero "¿a quién llamar hoy?", clientes (con enlace del portal y
  regenerar token), vehículos + ingresos, y reglas de mantenimiento. HTML/JS
  puro, mismo lenguaje visual oscuro del portal. Incluye `manual.html` (el
  tutorial/libro de instrucciones, 10 secciones): botón "Manual" en la
  cabecera y enlace en la pantalla de login.
- `seed.py` — datos de ejemplo (imprime login del taller y enlace del portal).
- `enviar_recordatorios.py` — tarea diaria de correos (se programa con cron /
  Programador de tareas de Windows).

Correr: `uvicorn app.main:app --reload` y probar en `/docs`.

## El motor de recordatorios (lógica central)

Avisa por **kilometraje** o **tiempo**, lo que se cumpla primero. Como al
cliente le da pereza reportar el km, lo **estimamos**: usamos el último km que
registró el taller + un promedio de km/mes calculado del historial. El taller
es la fuente confiable del km (lo registra en cada ingreso).

## Roadmap por fases

- **Fase 1 (hecha):** backend — talleres, vehículos, ingresos, motor de
  recordatorios, CRUD completo (clientes, vehículos, tipos de mantenimiento),
  tablero de pendientes del taller.
- **Fase 2 (hecha):** recordatorios por **correo** — módulo `notificaciones.py`,
  tabla `recordatorios_enviados` (no repite avisos en 7 días), script
  `enviar_recordatorios.py` para programar, y modo simulación sin SMTP.
- **Fase 3 (hecha):** login real con **JWT** (`pyjwt`; toda la API exige token
  y el servidor impone el aislamiento por taller) + **portal del cliente**
  (PWA en `portal/`, servida en `/app`; el cliente entra con su `token_acceso`,
  un enlace secreto sin contraseña) + **notificaciones push** (VAPID con
  `pywebpush`; llaves en `llaves_push.json` generadas con
  `generar_llaves_push.py`; sin llaves el push se omite, como el correo sin
  SMTP). El diseño del portal es un "tablero de instrumentos": odómetro,
  medidores radiales por mantenimiento, placa amarilla colombiana; paleta de
  estados validada para daltonismo (#059669 / #d97706 / #ef4444 sobre #10161f).
- **Fase 4 (en curso):** HECHO: (a) endpoint regenerar `token_acceso` de
  cliente (anula el enlace viejo; solo admin); (b) **panel web del taller** en
  `panel/` (servido en `/panel`); (c) **registro self-service**: POST
  `/registro` crea taller + admin + reglas por defecto en una transacción y
  devuelve el token (el viejo POST /talleres público se eliminó, igual que el
  hueco del "primer usuario sin token"); (d) **roles**: dependencia
  `admin_del_taller` protege equipo (GET/POST usuarios), reglas de
  mantenimiento (crear/editar/borrar) y regenerar token — el mecánico registra
  ingresos/clientes/vehículos y ve todo lo demás; el panel oculta lo admin con
  la clase CSS `.solo-admin`; (e) **WhatsApp** vía Meta Cloud API en
  `notificaciones.py` (`enviar_whatsapp`, `redactar_whatsapp`,
  `normalizar_telefono` con indicativo 57): sin `WHATSAPP_TOKEN` +
  `WHATSAPP_PHONE_ID` simula en consola, como el correo sin SMTP; integrado al
  envío diario (canal `whatsapp`/`whatsapp_simulado` en
  `recordatorios_enviados`). OJO producción: fuera de la ventana de 24 h Meta
  exige plantillas pre-aprobadas (pendiente al activar el piloto).
- **Fase 5 (en curso):** HECHO: (a) **backups** — `respaldar_bd.py` usa la API
  de respaldo de SQLite (segura con la BD en uso), copias fechadas en
  `respaldos/` (ignorada por git) con rotación (`RESPALDOS_MAXIMOS`, 30 por
  defecto); se programa como tarea diaria igual que `enviar_recordatorios.py`;
  (b) **endurecimiento** — con `ENTORNO=produccion` el servidor NO arranca sin
  `JWT_SECRETO` real, y el login bloquea cada correo 15 min tras 5 intentos
  fallidos (contador en memoria, por correo; con varios servidores se movería
  a BD/Redis); (c) **Habeas Data (Ley 1581/2012)** — política de privacidad en
  `portal/privacidad.html` (enlazada desde portal, registro y formulario de
  cliente), consentimiento obligatorio al crear cliente (columna
  `clientes.consentimiento_en`; sin `consentimiento: true` la API responde
  422), y derecho a supresión: DELETE
  `/talleres/{id}/clientes/{id}/datos-personales` (solo admin) anonimiza al
  cliente, borra suscripciones push y mata el enlace del portal (enlace y
  regenerar responden 410 después); el historial técnico del vehículo se
  conserva anónimo; (d) **migraciones**: `migrar_bd.py` agrega columnas
  nuevas a BDs existentes (correr tras actualizar el código; es idempotente).
  El **cobro a talleres quedó descartado por ahora** (decisión del equipo).
- **MVP CLIENTE (hecho):** (a) **login del cliente**: crea su contraseña
  desde su enlace secreto (`POST /portal/{token}/clave`; usuario = su
  correo) y entra en `/app/` con `POST /portal-login`, que devuelve su
  `token_acceso` (la PWA no cambia; mismo freno anti fuerza bruta);
  (b) **citas**: tabla `citas` (solicitada→confirmada→atendida/cancelada),
  el cliente pide fecha+nota por vehículo desde el portal (máx. 1 pendiente
  por vehículo), y el taller las gestiona en la sección "Citas" del panel
  (`GET/PATCH /talleres/{id}/citas`). **Avisos en ambos sentidos:** pedir
  cita avisa al personal (push móvil + correo del taller); confirmar,
  cancelar o marcar atendida avisa al cliente (push + correo). El cliente
  también puede CANCELAR su cita (DELETE `/portal/{token}/citas/{id}`,
  botón en portal y app móvil) y eso avisa al personal. La supresión Habeas Data también
  apaga el login del cliente.
- **APP MÓVIL (en curso, 2026-07):** app NATIVA con **React Native + Expo**
  en `movil/` (reemplaza la decisión vieja de "solo PWA" para el cliente).
  **SDK 54** (no subir sin verificar qué soporta el Expo Go del equipo).
  Estructura: `src/tema.js` (sistema de diseño, PALETAS claro/oscuro),
  `src/apariencia.js` (modo claro/oscuro, elegible en Ajustes),
  `src/api.js` (única puerta al backend; la IP local del PC va ahí),
  `src/sesion.js` (login persistente con AsyncStorage), `src/avisos.js`
  (push), `src/componentes.js` y `src/pantallas/` (Entrar, MisVehiculos,
  Vehiculo, Ajustes). Correr: `npx expo start` en `movil/` + Expo Go en el
  celular (mismo WiFi; uvicorn con `--host 0.0.0.0`). **Push de punta a
  punta:** la app registra su ExponentPushToken en POST
  `/portal/{token}/push-movil` (tabla `suscripciones_push` con
  `tipo="expo"`); `enviar_push_expo()` en `notificaciones.py` manda vía el
  servicio gratis de Expo y el envío diario elige canal según `tipo`;
  prueba rápida con `probar_push_movil.py`. **Push en Android FUNCIONANDO
  (2026-07-17)** con development build de EAS: proyecto EAS
  `taller-diesel-movil` (cuenta esqueletico5675), paquete
  `com.tallerdiesel.movil`, keystore generada por EAS, Firebase del
  usuario con FCM V1 (llave de cuenta de servicio ASIGNADA en el slot
  "FCM V1 service account key" de expo.dev — si push da
  InvalidCredentials, revisar esa asignación). `google-services.json` y
  `llave-fcm-taller.json` viven en `movil/` IGNORADOS por git; el
  primero viaja al build como variable de archivo secreta
  `GOOGLE_SERVICES_JSON` (resuelta en `app.config.js`). Compilar:
  `eas build -p android --profile development`. El development build
  necesita Metro (`npx expo start`) en el PC; para el piloto autónomo
  usar el perfil `preview`. En Expo Go Android las push siguen sin
  funcionar (probar solo con el build). iPhone: Expo Go sí recibe push. Diseño: UI MUY simple
  para clientes no técnicos (la v1 fue rechazada por confusa) — lenguaje
  cotidiano, estados con color+ícono+palabra+acción, letra grande.
  **Modo TALLER completo (paridad con el panel web):** login del personal
  (`/login` OAuth2), y pantallas `TableroTaller` (menú + llamar + enviar
  recordatorios ahora), `ClientesTaller`/`ClienteDetalle` (crear/editar,
  consentimiento Ley 1581, enlace del portal, regenerar, supresión),
  `VehiculosTaller`/`VehiculoTaller` (buscador, registrar ingreso,
  historial), `CitasTaller`, `ReglasTaller` y `EquipoTaller` (solo admin;
  el rol viene en la sesión y el backend lo impone).
  Registro de cambios: commit y push a
  https://github.com/esqueletico5675/labs.git (origin, rama master).
- **PILOTO (en marcha):** la guía completa está en `GUIA_PILOTO.md`
  (Supabase + Render + Gmail + cron). **DECISIÓN MVP: el canal de
  recordatorios es el CORREO** (ya construido, gratis, sin aprobaciones);
  WhatsApp queda opcional para después. WhatsApp cuando se active:
  `enviar_whatsapp` soporta **plantillas de Meta** — con
  `WHATSAPP_PLANTILLA=recordatorio_mantenimiento` (+`WHATSAPP_IDIOMA`,
  es_CO por defecto) manda plantilla con 3 variables (nombre, placa,
  pendientes); sin ella, texto libre (solo ventana de 24 h / número de
  prueba). `probar_whatsapp.py <numero>` verifica credenciales e imprime
  el motivo exacto si Meta rechaza. Los errores HTTP de Meta se muestran
  completos en consola.

## Reglas y convenciones

- **Seguridad primero:** contraseñas siempre cifradas; nunca en texto plano.
- **Aislamiento multi-taller:** toda consulta a datos filtra por `taller_id`.
  Un taller JAMÁS puede ver datos de otro. Regla #1.
- Los **intervalos de mantenimiento** en `app/mantenimiento.py` son orientativos
  y deben poder configurarse por taller. Manda el manual del fabricante.
- Idioma del código y comentarios: **español**.
- Para la hora actual usar SIEMPRE `ahora_utc()` de `app/utilidades.py`
  (nunca `datetime.utcnow()`, que está obsoleto).
- Credenciales (ej. clave SMTP) van en **variables de entorno**, nunca en el
  código. Viven en el archivo **`.env`** de la raíz (plantilla con
  instrucciones; ignorado por git), cargado por `cargar_env()` de
  `app/utilidades.py` al importar `app`. La terminal gana sobre el archivo.
  **PROHIBIDO para Claude leer o mostrar `.env`**: contiene los secretos del
  usuario. Si hay que depurar variables, pedirle al usuario que verifique él
  mismo, sin pegar valores en el chat.

## Cómo trabajar conmigo en cada sesión

Al empezar, pregúntame en qué fase o tarea vamos, o retoma la Fase 4 si no
digo nada. Antes de cambios grandes, explícame el plan en pocas líneas y
espera mi ok.
