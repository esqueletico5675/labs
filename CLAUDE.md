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
- **Base de datos:** SQLite para desarrollar; PostgreSQL para producción.
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
  Pendiente menor: endpoint para regenerar el token de un cliente.
- **Fase 4 (siguiente):** multi-taller a fondo + WhatsApp.
- **Fase 4:** multi-taller a fondo + WhatsApp.
- **Fase 5:** seguridad completa, Habeas Data (Ley 1581/2012 Colombia), backups, cobro.

## Reglas y convenciones

- **Seguridad primero:** contraseñas siempre cifradas; nunca en texto plano.
- **Aislamiento multi-taller:** toda consulta a datos filtra por `taller_id`.
  Un taller JAMÁS puede ver datos de otro. Regla #1.
- Los **intervalos de mantenimiento** en `app/mantenimiento.py` son orientativos
  y deben poder configurarse por taller. Manda el manual del fabricante.
- Idioma del código y comentarios: **español**.
- Para la hora actual usar SIEMPRE `ahora_utc()` de `app/utilidades.py`
  (nunca `datetime.utcnow()`, que está obsoleto).
- Credenciales (ej. clave SMTP) van en **variables de entorno**, nunca en el código.

## Cómo trabajar conmigo en cada sesión

Al empezar, pregúntame en qué fase o tarea vamos, o retoma la Fase 4 si no
digo nada. Antes de cambios grandes, explícame el plan en pocas líneas y
espera mi ok.
