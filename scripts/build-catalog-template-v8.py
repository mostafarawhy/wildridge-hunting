import copy
import re
import sys
from pathlib import Path

import openpyxl
from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.utils import column_index_from_string, get_column_letter, range_boundaries
from openpyxl.worksheet.cell_range import MultiCellRange
from openpyxl.worksheet.datavalidation import DataValidation

USAGE = "usage: build-catalog-template-v8.py SRC DST [--example]"
args = [a for a in sys.argv[1:] if a != "--example"]
EXAMPLE = "--example" in sys.argv[1:]
if len(args) != 2:
    sys.exit(USAGE)
SRC = Path(args[0])
DST = Path(args[1])

LOYALTY_COL = 23
DV_LAST_ROW = 2003

BRAND_NAME = "Wildridge Hunting"
TEMPLATE_ID = "wildridge-catalog-import"

HELP_EXAMPLES = {
    "slug_en": "halvard-ridgeline-34-air-rifle",
    "brand": "Halvard Arms",
    "name_en": "Halvard Ridgeline 34 Air Rifle",
    "name_ar": "بندقية هوائية هالفارد ريدجلاين 34",
    "tags": "break-barrel, beech-stock",
}

EXAMPLE_PRODUCTS = {
    "AK-001": {
        "brand": "Halvard Arms",
        "name_en": "Halvard Ridgeline 34 Air Rifle",
        "name_ar": "بندقية هوائية هالفارد ريدجلاين 34",
        "tags": "walnut-stock, break-barrel, beginner-friendly",
        "description_en": "Spring piston air rifle. 18 joules. Exceptional accuracy. Walnut-finish stock.",
        "description_ar": "بندقية هوائية زنبركية. قوة 18 جول. دقة استثنائية. أخمص بتشطيب خشب الجوز.",
    },
    "AK-002": {
        "brand": "Brightfell",
        "name_en": "Brightfell Gale 95 Air Rifle",
        "name_ar": "بندقية هوائية برايتفل غيل 95",
        "tags": "suppressed, moderator, break-barrel",
        "description_en": "Spring piston with built-in sound moderator. 24 joules. 5.5mm caliber.",
        "description_ar": "بندقية زنبركية بمخفّض صوت مدمج. 24 جول. عيار 5.5 مم.",
    },
    "AK-003": {
        "brand": "Halvard Arms",
        "name_en": "Halvard Ranger Air Rifle",
        "name_ar": "بندقية هالفارد رينجر الهوائية",
        "tags": "scope-included, break-barrel, beginner-friendly, value",
        "description_en": "Spring piston. 19.9 joules. Includes 4x32 scope. Durable polymer stock.",
        "description_ar": "بندقية زنبركية. 19.9 جول. منظار 4x32 مشمول. أخمص بوليمر متين.",
    },
    "PCP-001": {
        "brand": "Brightfell",
        "name_en": "Brightfell Ember N1 PCP Rifle",
        "name_ar": "بندقية PCP برايتفل إمبر N1",
        "tags": "pcp, rotary-magazine, high-capacity, competition",
        "description_en": "PCP rifle. 200 bar max. 14-round rotary magazine. Adjustable trigger.",
        "description_ar": "بندقية PCP. 200 بار. مخزن دوار 14 طلقة. زناد قابل للتعديل.",
    },
    "PCP-002": {
        "brand": "Brightfell",
        "name_en": "Brightfell Summit 5 PCP Rifle",
        "name_ar": "بندقية PCP برايتفل سَميت 5",
        "tags": "pcp, premium, competition, accurate",
        "description_en": "Regulated PCP rifle. 230 bar. 10-round magazine. Two-stage adjustable trigger.",
        "description_ar": "بندقية PCP منظّمة. دقة استثنائية. 230 بار. مخزن 10 طلقات. زناد ثنائي المرحلة.",
    },
    "PCP-003": {
        "brand": "Halvard Arms",
        "name_en": "Halvard Classic PCP Rifle",
        "name_ar": "بندقية PCP هالفارد كلاسيك",
        "tags": "pcp, value, high-capacity",
    },
    "CO2-001": {
        "brand": "Torvane",
        "name_en": "Torvane TB-9 CO2 Pistol",
        "name_ar": "مسدس CO2 تورفين TB-9",
        "tags": "co2, semi-auto, training, pistol",
        "description_en": "CO2 pistol. Semi-auto. 8-round magazine. Training and recreation.",
        "description_ar": "مسدس CO2 شبه أوتوماتيك. مخزن 8 طلقات. للتدريب والترفيه.",
    },
    "CO2-002": {
        "brand": "Torvane",
        "name_en": "Torvane Compact Auto 17 CO2 Pistol",
        "name_ar": "مسدس CO2 تورفين كومباكت أوتو 17",
        "tags": "co2, collector, pistol",
        "description_en": "Compact CO2 pistol. 17-round magazine. Collectors and training.",
        "description_ar": "مسدس CO2 مضغوط. مخزن 17 طلقة. للاقتناء والتدريب.",
    },
    "CO2-003": {
        "brand": "Torvane",
        "name_en": "Torvane Match X CO2 Pistol",
        "name_ar": "مسدس CO2 تورفين ماتش X",
        "tags": "co2, pistol, training",
        "description_en": "CO2 pistol. 15-round magazine. Recreational and training.",
        "description_ar": "مسدس CO2. مخزن 15 طلقة. للترفيه والتدريب.",
    },
    "AMM-004": {
        "tags": "9mm, sound-ammo, training, ammo",
        "description_en": "9mm sound ammo. 50 rounds. Training and signalling only.",
        "description_ar": "طلقات صوتية 9 مم. 50 طلقة. للتدريب والإشارة فقط.",
    },
    "AMM-005": {
        "tags": "8mm, sound-ammo, training, ammo",
        "description_en": "8mm sound ammo. 100 rounds. Training and signalling only.",
        "description_ar": "طلقات صوتية 8 مم. 100 طلقة. للتدريب والإشارة فقط.",
    },
}

