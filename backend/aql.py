import json
from pathlib import Path

_data = json.loads((Path(__file__).parent / "data" / "aql_table.json").read_text())

SAMPLE_SIZES: dict[str, int] = _data["sample_sizes"]
_LOT_RANGES: list[dict] = _data["code_letter_table"]["lot_ranges"]
_ACCEPT_REJECT: dict[str, dict] = _data["accept_reject_table"]

# Remove comment keys
_ACCEPT_REJECT.pop("comment", None)


def get_code_letter(lot_size: int, inspection_level: str) -> str | None:
    """Given a lot size and inspection level, return the sample size code letter."""
    for row in _LOT_RANGES:
        if row["min"] <= lot_size and (row["max"] is None or lot_size <= row["max"]):
            return row.get(inspection_level)
    return None


def get_sample_size(code_letter: str) -> int | None:
    """Given a code letter, return the sample size."""
    return SAMPLE_SIZES.get(code_letter)


def get_accept_reject(code_letter: str, aql_level: str) -> tuple[int, int] | None:
    """Given a code letter and AQL level, return (accept, reject) or None if no plan."""
    entry = _ACCEPT_REJECT.get(code_letter, {}).get(aql_level)
    if entry is None:
        return None
    return (entry[0], entry[1])


def lookup(lot_size: int, inspection_level: str, aql_level: str) -> dict:
    """Full AQL lookup: lot size + inspection level + AQL -> sample size, accept, reject.

    Returns a dict with keys: code_letter, sample_size, accept, reject.
    Any value may be None if no plan is available for the combination.
    """
    code = get_code_letter(lot_size, inspection_level)
    if code is None:
        return {"code_letter": None, "sample_size": None, "accept": None, "reject": None}

    sample = get_sample_size(code)
    ar = get_accept_reject(code, aql_level)

    return {
        "code_letter": code,
        "sample_size": sample,
        "accept": ar[0] if ar else None,
        "reject": ar[1] if ar else None,
    }
