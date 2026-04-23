import { useState, useEffect, useRef } from 'react'

/* ── Formatters ─────────────────────────────────────────────────────────── */
const fmt$ = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n || 0)

const fmtPct = (n, d = 2) => `${(+n || 0).toFixed(d)}%`

/* ── Mortgage payment ────────────────────────────────────────────────────── */
const calcMtg = (principal, annualRatePct, termYears) => {
  if (!principal || !annualRatePct || !termYears) return 0
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

/* ── Core analysis ───────────────────────────────────────────────────────── */
const analyze = (f) => {
  const price          = +f.askingPrice     || 0
  const rent           = +f.monthlyRent     || 0
  const taxesMonthly   = +f.propertyTaxes   || 0   // user enters monthly
  const insMonthly     = +f.insurance       || 0   // user enters monthly
  const repairCosts    = +f.repairCosts     || 0
  const maintPct       = +f.maintenancePct  || 0
  const vacPct         = +f.vacancyPct      || 0
  const dpPct          = Math.min(100, Math.max(0, +f.downPaymentPct  || 100))
  const rate           = +f.interestRate    || 0
  const term           = +f.loanTerm        || 30
  const closingCostPct = +f.closingCostsPct || 0

  // Income (annual)
  const annualRent  = rent * 12
  const vacancyLoss = annualRent * (vacPct / 100)
  const egi         = annualRent - vacancyLoss

  // Operating expenses (annual) — taxes & insurance converted from monthly
  const maintenance = annualRent * (maintPct / 100)
  const opex        = (taxesMonthly * 12) + (insMonthly * 12) + maintenance
  const noi         = egi - opex
  const capRate     = price > 0 ? (noi / price) * 100 : 0

  // Financing
  const downPayment  = price * (dpPct / 100)
  const closingCosts = price * (closingCostPct / 100)
  const loanAmount   = price - downPayment
  const mtgMonthly   = dpPct < 100 ? calcMtg(loanAmount, rate, term) : 0
  const annualDebt   = mtgMonthly * 12

  // Total upfront capital = down payment + closing costs + repairs
  const totalUpfront = downPayment + closingCosts + repairCosts

  // Cash flow
  const annualCF  = noi - annualDebt
  const monthlyCF = annualCF / 12

  // Cash-on-cash uses ALL upfront capital
  const coc = totalUpfront > 0 ? (annualCF / totalUpfront) * 100 : 0

  return {
    annualRent, vacancyLoss, egi,
    taxesMonthly, insMonthly, maintenance, opex, noi,
    capRate, downPayment, closingCosts, repairCosts, loanAmount,
    mtgMonthly, annualDebt, totalUpfront, annualCF, monthlyCF, coc,
  }
}

/* ── Fixed score thresholds ──────────────────────────────────────────────── */
// Good ≥ $450/mo | Fair $250–$449/mo | Poor < $250/mo
const getScore = (monthlyCF) => {
  if (monthlyCF >= 450) return { label: 'Good', cls: 'bg-green-900/50 text-green-400 ring-1 ring-green-600'   }
  if (monthlyCF >= 250) return { label: 'Fair', cls: 'bg-yellow-900/50 text-yellow-400 ring-1 ring-yellow-600' }
  return                       { label: 'Poor', cls: 'bg-red-900/50 text-red-400 ring-1 ring-red-600'         }
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-flex items-center gap-1.5 cursor-default"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-700 hover:bg-gray-600 text-[9px] font-bold text-gray-400 cursor-help flex-shrink-0 select-none transition-colors">
        ?
      </span>
      {visible && (
        <span className="absolute z-50 bottom-full left-0 mb-2.5 w-64 bg-gray-800 border border-gray-600/80 rounded-xl p-3 text-xs text-gray-300 leading-relaxed shadow-2xl pointer-events-none normal-case font-normal tracking-normal whitespace-normal">
          {text}
          <span className="tooltip-arrow" />
        </span>
      )}
    </span>
  )
}

