# Audit: inputs, outputs and visuals

Severity: HIGH = wrong number or nonsense, MED = confusing or misleading, LOW = polish.
Numbers below were checked by hand with the default inputs.

## All tools that take a typed list (capbud, returns, stats, corr, comps, curve, swaps, varcalc, frontier, factors, model3)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| (parseList in src/lib/math.ts) | any comma-separated field | "30,000" is read as two numbers, 30 and 0, with no warning. A beginner typing thousands separators gets a silently wrong NPV, mean or curve. Typos such as "12%" are dropped without notice. | HIGH | After parsing, show an info line "Read N numbers: ..." and warn when a token matches `/\d,\d{3}(\D|$)/` ("Did you mean 30000?"). Strip `%` and `$` before Number(). |

## tvm

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| tvm | PV, PMT, FV | Default PV = −1,000 and PMT = −100 with no sign hint on the field. Beginners enter positive numbers and get "No solution". The only explanation is in the collapsed concept panel. | MED | Add `help: 'Money you pay in is negative, money you receive is positive.'` to pv, pmt, fv. |
| tvm | Periods per year (P/Y = C/Y) | Jargon. N is "number of periods" but is not tied visibly to P/Y (N = 10 with P/Y = 12 means 10 months). | LOW | Label "Payments per year (also compounding per year)"; show "= N ÷ P/Y years" under the N field. |
| tvm (beginner) | plain text | "The rest is free money from interest" calls interest free money. | LOW | "The rest is interest your money earned." |

## rates

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| rates | Doubling time card | Sub-text says "rule of 72 says 72 ÷ APR" but the main value uses EAR. The two differ for no visible reason. | LOW | Sub: "rule of 72 on the APR: X yrs; exact figure uses the effective rate". |

## loan

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| loan | Full schedule table | Rows cut at 720 with no note. Weekly payments over 30 years (1,560 rows) silently lose half the schedule. | LOW | Add a table note "Showing the first 720 of N payments", or raise the cap. |
| loan, scenarios (loan), scenes (loan), beginner (loan) | "fee" wording | Interest is called "fees to the bank", "in fees", "the bank's yearly fee". A teacher will object: interest is the price of borrowing, not a fee. | MED | Replace "fees" with "interest" in beginner.js (loan easy/tips/plain), scenarios.ts ("Total interest paid"), scenes.js loan ("interest", not "fee"). |

## annuity

No input/output defects found.

## bond

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| bond | Years to maturity | N = round(yrs × m). 0.5 years with annual coupons silently becomes 1 year; 7.3 years becomes 7.0 with no mention. | LOW | Show "Using N coupons = X years" in the first step, or round the field to a multiple of 1/m. |
| bond | Yield shock (bps) | "bps" is not explained. | LOW | Label "Yield shock (basis points; 100 bps = 1%)". |

## ddm

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| ddm | Expected EPS next year (default 3.5) | With the defaults, "Value if no growth" = $35.00 is above intrinsic value $34.67, so PVGO shows −$0.33 (−1%). The default example contradicts the lesson that growth adds value. | MED | Set default e1 = 3.0 (no-growth value $30, PVGO $4.67). |
| ddm | Dividend yield card | Sub says "÷ price" but it divides by the intrinsic value, not the market price. | LOW | Sub: "D₁ ÷ intrinsic value". |

## dcf

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| dcf | Terminal value | Final-year FCFF is capitalised as is. At year 5 growth is still 4.8% (fade) but terminal growth is 3%, so reinvestment (NWC, capex) is not normalised. Implied exit multiple 9.7×. | LOW | Add a line in the assumptions: "Terminal cash flow is not normalised for the drop in growth." |
| dcf | Shares outstanding (M) | 0 or negative gives "—" or a negative price with no note. | LOW | Return a note when shares ≤ 0. |

