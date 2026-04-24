import { useState, useEffect, useRef, Fragment, Component } from 'react'

/* ── localStorage helpers — never throw ─────────────────────────────────── */
function loadDeals() {
  try {
    const raw = localStorage.getItem('s8deals')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveDeals(deals) {
  try {
    localStorage.setItem('s8deals', JSON.stringify(deals))
    return true
  } catch {
    return false  // storage full or unavailable (private browsing, etc.)
  }
}

/* ── Error Boundary — catches render crashes, shows recovery UI ─────────── */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false, message: '' }
  }
  static getDerivedStateFromError(err) {
    return { crashed: true, message: err?.message || 'Unknown error' }
  }
  componentDidCatch(err, info) {
    console.error('[Section 8 Analyzer] render error:', err, info)
  }
  handleReset = () => {
    try { localStorage.removeItem('s8deals') } catch {}
    window.location.reload()
  }
  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-white font-bold text-lg mb-1">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-6">{this.state.message}</p>
          <button
            onClick={this.handleReset}
            className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            Clear data &amp; reload
          </button>
          <p className="text-gray-700 text-xs mt-3">This will clear your saved deals.</p>
        </div>
      </div>
    )
  }
}

/* ── Toast notification ──────────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null
  const isSuccess = toast.type !== 'error'
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium pointer-events-none
      ${isSuccess ? 'bg-green-900/95 border border-green-700 text-green-200' : 'bg-red-900/95 border border-red-700 text-red-200'}`}
      style={{ backdropFilter: 'blur(8px)' }}
    >
      {isSuccess ? (
        <svg className="w-4 h-4 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      )}
      {toast.message}
    </div>
  )
}

/* ── Formatters ──────────────────────────────────────────────────────────── */
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

/* ── Strip commas from currency strings before parsing ───────────────────── */
const parseCurrency = (s) => +(String(s || '').replace(/,/g, '')) || 0

/* ── Core analysis ───────────────────────────────────────────────────────── */
const analyze = (f) => {
  const price          = parseCurrency(f.askingPrice)
  const rent           = parseCurrency(f.monthlyRent)
  const taxesMonthly   = parseCurrency(f.propertyTaxes)
  const insMonthly     = parseCurrency(f.insurance)
  const repairCosts    = parseCurrency(f.repairCosts)
  const maintPct       = +f.maintenancePct  || 0
  const mgmtPct        = +f.mgmtPct         || 0
  const vacPct         = +f.vacancyPct      || 0
  const dpPct          = Math.min(100, Math.max(0, +f.downPaymentPct  || 100))
  const rate           = +f.interestRate    || 0
  const term           = +f.loanTerm        || 30
  const closingCostPct = +f.closingCostsPct || 0

  const annualRent  = rent * 12
  const vacancyLoss = annualRent * (vacPct / 100)
  const egi         = annualRent - vacancyLoss
  const maintenance = annualRent * (maintPct / 100)
  const mgmt        = annualRent * (mgmtPct / 100)
  const opex        = (taxesMonthly * 12) + (insMonthly * 12) + maintenance + mgmt
  const noi         = egi - opex
  const capRate     = price > 0 ? (noi / price) * 100 : 0

  const downPayment  = price * (dpPct / 100)
  const closingCosts = price * (closingCostPct / 100)
  const loanAmount   = price - downPayment
  const mtgMonthly   = dpPct < 100 ? calcMtg(loanAmount, rate, term) : 0
  const annualDebt   = mtgMonthly * 12
  const totalUpfront = downPayment + closingCosts + repairCosts
  const annualCF     = noi - annualDebt
  const monthlyCF    = annualCF / 12
  const coc          = totalUpfront > 0 ? (annualCF / totalUpfront) * 100 : 0
  const pitiMonthly  = mtgMonthly + taxesMonthly + insMonthly
  const dscr         = annualDebt > 0 ? noi / annualDebt : null

  return {
    annualRent, vacancyLoss, egi,
    taxesMonthly, insMonthly, maintenance, mgmt, opex, noi,
    capRate, downPayment, closingCosts, repairCosts, loanAmount,
    mtgMonthly, annualDebt, totalUpfront, annualCF, monthlyCF, coc, pitiMonthly, dscr,
  }
}

