"""
Aplicación principal (la API con FastAPI).

Aquí conectamos todo: los modelos, la seguridad y el motor de recordatorios,
y los exponemos como "endpoints" (URLs que la app web o el cliente pueden usar).

Para arrancar el servidor:
    uvicorn app.main:app --reload

Luego abre en el navegador:
    http://127.0.0.1:8000/docs
...y verás una documentación interactiva donde puedes probar TODO sin escribir
nada de frontend todavía. (Eso ya viene incluido en FastAPI, gratis.)

NOTA sobre seguridad: por ahora los endpoints reciben el `taller_id` de forma
explícita para mantener el ejemplo simple. En la Fase 3 esto se reemplaza por
autenticación real (login con token JWT), donde el sistema sabe solo a qué
taller pertenece cada usuario y le impide ver datos de otros talleres.
"""

from datetime import timedelta
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas, security, mantenimiento, notificaciones
from .database import engine, get_db
from .utilidades import ahora_utc, token_portal

# Crea las tablas en la base de datos si no existen (útil para empezar).
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Taller Diésel — API",
    description="Backend de la Fase 1: talleres, vehículos, ingresos y recordatorios.",
    version="0.1.0",
)


@app.get("/")
def inicio():
    return {"mensaje": "API del taller diésel funcionando. Ve a /docs para probarla."}


# ============================================================
#  FASE 3 — AUTENTICACIÓN CON JWT
#  Cómo funciona: el usuario hace login una vez y recibe un token
#  (su "carné digital"). En cada petición lo manda en el encabezado
#  Authorization. Las dependencias de abajo lo verifican SIEMPRE.
# ============================================================

# Le dice a FastAPI: "el token se consigue en /login". Con esto, /docs
# muestra el botón verde "Authorize" para probar todo autenticado.
esquema_oauth2 = OAuth2PasswordBearer(tokenUrl="/login")


def usuario_actual(token: str = Depends(esquema_oauth2),
                   db: Session = Depends(get_db)) -> models.Usuario:
    """¿Quién está haciendo esta petición? Verifica el token y trae al usuario."""
    datos = security.leer_token(token)
    if not datos:
        raise HTTPException(
            status_code=401,
            detail="Token inválido o vencido. Vuelve a iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    usuario = db.get(models.Usuario, int(datos["sub"]))
    if not usuario:
        raise HTTPException(status_code=401, detail="El usuario ya no existe")
    return usuario


def usuario_del_taller(taller_id: int,
                       usuario: models.Usuario = Depends(usuario_actual)) -> models.Usuario:
    """
    LA REGLA #1 DEL SAAS: el taller de tu token debe coincidir con el taller
    de la URL. Si intentas tocar datos de OTRO taller, 403 (prohibido).
    FastAPI toma `taller_id` de la ruta automáticamente.
    """
    if usuario.taller_id != taller_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este taller")
    return usuario


def admin_del_taller(usuario: models.Usuario = Depends(usuario_del_taller)) -> models.Usuario:
    """
    FASE 4 — candado por ROL: además de ser del taller correcto, hay que ser
    admin. Se usa en lo delicado: gestionar el equipo, cambiar las reglas de
    mantenimiento y regenerar enlaces de clientes. El mecánico registra
    ingresos, clientes y vehículos, pero no toca la configuración.
    """
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=403,
            detail="Solo el administrador del taller puede hacer esto",
        )
    return usuario


def vehiculo_del_usuario(db: Session, vehiculo_id: int,
                         usuario: models.Usuario) -> models.Vehiculo:
    """Trae un vehículo SOLO si pertenece al taller del usuario autenticado."""
    vehiculo = db.get(models.Vehiculo, vehiculo_id)
    if not vehiculo or vehiculo.taller_id != usuario.taller_id:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return vehiculo


# ============================================================
#  REGISTRO (Fase 4) — abrir cuenta: taller + primer admin juntos
#  Reemplaza al viejo POST /talleres (que dejaba talleres sin dueño
#  y permitía que un extraño se colara como "primer usuario").
# ============================================================
@app.post("/registro")
def registrar_taller(datos: schemas.RegistroTaller, db: Session = Depends(get_db)):
    """
    Crea el taller, su administrador y las reglas diésel por defecto en UNA
    sola operación. Devuelve el token: el admin queda logueado de inmediato.
    """
    if db.query(models.Taller).filter(models.Taller.email == datos.taller_email).first():
        raise HTTPException(status_code=409, detail="Ya existe un taller con ese correo")
    if db.query(models.Usuario).filter(models.Usuario.email == datos.admin_email).first():
        raise HTTPException(status_code=409, detail="Ese correo de usuario ya está en uso")

    taller = models.Taller(nombre=datos.taller_nombre, email=datos.taller_email)
    db.add(taller)
    db.flush()  # asigna taller.id sin cerrar la transacción todavía

    admin = models.Usuario(
        taller_id=taller.id,
        nombre=datos.admin_nombre,
        email=datos.admin_email,
        clave_hash=security.cifrar_clave(datos.admin_clave),
        rol="admin",
    )
    db.add(admin)

    # Reglas diésel de arranque (el taller luego las ajusta a su gusto).
    for nombre, km, meses in mantenimiento.INTERVALOS_DIESEL_POR_DEFECTO:
        db.add(models.TipoMantenimiento(
            taller_id=taller.id, nombre=nombre,
            intervalo_km=km, intervalo_meses=meses,
        ))
    db.commit()
    db.refresh(admin)

    return {
        "access_token": security.crear_token(admin),
        "token_type": "bearer",
        "nombre": admin.nombre,
        "rol": admin.rol,
        "taller_id": taller.id,
        "taller": taller.nombre,
    }