EXAMPLE_SPECS = {
    ("AK-002", 4): {"value_en": "Built-in moderator", "value_ar": "مدمج"},
    ("CO2-002", 3): {"label_en": "Finish", "label_ar": "التشطيب", "value_en": "Matte black", "value_ar": "أسود مطفي"},
    ("AMM-004", 3): {"label_en": "Use", "label_ar": "الاستخدام", "value_en": "Training and signalling only", "value_ar": "للتدريب والإشارة فقط"},
}

EXAMPLE_IMAGES = {
    "AK-001.jpg": ("Halvard Ridgeline 34 Air Rifle main product image", "بندقية هوائية هالفارد ريدجلاين 34 الصورة الرئيسية"),
    "AK-001-2.jpg": ("Halvard Ridgeline 34 Air Rifle side view", "بندقية هالفارد ريدجلاين 34 من الجانب"),
    "AK-001-3.jpg": ("Halvard Ridgeline 34 walnut stock close-up", "تفاصيل الخشب في بندقية هالفارد ريدجلاين 34"),
    "AK-002.jpg": ("Brightfell Gale 95 Air Rifle main image", "بندقية برايتفل غيل 95 الصورة الرئيسية"),
    "AK-002-2.jpg": ("Brightfell Gale 95 built-in sound moderator", "صامت الصوت المدمج في برايتفل غيل 95"),
    "AK-003.jpg": ("Halvard Ranger with included scope", "بندقية هالفارد رينجر مع المنظار المشمول"),
    "AK-003-2.jpg": ("Halvard Ranger stock and trigger", "هالفارد رينجر الأخمص والزناد"),
    "PCP-001.jpg": ("Brightfell Ember N1 main image", "بندقية PCP برايتفل إمبر الصورة الرئيسية"),
    "PCP-001-2.jpg": ("Brightfell Ember rotary magazine", "المخزن الدوار لبندقية برايتفل إمبر"),
    "PCP-001-3.jpg": ("Brightfell Ember air cylinder", "خزان هواء بندقية برايتفل إمبر"),
    "PCP-002.jpg": ("Brightfell Summit 5 main image", "بندقية PCP برايتفل سَميت 5 الصورة الرئيسية"),
    "PCP-002-2.jpg": ("Brightfell Summit 5 two-stage trigger", "زناد بندقية برايتفل سَميت ثنائي المرحلة"),
    "PCP-003.jpg": ("Halvard Classic PCP main image", "بندقية PCP هالفارد كلاسيك الصورة الرئيسية"),
    "CO2-001.jpg": ("Torvane TB-9 main image", "مسدس تورفين TB-9 الصورة الرئيسية"),
    "CO2-001-2.jpg": ("Torvane TB-9 magazine and barrel", "مخزن وماسورة مسدس تورفين TB-9"),
    "CO2-002.jpg": ("Torvane Compact Auto 17 main image", "مسدس تورفين كومباكت أوتو 17 الصورة الرئيسية"),
    "CO2-003.jpg": ("Torvane Match X main image", "مسدس تورفين ماتش X الصورة الرئيسية"),
}

