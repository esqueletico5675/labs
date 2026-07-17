// ============================================================
//  PANTALLA: Detalle del vehículo
// ============================================================
// Aquí sí se ve TODO, pero ordenado por urgencia: lo rojo arriba.
// Look v2: cada mantenimiento con su ícono (🛢️ 🛑 ⛽), su frase en
// cristiano y una barrita que muestra qué tan cerca está de vencerse.

import { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import {
  BarraProgreso, Boton, CajaError, CirculoIcono, Placa, Tarjeta,
} from '../componentes';
import { useSesion } from '../sesion';
import {
  COLORES, ESPACIO, ESTADOS, LETRA, RADIO,
  formatearKm, fraccionUso, fraseMantenimiento, iconoMantenimiento,
} from '../tema';

export default function Vehiculo({ route }) {
  const { vehiculo } = route.params;
  const { token } = useSesion();

  // La cita pendiente de ESTE vehículo (si ya pidió una).
  const [citaPendiente, setCitaPendiente] = useState(null);
  const [pidiendoCita, setPidiendoCita] = useState(false); // ¿formulario abierto?
  const [fecha, setFecha] = useState(null);
  const [nota, setNota] = useState('');
  const [mensaje, setMensaje] = useState(null); // confirmación amable
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

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

  const kmEstimado = mantenimientos[0]?.km_estimado ?? vehiculo.km_registrado;

  async function confirmarCita() {
    setError(null);
    if (!fecha) return setError('Elige un día para tu cita.');
    setEnviando(true);
    try {
      const r = await api.pedirCita(token, vehiculo.vehiculo_id, fecha, nota || null);
      setMensaje(r.mensaje);
      setPidiendoCita(false);
      setCitaPendiente({ fecha, estado: 'solicitada' });
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
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
              Va por unos <Text style={estilos.kmNumero}>{formatearKm(kmEstimado)} km</Text> (estimado)
            </Text>
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
          const info = ESTADOS[m.estado] || ESTADOS.al_dia;
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
        <Tarjeta style={{ backgroundColor: COLORES.alDiaFondo }}>
          <Text style={[estilos.confirmacion, { color: COLORES.alDia }]}>✅ {mensaje}</Text>
        </Tarjeta>
      )}

      {citaPendiente && !mensaje && (
        <Tarjeta style={{ backgroundColor: COLORES.primarioSuave }}>
          <Text style={[estilos.confirmacion, { color: COLORES.primarioOscuro }]}>
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
            placeholderTextColor={COLORES.textoSuave}
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

const estilos = StyleSheet.create({
  contenido: {
    padding: ESPACIO.m,
    paddingBottom: ESPACIO.xl,
  },
  cabecera: {
    alignItems: 'center',
    paddingVertical: ESPACIO.l,
  },
  marca: {
    color: COLORES.texto,
    fontSize: LETRA.subtitulo,
    fontWeight: '700',
    marginTop: ESPACIO.m,
  },
  cajitaKm: {
    backgroundColor: COLORES.fondo,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: ESPACIO.m,
    marginTop: ESPACIO.s,
  },
  km: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
  },
  kmNumero: {
    color: COLORES.texto,
    fontWeight: '800',
  },
  seccion: {
    color: COLORES.textoSuave,
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
    borderTopColor: COLORES.borde,
  },
  nombreMant: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    fontWeight: '700',
  },
  fraseMant: {
    fontSize: LETRA.pequena,
    marginTop: 2,
    fontWeight: '700',
  },
  fraseSuave: {
    color: COLORES.textoSuave,
    fontSize: LETRA.normal,
  },
  confirmacion: {
    fontSize: LETRA.normal,
    lineHeight: 24,
    fontWeight: '600',
  },
  pregunta: {
    color: COLORES.texto,
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
    borderColor: COLORES.borde,
    borderRadius: RADIO.campo,
    paddingVertical: ESPACIO.m,
    alignItems: 'center',
    minHeight: 54,
    backgroundColor: COLORES.fondo,
  },
  chipElegido: {
    borderColor: COLORES.primario,
    backgroundColor: COLORES.primarioSuave,
  },
  chipTexto: {
    color: COLORES.texto,
    fontSize: LETRA.pequena,
    fontWeight: '700',
  },
  chipTextoElegido: {
    color: COLORES.primarioOscuro,
  },
  chipFechaChica: {
    color: COLORES.textoSuave,
    fontSize: 12,
    marginTop: 2,
  },
  campoNota: {
    backgroundColor: COLORES.fondo,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIO.campo,
    color: COLORES.texto,
    fontSize: LETRA.normal,
    padding: ESPACIO.m,
    minHeight: 70,
    marginBottom: ESPACIO.m,
    textAlignVertical: 'top',
  },
  cancelar: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    textAlign: 'center',
  },
  filaHist: {
    flexDirection: 'row',
    paddingVertical: ESPACIO.m,
    gap: ESPACIO.m,
  },
  fechaHist: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    width: 84,
  },
  descHist: {
    color: COLORES.texto,
    fontSize: LETRA.pequena,
    lineHeight: 20,
  },
  kmHist: {
    color: COLORES.textoSuave,
    fontSize: 12,
    marginTop: 2,
  },
});
