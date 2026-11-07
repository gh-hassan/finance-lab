/* Serverless function: monthly factor returns from Prof. Kenneth French's free data library (Dartmouth).
     GET /api/factors -> { updated, months:[YYYYMM], factors:{ MKT, SMB, HML, RMW, CMA, MOM, RF: [percent per month or null] }, source }
   There are no query values. Both files come from one fixed host. */
import { route, getBuffer, HttpError } from './_http.js';
import { unzipFirst, parseFrench, mergeFactors } from './_french.js';

const BASE = 'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/';
export const FILES = { five: BASE + 'F-F_Research_Data_5_Factors_2x3_CSV.zip', mom: BASE + 'F-F_Momentum_Factor_CSV.zip' };
const HOURS = 6 * 3600e3;
let memo = { at: 0, data: null };
export const resetCache = () => { memo = { at: 0, data: null }; };

const table = async (url, signal) => parseFrench(unzipFirst(await getBuffer(url, { signal })).data.toString('utf8'));

export default route(async ({ signal }) => {
  if (memo.data && Date.now() - memo.at < HOURS) return memo.data;
  const [five, mom] = await Promise.all([table(FILES.five, signal), table(FILES.mom, signal)]);
  const { months, factors } = mergeFactors(five, mom);
  if (months.length < 120) throw new HttpError(502, 'The factor data looked incomplete. Try again later.');
  memo = { at: Date.now(), data: { updated: new Date().toISOString(), months, factors, source: 'Kenneth R. French Data Library (Dartmouth Tuck)' } };
  return memo.data;
}, { timeout: 15000, cache: 's-maxage=86400, stale-while-revalidate=604800' });
