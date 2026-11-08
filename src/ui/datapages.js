// @ts-nocheck
/* The live data pages. Each loads on demand, so the rest of the site stays light. */
export const DATA_PAGES = [
  { id: 'financials', title: 'Company financials', blurb: 'Ten years of real numbers from SEC filings', load: () => import('./financials.js'), fn: 'renderFinancials', words: 'company financials statements income balance sheet cash flow sec edgar 10-k ticker dupont ratios' },
  { id: 'industries', title: 'Industry benchmarks', blurb: 'Typical risk, cost of capital and multiples', load: () => import('./industries.js'), fn: 'renderIndustries', words: 'industry benchmarks beta wacc cost of capital multiples ev ebitda pe margins damodaran sector peers comps' },
  { id: 'economy', title: 'Rates and economy', blurb: 'Treasury yields, inflation and the yield curve', load: () => import('./rates.js'), fn: 'renderRates', words: 'interest rates economy treasury yield curve inflation cpi unemployment mortgage fed funds credit spread fred risk free' },
  { id: 'factor-returns', title: 'Factor returns', blurb: 'What has beaten the market, back to 1963', load: () => import('./factors.js'), fn: 'renderFactors', words: 'factor returns fama french size value momentum profitability investment smb hml factors premium' },
  { id: 'countries', title: 'Countries compared', blurb: 'Growth, inflation and debt worldwide', load: () => import('./countries.js'), fn: 'renderCountries', words: 'countries world bank gdp growth inflation unemployment debt international economy compare' },
  { id: 'currency', title: 'Currency converter', blurb: 'Live exchange rates and history', load: () => import('./currency.js'), fn: 'renderCurrency', words: 'currency exchange rate converter forex fx dollar euro yen pound ecb' },
  { id: 'crypto', title: 'Crypto prices', blurb: 'Prices, risk and what if', load: () => import('./crypto.js'), fn: 'renderCrypto', words: 'crypto bitcoin ethereum cryptocurrency coin price volatility risk drawdown' },
  { id: 'market-pulse', title: 'Market pulse', blurb: 'What the market is doing, in plain English', load: () => import('./pulse.js'), fn: 'renderPulse', words: 'market pulse today live stocks sectors mood risk on risk off vix fear gauge yields gold oil movers gainers losers pakistan us psx' }
];
