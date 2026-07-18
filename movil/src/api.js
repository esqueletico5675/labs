// ============================================================
//  API — la única puerta de la app hacia el backend de FastAPI
// ============================================================
// Todas las pantallas piden datos AQUÍ; ninguna llama a fetch por su
// cuenta. Si mañana cambia una URL, se cambia en un solo lugar.

// Backend en producción (Render). El plan gratis se duerme tras 15 min
// sin uso: la primera petición puede tardar ~30 s en responder.
// Para desarrollar contra el PC local, comenta la línea de Render y
// descomenta la de la IP local (celular en el MISMO WiFi, uvicorn con
// `--host 0.0.0.0`; cambia la IP si tu PC cambia de red).
export const URL_BASE = 'https://taller-diesel.onrender.com';
// export const URL_BASE = 'http://192.168.1.9:8000';

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

// --- Cancelar MI cita (el taller recibe el aviso) ---
export function cancelarMiCita(token, citaId) {
  return pedir(`/portal/${token}/citas/${citaId}`, { method: 'DELETE' });
}

// --- El dueño reporta el km de su odómetro (afina la estimación) ---
export function reportarKilometraje(token, vehiculoId, kilometraje) {
  return pedir(`/portal/${token}/kilometraje`, {
    method: 'POST',
    body: JSON.stringify({ vehiculo_id: vehiculoId, kilometraje }),
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

// --- Abrir cuenta: crea el taller + su administrador en un solo paso.
//     Devuelve lo mismo que el login (JWT + datos): queda logueado ya. ---
export function registrarTaller(datos) {
  return pedir('/registro', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// Cabeceras con el JWT: así el backend sabe quién pregunta y de qué taller.
function conJwt(jwt) {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt };
}

// --- Push del PERSONAL: este celular quiere enterarse de citas nuevas ---
export function registrarPushTaller(jwt, tallerId, expoToken) {
  return pedir(`/talleres/${tallerId}/push-movil`, {
    method: 'POST',
    headers: conJwt(jwt),
    body: JSON.stringify({ expo_token: expoToken }),
  });
}

export function eliminarPushTaller(jwt, tallerId, expoToken) {
  return pedir(`/talleres/${tallerId}/push-movil`, {
    method: 'DELETE',
    headers: conJwt(jwt),
    body: JSON.stringify({ expo_token: expoToken }),
  });
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

// --- Enviar los recordatorios pendientes AHORA (sin esperar la tarea
//     diaria). El backend revisa todo el taller y devuelve un resumen. ---
export function enviarRecordatoriosAhora(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/enviar-recordatorios`, {
    method: 'POST', headers: conJwt(jwt),
  });
}

// --- CLIENTES del taller ---
export function listarClientes(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/clientes`, { headers: conJwt(jwt) });
}
export function obtenerCliente(jwt, tallerId, clienteId) {
  return pedir(`/talleres/${tallerId}/clientes/${clienteId}`, { headers: conJwt(jwt) });
}
export function crearCliente(jwt, tallerId, datos) {
  // datos: { nombre, email, telefono, consentimiento } — sin consentimiento
  // el backend responde 422 (Habeas Data, Ley 1581).
  return pedir(`/talleres/${tallerId}/clientes`, {
    method: 'POST', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
export function actualizarCliente(jwt, tallerId, clienteId, datos) {
  return pedir(`/talleres/${tallerId}/clientes/${clienteId}`, {
    method: 'PATCH', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
export function enlacePortal(jwt, tallerId, clienteId) {
  return pedir(`/talleres/${tallerId}/clientes/${clienteId}/enlace-portal`, {
    headers: conJwt(jwt),
  });
}
export function regenerarToken(jwt, tallerId, clienteId) {
  // Solo admin: anula el enlace viejo del cliente y crea uno nuevo.
  return pedir(`/talleres/${tallerId}/clientes/${clienteId}/regenerar-token`, {
    method: 'POST', headers: conJwt(jwt),
  });
}
export function suprimirDatos(jwt, tallerId, clienteId) {
  // Solo admin: derecho a supresión (Habeas Data). Anonimiza al cliente.
  return pedir(`/talleres/${tallerId}/clientes/${clienteId}/datos-personales`, {
    method: 'DELETE', headers: conJwt(jwt),
  });
}

// --- VEHÍCULOS del taller ---
export function listarVehiculos(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/vehiculos`, { headers: conJwt(jwt) });
}
export function crearVehiculo(jwt, tallerId, datos) {
  // datos: { cliente_id, placa, marca, modelo, anio, km_actual }
  return pedir(`/talleres/${tallerId}/vehiculos`, {
    method: 'POST', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
export function recordatoriosVehiculo(jwt, vehiculoId) {
  return pedir(`/vehiculos/${vehiculoId}/recordatorios`, { headers: conJwt(jwt) });
}
export function ingresosVehiculo(jwt, vehiculoId) {
  return pedir(`/vehiculos/${vehiculoId}/ingresos`, { headers: conJwt(jwt) });
}
export function crearIngreso(jwt, datos) {
  // datos: { vehiculo_id, kilometraje, descripcion, tipos_realizados: [ids] }
  return pedir('/ingresos', {
    method: 'POST', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}

// --- REGLAS de mantenimiento (tipos) ---
export function listarTipos(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/tipos-mantenimiento`, { headers: conJwt(jwt) });
}
export function crearTipo(jwt, tallerId, datos) {
  return pedir(`/talleres/${tallerId}/tipos-mantenimiento`, {
    method: 'POST', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
export function actualizarTipo(jwt, tallerId, tipoId, datos) {
  return pedir(`/talleres/${tallerId}/tipos-mantenimiento/${tipoId}`, {
    method: 'PATCH', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
export function eliminarTipo(jwt, tallerId, tipoId) {
  return pedir(`/talleres/${tallerId}/tipos-mantenimiento/${tipoId}`, {
    method: 'DELETE', headers: conJwt(jwt),
  });
}

// --- EQUIPO del taller (usuarios; solo admin) ---
export function listarUsuarios(jwt, tallerId) {
  return pedir(`/talleres/${tallerId}/usuarios`, { headers: conJwt(jwt) });
}
export function crearUsuario(jwt, tallerId, datos) {
  // datos: { nombre, email, clave, rol: "admin" | "mecanico" }
  return pedir(`/talleres/${tallerId}/usuarios`, {
    method: 'POST', headers: conJwt(jwt), body: JSON.stringify(datos),
  });
}