def new_index(col):
    if col < LOYALTY_COL:
        return col
    if col == LOYALTY_COL:
        return col + 2
    return col + 4


def shift_sqref(sqref):
    out = []
    for rng in str(sqref).split():
        min_col, min_row, max_col, max_row = range_boundaries(rng)
        a = get_column_letter(new_index(min_col))
        b = get_column_letter(new_index(max_col))
        if min_col == max_col and min_row == max_row:
            out.append(f"{a}{min_row}")
        else:
            out.append(f"{a}{min_row}:{b}{max_row}")
    return MultiCellRange(" ".join(out))


def copy_style(src, dst):
    dst._style = copy.copy(src._style)


wb = openpyxl.load_workbook(SRC)
ws = wb["Products"]
LAST_ROW = ws.max_row

old_widths = {}
for cd in ws.column_dimensions.values():
    for idx in range(cd.min, cd.max + 1):
        old_widths[idx] = cd.width

ws.move_range(f"X1:AH{LAST_ROW}", rows=0, cols=4)
ws.move_range(f"W1:W{LAST_ROW}", rows=0, cols=2)

points_col = LOYALTY_COL + 2
new_cols = {
    LOYALTY_COL: (
        "loyalty_rule",
        "Optional",
        "Standard, Boosted, Fixed or No points.\n"
        "Standard follows the store rate. Boosted multiplies it. Fixed sets points per unit. No points turns earning off.\n"
        "The rule clears what it does not use: the multiplier unless Boosted, fixed points unless Fixed, the dates under Standard or No points.\n"
        "New SKU: empty = Standard. Existing SKU: empty keeps the current rule.\ne.g. Boosted",
        "@",
    ),
    LOYALTY_COL + 1: (
        "loyalty_multiplier",
        "Optional",
        "Boosted only, refused for any other rule. Multiplier from 1.1 to 10, one decimal, applied to the store rate.\n"
        "Required when the row sets Boosted on a product with no multiplier. Existing SKU: empty keeps the current value.\ne.g. 2",
        "0.0",
    ),
    LOYALTY_COL + 3: (
        "loyalty_starts",
        "Optional",
        "Boosted or Fixed only, refused for Standard or No points. First Dubai day the rule applies, as 2026-10-01. Empty = no start date; on an existing SKU empty keeps the current date.\n"
        "Outside the dates the product earns the store rate.",
        "yyyy-mm-dd",
    ),
    LOYALTY_COL + 4: (
        "loyalty_ends",
        "Optional",
        "Boosted or Fixed only, refused for Standard or No points. Last Dubai day the rule applies, to the end of that day, as 2026-10-31. Not before loyalty_starts. Empty = no end date; on an existing SKU empty keeps the current date.",
        "yyyy-mm-dd",
    ),
}