/* ── Field ───────────────────────────────────────────────────────────────── */
function Field({ label, name, value, onChange, placeholder, pre, suf, isText, required, span2, tooltip }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
        {tooltip ? <Tooltip text={tooltip}>{label}</Tooltip> : label}
        {required && <span className="text-sky-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {pre && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">
            {pre}
          </span>
        )}
        <input
          type={isText ? 'text' : 'number'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '0'}
          step="any"
          min="0"
          autoComplete="off"
          className={[
            'w-full bg-gray-900 border border-gray-700/80 rounded-lg py-2.5 text-sm text-white placeholder-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all duration-150',
            pre ? 'pl-7' : 'pl-3',
            suf ? 'pr-10' : 'pr-3',
          ].join(' ')}
        />
        {suf && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">
            {suf}
          </span>
        )}
      </div>
    </div>
  )
}

/* ── MetricCard ──────────────────────────────────────────────────────────── */
function MetricCard({ label, value, sub, color, tooltip, accent }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-sky-950/40 border-sky-800/60' : 'bg-gray-800/70 border-gray-700/50'}`}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
        {tooltip ? <Tooltip text={tooltip}>{label}</Tooltip> : label}
      </p>
      <p className={`text-2xl font-bold leading-none ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1.5">{sub}</p>}
    </div>
  )
}

/* ── ScoreBadge ──────────────────────────────────────────────────────────── */
function ScoreBadge({ monthlyCF }) {
  const good = monthlyCF >= 450
  const fair = !good && monthlyCF >= 250

  const cfg = good
    ? {
        label: 'GOOD DEAL',
        desc:  "Great numbers — you're in solid profit territory.",
        ring: 'ring-green-500',  bg: 'bg-green-950/70',  text: 'text-green-300',  dot: 'bg-green-400',
      }
    : fair
    ? {
        label: 'FAIR DEAL',
        desc:  'It works, but you can probably find better.',
        ring: 'ring-yellow-500', bg: 'bg-yellow-950/70', text: 'text-yellow-300', dot: 'bg-yellow-400',
      }
    : {
        label: 'POOR DEAL',
        desc:  'Better opportunities are out there — keep looking.',
        ring: 'ring-red-500',    bg: 'bg-red-950/70',    text: 'text-red-300',    dot: 'bg-red-400',
      }

  return (
    <div className={`rounded-2xl ring-2 ${cfg.ring} ${cfg.bg} p-5 col-span-2 flex items-center justify-between gap-4`}>
      <div>
        <p className={`text-3xl font-black tracking-widest ${cfg.text}`}>{cfg.label}</p>
        <p className="text-gray-400 text-sm mt-0.5">{cfg.desc}</p>
      </div>
      <div className={`w-5 h-5 rounded-full ${cfg.dot} shadow-lg flex-shrink-0 ring-4 ring-black/20`} />
    </div>
  )
}

/* ── Defaults ────────────────────────────────────────────────────────────── */
const DEFAULTS = {
  address: '', askingPrice: '', monthlyRent: '',
  propertyTaxes: '', insurance: '', repairCosts: '',
  maintenancePct: '5', vacancyPct: '1', cashFlowGoal: '500',
  downPaymentPct: '20', interestRate: '7', loanTerm: '30', closingCostsPct: '3',
}

/* ── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [form,       setForm]       = useState(DEFAULTS)
  const [result,     setResult]     = useState(null)
  const [err,        setErr]        = useState('')
  const [saved,      setSaved]      = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [loadedId,   setLoadedId]   = useState(null)
  const topRef = useRef(null)

  const [deals, setDeals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('s8deals') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('s8deals', JSON.stringify(deals)) }, [deals])

  const onChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setErr('')
    setSaved(false)
  }

  const onAnalyze = () => {
    if (!form.askingPrice || !form.monthlyRent) {
      setErr('Asking price and monthly rent are required.')
      return
    }
    setResult({ ...analyze(form), _form: { ...form } })
    setSaved(false)
    setLoadedId(null)
  }

  const onSave = () => {
    if (!result || saved) return
    const score = getScore(result.monthlyCF)
    setDeals(d => [{
      id:           Date.now(),
      date:         new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
      address:      result._form.address || 'Unnamed Property',
      askingPrice:  +result._form.askingPrice,
      monthlyRent:  +result._form.monthlyRent,
      capRate:      result.capRate,
      monthlyCF:    result.monthlyCF,
      coc:          result.coc,
      totalUpfront: result.totalUpfront,
      scoreLabel:   score.label,
      scoreCls:     score.cls,
      notes:        '',
      _form:        { ...result._form },
    }, ...d])
    setSaved(true)
  }

  const onDelete = (id) => {
    setDeals(d => d.filter(x => x.id !== id))
    if (expandedId === id) setExpandedId(null)
    if (loadedId   === id) setLoadedId(null)
  }

  const onUpdateNote = (id, notes) =>
    setDeals(d => d.map(x => x.id === id ? { ...x, notes } : x))

  const onLoadDeal = (deal) => {
    if (!deal._form) return
    setForm(deal._form)
    setResult({ ...analyze(deal._form), _form: { ...deal._form } })
    setSaved(true)
    setLoadedId(deal.id)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const r = result
  const cfGoal = +r?._form?.cashFlowGoal || 500

  return (
    <div className="min-h-screen bg-gray-950">
      <div ref={topRef} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex items-center gap-5">
          <a href="/" className="flex items-center flex-shrink-0 group" title="Success with Section 8 Analyzer">
            <img
              src="/logo.png"
              alt="Success with Section 8"
              className="h-16 sm:h-20 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
            />
          </a>

          <div className="h-8 w-px bg-gray-700/60 hidden sm:block" />
          <p className="text-gray-500 text-xs hidden sm:block leading-relaxed">
            Rental Deal<br />Calculator
          </p>

          {deals.length > 0 && (
            <div className="ml-auto">
              <span className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full border border-gray-700">
                {deals.length} deal{deals.length !== 1 ? 's' : ''} saved
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* LEFT — Form */}
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Property Details</h2>
              <p className="text-gray-500 text-sm mt-0.5">Enter the deal parameters below</p>
            </div>

            {/* Property Info */}
            <section className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 space-y-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Property Info</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Property Address" name="address" value={form.address} onChange={onChange}
                  placeholder="123 Main St, City, ST" isText span2 />
                <Field label="Asking Price" name="askingPrice" value={form.askingPrice} onChange={onChange}
                  placeholder="150,000" pre="$" required
                  tooltip="The purchase price of the property you're analyzing." />
                <Field label="Monthly Rent" name="monthlyRent" value={form.monthlyRent} onChange={onChange}
                  placeholder="1,200" pre="$" required
                  tooltip="The monthly rent you'll receive. With Section 8, the housing authority pays a guaranteed portion directly — making this very reliable even if the tenant can't pay their portion." />
                <Field label="Property Taxes / mo" name="propertyTaxes" value={form.propertyTaxes} onChange={onChange}
                  placeholder="200" pre="$"
                  tooltip="Your monthly property tax cost. Divide your annual tax bill by 12. You can find this on the county assessor's website or ask the seller for a recent tax statement." />
                <Field label="Insurance / mo" name="insurance" value={form.insurance} onChange={onChange}
                  placeholder="100" pre="$"
                  tooltip="Monthly landlord insurance cost. Divide your annual premium by 12. Annual landlord insurance typically runs $800–$2,000/year depending on location and property value." />
                <Field label="Est. Repair Costs" name="repairCosts" value={form.repairCosts} onChange={onChange}
                  placeholder="5,000" pre="$"
                  tooltip="One-time upfront cost to repair or rehab the property before renting. This is factored into your Total Upfront Capital and cash-on-cash return — it does not affect monthly cash flow." />
                <Field label="Maintenance %" name="maintenancePct" value={form.maintenancePct} onChange={onChange}
                  placeholder="5" suf="%"
                  tooltip="An ongoing budget for repairs and upkeep, as a percentage of annual gross rent. 5% is a common starting point — use 8–10% for older homes. Covers plumbing, appliances, and general wear and tear." />
                <Field label="Vacancy %" name="vacancyPct" value={form.vacancyPct} onChange={onChange}
                  placeholder="1" suf="%"
                  tooltip="The percentage of the year your property might sit empty. Section 8 tenants tend to stay much longer than market-rate tenants, so 1% is realistic — roughly 3–4 days per year." />
                <Field label="Cash Flow Goal / mo" name="cashFlowGoal" value={form.cashFlowGoal} onChange={onChange}
                  placeholder="500" pre="$" span2
                  tooltip="Your personal monthly profit target. The monthly cash flow card turns green when you hit this number. Note: the deal score (Good/Fair/Poor) uses fixed thresholds — Good = $450+/mo, Fair = $250–449/mo, Poor = under $250/mo." />
              </div>
            </section>

            {/* Financing */}
            <section className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Financing</p>
                <span className="text-[11px] text-gray-600">100% down = all-cash</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Down Payment %" name="downPaymentPct" value={form.downPaymentPct} onChange={onChange}
                  placeholder="20" suf="%"
                  tooltip="The percentage of the purchase price you pay upfront in cash. The rest is financed with a mortgage. A higher down payment lowers monthly payments but ties up more of your cash." />
                <Field label="Interest Rate" name="interestRate" value={form.interestRate} onChange={onChange}
                  placeholder="7.0" suf="%"
                  tooltip="The annual interest rate on your mortgage. Even a 0.5% difference meaningfully changes your monthly payment. Investor loan rates are typically 0.5–1% higher than primary residence rates." />
                <Field label="Loan Term" name="loanTerm" value={form.loanTerm} onChange={onChange}
                  placeholder="30" suf="yr"
                  tooltip="How many years to pay off the mortgage. A 30-year loan gives lower monthly payments; a 15-year loan builds equity faster but costs more per month." />
                <Field label="Closing Costs %" name="closingCostsPct" value={form.closingCostsPct} onChange={onChange}
                  placeholder="3" suf="%"
                  tooltip="Fees paid at closing — typically 2–5% of the purchase price for investment properties. Includes lender fees, title insurance, attorney fees, and prepaid items. Factored into your Total Upfront Capital." />
              </div>
            </section>

            {err && (
              <p className="text-red-400 text-sm bg-red-950/60 border border-red-800/60 rounded-xl px-4 py-3">{err}</p>
            )}

            <button
              onClick={onAnalyze}
              className="w-full bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl transition-all text-[15px] tracking-wide shadow-xl shadow-sky-900/30"
            >
              Analyze Deal
            </button>
          </div>

          {/* RIGHT — Results */}
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white">Analysis Results</h2>
              <p className="text-gray-500 text-sm mt-0.5">Key metrics and deal score</p>
            </div>

            {r ? (
              <div className="space-y-4">
                {/* Score badge */}
                <div className="grid grid-cols-2">
                  <ScoreBadge monthlyCF={r.monthlyCF} />
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Monthly Cash Flow"
                    value={fmt$(r.monthlyCF)}
                    sub={`Your goal: ${fmt$(cfGoal)}/mo`}
                    color={r.monthlyCF >= cfGoal ? 'text-green-400' : 'text-red-400'}
                    tooltip="Money left in your pocket each month after every expense and mortgage payment. Turns green when you hit your personal cash flow goal."
                  />
                  <MetricCard
                    label="Cap Rate"
                    value={fmtPct(r.capRate)}
                    sub="NOI ÷ purchase price"
                    color={r.capRate >= 8 ? 'text-green-400' : r.capRate >= 5 ? 'text-yellow-400' : 'text-red-400'}
                    tooltip="Capitalization Rate — your annual return assuming an all-cash purchase with no mortgage. Calculated as Net Operating Income ÷ Purchase Price. Most investors target 6–10%. Great for comparing properties regardless of financing."
                  />
                  <MetricCard
                    label="Cash-on-Cash Return"
                    value={fmtPct(r.coc)}
                    sub={`${fmt$(r.totalUpfront)} total invested`}
                    color={r.coc >= 8 ? 'text-green-400' : r.coc >= 5 ? 'text-yellow-400' : 'text-red-400'}
                    tooltip="How much cash you earn back annually on all the cash you put in (down payment + closing costs + repairs). Example: put in $40,000, earn $3,200/year = 8% CoC. One of the most important metrics for real investors."
                  />
                  <MetricCard
                    label="Net Operating Income"
                    value={`${fmt$(r.noi / 12)}/mo`}
                    sub={`${fmt$(r.noi)}/yr`}
                    tooltip="Your income after all operating expenses (taxes, insurance, maintenance, vacancy) but BEFORE your mortgage payment. Shows how profitable the property itself is, regardless of how you financed it."
                  />
                </div>

                {/* Total Upfront Capital */}
                <div className="bg-sky-950/40 border-2 border-sky-800/60 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-sky-400/70 uppercase tracking-widest mb-2">
                    <Tooltip text="The total cash you need to close this deal and get it rent-ready. Includes your down payment, all closing costs, and estimated repairs. This is the number to have in your account before moving forward.">
                      Total Upfront Capital Needed
                    </Tooltip>
                  </p>
                  <div className="flex items-end justify-between flex-wrap gap-3">
                    <p className="text-3xl font-black text-white">{fmt$(r.totalUpfront)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>Down payment <span className="text-white font-semibold">{fmt$(r.downPayment)}</span></span>
                      <span>Closing costs <span className="text-white font-semibold">{fmt$(r.closingCosts)}</span></span>
                      {r.repairCosts > 0 && (
                        <span>Repairs <span className="text-white font-semibold">{fmt$(r.repairCosts)}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Income & Expense Breakdown */}
                <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-700/50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Income & Expense Breakdown</p>
                    <p className="text-[10px] text-gray-600">per month unless noted</p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-700/30">
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Gross Monthly Rent</td>
                        <td className="px-4 py-2 text-right tabular-nums text-green-400">{fmt$(r.annualRent / 12)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Vacancy Loss</td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-400">− {fmt$(r.vacancyLoss / 12)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">
                          <Tooltip text="Your expected rent after accounting for vacancy loss — the realistic income used for all further calculations.">
                            Effective Gross Income
                          </Tooltip>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-white">{fmt$(r.egi / 12)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Property Taxes</td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-400">− {fmt$(r.taxesMonthly)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Insurance</td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-400">− {fmt$(r.insMonthly)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Maintenance</td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-400">− {fmt$(r.maintenance / 12)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">
                          <Tooltip text="Income after all operating costs but before your mortgage — a key metric for comparing deals regardless of financing.">
                            Net Operating Income
                          </Tooltip>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-white font-semibold">{fmt$(r.noi / 12)} /month</td>
                      </tr>

                      {r.annualDebt > 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 pt-3 pb-1">
                            <div className="border-t border-dashed border-gray-600/40" />
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1.5">Financing (annual totals)</p>
                          </td>
                        </tr>
                      )}
                      {r.annualDebt > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-gray-400">
                            <Tooltip text="Your total yearly mortgage payments (principal + interest). Subtracted from NOI to get actual annual cash flow.">
                              Annual Debt Service
                            </Tooltip>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-red-400">− {fmt$(r.annualDebt)}</td>
                        </tr>
                      )}
                      <tr className="bg-gray-700/10">
                        <td className="px-4 py-2.5 text-gray-300 font-semibold">Annual Cash Flow</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-bold ${r.annualCF >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt$(r.annualCF)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mortgage callout */}
                {r.mtgMonthly > 0 && (
                  <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-gray-400">Monthly Mortgage Payment</span>
                    <span className="text-white font-semibold tabular-nums">{fmt$(r.mtgMonthly)} /month</span>
                  </div>
                )}

                {/* Save */}
                <button
                  onClick={onSave}
                  disabled={saved}
                  className={`w-full border font-semibold py-2.5 rounded-xl transition-all text-sm
                    ${saved
                      ? 'border-green-800 text-green-600 cursor-default'
                      : 'border-sky-700 text-sky-400 hover:bg-sky-900/30 cursor-pointer'}`}
                >
                  {saved ? '✓ Saved to Deal Log' : '+ Save to Deal Log'}
                </button>
              </div>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-800 text-center px-8 select-none">
                <svg className="w-12 h-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12l8.954-8.955a1.5 1.5 0 012.092 0L22.25 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                <p className="text-gray-400 font-semibold">No analysis yet</p>
                <p className="text-gray-600 text-sm mt-1">Fill in the form and click<br /><span className="text-sky-500">Analyze Deal</span></p>
              </div>
            )}
          </div>
        </div>

        {/* ── Deal Log ────────────────────────────────────────────────────── */}
        {deals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Deal Log</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {deals.length} saved deal{deals.length !== 1 ? 's' : ''} — click any row to load it back
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Clear all saved deals?')) {
                    setDeals([]); setExpandedId(null); setLoadedId(null)
                  }
                }}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors border border-gray-700 hover:border-red-800 px-3 py-1.5 rounded-lg"
              >
                Clear All
              </button>
            </div>

            <div className="rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="bg-gray-900/90 border-b border-gray-800">
                      {['Address', 'Price', 'Rent/mo', 'Cap Rate', 'Cash Flow/mo', 'CoC Return', 'Upfront Capital', 'Score', 'Added', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(d => (
                      <React.Fragment key={d.id}>
                        <tr
                          className={`border-b border-gray-800/60 transition-colors group cursor-pointer
                            ${loadedId === d.id ? 'bg-sky-950/30' : 'hover:bg-gray-800/30'}`}
                          onClick={() => onLoadDeal(d)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-white font-medium max-w-[160px] truncate" title={d.address}>{d.address}</span>
                              {d.notes && (
                                <span className="text-gray-500 text-xs max-w-[160px] truncate mt-0.5" title={d.notes}>{d.notes}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">{fmt$(d.askingPrice)}</td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">{fmt$(d.monthlyRent)}</td>
                          <td className="px-4 py-3 text-sky-400 font-semibold whitespace-nowrap tabular-nums">{fmtPct(d.capRate)}</td>
                          <td className={`px-4 py-3 font-semibold whitespace-nowrap tabular-nums
                            ${d.monthlyCF >= 450 ? 'text-green-400' : d.monthlyCF >= 250 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {fmt$(d.monthlyCF)}
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">{fmtPct(d.coc)}</td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                            {d.totalUpfront ? fmt$(d.totalUpfront) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.scoreCls}`}>
                              {d.scoreLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{d.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setExpandedId(v => v === d.id ? null : d.id)}
                                className={`transition-colors text-xs px-2 py-1 rounded-md border
                                  ${expandedId === d.id
                                    ? 'border-sky-700 text-sky-400 bg-sky-900/20'
                                    : d.notes
                                    ? 'border-gray-600 text-gray-300 bg-gray-800/40'
                                    : 'border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600'}`}
                              >
                                {d.notes ? '📝' : 'Notes'}
                              </button>
                              <button
                                onClick={() => onDelete(d.id)}
                                className="text-gray-700 hover:text-red-400 transition-colors text-xl leading-none opacity-0 group-hover:opacity-100"
                                title="Delete deal"
                              >
                                &times;
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedId === d.id && (
                          <tr className="border-b border-gray-800/60 bg-gray-900/40">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                  Notes — {d.address || 'this deal'}
                                </label>
                                <textarea
                                  rows={3}
                                  value={d.notes || ''}
                                  onChange={e => onUpdateNote(d.id, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Add notes — neighborhood, repair estimates, seller motivation, next steps..."
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition-all"
                                />
                                <p className="text-[10px] text-gray-600">Notes auto-save as you type</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {loadedId && (
              <p className="text-xs text-sky-500 mt-2 text-center">
                Deal loaded — scroll up to review or adjust numbers and re-analyze
              </p>
            )}
          </section>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-800/60 pt-8 pb-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src="/logo.png"
              alt="Success with Section 8"
              className="h-10 w-auto object-contain opacity-60"
            />
            <p className="text-gray-500 text-sm font-medium">Built for Success with Section 8</p>
            <p className="text-gray-700 text-xs">Estimates only — not financial advice</p>
          </div>
        </footer>

      </main>
    </div>
  )
}
