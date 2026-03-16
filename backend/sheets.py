"""Google Sheets integration for QC Inspector."""

import gspread
from google.oauth2.service_account import Credentials
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

CREDENTIALS_PATH = Path(__file__).parent / "credentials" / "service_account.json"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Configuration
SPREADSHEET_ID = "1UGkWVxGPviinHZCspemdirrVHOxscDbmsvsPi-yRwqo"

# Module-level state
_client: gspread.Client | None = None
_spreadsheet: gspread.Spreadsheet | None = None
_share_email: str = "miguel@lunchbreak.mx"


def _get_client() -> gspread.Client:
    """Authenticate and return a gspread client (cached)."""
    global _client
    if _client is None:
        if not CREDENTIALS_PATH.exists():
            raise FileNotFoundError(
                f"Service account credentials not found at {CREDENTIALS_PATH}"
            )
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=SCOPES)
        _client = gspread.authorize(creds)
    return _client


def init_spreadsheet(title: str = "QC Inspector") -> dict:
    """Create a new Google Sheet and share it. Returns sheet info."""
    global _spreadsheet, _spreadsheet_id
    client = _get_client()
    _spreadsheet = client.create(title)
    _spreadsheet_id = _spreadsheet.id
    _spreadsheet.share(_share_email, perm_type="user", role="writer")
    logger.info(f"Created spreadsheet: {_spreadsheet.url}")
    return {
        "id": _spreadsheet.id,
        "url": _spreadsheet.url,
        "title": _spreadsheet.title,
        "shared_with": _share_email,
    }


def connect_spreadsheet(spreadsheet_id: str) -> dict:
    """Connect to an existing Google Sheet by ID."""
    global _spreadsheet
    client = _get_client()
    _spreadsheet = client.open_by_key(spreadsheet_id)
    return {
        "id": _spreadsheet.id,
        "url": _spreadsheet.url,
        "title": _spreadsheet.title,
    }


_OLD_ENGLISH_TABS = [
    "Master List", "Pending Inspections", "Failed Events",
    "Awaiting Fix", "Passed Events", "Released Products",
]


def ensure_connected() -> gspread.Spreadsheet:
    """Connect to the configured spreadsheet if not already connected. Returns it."""
    global _spreadsheet
    if _spreadsheet is None:
        connect_spreadsheet(SPREADSHEET_ID)
        # Clean up old English-named tabs if they exist
        for old_name in _OLD_ENGLISH_TABS:
            try:
                old_ws = _spreadsheet.worksheet(old_name)
                _spreadsheet.del_worksheet(old_ws)
            except gspread.WorksheetNotFound:
                pass
    return _spreadsheet


def get_spreadsheet() -> gspread.Spreadsheet | None:
    """Return the active spreadsheet, or None if not initialized."""
    return _spreadsheet


def get_status() -> dict:
    """Return current connection status."""
    has_creds = CREDENTIALS_PATH.exists()
    connected = _spreadsheet is not None
    return {
        "credentials_found": has_creds,
        "connected": connected,
        "spreadsheet_id": SPREADSHEET_ID,
        "spreadsheet_url": _spreadsheet.url if _spreadsheet else None,
        "spreadsheet_title": _spreadsheet.title if _spreadsheet else None,
        "share_email": _share_email,
    }


# --- Master List sync ---

_MASTER_LIST_TAB = "Lista Maestra"
_MASTER_LIST_HEADERS = [
    "ID", "Nombre", "Nivel de Inspeccion", "Nivel AQL",
    "Proveedor", "Empresa", "Creado Por", "Fecha de Alta", "Detalles de Prueba",
]


def _get_or_create_worksheet(name: str, headers: list[str]) -> gspread.Worksheet:
    """Get a worksheet by name, creating it with headers if it doesn't exist."""
    ss = ensure_connected()
    try:
        ws = ss.worksheet(name)
    except gspread.WorksheetNotFound:
        ws = ss.add_worksheet(title=name, rows=1, cols=len(headers))
        ws.append_row(headers)
    return ws


def _format_date(iso_string: str) -> str:
    """Extract YYYY-MM-DD from an ISO datetime string."""
    if not iso_string:
        return ""
    return iso_string[:10]


