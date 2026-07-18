// ============================================================
//  PANTALLA: Detalle del vehículo
// ============================================================
// Aquí sí se ve TODO, pero ordenado por urgencia: lo rojo arriba.
// Cada mantenimiento con su ícono (🛢️ 🛑 ⛽), su frase en cristiano
// y una barrita de progreso. v3: soporta claro/oscuro.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import { useTema } from '../apariencia';
import {
  BarraProgreso, Boton, CajaError, CirculoIcono, Placa, Tarjeta,
} from '../componentes';
import { useSesion } from '../sesion';
import {
  ESPACIO, ESTADOS, LETRA, RADIO,
  formatearKm, fraccionUso, fraseMantenimiento, iconoMantenimiento, infoEstado,
} from '../tema';

export default function Vehiculo({ route }) {
  const { vehiculo } = route.params;
  const { token } = useSesion();
  const { colores } = useTema();
  const estilos = useMemo(() => crearEstilos(colores), [colores]);

  // La cita pendiente de ESTE vehículo (si ya pidió una).
  const [citaPendiente, setCitaPendiente] = useState(null);
  const [pidiendoCita, setPidiendoCita] = useState(false); // ¿formulario abierto?
  const [fecha, setFecha] = useState(null);
  const [nota, setNota] = useState('');
  const [mensaje, setMensaje] = useState(null); // confirmación amable
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Reportar el kilometraje del odómetro (el dueño ayuda a afinar).
  const [reportandoKm, setReportandoKm] = useState(false);
  const [kmTexto, setKmTexto] = useState('');
  const [kmReportado, setKmReportado] = useState(null); // el último que guardó
  const [mensajeKm, setMensajeKm] = useState(null);
  const [errorKm, setErrorKm] = useState(null);
  const [guardandoKm, setGuardandoKm] = useState(false);

  // Al entrar, averiguamos si ya hay una cita pendiente para este carro.
  useEffect(() => {
    api
      .misCitas(token)
      .then((citas) =>
        setCitaPendiente(
          citas.find(
            (c) => c.placa === vehiculo.placa && ['solicitada', 'confirmada'].includes(c.estado)
          ) || null
        )
      )
      .catch(() => {}); // si falla, simplemente mostramos el botón normal
  }, [token]);

  // Mantenimientos ordenados: primero lo urgente.
  const mantenimientos = [...(vehiculo.mantenimientos || [])].sort(
    (a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9)
  );

  const kmEstimado = kmReportado ?? (mantenimientos[0]?.km_estimado ?? vehiculo.km_registrado);

  async function guardarKm() {
    setErrorKm(null);
    const km = parseInt(kmTexto.replace(/[.,\s]/g, ''), 10); // acepta "80.000"
    if (isNaN(km)) return setErrorKm('Escribe el número que marca tu odómetro.');
    setGuardandoKm(true);
    try {
      const r = await api.reportarKilometraje(token, vehiculo.vehiculo_id, km);
      setMensajeKm(r.mensaje);
      setKmReportado(km);
      setReportandoKm(false);
      setKmTexto('');
    } catch (e) {
      setErrorKm(e.message);
    } finally {
      setGuardandoKm(false);
    }
  }

  async function confirmarCita() {
    setError(null);
    if (!fecha) return setError('Elige un día para tu cita.');
    setEnviando(true);
    try {
      const r = await api.pedirCita(token, vehiculo.vehiculo_id, fecha, nota || null);
      setMensaje(r.mensaje);
      setPidiendoCita(false);
      // Volvemos a preguntar por las citas: así conocemos el id de la nueva
      // (sin el id no se podría cancelar después).
      try {
        const citas = await api.misCitas(token);
        setCitaPendiente(
          citas.find(
            (c) => c.placa === vehiculo.placa && ['solicitada', 'confirmada'].includes(c.estado)
          ) || { fecha, estado: 'solicitada' }
        );
      } catch {
        setCitaPendiente({ fecha, estado: 'solicitada' });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function cancelarCita() {
    if (!citaPendiente?.id) return;
    // Alert nativo: pregunta antes de cancelar, para evitar toques por error.
    Alert.alert('Cancelar cita', '¿Seguro? El taller quedará avisado.', [
      { text: 'No, dejarla' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setEnviando(true);
          try {
            await api.cancelarMiCita(token, citaPendiente.id);
            setCitaPendiente(null);
            setMensaje(null);
          } catch (e) {
            setError(e.message);
          } finally {
            setEnviando(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={estilos.contenido}
    >
      {/* Identidad del carro: placa grande, marca y km estimado. */}
      <Tarjeta style={estilos.cabecera}>
        <Placa texto={vehiculo.placa} />
        <Text style={estilos.marca}>
          🚛 {vehiculo.marca} {vehiculo.modelo}
        </Text>
        {kmEstimado != null && (
          <View style={estilos.cajitaKm}>
            <Text style={estilos.km}>
              Va por unos <Text style={estilos.kmNumero}>{formatearKm(kmEstimado)} km</Text>
              {kmReportado != null ? ' (tu lectura)' : ' (estimado)'}
            </Text>
          </View>
        )}

        {/* El dueño corrige la estimación con el número real del tablero. */}
        {mensajeKm ? (
          <Text style={[estilos.km, { color: colores.alDia, marginTop: ESPACIO.s, fontWeight: '700' }]}>
            ✅ {mensajeKm}
          </Text>
        ) : !reportandoKm ? (
          <Pressable onPress={() => setReportandoKm(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={estilos.enlaceKm}>🔢 Actualizar mi kilometraje</Text>
          </Pressable>
        ) : null}

        {reportandoKm && (
          <View style={{ width: '100%', marginTop: ESPACIO.m }}>
            <Text style={estilos.pregunta}>¿Cuántos km marca tu tablero?</Text>
            <TextInput
              style={estilos.campoKm}
              value={kmTexto}
              onChangeText={setKmTexto}
              placeholder="Ej.: 82500"
              placeholderTextColor={colores.textoSuave}
              keyboardType="number-pad"
            />
            <CajaError mensaje={errorKm} />
            <Boton
              titulo={guardandoKm ? 'Guardando…' : 'Guardar kilometraje'}
              onPress={guardarKm}
              deshabilitado={guardandoKm}
            />
            <Pressable onPress={() => setReportandoKm(false)} style={{ marginTop: ESPACIO.s, minHeight: 44, justifyContent: 'center' }}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </Pressable>
          </View>
        )}
      </Tarjeta>

      {/* La lista de mantenimientos: ícono + nombre + frase + barrita. */}
      <Text style={estilos.seccion}>Mantenimientos</Text>
      <Tarjeta>
        {mantenimientos.length === 0 && (
          <Text style={estilos.fraseSuave}>El taller aún no configuró recordatorios.</Text>
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
                <BarraProgreso fraccion={fraccionUso(m)} estado={m.estado} />
              </View>
            </View>
          );
        })}
      </Tarjeta>

      {/* La acción: pedir cita. Si ya hay una, lo decimos y no repetimos. */}
      <Text style={estilos.seccion}>Cita con el taller</Text>
      {mensaje && (
        <Tarjeta style={{ backgroundColor: colores.alDiaFondo }}>
          <Text style={[estilos.confirmacion, { color: colores.alDia }]}>✅ {mensaje}</Text>
        </Tarjeta>
      )}

      {citaPendiente && !mensaje && (
        <Tarjeta style={{ backgroundColor: colores.primarioSuave }}>
          <Text style={[estilos.confirmacion, { color: colores.texto }]}>
            📅 Ya tienes una cita{' '}
            {citaPendiente.estado === 'confirmada' ? 'confirmada' : 'solicitada'} para el{' '}
            {citaPendiente.fecha}.
            {citaPendiente.estado === 'solicitada' ? ' El taller te confirmará.' : ''}
          </Text>
        </Tarjeta>
      )}

      {!citaPendiente && !mensaje && !pidiendoCita && (
        <Boton titulo="📅  Pedir cita" onPress={() => setPidiendoCita(true)} />
      )}

      {/* Si hay cita viva (y sabemos su id), el dueño puede cancelarla. */}
      {citaPendiente?.id && !pidiendoCita && (
        <Pressable onPress={cancelarCita} disabled={enviando} style={{ marginTop: ESPACIO.s }}>
          <Text style={estilos.cancelar}>❌ Cancelar esta cita</Text>
        </Pressable>
      )}

      {pidiendoCita && (
        <Tarjeta>
          <Text style={estilos.pregunta}>¿Qué día te sirve?</Text>
          <View style={estilos.filaFechas}>
            {opcionesDeFecha().map((op) => (
              <Pressable
                key={op.valor}
                onPress={() => setFecha(op.valor)}
                style={[estilos.chipFecha, fecha === op.valor && estilos.chipElegido]}
              >
                <Text style={[estilos.chipTexto, fecha === op.valor && estilos.chipTextoElegido]}>
                  {op.etiqueta}
                </Text>
                <Text
                  style={[estilos.chipFechaChica, fecha === op.valor && estilos.chipTextoElegido]}
                >
                  {op.valor.slice(8)}/{op.valor.slice(5, 7)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={estilos.pregunta}>¿Algo que contarle al taller? (opcional)</Text>
          <TextInput
            style={estilos.campoNota}
            value={nota}
            onChangeText={setNota}
            placeholder="Ej.: suena raro al frenar"
            placeholderTextColor={colores.textoSuave}
            multiline
          />

          <CajaError mensaje={error} />
          <Boton
            titulo={enviando ? 'Enviando…' : 'Confirmar cita'}
            onPress={confirmarCita}
            deshabilitado={enviando}
          />
          <Pressable onPress={() => setPidiendoCita(false)} style={{ marginTop: ESPACIO.m }}>
            <Text style={estilos.cancelar}>Mejor no, cancelar</Text>
          </Pressable>
        </Tarjeta>
      )}

      {/* Historial: lo último que le hicieron al carro, sin abrumar. */}
      {vehiculo.historial && vehiculo.historial.length > 0 && (
        <>
          <Text style={estilos.seccion}>Últimas visitas al taller</Text>
          <Tarjeta>
            {vehiculo.historial.map((h, i) => (
              <View key={i} style={[estilos.filaHist, i > 0 && estilos.filaBorde]}>
                <Text style={estilos.fechaHist}>{h.fecha}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.descHist}>{h.descripcion || 'Visita al taller'}</Text>
                  <Text style={estilos.kmHist}>{formatearKm(h.kilometraje)} km</Text>
                </View>
              </View>
            ))}
          </Tarjeta>
        </>
      )}
    </ScrollView>
  );
}

// Fechas rápidas: mañana, en 3 días, en una semana. Sin calendario.
function opcionesDeFecha() {
  const en = (dias, etiqueta) => {
    const d = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    return { etiqueta, valor: d.toISOString().slice(0, 10) };
  };
  return [en(1, 'Mañana'), en(3, 'En 3 días'), en(7, 'En una semana')];
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
    cajitaKm: {
      backgroundColor: c.fondo,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: ESPACIO.m,
      marginTop: ESPACIO.s,
    },
    km: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
    },
    kmNumero: {
      color: c.texto,
      fontWeight: '800',
    },
    enlaceKm: {
      color: c.primario,
      fontSize: LETRA.pequena,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: ESPACIO.s,
    },
    campoKm: {
      backgroundColor: c.fondo,
      borderWidth: 1,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      color: c.texto,
      fontSize: LETRA.subtitulo,
      fontWeight: '700',
      padding: ESPACIO.m,
      marginBottom: ESPACIO.m,
      minHeight: 52,
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
    filaMant: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: ESPACIO.m,
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
    fraseSuave: {
      color: c.textoSuave,
      fontSize: LETRA.normal,
    },
    confirmacion: {
      fontSize: LETRA.normal,
      lineHeight: 24,
      fontWeight: '600',
    },
    pregunta: {
      color: c.texto,
      fontSize: LETRA.normal,
      fontWeight: '700',
      marginBottom: ESPACIO.s,
    },
    filaFechas: {
      flexDirection: 'row',
      gap: ESPACIO.s,
      marginBottom: ESPACIO.m,
    },
    chipFecha: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      paddingVertical: ESPACIO.m,
      alignItems: 'center',
      minHeight: 54,
      backgroundColor: c.fondo,
    },
    chipElegido: {
      borderColor: c.primario,
      backgroundColor: c.primarioSuave,
    },
    chipTexto: {
      color: c.texto,
      fontSize: LETRA.pequena,
      fontWeight: '700',
    },
    chipTextoElegido: {
      color: c.texto,
    },
    chipFechaChica: {
      color: c.textoSuave,
      fontSize: 12,
      marginTop: 2,
    },
    campoNota: {
      backgroundColor: c.fondo,
      borderWidth: 1,
      borderColor: c.borde,
      borderRadius: RADIO.campo,
      color: c.texto,
      fontSize: LETRA.normal,
      padding: ESPACIO.m,
      minHeight: 70,
      marginBottom: ESPACIO.m,
      textAlignVertical: 'top',
    },
    cancelar: {
      color: c.textoSuave,
      fontSize: LETRA.pequena,
      textAlign: 'center',
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
