#!/usr/bin/env python3
"""Map taxanomy.xlsx -> data.json / data.js (stdlib only, no openpyxl).

Run from the repo root:  python3 tools/xlsx_to_json.py
"""
import os
XLSX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'taxanomy.xlsx')
OUT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import zipfile, re, sys, json
from xml.etree import ElementTree as ET
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
RNS='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
Z=zipfile.ZipFile(XLSX)
# shared strings
ss=[]
try:
    r=ET.fromstring(Z.read('xl/sharedStrings.xml'))
    for si in r:
        ss.append(''.join(t.text or '' for t in si.iter(NS+'t')))
except KeyError: pass
wb=ET.fromstring(Z.read('xl/workbook.xml'))
rels={x.get('Id'):x.get('Target') for x in ET.fromstring(Z.read('xl/_rels/workbook.xml.rels'))}
sheets=[]
for s in wb.iter(NS+'sheet'):
    t=rels[s.get(RNS+'id')]
    if not t.startswith('xl/'): t='xl/'+t.lstrip('/')
    sheets.append((s.get('name'), t))
def colnum(ref):
    c=re.match(r'[A-Z]+',ref).group()
    n=0
    for ch in c: n=n*26+ord(ch)-64
    return n
def read(path):
    root=ET.fromstring(Z.read(path))
    rows={}
    for row in root.iter(NS+'row'):
        ri=int(row.get('r'))
        d={}
        for c in row.iter(NS+'c'):
            v=c.find(NS+'v'); t=c.get('t')
            if t=='inlineStr':
                is_=c.find(NS+'is'); val=''.join(x.text or '' for x in is_.iter(NS+'t')) if is_ is not None else ''
            elif v is None: continue
            elif t=='s': val=ss[int(v.text)]
            else: val=v.text
            if val is None or val=='': continue
            d[colnum(c.get('r'))]=val
        if d: rows[ri]=d
    return rows
intro = read('xl/worksheets/sheet1.xml')
q     = read('xl/worksheets/sheet2.xml')
res   = read('xl/worksheets/sheet4.xml')
sem   = read('xl/worksheets/sheet5.xml')

def cell(rows, r, c):
    return rows.get(r, {}).get(c)

def num(v):
    return None if v is None else round(float(v), 4)

# ---------- Introduction ----------
intro_out = {
    "title": cell(intro,1,1),
    "lead": [cell(intro,r,1) for r in range(3,8)],
    "domainTable": {
        "headers": [cell(intro,8,1), cell(intro,8,2), cell(intro,8,3)],
        "rows": [[cell(intro,r,1), cell(intro,r,2), cell(intro,r,3)] for r in (9,10,11)]
    },
    "body": [cell(intro,r,1) for r in range(13,22)],
    "gridIntro": cell(intro,23,1),
    "grid": [[cell(intro,r,c) for c in (1,2,3)] for r in (24,25,26)],
    "definitionsIntro": [cell(intro,r,1) for r in (28,29,30)],
    "definitions": {
        "headers": [cell(intro,32,1), cell(intro,32,2), cell(intro,32,3)],
        "rows": [[cell(intro,r,1), cell(intro,r,2), cell(intro,r,3)] for r in range(33,39)]
    }
}

# ---------- Semantics ----------
sem_out = {
    "title": "The semantics of capitalism vs socialism",
    "paragraphs": [cell(sem,r,1) for r in sorted(sem)]
}

# ---------- Questions ----------
DIM = {"legal":"Legal", "political":"Political", "economic":"Economic"}
questions = []
note_row3 = None
for r in range(3, 37):
    row = q.get(r)
    if not row: continue
    raw_dim = cell(q,r,16)
    dim = DIM.get((raw_dim or "").strip().lower())
    note = None
    if dim is None:
        note = raw_dim          # row 3 holds a clarifying note in the Dimension cell
        dim = "Legal"           # "who should pass laws" belongs to the legal dimension
    opts = []
    for i in range(5):
        opts.append({
            "label":   cell(q,r,20+i) or cell(q,r,1+i),
            "benefit": num(cell(q,r,6+i)) or 0.0,
            "control": num(cell(q,r,11+i)) or 0.0,
        })
    item = {
        "id": "q%d" % (len(questions)+1),
        "row": r,
        "dimension": dim,
        "type": cell(q,r,17),
        "question": cell(q,r,18),
        "explanation": cell(q,r,19),
        "options": opts,
    }
    if note: item["note"] = note
    questions.append(item)

