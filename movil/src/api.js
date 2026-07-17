// ============================================================
//  API — la única puerta de la app hacia el backend de FastAPI
// ============================================================
// Todas las pantallas piden datos AQUÍ; ninguna llama a fetch por su
// cuenta. Si mañana cambia una URL, se cambia en un solo lugar.

// ⚠️ CAMBIA ESTA IP si tu PC cambia de red. Es la IP local del PC donde
// corre `uvicorn app.main:app --reload --host 0.0.0.0`.
// El celular debe estar en el MISMO WiFi. Cuando el backend esté en
// Render, aquí irá la URL pública (https://...).
export const URL_BASE = 'http://192.168.1.9:8000';

// Ayudante interno: hace la petición, y si algo sale mal lanza un
// Error con un mensaje que un cliente pueda entender.
async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(URL_BASE + ruta, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch (e) {
    // Ni siquiera hubo conexión: WiFi, IP equivocada o servidor apagado.
    throw new Error('No pudimos conectar con el taller. Revisa tu internet e inténtalo de nuevo.');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {
    // Respuesta sin JSON; seguimos con datos = null.
  }

  if (!respuesta.ok) {
    // FastAPI manda la explicación en "detail"; si viene, la usamos tal cual
    // (ya están escritas en español en el backend).
    const detalle = datos && datos.detail;
    throw new Error(
      typeof detalle === 'string' ? detalle : 'Algo salió mal. Inténtalo de nuevo en un momento.'
    );
  }
  return datos;
}

// --- Entrar: correo + contraseña -> token de acceso del cliente ---
export async function entrar(email, clave) {
  const datos = await pedir('/portal-login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), clave }),
  });
  return datos.token_acceso;
}

// --- Todo lo del cliente: nombre, taller y vehículos con sus estados ---
export function datosPortal(token) {
  return pedir(`/portal/${token}`);
}

// --- Citas del cliente (para saber si ya pidió una) ---
export function misCitas(token) {
  return pedir(`/portal/${token}/citas`);
}

// --- Pedir una cita para un vehículo ---
export function pedirCita(token, vehiculoId, fecha, nota) {
  return pedir(`/portal/${token}/citas`, {
    method: 'POST',
    body: JSON.stringify({ vehiculo_id: vehiculoId, fecha, nota }),
  });
}

// --- Avisos push: registrar el token de ESTE celular en el backend ---
export function registrarPushMovil(token, expoToken) {
  return pedir(`/portal/${token}/push-movil`, {
    method: 'POST',
    body: JSON.stringify({ expo_token: expoToken }),
  });
}

// --- Avisos push: borrar el token de este celular (apagar avisos) ---
export function eliminarPushMovil(token, expoToken) {
  return pedir(`/portal/${token}/push-movil`, {
    method: 'DELETE',
    body: JSON.stringify({ expo_token: expoToken }),
  });
}

// ============================================================
//  El lado del TALLER (personal): login con JWT y sus endpoints
// ============================================================

// --- Entrar como personal del taller. El backend usa el formulario
//     OAuth2: los campos van como formulario, no como JSON, y el
//     correo se llama "username". Devuelve el JWT + datos del usuario. ---
export function entrarTaller(email, clave) {
  return pedir('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:
      'username=' + encodeURIComponent(email.trim().toLowerCase()) +
      '&password=' + encodeURIComponent(clave),
  });
}

// Cabeceras con el JWT: así el backend sabe quién pregunta y de qué taller.
function conJwt(jwt) {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt };
}

// --- El tablero: vehículos con mantenimientos vencidos o próximos ---
export function tableroTaller(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/recordatorios`, { headers: conJwt(jwt) });
}

// --- Las citas del taller (primero las que están por confirmar) ---
export function citasTaller(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/citas`, { headers: conJwt(jwt) });
}

// --- Confirmar / atender / cancelar una cita ---
export function cambiarEstadoCita(jwt, tallerId, citaId, estado) {
  return pedir(`/talleres/${tallerId}/citas/${citaId}`, {
    method: 'PATCH',
    headers: conJwt(jwt),
    body: JSON.stringify({ estado }),
  });
}
