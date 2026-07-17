// ============================================================
//  PANTALLA: Mis vehículos (la pantalla principal)
// ============================================================
// Responde UNA pregunta en 3 segundos: "¿mi carro está bien o no?"
// Look v2: cabecera azul con el resumen en una frase, y una tarjeta
// blanca por carro con su placa, su estado y qué hacer.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { BandaEstado, CajaError, Cargando, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { COLORES, ESPACIO, LETRA, RADIO, peorEstado } from '../tema';

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
      // Si el enlace fue anulado por el taller, cerramos sesión.
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

  const vehiculos = datos ? datos.vehiculos : [];
  const resumen = resumenGeneral(vehiculos);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={alRefrescar}
          tintColor={COLORES.primario}
        />
      }
    >
      {datos && (
        /* Cabecera azul: saludo + el estado de TODO en una sola frase. */
        <View style={estilos.cabecera}>
          <Text style={estilos.saludo}>Hola, {primerNombre(datos.cliente)} 👋</Text>
          <Text style={estilos.taller}>Cliente de {datos.taller}</Text>
          <View style={estilos.resumen}>
            <Text style={{ fontSize: 22 }}>{resumen.icono}</Text>
            <Text style={estilos.resumenTexto}>{resumen.frase}</Text>
          </View>
        </View>
      )}

      <CajaError mensaje={error} />

      {datos && vehiculos.length === 0 && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            🚗{'\n\n'}Aún no tienes vehículos registrados.{'\n'}
            Pídele a tu taller que registre tu carro.
          </Text>
        </Tarjeta>
      )}

      {vehiculos.map((v) => {
        const estado = peorEstado(v.mantenimientos);
        return (
          <Pressable
            key={v.vehiculo_id}
            onPress={() => navigation.navigate('Vehiculo', { vehiculo: v })}
          >
            {({ pressed }) => (
              <Tarjeta style={{ opacity: pressed ? 0.85 : 1 }}>
                <View style={estilos.filaSuperior}>
                  <Placa texto={v.placa} />
                  <Text style={estilos.flecha}>›</Text>
                </View>
                <Text style={estilos.marca}>
                  🚛 {v.marca} {v.modelo}
                </Text>
                <BandaEstado estado={estado} />
              </Tarjeta>
            )}
          </Pressable>
        );
      })}

      {vehiculos.length > 0 && (
        <Text style={estilos.pista}>Toca un vehículo para ver su detalle</Text>
      )}
    </ScrollView>
  );
}

// La frase de la cabecera: el resumen de TODOS los carros en cristiano.
function resumenGeneral(vehiculos) {
  if (!vehiculos || vehiculos.length === 0) {
    return { icono: '🚗', frase: 'Sin vehículos por ahora' };
  }
  const conProblema = vehiculos.filter((v) => peorEstado(v.mantenimientos) === 'vencido');
  const porRevisar = vehiculos.filter((v) => peorEstado(v.mantenimientos) === 'proximo');

  if (conProblema.length > 0) {
    const placas = conProblema.map((v) => v.placa).join(', ');
    return {
      icono: '🔴',
      frase:
        conProblema.length === 1
          ? `Tu carro ${placas} necesita taller`
          : `${conProblema.length} carros necesitan taller: ${placas}`,
    };
  }
  if (porRevisar.length > 0) {
    return {
      icono: '🟠',
      frase:
        porRevisar.length === 1
          ? `A ${porRevisar[0].placa} le toca revisión pronto`
          : `${porRevisar.length} carros necesitan revisión pronto`,
    };
  }
  return { icono: '🎉', frase: 'Todos tus carros están al día' };
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
  cabecera: {
    backgroundColor: COLORES.primarioOscuro,
    borderRadius: RADIO.tarjeta,
    padding: ESPACIO.l,
    marginBottom: ESPACIO.m,
  },
  saludo: {
    color: COLORES.blanco,
    fontSize: LETRA.titulo,
    fontWeight: '800',
  },
  taller: {
    color: '#bfdbfe',
    fontSize: LETRA.pequena,
    marginTop: 2,
  },
  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.s,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: RADIO.campo,
    padding: ESPACIO.m,
    marginTop: ESPACIO.m,
  },
  resumenTexto: {
    color: COLORES.blanco,
    fontSize: LETRA.normal,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
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
  pista: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    textAlign: 'center',
    marginTop: ESPACIO.s,
  },
  vacio: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    textAlign: 'center',
    lineHeight: 26,
  },
});