# ============================================================
#  USUARIOS del taller (el equipo) — solo el admin los gestiona
# ============================================================
@app.get("/talleres/{taller_id}/usuarios", response_model=list[schemas.UsuarioSalida])
def listar_usuarios(taller_id: int, db: Session = Depends(get_db),
                    usuario: models.Usuario = Depends(admin_del_taller)):
    return db.query(models.Usuario).filter(
        models.Usuario.taller_id == taller_id
    ).all()


@app.post("/talleres/{taller_id}/usuarios", response_model=schemas.UsuarioSalida)
def crear_usuario(taller_id: int, datos: schemas.UsuarioCrear,
                  db: Session = Depends(get_db),
                  usuario: models.Usuario = Depends(admin_del_taller)):
    """Solo un admin del MISMO taller agrega personal (el primero nace en /registro)."""
    if db.query(models.Usuario).filter(models.Usuario.email == datos.email).first():
        raise HTTPException(status_code=409, detail="Ese correo ya está en uso")
    nuevo = models.Usuario(
        taller_id=taller_id,
        nombre=datos.nombre,
        email=datos.email,
        clave_hash=security.cifrar_clave(datos.clave),  # ¡se guarda cifrada!
        rol=datos.rol,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


# ------------------------------------------------------------
# FASE 5 — freno a los ataques de fuerza bruta en el login.
# Un atacante prueba miles de contraseñas por minuto; nosotros,
# tras INTENTOS_MAX fallos con un mismo correo, bloqueamos ese
# correo por MINUTOS_BLOQUEO. Vive en memoria: se reinicia con el
# servidor (suficiente para el piloto; con varios servidores se
# movería a la base de datos o a Redis).
# ------------------------------------------------------------
INTENTOS_MAX = 5
MINUTOS_BLOQUEO = 15
_intentos_login: dict[str, list] = {}  # email -> [fallos, bloqueado_hasta]


def _login_bloqueado(email: str) -> bool:
    registro = _intentos_login.get(email)
    return bool(registro and registro[1] and ahora_utc() < registro[1])


def _login_fallido(email: str):
    registro = _intentos_login.setdefault(email, [0, None])
    registro[0] += 1
    if registro[0] >= INTENTOS_MAX:
        registro[1] = ahora_utc() + timedelta(minutes=MINUTOS_BLOQUEO)
        registro[0] = 0  # al vencer el bloqueo, arranca a contar de nuevo


@app.post("/login")
def login(credenciales: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    """
    Login real (Fase 3): valida email y contraseña, y devuelve el TOKEN (JWT)
    que hay que mandar en cada petición: `Authorization: Bearer <token>`.
    Nota: el formulario OAuth2 llama "username" al campo; ahí va el email.
    """
    email = credenciales.username.strip().lower()
    if _login_bloqueado(email):
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos fallidos. Espera {MINUTOS_BLOQUEO} minutos.",
        )

    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == credenciales.username
    ).first()
    if not usuario or not security.verificar_clave(credenciales.password, usuario.clave_hash):
        _login_fallido(email)
        # Mensaje idéntico exista o no el correo: no le regalamos pistas a nadie.
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    _intentos_login.pop(email, None)  # login exitoso: borrón y cuenta nueva
    return {
        "access_token": security.crear_token(usuario),
        "token_type": "bearer",
        "nombre": usuario.nombre,
        "rol": usuario.rol,
        "taller_id": usuario.taller_id,
        "taller": usuario.taller.nombre if usuario.taller else None,
    }


# ------------------------------------------------------------
# Ayudante multi-inquilino: busca un registro POR ID pero SOLO si
# pertenece al taller indicado. Si no existe o es de otro taller,
# responde 404 (sin revelar que el dato existe en otro taller).
# ------------------------------------------------------------
def buscar_en_taller(db: Session, modelo, taller_id: int, registro_id: int):
    registro = db.query(modelo).filter(
        modelo.id == registro_id,
        modelo.taller_id == taller_id,
    ).first()
    if not registro:
        raise HTTPException(status_code=404, detail="No encontrado en este taller")
    return registro


# ------------------------------------------------------------
# Ayudante de edición parcial: copia al registro SOLO los campos
# que el usuario envió (los que no mandó quedan como estaban).
# ------------------------------------------------------------
def aplicar_cambios(registro, datos):
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(registro, campo, valor)


# ============================================================
#  CLIENTES
# ============================================================
@app.post("/talleres/{taller_id}/clientes", response_model=schemas.ClienteSalida)
def crear_cliente(taller_id: int, datos: schemas.ClienteCrear, db: Session = Depends(get_db),
                  usuario: models.Usuario = Depends(usuario_del_taller)):
    # FASE 5 (Habeas Data): sin la autorización del cliente no se registra.
    # La Ley 1581/2012 exige consentimiento previo e informado para guardar
    # datos personales (nombre, teléfono, correo).
    if not datos.consentimiento:
        raise HTTPException(
            status_code=422,
            detail="Debes confirmar que el cliente autorizó el tratamiento de sus datos",
        )
    cliente = models.Cliente(
        taller_id=taller_id,
        nombre=datos.nombre,
        email=datos.email,
        telefono=datos.telefono,
        consentimiento_en=ahora_utc(),  # queda constancia de CUÁNDO autorizó
    )
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@app.get("/talleres/{taller_id}/clientes", response_model=list[schemas.ClienteSalida])
def listar_clientes(taller_id: int, db: Session = Depends(get_db),
                    usuario: models.Usuario = Depends(usuario_del_taller)):
    return db.query(models.Cliente).filter(models.Cliente.taller_id == taller_id).all()


