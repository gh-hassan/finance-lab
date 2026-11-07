/* Reading Kenneth French's factor files: a tiny zip reader (zlib only) and a parser for his CSV layout. All pure, so tests can feed them text and bytes. */
import { inflateRawSync } from 'node:zlib';
import { HttpError } from './_http.js';

export const MAX_UNZIPPED = 5 * 1024 * 1024;
export const MAX_ZIP = 2 * 1024 * 1024;
const bad = () => new HttpError(502, 'The factor data file could not be read. Try again in a moment.');

/** First real file inside a zip, as { name, data }. Uses the central directory, so zips written with data descriptors work too. */
export function unzipFirst(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22 || buf.length > MAX_ZIP) throw bad();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw bad();
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < Math.min(count, 50); k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw bad();
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28), xLen = buf.readUInt16LE(p + 30), cLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    if (p + 46 + nLen > buf.length) throw bad();
    const name = buf.toString('latin1', p + 46, p + 46 + nLen);
    p += 46 + nLen + xLen + cLen;
    if (name.endsWith('/')) continue;
    if (flags & 1 || usize > MAX_UNZIPPED) throw bad();
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw bad();
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), end = start + csize;
    if (end > buf.length) throw bad();
    const raw = buf.subarray(start, end);
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) { try { data = inflateRawSync(raw, { maxOutputLength: MAX_UNZIPPED }); } catch (e) { throw bad(); } }
    else throw bad();
    if (data.length !== usize) throw bad();
    return { name, data };
  }
  throw bad();
}

const MISSING = v => v <= -99 || v >= 99000;
const cell = s => { const t = String(s).trim(); if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null; const v = +t; return Number.isFinite(v) && !MISSING(v) ? v : null; };

/** Parses the monthly table of a French CSV: { names, rows: Map(yyyymm -> numbers or null) }. Stops at the first blank or annual line. */
export function parseFrench(text) {
  if (typeof text !== 'string' || text.length > MAX_UNZIPPED) throw bad();
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex(l => /^\s*,\s*[A-Za-z]/.test(l));
  if (hi < 0) throw bad();
  const names = lines[hi].split(',').slice(1).map(s => s.trim());
  const rows = new Map();
  for (let i = hi + 1; i < lines.length; i++) {
    const m = /^\s*(\d{6})\s*,(.*)$/.exec(lines[i]);
    if (!m) { if (rows.size) break; continue; }
    const ym = +m[1], mo = ym % 100;
    if (mo < 1 || mo > 12) continue;
    const parts = m[2].split(',');
    rows.set(ym, names.map((_, j) => (j < parts.length ? cell(parts[j]) : null)));
  }
  if (!rows.size) throw bad();
  return { names, rows };
}

const FIVE = [['MKT', 'mkt-rf'], ['SMB', 'smb'], ['HML', 'hml'], ['RMW', 'rmw'], ['CMA', 'cma'], ['RF', 'rf']];
const r2 = v => (v == null ? null : Math.round(v * 100) / 100);

/** Joins the five-factor table with momentum, keeping the five-factor months. */
export function mergeFactors(five, mom) {
  const idx = FIVE.map(([, n]) => five.names.findIndex(x => x.toLowerCase() === n));
  const mi = mom.names.findIndex(x => x.toLowerCase() === 'mom');
  if (idx.some(i => i < 0) || mi < 0) throw bad();
  const months = [...five.rows.keys()].sort((a, b) => a - b);
  const factors = Object.fromEntries(FIVE.map(([k], j) => [k, months.map(m => r2(five.rows.get(m)[idx[j]]))]));
  factors.MOM = months.map(m => { const r = mom.rows.get(m); return r ? r2(r[mi]) : null; });
  return { months, factors };
}
