// @ts-nocheck
const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  home: svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
  learn: svg('<path d="M4 5.5A2.500 2.500 0 016.500 3H20v15H6.500A2.500 2.500 0 004 20.500z"/><path d="M4 20.500A2.500 2.500 0 016.500 18H20v3H6.500"/><path d="M9 8h7"/>'),
  scenarios: svg('<path d="M4 18l5-6 4 3 7-9"/><path d="M4 6v12h16"/><circle cx="9" cy="12" r="1.2"/><circle cx="13" cy="15" r="1.2"/>'),
  Statistics: svg('<path d="M4 20V12M9 20V5M14 20v-9M19 20V9"/><path d="M3 20h18"/>'),
  compare: svg('<path d="M7 8h12l-3-3M17 16H5l3 3"/>'),
  glossary: svg('<path d="M4 19L8.500 6 13 19M6 15h5"/><path d="M16 8h4M16 12h4M16 16h4"/>'),
  quiz: svg('<circle cx="12" cy="12" r="8"/><path d="M9.500 12.200l1.900 1.900 3.300-3.800"/>'),
  cases: svg('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5.500A1.500 1.500 0 0110.500 4h3A1.500 1.500 0 0115 5.500V7M4 12h16"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>'),
  coin: svg('<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.2 5 3.9 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.6-1.2M12 6.5V8m0 8v1.5"/>'),
  Foundations: svg('<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.2 5 3.9 0 1.1-1.1 1.8-2.5 1.8-1.1 0-2-.4-2.6-1.2M12 6.5V8m0 8v1.5"/>'),
  Valuation: svg('<path d="M12 4v16M5 8h14M5 8l-2.5 6a3 3 0 005 0L5 8zM19 8l-2.5 6a3 3 0 005 0L19 8z"/>'),
  'Corporate Finance': svg('<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 012-2h2a2 2 0 012 2v1.5M3.5 13h17"/>'),
  Investments: svg('<path d="M4 19V5M4 19h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>'),
  Derivatives: svg('<path d="M12 3l2.2 5.6L20 9.3l-4.4 3.8L17 19l-5-3-5 3 1.4-5.9L4 9.3l5.8-.7z"/>'),
  International: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5S14.5 18.100 12 20.500C9.500 18.100 8.400 15.300 8.400 12S9.500 5.900 12 3.500z"/>'),
  Analysis: svg('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.500h6V7H9zM8.500 12h7M8.500 16h5"/>')
};
