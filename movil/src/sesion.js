// ============================================================
//  SESIÓN — quién está usando la app y cómo entra/sale
// ============================================================
// Ahora hay DOS tipos de usuario:
//   { tipo: "cliente", token }                        -> dueño del carro
//   { tipo: "taller", jwt, tallerId, nombre, taller, rol } -> personal
// La sesión se guarda en el celular para no pedir la contraseña
// cada vez, y App.js decide qué pantallas mostrar según el tipo.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import * as api from './api';
import { desactivarAvisos, desactivarAvisosTaller } from './avisos';

const LLAVE_SESION = 'sesion_guardada';
const LLAVE_VIEJA = 'token_acceso'; // formato anterior (solo clientes)

const ContextoSesion = createContext(null);

// Envuelve toda la app y le regala la sesión a cualquier pantalla.
export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(null);
  const [listo, setListo] = useState(false); // ¿ya revisamos el almacenamiento?

  // Al abrir la app: ¿había una sesión guardada de antes?
  useEffect(() => {
    (async () => {
      try {
        const cruda = await AsyncStorage.getItem(LLAVE_SESION);
        if (cruda) {
          setSesion(JSON.parse(cruda));
        } else {
          // Migración: si quedó un token del formato viejo, lo convertimos.
          const viejo = await AsyncStorage.getItem(LLAVE_VIEJA);
          if (viejo) {
            const s = { tipo: 'cliente', token: viejo };
            setSesion(s);
            await AsyncStorage.setItem(LLAVE_SESION, JSON.stringify(s));
            await AsyncStorage.removeItem(LLAVE_VIEJA);
          }
        }
      } catch (e) {
        // Sesión corrupta: se pide login de nuevo, sin drama.
      } finally {
        setListo(true);
      }
    })();
  }, []);

  async function guardar(s) {
    setSesion(s);
    await AsyncStorage.setItem(LLAVE_SESION, JSON.stringify(s));
  }

  // Entrar como DUEÑO DEL CARRO: valida y guarda su token del portal.
  async function entrarCliente(email, clave) {
    const token = await api.entrar(email, clave);
    await guardar({ tipo: 'cliente', token });
  }

  // Entrar como PERSONAL DEL TALLER: valida y guarda el JWT + sus datos.
  async function entrarTaller(email, clave) {
    const r = await api.entrarTaller(email, clave);
    await guardar({
      tipo: 'taller',
      jwt: r.access_token,
      tallerId: r.taller_id,
      nombre: r.nombre,
      taller: r.taller,
      rol: r.rol,
    });
  }

  // Abrir cuenta de TALLER NUEVO: el backend crea taller + admin y nos
  // devuelve lo mismo que el login, así que el dueño queda adentro ya.
  async function registrarTaller(datos) {
    const r = await api.registrarTaller(datos);
    await guardar({
      tipo: 'taller',
      jwt: r.access_token,
      tallerId: r.taller_id,
      nombre: r.nombre,
      taller: r.taller,
      rol: r.rol,
    });
  }

  // Salir: borra la sesión y vuelve a la pantalla de entrar. También
  // apaga los avisos push de este celular (del cliente o del personal).
  async function salir() {
    try {
      if (sesion?.tipo === 'cliente') {
        await desactivarAvisos(sesion.token);
      } else if (sesion?.tipo === 'taller') {
        await desactivarAvisosTaller(sesion.jwt, sesion.tallerId);
      }
    } catch (e) {
      // Sin internet no pasa nada: salimos igual.
    }
    await AsyncStorage.multiRemove([LLAVE_SESION, LLAVE_VIEJA]);
    setSesion(null);
  }

  // "token" se mantiene por comodidad: las pantallas del cliente lo usan.
  const token = sesion?.tipo === 'cliente' ? sesion.token : null;

  return (
    <ContextoSesion.Provider
      value={{ sesion, token, listo, entrarCliente, entrarTaller, registrarTaller, salir }}
    >
      {children}
    </ContextoSesion.Provider>
  );
}

// Atajo para usar la sesión desde cualquier pantalla: useSesion().
export function useSesion() {
  return useContext(ContextoSesion);
}