for col, (key, tag, help_text, number_format) in new_cols.items():
    for row in range(1, LAST_ROW + 1):
        copy_style(ws.cell(row, points_col), ws.cell(row, col))
    ws.cell(1, col).value = key
    ws.cell(2, col).value = tag
    ws.cell(3, col).value = help_text
    for row in range(4, LAST_ROW + 1):
        ws.cell(row, col).number_format = number_format

ws.cell(3, points_col).value = (
    "Fixed only, refused for any other rule. Whole points per unit, 1 to 100,000, replacing the store rate.\n"
    "Required when the row sets Fixed on a product with no fixed points. Existing SKU: empty keeps the current value.\ne.g. 165"
)

new_widths = {}
for idx, width in old_widths.items():
    new_widths[new_index(idx)] = width
new_widths[LOYALTY_COL] = 18
new_widths[LOYALTY_COL + 1] = 18
new_widths[LOYALTY_COL + 3] = 18
new_widths[LOYALTY_COL + 4] = 18
new_widths[points_col] = 26

for key in list(ws.column_dimensions.keys()):
    del ws.column_dimensions[key]
for idx, width in sorted(new_widths.items()):
    ws.column_dimensions[get_column_letter(idx)].width = width

for dv in ws.data_validations.dataValidation:
    dv.sqref = shift_sqref(dv.sqref)

rule_dv = DataValidation(
    type="list",
    formula1='"Standard,Boosted,Fixed,No points"',
    allow_blank=True,
    showErrorMessage=True,
    error="Allowed: Standard, Boosted, Fixed, No points",
)
rule_dv.add(f"{get_column_letter(LOYALTY_COL)}4:{get_column_letter(LOYALTY_COL)}{DV_LAST_ROW}")
ws.data_validations.append(rule_dv)

multiplier_dv = DataValidation(
    type="decimal",
    operator="between",
    formula1="1.1",
    formula2="10",
    allow_blank=True,
    showErrorMessage=True,
    error="Number from 1.1 to 10, one decimal.",
)
multiplier_dv.add(f"X4:X{DV_LAST_ROW}")
ws.data_validations.append(multiplier_dv)

points_dvs = [dv for dv in ws.data_validations.dataValidation if str(dv.sqref) == f"Y4:Y{DV_LAST_ROW}"]
assert len(points_dvs) == 1, len(points_dvs)
points_dv = points_dvs[0]
points_dv.type = "whole"
points_dv.operator = "between"
points_dv.formula1 = "1"
points_dv.formula2 = "100000"
points_dv.allow_blank = True
points_dv.showErrorMessage = True
points_dv.error = "Whole number from 1 to 100,000."

for day_col in ("Z", "AA"):
    day_dv = DataValidation(
        type="date",
        operator="between",
        formula1="DATE(2020,1,1)",
        formula2="DATE(2099,12,31)",
        allow_blank=True,
        showErrorMessage=True,
        error="A date, as 2026-10-31.",
    )
    day_dv.add(f"{day_col}4:{day_col}{DV_LAST_ROW}")
    ws.data_validations.append(day_dv)

guide = wb["Column_Guide"]
guide_row = None
for r in range(2, guide.max_row + 1):
    if guide.cell(r, 1).value == "Products" and guide.cell(r, 2).value == "loyalty_points_earn":
        guide_row = r
        break
if guide_row is None:
    sys.exit("loyalty_points_earn row not found in Column_Guide")

template_styles = [copy.copy(guide.cell(guide_row, c)._style) for c in range(1, 8)]

guide.insert_rows(guide_row + 1, 2)
guide.insert_rows(guide_row, 2)

