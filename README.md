# Taller Diésel — Backend + Portal (Fases 1, 2 y 3)

Plataforma en **FastAPI** que registra talleres, vehículos e ingresos, calcula
qué mantenimientos toca hacerle a cada carro, **envía los recordatorios por
correo** y le da al dueño del carro un **portal (PWA instalable)** para
consultar el estado de sus vehículos.

Estado del roadmap: **Fases 1, 2 y 3 completas** (incluido push). Sigue la Fase 4.

---

## Cómo correrlo (paso a paso)

Necesitas tener **Python 3.10 o superior** instalado.

```bash
# 1. Entra a la carpeta del proyecto
cd taller-diesel

# 2. Crea un entorno virtual (aísla las librerías de este proyecto)
python -m venv venv

# 3. Actívalo
#    En Mac/Linux:
source venv/bin/activate
#    En Windows (PowerShell):
venv\Scripts\activate

# 4. Instala las dependencias
pip install -r requirements.txt

# 5. Carga datos de ejemplo (crea un taller, un carro y un ingreso)
python seed.py

# 6. Arranca el servidor
uvicorn app.main:app --reload
```

Ahora abre en el navegador:

    http://127.0.0.1:8000/docs

Verás una **documentación interactiva** (te la da FastAPI gratis) donde puedes
probar todos los endpoints sin escribir nada de frontend todavía. Prueba
`GET /vehiculos/1/recordatorios`: el cambio de aceite debería salir **vencido**.

---

## Qué hay en cada archivo

| Archivo | Qué hace |
|---|---|
| `app/database.py` | Conexión a la base de datos (SQLite ahora, PostgreSQL después). |
| `app/models.py` | Las **tablas**: Taller, Usuario, Cliente, Vehículo, Ingreso, RecordatorioEnviado, etc. Es el mapa del proyecto. |
| `app/schemas.py` | La "forma" de los datos que entran y salen; FastAPI los valida solo. |
| `app/security.py` | Cifrado de contraseñas con bcrypt. |
| `app/mantenimiento.py` | **El motor de recordatorios**: estima el km y decide qué toca. |
| `app/notificaciones.py` | **Fase 2:** redacta y envía los correos de recordatorio (o los simula). |
| `app/utilidades.py` | Función `ahora_utc()` (hora UTC compatible con SQLite). |
| `app/main.py` | La API: todos los endpoints + la seguridad JWT (Fase 3). |
| `portal/` | **Fase 3:** la PWA del cliente (HTML + manifest + service worker + push). |
| `seed.py` | Datos de ejemplo para ver el sistema funcionando. |
| `enviar_recordatorios.py` | **Fase 2/3:** la tarea diaria que envía correos y push de todos los talleres. |
| `generar_llaves_push.py` | **Fase 3:** crea las llaves VAPID del push (se corre una sola vez). |

**Sugerencia de lectura:** empieza por `models.py` (entiendes qué se guarda),
sigue con `mantenimiento.py` (el cerebro), luego `notificaciones.py` (los
correos) y termina con `main.py` (cómo se conecta todo).

---

## Qué YA hace

### Fase 1 — el núcleo
- Crear talleres (cada uno con sus intervalos de mantenimiento diésel por defecto).
- Crear usuarios del taller con **contraseña cifrada** y un login básico.
- Registrar clientes y vehículos, **listarlos, verlos y editarlos**.
- Configurar los **tipos de mantenimiento por taller**: listar, crear, editar
  y eliminar reglas (no deja borrar una regla que ya tiene historial).
- Registrar ingresos (visitas), que actualizan el kilometraje del carro, y
  consultar el **historial de ingresos** de cada vehículo.
- **Calcular recordatorios**: por cada vehículo dice si cada mantenimiento
  está vencido, próximo o al día, estimando el km de hoy sin molestar al cliente.
- **Tablero del taller** (`GET /talleres/{id}/recordatorios`): todos los
  vehículos con algo pendiente, con nombre y teléfono del cliente.
  Es la vista de "¿a quién hay que llamar hoy?".

### Fase 2 — recordatorios por correo
- `POST /talleres/{id}/enviar-recordatorios` revisa todos los vehículos del
  taller y envía **un correo por vehículo** con sus mantenimientos vencidos
  o próximos.
- `python enviar_recordatorios.py` hace lo mismo para **todos** los talleres:
  es el script que se programa para correr una vez al día.
- **No repite avisos**: cada aviso queda registrado (tabla
  `recordatorios_enviados`) y no se vuelve a enviar hasta pasados 7 días.
- **Modo simulación**: sin configurar nada, los correos se imprimen en la
  consola en vez de enviarse. Perfecto para desarrollar sin gastar.

