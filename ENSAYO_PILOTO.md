# Ensayo de punta a punta — antes de soltar clientes reales

Camina TÚ el viaje completo una vez, haciéndote pasar por cliente. Objetivo:
encontrar las fricciones tú, no ellos. Marca cada casilla al pasarla.

> Regla de oro: usa un cliente y un carro de PRUEBA (tu propio correo y
> celular). Al final del ensayo, borra ese cliente o resérvalo como "cliente
> de pruebas" — no lo mezcles con los reales.

---

## 0. Antes de empezar (configuración)

- [ ] **Remitente del correo definido en los 3 lugares** (GitHub Secrets,
      Render, `.env`): `SMTP_USUARIO` y `SMTP_CLAVE` (contraseña de
      aplicación, no la normal del Gmail).
- [ ] En Render existen `ENTORNO=produccion` y `JWT_SECRETO`.
- [ ] El servidor responde: abre `https://taller-diesel.onrender.com/` en el
      navegador → debe decir que la API funciona.
- [ ] Tienes el APK instalado en tu celular (el último enlace que te pasé).

**Prueba de SPAM del correo** (clave para que los recordatorios lleguen):
- [ ] Manda un recordatorio de prueba a un **Gmail**, un **Hotmail/Outlook** y
      un tercer correo tuyos.
- [ ] ✅ Éxito si **llega a Bandeja de entrada**, no a Spam. Si cae en spam,
      márcalo como "No es spam" y avísame para ajustar.

---

## 1. Registrar el taller real (panel web)

- [ ] Entra a `https://taller-diesel.onrender.com/panel`.
- [ ] "¿Primera vez? Crea tu taller" → llena nombre del taller, tu correo de
      admin y una contraseña.
- [ ] ✅ Éxito si entras directo al panel y ves el tablero vacío.
- [ ] Revisa la sección **Reglas**: ya deben estar las reglas diésel por
      defecto (aceite, filtros, frenos…). Ajusta los km/meses según el manual
      de los carros que más atiendes.
- [ ] (Opcional) En **Equipo**, crea un usuario **mecánico** de prueba y
      confirma que al entrar con él NO ve "Equipo" ni puede borrar reglas.

## 2. Crear un cliente y un vehículo de prueba

- [ ] En **Clientes** → "Nuevo cliente": tu nombre, **tu correo real**, tu
      teléfono. Marca la casilla de **consentimiento (Ley 1581)**.
- [ ] ✅ Éxito si al intentar guardar SIN marcar consentimiento, lo rechaza.
- [ ] En **Vehículos** → "Nuevo vehículo": asígnalo a ese cliente, ponle una
      placa y un **km inicial** (ej. 95.000).
- [ ] Para forzar un recordatorio vencido: registra el vehículo con un km
      alto, o en **Reglas** deja el aceite en un intervalo corto. Luego mira
      el tablero: debería aparecer algo **vencido o próximo**.

## 3. El cliente entra (portal + app)

- [ ] En **Clientes** → tu cliente → "Enlace portal" → copia el enlace.
- [ ] Ábrelo en el celular (navegador). ✅ Éxito si ves tu carro, el odómetro
      y los medidores de mantenimiento.
- [ ] Abre la **app** (APK) y entra con el mismo enlace/código.
      ✅ Éxito si ves "Hola, [tu nombre]" y tu carro con su estado.
- [ ] En la app, mira abajo la tarjeta **"💡 ¿Sabías que…?"**. Debe estar y
      cerrar con "Consulta con tu taller".
- [ ] (Opcional) Crea tu **contraseña** desde el portal y prueba entrar con
      correo + contraseña (sin el enlace).

## 4. Avisos push (el punto con más incógnita)

- [ ] En la app, activa los **avisos** (acepta el permiso del sistema).
- [ ] En tu repo → pestaña **Actions** → **"Consejo del día"** → "Run
      workflow". Espera 1–2 min.
- [ ] ✅ Éxito si te llega la notificación "💡 ¿Sabías que…?" al celular.
- [ ] **iPhone:** el push web solo llega si el cliente **"Agrega a pantalla de
      inicio"** el portal. Anótalo para avisarles.
- [ ] Si NO llega en Android con el APK: avísame (probablemente la llave FCM
      en expo.dev; ya sabemos dónde mirar).

## 5. El ciclo de citas (los dos sentidos)

- [ ] Desde el portal/app, **pide una cita** para tu carro (fecha + nota).
- [ ] ✅ Éxito si el **taller recibe aviso** (correo al buzón del taller, y
      push si tienes la app en modo taller).
- [ ] En el panel → **Citas**, **confirma** la cita.
- [ ] ✅ Éxito si el **cliente recibe** "✅ Cita confirmada" (push + correo).
- [ ] Desde el portal/app, **cancela** la cita.
- [ ] ✅ Éxito si el taller se entera de la cancelación.

## 6. Reportar kilometraje

- [ ] Desde la app, en tu carro, toca **"Actualizar mi kilometraje"** y pon un
      km mayor al registrado.
- [ ] ✅ Éxito si lo guarda y el odómetro/medidores se actualizan.
- [ ] Prueba poner un km MENOR al actual → debe rechazarlo con mensaje claro.

## 7. Recordatorios automáticos (el corazón del producto)

- [ ] Con tu carro mostrando algo **vencido**, ve al panel → tablero →
      **"Enviar recordatorios"** (o dispara el workflow "Recordatorios
      diarios" en Actions).
- [ ] ✅ Éxito si te llega el **correo** del recordatorio a tu bandeja (y push
      si tienes avisos activos).
- [ ] Vuelve a dispararlo enseguida: ✅ Éxito si **NO** repite el correo (la
      regla de "no molestar 2 veces en 7 días" funciona).

## 8. Cerrar el ensayo

- [ ] Borra el cliente de prueba, o renómbralo "PRUEBAS — no llamar".
- [ ] Confirma que el **backup** corrió: revisa la carpeta `respaldos/` en tu
      PC (debe haber un archivo con la fecha de hoy).
- [ ] Ya puedes registrar los clientes reales con su consentimiento y repartir
      enlaces + APK.

---

## Criterios para dar el ensayo por bueno

Todo esto debe cumplirse antes de clientes reales:

1. El correo llega a **bandeja de entrada** (no spam).
2. El **push llega** al celular (o sabes que en iPhone toca "agregar a inicio").
3. El ciclo de **citas** avisa en ambos sentidos.
4. Los **recordatorios** salen y no se repiten.
5. El **consentimiento** es obligatorio al crear cliente.
6. El **backup** del día quedó guardado.

Si algo de esto falla, anótalo y me dices — casi todo es ajuste de
configuración, no de código.