guide_rows = {
    guide_row: (
        "loyalty_rule",
        "Optional",
        "Standard, Boosted, Fixed or No points. Standard follows the store rate; Boosted multiplies it; Fixed sets points per unit; No points turns earning off for this product. The rule clears what it does not use: the multiplier unless Boosted, fixed points unless Fixed, the dates under Standard or No points.",
        "Empty = Standard",
        "Empty keeps the current rule; a filled cell clears the values the rule does not use",
        "Product.loyaltyRule",
    ),
    guide_row + 1: (
        "loyalty_multiplier",
        "Optional",
        "Boosted only. Multiplier from 1.1 to 10, one decimal, applied to the store points rate. Refused when the rule is not Boosted.",
        "Required when the rule is Boosted",
        "Empty keeps the current value; required when the row switches the product to Boosted",
        "Product.loyaltyMultiplier",
    ),
    guide_row + 3: (
        "loyalty_starts",
        "Optional",
        "Boosted or Fixed only, refused for Standard or No points. First Dubai day the rule applies, typed as 2026-10-01 or a real date cell. Empty = no start date. Outside the dates the product earns the store rate.",
        "Empty = no start date",
        "Empty keeps the current value",
        "Product.loyaltyRuleStartsAt",
    ),
    guide_row + 4: (
        "loyalty_ends",
        "Optional",
        "Boosted or Fixed only, refused for Standard or No points. Last Dubai day the rule applies (to the end of that day, Dubai time), typed as 2026-10-31 or a real date cell. Not before loyalty_starts. Empty = no end date.",
        "Empty = no end date",
        "Empty keeps the current value",
        "Product.loyaltyRuleEndsAt",
    ),
}

for r, (key, requirement, rule, new_record, existing, stored) in guide_rows.items():
    values = ["Products", key, requirement, rule, new_record, existing, stored]
    for c, value in enumerate(values, start=1):
        cell = guide.cell(r, c)
        cell.value = value
        cell._style = copy.copy(template_styles[c - 1])

points_guide_row = guide_row + 2
guide.cell(points_guide_row, 4).value = (
    "Fixed rule only. Whole points per unit, 1 to 100,000, replacing the store rate. Refused when the rule is not Fixed."
)
guide.cell(points_guide_row, 5).value = "Required when the rule is Fixed"
guide.cell(points_guide_row, 6).value = "Empty keeps the current value; required when the row switches the product to Fixed"
guide.auto_filter.ref = f"A1:G{guide.max_row}"

PRODUCTS_REF = re.compile(
    r"Products!(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?"
)


def remap_products_ref(match):
    def letter(text):
        return get_column_letter(new_index(column_index_from_string(text)))

    out = f"Products!{match.group(1)}{letter(match.group(2))}{match.group(3)}{match.group(4)}"
    if match.group(6):
        out += f":{match.group(5)}{letter(match.group(6))}{match.group(7)}{match.group(8)}"
    return out


for sheet in wb.worksheets:
    if sheet.title == "Products":
        continue
    for sheet_row in sheet.iter_rows():
        for cell in sheet_row:
            if isinstance(cell.value, str) and cell.value.startswith("=") and "Products!" in cell.value:
                cell.value = PRODUCTS_REF.sub(remap_products_ref, cell.value)

readme = wb["README"]
README_OLD = "On an update an empty cell keeps the current value. Import never clears a value: to remove one, edit the record in the admin."
README_NEW = "On an update an empty cell keeps the current value. Import never clears a value, with one exception: a loyalty_rule clears the values that rule does not use. To remove any other value, edit the record in the admin."
assert readme["B14"].value == README_OLD, readme["B14"].value
readme["B14"].value = README_NEW

checks = wb["Checks"]
assert checks["A29"].value == "Result", checks["A29"].value
assert checks["B29"].value == '=IF(COUNTIF(B2:B27,"FAIL")=0,"READY","FIX FAILS")', checks["B29"].value

PW = "Products!$W$4:$W$2003"
PX = "Products!$X$4:$X$2003"
PY = "Products!$Y$4:$Y$2003"
PZ = "Products!$Z$4:$Z$2003"
PAA = "Products!$AA$4:$AA$2003"
PA = "Products!$A$4:$A$2003"

