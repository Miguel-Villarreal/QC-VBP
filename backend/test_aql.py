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
    # Code K at AQL 2.5 = 7/8 (confirmed from standard)
    assert get_accept_reject("K", "2.5") == (7, 8)
    # Code K at AQL 1.0 = 3/4
    assert get_accept_reject("K", "1.0") == (3, 4)
    # Code L at AQL 2.5 = 10/11
    assert get_accept_reject("L", "2.5") == (10, 11)
    # Code H at AQL 0.65 = 1/2
    assert get_accept_reject("H", "0.65") == (1, 2)
    # Code A at AQL 2.5 = 0/1
    assert get_accept_reject("A", "2.5") == (0, 1)
    # Code J at AQL 1.0 = 2/3
    assert get_accept_reject("J", "1.0") == (2, 3)
    # Code L at AQL 6.5 = 21/22
    assert get_accept_reject("L", "6.5") == (21, 22)
    # Code R at AQL 0.065 = 3/4
    assert get_accept_reject("R", "0.065") == (3, 4)


def test_full_lookup():
    # Lot 3000, Level II, AQL 2.5 -> K, 125, 7/8
    result = lookup(3000, "II", "2.5")
    assert result["code_letter"] == "K"
    assert result["sample_size"] == 125
    assert result["accept"] == 7
    assert result["reject"] == 8

    # Lot 4000, Level II, AQL 2.5 -> L, 200, 10/11
    result = lookup(4000, "II", "2.5")
    assert result["code_letter"] == "L"
    assert result["sample_size"] == 200
    assert result["accept"] == 10
    assert result["reject"] == 11

    # Lot 500, Level II, AQL 1.0 -> H, 50, 1/2
    result = lookup(500, "II", "1.0")
    assert result["code_letter"] == "H"
    assert result["sample_size"] == 50
    assert result["accept"] == 1
    assert result["reject"] == 2


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