### Fase 3 — login real (JWT) + portal del cliente (PWA)
- **Login con token JWT**: `POST /login` (con email y contraseña) devuelve un
  token que se manda en cada petición (`Authorization: Bearer ...`). En `/docs`
  usa el botón verde **Authorize** para probar todo autenticado.
- **Toda la API está cerrada con llave**: sin token responde 401; con token
  de OTRO taller responde 403/404. El aislamiento multi-inquilino ya no
  depende de la buena fe: lo impone el servidor.
- Regla de arranque: el **primer usuario** de un taller se crea sin token
  (registro inicial); de ahí en adelante solo un **admin** del taller puede
  crear más usuarios.
- **Portal del cliente**: el dueño del carro NO usa contraseña; entra con su
  **enlace secreto** (un código inadivinable). El taller lo consulta en
  `GET /talleres/{id}/clientes/{id}/enlace-portal` y se lo comparte.
- **PWA instalable** en `/app/`: diseño de **tablero de instrumentos** (tema
  cabina): la placa del carro estilo placa colombiana, un **odómetro** con el
  km estimado de HOY, y cada mantenimiento como un **medidor radial** cuya
  aguja sube según el desgaste. El estado nunca depende solo del color
  (siempre icono + texto), y la paleta está validada para daltonismo.
- **Notificaciones push**: el cliente activa los avisos con el interruptor
  "Avisos" de la PWA y recibe la notificación en su celular aunque la app
  esté cerrada. Requiere generar las llaves VAPID **una sola vez**:
  `python generar_llaves_push.py` (quedan en `llaves_push.json`, que está en
  `.gitignore`; sin llaves, el push simplemente se omite).
- `seed.py` imprime el enlace del portal del cliente de ejemplo y el login
  del taller (`ana@tallernorte.co` / `clave123`).

---

## Cómo configurar el envío real de correos (Fase 2)

El envío usa variables de entorno (valores que viven FUERA del código, para
que la clave nunca quede en el repositorio):

| Variable | Ejemplo | Qué es |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | El servidor de correo. Sin esta variable → modo simulación. |
| `SMTP_PUERTO` | `587` | Puerto (587 es el valor por defecto). |
| `SMTP_USUARIO` | `taller@gmail.com` | El correo con el que se envía. |
| `SMTP_CLAVE` | `xxxx xxxx xxxx xxxx` | En Gmail: una "contraseña de aplicación" (no tu clave normal). |
| `SMTP_REMITENTE` | `taller@gmail.com` | Opcional; si falta se usa `SMTP_USUARIO`. |

En Windows (PowerShell), antes de correr el script:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_USUARIO = "tucorreo@gmail.com"
$env:SMTP_CLAVE = "tu clave de aplicación"
python enviar_recordatorios.py
```

### Programarlo para que corra solo (una vez al día)

- **Windows:** Programador de tareas → Crear tarea básica → Diaria →
  Programa: `python`, Argumentos: `enviar_recordatorios.py`,
  Iniciar en: la carpeta del proyecto.
- **Linux/Mac (cron):** `crontab -e` y agregar (ejemplo, 8:00 am):
  `0 8 * * * cd /ruta/al/proyecto && python enviar_recordatorios.py`

---

## Qué SIGUE (próximas fases)

- **Fase 4:** multi-taller a fondo + WhatsApp.
- **Fase 5:** seguridad completa, Habeas Data, backups y cobro.
- Pendiente menor: endpoint para regenerar el enlace de un cliente si se filtra.

---

## Notas de seguridad (importante)

- Las contraseñas se guardan **cifradas** (bcrypt), nunca en texto plano.
- La clave del correo (SMTP) va en **variables de entorno**, nunca en el código.
- **La llave de los tokens (`JWT_SECRETO`)** también va en variable de entorno
  en producción: quien la conozca puede fabricar tokens falsos. En desarrollo
  hay un valor por defecto.
- El aislamiento multi-inquilino lo **impone el servidor**: el token dice a
  qué taller perteneces y toda petición se verifica contra eso (regla de
  seguridad #1 de un SaaS).
- El enlace del portal es la "llave" del cliente: se comparte solo con él.
  Si se filtra, basta con regenerarle el token (pendiente: endpoint para
  regenerarlo).
- El archivo `taller.db` y la carpeta `venv/` no se suben al repositorio
  (ya están en `.gitignore`).

---

## Recordatorio sobre los intervalos de mantenimiento

Los valores en `app/mantenimiento.py` (`INTERVALOS_DIESEL_POR_DEFECTO`) son
**orientativos**. Cada taller ya puede ajustarlos con los endpoints de
`tipos-mantenimiento`. Siempre manda el manual del fabricante.