## capbud

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| capbud | Project A/B · initial investment | Must be entered positive while cash flows use a minus for outflows. Not stated. | LOW | Label "initial investment (enter as a positive number)". |
| capbud | Default Project B | Default A beats B on both NPV (32.2k vs 24.2k) and IRR, so the page never shows the IRR-versus-NPV conflict the concept text promises. | LOW | Choose a B with a higher IRR but lower NPV at 10%. |

## wacc

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| wacc | Debt cost rises per +10% debt weight (bps) | Hard to read. The curve also lowers the cost of debt below the entered rate when debt weight is under today's level (6% at 30% debt becomes 4.5% at 0% debt). | LOW | Label "Extra interest on debt for each 10 points more borrowing (bps)". Add caption "debt cost is anchored at your current mix". |

## capstruct

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| capstruct | Levered cost of equity card | Uses D/E with book capital (E = 600). M&M with taxes needs market equity, V_L − D = 1,225 − 400 = 825. Shown 11.50%, correct 11.09%. | HIGH | `keL = ku + (ku - r)*(1-t)*D/(VL - D)`. |
| capstruct | Value if unlevered / Capital to raise | V_U = 1,125 comes from EBIT(1−t)/ku but the user is "raising $1,000M". The two are different quantities shown side by side. | MED | Caption: "V_U is the value of the earnings stream, not the capital raised." |

## breakeven

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| breakeven | Operating profit target | "Target operating profit" is pre-tax; not stated. | LOW | Label "Target operating profit (before tax)". |

## wc

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| wc | Cash tied up in the cycle | CCC mixes DSO (on sales) with DIO/DPO (on COGS) but multiplies by daily COGS only. | LOW | Sub: "approximate: CCC × daily COGS". |
| wc | EOQ inputs | Order-cost inputs sit in the same tool as the cash cycle with no heading in the input panel, so they look like part of the same question. | LOW | Add a group heading or split into two tools. |

## capm

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| capm | M² card | Formula is `rf + Sharpe_market × σ_asset`. M² is `rf + Sharpe_asset × σ_market`. Default shows 11.56%; correct value is 9.82%. The sub-text "return at market risk 16%" contradicts the number. | HIGH | `m2 = rf + sh * sm` (sh = asset Sharpe, sm = market σ); compare with the market return 9.5%. |
| capm | Asset expected return (live lookup) | The "Use a real stock" button fills it with the historical average return, not an expectation. | LOW | Rename the filled field's note: "past average used as the expected return". |

## portfolio

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| portfolio | Chart caption | Mentions "Play" and "slide your weight with Play", but the weight slider and the Play button are separate controls. | LOW | "Press Play to trace the curve, or drag Weight in A." |

## returns

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| returns | Skewness card | Sub says "fatter right tail" for any skew ≥ 0 and for NaN (all equal returns). | LOW | Three cases: < −0.1 left, > 0.1 right, else "roughly symmetric"; "—" for NaN. |
| returns | 95% value at risk | Historical figure uses interpolation on as few as 2 returns (default 10); meaningless below about 20. | LOW | Add sub "needs 20+ returns to mean much" when n < 20. |
| returns | Annualized card vs concept | Concept says "annualize: return × periods per year (arithmetic)" but the card compounds the geometric mean. | LOW | Align the concept text with the card (geometric). |
| returns | Returns list | Entering decimals (0.12) is read as 0.12%. | LOW | Warn when every value has magnitude < 1: "These look like decimals; enter 12 for 12%." |

## options (Black-Scholes)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| options | P&L chart caption | "The two lines meet as expiry approaches" but the "Today" line is computed at the full time to expiry, so it does not move. | LOW | "The gap between the lines is the time value; shorten Time to expiry to watch it close." |
| options | Time value card | Negative for a deep in-the-money European put or a call with high dividend yield, which looks like an error. | LOW | Add sub "can be negative for European puts" when negative. |
| options | Volatility | Not stated as a yearly figure. | LOW | Label "Volatility (per year)". |