@app.get("/talleres/{taller_id}/clientes/{cliente_id}", response_model=schemas.ClienteSalida)
def ver_cliente(taller_id: int, cliente_id: int, db: Session = Depends(get_db),
                usuario: models.Usuario = Depends(usuario_del_taller)):
    return buscar_en_taller(db, models.Cliente, taller_id, cliente_id)


@app.patch("/talleres/{taller_id}/clientes/{cliente_id}", response_model=schemas.ClienteSalida)
def editar_cliente(taller_id: int, cliente_id: int, datos: schemas.ClienteActualizar,
                   db: Session = Depends(get_db),
                   usuario: models.Usuario = Depends(usuario_del_taller)):
    """Edición parcial: envía solo los campos que quieras cambiar."""
    cliente = buscar_en_taller(db, models.Cliente, taller_id, cliente_id)
    aplicar_cambios(cliente, datos)
    db.commit()
    db.refresh(cliente)
    return cliente


# ============================================================
#  VEHÍCULOS
# ============================================================
@app.post("/talleres/{taller_id}/vehiculos", response_model=schemas.VehiculoSalida)
def crear_vehiculo(taller_id: int, datos: schemas.VehiculoCrear, db: Session = Depends(get_db),
                   usuario: models.Usuario = Depends(usuario_del_taller)):
    # El dueño debe ser un cliente DE ESTE taller.
    buscar_en_taller(db, models.Cliente, taller_id, datos.cliente_id)
    # Una placa no puede existir dos veces en el mismo taller.
    placa = datos.placa.strip().upper()
    if db.query(models.Vehiculo).filter(
        models.Vehiculo.taller_id == taller_id,
        models.Vehiculo.placa == placa,
    ).first():
        raise HTTPException(status_code=409, detail=f"La placa {placa} ya está registrada en este taller")
    datos.placa = placa
    vehiculo = models.Vehiculo(taller_id=taller_id, **datos.model_dump())
    db.add(vehiculo)
    db.flush()  # asigna vehiculo.id sin cerrar la transacción todavía

    # Guardamos la PRIMERA lectura como un ingreso: así el motor de
    # recordatorios siempre sabe desde dónde arrancó el odómetro, aunque
    # km_actual se sobrescriba en visitas futuras.
    db.add(models.Ingreso(
        vehiculo_id=vehiculo.id,
        kilometraje=vehiculo.km_actual,
        descripcion="Registro inicial del vehículo",
    ))
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


@app.get("/talleres/{taller_id}/vehiculos", response_model=list[schemas.VehiculoSalida])
def listar_vehiculos(taller_id: int, db: Session = Depends(get_db),
                     usuario: models.Usuario = Depends(usuario_del_taller)):
    # Filtramos por taller_id: la base del aislamiento multi-inquilino.
    return db.query(models.Vehiculo).filter(models.Vehiculo.taller_id == taller_id).all()


@app.get("/talleres/{taller_id}/vehiculos/{vehiculo_id}", response_model=schemas.VehiculoSalida)
def ver_vehiculo(taller_id: int, vehiculo_id: int, db: Session = Depends(get_db),
                 usuario: models.Usuario = Depends(usuario_del_taller)):
    return buscar_en_taller(db, models.Vehiculo, taller_id, vehiculo_id)


@app.patch("/talleres/{taller_id}/vehiculos/{vehiculo_id}", response_model=schemas.VehiculoSalida)
def editar_vehiculo(taller_id: int, vehiculo_id: int, datos: schemas.VehiculoActualizar,
                    db: Session = Depends(get_db),
                    usuario: models.Usuario = Depends(usuario_del_taller)):
    """
    Edita los datos básicos del vehículo. El kilometraje NO se toca aquí:
    se actualiza registrando un ingreso (así queda historial confiable).
    """
    vehiculo = buscar_en_taller(db, models.Vehiculo, taller_id, vehiculo_id)
    # Si cambian el dueño, verificamos que el nuevo cliente sea DEL MISMO taller.
    if datos.cliente_id is not None:
        buscar_en_taller(db, models.Cliente, taller_id, datos.cliente_id)
    # Si cambian la placa, que no choque con otro vehículo del taller.
    if datos.placa is not None:
        datos.placa = datos.placa.strip().upper()
        choque = db.query(models.Vehiculo).filter(
            models.Vehiculo.taller_id == taller_id,
            models.Vehiculo.placa == datos.placa,
            models.Vehiculo.id != vehiculo_id,
        ).first()
        if choque:
            raise HTTPException(status_code=409,
                                detail=f"La placa {datos.placa} ya está registrada en este taller")
    aplicar_cambios(vehiculo, datos)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


# ============================================================
#  TIPOS DE MANTENIMIENTO (las reglas, configurables por taller)
# ============================================================
@app.get("/talleres/{taller_id}/tipos-mantenimiento",
         response_model=list[schemas.TipoMantenimientoSalida])
def listar_tipos(taller_id: int, db: Session = Depends(get_db),
                 usuario: models.Usuario = Depends(usuario_del_taller)):
    return db.query(models.TipoMantenimiento).filter(
        models.TipoMantenimiento.taller_id == taller_id
    ).all()


