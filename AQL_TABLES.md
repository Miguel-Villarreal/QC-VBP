# AQL Reference Tables - ANSI/ASQ Z1.4 (ISO 2859-1)

Step 2 deliverable. These tables are sourced from the ANSI/ASQ Z1.4-2003 (R2018) standard,
cross-referenced against multiple published AQL references.

---

## Table I: Sample Size Code Letters

Given a lot size and inspection level, look up the code letter.

| Lot Size | S-1 | S-2 | S-3 | S-4 | I | II | III |
|-----------------|-----|-----|-----|-----|---|----|----|
| 2 - 8 | A | A | A | A | A | A | B |
| 9 - 15 | A | A | A | A | A | B | C |
| 16 - 25 | A | A | B | B | B | C | D |
| 26 - 50 | A | B | B | C | C | D | E |
| 51 - 90 | B | B | C | C | C | E | F |
| 91 - 150 | B | B | C | D | D | F | G |
| 151 - 280 | B | C | D | E | E | G | H |
| 281 - 500 | B | C | D | E | F | H | J |
| 501 - 1200 | C | C | E | F | G | J | K |
| 1201 - 3200 | C | D | E | G | H | K | L |
| 3201 - 10000 | C | D | F | G | J | L | M |
| 10001 - 35000 | C | D | F | H | K | M | N |
| 35001 - 150000 | D | E | G | J | L | N | P |
| 150001 - 500000 | D | E | G | J | M | P | Q |
| 500001+ | D | E | H | K | N | Q | R |

---

## Sample Sizes by Code Letter

| Code | A | B | C | D | E | F | G | H | J | K | L | M | N | P | Q | R |
|------|---|---|---|---|----|----|----|----|----|----|-----|-----|-----|-----|------|------|
| n | 2 | 3 | 5 | 8 | 13 | 20 | 32 | 50 | 80 | 125 | 200 | 315 | 500 | 800 | 1250 | 2000 |

---

## Table II-A: Single Sampling Plans for Normal Inspection

Accept/Reject numbers (Ac/Re) for each code letter and AQL value.
Cells marked "--" mean no plan is available for that combination; use the arrow rules:
- If the lot size is too small for the AQL, use the first available plan BELOW (larger sample).
- If the lot size is too large for the AQL, use the first available plan ABOVE (smaller sample).

### Core Range (AQL 0.065 to 6.5) - Verified

| Code | n | 0.065 | 0.10 | 0.15 | 0.25 | 0.40 | 0.65 | 1.0 | 1.5 | 2.5 | 4.0 | 6.5 |
|------|------|-------|------|------|------|------|------|------|------|------|------|------|
| A | 2 | -- | -- | -- | -- | -- | -- | -- | -- | 0/1 | 0/1 | 1/2 |
| B | 3 | -- | -- | -- | -- | -- | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 |
| C | 5 | -- | -- | -- | -- | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 |
| D | 8 | -- | -- | -- | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 |
| E | 13 | -- | -- | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 |
| F | 20 | -- | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 |
| G | 32 | -- | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11 |
| H | 50 | -- | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15 |
| J | 80 | 0/1 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22 |
| K | 125 | 0/1 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- |
| L | 200 | 0/1 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- | -- |
| M | 315 | 1/2 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- | -- | -- |
| N | 500 | 2/3 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- | -- | -- | -- |
| P | 800 | 3/4 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- | -- | -- | -- | -- |
| Q | 1250 | 5/6 | 7/8 | 10/11| 14/15| 21/22| -- | -- | -- | -- | -- | -- |
| R | 2000 | 7/8 | 10/11| 14/15| 21/22| -- | -- | -- | -- | -- | -- | -- |

### Extended Range - Low AQL (0.010 to 0.040)

These are for very tight quality requirements. Most combinations require very large samples.

| Code | n | 0.010 | 0.015 | 0.025 | 0.040 |
|------|------|-------|-------|-------|-------|
| A-J | 2-80 | -- | -- | -- | -- |
| K | 125 | -- | -- | -- | 0/1 |
| L | 200 | -- | -- | 0/1 | 0/1 |
| M | 315 | -- | 0/1 | 0/1 | 0/1 |
| N | 500 | 0/1 | 0/1 | 0/1 | 1/2 |
| P | 800 | 0/1 | 0/1 | 1/2 | 2/3 |
| Q | 1250 | 0/1 | 1/2 | 2/3 | 3/4 |
| R | 2000 | 1/2 | 2/3 | 3/4 | 5/6 |

### Extended Range - High AQL (10 and 15)

These are lenient quality levels, rarely used for percent nonconforming.

| Code | n | 10 | 15 |
|------|------|------|------|
| A | 2 | 1/2 | 2/3 |
| B | 3 | 2/3 | 3/4 |
| C | 5 | 3/4 | 5/6 |
| D | 8 | 5/6 | 7/8 |
| E | 13 | 7/8 | 10/11|
| F | 20 | 10/11| 14/15|
| G | 32 | 14/15| 21/22|
| H | 50 | 21/22| -- |
| J-R | 80+ | -- | -- |

---

## How to Use These Tables

1. **Look up the code letter** in Table I using the lot size and inspection level (e.g., lot of 3,500 at Level II = code L)
2. **Find the sample size** from the code letter (L = 200 units)
3. **Find the Ac/Re numbers** in Table II-A at the intersection of the code letter and AQL level (L at AQL 2.5 = Ac 21, Re 22)
4. **Decision**: If non-conforming units found <= Ac, the lot PASSES. If >= Re, the lot FAILS.

### Example

- Lot size: 4,000 units
- Inspection level: II (general)
- AQL: 2.5%
- Table I: 3201-10000 at Level II = code letter **L**
- Sample size: **200 units**
- Table II-A: L at 2.5 = **Ac 21, Re 22**
- Inspect 200 units. If 21 or fewer are non-conforming: PASS. If 22 or more: FAIL.

---

## Notes

- The accept numbers used in the standard are: 0, 1, 2, 3, 5, 7, 10, 14, 21
- The reject number is always Ac + 1
- Level II is the most commonly used general inspection level
- AQL values 0.65 to 4.0 cover the majority of practical inspections
- This table covers Normal inspection severity only (Tightened and Reduced plans exist but are not included here)
- The "--" cells follow arrow rules from the standard: use the nearest available plan in the appropriate direction

## Sources

- ANSI/ASQ Z1.4-2003 (R2018): Sampling Procedures and Tables for Inspection by Attributes
- ISO 2859-1:1999: Sampling procedures for inspection by attributes
- Cross-referenced with published AQL charts from Tetra Inspection, QIMA, and InTouch Quality
