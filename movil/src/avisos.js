// ============================================================
//  AVISOS — notificaciones push en el celular
// ============================================================
// Concepto: el "push token" es la dirección postal única de ESTE
// celular. La app lo obtiene con permiso del usuario y se lo manda a
// nuestro FastAPI; el envío diario del backend le escribe a Expo, y
// Expo reparte a Google/Apple.
//
// Limitación conocida: probando con Expo Go, en Android las push
// remotas ya no funcionan (Expo las quitó de Expo Go); en iPhone sí.
// Con la app empaquetada (development build / EAS) funcionan en ambos.
// Por eso todos los errores aquí son SUAVES: se explican, nunca rompen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as api from './api';

const LLAVE_TOKEN_PUSH = 'expo_push_token'; // guardado si los avisos están activos
const LLAVE_YA_INTENTADO = 'avisos_ya_intentados'; // para pedir permiso solo una vez
// La PREFERENCIA del usuario ('si'/'no') sobrevive al cerrar sesión: así,
// al volver a entrar, los avisos se reactivan solos sin que tenga que
// prenderlos otra vez. Solo cambia cuando él toca el botón en Ajustes.
const LLAVE_QUIERE = 'avisos_preferencia';

// Cómo se muestra una notificación si llega con la app ABIERTA:
// banner arriba + sonido (sin esto, en primer plano no se vería nada).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Pide permiso y obtiene el push token de ESTE celular (paso común a
// clientes y personal). Lanza Error con mensaje amable si no se puede.
async function obtenerExpoToken() {
  if (!Device.isDevice) {
    throw new Error('Los avisos solo funcionan en un celular real (no en emulador).');
  }

  // Android agrupa las notificaciones en "canales"; creamos el nuestro.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios de mantenimiento',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  // Pedimos permiso (el sistema solo muestra el diálogo la primera vez).
  let permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted) {
    permiso = await Notifications.requestPermissionsAsync();
  }
  if (!permiso.granted) {
    throw new Error(
      'No diste permiso de notificaciones. Puedes activarlo en los ajustes de tu celular.'
    );
  }

  // El push token de ESTE celular. Con Expo Go en Android esto falla:
  // lo convertimos en una explicación en vez de un error técnico.
  let respuesta;
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    respuesta = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
  } catch (e) {
    throw new Error(
      'Este celular aún no puede recibir avisos con Expo Go. ' +
        'Funcionará cuando instalemos la app definitiva.'
    );
  }

  return respuesta.data;
}

// Activa los avisos del DUEÑO DEL CARRO: token -> registrarlo en FastAPI.
export async function activarAvisos(tokenSesion) {
  const expoToken = await obtenerExpoToken();
  await api.registrarPushMovil(tokenSesion, expoToken); // se lo contamos a FastAPI
  await AsyncStorage.setItem(LLAVE_TOKEN_PUSH, expoToken);
  await AsyncStorage.setItem(LLAVE_QUIERE, 'si');
  return expoToken;
}

// Activa los avisos del PERSONAL: le llegan las citas nuevas del taller.
export async function activarAvisosTaller(jwt, tallerId) {
  const expoToken = await obtenerExpoToken();
  await api.registrarPushTaller(jwt, tallerId, expoToken);
  await AsyncStorage.setItem(LLAVE_TOKEN_PUSH, expoToken);
  await AsyncStorage.setItem(LLAVE_QUIERE, 'si');
  return expoToken;
}

// Apaga los avisos del PERSONAL en este celular (decisión del usuario:
// queda registrada y NO se reactivan solos en el próximo login).
export async function desactivarAvisosTaller(jwt, tallerId) {
  const expoToken = await AsyncStorage.getItem(LLAVE_TOKEN_PUSH);
  if (expoToken) {
    try {
      await api.eliminarPushTaller(jwt, tallerId, expoToken);
    } catch (e) {
      // Sin internet no pasa nada: Expo avisará "DeviceNotRegistered" y
      // el backend lo limpiará solo.
    }
  }
  await AsyncStorage.removeItem(LLAVE_TOKEN_PUSH);
  await AsyncStorage.setItem(LLAVE_QUIERE, 'no');
}

// Apaga los avisos de este celular (decisión del usuario, ver arriba).
export async function desactivarAvisos(tokenSesion) {
  const expoToken = await AsyncStorage.getItem(LLAVE_TOKEN_PUSH);
  if (expoToken) {
    try {
      await api.eliminarPushMovil(tokenSesion, expoToken);
    } catch (e) {
      // Sin internet no pasa nada: el backend lo limpiará solo cuando
      // Expo le responda "DeviceNotRegistered".
    }
  }
  await AsyncStorage.removeItem(LLAVE_TOKEN_PUSH);
  await AsyncStorage.setItem(LLAVE_QUIERE, 'no');
}

// Al CERRAR SESIÓN: se borra el registro en el backend (para que este
// celular no siga recibiendo avisos de una cuenta que ya salió), pero la
// PREFERENCIA queda intacta: al volver a entrar se reactivan solos.
export async function apagarAvisosAlSalir(sesion) {
  const expoToken = await AsyncStorage.getItem(LLAVE_TOKEN_PUSH);
  if (expoToken) {
    try {
      if (sesion?.tipo === 'taller') {
        await api.eliminarPushTaller(sesion.jwt, sesion.tallerId, expoToken);
      } else if (sesion?.tipo === 'cliente') {
        await api.eliminarPushMovil(sesion.token, expoToken);
      }
    } catch (e) {
      // Sin internet no pasa nada: el backend lo limpiará solo.
    }
  }
  await AsyncStorage.removeItem(LLAVE_TOKEN_PUSH);
}

// ¿Están activos los avisos en este celular?
export async function avisosActivos() {
  return !!(await AsyncStorage.getItem(LLAVE_TOKEN_PUSH));
}

// Decide en silencio al entrar (lo llaman las pantallas de inicio):
//   - ya activos en esta sesión        -> no hacer nada
//   - el usuario los apagó en Ajustes  -> respetar y no molestar
//   - los tenía activos antes de salir -> reactivarlos SOLOS (sin diálogo:
//     el permiso del sistema ya estaba concedido)
//   - primera vez en la vida de la app -> pedir permiso UNA sola vez
async function intentarActivar(activar) {
  if (await AsyncStorage.getItem(LLAVE_TOKEN_PUSH)) return; // ya activos
  const quiere = await AsyncStorage.getItem(LLAVE_QUIERE);
  if (quiere === 'no') return;
  if (quiere === 'si') {
    try { await activar(); } catch (e) { /* se reintenta en el próximo inicio */ }
    return;
  }
  const ya = await AsyncStorage.getItem(LLAVE_YA_INTENTADO);
  if (ya) return;
  await AsyncStorage.setItem(LLAVE_YA_INTENTADO, 'si');
  try {
    await activar();
  } catch (e) {
    // Silencio: el usuario decide después desde Ajustes.
  }
}

// Intento silencioso del DUEÑO DEL CARRO al entrar.
export async function intentarActivarUnaVez(tokenSesion) {
  await intentarActivar(() => activarAvisos(tokenSesion));
}

// Intento silencioso del PERSONAL al entrar.
export async function intentarActivarUnaVezTaller(jwt, tallerId) {
  await intentarActivar(() => activarAvisosTaller(jwt, tallerId));
}
