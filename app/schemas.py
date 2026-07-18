"""
Esquemas (Pydantic) = la "forma" de los datos que entran y salen de la API.

FastAPI usa estos esquemas para VALIDAR automáticamente lo que llega. Si
alguien manda datos con formato incorrecto, FastAPI lo rechaza solo. Esto
también es seguridad: no dejamos entrar basura a la base de datos.

Separamos:
  - ...Crear   -> lo que el cliente ENVÍA para crear algo
  - ...Salida  -> lo que la API DEVUELVE
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Taller ----------
class TallerCrear(BaseModel):
    nombre: str
    email: EmailStr


# ---------- Registro (Fase 4): taller + su primer admin, en un solo paso ----------
class RegistroTaller(BaseModel):
    """
    El formulario de "abrir cuenta": crea el taller Y su administrador juntos.
    Así ningún taller queda sin dueño, y nadie puede colarse como primer
    usuario de un taller ajeno.
    """
    taller_nombre: str = Field(min_length=2)
    taller_email: EmailStr
    admin_nombre: str = Field(min_length=2)
    admin_email: EmailStr
    admin_clave: str = Field(min_length=6)  # mínimo 6 caracteres


class TallerSalida(BaseModel):
    id: int
    nombre: str
    email: EmailStr

    class Config:
        from_attributes = True  # permite construir el esquema desde el modelo ORM


# ---------- Usuario (personal del taller) ----------
class UsuarioCrear(BaseModel):
    nombre: str
    email: EmailStr
    clave: str = Field(min_length=6)
    # Literal = solo se aceptan estos dos valores exactos; cualquier otro rol
    # inventado se rechaza automáticamente.
    rol: Literal["admin", "mecanico"] = "mecanico"


class UsuarioSalida(BaseModel):
    id: int
    nombre: str
    email: EmailStr
    rol: str

    class Config:
        from_attributes = True


# ---------- Cliente ----------
class ClienteCrear(BaseModel):
    nombre: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    # Habeas Data (Ley 1581/2012): el taller confirma que el cliente autorizó
    # el tratamiento de sus datos. Sin esto, no se puede registrar.
    consentimiento: bool = False


class ClienteSalida(BaseModel):
    id: int
    nombre: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    consentimiento_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClienteActualizar(BaseModel):
    """
    Para EDITAR un cliente. Todos los campos son opcionales: solo se cambia
    lo que envíes (esto se llama actualización parcial o "PATCH").
    """
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None


# ---------- Vehículo ----------
class VehiculoCrear(BaseModel):
    cliente_id: int
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    km_actual: int = Field(default=0, ge=0)  # nunca negativo


class VehiculoSalida(BaseModel):
    id: int
    cliente_id: int  # el dueño: el panel lo necesita para editar sin reasignarlo
    placa: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    km_actual: int
    fecha_km: datetime

    class Config:
        from_attributes = True


class VehiculoActualizar(BaseModel):
    """
    Para EDITAR los datos básicos de un vehículo. OJO: el kilometraje NO se
    edita por aquí a propósito; se actualiza registrando un ingreso, que es
    la fuente confiable (y deja historial).
    """
    cliente_id: Optional[int] = None
    placa: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None


# ---------- Tipo de mantenimiento (las reglas de cada taller) ----------
class TipoMantenimientoCrear(BaseModel):
    nombre: str
    intervalo_km: Optional[int] = None     # cada cuántos km (None = no aplica)
    intervalo_meses: Optional[int] = None  # cada cuántos meses (None = no aplica)


class TipoMantenimientoActualizar(BaseModel):
    nombre: Optional[str] = None
    intervalo_km: Optional[int] = None
    intervalo_meses: Optional[int] = None


class TipoMantenimientoSalida(BaseModel):
    id: int
    nombre: str
    intervalo_km: Optional[int] = None
    intervalo_meses: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- MVP cliente: contraseña y citas ----------
class PortalClave(BaseModel):
    """El cliente crea (o cambia) su contraseña desde su enlace secreto."""
    clave: str = Field(min_length=6)


class PortalLogin(BaseModel):
    """Login del cliente: correo + contraseña (devuelve su token del portal)."""
    email: EmailStr
    clave: str


class CitaCrear(BaseModel):
    vehiculo_id: int
    fecha: str = Field(min_length=10, max_length=10)  # "2026-07-20"
    nota: Optional[str] = None


class KilometrajeReportado(BaseModel):
    """El dueño del carro reporta cuántos km marca su odómetro hoy."""
    vehiculo_id: int
    kilometraje: int = Field(ge=0)


class CitaEstado(BaseModel):
    """El taller mueve la cita de estado desde el panel."""
    estado: Literal["solicitada", "confirmada", "atendida", "cancelada"]


# ---------- Suscripción push (Fase 3) ----------
class SuscripcionPushCrear(BaseModel):
    """Lo que el navegador del cliente envía al activar los avisos."""
    endpoint: str
    p256dh: str
    auth: str


class SuscripcionPushEliminar(BaseModel):
    endpoint: str


class PushMovil(BaseModel):
    """La app móvil (Expo) manda el push token del celular al activar avisos."""
    expo_token: str = Field(min_length=10)


# ---------- Ingreso (visita al taller) ----------
class IngresoCrear(BaseModel):
    vehiculo_id: int
    kilometraje: int = Field(ge=0)  # nunca negativo
    descripcion: Optional[str] = None
    # IDs de los tipos de mantenimiento que se hicieron en esta visita.
    tipos_realizados: list[int] = []


class IngresoSalida(BaseModel):
    id: int
    vehiculo_id: int
    fecha: datetime
    kilometraje: int
    descripcion: Optional[str] = None

    class Config:
        from_attributes = True