## ratios

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| ratios | All money fields | No unit (Revenue 5000: dollars, thousands, millions?). Share price is $40 against shares 100 and a $5,000 revenue, so units are implied to be millions with no label. | LOW | Add "($M)" to money labels (the unit switch already supports it). |
| ratios | Debt to equity | Uses long-term debt only; label does not say so. Beginners expect total debt. | LOW | Label "Long-term debt to equity". |
| ratios | P/E, Net debt/EBITDA | Negative EPS or EBITDA gives a negative multiple instead of "n/m". | LOW | Show "n/m" when the denominator ≤ 0. |
| ratios | 5-step DuPont | The first box sub-text reads "check". | LOW | "equals the 3-step ROE". |

## fx

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| fx | Hedged foreign investment card | Always equals "invest at home" because it uses the parity forward, so it can never show a difference (tone "warn" is dead code). | MED | Use the market forward when entered, otherwise hide the card. |
| fx | Concept bullet | "Forward premium means the foreign currency is expected to be dearer." A forward premium is set by the interest gap, it is not a forecast. | MED | "…means the foreign currency is dearer for delivery later, because interest rates abroad are lower." |
| fx | Market forward (optional) | Says "Use 0 to skip" but clearing the field resets to the default 1.10. | LOW | Treat blank as 0, or add a checkbox "Test a quote". |
| fx | Amount to invest | `pre: '$'` although the amount is in home currency. | LOW | Remove the `$`. |

## merger

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| merger | Assumptions text | Says "Synergies are after-tax" but the input is labelled pre-tax and the code applies (1 − t). | LOW | Fix the assumptions line to "pre-tax; taxed in the model". |
| merger | P/E card | "favours paying in cash" whenever acquirer P/E < price-paid P/E ignores the after-tax cost of debt (4.5% here, equal to a P/E of 22). | LOW | Compare target earnings yield with after-tax debt cost instead. |
| scene merge | Caption | "a good deal for existing owners (accretive)": accretion is not value creation. | LOW | "EPS goes up (accretive). That alone does not mean the deal creates value." |

## stats

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| stats | Table column "Spreads from average" | Unclear (it is a z-score). Shows NaN when all numbers are equal. | LOW | "Number of spreads from average"; "—" when sd = 0. |

## normal

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| normal | A loss you worry about (default −20) | In Pro mode there is no hint to enter a negative number. Typing 20 gives "chance of a year worse than 20%" ≈ 88%. | MED | Label "A bad year's return (use a minus sign, for example −20)". |
| normal | Loss to plan for | With a spread of 100% the loss can exceed the amount invested (normal return below −100%). | LOW | Cap displayed loss at the amount invested. |
| normal | Concept formula | `VaR = amount × (average − z × spread)` is negative as written. | LOW | Write `amount × (z × spread − average)`. |

## prob

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| prob | Chance of being ahead after n | Normal approximation. At n = 1 it shows 55% while the card above says the chance of winning one try is 40%. At the default n = 10 it shows 67%; the exact binomial answer is 62%. | HIGH | Use exact binomial: sum P(k wins) over k with `k*win − (n−k)*lose > 0`. |

## frontier

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| frontier | Correlations (rows split by ;) | Jargon. A table that is not a valid correlation matrix (negative variance) is accepted and only singular matrices are rejected. | LOW | Label "Correlation table (one row per asset, rows split by ;)". Reject matrices with a non-positive-definite result. |
| frontier | Chart | Curve allows short selling but only the dots are described as "no short selling". | LOW | Legend: "Efficient frontier (shorting allowed)". |

## strategies

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| strategies | Centre strike price | For covered call, protective put and collar the stock has no strike and the call/put strikes are K ± gap, so "centre" means little. | LOW | Per-strategy field help: "Covered call sells a call at K + gap". |

## binomial

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| binomial | Black-Scholes card sub | "the limit of the tree with many steps" is false for an American option. | LOW | "limit for the European version". |
| binomial | Info line | Only explains early exercise for puts. American calls with no dividend never exercise early; nothing says so. | LOW | Add the call case. |

