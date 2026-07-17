// ============================================================
//  PANTALLA: Citas del taller (para el PERSONAL)
// ============================================================
// Las citas que pidieron los clientes, primero las nuevas (por
// confirmar). Cada una con sus acciones a un toque: confirmar,
// marcar atendida o cancelar. Y el teléfono del cliente para llamar.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { CajaError, Cargando, Placa, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, RADIO } from '../tema';

// Cómo se ve cada estado de cita (nombre humano + colores de la paleta).
function estiloCita(estado, colores) {
  switch (estado) {
    case 'solicitada':
      return { texto: '🟠 Nueva — por confirmar', color: colores.proximo, fondo: colores.proximoFondo };
    case 'confirmada':
      return { texto: '📅 Confirmada', color: colores.texto, fondo: colores.primarioSuave };
    case 'atendida':
      return { texto: '✅ Atendida', color: colores.alDia, fondo: colores.alDiaFondo };
    default:
      return { texto: '✖️ Cancelada', color: colores.textoSuave, fondo: colores.borde };
  }
}

export default function CitasTaller() {
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [citas, setCitas] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupada, setOcupada] = useState(null); // id de la cita en proceso

  async function cargar() {
    setError(null);
    try {
      setCitas(await api.citasTaller(sesion.jwt, sesion.tallerId));
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

  // Cambia el estado de una cita y recarga la lista.
  async function cambiar(cita, estado) {
    setOcupada(cita.id);
    setError(null);
    try {
      await api.cambiarEstadoCita(sesion.jwt, sesion.tallerId, cita.id, estado);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupada(null);
    }
  }

  if (!citas && !error) return <Cargando mensaje="Buscando las citas…" />;

  const lista = citas || [];
  const nuevas = lista.filter((c) => c.estado === 'solicitada').length;

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
      {citas && (
        <Text style={estilos.resumen}>
          {nuevas === 0
            ? 'No hay citas nuevas por confirmar.'
            : nuevas === 1
              ? 'Hay 1 cita nueva por confirmar 👇'
              : `Hay ${nuevas} citas nuevas por confirmar 👇`}
        </Text>
      )}

      <CajaError mensaje={error} />

      {lista.length === 0 && citas && (
        <Tarjeta>
          <Text style={estilos.vacio}>
            📅{'\n\n'}Todavía no hay citas.{'\n'}
            Aparecerán aquí cuando los clientes las pidan desde su app.
          </Text>
        </Tarjeta>
      )}

      {lista.map((cita) => {
        const s = estiloCita(cita.estado, colores);
        const trabajando = ocupada === cita.id;
        return (
          <Tarjeta key={cita.id}>
            <View style={estilos.filaSuperior}>
              <Placa texto={cita.placa} />
              <View style={[estilos.pildora, { backgroundColor: s.fondo }]}>
                <Text style={[estilos.pildoraTexto, { color: s.color }]}>{s.texto}</Text>
              </View>
            </View>

            <Text style={estilos.dato}>
              🗓️ Para el <Text style={estilos.datoFuerte}>{cita.fecha}</Text>
            </Text>
            <Text style={estilos.dato}>
              👤 {cita.cliente}
              {cita.telefono ? `  ·  ${cita.telefono}` : ''}
            </Text>
            {cita.nota ? <Text style={estilos.nota}>💬 “{cita.nota}”</Text> : null}

            {/* Acciones según el estado. Grandes, claras, sin menús ocultos. */}
            <View style={estilos.filaAcciones}>
              {cita.telefono && (
                <Accion
                  texto="📞 Llamar"
                  color={colores.alDia}
                  fondo={colores.alDiaFondo}
                  onPress={() => Linking.openURL(`tel:${cita.telefono}`)}
                  estilos={estilos}
                />
              )}
              {cita.estado === 'solicitada' && (
                <Accion
                  texto={trabajando ? '…' : '✔️ Confirmar'}
                  color={colores.texto}
                  fondo={colores.primarioSuave}
                  onPress={() => cambiar(cita, 'confirmada')}
                  deshabilitada={trabajando}
                  estilos={estilos}
                />
              )}
              {cita.estado === 'confirmada' && (
                <Accion
                  texto={trabajando ? '…' : '✅ Atendida'}
                  color={colores.alDia}
                  fondo={colores.alDiaFondo}
                  onPress={() => cambiar(cita, 'atendida')}
                  deshabilitada={trabajando}
                  estilos={estilos}
                />
              )}
              {['solicitada', 'confirmada'].includes(cita.estado) && (
                <Accion
                  texto={trabajando ? '…' : '✖️ Cancelar'}
                  color={colores.vencido}
                  fondo={colores.vencidoFondo}
                  onPress={() => cambiar(cita, 'cancelada')}
                  deshabilitada={trabajando}
                  estilos={estilos}
                />
              )}
            </View>
          </Tarjeta>
        );
      })}
    </ScrollView>
  );
}

// Botón de acción compacto (píldora) para las tarjetas de cita.
function Accion({ texto, color, fondo, onPress, deshabilitada, estilos }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitada}
      style={({ pressed }) => [
        estilos.accion,
        { backgroundColor: fondo, opacity: deshabilitada ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[estilos.accionTexto, { color }]}>{texto}</Text>
    </Pressable>
  );
}

// Los estilos dependen de la paleta activa: se crean con ella.
function crearEstilos(c) {
  return StyleSheet.create({
    contenido: {
      padding: ESPACIO.m,
      paddingBottom: ESPACIO.xl,
    },
    resumen: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
      marginBottom: ESPACIO.m,
      marginLeft: ESPACIO.xs,
    },
    filaSuperior: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: ESPACIO.s,
    },
    pildora: {
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: ESPACIO.m,
    },
    pildoraTexto: {
      fontSize: LETRA.pequena,
      fontWeight: '800',
    },
    dato: {
      color: c.textoSuave,
      fontSize: LETRA.normal,
      marginTop: ESPACIO.s,
    },
    datoFuerte: {
      color: c.texto,
      fontWeight: '800',
    },
    nota: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontStyle: 'italic',
      marginTop: ESPACIO.s,
      lineHeight: 20,
    },
    filaAcciones: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ESPACIO.s,
      marginTop: ESPACIO.m,
    },
    accion: {
      borderRadius: RADIO.campo,
      paddingVertical: ESPACIO.s + 4,
      paddingHorizontal: ESPACIO.m,
      minHeight: 44,
      justifyContent: 'center',
    },
    accionTexto: {
      fontSize: LETRA.pequena,
      fontWeight: '800',
    },
    vacio: {
      color: c.texto,
      fontSize: LETRA.normal,
      textAlign: 'center',
      lineHeight: 26,
    },
  });
}