@app.post("/talleres/{taller_id}/tipos-mantenimiento",
          response_model=schemas.TipoMantenimientoSalida)
def crear_tipo(taller_id: int, datos: schemas.TipoMantenimientoCrear,
               db: Session = Depends(get_db),
               usuario: models.Usuario = Depends(admin_del_taller)):
    """Cada taller puede agregar sus propias reglas (ej. 'Correa de repartición')."""
    if datos.intervalo_km is None and datos.intervalo_meses is None:
        raise HTTPException(
            status_code=422,
            detail="Define al menos un intervalo (km o meses); si no, nunca se avisaría.",
        )
    tipo = models.TipoMantenimiento(taller_id=taller_id, **datos.model_dump())
    db.add(tipo)
    db.commit()
    db.refresh(tipo)
    return tipo


@app.patch("/talleres/{taller_id}/tipos-mantenimiento/{tipo_id}",
           response_model=schemas.TipoMantenimientoSalida)
def editar_tipo(taller_id: int, tipo_id: int, datos: schemas.TipoMantenimientoActualizar,
                db: Session = Depends(get_db),
                usuario: models.Usuario = Depends(admin_del_taller)):
    """Ajusta los intervalos según el taller piloto o el manual del fabricante."""
    tipo = buscar_en_taller(db, models.TipoMantenimiento, taller_id, tipo_id)
    aplicar_cambios(tipo, datos)
    if tipo.intervalo_km is None and tipo.intervalo_meses is None:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail="Debe quedar al menos un intervalo (km o meses).",
        )
    db.commit()
    db.refresh(tipo)
    return tipo


@app.delete("/talleres/{taller_id}/tipos-mantenimiento/{tipo_id}")
def eliminar_tipo(taller_id: int, tipo_id: int, db: Session = Depends(get_db),
                  usuario: models.Usuario = Depends(admin_del_taller)):
    """
    Elimina una regla del taller, PERO solo si nunca se ha usado en un
    ingreso: borrarla rompería el historial de los vehículos.
    """
    tipo = buscar_en_taller(db, models.TipoMantenimiento, taller_id, tipo_id)
    en_uso = db.query(models.MantenimientoRealizado).filter(
        models.MantenimientoRealizado.tipo_id == tipo_id
    ).first()
    if en_uso:
        raise HTTPException(
            status_code=409,
            detail="Este tipo ya se usó en ingresos; no se puede eliminar sin perder historial.",
        )
    db.delete(tipo)
    db.commit()
    return {"mensaje": f"Tipo '{tipo.nombre}' eliminado"}


# ============================================================
#  INGRESOS (visitas al taller) — actualiza el km del vehículo
# ============================================================
@app.post("/ingresos", response_model=schemas.IngresoSalida)
def registrar_ingreso(datos: schemas.IngresoCrear, db: Session = Depends(get_db),
                      usuario: models.Usuario = Depends(usuario_actual)):
    # Solo se pueden registrar ingresos de vehículos del taller del usuario.
    vehiculo = vehiculo_del_usuario(db, datos.vehiculo_id, usuario)

    # El odómetro no rueda hacia atrás: un km menor al último registrado es
    # un error de digitación (100 en vez de 100100) y dañaría la estimación.
    if datos.kilometraje < vehiculo.km_actual:
        raise HTTPException(
            status_code=422,
            detail=f"El kilometraje ({datos.kilometraje:,}) no puede ser menor al último "
                   f"registrado ({vehiculo.km_actual:,}). ¿Error de digitación?",
        )

    # Los mantenimientos marcados deben ser reglas DE ESTE taller (regla #1).
    if datos.tipos_realizados:
        propios = {
            t.id for t in db.query(models.TipoMantenimiento.id).filter(
                models.TipoMantenimiento.taller_id == usuario.taller_id,
                models.TipoMantenimiento.id.in_(datos.tipos_realizados),
            )
        }
        ajenos = set(datos.tipos_realizados) - propios
        if ajenos:
            raise HTTPException(status_code=422,
                                detail="Hay tipos de mantenimiento que no existen en este taller")

    # 1) Creamos el ingreso.
    ingreso = models.Ingreso(
        vehiculo_id=datos.vehiculo_id,
        kilometraje=datos.kilometraje,
        descripcion=datos.descripcion,
    )
    db.add(ingreso)
    db.commit()
    db.refresh(ingreso)

    # 2) Registramos qué mantenimientos se hicieron en esta visita.
    for tipo_id in datos.tipos_realizados:
        db.add(models.MantenimientoRealizado(ingreso_id=ingreso.id, tipo_id=tipo_id))

    # 3) Actualizamos el kilometraje del vehículo (dato confiable del taller).
    vehiculo.km_actual = datos.kilometraje
    vehiculo.fecha_km = ingreso.fecha
    db.commit()
    db.refresh(ingreso)
    return ingreso


@app.get("/vehiculos/{vehiculo_id}/ingresos", response_model=list[schemas.IngresoSalida])
def historial_vehiculo(vehiculo_id: int, db: Session = Depends(get_db),
                       usuario: models.Usuario = Depends(usuario_actual)):
    """Historial de visitas del vehículo, de la más reciente a la más antigua."""
    vehiculo = vehiculo_del_usuario(db, vehiculo_id, usuario)
    return db.query(models.Ingreso).filter(
        models.Ingreso.vehiculo_id == vehiculo_id
    ).order_by(models.Ingreso.fecha.desc()).all()