## comps

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| comps | Method list | A method whose company figure is ≤ 0 (for example negative net income) is dropped silently. | LOW | Info line "P/E skipped: net income is not positive". |

## model3

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| model3 | Working capital today / % of revenue growth | Default working capital 100 is 10% of revenue, but the model adds only 10% of the change in revenue each year, so working capital falls as a share of sales. | LOW | Caption "working capital grows with sales growth only". |

## lease

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| lease | Lease term vs Years of use | If term ≠ life the comparison covers different periods with no warning. MACRS ignores "Years of use" but the salvage is still discounted over that field. | LOW | Note when term ≠ life; hide Years of use for MACRS and discount over the table length. |
| lease | Chart x-axis | "Method (1 straight, 2 double declining, ...)" as an axis title. | LOW | Use `xLabels` with method names. |

## payout

No input/output defects found.

## curve

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| curve | Curve shape card | Flat or humped curves are called "Upward sloping" (only inverted is detected). | LOW | Use the shape reader in src/lib/rates.ts (normal / flat / inverted / humped). |
| curve | Bond years | Silently cut to the number of par yields entered. | LOW | Info line when years > number of yields. |

## futures

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| futures | Futures price in the market (default 102) | Fair price is 102.02, so the default shows "Reverse cash and carry" arbitrage on a 2-cent gap, and the beginner page says "a riskless profit". | MED | Default 104 for a clear example, or ignore gaps under 0.1% of F. |
| futures | Risk-free rate | The formula uses continuous compounding; not stated. | LOW | Label "Risk-free rate (continuously compounded)". |
| futures | Contracts to sell | Fractional (8.8) with no rounding note. | LOW | Sub: "round to the nearest whole contract". |

## swaps

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| swaps | Fixed rate you pay on an existing swap | The existing swap is valued as if it had the full "Swap term" left; not stated. | LOW | Label "Swap term (years remaining)". |

## varcalc

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| varcalc | Your past returns per period | Help says "historical VaR, over the same length of period" but varHistorical applies no scaling (the assumptions page says so). The card sits beside a 10-day parametric VaR. The two numbers are not comparable. | HIGH | Scale by √(days / returns-per-year), or ask for returns over the holding period and relabel "Historical VaR (one period of your data)". Fix the help text. |
| varcalc | Concept text | "larger than the VaR only on about one day in twenty of those periods". It is one holding period in twenty. | LOW | "about one holding period in twenty". |

## altman

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| altman | Type of company: "Service or emerging market" | The 4-ratio score is the non-manufacturer Z″ (zones 1.1 and 2.6). The emerging-market version adds a constant 3.25 and uses zones 4.35 and 5.85. The label promises something the maths does not do. | MED | Rename "Service / non-manufacturer (Z″)", or add the 3.25 constant and the EM zones. |
| altman | Equity value ($M) | Label does not change by company type. It must be market value for listed firms and book value for private ones. | MED | Change the label with the selected model, or add help text. |
| altman | Default inputs | Z = 2.998, one-thousandth above the 2.99 "safe" line. | LOW | Move a default so the example sits clearly inside a zone. |

## lbo

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| lbo | Capital spending (% of EBITDA) | Unusual base. Tax is computed on EBITDA − capex − interest (capex used as depreciation) and this is not shown in the input panel. | LOW | Help: "Also used as depreciation for tax." |

## retire

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| retire | Needed at retirement / Pot at retirement | Both are future (nominal) dollars: $3.0M and $1.8M for a $60,000-in-today's-money income. Nothing says so, and the numbers look absurd to a first-year student. | MED | Sub: "in dollars of that year (about $X in today's money)", where X = value ÷ (1 + inflation)^years. |

## factors

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| factors | Names / premiums / loadings | Lists of different lengths are cut to the shortest with no message. | LOW | Info line "Using the first k factors". |

