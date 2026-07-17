// ============================================================
//  SESIÓN — quién está usando la app y cómo entra/sale
// ============================================================
// Guardamos el token de acceso en el almacenamiento del celular
// (AsyncStorage) para que el cliente NO tenga que escribir su
// contraseña cada vez que abre la app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import * as api from './api';
import { desactivarAvisos } from './avisos';

const LLAVE_GUARDADA = 'token_acceso';

const ContextoSesion = createContext(null);

// Envuelve toda la app y le regala la sesión a cualquier pantalla.
export function ProveedorSesion({ children }) {
  const [token, setToken] = useState(null);
  const [listo, setListo] = useState(false); // ¿ya revisamos el almacenamiento?

  // Al abrir la app: ¿había una sesión guardada de antes?
  useEffect(() => {
    AsyncStorage.getItem(LLAVE_GUARDADA)
      .then((guardado) => setToken(guardado))
      .finally(() => setListo(true));
  }, []);

  // Entrar: valida contra el backend y guarda el token en el celular.
  async function entrar(email, clave) {
    const nuevoToken = await api.entrar(email, clave);
    await AsyncStorage.setItem(LLAVE_GUARDADA, nuevoToken);
    setToken(nuevoToken);
  }

  // Salir: borra la sesión del celular y vuelve a la pantalla de entrar.
  // También apaga los avisos: si salió, este celular ya no debe recibirlos.
  async function salir() {
    try {
      await desactivarAvisos(token);
    } catch (e) {
      // Si no se pudo (sin internet), salimos igual.
    }
    await AsyncStorage.removeItem(LLAVE_GUARDADA);
    setToken(null);
  }

  return (
    <ContextoSesion.Provider value={{ token, listo, entrar, salir }}>
      {children}
    </ContextoSesion.Provider>
  );
}

// Atajo para usar la sesión desde cualquier pantalla: useSesion().
export function useSesion() {
  return useContext(ContextoSesion);
}
