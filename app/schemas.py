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
from typing import Optional

from pydantic import BaseModel, EmailStr


# ---------- Taller ----------
class TallerCrear(BaseModel):
    nombre: str
    email: EmailStr


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
    clave: str
    rol: str = "mecanico"


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


class ClienteSalida(BaseModel):
    id: int
    nombre: str
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None

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
    km_actual: int = 0


class VehiculoSalida(BaseModel):
    id: int
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


# ---------- Suscripción push (Fase 3) ----------
class SuscripcionPushCrear(BaseModel):
    """Lo que el navegador del cliente envía al activar los avisos."""
    endpoint: str
    p256dh: str
    auth: str


class SuscripcionPushEliminar(BaseModel):
    endpoint: str


# ---------- Ingreso (visita al taller) ----------
class IngresoCrear(BaseModel):
    vehiculo_id: int
    kilometraje: int
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
