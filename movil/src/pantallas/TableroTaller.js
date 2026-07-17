// ============================================================
//  PANTALLA: Tablero del taller (para el PERSONAL)
// ============================================================
// La pregunta que responde: "¿a quién hay que llamar HOY?"
// Muestra solo los vehículos con algo vencido o próximo, con el
// teléfono del dueño a UN toque (botón Llamar).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { CajaError, Cargando, CirculoIcono, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import {
  ESPACIO, LETRA, RADIO, fraseMantenimiento, iconoMantenimiento, infoEstado,
} from '../tema';

export default function TableroTaller({ navigation }) {
  const { sesion, salir } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      const r = await api.tableroTaller(sesion.jwt, sesion.tallerId);
      setDatos(r);
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  // Botones de la cabecera: Citas y Ajustes.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Pressable onPress={() => navigation.navigate('CitasTaller')} hitSlop={10}>
            <Text style={{ fontSize: 22 }}>📅</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Ajustes')} hitSlop={10}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (!datos && !error) return <Cargando mensaje="Revisando los vehículos…" />;

  const tablero = datos ? datos.tablero : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={alRefrescar}
          tintColor={colores.primario}
        />
      }
    >
      {datos && (
        /* Cabecera: el resumen del día en una frase. */
        <View style={estilos.cabecera}>
          <Text style={estilos.saludo}>Hola, {primerNombre(sesion.nombre)} 🔧</Text>
          <Text style={estilos.taller}>{sesion.taller}</Text>
          <View style={estilos.resumen}>
            <Text style={{ fontSize: 22 }}>{tablero.length > 0 ? '📞' : '🎉'}</Text>
            <Text style={estilos.resumenTexto}>
              {tablero.length === 0
                ? `Los ${datos.total_vehiculos} vehículos están al día. Nada que llamar hoy.`
                : tablero.length === 1
                  ? '1 vehículo necesita que llames a su dueño'
                  : `${tablero.length} vehículos necesitan que llames a sus dueños`}
            </Text>
          </View>
        </View>
      )}

      <CajaError mensaje={error} />

      {tablero.map((v) => (
        <Tarjeta key={v.vehiculo_id}>
          <View style={estilos.filaSuperior}>
            <Placa texto={v.placa} />
            {v.telefono && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${v.telefono}`)}
                style={estilos.botonLlamar}
              >
                <Text style={estilos.botonLlamarTexto}>📞 Llamar</Text>
              </Pressable>
            )}
          </View>
          <Text style={estilos.cliente}>
            {v.cliente || 'Sin dueño registrado'}
            {v.telefono ? `  ·  ${v.telefono}` : ''}
          </Text>

          {/* Qué está pendiente, con el mismo lenguaje de toda la app. */}
          {v.pendientes.map((m) => {
            const info = infoEstado(m.estado, colores);
            return (
              <View key={m.tipo_id} style={estilos.filaMant}>
                <CirculoIcono icono={iconoMantenimiento(m.tipo)} fondo={info.fondo} />
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nombreMant}>{m.tipo}</Text>
                  <Text style={[estilos.fraseMant, { color: info.color }]}>
                    {info.icono} {fraseMantenimiento(m)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Tarjeta>
      ))}

      {datos && tablero.length === 0 && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            ✅{'\n\n'}Ningún vehículo tiene mantenimientos vencidos ni próximos.
          </Text>
        </Tarjeta>
      )}
    </ScrollView>
  );
}

// "Ana Torres" -> "Ana".
function primerNombre(nombreCompleto) {
  return (nombreCompleto || '').trim().split(' ')[0] || 'equipo';
}

// Los estilos dependen de la paleta activa: se crean con ella.
function crearEstilos(c) {
  return StyleSheet.create({
    contenido: {
      padding: ESPACIO.m,
      paddingBottom: ESPACIO.xl,
    },
    cabecera: {
      backgroundColor: c.primarioOscuro,
      borderRadius: RADIO.tarjeta,
      padding: ESPACIO.l,
      marginBottom: ESPACIO.m,
    },
    saludo: {
      color: c.blanco,
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
      color: c.blanco,
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
    botonLlamar: {
      backgroundColor: c.alDiaFondo,
      borderRadius: 999,
      paddingVertical: ESPACIO.s,
      paddingHorizontal: ESPACIO.m,
      minHeight: 40,
      justifyContent: 'center',
    },
    botonLlamarTexto: {
      color: c.alDia,
      fontSize: LETRA.pequena,
      fontWeight: '800',
    },
    cliente: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: ESPACIO.s,
      marginBottom: ESPACIO.s,
    },
    filaMant: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ESPACIO.s,
    },
    nombreMant: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
    },
    fraseMant: {
      fontSize: LETRA.pequena,
      marginTop: 2,
      fontWeight: '700',
    },
    vacio: {
      color: c.texto,
      fontSize: LETRA.normal,
      textAlign: 'center',
      lineHeight: 26,
    },
  });
}