def _product_to_row(p: dict) -> list[str]:
    """Convert a product dict to a sheet row."""
    return [
        str(p.get("id", "")),
        p.get("name", ""),
        p.get("inspection_level", ""),
        p.get("aql_level", ""),
        p.get("supplier", ""),
        ", ".join(p.get("companies", [])),
        p.get("created_by", ""),
        _format_date(p.get("created_at", "")),
        p.get("test_details", ""),
    ]


def _sync_tab(name: str, headers: list[str], rows_data: list[list[str]]) -> None:
    """Overwrite a tab with headers + data rows."""
    ws = _get_or_create_worksheet(name, headers)
    rows = [headers] + rows_data
    ws.clear()
    ws.update(rows, value_input_option="RAW")


# --- Suggested Actions sync ---

_ACTIONS_TAB = "Acciones Sugeridas"
_ACTIONS_HEADERS = ["Accion"]


def sync_suggested_actions(actions: list[str]) -> None:
    """Full sync: overwrite the Suggested Actions tab."""
    try:
        rows = [[a] for a in actions]
        _sync_tab(_ACTIONS_TAB, _ACTIONS_HEADERS, rows)
        logger.info(f"Synced {len(actions)} suggested actions to sheet")
    except Exception as e:
        logger.error(f"Failed to sync suggested actions to sheet: {e}")


# --- Suppliers sync ---

_SUPPLIERS_TAB = "Proveedores"
_SUPPLIERS_HEADERS = ["Proveedor"]


def sync_suppliers(supplier_list: list[str]) -> None:
    """Full sync: overwrite the Suppliers tab."""
    try:
        rows = [[s] for s in supplier_list]
        _sync_tab(_SUPPLIERS_TAB, _SUPPLIERS_HEADERS, rows)
        logger.info(f"Synced {len(supplier_list)} suppliers to sheet")
    except Exception as e:
        logger.error(f"Failed to sync suppliers to sheet: {e}")


# --- Master List sync ---

def sync_products(products: dict) -> None:
    """Full sync: overwrite the Master List tab with current product data."""
    try:
        rows = [_product_to_row(p) for p in products.values()]
        _sync_tab(_MASTER_LIST_TAB, _MASTER_LIST_HEADERS, rows)
        logger.info(f"Synced {len(products)} products to Master List sheet")
    except Exception as e:
        logger.error(f"Failed to sync products to sheet: {e}")


# --- Pending Inspections sync ---

_PENDING_TAB = "Inspecciones Pendientes"
_PENDING_HEADERS = [
    "ID", "Producto", "Direccion", "Tamano de Lote", "Cant. Sugerida",
    "Fecha Est.", "Empresa", "Creado Por", "Asignado A",
]


def _pending_to_row(p: dict) -> list[str]:
    return [
        str(p.get("id", "")),
        p.get("product_name", ""),
        _direction(p),
        str(p.get("lot_size", "")),
        str(p.get("suggested_sample_size", "")),
        _format_date(p.get("estimated_date", "")),
        ", ".join(p.get("companies", [])),
        p.get("created_by", ""),
        p.get("assigned_to", ""),
    ]


def sync_pending(pending_inspections: dict) -> None:
    """Full sync: overwrite the Pending Inspections tab."""
    try:
        rows = [_pending_to_row(p) for p in pending_inspections.values()]
        _sync_tab(_PENDING_TAB, _PENDING_HEADERS, rows)
        logger.info(f"Synced {len(pending_inspections)} pending inspections to sheet")
    except Exception as e:
        logger.error(f"Failed to sync pending inspections to sheet: {e}")


# --- Event tabs sync ---

_FAILED_TAB = "Eventos Fallidos"
_FAILED_HEADERS = [
    "ID", "Producto", "Direccion", "Tamano de Lote", "Muestra", "Inspeccionados",
    "No Conf.", "Ac/Re", "Pasa/Falla", "Fecha", "Empresa", "Creado Por",
]

_AWAITING_TAB = "En Espera de Correccion"
_AWAITING_HEADERS = [
    "ID", "Producto", "Direccion", "Tamano de Lote", "No Conf.",
    "Accion Sugerida", "Fecha", "Empresa", "Creado Por", "Asignado A",
]

_PASSED_TAB = "Eventos Aprobados"
_PASSED_HEADERS = [
    "ID", "Producto", "Direccion", "Tamano de Lote", "Muestra", "Inspeccionados",
    "No Conf.", "Ac/Re", "Pasa/Falla", "Fecha", "Empresa", "Resuelto Por",
]

