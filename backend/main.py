from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from datetime import datetime
from io import BytesIO
from pathlib import Path
import aql
import sheets
import shutil

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
products: dict[int, dict] = {}
events: dict[int, dict] = {}
pending_inspections: dict[int, dict] = {}
next_product_id = 1
next_event_id = 1
next_pending_id = 1

# Suggested actions -- admin-configurable list
suggested_actions: list[str] = []

# Suppliers -- admin-configurable list
suppliers: list[str] = []

# Users storage -- keyed by username
users: dict[str, dict] = {
    "user": {
        "username": "user",
        "password": "password",
        "is_admin": True,
        "company_access": "All",
        "can_manage_products": True,
        "can_edit_pending": True,
        "can_delete_pending": True,
        "can_edit_events": True,
        "can_delete_events": True,
        "can_set_suggested_action": True,
        "can_mark_addressed": True,
        "can_edit_addressed": True,
        "can_delete_addressed": True,
        "can_assign": True,
    },
}


# --- Models ---

AQL_LEVELS = [
    "0.065", "0.10", "0.15", "0.25", "0.40", "0.65",
    "1.0", "1.5", "2.5", "4.0", "6.5",
]

INSPECTION_LEVELS = ["I", "II", "III", "S-1", "S-2", "S-3", "S-4"]

COMPANIES = ["VBC", "VBP"]

class UserCreate(BaseModel):
    username: str
    password: str
    company_access: str = "All"  # "All", "VBC", or "VBP"
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

class ProductCreate(BaseModel):
    name: str
    inspection_level: str  # "I", "II", "III", "S-1", "S-2", "S-3", "S-4"
    aql_level: str  # e.g. "0.65", "1.0", "2.5" per ANSI/ASQ Z1.4
    test_details: str = ""
    supplier: str = ""  # supplier company name (report variable)
    company: str = "All"  # "VBC", "VBP", or "All" (both)
    created_by: str = "user"

class PendingInspectionCreate(BaseModel):
    product_id: int
    direction: str  # "incoming" or "outgoing"
    lot_size: int
    estimated_date: str  # ISO date string e.g. "2026-03-10"
    company: str = "All"
    created_by: str = "user"
    assigned_to: str = ""

class EventCreate(BaseModel):
    product_id: int
    direction: str  # "incoming" or "outgoing"
    lot_size: int
    quantity_inspected: int
    quantity_non_conforming: int
    date_inspected: str  # ISO date string e.g. "2026-03-10"
    pending_id: int | None = None  # link to pending inspection being completed
    company: str = "All"
    created_by: str = "user"


# --- Auth ---

