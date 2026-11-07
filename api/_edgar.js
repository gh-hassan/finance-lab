/* Turns the SEC's "company facts" file into a small, tidy table of annual figures.
   Companies tag the same idea in different ways (and change tags over time), so each line item has a ranked list of tags.
   For every fiscal year we take the first tag in the list that has a value, and the most recently filed value when a year was restated. */

const DAY = 864e5;
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;
const ANNUAL = /^10-K/, DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Line items. `flow` figures cover a year (income and cash flow); `instant` figures are balance sheet dates. */
export const ITEMS = {
  revenue: { kind: 'flow', tags: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'SalesRevenueGoodsNet', 'SalesRevenueServicesNet', 'RevenuesNetOfInterestExpense'] },
  costOfRevenue: { kind: 'flow', tags: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold'] },
  grossProfit: { kind: 'flow', tags: ['GrossProfit'] },
  operatingIncome: { kind: 'flow', tags: ['OperatingIncomeLoss'] },
  netIncome: { kind: 'flow', tags: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'] },
  interestExpense: { kind: 'flow', tags: ['InterestExpense', 'InterestExpenseDebt', 'InterestExpenseNonoperating', 'InterestAndDebtExpense'] },
  incomeTax: { kind: 'flow', tags: ['IncomeTaxExpenseBenefit'] },
  da: { kind: 'flow', tags: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAmortizationAndOther'] },
  cfo: { kind: 'flow', tags: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'] },
  capex: { kind: 'flow', tags: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements'] },
  shares: { kind: 'flow', unit: 'shares', tags: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'] },
  assets: { kind: 'instant', tags: ['Assets'] },
  currentAssets: { kind: 'instant', tags: ['AssetsCurrent'] },
  liabilities: { kind: 'instant', tags: ['Liabilities'] },
  currentLiabilities: { kind: 'instant', tags: ['LiabilitiesCurrent'] },
  equity: { kind: 'instant', tags: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'] },
  equityTotal: { kind: 'instant', tags: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'StockholdersEquity'] },
  cash: { kind: 'instant', tags: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'] },
  debtTotal: { kind: 'instant', tags: ['LongTermDebt', 'DebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligations'] },
  debtLong: { kind: 'instant', tags: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'] },
  debtShort: { kind: 'instant', tags: ['DebtCurrent', 'LongTermDebtCurrent', 'ShortTermBorrowings'] }
};

/** Banks, insurers and other lenders report interest as their business, so margins and "debt" mean something different. */
const FINANCIAL_TAGS = ['Deposits', 'LoansAndLeasesReceivableNetReportedAmount', 'PremiumsEarnedNet', 'InterestAndDividendIncomeOperating', 'PolicyholderBenefitsAndClaimsIncurredNet'];

function collect(fact, kind, unit) {
  const out = new Map();
  const list = fact && fact.units && fact.units[unit];
  if (!Array.isArray(list)) return out;
  for (const x of list) {
    if (!x || !ANNUAL.test(String(x.form || '')) || !DATE.test(String(x.end)) || !Number.isFinite(x.val)) continue;
    if (kind === 'flow') { if (!x.start) continue; const d = days(x.start, x.end); if (!(d >= 350 && d <= 380)) continue; }
    else if (x.start) continue;
    const prev = out.get(x.end);
    if (!prev || String(x.filed || '') >= String(prev.filed || '')) out.set(x.end, { val: x.val, filed: x.filed || '' });
  }
  return out;
}

function series(gaap, item) {
  const merged = new Map();
  for (const tag of item.tags) for (const [end, v] of collect(gaap[tag], item.kind, item.unit || 'USD')) if (!merged.has(end)) merged.set(end, v);
  return merged;
}

/** @returns {{ name, cik, kind, notes, currency, periods, rows, filed } | null} null when there is no usable annual data */
export function parseFacts(json, { years = 10 } = {}) {
  const gaap = json && json.facts && json.facts['us-gaap'];
  if (!gaap || typeof gaap !== 'object') return null;
  const maps = {};
  for (const k of Object.keys(ITEMS)) maps[k] = series(gaap, ITEMS[k]);
  const ends = new Set();
  for (const k of ['revenue', 'netIncome', 'assets', 'operatingIncome']) for (const e of maps[k].keys()) ends.add(e);
  let periods = [...ends].sort();
  /* near-duplicate year ends (a changed year end) keep only the later one */
  periods = periods.filter((e, i) => !(periods[i + 1] && days(e, periods[i + 1]) < 300));
  periods = periods.slice(-years);
  if (!periods.length) return null;
  const at = (k, e) => (maps[k].has(e) ? maps[k].get(e).val : null);
  const rows = {};
  for (const k of Object.keys(ITEMS)) rows[k] = periods.map(e => at(k, e));
  /* derived lines: a missing line is rebuilt only when the pieces are real, never guessed */
  rows.equity = rows.equity.map((v, i) => (v != null ? v : rows.equityTotal[i]));
  rows.liabilities = rows.liabilities.map((v, i) => (v != null ? v : (rows.assets[i] != null && rows.equityTotal[i] != null ? rows.assets[i] - rows.equityTotal[i] : null)));
  rows.grossProfit = rows.grossProfit.map((v, i) => (v != null ? v : (rows.revenue[i] != null && rows.costOfRevenue[i] != null ? rows.revenue[i] - rows.costOfRevenue[i] : null)));
  rows.debt = periods.map((_, i) => {
    if (rows.debtTotal[i] != null) return rows.debtTotal[i];
    if (rows.debtLong[i] != null) return rows.debtLong[i] + (rows.debtShort[i] != null ? rows.debtShort[i] : 0);
    return rows.debtShort[i];
  });
  /* a lender tag alone is not enough: a carmaker with a finance arm still reports gross profit and operating income like any other company */
  const kind = FINANCIAL_TAGS.some(t => gaap[t]) && !(gaap.GrossProfit && gaap.OperatingIncomeLoss) ? 'financial' : 'standard', notes = [];
  /* a debt figure that cannot be right (more than the firm owes in total, or an interest rate above 50%) is left out rather than shown */
  const before = rows.debt.filter(v => v != null).length;
  rows.debt = rows.debt.map((v, i) => {
    if (v == null) return null;
    if (kind === 'financial') return v;
    if (v < 0 || (rows.liabilities[i] != null && v > rows.liabilities[i] * 1.001)) return null;
    if (rows.interestExpense[i] != null && v > 0 && Math.abs(rows.interestExpense[i]) / v > 0.5) return null;
    return v;
  });
  if (rows.debt.filter(v => v != null).length < before) notes.push('Some debt figures were left out because they did not pass a sanity check.');
  /* share counts in older filings are not adjusted for stock splits, so only the latest three years are kept */
  const cut = Date.parse(periods[periods.length - 1]) - 3.2 * 365 * DAY;
  if (rows.shares.some((v, i) => v != null && Date.parse(periods[i]) < cut)) notes.push('Share counts older than three years are hidden because stock splits make them unreliable.');
  rows.shares = rows.shares.map((v, i) => (Date.parse(periods[i]) < cut ? null : v));
  rows.capex = rows.capex.map(v => (v == null ? null : Math.abs(v)));
  rows.interestExpense = rows.interestExpense.map(v => (v == null ? null : Math.abs(v)));
  delete rows.equityTotal; delete rows.debtTotal; delete rows.debtLong; delete rows.debtShort; delete rows.costOfRevenue;
  const lastEnd = periods[periods.length - 1], lastFiled = ['revenue', 'netIncome', 'assets'].map(k => (maps[k].get(lastEnd) || {}).filed || '').sort().pop() || null;
  const hasAny = Object.values(rows).some(r => r.some(v => v != null));
  if (!hasAny) return null;
  return {
    name: String(json.entityName || '').slice(0, 120), cik: Number(json.cik) || null,
    kind, notes,
    currency: 'USD', periods: periods.map(end => ({ end, filed: (maps.revenue.get(end) || maps.netIncome.get(end) || maps.assets.get(end) || {}).filed || null })),
    rows, filed: lastFiled
  };
}

/** Searches the SEC ticker list. Ticker matches first, then names. */
export function findCompanies(list, text, limit = 8) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return [];
  const all = Object.values(list || {}).filter(c => c && c.ticker && c.title);
  const exact = all.filter(c => c.ticker.toLowerCase() === q), starts = all.filter(c => c.ticker.toLowerCase().startsWith(q) && c.ticker.toLowerCase() !== q), names = all.filter(c => c.title.toLowerCase().includes(q) && !c.ticker.toLowerCase().startsWith(q));
  const seen = new Set(), out = [];
  for (const c of [...exact, ...starts, ...names]) { if (seen.has(c.ticker)) continue; seen.add(c.ticker); out.push({ ticker: c.ticker, name: c.title, cik: c.cik_str }); if (out.length >= limit) break; }
  return out;
}
