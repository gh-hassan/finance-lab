# SmartWealth

Thirty-six finance and statistics calculators for MBA students and beginners. Every calculator has:

- **Beginner mode:** one plain-English question, a few friendly inputs, a big answer, one animated chart, and a short glossary.
- **Pro mode:** every input, all results, step-by-step workings with your numbers, tables and the formulas behind it.

- **Scenarios:** pick a situation (project, company, loan, savings, small business, stock), set worst/base/best numbers, then see the three futures, what matters most, a two-way what-if grid and a 3,000-run risk simulation.
- **Learn:** short pictures of the basic ideas including a "Chance and numbers" chapter (averages, spread, the bell curve, probability, correlation, beta, risk simulation).
- **Stats toolkit:** describe a list of numbers, correlation and beta, chance of a big move (Value at Risk), and expected value of a bet.

Calculators: time value of money, interest rates, annuities, loan amortization, bonds, yield curve and forward rates, stock valuation (DDM), DCF, comparable companies, capital budgeting, WACC, capital structure, leveraged buyout, lease vs buy and depreciation, dividends vs buybacks, break-even, working capital, three-statement model, CAPM, portfolio theory, multi-asset efficient frontier, factor models, return statistics, value at risk, options (Black-Scholes), option strategies, binomial trees, futures and hedging, interest rate swaps, ratios and DuPont, credit health (Altman Z), FX and parity, M&A accretion/dilution, retirement planning, and the statistics toolkit.

Around the calculators:

- **Financial calculator** (`/calculator`): a working BA II Plus Professional handheld with time value of money, cash flows (NPV, IRR, payback), amortization, bonds, depreciation, statistics, break-even, profit margin, dates and interest conversion. Independent practice tool, not affiliated with Texas Instruments.
- **Compare:** two versions of a calculator side by side, with the better one highlighted.
- **Quiz:** rounds of ten questions with fresh numbers, instant explanations and saved progress.
- **Cases:** six business situations that open calculators with the case numbers filled in.
- **Videos:** the SmartWealth YouTube channel previewed on the site (`/videos`). A preview plays in YouTube's own player and every card links to YouTube. The list refreshes from the channel's public feed through `api/videos.js`, with a built-in snapshot in `src/data/videos.js` as the fallback.
- **Glossary:** every term in plain words, searchable, with hover cards in lessons.
- **Assumptions and method** under every result, plus **share link, CSV download and print/PDF**.
- **Live stock lookup** (price, beta, dividend) in the CAPM, WACC, DDM and portfolio calculators, via the `api/quote.js` serverless function.
- **Units:** dollars, thousands, millions or billions on calculators that use amounts.
- **Live data pages** (under the Decide menu, each loads on demand). Every page explains itself in plain words, shows where the data comes from, and says so when a source is down. No API keys are needed.
  - `/financials` company financials: ten years of annual figures from SEC EDGAR 10-K filings (`api/edgar.js`), with ratios, DuPont analysis, a plain-words summary and one-click hand-off to the DCF and comps calculators.
  - `/industries` industry benchmarks: beta, cost of capital, multiples and margins for 94 US industries from Prof. Aswath Damodaran (NYU Stern), stored in `src/data/industries.json`. Rebuild once a year with `scripts/build-industries.py`.
  - `/economy` interest rates and the economy: Treasury yields, the yield curve, inflation, unemployment, mortgage rates and credit spreads from FRED, plus what the US Treasury pays on its debt (`api/macro.js`).
  - `/factor-returns` factor returns: Fama-French and momentum factors from Prof. Kenneth French's data library (`api/factors.js`).
  - `/countries` countries compared: World Bank indicators for major economies (`api/world.js`).
  - `/currency` currency converter and history from the European Central Bank's reference rates via Frankfurter (`api/fx.js`).
  - `/crypto` crypto prices and a risk lens from CoinGecko's public API (`api/crypto.js`).
  - `/market-pulse` market pulse: a plain-English read of the US market (live while open, up to 15 minutes delayed) and of Pakistan at end of day, with a risk-on / risk-off mood, sector heat map, fear gauge and biggest movers (`api/pulse.js`, one batch request per 20 symbols). Pakistan live prices are not used because the Pakistan Stock Exchange does not allow redistributing its market data without a licence.
  Shared pieces: `api/_http.js` (validated parameters, timeouts, friendly errors, cache headers), `src/ui/dataui.js` (loading, error, table and chart building blocks), `src/lib/format.ts` and `src/lib/series.ts` (formatting and series maths). `tests/datapages.test.ts` guards the outbound host allow-list and the free-plan function limit.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run coverage   # coverage report
npm run build      # type-check + production build into dist/
```

## Deploy to Vercel

Vercel detects Vite automatically. `vercel.json` rewrites every path except `/api/*` and assets to `index.html` so links like `/loan` work on refresh. `api/quote.js` runs as a Vercel serverless function and needs no keys.

1. Push this folder to a GitHub repository.
2. In Vercel choose **Add New → Project**, import the repository, and accept the defaults (build command `npm run build`, output `dist`).

## Structure

```
src/lib/math.ts        pure finance and formatting functions (typed, tested)
src/lib/registry.ts    calculator registry and types
src/modules/m1-6.js    the calculators (inputs, calc, concept text)
src/ui/beginner.js     plain-English layer: questions, labels, headlines, glossary
src/ui/module.js       calculator page (Beginner and Pro)
src/ui/home.js         home page
src/ui/learn.js        Learn page
src/ui/scenarios.js    Scenarios page
src/lib/scenarios.ts   scenario engine (cases, tornado, grid, Monte Carlo)
src/ui/shell.js        navigation, search (press /), theme, routing
src/ui/visuals.js      charts, sparklines, count-up and confetti
tests/                 vitest
```

To add a calculator, create a module that calls `register({...})`, import it in `src/main.ts`, and add an entry to `BEGINNER` in `src/ui/beginner.js`. The test suite fails if a calculator has no beginner entry.

For study and practice. Not investment advice.
