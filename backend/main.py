from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from datetime import datetime
from io import BytesIO
from pathlib import Path
import os
import aql
import sheets
import shutil
import database
import auth

import time
import threading as _threading

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", str(Path(__file__).parent / "uploads")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield

app = FastAPI(lifespan=lifespan)

_cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "https://calidad.vbc.mx,http://localhost:3000,http://localhost:8001"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

AQL_LEVELS = [
    "0.065", "0.10", "0.15", "0.25", "0.40", "0.65",
    "1.0", "1.5", "2.5", "4.0", "6.5",
]

INSPECTION_LEVELS = ["I", "II", "III", "S-1", "S-2", "S-3", "S-4"]

COMPANIES = ["VBC", "VBP"]

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)

class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)
    company_access: str = "All"
    can_manage_products: bool = True
    can_edit_pending: bool = True
    can_delete_pending: bool = True
    can_edit_events: bool = True
    can_delete_events: bool = True
    can_set_suggested_action: bool = True
    can_mark_addressed: bool = True
    can_edit_addressed: bool = True
    can_delete_addressed: bool = True
    can_assign: bool = True
    can_manage_users: bool = False

class UserUpdate(BaseModel):
    new_username: str | None = None
    new_password: str | None = None
    company_access: str | None = None
    can_manage_products: bool | None = None
    can_edit_pending: bool | None = None
    can_delete_pending: bool | None = None
    can_edit_events: bool | None = None
    can_delete_events: bool | None = None
    can_set_suggested_action: bool | None = None
    can_mark_addressed: bool | None = None
    can_edit_addressed: bool | None = None
    can_delete_addressed: bool | None = None
    can_assign: bool | None = None
    can_manage_users: bool | None = None

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    inspection_level: str = Field(min_length=1, max_length=10)
    aql_level: str = Field(min_length=1, max_length=10)
    test_details: str = Field(default="", max_length=500)
    supplier: str = Field(default="", max_length=200)
    company: str = "All"
    created_by: str = "user"

class PendingInspectionCreate(BaseModel):
    product_id: int
    direction: str = Field(min_length=1, max_length=50)
    lot_size: int = Field(gt=0)
    estimated_date: str = Field(min_length=1, max_length=20)
    company: str = "All"
    created_by: str = "user"
    assigned_to: str = ""

class EventCreate(BaseModel):
    product_id: int
    direction: str = Field(min_length=1, max_length=50)
    lot_size: int = Field(gt=0)
    quantity_inspected: int = Field(ge=0)
    quantity_non_conforming: int = Field(ge=0)
    date_inspected: str = Field(min_length=1, max_length=20)
    pending_id: int | None = None
    company: str = "All"
    created_by: str = "user"

class EventUpdate(BaseModel):
    product_id: int
    direction: str = Field(min_length=1, max_length=50)
    lot_size: int = Field(gt=0)
    quantity_inspected: int = Field(ge=0)
    quantity_non_conforming: int = Field(ge=0)
    date_inspected: str = Field(min_length=1, max_length=20)


# --- Rate Limiting (login) ---

_login_attempts: dict[str, list[float]] = {}
_login_lock = _threading.Lock()
_LOGIN_LIMIT = 10
_LOGIN_WINDOW = 60  # seconds

def _check_rate_limit(ip: str) -> bool:
    now = time.time()
    with _login_lock:
        attempts = _login_attempts.get(ip, [])
        attempts = [t for t in attempts if now - t < _LOGIN_WINDOW]
        _login_attempts[ip] = attempts
        if len(attempts) >= _LOGIN_LIMIT:
            return False
        attempts.append(now)
        return True


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Auth ---

