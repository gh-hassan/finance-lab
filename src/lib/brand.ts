/** The one place the site's name lives. SmartWealth stays only as the name of the video lessons. */
export const BRAND = {
  name: 'Finance Fundamentals',
  short: 'Finance Fundamentals',
  school: 'Suleman Dawood School of Business',
  university: 'Lahore University of Management Sciences',
  kind: 'Interactive learning',
  tagline: 'Finance, explained with real data',
  lessons: 'SmartWealth',
  /** Shown on the lessons pages. Facts come from the public LUMS faculty page (lums.edu.pk/lums_employee/2999). */
  faculty: { name: 'Dr. Bushra Naqvi', role: 'Associate Professor of Finance, Suleman Dawood School of Business, LUMS', url: 'https://lums.edu.pk/lums_employee/2999' }
} as const;
export const pageTitle = (page?: string): string => (page ? `${page} · ${BRAND.name}` : `${BRAND.name} · ${BRAND.school}, LUMS`);
