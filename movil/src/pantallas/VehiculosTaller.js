// ============================================================
//  PANTALLA: Vehículos (para el PERSONAL del taller)
// ============================================================
// La lista COMPLETA de vehículos del taller, con buscador por
// placa, marca o dueño. Es el camino rápido del mecánico en la
// rampa: buscar la placa y registrar el ingreso de hoy.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { CajaError, Cargando, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO, formatearKm } from '../tema';

export default function VehiculosTaller({ navigation }) {
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [vehiculos, setVehiculos] = useState(null);
  const [duenos, setDuenos] = useState({}); // cliente_id -> nombre
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      // Vehículos y clientes a la vez: el vehículo solo trae el ID de su
      // dueño, así que armamos un diccionario id -> nombre para mostrarlo.
      const [v, c] = await Promise.all([
        api.listarVehiculos(sesion.jwt, sesion.tallerId),
        api.listarClientes(sesion.jwt, sesion.tallerId),
      ]);
      const porId = {};
      for (const cliente of c) porId[cliente.id] = cliente.nombre;
      setVehiculos(v);
      setDuenos(porId);
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  async function alRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (!vehiculos && !error) return <Cargando mensaje="Buscando los vehículos…" />;

  const texto = busqueda.trim().toLowerCase();
  const filtrados = (vehiculos || []).filter((v) => {
    if (!texto) return true;
    const dueno = duenos[v.cliente_id] || '';
    return (
      v.placa.toLowerCase().includes(texto) ||
      (v.marca || '').toLowerCase().includes(texto) ||
      (v.modelo || '').toLowerCase().includes(texto) ||
      dueno.toLowerCase().includes(texto)
    );
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={colores.primario} />
      }
    >
      {/* Buscador: por placa, marca, modelo o dueño. */}
      <TextInput
        style={estilos.buscador}
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="🔍 Buscar placa, marca o dueño…"
        placeholderTextColor={colores.textoSuave}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <CajaError mensaje={error} />

      {/* Los vehículos nuevos se crean desde la ficha del cliente. */}
      <Text style={estilos.pista}>
        Para agregar un vehículo, abre el cliente en 👥 Clientes y usa
        "Nuevo vehículo".
      </Text>

      {filtrados.length === 0 && vehiculos && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            {texto
              ? 'Ningún vehículo coincide con la búsqueda.'
              : '🚛\n\nAún no hay vehículos registrados.'}
          </Text>
        </Tarjeta>
      )}

      {filtrados.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => navigation.navigate('VehiculoTaller', { vehiculo: v })}
        >
          {({ pressed }) => (
            <Tarjeta style={{ opacity: pressed ? 0.85 : 1 }}>
              <View style={estilos.fila}>
                <Placa texto={v.placa} />
                <View style={{ flex: 1, marginLeft: ESPACIO.m }}>
                  <Text style={estilos.marca}>
                    {[v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || 'Sin descripción'}
                  </Text>
                  <Text style={estilos.datos}>
                    {duenos[v.cliente_id] || 'Sin dueño registrado'}
                    {'  ·  '}
                    {formatearKm(v.km_actual)} km
                  </Text>
                </View>
                <Text style={estilos.flecha}>›</Text>
              </View>
            </Tarjeta>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

// Los estilos dependen de la paleta activa: se crean con ella.
function crearEstilos(c) {
  return StyleSheet.create({
    contenido: {
      padding: ESPACIO.m,
      paddingBottom: ESPACIO.xl,
    },
    buscador: {
      backgroundColor: c.tarjeta,
      borderRadius: RADIO.campo,
      borderWidth: 1,
      borderColor: c.borde,
      color: c.texto,
      fontSize: LETRA.normal,
      padding: ESPACIO.m,
      minHeight: 52,
      marginBottom: ESPACIO.m,
    },
    pista: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      lineHeight: 20,
      marginBottom: ESPACIO.m,
      marginLeft: ESPACIO.xs,
    },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    marca: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
    },
    datos: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: 2,
    },
    flecha: {
      color: c.textoSuave,
      fontSize: 30,
      fontWeight: '300',
    },
    vacio: {
      color: c.texto,
      fontSize: LETRA.normal,
      textAlign: 'center',
      lineHeight: 26,
    },
  });
}