_RELEASED_TAB = "Productos Liberados"
_RELEASED_HEADERS = [
    "ID", "Producto", "Direccion", "Tamano de Lote", "Muestra", "Inspeccionados",
    "No Conf.", "Ac/Re", "Pasa/Falla", "Fecha", "Empresa", "Resuelto Por",
    "Fecha de Liberacion", "Liberado Por",
]


def _ac_re(ev: dict) -> str:
    ac = ev.get("accept_number")
    re = ev.get("reject_number")
    if ac is not None and re is not None:
        return f"{ac}/{re}"
    return "--"


def _pass_fail(ev: dict) -> str:
    pf = ev.get("pass_fail", "")
    if pf == "pass":
        return "PASA"
    elif pf == "fail":
        return "FALLA"
    return "--"


def _direction(ev: dict) -> str:
    d = ev.get("direction", "")
    if d == "incoming":
        return "Entrante"
    elif d == "outgoing":
        return "Saliente"
    return d.capitalize()


def _resolved_by(ev: dict) -> str:
    """created_by for first-pass passes, addressed_by for addressed fails."""
    if ev.get("addressed") and ev.get("addressed_by"):
        return ev["addressed_by"]
    return ev.get("created_by", "")


def _failed_to_row(ev: dict) -> list[str]:
    return [
        str(ev.get("id", "")),
        ev.get("product_name", ""),
        _direction(ev),
        str(ev.get("lot_size", "")),
        str(ev.get("sample_size", "") or "--"),
        str(ev.get("quantity_inspected", "")),
        str(ev.get("quantity_non_conforming", "")),
        _ac_re(ev),
        _pass_fail(ev),
        _format_date(ev.get("date_inspected", "")),
        ", ".join(ev.get("companies", [])),
        ev.get("created_by", ""),
    ]


def _awaiting_to_row(ev: dict) -> list[str]:
    return [
        str(ev.get("id", "")),
        ev.get("product_name", ""),
        _direction(ev),
        str(ev.get("lot_size", "")),
        str(ev.get("quantity_non_conforming", "")),
        ev.get("suggested_action", ""),
        _format_date(ev.get("date_inspected", "")),
        ", ".join(ev.get("companies", [])),
        ev.get("created_by", ""),
        ev.get("assigned_to", ""),
    ]


def _passed_to_row(ev: dict) -> list[str]:
    return [
        str(ev.get("id", "")),
        ev.get("product_name", ""),
        _direction(ev),
        str(ev.get("lot_size", "")),
        str(ev.get("sample_size", "") or "--"),
        str(ev.get("quantity_inspected", "")),
        str(ev.get("quantity_non_conforming", "")),
        _ac_re(ev),
        _pass_fail(ev),
        _format_date(ev.get("date_inspected", "")),
        ", ".join(ev.get("companies", [])),
        _resolved_by(ev),
    ]


def _released_to_row(ev: dict) -> list[str]:
    return _passed_to_row(ev) + [
        _format_date(ev.get("released_date", "")),
        ev.get("released_by", ""),
    ]


def sync_events(events: dict) -> None:
    """Full sync: categorize events and overwrite all 4 event tabs."""
    try:
        failed, awaiting, passed, released = [], [], [], []
        for ev in events.values():
            if ev.get("released"):
                released.append(_released_to_row(ev))
            elif ev.get("pass_fail") == "pass" or ev.get("addressed"):
                passed.append(_passed_to_row(ev))
            elif ev.get("pass_fail") == "fail" and ev.get("suggested_action"):
                awaiting.append(_awaiting_to_row(ev))
            elif ev.get("pass_fail") == "fail":
                failed.append(_failed_to_row(ev))

        _sync_tab(_FAILED_TAB, _FAILED_HEADERS, failed)
        _sync_tab(_AWAITING_TAB, _AWAITING_HEADERS, awaiting)
        _sync_tab(_PASSED_TAB, _PASSED_HEADERS, passed)
        _sync_tab(_RELEASED_TAB, _RELEASED_HEADERS, released)
        logger.info(f"Synced events: {len(failed)} failed, {len(awaiting)} awaiting, {len(passed)} passed, {len(released)} released")
    except Exception as e:
        logger.error(f"Failed to sync events to sheet: {e}")
