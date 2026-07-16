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

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas, security, mantenimiento, notificaciones
from .database import engine, get_db

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
# Variante que NO exige token (la usamos solo para crear el primer usuario).
esquema_oauth2_opcional = OAuth2PasswordBearer(tokenUrl="/login", auto_error=False)


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


def vehiculo_del_usuario(db: Session, vehiculo_id: int,
                         usuario: models.Usuario) -> models.Vehiculo:
    """Trae un vehículo SOLO si pertenece al taller del usuario autenticado."""
    vehiculo = db.get(models.Vehiculo, vehiculo_id)
    if not vehiculo or vehiculo.taller_id != usuario.taller_id:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return vehiculo


# ============================================================
#  TALLERES  (cada taller es un 'inquilino' del sistema)
# ============================================================
@app.post("/talleres", response_model=schemas.TallerSalida)
def crear_taller(datos: schemas.TallerCrear, db: Session = Depends(get_db)):
    taller = models.Taller(nombre=datos.nombre, email=datos.email)
    db.add(taller)
    db.commit()
    db.refresh(taller)

    # Al crear un taller, le cargamos los intervalos diésel por defecto.
    for nombre, km, meses in mantenimiento.INTERVALOS_DIESEL_POR_DEFECTO:
        db.add(models.TipoMantenimiento(
            taller_id=taller.id, nombre=nombre,
            intervalo_km=km, intervalo_meses=meses,
        ))
    db.commit()
    return taller


# ============================================================
#  USUARIOS del taller (personal) + login básico
# ============================================================
@app.post("/talleres/{taller_id}/usuarios", response_model=schemas.UsuarioSalida)
def crear_usuario(taller_id: int, datos: schemas.UsuarioCrear,
                  db: Session = Depends(get_db),
                  token: Optional[str] = Depends(esquema_oauth2_opcional)):
    """
    Crea personal del taller, con una regla de arranque:
    - Si el taller AÚN NO tiene usuarios, cualquiera puede crear el primero
      (es el registro inicial del admin).
    - Si ya tiene, SOLO un admin de ese mismo taller puede agregar más.
    """
    taller = db.get(models.Taller, taller_id)
    if not taller:
        raise HTTPException(status_code=404, detail="Taller no encontrado")

    ya_hay_usuarios = db.query(models.Usuario).filter(
        models.Usuario.taller_id == taller_id
    ).first() is not None

    if ya_hay_usuarios:
        datos_token = security.leer_token(token) if token else None
        if (not datos_token or datos_token["taller_id"] != taller_id
                or datos_token["rol"] != "admin"):
            raise HTTPException(
                status_code=403,
                detail="Solo un admin de este taller puede crear más usuarios",
            )

    usuario = models.Usuario(
        taller_id=taller_id,
        nombre=datos.nombre,
        email=datos.email,
        clave_hash=security.cifrar_clave(datos.clave),  # ¡se guarda cifrada!
        rol=datos.rol,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@app.post("/login")
def login(credenciales: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    """
    Login real (Fase 3): valida email y contraseña, y devuelve el TOKEN (JWT)
    que hay que mandar en cada petición: `Authorization: Bearer <token>`.
    Nota: el formulario OAuth2 llama "username" al campo; ahí va el email.
    """
    usuario = db.query(models.Usuario).filter(
        models.Usuario.email == credenciales.username
    ).first()
    if not usuario or not security.verificar_clave(credenciales.password, usuario.clave_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return {
        "access_token": security.crear_token(usuario),
        "token_type": "bearer",
        "nombre": usuario.nombre,
        "rol": usuario.rol,
        "taller_id": usuario.taller_id,
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
    cliente = models.Cliente(taller_id=taller_id, **datos.model_dump())
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
    vehiculo = models.Vehiculo(taller_id=taller_id, **datos.model_dump())
    db.add(vehiculo)
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
               usuario: models.Usuario = Depends(usuario_del_taller)):
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
                usuario: models.Usuario = Depends(usuario_del_taller)):
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
                  usuario: models.Usuario = Depends(usuario_del_taller)):
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
    return {
        "cliente": cliente.nombre,
        "token": cliente.token_acceso,
        "ruta": f"/app/?t={cliente.token_acceso}",
        "nota": "Comparte este enlace SOLO con el cliente: quien lo tenga ve sus datos.",
    }


@app.get("/portal/{token_acceso}")
def datos_portal(token_acceso: str, db: Session = Depends(get_db)):
    """
    Lo que ve el dueño del carro en su PWA: sus vehículos, el estado de cada
    mantenimiento y su historial. Público pero inadivinable: el token es la llave.
    """
    cliente = db.query(models.Cliente).filter(
        models.Cliente.token_acceso == token_acceso
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Enlace inválido")

    vehiculos = []
    for vehiculo in cliente.vehiculos:
        resultados = mantenimiento.calcular_recordatorios(db, vehiculo)
        historial = db.query(models.Ingreso).filter(
            models.Ingreso.vehiculo_id == vehiculo.id
        ).order_by(models.Ingreso.fecha.desc()).limit(10).all()
        vehiculos.append({
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
        "vehiculos": vehiculos,
    }


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


# La PWA (HTML, manifest, service worker) se sirve como archivos estáticos
# en /app. Es la "app" que el cliente puede instalar en su celular.
CARPETA_PORTAL = Path(__file__).resolve().parent.parent / "portal"
app.mount("/app", StaticFiles(directory=str(CARPETA_PORTAL), html=True), name="portal")
