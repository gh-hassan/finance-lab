// @ts-nocheck
/* The printed report. "Print or PDF" does not print the live page, which is full of sliders and animations. It builds a separate,
   structured document instead (see lib/reporthtml.ts). The document is off screen and only shows while the browser is printing. */
import '../styles/report.css';
import { h } from './visuals.js';
import { reportHtml } from '../lib/reporthtml';

/** The whole report as an element. */
export function buildReport(r, now = new Date()) {
  const el = h('div', { id: 'print-report', 'aria-hidden': 'true' });
  el.innerHTML = reportHtml(r, now);
  return el;
}

/** Builds the report, prints it and takes it away again. The page itself is hidden by the stylesheet while `printing` is set. */
export function printReport(r) {
  const old = document.getElementById('print-report'); if (old) old.remove();
  const el = buildReport(r), root = document.documentElement;
  let done = false;
  const clean = () => { if (done) return; done = true; root.classList.remove('printing'); el.remove(); window.removeEventListener('afterprint', clean); };
  document.body.append(el); root.classList.add('printing'); window.addEventListener('afterprint', clean);
  const title = document.title; document.title = `${r.title} · report`;
  try { window.print(); } finally { document.title = title; /* some browsers never send afterprint; this is a safe fallback */ setTimeout(clean, 60000); }
}
