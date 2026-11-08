/* Pure helpers for the market pulse function: the symbols we follow and the arithmetic on Yahoo's batch "spark" answers. */
import { HttpError } from './_http.js';

const rows = text => text.trim().split('\n').map(l => { const [symbol, name, group, flag] = l.split('|'); return flag ? { symbol, name, group, proxy: true } : { symbol, name, group }; });

/** US: indices, the eleven sector funds, risk gauges and large companies. Names are plain words for beginners. */
export const US = rows(`^GSPC|S&P 500|index
^IXIC|Nasdaq|index
^DJI|Dow Jones|index
^RUT|Russell 2000 (small companies)|index
XLK|Technology|sector
XLF|Financials|sector
XLE|Energy|sector
XLV|Health care|sector
XLY|Consumer discretionary|sector
XLP|Consumer staples|sector
XLI|Industrials|sector
XLU|Utilities|sector
XLB|Materials|sector
XLRE|Real estate|sector
XLC|Communication|sector
^VIX|Fear gauge (VIX)|gauge
^TNX|10-year Treasury yield|gauge
UUP|US dollar (via the UUP fund)|gauge|proxy
GLD|Gold (via the GLD fund)|gauge|proxy
USO|Oil (via the USO fund)|gauge|proxy
BTC-USD|Bitcoin|gauge
AAPL|Apple|stock
MSFT|Microsoft|stock
NVDA|Nvidia|stock
AMZN|Amazon|stock
GOOGL|Alphabet|stock
META|Meta|stock
TSLA|Tesla|stock
AVGO|Broadcom|stock
JPM|JPMorgan|stock
V|Visa|stock
LLY|Eli Lilly|stock
UNH|UnitedHealth|stock
XOM|ExxonMobil|stock
WMT|Walmart|stock
COST|Costco|stock
HD|Home Depot|stock
NFLX|Netflix|stock
AMD|AMD|stock
ORCL|Oracle|stock
BAC|Bank of America|stock
JNJ|Johnson & Johnson|stock
PG|Procter & Gamble|stock
KO|Coca-Cola|stock
CAT|Caterpillar|stock`);

/** Pakistan: large stocks by sector. Yahoo carries these once a day, with the ".KA" Karachi suffix. */
export const PK = rows(`OGDC|Oil & Gas Development|Energy
PPL|Pakistan Petroleum|Energy
POL|Pakistan Oilfields|Energy
MARI|Mari Energies|Energy
PSO|Pakistan State Oil|Energy
APL|Attock Petroleum|Energy
ATRL|Attock Refinery|Energy
NRL|National Refinery|Energy
SNGP|Sui Northern Gas|Gas
SSGC|Sui Southern Gas|Gas
HUBC|Hub Power|Power
KAPCO|Kot Addu Power|Power
KEL|K-Electric|Power
NPL|Nishat Power|Power
FFC|Fauji Fertilizer|Fertilizer and chemicals
EFERT|Engro Fertilizers|Fertilizer and chemicals
FATIMA|Fatima Fertilizer|Fertilizer and chemicals
EPCL|Engro Polymer|Fertilizer and chemicals
LUCK|Lucky Cement|Cement
DGKC|D.G. Khan Cement|Cement
MLCF|Maple Leaf Cement|Cement
FCCL|Fauji Cement|Cement
CHCC|Cherat Cement|Cement
KOHC|Kohat Cement|Cement
PIOC|Pioneer Cement|Cement
HBL|Habib Bank|Banks
UBL|United Bank|Banks
MCB|MCB Bank|Banks
MEBL|Meezan Bank|Banks
BAHL|Bank AL Habib|Banks
BAFL|Bank Alfalah|Banks
NBP|National Bank of Pakistan|Banks
AKBL|Askari Bank|Banks
ABL|Allied Bank|Banks
FABL|Faysal Bank|Banks
SYS|Systems Limited|Technology
TRG|TRG Pakistan|Technology
NETSOL|NetSol Technologies|Technology
AVN|Avanceon|Technology
INDU|Indus Motor|Autos
HCAR|Honda Atlas Cars|Autos
MTL|Millat Tractors|Autos
GHNI|Ghandhara Industries|Autos
NML|Nishat Mills|Textile
ILP|Interloop|Textile
COLG|Colgate-Palmolive Pakistan|Consumer
NESTLE|Nestle Pakistan|Consumer
UNITY|Unity Foods|Consumer
MUREB|Murree Brewery|Consumer
ISL|International Steels|Steel
ASTL|Amreli Steels|Steel
SEARL|The Searle Company|Pharma
GLAXO|GlaxoSmithKline Pakistan|Pharma
HINOON|Highnoon Laboratories|Pharma
ABOT|Abbott Laboratories Pakistan|Pharma
AGP|AGP Limited|Pharma
PAEL|Pak Elektron|Industrials
TGL|Tariq Glass|Industrials
PKGS|Packages Limited|Industrials
CEPB|Century Paper & Board|Industrials`).map(r => ({ ...r, yahoo: r.symbol + '.KA' }));