# ============================================================
#  RECORDATORIOS — aquí corre el "cerebro" del producto
# ============================================================
@app.get("/vehiculos/{vehiculo_id}/recordatorios")
def recordatorios_vehiculo(vehiculo_id: int, db: Session = Depends(get_db),
                           usuario: models.Usuario = Depends(usuario_actual)):
    """
    Devuelve el estado de cada mantenimiento del vehículo:
    vencido / próximo / al día, con el km estimado de hoy.
    """
    vehiculo = vehiculo_del_usuario(db, vehiculo_id, usuario)

    # Toda la lógica vive en mantenimiento.calcular_recordatorios, la misma
    # que usa el envío de correos. Un solo cerebro, cero duplicación.
    resultados = mantenimiento.calcular_recordatorios(db, vehiculo)

    return {
        "vehiculo": vehiculo.placa,
        "km_registrado": vehiculo.km_actual,
        "mantenimientos": resultados,
    }


@app.get("/talleres/{taller_id}/recordatorios")
def recordatorios_taller(taller_id: int, db: Session = Depends(get_db),
                         usuario: models.Usuario = Depends(usuario_del_taller)):
    """
    El TABLERO del taller: recorre todos sus vehículos y devuelve solo los
    que tienen algo vencido o próximo. Es lo primero que el taller quiere
    ver cada mañana: '¿a quién hay que llamar hoy?'
    """
    vehiculos = db.query(models.Vehiculo).filter(
        models.Vehiculo.taller_id == taller_id
    ).all()

    tablero = []
    for vehiculo in vehiculos:
        resultados = mantenimiento.calcular_recordatorios(db, vehiculo)
        pendientes = [r for r in resultados if r["estado"] in ("vencido", "proximo")]
        if pendientes:
            tablero.append({
                "vehiculo_id": vehiculo.id,
                "placa": vehiculo.placa,
                "cliente": vehiculo.cliente.nombre if vehiculo.cliente else None,
                "telefono": vehiculo.cliente.telefono if vehiculo.cliente else None,
                "pendientes": pendientes,
            })

    return {"total_vehiculos": len(vehiculos), "con_pendientes": len(tablero), "tablero": tablero}


# ============================================================
#  FASE 2 — Envío de recordatorios por correo
# ============================================================
@app.post("/talleres/{taller_id}/enviar-recordatorios")
def enviar_recordatorios(taller_id: int, db: Session = Depends(get_db),
                         usuario: models.Usuario = Depends(usuario_del_taller)):
    """
    Revisa todos los vehículos del taller y envía los correos que toquen.
    Se puede llamar a mano desde /docs, y el script enviar_recordatorios.py
    hace lo mismo de forma programada (tarea diaria).
    """
    taller = db.get(models.Taller, taller_id)
    if not taller:
        raise HTTPException(status_code=404, detail="Taller no encontrado")
    return notificaciones.enviar_recordatorios_taller(db, taller)


# ============================================================
#  FASE 3 — PORTAL DEL CLIENTE (el dueño del carro)
#  El cliente NO tiene contraseña: entra con su enlace secreto
#  (token_acceso), que el taller le comparte por WhatsApp o correo.
# ============================================================
@app.get("/talleres/{taller_id}/clientes/{cliente_id}/enlace-portal")
def enlace_portal(taller_id: int, cliente_id: int, db: Session = Depends(get_db),
                  usuario: models.Usuario = Depends(usuario_del_taller)):
    """El taller consulta aquí el enlace para compartírselo al cliente."""
    cliente = buscar_en_taller(db, models.Cliente, taller_id, cliente_id)
    if not cliente.token_acceso:
        raise HTTPException(status_code=410, detail="Este cliente pidió la supresión de sus datos")
    return {
        "cliente": cliente.nombre,
        "token": cliente.token_acceso,
        "ruta": f"/app/?t={cliente.token_acceso}",
        "nota": "Comparte este enlace SOLO con el cliente: quien lo tenga ve sus datos.",
    }


@app.delete("/talleres/{taller_id}/clientes/{cliente_id}/datos-personales")
def suprimir_datos_cliente(taller_id: int, cliente_id: int,
                           db: Session = Depends(get_db),
                           usuario: models.Usuario = Depends(admin_del_taller)):
    """
    FASE 5 (Habeas Data) — derecho a SUPRESIÓN: si el cliente pide que
    borren sus datos, la ley obliga a hacerlo. Estrategia: ANONIMIZAR.

    - Se borran los datos personales (nombre, correo, teléfono) y las
      suscripciones push, y se anula el enlace del portal.
    - El historial técnico del VEHÍCULO se conserva: son registros de la
      operación del taller (qué se le hizo a qué carro), no identifican a
      la persona, y borrarlos destruiría la trazabilidad del negocio.
    """
    cliente = buscar_en_taller(db, models.Cliente, taller_id, cliente_id)

    db.query(models.SuscripcionPush).filter(
        models.SuscripcionPush.cliente_id == cliente.id
    ).delete()

    cliente.nombre = "(datos suprimidos)"
    cliente.email = None
    cliente.telefono = None
    cliente.token_acceso = None       # el enlace del portal muere aquí
    cliente.consentimiento_en = None
    db.commit()

    return {
        "mensaje": "Datos personales suprimidos. El historial técnico de los "
                   "vehículos se conserva de forma anónima.",
    }