@app.post("/api/auth/login")
def login(data: dict):
    username = data.get("username", "")
    password = data.get("password", "")
    u = users.get(username)
    if u and u["password"] == password:
        return {
            "token": f"token-{username}",
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
            "can_assign": u.get("can_assign", True),
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")


# --- User Management (admin only) ---

@app.get("/api/users")
def list_users():
    return [
        {k: v for k, v in u.items() if k != "password"}
        for u in users.values()
    ]

@app.post("/api/users")
def create_user(user: UserCreate):
    if user.username in users:
        raise HTTPException(status_code=400, detail="Username already exists")
    users[user.username] = {
        "username": user.username,
        "password": user.password,
        "is_admin": False,
        "company_access": user.company_access,
        "can_manage_products": user.can_manage_products,
        "can_edit_pending": user.can_edit_pending,
        "can_delete_pending": user.can_delete_pending,
        "can_edit_events": user.can_edit_events,
        "can_delete_events": user.can_delete_events,
        "can_set_suggested_action": user.can_set_suggested_action,
        "can_mark_addressed": user.can_mark_addressed,
        "can_edit_addressed": user.can_edit_addressed,
        "can_delete_addressed": user.can_delete_addressed,
        "can_assign": user.can_assign,
    }
    return {k: v for k, v in users[user.username].items() if k != "password"}

@app.delete("/api/users/{username}")
def delete_user(username: str):
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")
    if users[username]["is_admin"]:
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    return users.pop(username)


# --- Suggested Actions (admin-configurable) ---

@app.get("/api/suggested-actions")
def list_suggested_actions():
    return suggested_actions

@app.post("/api/suggested-actions")
def add_suggested_action(data: dict):
    action = data.get("action", "").strip()
    if not action:
        raise HTTPException(status_code=400, detail="Action text is required")
    if action in suggested_actions:
        raise HTTPException(status_code=400, detail="Action already exists")
    suggested_actions.append(action)
    sheets.sync_suggested_actions(suggested_actions)
    return suggested_actions

@app.delete("/api/suggested-actions/{index}")
def delete_suggested_action(index: int):
    if index < 0 or index >= len(suggested_actions):
        raise HTTPException(status_code=404, detail="Action not found")
    removed = suggested_actions.pop(index)
    sheets.sync_suggested_actions(suggested_actions)
    return {"removed": removed, "actions": suggested_actions}


# --- Suppliers (admin-configurable) ---

@app.get("/api/suppliers")
def list_suppliers():
    return suppliers

@app.post("/api/suppliers")
def add_supplier(data: dict):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name is required")
    if name in suppliers:
        raise HTTPException(status_code=400, detail="Supplier already exists")
    suppliers.append(name)
    sheets.sync_suppliers(suppliers)
    return suppliers

@app.delete("/api/suppliers/{index}")
def delete_supplier(index: int):
    if index < 0 or index >= len(suppliers):
        raise HTTPException(status_code=404, detail="Supplier not found")
    removed = suppliers.pop(index)
    # Cascade: set products with this supplier to "pending"
    for p in products.values():
        if p.get("supplier") == removed:
            p["supplier"] = "pending"
    sheets.sync_products(products)
    sheets.sync_suppliers(suppliers)
    return {"removed": removed, "suppliers": suppliers}


# --- Products (Master List) ---

@app.get("/api/aql-levels")
def get_aql_levels():
    return AQL_LEVELS

@app.get("/api/inspection-levels")
def get_inspection_levels():
    return INSPECTION_LEVELS

@app.get("/api/aql/lookup")
def aql_lookup(lot_size: int, inspection_level: str, aql_level: str):
    """Look up sample size and accept/reject numbers for a given combination."""
    return aql.lookup(lot_size, inspection_level, aql_level)

@app.get("/api/companies")
def get_companies():
    return COMPANIES

@app.get("/api/products")
def list_products(company: str = "All"):
    if company == "All":
        return list(products.values())
    return [p for p in products.values() if company in p.get("companies", [])]

@app.post("/api/products")
def create_product(product: ProductCreate):
    global next_product_id
    pid = next_product_id
    next_product_id += 1
    if product.inspection_level not in INSPECTION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid inspection level. Must be one of: {INSPECTION_LEVELS}")
    if product.aql_level not in AQL_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid AQL level. Must be one of: {AQL_LEVELS}")
    companies = COMPANIES if product.company == "All" else [product.company]
    products[pid] = {
        "id": pid,
        "name": product.name,
        "inspection_level": product.inspection_level,
        "aql_level": product.aql_level,
        "test_details": product.test_details,
        "supplier": product.supplier,
        "file": "",
        "companies": companies,
        "created_by": product.created_by,
        "created_at": datetime.now().isoformat(),
    }
    sheets.sync_products(products)
    return products[pid]

@app.put("/api/products/{product_id}")
def update_product(product_id: int, product: ProductCreate):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.inspection_level not in INSPECTION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid inspection level. Must be one of: {INSPECTION_LEVELS}")
    if product.aql_level not in AQL_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid AQL level. Must be one of: {AQL_LEVELS}")
    rec = products[product_id]
    rec["name"] = product.name
    rec["inspection_level"] = product.inspection_level
    rec["aql_level"] = product.aql_level
    rec["test_details"] = product.test_details
    rec["supplier"] = product.supplier
    rec["companies"] = COMPANIES if product.company == "All" else [product.company]
    sheets.sync_products(products)
    return rec

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    deleted = products.pop(product_id)
    # Clean up uploaded file if any
    for f in UPLOADS_DIR.glob(f"product_{product_id}.*"):
        f.unlink()
    sheets.sync_products(products)
    return deleted


# --- Product File Upload ---

@app.post("/api/products/{product_id}/file")
async def upload_product_file(product_id: int, file: UploadFile = File(...)):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")
    # Remove old file if any
    for f in UPLOADS_DIR.glob(f"product_{product_id}.*"):
        f.unlink()
    dest = UPLOADS_DIR / f"product_{product_id}{ext}"
    with open(dest, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    products[product_id]["file"] = f"product_{product_id}{ext}"
    return {"filename": products[product_id]["file"]}

@app.get("/api/products/{product_id}/file")
def get_product_file(product_id: int):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    fname = products[product_id].get("file")
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
def delete_product_file(product_id: int):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    fname = products[product_id].get("file")
    if fname:
        fpath = UPLOADS_DIR / fname
        if fpath.exists():
            fpath.unlink()
    products[product_id]["file"] = ""
    return {"ok": True}


# --- Pending Inspections ---

@app.get("/api/pending")
def list_pending(company: str = "All"):
    if company == "All":
        return list(pending_inspections.values())
    return [p for p in pending_inspections.values() if company in p.get("companies", [])]

@app.post("/api/pending")
def create_pending(p: PendingInspectionCreate):
    global next_pending_id
    if p.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = next_pending_id
    next_pending_id += 1
    product = products[p.product_id]
    aql_result = aql.lookup(p.lot_size, product["inspection_level"], product["aql_level"])
    companies = COMPANIES if p.company == "All" else [p.company]
    pending_inspections[pid] = {
        "id": pid,
        "product_id": p.product_id,
        "product_name": product["name"],
        "direction": p.direction,
        "lot_size": p.lot_size,
        "suggested_sample_size": aql_result["sample_size"],
        "estimated_date": p.estimated_date,
        "companies": companies,
        "created_by": p.created_by,
        "assigned_to": p.assigned_to,
        "created_at": datetime.now().isoformat(),
    }
    sheets.sync_pending(pending_inspections)
    return pending_inspections[pid]

@app.put("/api/pending/{pending_id}")
def update_pending(pending_id: int, p: PendingInspectionCreate):
    if pending_id not in pending_inspections:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    if p.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    rec = pending_inspections[pending_id]
    product = products[p.product_id]
    aql_result = aql.lookup(p.lot_size, product["inspection_level"], product["aql_level"])
    rec["product_id"] = p.product_id
    rec["product_name"] = product["name"]
    rec["direction"] = p.direction
    rec["lot_size"] = p.lot_size
    rec["suggested_sample_size"] = aql_result["sample_size"]
    rec["estimated_date"] = p.estimated_date
    rec["companies"] = COMPANIES if p.company == "All" else [p.company]
    rec["assigned_to"] = p.assigned_to
    sheets.sync_pending(pending_inspections)
    return rec

@app.delete("/api/pending/{pending_id}")
def delete_pending(pending_id: int):
    if pending_id not in pending_inspections:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    deleted = pending_inspections.pop(pending_id)
    sheets.sync_pending(pending_inspections)
    return deleted

@app.patch("/api/pending/{pending_id}/assign")
def assign_pending(pending_id: int, data: dict):
    if pending_id not in pending_inspections:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    pending_inspections[pending_id]["assigned_to"] = data.get("assigned_to", "")
    sheets.sync_pending(pending_inspections)
    return pending_inspections[pending_id]


# --- Events ---

@app.get("/api/events")
def list_events(company: str = "All"):
    if company == "All":
        return list(events.values())
    return [e for e in events.values() if company in e.get("companies", [])]

@app.post("/api/events")
def create_event(event: EventCreate):
    global next_event_id
    if event.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")

    eid = next_event_id
    next_event_id += 1

    product = products[event.product_id]
    aql_result = aql.lookup(event.lot_size, product["inspection_level"], product["aql_level"])
    pass_fail = None
    if aql_result["accept"] is not None:
        pass_fail = "pass" if event.quantity_non_conforming <= aql_result["accept"] else "fail"

    companies = COMPANIES if event.company == "All" else [event.company]
    events[eid] = {
        "id": eid,
        "product_id": event.product_id,
        "product_name": product["name"],
        "direction": event.direction,
        "lot_size": event.lot_size,
        "quantity_inspected": event.quantity_inspected,
        "quantity_non_conforming": event.quantity_non_conforming,
        "pass_fail": pass_fail,
        "sample_size": aql_result["sample_size"],
        "accept_number": aql_result["accept"],
        "reject_number": aql_result["reject"],
        "code_letter": aql_result["code_letter"],
        "date_inspected": event.date_inspected,
        "companies": companies,
        "suggested_action": "",
        "addressed": False,
        "addressed_date": "",
        "addressed_by": "",
        "assigned_to": "",
        "released": False,
        "released_date": "",
        "released_by": "",
        "created_by": event.created_by,
        "created_at": datetime.now().isoformat(),
    }
    if event.pending_id and event.pending_id in pending_inspections:
        pending_inspections.pop(event.pending_id)
        sheets.sync_pending(pending_inspections)
    sheets.sync_events(events)
    return events[eid]

class EventUpdate(BaseModel):
    product_id: int
    direction: str
    lot_size: int
    quantity_inspected: int
    quantity_non_conforming: int
    date_inspected: str

@app.put("/api/events/{event_id}")
def update_event(event_id: int, event: EventUpdate):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    rec = events[event_id]
    product = products[event.product_id]
    aql_result = aql.lookup(event.lot_size, product["inspection_level"], product["aql_level"])
    pass_fail = None
    if aql_result["accept"] is not None:
        pass_fail = "pass" if event.quantity_non_conforming <= aql_result["accept"] else "fail"

    rec["product_id"] = event.product_id
    rec["product_name"] = product["name"]
    rec["direction"] = event.direction
    rec["lot_size"] = event.lot_size
    rec["quantity_inspected"] = event.quantity_inspected
    rec["quantity_non_conforming"] = event.quantity_non_conforming
    rec["pass_fail"] = pass_fail
    rec["sample_size"] = aql_result["sample_size"]
    rec["accept_number"] = aql_result["accept"]
    rec["reject_number"] = aql_result["reject"]
    rec["code_letter"] = aql_result["code_letter"]
    rec["date_inspected"] = event.date_inspected
    sheets.sync_events(events)
    return rec

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    deleted = events.pop(event_id)
    sheets.sync_events(events)
    return deleted

@app.patch("/api/events/{event_id}/suggested-action")
def set_suggested_action(event_id: int, data: dict):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    events[event_id]["suggested_action"] = data.get("suggested_action", "")
    sheets.sync_events(events)
    return events[event_id]

@app.patch("/api/events/{event_id}/address")
def address_event(event_id: int, data: dict):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    addressed = data.get("addressed", True)
    events[event_id]["addressed"] = addressed
    events[event_id]["addressed_date"] = data.get("addressed_date", "") if addressed else ""
    events[event_id]["addressed_by"] = data.get("addressed_by", "") if addressed else ""
    sheets.sync_events(events)
    return events[event_id]

@app.patch("/api/events/{event_id}/assign")
def assign_event(event_id: int, data: dict):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    events[event_id]["assigned_to"] = data.get("assigned_to", "")
    sheets.sync_events(events)
    return events[event_id]

@app.patch("/api/events/{event_id}/release")
def release_event(event_id: int, data: dict):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    released = data.get("released", True)
    events[event_id]["released"] = released
    events[event_id]["released_date"] = data.get("released_date", "") if released else ""
    events[event_id]["released_by"] = data.get("released_by", "") if released else ""
    sheets.sync_events(events)
    return events[event_id]


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
def export_events_pdf(lang: str = "en", company: str = "All"):
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
    filtered = events.values() if company == "All" else [e for e in events.values() if company in e.get("companies", [])]
    for ev in filtered:
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
    "Apodaca, Nuevo León, Mexico",
    "ZIP: 66633",
]

_CONTACT_INFO = [
    "Miguel Villarreal",
    "miguel.v@vb-packaging.com",
    "+525539146995",
]


def _draw_footer_wave(canvas, doc):
    """Draw decorative wave at bottom of page and contact info."""
    from reportlab.lib.colors import Color
    w = doc.pagesize[0]

    dark_blue = Color(0.11, 0.16, 0.32)
    red = Color(0.78, 0.14, 0.18)

    # Dark blue wave
    p = canvas.beginPath()
    p.moveTo(0, 0)
    p.lineTo(0, 50)
    p.curveTo(w * 0.15, 70, w * 0.3, 30, w * 0.5, 45)
    p.curveTo(w * 0.7, 60, w * 0.85, 25, w, 40)
    p.lineTo(w, 0)
    p.close()
    canvas.setFillColor(dark_blue)
    canvas.drawPath(p, fill=1, stroke=0)

    # Red wave (slightly above)
    p2 = canvas.beginPath()
    p2.moveTo(0, 0)
    p2.lineTo(0, 30)
    p2.curveTo(w * 0.2, 50, w * 0.4, 15, w * 0.55, 30)
    p2.curveTo(w * 0.7, 45, w * 0.85, 10, w, 25)
    p2.lineTo(w, 0)
    p2.close()
    canvas.setFillColor(red)
    canvas.drawPath(p2, fill=1, stroke=0)

    # Contact info
    canvas.setFillColor(Color(0, 0, 0))
    canvas.setFont("Helvetica-Bold", 10)
    x = w - 72
    canvas.drawRightString(x + 40, 95, _CONTACT_INFO[0])
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(x + 40, 82, _CONTACT_INFO[1])
    canvas.drawRightString(x + 40, 69, _CONTACT_INFO[2])


@app.get("/api/events/{event_id}/export/pdf")
def export_single_event_pdf(event_id: int, lang: str = "en"):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")

    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    )

    labels = _PDF_LABELS.get(lang, _PDF_LABELS["en"])
    ev = events[event_id]
    product = products.get(ev["product_id"], {})
    ac_re = f"{ev['accept_number']}/{ev['reject_number']}" if ev["accept_number"] is not None else "--"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=36, bottomMargin=120,
        leftMargin=50, rightMargin=50,
    )
    page_w = letter[0] - 100  # usable width

    elements = []

    # --- Header: logo + company info ---
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

    # --- Title ---
    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=14, leading=18)
    elements.append(Paragraph(labels["report_title"], title_style))
    elements.append(Spacer(1, 16))

    # --- Data table (2 columns: Display, Value) ---
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

    # --- Pass/Fail result ---
    pf_raw = ev["pass_fail"] or ""
    if pf_raw == "pass":
        pf_text = labels["pass"]
        pf_color = colors.Color(0.13, 0.55, 0.13)  # green
    elif pf_raw == "fail":
        pf_text = labels["fail"]
        pf_color = colors.Color(0.8, 0.1, 0.1)  # red
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
def sheets_status():
    return sheets.get_status()

@app.post("/api/sheets/connect")
def sheets_connect():
    """Connect to the configured Google Sheet."""
    sheets.ensure_connected()
    return sheets.get_status()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