## scenarios (page and engine)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| scenarios (company) | Hidden inputs | Value per share assumes sales $1,000M, 25% tax, 70% cash conversion, $300M net debt, 100M shares. None is shown. | MED | Add a line "Assumes sales of $1,000M, ..." under the model title, or make them drivers. |
| scenarios (savings) | Hidden input | A $5,000 starting balance is built in. | MED | Add a "Starting balance" driver. |
| scenarios (loan) | Hidden input | A 30-year term is fixed. | LOW | Add "Loan term (years)" driver or state it. |
| scenarios | Column "Likely" | Means the probability-weighted average (expected value) but reads as "most likely". | MED | Rename "Weighted average". |
| scenarios | "How likely is each?" | Percentages are not required to total 100 and the total is not shown. | LOW | Show "Total: X%" and normalise visibly. |
| scenarios | Risk simulation | Ignores the likelihood row, so changing it does nothing to the chart. | LOW | Caption "The simulation uses your ranges, not the likelihood percentages." |
| scenarios | Tornado | If a driver's worst or best value gives "Never"/NaN, the bar falls back to the base value (no swing). | LOW | Draw an arrow labelled "never". |
| scenarios | Worst/Base/Best inputs | No check that worst < base < best. | LOW | Warn when the order is wrong. |
| scenarios | "Bad day / Good day" | A project or loan is not a day. | LOW | "Bad case (1 in 10)" and "Good case (1 in 10)". |

## compare (page)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| compare (merger) | Metric match | METRICS uses label "EPS accretion", but the card is renamed "EPS dilution" when negative, so the measure row disappears. | HIGH | Match on either label (`['EPS accretion','EPS dilution']`) or give the card a fixed label. |
| compare (tvm) | Metric match | "Future value" and "Interest earned" cards exist only when Solve for = FV and the plan is a saver, so rows vanish otherwise. | LOW | Force the compare view to solve for FV. |

## options page (/options)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| options page | Chart "Today" line | Vertical line labelled "Today" at the purchase price while the curve is drawn "With 15 days left". "Today" reads as 15 days left, but premiums were priced with 30 days. | LOW | Label "Price when bought". |
| options page | Price paid per share vs dollar results | Option rows are per share, all results per contract (100 shares). The 100-share note is only in the first explainer. | LOW | Caption above the results: "Results are for 1 contract = 100 shares." |

## time machine (home)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| time machine | Header "Real US market returns since 1963" | In finance "real" means after inflation. These are actual (nominal) returns and the note says inflation is excluded. | MED | "Actual US market returns since 1963". |

## financials (company statements)

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| financials → dcf | Margin sent to the DCF | `toCalculators` clamps EBIT margin to a minimum of 2%, so a loss-making company is passed in as 2% profitable. | LOW | Pass the real value and let the DCF note a loss. |

## scenes (animations)

All 30 scenes have a title, a one-line plain description, three "how" steps and word cards. The issues are in their numbers and captions.

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| scene breakeven | Price per cup / Cost per cup | Cost can exceed price (cost slider to 8, price slider from 2). Margin is clamped to $0.01, so break-even is about 30,000 cups and the caption says "Each cup adds $0.01". | MED | Limit cost to below price, or show "Every cup loses money". |
| scene mix2 | Caption | "...because one often rises when the other falls" is shown for any correlation under 0.5, including 0 (unrelated) and 0.4 (positive). | LOW | Show only when ρ < 0. |
| scene mix2, beta, journey | "How it works" text | Fixed text ("unrelated (0)", "beta of 1.5", "+50%/−50%") stays when the slider is changed. | LOW | Build the steps from the parameters. |
| scene spread | Caption | "lands anywhere from −11% to 25%" is the one-standard-deviation band (about 2 years in 3), not the range. | LOW | "usually lands between ... (about 2 years in 3)". |
| scene montecarlo, risk | Hidden assumptions | Mean return 7% (montecarlo) and 3/5/9% lane returns (risk) are fixed and not shown. | LOW | Add to the caption: "average 7% a year". |
| scene diversify | Slider | Slider reads 1–5 but maps to [2,3,4,6,12] companies, so "1 company" cannot be chosen and the number shown jumps. | LOW | Slider value = number of companies. |

