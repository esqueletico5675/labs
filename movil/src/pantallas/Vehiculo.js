// ============================================================
//  PANTALLA: Detalle del vehículo
// ============================================================
// Aquí sí se ve TODO, pero ordenado por urgencia: lo rojo arriba.
// Y la acción está a un toque: "Pedir cita" con fechas rápidas
// (nada de calendarios enredados).

import { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as api from '../api';
import { Boton, CajaError, Placa, PuntoEstado, Tarjeta } from '../componentes';
import { useSesion } from '../sesion';
import {
  COLORES, ESPACIO, ESTADOS, LETRA, formatearKm, fraseMantenimiento,
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
      {/* Identidad del carro: placa grande, marca debajo. */}
      <View style={estilos.cabecera}>
        <Placa texto={vehiculo.placa} />
        <Text style={estilos.marca}>
          {vehiculo.marca} {vehiculo.modelo}
        </Text>
        {kmEstimado != null && (
          <Text style={estilos.km}>
            Va por unos {formatearKm(kmEstimado)} km (estimado)
          </Text>
        )}
      </View>

      {/* La lista de mantenimientos: punto de color + nombre + frase humana. */}
      <Text style={estilos.seccion}>Mantenimientos</Text>
      <Tarjeta>
        {mantenimientos.length === 0 && (
          <Text style={estilos.fraseSuave}>El taller aún no configuró recordatorios.</Text>
        )}
        {mantenimientos.map((m, i) => (
          <View
            key={m.tipo_id}
            style={[estilos.filaMant, i > 0 && estilos.filaMantBorde]}
          >
            <PuntoEstado estado={m.estado} />
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombreMant}>{m.tipo}</Text>
              <Text
                style={[
                  estilos.fraseMant,
                  { color: ESTADOS[m.estado]?.color || COLORES.textoSuave },
                ]}
              >
                {fraseMantenimiento(m)}
              </Text>
            </View>
          </View>
        ))}
      </Tarjeta>

      {/* La acción: pedir cita. Si ya hay una, lo decimos y no repetimos. */}
      <Text style={estilos.seccion}>Cita con el taller</Text>
      {mensaje && (
        <Tarjeta style={{ borderColor: COLORES.alDia }}>
          <Text style={estilos.confirmacion}>✅ {mensaje}</Text>
        </Tarjeta>
      )}

      {citaPendiente && !mensaje && (
        <Tarjeta style={{ borderColor: COLORES.primario }}>
          <Text style={estilos.confirmacion}>
            📅 Ya tienes una cita {citaPendiente.estado === 'confirmada' ? 'confirmada' : 'solicitada'}{' '}
            para el {citaPendiente.fecha}.
            {citaPendiente.estado === 'solicitada' ? ' El taller te confirmará.' : ''}
          </Text>
        </Tarjeta>
      )}

      {!citaPendiente && !mensaje && !pidiendoCita && (
        <Boton titulo="Pedir cita 📅" onPress={() => setPidiendoCita(true)} />
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
                <Text
                  style={[estilos.chipTexto, fecha === op.valor && estilos.chipTextoElegido]}
                >
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
              <View key={i} style={[estilos.filaHist, i > 0 && estilos.filaMantBorde]}>
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
    marginBottom: ESPACIO.m,
  },
  marca: {
    color: COLORES.texto,
    fontSize: LETRA.subtitulo,
    fontWeight: '600',
    marginTop: ESPACIO.m,
  },
  km: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    marginTop: ESPACIO.xs,
  },
  seccion: {
    color: COLORES.textoSuave,
    fontSize: LETRA.pequena,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: ESPACIO.l,
    marginBottom: ESPACIO.s,
  },
  filaMant: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ESPACIO.m,
  },
  filaMantBorde: {
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  nombreMant: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    fontWeight: '600',
  },
  fraseMant: {
    fontSize: LETRA.pequena,
    marginTop: 2,
    fontWeight: '600',
  },
  fraseSuave: {
    color: COLORES.textoSuave,
    fontSize: LETRA.normal,
  },
  confirmacion: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    lineHeight: 24,
  },
  pregunta: {
    color: COLORES.texto,
    fontSize: LETRA.normal,
    fontWeight: '600',
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
    borderRadius: 12,
    paddingVertical: ESPACIO.m,
    alignItems: 'center',
    minHeight: 52,
  },
  chipElegido: {
    borderColor: COLORES.primario,
    backgroundColor: COLORES.primario + '33',
  },
  chipTexto: {
    color: COLORES.texto,
    fontSize: LETRA.pequena,
    fontWeight: '700',
  },
  chipTextoElegido: {
    color: '#93c5fd',
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
    borderRadius: 12,
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