# ---------- Editorial layer ----------
# Wording changes requested after the workbook was written. Kept here rather than in
# the .xlsx so that re-running this script never loses them. Ops per question id:
#   q_set / q_append / q_replace        - the question text
#   e_set / e_append / e_replace        - the explanation
#   note                                - italic clarification box above the options
#   opt_set                             - replace all five option labels (weights keep their order)
#   opt_replace                         - {old: new} on individual option labels
#   opt_reverse                         - reverse the options, weights travelling with their labels
#   info                                - side-by-side info boxes shown above the options
EDITS = {
    "q2": {
        "note": "Citizen (a person who legally belongs to a country and has citizenship rights)\n"
                "Resident (a person who lives in a particular country or place, but may not be a citizen)",
    },
    "q3": {
        "e_append": "Who should have the power to formulate lawproposals. The competent would be a social group of educated or learned individuals, given the task because of  their skills rather than status, wealth or other reason",
    },
    "q5": {
        "q_append": "(modern day police, ie unelected representatives2)",
    },
    "q7": {
        "q_append": "(modern day usually supreme court, ie unelected representatives)",
    },
    # DRAFT: the brief said only "Q9 examples....". Replace the list below with your own.
    "q9": {
        "q_append": "( fx paying taxes, obeying the law, military or civic service)",
    },
    "q10": {
        "q_replace": [
            ("laws should account for", "laws should make exceptions for"),
            ("members/minority group", "members/minority group ( fx religious, political or sexual minorities)"),
        ],
    },
    "q12": {
    "q_append": "(pick one below)",
        "note": "Political concerns decisions about how society is collectively governed—for example, "
                "who has the power to make decisions, how taxes are raised and spent, what public services "
                "are provided, and what policies the government adopts. “Legal” concerns laws governing "
                "what people do: what conduct is permitted or prohibited, what rights and obligations people "
                "have, how disputes are resolved, and how violations are punished.",
    },
    "q13": {
        "opt_replace": {"adult citizens": "citizens"},
    },
    "q15": {
        "e_append": "Scale goes from strongly agree = everyone should have basically the same influence, "
                    "via no opinion = some difference, to strongly disagree = no barriers to speech based "
                    "on money spent.",
    },
    "q16": {
        "e_append": "(e.g. a recall initiated when a certain percentage of voters sign a petition, triggering "
                    "a special election; the representative’s political party having the power to recall them; "
                    "or voters being able to continuously withdraw their support for the candidate they "
                    "originally voted for).",
    },
    "q20": {
        "q_replace": [("their constituents", "their constituents (voters)")],
    },
    # DRAFT: the brief said "replace fundamental with fundamental ( fx -" and broke off.
    "q21": {
        "q_replace": [("fundamental rights",
                       "fundamental rights ( fx - free speech, freedom of religion, the vote, "
                       "protection from arbitrary arrest)")],
    },
    "q22": {
        "opt_set": [
            "almost perfect equality (gini 10 or less / never existed in modern nations)",
            "fairly equal (gini 20 - denmark 1995 / USSR post WW2)",
            "somewhat equal (gini 30 - Scandinavia 2026)",
            "somewhat unequal (gini 40 - USA 2026)",
            "Limits on wealth and income accumulation is harmful to society and/or immoral (gini 75)",
        ],
        "info": [
            {"title": "gini realistically determines the relation between the poorest and richest 10%:",
             "lines": ["gini 10: almost equal",
                       "gini 20: the richest 10% have about 4 times as much as the poorest 10%",
                       "gini 30: the richest 10% have about 8 times as much as the poorest 10%",
                       "gini 40: the richest 10% have about 30 times as much as the poorest 10%"]},
            {"title": "gini realistically determines what share of the population is below a living income "
                      "— ie half the average — or below the poverty line, ie a quarter of average income:",
             "lines": ["gini 10: almost equal",
                       "gini 20: 10% below living income",
                       "gini 30: 20% below living income and 10% near poverty",
                       "gini 40: 33% below living income and 15% near poverty"]},
        ],
    },
    "q25": {
    "q_append": "(pick one below)",
        "opt_reverse": True,
    },
    "q30": {
        "q_append": "(fx should businesses be able to extract promises of compensation if their economic "
                    "prospects are changed by policy)",
        "e_append": "Tests the strength of property rights.",
    },
    "q33": {
        "e_replace": [("dependence",
                       "dependence (not just workers but also customers or those living near production)")],
    },
}