## all chart-based tools

| tool id | field | problem | severity | fix |
|---|---|---|---|---|
| (all XY charts) | Y axis | No y-axis title anywhere (`ylab` is never used); units come only from tick formats and the chart subtitle. | LOW | Add `ylab` to each chart spec ("Profit ($)", "Price ($)", "Return (%)"). |

---

## Counts by severity

| severity | count |
|---|---|
| HIGH | 7 |
| MED | 17 |
| LOW | 71 |

---

## Fixed

Note: the count table above says 7 HIGH, but only 6 HIGH rows exist; all 6 are fixed. Regression tests are in tests/audit-fixes.test.ts.

HIGH (6 of 6)
- parseList: strips % and $; every typed-list field now shows "Read N numbers: ..." with a "Did you mean 30000?" warning for "30,000" (math.ts `listNote`, shown by module.js).
- capstruct: levered cost of equity uses market equity V_L − D (11.09% by default); V_U caption added.
- capm: M² = rf + asset Sharpe × market σ (9.82% by default); sub-text shows market return.
- prob: exact binomial via `chanceAhead` (62% at n = 10, 40% at n = 1).
- varcalc: chose the audit's second option (no scaling). Field, help and card now say "one holding period / one period of your data"; concept text says "one holding period in twenty".
- compare: merger measure matches "EPS accretion" or "EPS dilution" (`|` alternatives); tvm compare forces Solve for = FV.

MED (all fixed)
- tvm sign help on PV, PMT, FV; loan wording "fees" to "interest" (beginner, scenarios, scene); ddm default EPS 3.0 (PVGO now +$4.67).
- fx: hedged card shown only with a market forward, using that forward; forward premium bullet corrected.
- normal: negative-number label; altman: "Service / non-manufacturer (Z″)" and equity label says market vs book.
- retire: both cards say they are in future dollars and show today's money; futures default market price 104.
- scenarios: company assumptions line, savings "Starting balance" driver, "Likely" renamed "Weighted average".
- time machine header "Actual US market returns"; breakeven scene shows "Every cup loses money" when cost is not below price.

LOW (quick wording, label or default changes only)
- tvm P/Y label and "interest your money earned" text (beginner and scene); rates doubling-time sub; bond bps label; ddm yield sub; capbud positive-investment label.
- wacc debt-cost label; breakeven pre-tax label; wc approximate sub; capm and portfolio caption; returns skew three cases, annualized concept text; ratios long-term debt label and DuPont "equals the 3-step ROE".
- normal concept formula and loss capped at amount invested; stats column title and "—" when sd = 0; volatility "(per year)" in both options tools.
- futures continuous-compounding label and whole-contract note; swaps "years remaining"; lbo capex help; merger assumptions line; altman default equity 1,700 (Z about 3.13).
- scenarios: probability total shown, simulation caption, "Bad/Good case (1 in 10)", loan term driver; scene mix2 caption only for ρ < 0; scene spread caption wording.

Deliberately skipped
- Not edited (other agent owns them): src/ui/options.js and src/lib/payoff.ts, so options-page items (Today line label, per-contract caption) and the Black-Scholes chart/time-value captions that live there.
- Skipped as redesign or larger work: y-axis titles on every chart, loan 720-row note, fx blank forward field, wc EOQ grouping, dcf terminal normalisation and zero-share note, lease term/MACRS and axis labels, curve shape reader and years note, frontier correlation validation and legend, strategies per-strategy help, binomial captions, comps skipped-method info, model3 caption, factors "using first k" info, returns VaR-n note and decimals warning, payout, financials EBIT clamp, scenarios worst<base<best warning and tornado "never" arrow, scene slider and "how it works" text built from parameters, scene montecarlo/risk assumptions, capm live-lookup note, rates/tvm "= N ÷ P/Y years" line, bond coupon count line, ratios ($M) labels and n/m multiples, strategies and altman beyond the default.
