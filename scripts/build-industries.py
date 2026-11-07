"""Builds src/data/industries.json from Prof. Aswath Damodaran's public industry datasets (NYU Stern).
Run once a year, after his January update:  python3 -m venv /tmp/xl && /tmp/xl/bin/pip install xlrd && /tmp/xl/bin/python scripts/build-industries.py
Source: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html (US companies)."""
import json, os, sys, urllib.request, xlrd

BASE = 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'industries.json')

def sheet(name):
    path = f'/tmp/dam_{name}.xls'
    urllib.request.urlretrieve(BASE + name + '.xls', path)
    return xlrd.open_workbook(path).sheet_by_name('Industry Averages')

def table(sh, header_row):
    head = [str(c).strip() for c in sh.row_values(header_row)]
    out = {}
    for r in range(header_row + 1, sh.nrows):
        row = sh.row_values(r)
        name = str(row[0]).strip()
        if name:
            out[name] = row
    return head, out

# spelling slips in the source spreadsheets
FIX = {'Heathcare Information and Technology': 'Healthcare Information and Technology', 'Rubber& Tires': 'Rubber & Tires'}

def num(x, d=4):
    return round(float(x), d) if isinstance(x, (int, float)) and x == x else None

betas_sh, wacc_sh, ev_sh, pe_sh, mg_sh = (sheet(n) for n in ('betas', 'wacc', 'vebitda', 'pedata', 'margin'))
_, B = table(betas_sh, 9); _, W = table(wacc_sh, 18); _, E = table(ev_sh, 8); _, P = table(pe_sh, 7); _, M = table(mg_sh, 8)
asof = xlrd.xldate_as_datetime(betas_sh.cell_value(0, 1), 0).date().isoformat()
rf, erp, tax = float(wacc_sh.cell_value(8, 3)), float(wacc_sh.cell_value(9, 3)), float(wacc_sh.cell_value(12, 5))

rows, market = [], {}
for name, b in B.items():
    if name not in W or name not in E or name not in P or name not in M:
        print('skip (missing in a file):', name, file=sys.stderr); continue
    w, e, p, m = W[name], E[name], P[name], M[name]
    rec = dict(name=FIX.get(name, name), firms=int(b[1]), beta=num(b[2], 3), de=num(b[3], 3), tax=num(b[4], 3), unlevBeta=num(b[5], 3),
               costEquity=num(w[3], 4), equityWeight=num(w[4], 4), costDebt=num(w[6], 4), debtWeight=num(w[9], 4), wacc=num(w[10], 4),
               evEbitda=num(e[3], 2), evEbit=num(e[4], 2), pe=num(p[4], 2), fwdPe=num(p[5], 2), losing=num(p[2], 3), growth=num(p[8], 3),
               grossMargin=num(m[2], 3), netMargin=num(m[3], 3), opMargin=num(m[4], 3), ebitdaMargin=num(m[11], 3))
    if name.startswith('Total Market'):
        market['exFin' if '(' in name else 'all'] = rec
    else:
        rows.append(rec)
rows.sort(key=lambda r: r['name'])
json.dump(dict(asOf=asof, rf=rf, erp=erp, marginalTax=tax, source='Prof. Aswath Damodaran, NYU Stern (US companies)', market=market, industries=rows), open(OUT, 'w'), separators=(',', ':'))
print('wrote', len(rows), 'industries, as of', asof, 'rf', rf, 'erp', erp)