def join(base, extra):
    base = (base or "").rstrip()
    if base and not base.endswith((".", "?", "!", ";", ":")):
        base += "."
    return (base + " " + extra).strip()


def apply_edits(questions):
    seen = set()
    for q in questions:
        ed = EDITS.get(q["id"])
        if not ed:
            continue
        seen.add(q["id"])
        if "q_set" in ed:
            q["question"] = ed["q_set"]
        if "q_append" in ed:
            q["question"] = (q["question"] or "").rstrip() + " " + ed["q_append"]
        for old, new in ed.get("q_replace", []):
            assert old in q["question"], "%s: %r not in question" % (q["id"], old)
            q["question"] = q["question"].replace(old, new, 1)
        if "e_set" in ed:
            q["explanation"] = ed["e_set"]
        if "e_append" in ed:
            q["explanation"] = join(q.get("explanation"), ed["e_append"])
        for old, new in ed.get("e_replace", []):
            assert old in (q["explanation"] or ""), "%s: %r not in explanation" % (q["id"], old)
            q["explanation"] = q["explanation"].replace(old, new, 1)
        if "note" in ed:
            q["note"] = ed["note"]
        if "opt_set" in ed:
            labels = ed["opt_set"]
            assert len(labels) == len(q["options"]), "%s: need %d labels" % (q["id"], len(q["options"]))
            for opt, label in zip(q["options"], labels):
                opt["label"] = label
        for old, new in ed.get("opt_replace", {}).items():
            hit = [o for o in q["options"] if o["label"] == old]
            assert hit, "%s: no option labelled %r" % (q["id"], old)
            for o in hit:
                o["label"] = new
        if ed.get("opt_reverse"):
            q["options"].reverse()          # weights travel with their labels
        if "info" in ed:
            q["infoBoxes"] = ed["info"]
    missing = set(EDITS) - seen
    assert not missing, "edits for unknown questions: %s" % sorted(missing)
    return questions


apply_edits(questions)

# ---------- Reference figures ----------
notes = {
    "Jefferson":    cell(res,23,1),
    "Kandiaronk":   cell(res,25,1),
}
reference = []
for r in range(2,7):
    reference.append({
        "name": cell(res,r,1),
        "scores": {
            "Economic":  {"benefit": num(cell(res,r,2)), "control": num(cell(res,r,3))},
            "Legal":     {"benefit": num(cell(res,r,4)), "control": num(cell(res,r,5))},
            "Political": {"benefit": num(cell(res,r,6)), "control": num(cell(res,r,7))},
        },
        "note": notes.get(cell(res,r,1))
    })

data = {
    "meta": {
        "title": intro_out["title"],
        "source": "taxanomy.xlsx",
        "scoring": {
            "min": -100, "max": 100,
            "description": "For each dimension, the benefit score is the sum of the chosen options' benefit weights and the control score the sum of their control weights, each clamped to [-100, 100]. Negative = more equal / more popular control; positive = more unequal / more elite control."
        },
        "axes": {
            "benefit": {"label": "Equality of benefits", "negative": "Equality", "positive": "Inequality"},
            "control": {"label": "Equality of control",  "negative": "Popular control", "positive": "Elite control"}
        },
        "dimensions": ["Economic", "Legal", "Political"],
        "chartTitles": {
            "Economic": "Economic equality and control",
            "Legal": "Judicial equality and control",
            "Political": "Political equality and control"
        }
    },
    "introduction": intro_out,
    "semantics": sem_out,
    "questions": questions,
    "reference": reference,
    "referenceNotes": [cell(res,21,1), cell(res,27,1)]
}
json.dump(data, open(os.path.join(OUT,'data.json'),'w'), indent=2, ensure_ascii=False)
print("questions:", len(questions))
from collections import Counter
print(Counter(x["dimension"] for x in questions))

# also emit a browser-loadable copy so the page works straight from file://
with open(os.path.join(OUT,'data.js'),'w') as f:
    f.write('// Generated from taxanomy.xlsx by tools/xlsx_to_json.py - do not edit by hand.\n')
    f.write('window.TAXONOMY_DATA = ')
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write(';\n')