new_checks = [
    (
        28,
        "Invalid loyalty_rule",
        "FAIL",
        f'=SUMPRODUCT(({PW}<>"")*((({PW}="Standard")+({PW}="Boosted")+({PW}="Fixed")+({PW}="No points"))=0))',
        "Standard, Boosted, Fixed or No points.",
    ),
    (
        29,
        "loyalty_multiplier outside 1.1 to 10",
        "FAIL",
        f'=SUMPRODUCT(({PX}<>"")*((({PX}<1.1)+({PX}>10))>0))',
        "A number from 1.1 to 10, one decimal. The dry run checks the decimal.",
    ),
    (
        30,
        "loyalty_points_earn outside 1 to 100,000",
        "FAIL",
        f'=SUMPRODUCT(({PY}<>"")*((({PY}<1)+({PY}>100000))>0))',
        "Whole points per unit, 1 to 100,000.",
    ),
    (
        31,
        "Loyalty value that does not fit the row's loyalty_rule",
        "FAIL",
        f'=SUMPRODUCT(({PW}<>"")*(((({PX}<>"")*({PW}<>"Boosted"))+(({PY}<>"")*({PW}<>"Fixed"))+((({PZ}<>"")+({PAA}<>""))*(({PW}="Standard")+({PW}="No points"))))>0))',
        "A multiplier needs Boosted, fixed points need Fixed, and dates need Boosted or Fixed. Count = rows involved.",
    ),
    (
        32,
        "Boosted with no multiplier, or Fixed with no points",
        "CHECK",
        f'=SUMPRODUCT(({PW}="Boosted")*({PX}=""))+SUMPRODUCT(({PW}="Fixed")*({PY}=""))',
        "Fine only for a product that already has this rule and its value. Count = rows involved.",
    ),
    (
        33,
        "Loyalty values with no loyalty_rule",
        "CHECK",
        f'=SUMPRODUCT(({PA}<>"")*({PW}="")*((({PX}<>"")+({PY}<>"")+({PZ}<>"")+({PAA}<>""))>0))',
        "Fine only for a product that already has the matching rule. A new product with no rule is Standard, which refuses them.",
    ),
    (
        34,
        "loyalty_ends before loyalty_starts",
        "FAIL",
        f"=SUMPRODUCT(ISNUMBER({PZ})*ISNUMBER({PAA})*({PAA}<{PZ}))",
        "The last day cannot come before the first. Covers date cells; the dry run also checks typed dates.",
    ),
]

check_style = [copy.copy(checks.cell(27, c)._style) for c in range(1, 6)]
result_style = [copy.copy(checks.cell(29, c)._style) for c in range(1, 6)]
result_d = checks["D29"].value
result_height = checks.row_dimensions[29].height
check_height = checks.row_dimensions[27].height

for c in range(1, 6):
    checks.cell(29, c).value = None

for r, name, fail_word, count_formula, meaning in new_checks:
    checks.cell(r, 1).value = name
    checks.cell(r, 2).value = f'=IF(C{r}=0,"PASS","{fail_word}")'
    checks.cell(r, 3).value = count_formula
    checks.cell(r, 4).value = meaning
    checks.cell(r, 5).value = "Products"
    for c in range(1, 6):
        checks.cell(r, c)._style = copy.copy(check_style[c - 1])
    checks.row_dimensions[r].height = check_height

checks.cell(36, 1).value = "Result"
checks.cell(36, 2).value = '=IF(COUNTIF(B2:B34,"FAIL")=0,"READY","FIX FAILS")'
checks.cell(36, 3).value = '=COUNTIF(B2:B34,"FAIL")'
checks.cell(36, 4).value = result_d
for c in range(1, 6):
    checks.cell(36, c)._style = copy.copy(result_style[c - 1])
checks.row_dimensions[36].height = result_height

