// ============================================================
//  PANTALLA: Mis vehículos (la pantalla principal)
// ============================================================
// Responde UNA pregunta en 3 segundos: "¿mi carro está bien o no?"
// Por eso cada vehículo muestra un solo resumen (su peor estado),
// no una lista de veinte datos. El detalle vive en la otra pantalla.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { BandaEstado, CajaError, Cargando, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { COLORES, ESPACIO, LETRA, peorEstado } from '../tema';

export default function MisVehiculos({ navigation }) {
  const { token, salir } = useSesion();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      const respuesta = await api.datosPortal(token);
      setDatos(respuesta);
    } catch (e) {
      setError(e.message);
      // Si el enlace fue anulado por el taller (410/404), cerramos sesión.
      if (String(e.message).includes('Enlace inválido')) salir();
    }
  }

  // Recarga cada vez que esta pantalla vuelve a estar al frente
  // (así, al volver de pedir una cita, todo está fresco).
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [token])
  );

  // El engranaje de la cabecera lleva a Ajustes (con nombre y taller).
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() =>
            navigation.navigate('Ajustes', {
              cliente: datos?.cliente,
              taller: datos?.taller,
            })
          }
          hitSlop={12}
        >
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </Pressable>
      ),
    });
  }, [navigation, datos]);

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (!datos && !error) return <Cargando mensaje="Buscando tus vehículos…" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={COLORES.texto} />
      }
    >
      {datos && (
        <>
          {/* Saludo con nombre: la app le habla a UNA persona. */}
          <Text style={estilos.saludo}>Hola, {primerNombre(datos.cliente)} 👋</Text>
          <Text style={estilos.taller}>Cliente de {datos.taller}</Text>
        </>
      )}

      <CajaError mensaje={error} />

      {datos && datos.vehiculos.length === 0 && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            Aún no tienes vehículos registrados.{'\n'}
            Pídele a tu taller que registre tu carro.
          </Text>
        </Tarjeta>
      )}

      {datos &&
        datos.vehiculos.map((v) => {
          const resumen = peorEstado(v.mantenimientos);
          return (
            <Pressable
              key={v.vehiculo_id}
              onPress={() => navigation.navigate('Vehiculo', { vehiculo: v })}
            >
              {({ pressed }) => (
                <Tarjeta style={{ opacity: pressed ? 0.8 : 1 }}>
                  <View style={estilos.filaSuperior}>
                    <Placa texto={v.placa} />
                    <Text style={estilos.flecha}>›</Text>
                  </View>
                  <Text style={estilos.marca}>
                    {v.marca} {v.modelo}
                  </Text>
                  <BandaEstado estado={resumen} grande />
                  <Text style={estilos.verMas}>Toca para ver el detalle</Text>
                </Tarjeta>
              )}
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

// "María Fernanda Gómez" -> "María" (más cercano, menos formal).
function primerNombre(nombreCompleto) {
  return (nombreCompleto || '').trim().split(' ')[0] || 'cliente';
}

const estilos = StyleSheet.create({
  contenido: {
    padding: ESPACIO.m,
    paddingBottom: ESPACIO.xl,
  },
  saludo: {
    color: COLORES.texto,
    fontSize: LETRA.titulo,
    fontWeight: '800',
  },
  taller: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    marginBottom: ESPACIO.l,
  },
  filaSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flecha: {
    color: COLORES.textoSuave,
    fontSize: 34,
    fontWeight: '300',
  },
  marca: {
    color: COLORES.textoSuave,
    fontSize: LETRA.normal,
    marginTop: ESPACIO.s,
    marginBottom: ESPACIO.m,
  },
  verMas: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    textAlign: 'center',
    marginTop: ESPACIO.m,
  },
  vacio: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    textAlign: 'center',
    lineHeight: 26,
  },
});
