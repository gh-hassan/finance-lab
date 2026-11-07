/** Country and indicator lists for the "Countries compared" page, plus the small pure helpers it needs. Keep the codes in step with api/_world.js (a test checks this). */
import { num, compact } from './format';

export type Region = 'North America' | 'Latin America' | 'Europe' | 'Middle East & Africa' | 'Asia-Pacific';
export interface Country { code: string; name: string; region: Region }
export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', region: 'North America' }, { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'MX', name: 'Mexico', region: 'Latin America' }, { code: 'BR', name: 'Brazil', region: 'Latin America' },
  { code: 'AR', name: 'Argentina', region: 'Latin America' }, { code: 'CL', name: 'Chile', region: 'Latin America' },
  { code: 'CO', name: 'Colombia', region: 'Latin America' }, { code: 'PE', name: 'Peru', region: 'Latin America' },
  { code: 'UY', name: 'Uruguay', region: 'Latin America' }, { code: 'EC', name: 'Ecuador', region: 'Latin America' },
  { code: 'PY', name: 'Paraguay', region: 'Latin America' }, { code: 'BO', name: 'Bolivia', region: 'Latin America' },
  { code: 'CR', name: 'Costa Rica', region: 'Latin America' }, { code: 'PA', name: 'Panama', region: 'Latin America' },
  { code: 'DO', name: 'Dominican Republic', region: 'Latin America' }, { code: 'GT', name: 'Guatemala', region: 'Latin America' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' }, { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' }, { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'ES', name: 'Spain', region: 'Europe' }, { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' }, { code: 'SE', name: 'Sweden', region: 'Europe' },
  { code: 'NO', name: 'Norway', region: 'Europe' }, { code: 'DK', name: 'Denmark', region: 'Europe' },
  { code: 'FI', name: 'Finland', region: 'Europe' }, { code: 'IE', name: 'Ireland', region: 'Europe' },
  { code: 'BE', name: 'Belgium', region: 'Europe' }, { code: 'AT', name: 'Austria', region: 'Europe' },
  { code: 'PT', name: 'Portugal', region: 'Europe' }, { code: 'GR', name: 'Greece', region: 'Europe' },
  { code: 'PL', name: 'Poland', region: 'Europe' }, { code: 'CZ', name: 'Czechia', region: 'Europe' },
  { code: 'HU', name: 'Hungary', region: 'Europe' }, { code: 'RO', name: 'Romania', region: 'Europe' },
  { code: 'UA', name: 'Ukraine', region: 'Europe' }, { code: 'BG', name: 'Bulgaria', region: 'Europe' },
  { code: 'HR', name: 'Croatia', region: 'Europe' }, { code: 'SK', name: 'Slovakia', region: 'Europe' },
  { code: 'SI', name: 'Slovenia', region: 'Europe' }, { code: 'LT', name: 'Lithuania', region: 'Europe' },
  { code: 'LV', name: 'Latvia', region: 'Europe' }, { code: 'EE', name: 'Estonia', region: 'Europe' },
  { code: 'IS', name: 'Iceland', region: 'Europe' }, { code: 'LU', name: 'Luxembourg', region: 'Europe' },
  { code: 'RS', name: 'Serbia', region: 'Europe' }, { code: 'RU', name: 'Russia', region: 'Europe' },
  { code: 'TR', name: 'Turkey', region: 'Middle East & Africa' }, { code: 'ZA', name: 'South Africa', region: 'Middle East & Africa' },
  { code: 'NG', name: 'Nigeria', region: 'Middle East & Africa' }, { code: 'EG', name: 'Egypt', region: 'Middle East & Africa' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East & Africa' }, { code: 'AE', name: 'United Arab Emirates', region: 'Middle East & Africa' },
  { code: 'IL', name: 'Israel', region: 'Middle East & Africa' }, { code: 'QA', name: 'Qatar', region: 'Middle East & Africa' },
  { code: 'KW', name: 'Kuwait', region: 'Middle East & Africa' }, { code: 'OM', name: 'Oman', region: 'Middle East & Africa' },
  { code: 'JO', name: 'Jordan', region: 'Middle East & Africa' }, { code: 'LB', name: 'Lebanon', region: 'Middle East & Africa' },
  { code: 'IQ', name: 'Iraq', region: 'Middle East & Africa' }, { code: 'IR', name: 'Iran', region: 'Middle East & Africa' },
  { code: 'MA', name: 'Morocco', region: 'Middle East & Africa' }, { code: 'DZ', name: 'Algeria', region: 'Middle East & Africa' },
  { code: 'TN', name: 'Tunisia', region: 'Middle East & Africa' }, { code: 'KE', name: 'Kenya', region: 'Middle East & Africa' },
  { code: 'ET', name: 'Ethiopia', region: 'Middle East & Africa' }, { code: 'GH', name: 'Ghana', region: 'Middle East & Africa' },
  { code: 'TZ', name: 'Tanzania', region: 'Middle East & Africa' }, { code: 'UG', name: 'Uganda', region: 'Middle East & Africa' },
  { code: 'CI', name: "Cote d'Ivoire", region: 'Middle East & Africa' }, { code: 'SN', name: 'Senegal', region: 'Middle East & Africa' },
  { code: 'AO', name: 'Angola', region: 'Middle East & Africa' }, { code: 'ZM', name: 'Zambia', region: 'Middle East & Africa' },
  { code: 'ZW', name: 'Zimbabwe', region: 'Middle East & Africa' }, { code: 'BW', name: 'Botswana', region: 'Middle East & Africa' },
  { code: 'NA', name: 'Namibia', region: 'Middle East & Africa' }, { code: 'RW', name: 'Rwanda', region: 'Middle East & Africa' },
  { code: 'CM', name: 'Cameroon', region: 'Middle East & Africa' }, { code: 'CD', name: 'DR Congo', region: 'Middle East & Africa' },
  { code: 'MZ', name: 'Mozambique', region: 'Middle East & Africa' }, { code: 'MU', name: 'Mauritius', region: 'Middle East & Africa' },
  { code: 'IN', name: 'India', region: 'Asia-Pacific' }, { code: 'CN', name: 'China', region: 'Asia-Pacific' },
  { code: 'JP', name: 'Japan', region: 'Asia-Pacific' }, { code: 'KR', name: 'South Korea', region: 'Asia-Pacific' },
  { code: 'ID', name: 'Indonesia', region: 'Asia-Pacific' }, { code: 'AU', name: 'Australia', region: 'Asia-Pacific' },
  { code: 'SG', name: 'Singapore', region: 'Asia-Pacific' }, { code: 'PK', name: 'Pakistan', region: 'Asia-Pacific' },
  { code: 'BD', name: 'Bangladesh', region: 'Asia-Pacific' }, { code: 'LK', name: 'Sri Lanka', region: 'Asia-Pacific' },
  { code: 'NP', name: 'Nepal', region: 'Asia-Pacific' }, { code: 'VN', name: 'Vietnam', region: 'Asia-Pacific' },
  { code: 'TH', name: 'Thailand', region: 'Asia-Pacific' }, { code: 'PH', name: 'Philippines', region: 'Asia-Pacific' },
  { code: 'MY', name: 'Malaysia', region: 'Asia-Pacific' }, { code: 'NZ', name: 'New Zealand', region: 'Asia-Pacific' },
  { code: 'HK', name: 'Hong Kong', region: 'Asia-Pacific' }, { code: 'KZ', name: 'Kazakhstan', region: 'Asia-Pacific' },
  { code: 'UZ', name: 'Uzbekistan', region: 'Asia-Pacific' }, { code: 'MN', name: 'Mongolia', region: 'Asia-Pacific' },
  { code: 'KH', name: 'Cambodia', region: 'Asia-Pacific' }, { code: 'MM', name: 'Myanmar', region: 'Asia-Pacific' }
];
export const CODES = COUNTRIES.map(c => c.code);
export const DEFAULT_COUNTRIES = ['US', 'DE', 'JP', 'CN', 'IN', 'BR'];
export const MAX_SHOWN = 6;
export const countryName = (code: string): string => COUNTRIES.find(c => c.code === code)?.name ?? code;
export const regionOf = (code: string): string => COUNTRIES.find(c => c.code === code)?.region ?? '';

export type Kind = 'pct' | 'usd' | 'people';
export interface Indicator { id: string; short: string; label: string; kind: Kind; higherIsBetter: boolean | null; means: string; investors: string }
export const INDICATORS: Indicator[] = [
  { id: 'NY.GDP.MKTP.KD.ZG', short: 'Growth', label: 'Economic growth', kind: 'pct', higherIsBetter: true, means: 'How much the economy grew in a year, after removing price rises.', investors: 'Faster growth usually means companies can sell more and earn more, but fast growth is not always steady. Check how bumpy the line is.' },
  { id: 'FP.CPI.TOTL.ZG', short: 'Inflation', label: 'Inflation', kind: 'pct', higherIsBetter: false, means: 'How fast everyday prices rose in a year.', investors: 'Higher inflation erodes what your returns can buy, and it tends to push a country\'s currency down against others. Compare it with interest rates.' },
  { id: 'SL.UEM.TOTL.ZS', short: 'Unemployment', label: 'Unemployment', kind: 'pct', higherIsBetter: false, means: 'The share of people who want a job and cannot find one.', investors: 'High unemployment means weak spending, which hurts company sales. Very low unemployment can push wages and inflation up.' },
  { id: 'NY.GDP.PCAP.CD', short: 'GDP per person', label: 'GDP per person', kind: 'usd', higherIsBetter: true, means: 'The value of everything the country makes in a year, divided by its people, in US dollars.', investors: 'A rough guide to how rich a country is. Poorer countries can grow faster by catching up, but often carry more risk.' },
  { id: 'GC.DOD.TOTL.GD.ZS', short: 'Government debt', label: 'Government debt', kind: 'pct', higherIsBetter: false, means: 'What the central government owes, as a share of a year\'s output. Many countries do not report it.', investors: 'High debt can raise risk: more of the budget goes to interest, and lenders may demand higher rates. Countries that borrow in their own currency have more room.' },
  { id: 'FR.INR.RINR', short: 'Real interest rate', label: 'Real interest rate', kind: 'pct', higherIsBetter: null, means: 'The interest rate on loans after taking away inflation. Many countries have gaps.', investors: 'A high real rate tends to attract money from abroad and can lift the currency. A negative one means savers lose buying power.' },
  { id: 'BN.CAB.XOKA.GD.ZS', short: 'Current account', label: 'Current account balance', kind: 'pct', higherIsBetter: null, means: 'What the country earns from the world minus what it pays out, as a share of output. Positive means it earns more than it spends abroad.', investors: 'A large, lasting deficit means the country relies on foreign money, which can make its currency vulnerable if that money leaves.' },
  { id: 'SP.POP.TOTL', short: 'Population', label: 'Population', kind: 'people', higherIsBetter: null, means: 'How many people live in the country.', investors: 'More people means a bigger market and workforce, but what matters for living standards is output per person.' }
];
export const INDICATOR_IDS = INDICATORS.map(i => i.id);
export const indicatorOf = (id: string): Indicator => INDICATORS.find(i => i.id === id) ?? INDICATORS[0];

export const isCountry = (c: unknown): c is string => typeof c === 'string' && CODES.includes(c);
export const isIndicator = (id: unknown): id is string => typeof id === 'string' && INDICATOR_IDS.includes(id);

/** Reads ?c=US,DE into valid unique codes (at most `max`). Empty or all-invalid input gives the defaults. */
export function parseCountryList(s: string | null | undefined, max = MAX_SHOWN): string[] {
  const out: string[] = [];
  String(s ?? '').split(/[;,]/).map(x => x.trim().toUpperCase()).forEach(c => { if (isCountry(c) && !out.includes(c) && out.length < max) out.push(c); });
  return out.length ? out : DEFAULT_COUNTRIES.slice(0, max);
}

/** Text for one value, or an em dash when there is none. */
export function formatValue(kind: Kind, v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (kind === 'usd') return (v < 0 ? '−' : '') + '$' + num(Math.abs(v), 0);
  if (kind === 'people') return compact(v);
  return num(v, 1) + '%';
}

export type Series = readonly (readonly [number, number])[];
/** Newest non-null value, or null. A point is skipped if its value is not a finite number. */
export function latestValue(points: Series | null | undefined): { year: number; value: number } | null {
  if (!Array.isArray(points)) return null;
  let best: { year: number; value: number } | null = null;
  for (const p of points) if (Array.isArray(p) && Number.isFinite(p[1]) && Number.isFinite(p[0]) && (!best || p[0] > best.year)) best = { year: p[0], value: p[1] };
  return best;
}

export interface Ranked { code: string; rank: number | null; year: number | null; value: number | null }
/** Ranks countries by value (high first unless `ascending`). Equal values share a rank and the next rank is skipped; countries without data come last, unranked, in code order. */
export function rankCountries(latest: Record<string, { year: number; value: number } | null | undefined>, ascending = false): Ranked[] {
  const rows = CODES.map(code => { const l = latest[code]; return { code, year: l && Number.isFinite(l.value) ? l.year : null, value: l && Number.isFinite(l.value) ? l.value : null }; });
  const have = rows.filter(r => r.value != null).sort((a, b) => (ascending ? a.value! - b.value! : b.value! - a.value!) || a.code.localeCompare(b.code));
  const ranked: Ranked[] = have.map((r, i) => ({ ...r, rank: i > 0 && have[i - 1].value === r.value ? null : i + 1 }));
  ranked.forEach((r, i) => { if (r.rank == null) r.rank = ranked[i - 1].rank; });
  return [...ranked, ...rows.filter(r => r.value == null).map(r => ({ ...r, rank: null }))];
}

/** Years covered by any series, oldest first, so every line can share one x axis. */
export const yearAxis = (series: Record<string, Series>): number[] => [...new Set(Object.values(series).flatMap(s => s.map(p => p[0])))].sort((a, b) => a - b);

/** Values for one country on a shared year axis; NaN where there is no figure. */
export function alignToYears(points: Series | undefined, years: readonly number[]): [number, number][] {
  const m = new Map((points ?? []).map(p => [p[0], p[1]] as [number, number]));
  return years.map(y => [y, m.get(y) ?? NaN]);
}

/** Inputs for the FX calculator from two countries' inflation, as percents with one decimal (home first). */
export function fxInputs(home: { value: number } | null | undefined, foreign: { value: number } | null | undefined): { pd: number; pf: number } | null {
  if (!home || !foreign || !Number.isFinite(home.value) || !Number.isFinite(foreign.value)) return null;
  const r = (x: number) => Math.round(x * 10) / 10;
  return { pd: r(home.value), pf: r(foreign.value) };
}
