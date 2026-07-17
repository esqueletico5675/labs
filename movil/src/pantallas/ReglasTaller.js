// ============================================================
//  PANTALLA: Reglas de mantenimiento (para el PERSONAL del taller)
// ============================================================
// Las reglas que alimentan el motor de recordatorios: "cambio de
// aceite cada 10.000 km o 6 meses". Todos las VEN; solo el ADMIN
// las crea, edita o borra (igual que en el panel web).

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import { Boton, CajaError, Cargando, Campo, CirculoIcono, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import { ESPACIO, LETRA, formatearKm, iconoMantenimiento } from '../tema';

// "cada 10.000 km o cada 6 meses" — la regla en una frase.
function fraseRegla(t) {
  const partes = [];
  if (t.intervalo_km) partes.push(`cada ${formatearKm(t.intervalo_km)} km`);
  if (t.intervalo_meses) partes.push(`cada ${t.intervalo_meses} meses`);
  return partes.join('  o  ') || 'sin intervalo definido';
}

export default function ReglasTaller() {
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);
  const esAdmin = sesion.rol === 'admin';

  const [reglas, setReglas] = useState(null);
  const [error, setError] = useState(null);

  // Un solo formulario sirve para crear (editandoId=null) o editar.
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [cadaKm, setCadaKm] = useState('');
  const [cadaMeses, setCadaMeses] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      setReglas(await api.listarTipos(sesion.jwt, sesion.tallerId));
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  function abrirNueva() {
    setEditandoId(null);
    setNombre(''); setCadaKm(''); setCadaMeses('');
    setFormAbierto(true);
  }

  function abrirEdicion(regla) {
    setEditandoId(regla.id);
    setNombre(regla.nombre);
    setCadaKm(regla.intervalo_km ? String(regla.intervalo_km) : '');
    setCadaMeses(regla.intervalo_meses ? String(regla.intervalo_meses) : '');
    setFormAbierto(true);
  }

  async function guardar() {
    setError(null);
    if (!nombre.trim()) return setError('Escribe el nombre del mantenimiento.');
    const km = cadaKm ? parseInt(cadaKm.replace(/\D/g, ''), 10) : null;
    const meses = cadaMeses ? parseInt(cadaMeses.replace(/\D/g, ''), 10) : null;
    if (!km && !meses) {
      return setError('Define al menos un intervalo: kilómetros o meses.');
    }
    setGuardando(true);
    try {
      const datos = { nombre: nombre.trim(), intervalo_km: km, intervalo_meses: meses };
      if (editandoId) {
        await api.actualizarTipo(sesion.jwt, sesion.tallerId, editandoId, datos);
      } else {
        await api.crearTipo(sesion.jwt, sesion.tallerId, datos);
      }
      setFormAbierto(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function confirmarBorrar(regla) {
    Alert.alert(
      `¿Borrar "${regla.nombre}"?`,
      'Los vehículos dejarán de recibir recordatorios de este mantenimiento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.eliminarTipo(sesion.jwt, sesion.tallerId, regla.id);
              await cargar();
            } catch (e) {
              setError(e.message);
            }
          },
        },
      ]
    );
  }

  if (!reglas && !error) return <Cargando mensaje="Buscando las reglas…" />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={estilos.explicacion}>
        Estas reglas deciden cuándo avisarle a cada cliente. Manda el manual
        del fabricante: ajústalas a los vehículos de tu taller.
      </Text>

      <CajaError mensaje={error} />

      {esAdmin && !formAbierto && (
        <View style={{ marginBottom: ESPACIO.m }}>
          <Boton titulo="➕ Nueva regla" onPress={abrirNueva} />
        </View>
      )}

      {formAbierto && (
        <Tarjeta>
          <Text style={estilos.tituloForm}>
            {editandoId ? 'Editar regla' : 'Nueva regla'}
          </Text>
          <Campo etiqueta="Nombre *" valor={nombre} alCambiar={setNombre} placeholder="Cambio de aceite" />
          <Campo
            etiqueta="Cada cuántos kilómetros (vacío = no aplica)"
            valor={cadaKm}
            alCambiar={setCadaKm}
            placeholder="10000"
            keyboardType="numeric"
          />
          <Campo
            etiqueta="Cada cuántos meses (vacío = no aplica)"
            valor={cadaMeses}
            alCambiar={setCadaMeses}
            placeholder="6"
            keyboardType="numeric"
          />
          <Boton
            titulo={guardando ? 'Guardando…' : 'Guardar regla'}
            onPress={guardar}
            deshabilitado={guardando}
          />
          <Pressable onPress={() => setFormAbierto(false)} style={{ marginTop: ESPACIO.m }}>
            <Text style={estilos.cancelar}>Cancelar</Text>
          </Pressable>
        </Tarjeta>
      )}

      {(reglas || []).map((t) => (
        <Tarjeta key={t.id}>
          <View style={estilos.filaRegla}>
            <CirculoIcono icono={iconoMantenimiento(t.nombre)} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{t.nombre}</Text>
              <Text style={estilos.intervalo}>{fraseRegla(t)}</Text>
            </View>
          </View>
          {esAdmin && (
            <View style={estilos.filaAcciones}>
              <Pressable onPress={() => abrirEdicion(t)} style={estilos.accionSuave}>
                <Text style={estilos.accionSuaveTexto}>✏️ Editar</Text>
              </Pressable>
              <Pressable onPress={() => confirmarBorrar(t)} style={estilos.accionPeligro}>
                <Text style={estilos.accionPeligroTexto}>🗑️ Borrar</Text>
              </Pressable>
            </View>
          )}
        </Tarjeta>
      ))}

      {reglas && reglas.length === 0 && (
        <Tarjeta>
          <Text style={estilos.vacio}>📋{'\n\n'}Aún no hay reglas configuradas.</Text>
        </Tarjeta>
      )}
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
    explicacion: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      lineHeight: 20,
      marginBottom: ESPACIO.m,
      marginLeft: ESPACIO.xs,
    },
    tituloForm: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
      marginBottom: ESPACIO.m,
    },
    cancelar: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
    },
    filaRegla: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nombre: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
    },
    intervalo: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: 2,
    },
    filaAcciones: {
      flexDirection: 'row',
      gap: ESPACIO.s,
      marginTop: ESPACIO.m,
    },
    accionSuave: {
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: 12,
      paddingVertical: ESPACIO.s,
      paddingHorizontal: ESPACIO.m,
      minHeight: 42,
      justifyContent: 'center',
    },
    accionSuaveTexto: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
    },
    accionPeligro: {
      backgroundColor: c.vencidoFondo,
      borderRadius: 12,
      paddingVertical: ESPACIO.s,
      paddingHorizontal: ESPACIO.m,
      minHeight: 42,
      justifyContent: 'center',
    },
    accionPeligroTexto: {
      color: c.vencido,
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
