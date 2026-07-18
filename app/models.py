"""
Modelos de datos = las tablas de la base de datos.

Este es el corazón del proyecto. Aquí definimos qué guardamos y cómo se
relacionan las cosas entre sí. Léelo de arriba hacia abajo como un mapa:

    Taller  ->  tiene muchos Usuarios (personal), Clientes y Vehículos
    Cliente ->  es dueño de uno o varios Vehículos
    Vehículo -> tiene muchos Ingresos (visitas al taller)
    Ingreso ->  registra qué Mantenimientos se hicieron ese día
    TipoMantenimiento -> las reglas (cada cuántos km / meses toca cada cosa)

REGLA DE ORO (multi-inquilino): casi todo cuelga de un `taller_id`. Así un
taller nunca puede ver los datos de otro. Esa columna es clave de seguridad.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base
from .utilidades import ahora_utc, token_portal


class Taller(Base):
    """Un taller = un 'inquilino' (tenant) del sistema."""
    __tablename__ = "talleres"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    creado_en = Column(DateTime, default=ahora_utc)

    usuarios = relationship("Usuario", back_populates="taller")
    clientes = relationship("Cliente", back_populates="taller")
    vehiculos = relationship("Vehiculo", back_populates="taller")
    tipos_mantenimiento = relationship("TipoMantenimiento", back_populates="taller")


class Usuario(Base):
    """Personal del taller que usa el sistema (administrador o mecánico)."""
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), nullable=False)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    # ¡Nunca guardamos la contraseña en texto plano! Solo su "hash".
    clave_hash = Column(String, nullable=False)
    rol = Column(String, default="mecanico")  # "admin" o "mecanico"
    creado_en = Column(DateTime, default=ahora_utc)

    taller = relationship("Taller", back_populates="usuarios")


class Cliente(Base):
    """Dueño de uno o varios vehículos."""
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), nullable=False)
    nombre = Column(String, nullable=False)
    email = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    # FASE 3: el "enlace secreto" del portal. El cliente NO usa contraseña:
    # el taller le comparte un link con este código único e inadivinable.
    token_acceso = Column(String, unique=True, index=True, default=token_portal)
    # FASE 5 (Habeas Data, Ley 1581/2012): cuándo autorizó el cliente el
    # tratamiento de sus datos. El taller lo confirma al registrarlo.
    consentimiento_en = Column(DateTime, nullable=True)
    # MVP CLIENTE: contraseña opcional. El cliente entra la primera vez con
    # su enlace secreto y desde ahí crea su contraseña (usuario = su correo).
    clave_hash = Column(String, nullable=True)
    creado_en = Column(DateTime, default=ahora_utc)

    taller = relationship("Taller", back_populates="clientes")
    vehiculos = relationship("Vehiculo", back_populates="cliente")


class Vehiculo(Base):
    """Un carro. Guardamos el último kilometraje conocido y cuándo se registró."""
    __tablename__ = "vehiculos"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)

    placa = Column(String, nullable=False)
    marca = Column(String, nullable=True)
    modelo = Column(String, nullable=True)
    anio = Column(Integer, nullable=True)

    # Último kilometraje registrado por el taller y la fecha de esa lectura.
    # Con estos dos datos el motor de recordatorios ESTIMA el km de hoy sin
    # tener que molestar al cliente.
    km_actual = Column(Integer, default=0)
    fecha_km = Column(DateTime, default=ahora_utc)

    creado_en = Column(DateTime, default=ahora_utc)

    taller = relationship("Taller", back_populates="vehiculos")
    cliente = relationship("Cliente", back_populates="vehiculos")
    ingresos = relationship("Ingreso", back_populates="vehiculo")


class Ingreso(Base):
    """
    Una visita del vehículo al taller. Cada ingreso registra el kilometraje
    de ese día y qué se hizo. Es la fuente de datos MÁS confiable, porque la
    llena el taller, no el cliente.
    """
    __tablename__ = "ingresos"

    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    fecha = Column(DateTime, default=ahora_utc)
    kilometraje = Column(Integer, nullable=False)
    descripcion = Column(Text, nullable=True)  # qué se hizo, notas del mecánico

    vehiculo = relationship("Vehiculo", back_populates="ingresos")
    # Qué mantenimientos (de la lista de tipos) se realizaron en este ingreso.
    mantenimientos = relationship("MantenimientoRealizado", back_populates="ingreso")


class TipoMantenimiento(Base):
    """
    Las REGLAS de mantenimiento, configurables por cada taller.
    Ej: 'Cambio de aceite' -> cada 10000 km o cada 6 meses.
    El motor avisa cuando se cumple lo que ocurra primero (km O tiempo).
    """
    __tablename__ = "tipos_mantenimiento"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), nullable=False)
    nombre = Column(String, nullable=False)
    intervalo_km = Column(Integer, nullable=True)      # cada cuántos km (o None)
    intervalo_meses = Column(Integer, nullable=True)   # cada cuántos meses (o None)

    taller = relationship("Taller", back_populates="tipos_mantenimiento")


class MantenimientoRealizado(Base):
    """
    Une un Ingreso con un TipoMantenimiento: 'en esta visita se hizo X'.
    Así sabemos cuándo (fecha y km) se hizo cada mantenimiento por última vez,
    que es justo lo que el motor necesita para calcular el próximo.
    """
    __tablename__ = "mantenimientos_realizados"

    id = Column(Integer, primary_key=True, index=True)
    ingreso_id = Column(Integer, ForeignKey("ingresos.id"), nullable=False)
    tipo_id = Column(Integer, ForeignKey("tipos_mantenimiento.id"), nullable=False)

    ingreso = relationship("Ingreso", back_populates="mantenimientos")
    tipo = relationship("TipoMantenimiento")


class SuscripcionPush(Base):
    """
    FASE 3 (push): la "dirección de entrega" de las notificaciones de un
    cliente. Cuando el cliente activa los avisos en la PWA, su navegador
    genera esta suscripción (un endpoint único + dos llaves de cifrado) y
    la guardamos aquí. Un cliente puede tener varias (celular, computador).
    """
    __tablename__ = "suscripciones_push"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    endpoint = Column(Text, unique=True, nullable=False)  # URL única del navegador
    p256dh = Column(String, nullable=False)  # llave pública de cifrado
    auth = Column(String, nullable=False)    # secreto de autenticación
    # APP MÓVIL: canal del dispositivo. "web" = navegador (PWA, VAPID);
    # "expo" = celular con la app (endpoint guarda el ExponentPushToken,
    # y p256dh/auth van vacíos porque Expo no los usa).
    tipo = Column(String, default="web", nullable=False)
    creado_en = Column(DateTime, default=ahora_utc)

    cliente = relationship("Cliente")


class SuscripcionPushPersonal(Base):
    """
    Push del PERSONAL del taller (app móvil): la dirección de entrega del
    celular de cada empleado/admin, para avisarle al taller cuando un
    cliente pide una cita. Solo canal Expo (la app); el panel web no
    registra push por ahora.
    """
    __tablename__ = "suscripciones_push_personal"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    endpoint = Column(Text, unique=True, nullable=False)  # ExponentPushToken
    tipo = Column(String, default="expo", nullable=False)
    creado_en = Column(DateTime, default=ahora_utc)

    usuario = relationship("Usuario")


class Cita(Base):
    """
    MVP CLIENTE: una solicitud de cita. El dueño del carro la pide desde su
    portal (fecha deseada + nota) y el taller la gestiona desde el panel.

    Estados: solicitada -> confirmada -> atendida (o cancelada en cualquier
    punto). Sencillo a propósito: no es una agenda con horas exactas, es el
    "quiero llevar el carro tal día" que hoy llega por WhatsApp y se pierde.
    """
    __tablename__ = "citas"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    fecha = Column(String, nullable=False)         # "2026-07-20" (día deseado)
    nota = Column(Text, nullable=True)             # "suena raro al frenar"
    estado = Column(String, default="solicitada")  # solicitada/confirmada/atendida/cancelada
    creado_en = Column(DateTime, default=ahora_utc)

    cliente = relationship("Cliente")
    vehiculo = relationship("Vehiculo")


class RecordatorioEnviado(Base):
    """
    Registro de cada aviso que le mandamos a un cliente (Fase 2).

    ¿Para qué? Para NO repetir el mismo aviso todos los días. Antes de enviar
    un recordatorio miramos aquí: si ya le avisamos de ese mantenimiento a ese
    vehículo hace poco (ej. en los últimos 7 días), no lo volvemos a molestar.
    """
    __tablename__ = "recordatorios_enviados"

    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"), nullable=False)
    tipo_id = Column(Integer, ForeignKey("tipos_mantenimiento.id"), nullable=False)
    estado = Column(String, nullable=False)  # "vencido" o "proximo" al momento del aviso
    canal = Column(String, default="email")  # por ahora solo email; luego push/WhatsApp
    enviado_en = Column(DateTime, default=ahora_utc)

    vehiculo = relationship("Vehiculo")
    tipo = relationship("TipoMantenimiento")
