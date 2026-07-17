// ============================================================
//  PANTALLA: Vehículo (para el PERSONAL del taller)
// ============================================================
// Lo que el mecánico necesita en la rampa: el estado del vehículo,
// REGISTRAR EL INGRESO de hoy (km + qué se le hizo) y el historial.
// Registrar el km aquí es lo que alimenta el motor de recordatorios.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import {
  Boton, CajaError, Cargando, Campo, CirculoIcono, Placa, Tarjeta,
} from '../componentes';
import { useSesion } from '../sesion';
import {
  ESPACIO, ESTADOS, LETRA, RADIO,
  formatearKm, fraseMantenimiento, iconoMantenimiento, infoEstado,
} from '../tema';

export default function VehiculoTaller({ route }) {
  const { vehiculo } = route.params;
  const { sesion } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  const [estado, setEstado] = useState(null);      // recordatorios del motor
  const [ingresos, setIngresos] = useState([]);    // historial de visitas
  const [tipos, setTipos] = useState([]);          // reglas del taller
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  // Formulario de "registrar ingreso".
  const [registrando, setRegistrando] = useState(false);
  const [km, setKm] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hechos, setHechos] = useState([]); // ids de tipos realizados
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setError(null);
    try {
      const [e, i, t] = await Promise.all([
        api.recordatoriosVehiculo(sesion.jwt, vehiculo.id),
        api.ingresosVehiculo(sesion.jwt, vehiculo.id),
        api.listarTipos(sesion.jwt, sesion.tallerId),
      ]);
      setEstado(e);
      setIngresos(i);
      setTipos(t);
    } catch (e) {
      setError(e.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [vehiculo.id])
  );

  // Marcar/desmarcar un trabajo hecho en esta visita.
  function alternarHecho(tipoId) {
    setHechos((lista) =>
      lista.includes(tipoId) ? lista.filter((x) => x !== tipoId) : [...lista, tipoId]
    );
  }

  async function guardarIngreso() {
    setError(null);
    const kmNumero = parseInt((km || '').replace(/\D/g, ''), 10);
    if (!kmNumero && kmNumero !== 0) return setError('Escribe el kilometraje del odómetro.');
    setGuardando(true);
    try {
      await api.crearIngreso(sesion.jwt, {
        vehiculo_id: vehiculo.id,
        kilometraje: kmNumero,
        descripcion: descripcion.trim() || null,
        tipos_realizados: hechos,
      });
      setKm(''); setDescripcion(''); setHechos([]);
      setRegistrando(false);
      setMensaje('Ingreso registrado ✅ El kilometraje quedó actualizado.');
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!estado && !error) return <Cargando mensaje="Revisando el vehículo…" />;

  // Mantenimientos ordenados: primero lo urgente.
  const mantenimientos = [...(estado?.mantenimientos || [])].sort(
    (a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9)
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      {/* Identidad del vehículo. */}
      <Tarjeta style={estilos.cabecera}>
        <Placa texto={vehiculo.placa} />
        <Text style={estilos.marca}>
          {[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ')}
        </Text>
        {estado && (
          <Text style={estilos.km}>
            Último km registrado: {formatearKm(estado.km_registrado)}
          </Text>
        )}
      </Tarjeta>

      <CajaError mensaje={error} />
      {mensaje && <Text style={estilos.exito}>{mensaje}</Text>}

      {/* --- Registrar el ingreso de HOY: la acción principal. --- */}
      {!registrando ? (
        <Boton titulo="🔧 Registrar ingreso de hoy" onPress={() => setRegistrando(true)} />
      ) : (
        <Tarjeta>
          <Text style={estilos.tituloForm}>Ingreso de hoy</Text>
          <Campo
            etiqueta="Kilometraje del odómetro *"
            valor={km}
            alCambiar={setKm}
            placeholder={estado ? `Mayor o igual a ${formatearKm(estado.km_registrado)}` : '85000'}
            keyboardType="numeric"
          />
          <Campo
            etiqueta="¿Qué se le hizo? (descripción)"
            valor={descripcion}
            alCambiar={setDescripcion}
            placeholder="Ej.: cambio de aceite y revisión de frenos"
            multiline
          />

          <Text style={estilos.pregunta}>Marca los mantenimientos realizados:</Text>
          <View style={estilos.filaChips}>
            {tipos.map((t) => {
              const marcado = hechos.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => alternarHecho(t.id)}
                  style={[estilos.chip, marcado && estilos.chipMarcado]}
                >
                  <Text style={[estilos.chipTexto, marcado && estilos.chipTextoMarcado]}>
                    {marcado ? '✓ ' : ''}{iconoMantenimiento(t.nombre)} {t.nombre}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Boton
            titulo={guardando ? 'Guardando…' : 'Guardar ingreso'}
            onPress={guardarIngreso}
            deshabilitado={guardando}
          />
          <Pressable onPress={() => setRegistrando(false)} style={{ marginTop: ESPACIO.m }}>
            <Text style={estilos.cancelar}>Cancelar</Text>
          </Pressable>
        </Tarjeta>
      )}

      {/* --- Estado según el motor de recordatorios. --- */}
      <Text style={estilos.seccion}>Estado de mantenimientos</Text>
      <Tarjeta>
        {mantenimientos.length === 0 && (
          <Text style={estilos.suave}>El taller aún no tiene reglas configuradas.</Text>
        )}
        {mantenimientos.map((m, i) => {
          const info = infoEstado(m.estado, colores);
          return (
            <View key={m.tipo_id} style={[estilos.filaMant, i > 0 && estilos.filaBorde]}>
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

      {/* --- Historial de visitas. --- */}
      <Text style={estilos.seccion}>Historial de ingresos</Text>
      <Tarjeta>
        {ingresos.length === 0 && (
          <Text style={estilos.suave}>Todavía no hay ingresos registrados.</Text>
        )}
        {ingresos.map((h, i) => (
          <View key={h.id} style={[estilos.filaHist, i > 0 && estilos.filaBorde]}>
            <Text style={estilos.fechaHist}>{String(h.fecha).slice(0, 10)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={estilos.descHist}>{h.descripcion || 'Visita al taller'}</Text>
              <Text style={estilos.kmHist}>{formatearKm(h.kilometraje)} km</Text>
            </View>
          </View>
        ))}
      </Tarjeta>
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
    cabecera: {
      alignItems: 'center',
      paddingVertical: ESPACIO.l,
    },
    marca: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '700',
      marginTop: ESPACIO.m,
    },
    km: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      marginTop: ESPACIO.xs,
    },
    exito: {
      color: c.alDia,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      marginBottom: ESPACIO.s,
      marginLeft: ESPACIO.xs,
    },
    tituloForm: {
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '800',
      marginBottom: ESPACIO.m,
    },
    pregunta: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      marginBottom: ESPACIO.s,
    },
    filaChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ESPACIO.s,
      marginBottom: ESPACIO.m,
    },
    chip: {
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: 999,
      paddingVertical: ESPACIO.s,
      paddingHorizontal: ESPACIO.m,
      minHeight: 40,
      justifyContent: 'center',
      backgroundColor: c.fondo,
    },
    chipMarcado: {
      borderColor: c.primario,
      backgroundColor: c.primarioSuave,
    },
    chipTexto: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '700',
    },
    chipTextoMarcado: {
      color: c.texto,
    },
    cancelar: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
    },
    seccion: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: ESPACIO.l,
      marginBottom: ESPACIO.s,
      marginLeft: ESPACIO.xs,
    },
    suave: {
      color: c.textoSuave,
      fontSize: LETRA.normal,
    },
    filaMant: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ESPACIO.s,
    },
    filaBorde: {
      borderTopWidth: 1,
      borderTopColor: c.borde,
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
    filaHist: {
      flexDirection: 'row',
      paddingVertical: ESPACIO.m,
      gap: ESPACIO.m,
    },
    fechaHist: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      width: 84,
    },
    descHist: {
      color: c.texto,
      fontSize: LETRA.pequena,
      lineHeight: 20,
    },
    kmHist: {
      color: c.textoSuave,
      fontSize: 12,
      marginTop: 2,
    },
  });
}