@app.post("/api/auth/login")
def login(data: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    username = data.username
    password = data.password
    u = database.get_user(username)
    if u and auth.verify_password(password, u["password_hash"]):
        return {
            "token": auth.create_token(username),
            "username": username,
            "is_admin": u["is_admin"],
            "company_access": u["company_access"],
            "can_manage_products": u["can_manage_products"],
            "can_edit_pending": u["can_edit_pending"],
            "can_delete_pending": u["can_delete_pending"],
            "can_edit_events": u["can_edit_events"],
            "can_delete_events": u["can_delete_events"],
            "can_set_suggested_action": u["can_set_suggested_action"],
            "can_mark_addressed": u["can_mark_addressed"],
            "can_edit_addressed": u["can_edit_addressed"],
            "can_delete_addressed": u["can_delete_addressed"],
            "can_assign": u["can_assign"],
            "can_manage_users": u["can_manage_users"],
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")


# --- Protected routes (require JWT) ---

@app.get("/api/users")
def list_users(_user: str = Depends(auth.require_user_manager)):
    return [
        {k: v for k, v in u.items() if k != "password_hash"}
        for u in database.list_users()
    ]

@app.post("/api/users")
def create_user(user: UserCreate, _user: str = Depends(auth.require_user_manager)):
    if database.get_user(user.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    created = database.create_user(
        username=user.username, password=user.password,
        company_access=user.company_access,
        can_manage_products=user.can_manage_products,
        can_edit_pending=user.can_edit_pending,
        can_delete_pending=user.can_delete_pending,
        can_edit_events=user.can_edit_events,
        can_delete_events=user.can_delete_events,
        can_set_suggested_action=user.can_set_suggested_action,
        can_mark_addressed=user.can_mark_addressed,
        can_edit_addressed=user.can_edit_addressed,
        can_delete_addressed=user.can_delete_addressed,
        can_assign=user.can_assign,
        can_manage_users=user.can_manage_users,
    )
    return {k: v for k, v in created.items() if k != "password_hash"}

@app.patch("/api/users/{username}")
def update_user(username: str, body: UserUpdate, _user: str = Depends(auth.require_user_manager)):
    u = database.get_user(username)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.new_username and body.new_username != username and database.get_user(body.new_username):
        raise HTTPException(status_code=400, detail="Username already exists")
    perms = {k: v for k, v in body.model_dump().items() if v is not None and k not in ("new_username", "new_password")}
    updated = database.update_user(username, new_username=body.new_username, new_password=body.new_password, **perms)
    return {k: v for k, v in updated.items() if k != "password_hash"}

@app.delete("/api/users/{username}")
def delete_user(username: str, _user: str = Depends(auth.require_user_manager)):
    u = database.get_user(username)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u["is_admin"]:
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    deleted = database.delete_user(username)
    return {k: v for k, v in deleted.items() if k != "password_hash"}


# --- Suggested Actions ---

@app.get("/api/suggested-actions")
def list_suggested_actions(_user: str = Depends(auth.require_auth)):
    return database.list_suggested_actions()

@app.post("/api/suggested-actions")
def add_suggested_action(data: dict, _user: str = Depends(auth.require_user_manager)):
    action = data.get("action", "").strip()
    if not action:
        raise HTTPException(status_code=400, detail="Action text is required")
    existing = database.list_suggested_actions()
    if action in existing:
        raise HTTPException(status_code=400, detail="Action already exists")
    database.add_suggested_action(action)
    result = database.list_suggested_actions()
    sheets.sync_suggested_actions(result)
    return result

@app.delete("/api/suggested-actions/{index}")
def delete_suggested_action(index: int, _user: str = Depends(auth.require_user_manager)):
    removed = database.delete_suggested_action_by_index(index)
    if removed is None:
        raise HTTPException(status_code=404, detail="Action not found")
    result = database.list_suggested_actions()
    sheets.sync_suggested_actions(result)
    return {"removed": removed, "actions": result}


# --- Suppliers ---

@app.get("/api/suppliers")
def list_suppliers(_user: str = Depends(auth.require_auth)):
    return database.list_suppliers()

@app.post("/api/suppliers")
def add_supplier(data: dict, _user: str = Depends(auth.require_user_manager)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name is required")
    existing = database.list_suppliers()
    if name in existing:
        raise HTTPException(status_code=400, detail="Supplier already exists")
    database.add_supplier(name)
    result = database.list_suppliers()
    sheets.sync_suppliers(result)
    return result

@app.delete("/api/suppliers/{index}")
def delete_supplier(index: int, _user: str = Depends(auth.require_user_manager)):
    removed = database.delete_supplier_by_index(index)
    if removed is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    database.cascade_supplier_delete(removed)
    sheets.sync_products(database.get_all_products())
    result = database.list_suppliers()
    sheets.sync_suppliers(result)
    return {"removed": removed, "suppliers": result}


# --- Products (Master List) ---

@app.get("/api/aql-levels")
def get_aql_levels(_user: str = Depends(auth.require_auth)):
    return AQL_LEVELS

@app.get("/api/inspection-levels")
def get_inspection_levels(_user: str = Depends(auth.require_auth)):
    return INSPECTION_LEVELS

@app.get("/api/aql/lookup")
def aql_lookup(lot_size: int, inspection_level: str, aql_level: str,
               _user: str = Depends(auth.require_auth)):
    return aql.lookup(lot_size, inspection_level, aql_level)

@app.get("/api/companies")
def get_companies(_user: str = Depends(auth.require_auth)):
    return COMPANIES

@app.get("/api/products")
def list_products(company: str = "All", _user: str = Depends(auth.require_auth)):
    return database.list_products(company)

@app.post("/api/products")
def create_product(product: ProductCreate, _user: str = Depends(auth.require_auth)):
    if product.inspection_level not in INSPECTION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid inspection level. Must be one of: {INSPECTION_LEVELS}")
    if product.aql_level not in AQL_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid AQL level. Must be one of: {AQL_LEVELS}")
    companies = COMPANIES if product.company == "All" else [product.company]
    created = database.create_product(
        name=product.name, inspection_level=product.inspection_level,
        aql_level=product.aql_level, test_details=product.test_details,
        supplier=product.supplier, companies=companies,
        created_by=_user, created_at=datetime.now().isoformat(),
    )
    sheets.sync_products(database.get_all_products())
    return created

@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductCreate,
                   _user: str = Depends(auth.require_auth)):
    if not database.get_product(product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    if product.inspection_level not in INSPECTION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid inspection level. Must be one of: {INSPECTION_LEVELS}")
    if product.aql_level not in AQL_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid AQL level. Must be one of: {AQL_LEVELS}")
    companies = COMPANIES if product.company == "All" else [product.company]
    updated = database.update_product(
        product_id, name=product.name, inspection_level=product.inspection_level,
        aql_level=product.aql_level, test_details=product.test_details,
        supplier=product.supplier, companies=companies,
    )
    sheets.sync_products(database.get_all_products())
    return updated

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, _user: str = Depends(auth.require_auth)):
    deleted = database.delete_product(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    for f in UPLOADS_DIR.glob(f"product_{product_id}.*"):
        f.unlink()
    sheets.sync_products(database.get_all_products())
    return deleted


# --- Product File Upload ---

@app.post("/api/products/{product_id}/file")
async def upload_product_file(product_id: int, file: UploadFile = File(...),
                              _user: str = Depends(auth.require_auth)):
    if not database.get_product(product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")
    # Check file size (10 MB limit)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")
    for f in UPLOADS_DIR.glob(f"product_{product_id}.*"):
        f.unlink()
    dest = UPLOADS_DIR / f"product_{product_id}{ext}"
    with open(dest, "wb") as buf:
        buf.write(contents)
    filename = f"product_{product_id}{ext}"
    database.set_product_file(product_id, filename)
    return {"filename": filename}

@app.get("/api/products/{product_id}/file")
def get_product_file(product_id: int, _user: str = Depends(auth.require_auth)):
    product = database.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    fname = product.get("file")
    if not fname:
        raise HTTPException(status_code=404, detail="No file attached")
    fpath = UPLOADS_DIR / fname
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    import mimetypes
    mime, _ = mimetypes.guess_type(str(fpath))
    if mime is None:
        mime = "application/octet-stream"
    return FileResponse(fpath, media_type=mime, content_disposition_type="inline")


@app.delete("/api/products/{product_id}/file")
def delete_product_file(product_id: int, _user: str = Depends(auth.require_auth)):
    product = database.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    fname = product.get("file")
    if fname:
        fpath = UPLOADS_DIR / fname
        if fpath.exists():
            fpath.unlink()
    database.set_product_file(product_id, "")
    return {"ok": True}


# --- Pending Inspections ---

@app.get("/api/pending")
def list_pending(company: str = "All", _user: str = Depends(auth.require_auth)):
    return database.list_pending(company)

@app.post("/api/pending")
def create_pending(p: PendingInspectionCreate, _user: str = Depends(auth.require_auth)):
    product = database.get_product(p.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    aql_result = aql.lookup(p.lot_size, product["inspection_level"], product["aql_level"])
    companies = COMPANIES if p.company == "All" else [p.company]
    created = database.create_pending(
        product_id=p.product_id, product_name=product["name"],
        direction=p.direction, lot_size=p.lot_size,
        suggested_sample_size=aql_result["sample_size"],
        estimated_date=p.estimated_date, companies=companies,
        created_by=_user, assigned_to=p.assigned_to,
        created_at=datetime.now().isoformat(),
    )
    sheets.sync_pending(database.get_all_pending())
    return created

@app.put("/api/pending/{pending_id}")
def update_pending(pending_id: int, p: PendingInspectionCreate,
                   _user: str = Depends(auth.require_auth)):
    if not database.get_pending(pending_id):
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    product = database.get_product(p.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    aql_result = aql.lookup(p.lot_size, product["inspection_level"], product["aql_level"])
    companies = COMPANIES if p.company == "All" else [p.company]
    updated = database.update_pending(
        pending_id, product_id=p.product_id, product_name=product["name"],
        direction=p.direction, lot_size=p.lot_size,
        suggested_sample_size=aql_result["sample_size"],
        estimated_date=p.estimated_date, companies=companies,
        assigned_to=p.assigned_to,
    )
    sheets.sync_pending(database.get_all_pending())
    return updated

@app.delete("/api/pending/{pending_id}")
def delete_pending(pending_id: int, _user: str = Depends(auth.require_auth)):
    deleted = database.delete_pending(pending_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    sheets.sync_pending(database.get_all_pending())
    return deleted

@app.patch("/api/pending/{pending_id}/assign")
def assign_pending(pending_id: int, data: dict, _user: str = Depends(auth.require_auth)):
    if not database.get_pending(pending_id):
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    updated = database.set_pending_assigned(pending_id, data.get("assigned_to", ""))
    sheets.sync_pending(database.get_all_pending())
    return updated


# --- Events ---

@app.get("/api/events")
def list_events(company: str = "All", _user: str = Depends(auth.require_auth)):
    return database.list_events(company)

@app.post("/api/events")
def create_event(event: EventCreate, _user: str = Depends(auth.require_auth)):
    product = database.get_product(event.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    aql_result = aql.lookup(event.lot_size, product["inspection_level"], product["aql_level"])
    pass_fail = None
    if aql_result["accept"] is not None:
        pass_fail = "pass" if event.quantity_non_conforming <= aql_result["accept"] else "fail"

    companies = COMPANIES if event.company == "All" else [event.company]
    created = database.create_event(
        product_id=event.product_id, product_name=product["name"],
        direction=event.direction, lot_size=event.lot_size,
        quantity_inspected=event.quantity_inspected,
        quantity_non_conforming=event.quantity_non_conforming,
        pass_fail=pass_fail, sample_size=aql_result["sample_size"],
        accept_number=aql_result["accept"], reject_number=aql_result["reject"],
        code_letter=aql_result["code_letter"], date_inspected=event.date_inspected,
        companies=companies, created_by=_user,
        created_at=datetime.now().isoformat(),
    )
    if event.pending_id and database.get_pending(event.pending_id):
        database.delete_pending(event.pending_id)
        sheets.sync_pending(database.get_all_pending())
    sheets.sync_events(database.get_all_events())
    return created

@app.put("/api/events/{event_id}")
def update_event(event_id: int, event: EventUpdate,
                 _user: str = Depends(auth.require_auth)):
    if not database.get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    product = database.get_product(event.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    aql_result = aql.lookup(event.lot_size, product["inspection_level"], product["aql_level"])
    pass_fail = None
    if aql_result["accept"] is not None:
        pass_fail = "pass" if event.quantity_non_conforming <= aql_result["accept"] else "fail"

    updated = database.update_event(
        event_id, product_id=event.product_id, product_name=product["name"],
        direction=event.direction, lot_size=event.lot_size,
        quantity_inspected=event.quantity_inspected,
        quantity_non_conforming=event.quantity_non_conforming,
        pass_fail=pass_fail, sample_size=aql_result["sample_size"],
        accept_number=aql_result["accept"], reject_number=aql_result["reject"],
        code_letter=aql_result["code_letter"], date_inspected=event.date_inspected,
    )
    sheets.sync_events(database.get_all_events())
    return updated

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, _user: str = Depends(auth.require_auth)):
    deleted = database.delete_event(event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Event not found")
    sheets.sync_events(database.get_all_events())
    return deleted

@app.patch("/api/events/{event_id}/suggested-action")
def set_suggested_action(event_id: int, data: dict,
                         _user: str = Depends(auth.require_auth)):
    if not database.get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    updated = database.set_suggested_action(event_id, data.get("suggested_action", ""))
    sheets.sync_events(database.get_all_events())
    return updated

@app.patch("/api/events/{event_id}/address")
def address_event(event_id: int, data: dict, _user: str = Depends(auth.require_auth)):
    if not database.get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    addressed = data.get("addressed", True)
    updated = database.set_addressed(
        event_id, addressed,
        addressed_date=data.get("addressed_date", "") if addressed else "",
        addressed_by=_user if addressed else "",
    )
    sheets.sync_events(database.get_all_events())
    return updated

@app.patch("/api/events/{event_id}/assign")
def assign_event(event_id: int, data: dict, _user: str = Depends(auth.require_auth)):
    if not database.get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    updated = database.set_event_assigned(event_id, data.get("assigned_to", ""))
    sheets.sync_events(database.get_all_events())
    return updated

@app.patch("/api/events/{event_id}/release")
def release_event(event_id: int, data: dict, _user: str = Depends(auth.require_auth)):
    if not database.get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    released = data.get("released", True)
    updated = database.set_released(
        event_id, released,
        released_date=data.get("released_date", "") if released else "",
        released_by=_user if released else "",
    )
    sheets.sync_events(database.get_all_events())
    return updated


# --- PDF Export ---

_PDF_LABELS = {
    "en": {
        "title_all": "QC Inspector - Completed Events",
        "no_events": "No completed events to export.",
        "headers": ["ID", "Product", "Direction", "Lot Size", "Sample", "Inspected",
                     "Non-Conf.", "Code", "Ac/Re", "Pass/Fail", "Date"],
        "incoming": "Incoming", "outgoing": "Outgoing",
        "report_title": "Inspection Report",
        "product": "Product", "inspection_date": "Inspection Date",
        "lot_size": "Lot Size", "sample_size": "Sample Size",
        "units_inspected": "Units Inspected", "ac_re": "Ac/Re",
        "non_conforming": "Non Conforming Units",
        "test_details": "Test Details",
        "pass": "PASS", "fail": "FAIL",
    },
    "es": {
        "title_all": "QC Inspector - Eventos Completados",
        "no_events": "No hay eventos completados para exportar.",
        "headers": ["ID", "Producto", "Direccion", "Tamano de Lote", "Muestra", "Inspeccionados",
                     "No Conf.", "Codigo", "Ac/Re", "Pasa/Falla", "Fecha"],
        "incoming": "Entrante", "outgoing": "Saliente",
        "report_title": "Reporte de Inspeccion",
        "product": "Producto", "inspection_date": "Fecha de Inspeccion",
        "lot_size": "Tamano de Lote", "sample_size": "Tamano de Muestra",
        "units_inspected": "Unidades Inspeccionadas", "ac_re": "Ac/Re",
        "non_conforming": "Unidades No Conformes",
        "test_details": "Detalles de Prueba",
        "pass": "PASA", "fail": "FALLA",
    },
}


@app.get("/api/events/export/pdf")
def export_events_pdf(lang: str = "en", company: str = "All",
                      _user: str = Depends(auth.require_auth)):
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    labels = _PDF_LABELS.get(lang, _PDF_LABELS["en"])
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter), topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(labels["title_all"], styles["Title"]))
    elements.append(Spacer(1, 12))

    data = [labels["headers"]]
    all_events = database.list_events(company)
    for ev in all_events:
        ac_re = f"{ev['accept_number']}/{ev['reject_number']}" if ev["accept_number"] is not None else "--"
        pf_raw = ev["pass_fail"] or ""
        if pf_raw == "pass":
            pf = labels["pass"]
        elif pf_raw == "fail":
            pf = labels["fail"]
        else:
            pf = "--"
        dir_label = labels.get(ev["direction"], ev["direction"].capitalize())
        data.append([
            str(ev["id"]),
            ev["product_name"],
            dir_label,
            str(ev["lot_size"]),
            str(ev["sample_size"]) if ev["sample_size"] else "--",
            str(ev["quantity_inspected"]),
            str(ev["quantity_non_conforming"]),
            ev["code_letter"] or "--",
            ac_re,
            pf,
            ev["date_inspected"],
        ])

    if len(data) == 1:
        elements.append(Paragraph(labels["no_events"], styles["Normal"]))
    else:
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)

    doc.build(elements)
    buf.seek(0)
    filename = f"qc_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


_LOGO_PATH = Path(__file__).parent / "data" / "logo.jpg"

_COMPANY_INFO = [
    "VB - Packaging",
    "Carr. Miguel Aleman Km 14.2 B-1 9",
    "Parque Alianza",
    "Apodaca, Nuevo Leon, Mexico",
    "ZIP: 66633",
]

_CONTACT_INFO = [
    "Miguel Villarreal",
    "miguel.v@vb-packaging.com",
    "+525539146995",
]


def _draw_footer_wave(canvas, doc):
    from reportlab.lib.colors import Color
    w = doc.pagesize[0]

    dark_blue = Color(0.11, 0.16, 0.32)
    red = Color(0.78, 0.14, 0.18)

    p = canvas.beginPath()
    p.moveTo(0, 0)
    p.lineTo(0, 50)
    p.curveTo(w * 0.15, 70, w * 0.3, 30, w * 0.5, 45)
    p.curveTo(w * 0.7, 60, w * 0.85, 25, w, 40)
    p.lineTo(w, 0)
    p.close()
    canvas.setFillColor(dark_blue)
    canvas.drawPath(p, fill=1, stroke=0)

    p2 = canvas.beginPath()
    p2.moveTo(0, 0)
    p2.lineTo(0, 30)
    p2.curveTo(w * 0.2, 50, w * 0.4, 15, w * 0.55, 30)
    p2.curveTo(w * 0.7, 45, w * 0.85, 10, w, 25)
    p2.lineTo(w, 0)
    p2.close()
    canvas.setFillColor(red)
    canvas.drawPath(p2, fill=1, stroke=0)

    canvas.setFillColor(Color(0, 0, 0))
    canvas.setFont("Helvetica-Bold", 10)
    x = w - 72
    canvas.drawRightString(x + 40, 95, _CONTACT_INFO[0])
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(x + 40, 82, _CONTACT_INFO[1])
    canvas.drawRightString(x + 40, 69, _CONTACT_INFO[2])


@app.get("/api/events/{event_id}/export/pdf")
def export_single_event_pdf(event_id: int, lang: str = "en",
                            _user: str = Depends(auth.require_auth)):
    ev = database.get_event(event_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    )

    labels = _PDF_LABELS.get(lang, _PDF_LABELS["en"])
    product = database.get_product(ev["product_id"]) or {}
    ac_re = f"{ev['accept_number']}/{ev['reject_number']}" if ev["accept_number"] is not None else "--"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=36, bottomMargin=120,
        leftMargin=50, rightMargin=50,
    )
    page_w = letter[0] - 100

    elements = []

    company_style = ParagraphStyle("company", fontName="Helvetica-Bold", fontSize=10, leading=14)
    company_text = "<br/>".join(_COMPANY_INFO)
    company_para = Paragraph(company_text, company_style)

    logo_w, logo_h = 110, 70
    if _LOGO_PATH.exists():
        logo = Image(str(_LOGO_PATH), width=logo_w, height=logo_h)
    else:
        logo = Spacer(logo_w, logo_h)

    header_table = Table(
        [[logo, company_para]],
        colWidths=[logo_w + 20, page_w - logo_w - 20],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 30))

    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=14, leading=18)
    elements.append(Paragraph(labels["report_title"], title_style))
    elements.append(Spacer(1, 16))

    label_style = ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=11, leading=16)
    value_style = ParagraphStyle("value", fontName="Helvetica", fontSize=11, leading=16)

    rows = [
        [Paragraph(labels["product"], label_style),
         Paragraph(ev["product_name"], value_style)],
        [Paragraph(labels["inspection_date"], label_style),
         Paragraph(ev["date_inspected"], value_style)],
        [Paragraph(labels["lot_size"], label_style),
         Paragraph(str(ev["lot_size"]), value_style)],
        [Paragraph(labels["sample_size"], label_style),
         Paragraph(str(ev["sample_size"]) if ev["sample_size"] else "--", value_style)],
        [Paragraph(labels["units_inspected"], label_style),
         Paragraph(str(ev["quantity_inspected"]), value_style)],
        [Paragraph(labels["ac_re"], label_style),
         Paragraph(ac_re, value_style)],
        [Paragraph(labels["non_conforming"], label_style),
         Paragraph(str(ev["quantity_non_conforming"]), value_style)],
    ]

    if product.get("test_details"):
        rows.append([
            Paragraph(labels["test_details"], label_style),
            Paragraph(product["test_details"], value_style),
        ])

    col1_w = page_w * 0.4
    col2_w = page_w * 0.6
    data_table = Table(rows, colWidths=[col1_w, col2_w])
    data_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(data_table)
    elements.append(Spacer(1, 24))

    pf_raw = ev["pass_fail"] or ""
    if pf_raw == "pass":
        pf_text = labels["pass"]
        pf_color = colors.Color(0.13, 0.55, 0.13)
    elif pf_raw == "fail":
        pf_text = labels["fail"]
        pf_color = colors.Color(0.8, 0.1, 0.1)
    else:
        pf_text = "--"
        pf_color = colors.black
    pf_style = ParagraphStyle(
        "passfail", fontName="Helvetica-Bold", fontSize=18,
        leading=24, alignment=1, textColor=pf_color,
    )
    elements.append(Paragraph(pf_text, pf_style))

    doc.build(elements, onFirstPage=_draw_footer_wave, onLaterPages=_draw_footer_wave)
    buf.seek(0)
    filename = f"qc_event_{event_id}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Google Sheets Integration ---

@app.get("/api/sheets/status")
def sheets_status(_user: str = Depends(auth.require_auth)):
    return sheets.get_status()

@app.post("/api/sheets/connect")
def sheets_connect(_user: str = Depends(auth.require_auth)):
    sheets.ensure_connected()
    return sheets.get_status()


# --- Static file serving (for Docker: serves Next.js exported site) ---

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
