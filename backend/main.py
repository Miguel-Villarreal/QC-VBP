from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import aql

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


# --- Models ---

AQL_LEVELS = [
    "0.010", "0.015", "0.025", "0.040", "0.065",
    "0.10", "0.15", "0.25", "0.40", "0.65",
    "1.0", "1.5", "2.5", "4.0", "6.5", "10", "15",
]

INSPECTION_LEVELS = ["I", "II", "III", "S-1", "S-2", "S-3", "S-4"]

class ProductCreate(BaseModel):
    name: str
    inspection_level: str  # "I", "II", "III", "S-1", "S-2", "S-3", "S-4"
    aql_level: str  # e.g. "0.65", "1.0", "2.5" per ANSI/ASQ Z1.4

class PendingInspectionCreate(BaseModel):
    product_id: int
    direction: str  # "incoming" or "outgoing"
    lot_size: int
    estimated_date: str  # ISO date string e.g. "2026-03-10"

class EventCreate(BaseModel):
    product_id: int
    direction: str  # "incoming" or "outgoing"
    lot_size: int
    quantity_inspected: int
    quantity_non_conforming: int
    date_inspected: str  # ISO date string e.g. "2026-03-10"
    pending_id: int | None = None  # link to pending inspection being completed


# --- Auth ---

@app.post("/api/auth/login")
def login(data: dict):
    if data.get("username") == "user" and data.get("password") == "password":
        return {"token": "mvp-token", "username": "user"}
    raise HTTPException(status_code=401, detail="Invalid credentials")


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

@app.get("/api/products")
def list_products():
    return list(products.values())

@app.post("/api/products")
def create_product(product: ProductCreate):
    global next_product_id
    pid = next_product_id
    next_product_id += 1
    if product.inspection_level not in INSPECTION_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid inspection level. Must be one of: {INSPECTION_LEVELS}")
    if product.aql_level not in AQL_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid AQL level. Must be one of: {AQL_LEVELS}")
    products[pid] = {
        "id": pid,
        "name": product.name,
        "inspection_level": product.inspection_level,
        "aql_level": product.aql_level,
        "created_at": datetime.now().isoformat(),
    }
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
    return rec

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    if product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    deleted = products.pop(product_id)
    return deleted


# --- Pending Inspections ---

@app.get("/api/pending")
def list_pending():
    return list(pending_inspections.values())

@app.post("/api/pending")
def create_pending(p: PendingInspectionCreate):
    global next_pending_id
    if p.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    pid = next_pending_id
    next_pending_id += 1
    pending_inspections[pid] = {
        "id": pid,
        "product_id": p.product_id,
        "product_name": products[p.product_id]["name"],
        "direction": p.direction,
        "lot_size": p.lot_size,
        "estimated_date": p.estimated_date,
        "created_at": datetime.now().isoformat(),
    }
    return pending_inspections[pid]

@app.put("/api/pending/{pending_id}")
def update_pending(pending_id: int, p: PendingInspectionCreate):
    if pending_id not in pending_inspections:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    if p.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")
    rec = pending_inspections[pending_id]
    rec["product_id"] = p.product_id
    rec["product_name"] = products[p.product_id]["name"]
    rec["direction"] = p.direction
    rec["lot_size"] = p.lot_size
    rec["estimated_date"] = p.estimated_date
    return rec

@app.delete("/api/pending/{pending_id}")
def delete_pending(pending_id: int):
    if pending_id not in pending_inspections:
        raise HTTPException(status_code=404, detail="Pending inspection not found")
    return pending_inspections.pop(pending_id)


# --- Events ---

@app.get("/api/events")
def list_events():
    return list(events.values())

@app.post("/api/events")
def create_event(event: EventCreate):
    global next_event_id
    if event.product_id not in products:
        raise HTTPException(status_code=404, detail="Product not found")

    eid = next_event_id
    next_event_id += 1
    events[eid] = {
        "id": eid,
        "product_id": event.product_id,
        "product_name": products[event.product_id]["name"],
        "direction": event.direction,
        "lot_size": event.lot_size,
        "quantity_inspected": event.quantity_inspected,
        "quantity_non_conforming": event.quantity_non_conforming,
        "pass_fail": None,  # AQL not implemented yet
        "date_inspected": event.date_inspected,
        "created_at": datetime.now().isoformat(),
    }
    if event.pending_id and event.pending_id in pending_inspections:
        pending_inspections.pop(event.pending_id)
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
    rec["product_id"] = event.product_id
    rec["product_name"] = products[event.product_id]["name"]
    rec["direction"] = event.direction
    rec["lot_size"] = event.lot_size
    rec["quantity_inspected"] = event.quantity_inspected
    rec["quantity_non_conforming"] = event.quantity_non_conforming
    rec["date_inspected"] = event.date_inspected
    return rec

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int):
    if event_id not in events:
        raise HTTPException(status_code=404, detail="Event not found")
    return events.pop(event_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