old_cf = checks.conditional_formatting
new_cf = ConditionalFormattingList()
for cf in old_cf:
    assert str(cf.sqref) == "B2:B29", str(cf.sqref)
    for rule in cf.rules:
        new_cf.add("B2:B36", rule)
checks.conditional_formatting = new_cf

if EXAMPLE:
    import datetime

    loyalty_cols = range(23, 28)
    example_rows = {
        "AK-001": {23: "Boosted", 24: 2, 26: datetime.date(2026, 11, 1), 27: datetime.date(2026, 11, 30)},
        "AK-002": {23: "Standard"},
        "PCP-002": {23: "Fixed", 25: 480},
        "AMM-001": {23: "No points"},
    }
    sku_rows = {}
    for r in range(4, LAST_ROW + 1):
        sku = ws.cell(r, 1).value
        if sku in example_rows:
            assert sku not in sku_rows, f"{sku} appears more than once"
            sku_rows[sku] = r
    for sku in example_rows:
        assert sku in sku_rows, f"{sku} not found"
    for r in range(4, LAST_ROW + 1):
        if r in sku_rows.values():
            continue
        for c in loyalty_cols:
            assert ws.cell(r, c).value in (None, ""), f"row {r} col {c} already holds {ws.cell(r, c).value!r}"
    for sku, values in example_rows.items():
        for c, value in values.items():
            ws.cell(sku_rows[sku], c).value = value

meta = wb["_meta"]
for row in meta.iter_rows():
    if row[0].value == "version":
        row[1].value = "8"
    if row[0].value == "template":
        row[1].value = TEMPLATE_ID

wb["README"]["A1"].value = f"{BRAND_NAME} — Catalog Import"
wb.properties.creator = BRAND_NAME
wb.properties.title = f"{BRAND_NAME} Catalog Import"
wb.properties.lastModifiedBy = BRAND_NAME

def header_map(sheet):
    return {sheet.cell(1, c).value: c for c in range(1, sheet.max_column + 1) if sheet.cell(1, c).value}


def swap_example(text, value):
    return re.sub(r"(e\.g\. ).*\Z", lambda m: m.group(1) + value, text, flags=re.S)


products = wb["Products"]
product_cols = header_map(products)
for key, value in HELP_EXAMPLES.items():
    cell = products.cell(3, product_cols[key])
    cell.value = swap_example(cell.value, value)
guide = wb["Column_Guide"]
guide_rows = 0
for r in range(2, guide.max_row + 1):
    if guide.cell(r, 1).value == "Products" and guide.cell(r, 2).value in HELP_EXAMPLES:
        cell = guide.cell(r, 4)
        cell.value = swap_example(cell.value, HELP_EXAMPLES[guide.cell(r, 2).value])
        guide_rows += 1
assert guide_rows == len(HELP_EXAMPLES), guide_rows

if EXAMPLE:
    product_rows = {products.cell(r, 1).value: r for r in range(4, products.max_row + 1) if products.cell(r, 1).value}
    for sku, values in EXAMPLE_PRODUCTS.items():
        for key, value in values.items():
            products.cell(product_rows[sku], product_cols[key]).value = value
    specs = wb["Specs"]
    spec_cols = header_map(specs)
    spec_rows = {
        (specs.cell(r, 1).value, specs.cell(r, 2).value): r
        for r in range(4, specs.max_row + 1)
        if specs.cell(r, 1).value
    }
    for key, values in EXAMPLE_SPECS.items():
        for col, value in values.items():
            specs.cell(spec_rows[key], spec_cols[col]).value = value
    images = wb["Images"]
    image_cols = header_map(images)
    image_rows = {images.cell(r, 2).value: r for r in range(4, images.max_row + 1) if images.cell(r, 2).value}
    for filename, (alt_en, alt_ar) in EXAMPLE_IMAGES.items():
        images.cell(image_rows[filename], image_cols["alt_text_en"]).value = alt_en
        images.cell(image_rows[filename], image_cols["alt_text_ar"]).value = alt_ar

wb.save(DST)
print("wrote", DST)
