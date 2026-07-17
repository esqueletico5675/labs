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

// Activa los avisos: permiso -> push token -> registrarlo en FastAPI.
// Devuelve el token si quedó activo; lanza Error con mensaje amable si no.
export async function activarAvisos(tokenSesion) {
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

  const expoToken = respuesta.data;
  await api.registrarPushMovil(tokenSesion, expoToken); // se lo contamos a FastAPI
  await AsyncStorage.setItem(LLAVE_TOKEN_PUSH, expoToken);
  return expoToken;
}

// Apaga los avisos de este celular (y avisa al backend para que lo borre).
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
}

// ¿Están activos los avisos en este celular?
export async function avisosActivos() {
  return !!(await AsyncStorage.getItem(LLAVE_TOKEN_PUSH));
}

// Intento silencioso al entrar por primera vez: pide permiso UNA sola
// vez en la vida de la app; si falla (o dicen que no), no molesta más.
// Siempre se puede activar/desactivar a mano en Ajustes.
export async function intentarActivarUnaVez(tokenSesion) {
  const ya = await AsyncStorage.getItem(LLAVE_YA_INTENTADO);
  if (ya) return;
  await AsyncStorage.setItem(LLAVE_YA_INTENTADO, 'si');
  try {
    await activarAvisos(tokenSesion);
  } catch (e) {
    // Silencio: el usuario decide después desde Ajustes.
  }
}
