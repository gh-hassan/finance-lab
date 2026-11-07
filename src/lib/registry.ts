/** Calculator registry. Each calculator module registers itself on import. */

export type Values = Record<string, any>;

export interface FieldDef {
  id: string;
  label: string;
  v: number | string;
  type?: 'select' | 'text';
  options?: [string, string][];
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  pre?: string;
  slider?: [number, number, number];
  help?: string;
}

export interface CardDef { head?: string; key?: boolean; label?: string; value?: string; sub?: string; tone?: string }

export interface CalcOutput {
  cards?: CardDef[];
  charts?: any[];
  steps?: [string, string][];
  tables?: any[];
  note?: string;
  info?: string;
  solved?: { id: string; value: number; dp?: number };
}

export interface ModuleDef {
  id: string;
  group: string;
  title: string;
  blurb: string;
  fields: FieldDef[];
  concept: string;
  show?: Record<string, (v: Values) => boolean>;
  calc: (v: Values) => CalcOutput;
}

export const MODS: ModuleDef[] = [];
/* Inputs that set how many times a calculator loops are capped, so a stray extra zero cannot freeze the page. */
const YEAR_IDS = new Set(['years', 'yrs', 'life', 'term', 'live', 'ret', 'age']);
const COUNT_IDS = new Set(['n', 'm', 'py', 'ppy', 'mpy', 'tries', 'days', 'steps', 'N', 'k']);
export const CAPS = { years: 200, count: 1000, size: 1e12 } as const;
function capOf(f: FieldDef): number | null {
  if (f.type === 'select' || f.type === 'text') return null;
  if (f.max != null) return f.max;
  if (f.unit === 'yrs' || YEAR_IDS.has(f.id)) return CAPS.years;
  if (COUNT_IDS.has(f.id)) return CAPS.count;
  return CAPS.size;
}
/** Limit numeric inputs to sensible ranges. Returns the cleaned values and the names of any that were reduced. */
export function sanitize(fields: FieldDef[], v: Values): { values: Values; capped: string[] } {
  const values: Values = { ...v }, capped: string[] = [];
  fields.forEach(f => {
    const cap = capOf(f); if (cap == null) return;
    const x = Number(values[f.id]);
    if (!Number.isFinite(x)) { values[f.id] = typeof f.v === 'number' ? f.v : 0; return; }
    if (Math.abs(x) > cap) { values[f.id] = Math.sign(x) * cap; capped.push(f.label); }
  });
  return { values, capped };
}
export const register = (m: ModuleDef): number => {
  const raw = m.calc;
  m.calc = (v: Values) => {
    const { values, capped } = sanitize(m.fields, v), out = raw(values);
    if (capped.length && out) out.info = [out.info, `Very large inputs were reduced to keep things fast: ${capped.join(', ')}.`].filter(Boolean).join(' ');
    return out;
  };
  return MODS.push(m);
};
export const findModule = (id: string): ModuleDef | undefined => MODS.find(m => m.id === id);
