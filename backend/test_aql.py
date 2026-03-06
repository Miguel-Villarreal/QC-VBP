"""Unit tests for AQL table lookups against known values from ANSI/ASQ Z1.4."""
from aql import get_code_letter, get_sample_size, get_accept_reject, lookup


def test_code_letters():
    # Table I spot checks
    assert get_code_letter(5, "II") == "A"
    assert get_code_letter(50, "II") == "D"
    assert get_code_letter(500, "II") == "H"
    assert get_code_letter(4000, "II") == "L"
    assert get_code_letter(15000, "II") == "M"
    assert get_code_letter(100000, "II") == "N"
    # Level I gives smaller samples
    assert get_code_letter(4000, "I") == "J"
    # Level III gives larger samples
    assert get_code_letter(4000, "III") == "M"
    # Special levels
    assert get_code_letter(4000, "S-1") == "C"
    assert get_code_letter(4000, "S-4") == "G"
    # Edge: lot size 2
    assert get_code_letter(2, "II") == "A"
    # Edge: very large lot
    assert get_code_letter(1000000, "II") == "Q"


def test_sample_sizes():
    assert get_sample_size("A") == 2
    assert get_sample_size("H") == 50
    assert get_sample_size("L") == 200
    assert get_sample_size("R") == 2000
    assert get_sample_size("Z") is None  # invalid


def test_accept_reject():
    # Worked example from AQL_TABLES.md: code L at AQL 2.5 = Ac 21, Re 22
    assert get_accept_reject("L", "2.5") == (21, 22)
    # Code H at AQL 0.65 = 2/3
    assert get_accept_reject("H", "0.65") == (2, 3)
    # Code A at AQL 2.5 = 0/1
    assert get_accept_reject("A", "2.5") == (0, 1)
    # Code J at AQL 1.0 = 5/6
    assert get_accept_reject("J", "1.0") == (5, 6)
    # No plan available: code A at AQL 0.065
    assert get_accept_reject("A", "0.065") is None
    # Low AQL: code N at AQL 0.010 = 0/1
    assert get_accept_reject("N", "0.010") == (0, 1)
    # High AQL: code A at AQL 10 = 1/2
    assert get_accept_reject("A", "10") == (1, 2)


def test_full_lookup():
    # The worked example: lot 4000, Level II, AQL 2.5
    result = lookup(4000, "II", "2.5")
    assert result["code_letter"] == "L"
    assert result["sample_size"] == 200
    assert result["accept"] == 21
    assert result["reject"] == 22

    # Lot 500, Level II, AQL 1.0
    result = lookup(500, "II", "1.0")
    assert result["code_letter"] == "H"
    assert result["sample_size"] == 50
    assert result["accept"] == 3
    assert result["reject"] == 4

    # No plan for small lot at tight AQL
    result = lookup(10, "II", "0.010")
    assert result["code_letter"] == "B"  # lot 10 -> code B at level II
    assert result["sample_size"] == 3
    assert result["accept"] is None  # but no Ac/Re plan
    assert result["reject"] is None


def test_lot_size_boundaries():
    # Verify boundary lot sizes map correctly
    assert get_code_letter(8, "II") == "A"    # upper boundary of 2-8
    assert get_code_letter(9, "II") == "B"    # lower boundary of 9-15
    assert get_code_letter(3200, "II") == "K"  # upper boundary of 1201-3200
    assert get_code_letter(3201, "II") == "L"  # lower boundary of 3201-10000


if __name__ == "__main__":
    test_code_letters()
    test_sample_sizes()
    test_accept_reject()
    test_full_lookup()
    test_lot_size_boundaries()
    print("All AQL tests passed.")
