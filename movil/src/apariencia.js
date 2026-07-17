// ============================================================
//  APARIENCIA — modo claro u oscuro, a elección del usuario
// ============================================================
// Un Context (cajita global) que dice qué paleta está activa.
// Cualquier pantalla la lee con useTema() y se repinta sola al
// cambiar. La elección se guarda en el celular (AsyncStorage).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { PALETAS } from './tema';

const LLAVE_GUARDADA = 'esquema_apariencia';

const ContextoApariencia = createContext(null);

export function ProveedorApariencia({ children }) {
  const [esquema, setEsquema] = useState('claro'); // 'claro' | 'oscuro'

  // Al abrir la app: ¿el usuario ya había elegido un modo?
  useEffect(() => {
    AsyncStorage.getItem(LLAVE_GUARDADA).then((guardado) => {
      if (guardado === 'claro' || guardado === 'oscuro') setEsquema(guardado);
    });
  }, []);

  function cambiarEsquema(nuevo) {
    setEsquema(nuevo);
    AsyncStorage.setItem(LLAVE_GUARDADA, nuevo); // sin esperar: no es crítico
  }

  return (
    <ContextoApariencia.Provider
      value={{ esquema, colores: PALETAS[esquema], cambiarEsquema }}
    >
      {children}
    </ContextoApariencia.Provider>
  );
}

// Atajo para cualquier pantalla: const { colores, esquema } = useTema();
export function useTema() {
  return useContext(ContextoApariencia);
}