export const MARKETS = { us: { symbols: US, range: '1d', interval: '5m', tz: 'America/New_York', granularity: '5min' }, pakistan: { symbols: PK, range: '1mo', interval: '1d', tz: 'Asia/Karachi', granularity: 'day' } };
export const MARKET_IDS = Object.keys(MARKETS);
export const BATCH = 20;
export const yahooSymbol = r => r.yahoo || r.symbol;

/** Splits a list into groups of at most `size` (Yahoo's batch endpoint accepts 20 symbols). */
export const chunk = (list, size = BATCH) => { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

const fin = x => typeof x === 'number' && Number.isFinite(x);
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Reads one batch answer into { SYMBOL: { closes, times, prev } }. A symbol with fewer than two prices is skipped. */
export function parseSpark(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new HttpError(502, 'The market data source sent something we could not read.');
  const out = {};
  for (const [sym, v] of Object.entries(json)) {
    if (!v || typeof v !== 'object' || !Array.isArray(v.close) || !Array.isArray(v.timestamp)) continue;
    const closes = [], times = [];
    v.close.forEach((c, i) => { if (fin(c) && c > 0 && fin(v.timestamp[i])) { closes.push(c); times.push(v.timestamp[i]); } });
    if (closes.length < 2) continue;
    out[sym] = { closes, times, prev: fin(v.previousClose) && v.previousClose > 0 ? v.previousClose : fin(v.chartPreviousClose) && v.chartPreviousClose > 0 ? v.chartPreviousClose : null };
  }
  return out;
}

/** Keeps at most `max` points, evenly spread, including the first and last. */
export function thin(a, max = 36) {
  if (a.length <= max) return a.slice();
  const out = [], step = (a.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(a[Math.round(i * step)]);
  return out;
}

/** US rows: today's price, change against yesterday's close, and a thin intraday line. */
export function buildUs(parsed, list = US) {
  const items = [];
  for (const r of list) {
    const p = parsed[yahooSymbol(r)];
    if (!p || p.prev == null) continue;
    const price = p.closes[p.closes.length - 1];
    items.push({ symbol: r.symbol, name: r.name, group: r.group, ...(r.proxy ? { proxy: true } : {}), price: round(price, 3), prev: round(p.prev, 3), chg: round(price / p.prev - 1, 5), abs: round(price - p.prev, 3), spark: thin(p.closes).map(x => round(x, 3)) });
  }
  /* the market's own clock: Bitcoin trades all night, so it must not decide whether stocks are open */
  const ref = ['^GSPC', 'XLK', 'AAPL'].map(k => parsed[k]).find(Boolean);
  return { items, lastBar: ref ? ref.times[ref.times.length - 1] : null };
}

/** Pakistan rows: change over 1 day, 5 trading days and the month shown, with a daily line. */
export function buildPk(parsed, list = PK) {
  const items = [];
  for (const r of list) {
    const p = parsed[yahooSymbol(r)];
    if (!p || p.closes.length < 6) continue;
    const c = p.closes, n = c.length, price = c[n - 1], base = p.prev ?? c[0];
    items.push({ symbol: r.symbol, name: r.name, group: r.group, price: round(price, 2), c1: round(price / c[n - 2] - 1, 5), c5: round(price / c[n - 6] - 1, 5), c20: round(price / base - 1, 5), spark: c.map(x => round(x, 2)) });
  }
  const last = Math.max(0, ...Object.values(parsed).map(p => p.times[p.times.length - 1]));
  return { items, lastBar: last || null };
}