@app.post("/talleres/{taller_id}/clientes/{cliente_id}/regenerar-token")
def regenerar_token(taller_id: int, cliente_id: int, db: Session = Depends(get_db),
                    usuario: models.Usuario = Depends(admin_del_taller)):
    """
    Genera un enlace de portal NUEVO para el cliente y anula el anterior.
    Útil si el enlace se filtró (lo vio alguien que no debía) o el cliente
    perdió el celular. El enlace viejo deja de funcionar al instante.
    """
    cliente = buscar_en_taller(db, models.Cliente, taller_id, cliente_id)
    if not cliente.token_acceso:
        raise HTTPException(status_code=410, detail="Este cliente pidió la supresión de sus datos")
    cliente.token_acceso = token_portal()
    db.commit()
    return {
        "cliente": cliente.nombre,
        "token": cliente.token_acceso,
        "ruta": f"/app/?t={cliente.token_acceso}",
        "nota": "El enlace anterior quedó anulado. Comparte este nuevo solo con el cliente.",
    }


# Ayudante del portal: encuentra al cliente por su token o responde 404.
def cliente_por_token(db: Session, token_acceso: str) -> models.Cliente:
    cliente = db.query(models.Cliente).filter(
        models.Cliente.token_acceso == token_acceso
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Enlace inválido")
    return cliente


@app.post("/portal/{token_acceso}/clave")
def crear_clave_portal(token_acceso: str, datos: schemas.PortalClave,
                       db: Session = Depends(get_db)):
    """
    MVP CLIENTE: desde su enlace secreto, el cliente crea su contraseña.
    Desde entonces puede entrar en /app/ con correo + contraseña, sin
    necesitar el enlace. (También sirve para cambiarla.)
    """
    cliente = cliente_por_token(db, token_acceso)
    if not cliente.email:
        raise HTTPException(
            status_code=422,
            detail="Pídele al taller que registre tu correo primero: será tu usuario.",
        )
    cliente.clave_hash = security.cifrar_clave(datos.clave)
    db.commit()
    return {"mensaje": f"Listo. Ya puedes entrar con {cliente.email} y tu contraseña."}


@app.post("/portal-login")
def login_portal(datos: schemas.PortalLogin, db: Session = Depends(get_db)):
    """
    Login del dueño del carro. Si el correo y la contraseña cuadran,
    devuelve su token del portal (la misma llave del enlace secreto: la PWA
    funciona igual sin importar cómo entró). Usa el mismo freno anti
    fuerza bruta del login del taller.
    """
    email = datos.email.strip().lower()
    if _login_bloqueado("portal:" + email):
        raise HTTPException(status_code=429,
                            detail=f"Demasiados intentos fallidos. Espera {MINUTOS_BLOQUEO} minutos.")

    # El correo de un cliente puede repetirse entre talleres distintos:
    # probamos la contraseña contra cada candidato que tenga clave creada.
    candidatos = db.query(models.Cliente).filter(
        models.Cliente.email == datos.email,
        models.Cliente.clave_hash.isnot(None),
        models.Cliente.token_acceso.isnot(None),
    ).all()
    for cliente in candidatos:
        if security.verificar_clave(datos.clave, cliente.clave_hash):
            _intentos_login.pop("portal:" + email, None)
            return {"token_acceso": cliente.token_acceso}

    _login_fallido("portal:" + email)
    raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")


@app.get("/portal/{token_acceso}/citas")
def citas_portal(token_acceso: str, db: Session = Depends(get_db)):
    """Las citas del cliente, la más reciente primero."""
    cliente = cliente_por_token(db, token_acceso)
    citas = db.query(models.Cita).filter(
        models.Cita.cliente_id == cliente.id
    ).order_by(models.Cita.creado_en.desc()).all()
    return [{
        "id": c.id,
        "placa": c.vehiculo.placa if c.vehiculo else "?",
        "fecha": c.fecha,
        "nota": c.nota,
        "estado": c.estado,
    } for c in citas]


@app.post("/portal/{token_acceso}/citas")
def pedir_cita(token_acceso: str, datos: schemas.CitaCrear,
               db: Session = Depends(get_db)):
    """
    MVP CLIENTE: el dueño pide una cita para SU vehículo. Nace en estado
    "solicitada"; el taller la confirma desde el panel.
    """
    cliente = cliente_por_token(db, token_acceso)
    vehiculo = db.get(models.Vehiculo, datos.vehiculo_id)
    if not vehiculo or vehiculo.cliente_id != cliente.id:
        raise HTTPException(status_code=404, detail="Ese vehículo no es tuyo")

    # Máximo una solicitud pendiente por vehículo: evita el botón repetido.
    pendiente = db.query(models.Cita).filter(
        models.Cita.vehiculo_id == vehiculo.id,
        models.Cita.estado.in_(["solicitada", "confirmada"]),
    ).first()
    if pendiente:
        raise HTTPException(
            status_code=409,
            detail=f"Ya tienes una cita {pendiente.estado} para este vehículo (el {pendiente.fecha}).",
        )

    cita = models.Cita(
        taller_id=vehiculo.taller_id,
        cliente_id=cliente.id,
        vehiculo_id=vehiculo.id,
        fecha=datos.fecha,
        nota=datos.nota,
    )
    db.add(cita)
    db.commit()
    db.refresh(cita)
    # Avisamos al personal (push + correo). Si falla, la cita igual quedó.
    notificaciones.notificar_cita_al_taller(db, cita)
    return {"mensaje": f"Cita solicitada para el {datos.fecha}. El taller te confirmará."}


@app.post("/portal/{token_acceso}/kilometraje")
def reportar_kilometraje(token_acceso: str, datos: schemas.KilometrajeReportado,
                         db: Session = Depends(get_db)):
    """
    El dueño reporta el km que marca su odómetro HOY. Afina la estimación
    entre visitas (el taller sigue siendo la fuente en cada ingreso).
    Se guarda como un ingreso etiquetado, así alimenta el promedio km/mes.
    """
    cliente = cliente_por_token(db, token_acceso)
    vehiculo = db.get(models.Vehiculo, datos.vehiculo_id)
    if not vehiculo or vehiculo.cliente_id != cliente.id:
        raise HTTPException(status_code=404, detail="Ese vehículo no es tuyo")

    # El odómetro no rueda hacia atrás (mismo criterio que el taller).
    if datos.kilometraje < vehiculo.km_actual:
        raise HTTPException(
            status_code=422,
            detail=f"Ese kilometraje ({datos.kilometraje:,}) es menor al último "
                   f"registrado ({vehiculo.km_actual:,}). Revisa el número.",
        )
    # Salto imposible = casi seguro un dígito de más.
    if datos.kilometraje > vehiculo.km_actual + 150000:
        raise HTTPException(
            status_code=422,
            detail="Ese salto de kilometraje parece un error de digitación. Revisa el número.",
        )

    db.add(models.Ingreso(
        vehiculo_id=vehiculo.id,
        kilometraje=datos.kilometraje,
        descripcion="Kilometraje reportado por el dueño",
    ))
    vehiculo.km_actual = datos.kilometraje
    vehiculo.fecha_km = ahora_utc()
    db.commit()
    return {"mensaje": f"Listo, guardamos {datos.kilometraje:,} km. ¡Gracias por avisarnos!"}


@app.get("/portal/{token_acceso}")
def datos_portal(token_acceso: str, db: Session = Depends(get_db)):
    """
    Lo que ve el dueño del carro en su PWA: sus vehículos, el estado de cada
    mantenimiento y su historial. Público pero inadivinable: el token es la llave.
    """
    cliente = cliente_por_token(db, token_acceso)

    vehiculos = []
    for vehiculo in cliente.vehiculos:
        resultados = mantenimiento.calcular_recordatorios(db, vehiculo)
        historial = db.query(models.Ingreso).filter(
            models.Ingreso.vehiculo_id == vehiculo.id
        ).order_by(models.Ingreso.fecha.desc()).limit(10).all()
        vehiculos.append({
            "vehiculo_id": vehiculo.id,
            "placa": vehiculo.placa,
            "marca": vehiculo.marca,
            "modelo": vehiculo.modelo,
            "km_registrado": vehiculo.km_actual,
            "mantenimientos": resultados,
            "historial": [
                {"fecha": i.fecha.date().isoformat(), "kilometraje": i.kilometraje,
                 "descripcion": i.descripcion}
                for i in historial
            ],
        })

    llaves = notificaciones.llaves_push()
    return {
        "cliente": cliente.nombre,
        "taller": cliente.taller.nombre if cliente.taller else None,
        # La llave pública VAPID: el navegador la necesita para suscribirse
        # a push. Si es None, el botón de avisos no se muestra en la PWA.
        "push_clave_publica": llaves["publica"] if llaves else None,
        # MVP cliente: para que la PWA sepa si ofrecer "crear contraseña".
        "tiene_clave": bool(cliente.clave_hash),
        "tiene_email": bool(cliente.email),
        "vehiculos": vehiculos,
    }


# ============================================================
#  CITAS — el lado del TALLER (gestionarlas desde el panel)
# ============================================================
@app.get("/talleres/{taller_id}/citas")
def listar_citas(taller_id: int, db: Session = Depends(get_db),
                 usuario: models.Usuario = Depends(usuario_del_taller)):
    """Todas las citas del taller: primero las solicitadas (por atender)."""
    citas = db.query(models.Cita).filter(
        models.Cita.taller_id == taller_id
    ).order_by(models.Cita.creado_en.desc()).all()
    orden = {"solicitada": 0, "confirmada": 1, "atendida": 2, "cancelada": 3}
    citas.sort(key=lambda c: orden.get(c.estado, 9))
    return [{
        "id": c.id,
        "fecha": c.fecha,
        "nota": c.nota,
        "estado": c.estado,
        "placa": c.vehiculo.placa if c.vehiculo else "?",
        "cliente": c.cliente.nombre if c.cliente else "?",
        "telefono": c.cliente.telefono if c.cliente else None,
        "creado_en": c.creado_en,
    } for c in citas]


@app.patch("/talleres/{taller_id}/citas/{cita_id}")
def cambiar_estado_cita(taller_id: int, cita_id: int, datos: schemas.CitaEstado,
                        db: Session = Depends(get_db),
                        usuario: models.Usuario = Depends(usuario_del_taller)):
    """Confirmar, atender o cancelar una cita (cualquier usuario del taller)."""
    cita = buscar_en_taller(db, models.Cita, taller_id, cita_id)
    cita.estado = datos.estado
    db.commit()
    db.refresh(cita)
    # Avisamos al dueño del carro (push + correo). Si falla, el cambio quedó.
    notificaciones.notificar_cita_al_cliente(db, cita)
    return {"mensaje": f"Cita marcada como {datos.estado}"}


@app.post("/talleres/{taller_id}/push-movil")
def activar_push_personal(taller_id: int, datos: schemas.PushMovil,
                          db: Session = Depends(get_db),
                          usuario: models.Usuario = Depends(usuario_del_taller)):
    """
    APP MÓVIL (modo taller): el celular de un empleado/admin registra su
    push token de Expo para enterarse cuando un cliente pida una cita.
    """
    existente = db.query(models.SuscripcionPushPersonal).filter(
        models.SuscripcionPushPersonal.endpoint == datos.expo_token
    ).first()
    if existente:
        existente.usuario_id = usuario.id  # el celular cambió de dueño
    else:
        db.add(models.SuscripcionPushPersonal(
            usuario_id=usuario.id,
            endpoint=datos.expo_token,
            tipo="expo",
        ))
    db.commit()
    return {"mensaje": "Este celular recibirá las citas nuevas del taller"}


@app.delete("/talleres/{taller_id}/push-movil")
def desactivar_push_personal(taller_id: int, datos: schemas.PushMovil,
                             db: Session = Depends(get_db),
                             usuario: models.Usuario = Depends(usuario_del_taller)):
    """APP MÓVIL (modo taller): apagar los avisos de citas en este celular."""
    db.query(models.SuscripcionPushPersonal).filter(
        models.SuscripcionPushPersonal.usuario_id == usuario.id,
        models.SuscripcionPushPersonal.endpoint == datos.expo_token,
    ).delete()
    db.commit()
    return {"mensaje": "Avisos de citas desactivados en este celular"}


@app.post("/portal/{token_acceso}/push")
def activar_push(token_acceso: str, suscripcion: schemas.SuscripcionPushCrear,
                 db: Session = Depends(get_db)):
    """
    El navegador del cliente manda aquí su suscripción push (su "dirección
    de entrega" de notificaciones). La guardamos ligada al cliente.
    """
    cliente = db.query(models.Cliente).filter(
        models.Cliente.token_acceso == token_acceso
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Enlace inválido")

    # Si este dispositivo ya estaba suscrito, actualizamos en vez de duplicar.
    existente = db.query(models.SuscripcionPush).filter(
        models.SuscripcionPush.endpoint == suscripcion.endpoint
    ).first()
    if existente:
        existente.cliente_id = cliente.id
        existente.p256dh = suscripcion.p256dh
        existente.auth = suscripcion.auth
    else:
        db.add(models.SuscripcionPush(
            cliente_id=cliente.id,
            endpoint=suscripcion.endpoint,
            p256dh=suscripcion.p256dh,
            auth=suscripcion.auth,
        ))
    db.commit()
    return {"mensaje": "Avisos activados en este dispositivo"}


@app.delete("/portal/{token_acceso}/push")
def desactivar_push(token_acceso: str, datos: schemas.SuscripcionPushEliminar,
                    db: Session = Depends(get_db)):
    """El cliente apaga los avisos: borramos la suscripción de ese dispositivo."""
    cliente = db.query(models.Cliente).filter(
        models.Cliente.token_acceso == token_acceso
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Enlace inválido")
    db.query(models.SuscripcionPush).filter(
        models.SuscripcionPush.cliente_id == cliente.id,
        models.SuscripcionPush.endpoint == datos.endpoint,
    ).delete()
    db.commit()
    return {"mensaje": "Avisos desactivados en este dispositivo"}


@app.post("/portal/{token_acceso}/push-movil")
def activar_push_movil(token_acceso: str, datos: schemas.PushMovil,
                       db: Session = Depends(get_db)):
    """
    APP MÓVIL: el celular manda su push token de Expo (su "dirección de
    entrega"). Lo guardamos en la misma tabla de suscripciones, marcado
    con tipo="expo" para que el envío diario sepa por dónde avisarle.
    """
    cliente = cliente_por_token(db, token_acceso)

    # Si este celular ya estaba registrado, lo re-ligamos (p. ej. si otro
    # miembro de la familia entra en el mismo teléfono) en vez de duplicar.
    existente = db.query(models.SuscripcionPush).filter(
        models.SuscripcionPush.endpoint == datos.expo_token
    ).first()
    if existente:
        existente.cliente_id = cliente.id
        existente.tipo = "expo"
    else:
        db.add(models.SuscripcionPush(
            cliente_id=cliente.id,
            endpoint=datos.expo_token,
            p256dh="",  # Expo no usa llaves de cifrado del navegador
            auth="",
            tipo="expo",
        ))
    db.commit()
    return {"mensaje": "Avisos activados en este celular"}


@app.delete("/portal/{token_acceso}/push-movil")
def desactivar_push_movil(token_acceso: str, datos: schemas.PushMovil,
                          db: Session = Depends(get_db)):
    """APP MÓVIL: apagar los avisos de este celular (o al cerrar sesión)."""
    cliente = cliente_por_token(db, token_acceso)
    db.query(models.SuscripcionPush).filter(
        models.SuscripcionPush.cliente_id == cliente.id,
        models.SuscripcionPush.endpoint == datos.expo_token,
    ).delete()
    db.commit()
    return {"mensaje": "Avisos desactivados en este celular"}


# La PWA (HTML, manifest, service worker) se sirve como archivos estáticos
# en /app. Es la "app" que el cliente puede instalar en su celular.
CARPETA_PORTAL = Path(__file__).resolve().parent.parent / "portal"
app.mount("/app", StaticFiles(directory=str(CARPETA_PORTAL), html=True), name="portal")

# FASE 4: el PANEL del personal del taller (login, tablero, clientes,
# vehículos, ingresos y reglas). También son archivos estáticos: el HTML
# habla con esta misma API usando el token JWT del login.
CARPETA_PANEL = Path(__file__).resolve().parent.parent / "panel"
app.mount("/panel", StaticFiles(directory=str(CARPETA_PANEL), html=True), name="panel")