/* ── Score — fixed thresholds ────────────────────────────────────────────── */
// These full class strings must stay as literals so Tailwind includes them in the bundle.
const getScore = (monthlyCF) => {
  if (monthlyCF >= 450) return { label: 'Good', cls: 'bg-green-900/50 text-green-400 ring-1 ring-green-600'    }
  if (monthlyCF >= 250) return { label: 'Fair', cls: 'bg-yellow-900/50 text-yellow-400 ring-1 ring-yellow-600'  }
  return                       { label: 'Poor', cls: 'bg-red-900/50 text-red-400 ring-1 ring-red-600'           }
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
function Field({ label, name, value, onChange, placeholder, pre, suf, isText, isCurrency, required, span2, tooltip }) {
  const handleChange = (e) => {
    if (!isCurrency) { onChange(e); return }
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const formatted = parts.length > 1 ? `${intFormatted}.${parts.slice(1).join('')}` : intFormatted
    onChange({ target: { name: e.target.name, value: formatted } })
  }
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
          type={isText || isCurrency ? 'text' : 'number'}
          inputMode={isCurrency ? 'decimal' : undefined}
          name={name}
          value={value}
          onChange={handleChange}
          placeholder={placeholder || '0'}
          step={isCurrency ? undefined : 'any'}
          min={isCurrency ? undefined : '0'}
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
    ? { label: 'GOOD DEAL', desc: "Great numbers — you're in solid profit territory.",      ring: 'ring-green-500',  bg: 'bg-green-950/70',  text: 'text-green-300',  dot: 'bg-green-400'  }
    : fair
    ? { label: 'FAIR DEAL', desc: 'It works! You might even be able to find better.',            ring: 'ring-yellow-500', bg: 'bg-yellow-950/70', text: 'text-yellow-300', dot: 'bg-yellow-400' }
    : { label: 'POOR DEAL', desc: 'Better opportunities are out there — keep looking.',     ring: 'ring-red-500',    bg: 'bg-red-950/70',    text: 'text-red-300',    dot: 'bg-red-400'    }

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
  propertyTaxes: '150', insurance: '100', repairCosts: '',
  maintenancePct: '5', vacancyPct: '1', mgmtPct: '8',
  downPaymentPct: '20', interestRate: '7', loanTerm: '30', closingCostsPct: '3',
}

/* ── App (wrapped in ErrorBoundary at export) ────────────────────────────── */
function AppInner() {
  const [form,       setForm]       = useState(DEFAULTS)
  const [result,     setResult]     = useState(null)
  const [err,        setErr]        = useState('')
  const [saved,      setSaved]      = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [loadedId,   setLoadedId]   = useState(null)
  const [toast,      setToast]      = useState(null)
  const toastTimer = useRef(null)
  const topRef     = useRef(null)

  const [deals, setDeals] = useState(loadDeals)

  // Persist deals whenever they change
  useEffect(() => {
    const ok = saveDeals(deals)
    if (!ok && deals.length > 0) {
      showToast('Could not save — browser storage may be full.', 'error')
    }
  }, [deals])

  const showToast = (message, type = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

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
    try {
      setResult({ ...analyze(form), _form: { ...form } })
      setSaved(false)
      setLoadedId(null)
    } catch (e) {
      setErr('Calculation error — please check your inputs.')
      console.error(e)
    }
  }

  const onSave = () => {
    if (!result || saved) return
    try {
      const score = getScore(result.monthlyCF)
      const newDeal = {
        id:           Date.now(),
        date:         new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        address:      result._form.address || 'Unnamed Property',
        askingPrice:  parseCurrency(result._form.askingPrice),
        monthlyRent:  parseCurrency(result._form.monthlyRent),
        capRate:      result.capRate,
        monthlyCF:    result.monthlyCF,
        coc:          result.coc,
        totalUpfront: result.totalUpfront,
        scoreLabel:   score.label,
        scoreCls:     score.cls,
        notes:        '',
        _form:        { ...result._form },
      }
      setDeals(d => [newDeal, ...d])
      setSaved(true)
      showToast('Deal saved successfully!')
    } catch (e) {
      showToast('Failed to save deal — please try again.', 'error')
      console.error(e)
    }
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
    try {
      setForm(deal._form)
      setResult({ ...analyze(deal._form), _form: { ...deal._form } })
      setSaved(true)
      setLoadedId(deal.id)
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) {
      showToast('Could not load deal — data may be corrupted.', 'error')
      console.error(e)
    }
  }

  const r = result

  return (
    <div className="min-h-screen bg-gray-950">
      <div ref={topRef} />
      <Toast toast={toast} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex items-center gap-5">
          <a href="/" className="flex items-center flex-shrink-0 group" title="Success with Section 8 Analyzer">
            <img
              src="/logo.png"
              alt="Success with Section 8"
              className="h-20 sm:h-24 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
            />
          </a>
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

            <section className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 space-y-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Property Info</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Property Address" name="address" value={form.address} onChange={onChange}
                  placeholder="123 Main St, City, ST" isText span2 />
                <Field label="Asking Price" name="askingPrice" value={form.askingPrice} onChange={onChange}
                  placeholder="150,000" pre="$" isCurrency required
                  tooltip="The purchase price of the property you're analyzing." />
                <Field label="Monthly Rent" name="monthlyRent" value={form.monthlyRent} onChange={onChange}
                  placeholder="1,200" pre="$" isCurrency required
                  tooltip="The monthly rent you'll receive. With Section 8, the housing authority pays a guaranteed portion directly — very reliable even if the tenant can't pay their portion." />
                <Field label="Property Taxes / mo" name="propertyTaxes" value={form.propertyTaxes} onChange={onChange}
                  placeholder="200" pre="$" isCurrency
                  tooltip="Your monthly property tax cost. Divide your annual tax bill by 12. Find it on the county assessor's website or ask the seller for a recent tax statement." />
                <Field label="Insurance / mo" name="insurance" value={form.insurance} onChange={onChange}
                  placeholder="100" pre="$" isCurrency
                  tooltip="Monthly landlord insurance cost. Divide your annual premium by 12. Annual landlord insurance typically runs $800–$2,000/year." />
                <Field label="Est. Repair Costs" name="repairCosts" value={form.repairCosts} onChange={onChange}
                  placeholder="5,000" pre="$" isCurrency
                  tooltip="One-time upfront cost to repair or rehab before renting. Factored into Total Upfront Capital and cash-on-cash return — does not affect monthly cash flow." />
                <Field label="Maintenance %" name="maintenancePct" value={form.maintenancePct} onChange={onChange}
                  placeholder="5" suf="%"
                  tooltip="Ongoing budget for repairs as a % of annual gross rent. 5% is a common starting point — use 8–10% for older homes. Covers plumbing, appliances, general wear and tear." />
                <Field label="Vacancy %" name="vacancyPct" value={form.vacancyPct} onChange={onChange}
                  placeholder="1" suf="%"
                  tooltip="% of the year your property might sit empty. Section 8 tenants tend to stay much longer, so 1% is realistic — roughly 3–4 days per year." />
                <Field label="Property Mgmt %" name="mgmtPct" value={form.mgmtPct} onChange={onChange}
                  placeholder="8" suf="%" span2
                  tooltip="Property management fee as a % of gross annual rent. Typically 8–12%. Set to 0 if self-managing." />
              </div>
            </section>

            <section className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Financing</p>
                <span className="text-[11px] text-gray-600">100% down = all-cash</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Down Payment %" name="downPaymentPct" value={form.downPaymentPct} onChange={onChange}
                  placeholder="20" suf="%"
                  tooltip="% of the purchase price you pay upfront. The rest is financed. Higher down payment = lower monthly payments but more cash tied up." />
                <Field label="Interest Rate" name="interestRate" value={form.interestRate} onChange={onChange}
                  placeholder="7.0" suf="%"
                  tooltip="Annual mortgage interest rate. Investor loan rates are typically 0.5–1% higher than primary residence rates." />
                <Field label="Loan Term" name="loanTerm" value={form.loanTerm} onChange={onChange}
                  placeholder="30" suf="yr"
                  tooltip="Years to pay off the mortgage. 30-year = lower monthly payments; 15-year = faster equity but higher monthly cost." />
                <Field label="Closing Costs %" name="closingCostsPct" value={form.closingCostsPct} onChange={onChange}
                  placeholder="3" suf="%"
                  tooltip="Fees at closing — typically 2–5% for investment properties. Includes lender fees, title insurance, attorney fees, and prepaid items." />
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
                <div className="grid grid-cols-2">
                  <ScoreBadge monthlyCF={r.monthlyCF} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Monthly Cash Flow"
                    value={fmt$(r.monthlyCF)}
                    sub="after all expenses & debt"
                    color={r.monthlyCF >= 450 ? 'text-green-400' : r.monthlyCF >= 250 ? 'text-yellow-400' : 'text-red-400'}
                    tooltip="Money left in your pocket each month after every expense and mortgage payment."
                  />
                  <MetricCard
                    label="Cap Rate"
                    value={fmtPct(r.capRate)}
                    sub="NOI ÷ purchase price"
                    color={r.capRate >= 8 ? 'text-green-400' : r.capRate >= 5 ? 'text-yellow-400' : 'text-red-400'}
                    tooltip="Your annual return assuming an all-cash purchase. Calculated as Net Operating Income ÷ Purchase Price. Most investors target 6–10%."
                  />
                  <MetricCard
                    label="Cash-on-Cash Return"
                    value={fmtPct(r.coc)}
                    sub={`${fmt$(r.totalUpfront)} total invested`}
                    color={r.coc >= 8 ? 'text-green-400' : r.coc >= 5 ? 'text-yellow-400' : 'text-red-400'}
                    tooltip="Annual cash earned ÷ all cash you put in (down payment + closing costs + repairs). One of the most important metrics for real investors."
                  />
                  <MetricCard
                    label="DSCR"
                    value={r.dscr !== null ? r.dscr.toFixed(2) : 'N/A'}
                    sub={r.dscr !== null ? 'NOI ÷ annual debt service' : 'all-cash purchase'}
                    color={r.dscr === null ? 'text-gray-400' : r.dscr >= 1 ? 'text-green-400' : 'text-red-400'}
                    tooltip="Debt Service Coverage Ratio — how many times your NOI covers the mortgage. Above 1.0 means income covers debt; lenders typically require 1.25+."
                  />
                </div>

                {/* Total Upfront Capital */}
                <div className="bg-sky-950/40 border-2 border-sky-800/60 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-sky-400/70 uppercase tracking-widest mb-2">
                    <Tooltip text="Total cash needed to close and get rent-ready: down payment + closing costs + repairs. This is the number to have in your account before moving forward.">
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

                {/* Breakdown */}
                <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-700/50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Income &amp; Expense Breakdown</p>
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
                        <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.vacancyLoss / 12)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Property Taxes</td>
                        <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.taxesMonthly)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Insurance</td>
                        <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.insMonthly)} /month</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-400">Maintenance</td>
                        <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.maintenance / 12)} /month</td>
                      </tr>
                      {r.mgmt > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-gray-400">Property Management</td>
                          <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.mgmt / 12)} /month</td>
                        </tr>
                      )}
                      <tr>
                        <td className="px-4 py-2 text-gray-400">
                          <Tooltip text="Income after all operating costs but before your mortgage — key for comparing deals regardless of financing.">
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
                            <Tooltip text="Total yearly mortgage payments (principal + interest). Subtracted from NOI to get actual annual cash flow.">
                              Annual Debt Service
                            </Tooltip>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.annualDebt)}</td>
                        </tr>
                      )}
                      {r.annualDebt > 0 && r.pitiMonthly > 0 && (
                        <tr>
                          <td className="px-4 py-2 text-gray-400">
                            <Tooltip text="Principal + Interest + Taxes + Insurance — your total monthly housing cost used by lenders to qualify financing.">
                              PITI
                            </Tooltip>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white">− {fmt$(r.pitiMonthly)} /month</td>
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

                {r.loanAmount > 0 && (
                  <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-4 space-y-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mortgage</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Loan Balance</p>
                        <p className="text-2xl font-black text-white tabular-nums">{fmt$(r.loanAmount)}</p>
                      </div>
                      <div className="text-right text-xs text-gray-400 space-y-0.5">
                        <p>Monthly P&I <span className="text-white font-semibold tabular-nums">{fmt$(r.mtgMonthly)}</span></p>
                        <p>PITI <span className="text-white font-semibold tabular-nums">{fmt$(r.pitiMonthly)}</span></p>
                      </div>
                    </div>
                  </div>
                )}

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
                      // Fragment requires explicit import — NOT React.Fragment
                      <Fragment key={d.id}>
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
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Browser-only storage notice */}
            <p className="text-gray-600 text-xs text-center mt-3">
              🔒 Your deals are saved in your browser only — they won&apos;t sync across devices.
            </p>

            {loadedId && (
              <p className="text-xs text-sky-500 mt-1.5 text-center">
                Deal loaded — scroll up to review or adjust numbers and re-analyze
              </p>
            )}
          </section>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-800/60 pt-8 pb-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo.png" alt="Success with Section 8" className="h-10 w-auto object-contain opacity-60" />
            <p className="text-gray-500 text-sm font-medium">Built for Success with Section 8</p>
            <p className="text-gray-700 text-xs">Estimates only — not financial advice</p>
          </div>
        </footer>

      </main>
    </div>
  )
}

/* ── Default export wraps AppInner in ErrorBoundary ──────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
