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
export const register = (m: ModuleDef): number => MODS.push(m);
export const findModule = (id: string): ModuleDef | undefined => MODS.find(m => m.id === id);
