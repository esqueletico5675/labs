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
