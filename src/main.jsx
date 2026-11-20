import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bell, ChevronDown,
  CircleDollarSign, Clock3, Download, FileText, LayoutDashboard, LockKeyhole,
  LogOut, Menu, RefreshCw, Search, Settings, ShieldCheck, Wallet, X,
  ReceiptText, CircleAlert, LoaderCircle
} from "lucide-react";
import { supabase, isSupabaseConfigured, OWNER_EMAIL } from "./lib/supabase.js";
import "./styles.css";

const nav = [
  ["Overview", LayoutDashboard], ["Income", ArrowDownLeft], ["Settlements", Clock3],
  ["Expenses", ArrowUpRight], ["Refunds", RefreshCw], ["Withdrawals", Wallet],
  ["Reports", BarChart3], ["Audit log", ShieldCheck]
];
const plans = [
  { name: "Starter", price: "$1", period: "first month", features: ["1 shop", "Up to 10 phone listings", "2 images per phone"] },
  { name: "Premium", price: "$13.50", period: "monthly", features: ["1 shop", "Up to 25 phone listings", "4 images per phone", "Top placement opportunities"], featured: true }
];
const money = (value, currency) => new Intl.NumberFormat(currency === "LKR" ? "en-LK" : "en-US", {
  style: "currency", currency, minimumFractionDigits: currency === "LKR" ? 2 : 2, maximumFractionDigits: 2
}).format(Number(value || 0));
const dateText = value => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ ledger: [], expenses: [], refunds: [], withdrawals: [], audit: [] });
  const [dataError, setDataError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadFinance = useCallback(async () => {
    if (!supabase || !user) return;
    setPageLoading(true);
    setDataError("");
    const specs = [
      ["ledger", "finance_ledger_entries", "occurred_at"],
      ["expenses", "finance_expenses", "created_at"],
      ["refunds", "finance_refunds", "created_at"],
      ["withdrawals", "finance_withdrawals", "requested_at"],
      ["audit", "finance_audit_log", "created_at"]
    ];
    const results = await Promise.all(specs.map(async ([key, table, sort]) => {
      const result = await supabase.from(table).select("*").order(sort, { ascending: false }).limit(250);
      return { key, ...result };
    }));
    const failed = results.find(r => r.error);
    if (failed) {
      setDataError(failed.error.message || "Could not load finance records. Check the connection and database access.");
    } else {
      const next = {};
      results.forEach(r => { next[r.key] = r.data || []; });
      setData(next);
      setLastUpdated(new Date());
    }
    setPageLoading(false);
  }, [user]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!alive) return;
      if (current?.user?.email?.toLowerCase() === OWNER_EMAIL) {
        setSession(current); setUser(current.user);
      } else if (current) {
        supabase.auth.signOut();
      }
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => {
      if (!alive) return;
      if (current?.user?.email?.toLowerCase() === OWNER_EMAIL) {
        setSession(current); setUser(current.user);
      } else {
        setSession(null); setUser(null);
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (user) loadFinance(); }, [user, loadFinance]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = event => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const ledger = data.ledger;
  const settled = useMemo(() => ledger.filter(e => e.status === "settled"), [ledger]);
  const totals = useMemo(() => ["USD", "LKR"].reduce((acc, cur) => {
    const rows = settled.filter(e => e.currency === cur);
    const credits = rows.filter(e => e.entry_type === "credit").reduce((s, e) => s + Number(e.amount), 0);
    const debits = rows.filter(e => e.entry_type === "debit").reduce((s, e) => s + Number(e.amount), 0);
    acc[cur] = { income: credits, expenses: debits, balance: credits - debits };
    return acc;
  }, {}), [settled]);
  const pending = ledger.filter(e => e.status === "pending");
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = active === "Income" ? ledger.filter(e => e.category === "subscription_revenue" && e.entry_type === "credit")
      : active === "Settlements" ? ledger.filter(e => e.status !== "settled")
      : active === "Expenses" ? ledger.filter(e => e.category === "expense" || e.category === "processor_fee")
      : ledger;
    return q ? source.filter(e => [e.description, e.category, e.source_reference, e.status, e.currency].some(v => String(v || "").toLowerCase().includes(q))) : source;
  }, [active, ledger, search]);

  const signIn = async e => {
    e.preventDefault(); setBusy(true); setLoginError("");
    if (!supabase) { setLoginError("Supabase configuration is missing. Add the project URL and publishable key to the build environment."); setBusy(false); return; }
    if (loginEmail.trim().toLowerCase() !== OWNER_EMAIL) { setLoginError("This account is not the designated Finance Wallet owner."); setBusy(false); return; }
    const { data: result, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password });
    if (error) setLoginError(error.message);
    else if (result.user?.email?.toLowerCase() !== OWNER_EMAIL) { await supabase.auth.signOut(); setLoginError("This account is not authorized for this workspace."); }
    setBusy(false);
  };
  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); setUser(null); setData({ ledger: [], expenses: [], refunds: [], withdrawals: [], audit: [] }); };

  const exportCsv = () => {
    const rows = [["Date", "Type", "Category", "Description", "Amount", "Currency", "Status", "Reference"],
      ...visibleRows.map(e => [e.occurred_at || e.created_at, e.entry_type, e.category, e.description || "", e.amount, e.currency, e.status, e.source_reference || ""])];
    const csv = rows.map(row => row.map(v => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "phonelanka-finance-ledger.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (authLoading) return <LoadingScreen label="Checking secure session…" />;
  if (!user) return <LoginScreen email={loginEmail} setEmail={setLoginEmail} password={password} setPassword={setPassword} onSubmit={signIn} busy={busy} error={loginError} configured={isSupabaseConfigured} />;

  const pageTitle = active === "Overview" ? "Business overview" : active;
  const PageIcon = nav.find(([label]) => label === active)?.[1] || Settings;
  return <div className="app-shell">
    <aside id="primary-navigation" className={mobileOpen ? "sidebar open" : "sidebar"} aria-label="Main navigation">
      <div className="brand"><div className="brand-mark"><CircleDollarSign size={22}/></div><div><strong>PhoneLanka</strong><span>FINANCE WORKSPACE</span></div><button type="button" className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(([label, NavIcon]) => <button type="button" key={label} aria-current={active === label ? "page" : undefined} className={active === label ? "nav-item active" : "nav-item"} onClick={() => { setActive(label); setSearch(""); setMobileOpen(false); }}><NavIcon size={18}/><span>{label}</span>{label === "Audit log" && <span className="nav-lock"><LockKeyhole size={13}/></span>}</button>)}</nav>
      <div className="sidebar-bottom"><button type="button" aria-current={active === "Settings" ? "page" : undefined} className={active === "Settings" ? "nav-item active" : "nav-item"} onClick={() => { setActive("Settings"); setSearch(""); setMobileOpen(false); }}><Settings size={18}/>Settings</button><div className="owner-card"><div className="owner-avatar">PL</div><div><strong>Finance owner</strong><span>{user.email}</span></div><ShieldCheck size={16}/></div></div>
    </aside>
    {mobileOpen && <button type="button" className="scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button type="button" className="mobile-menu icon-button" onClick={() => setMobileOpen(open => !open)} aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} aria-controls="primary-navigation"><Menu size={20}/></button><div className="breadcrumb">PhoneLanka <span>/</span> <b>{active}</b></div><div className="top-actions"><div className="secure-label"><ShieldCheck size={15}/> Owner-only access</div><button className="icon-button" onClick={loadFinance} aria-label="Refresh data"><RefreshCw size={17}/></button><button className="avatar" onClick={signOut} title="Sign out"><LogOut size={15}/></button></div></header>
      <div className="content">
        <section className="page-heading"><div><div className="eyebrow">FINANCIAL CONTROL CENTRE</div><h1>{pageTitle}</h1><p>PhoneLanka seller subscription revenue and business finances.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setCurrency(currency === "USD" ? "LKR" : "USD")}>{currency} <ChevronDown size={15}/></button>{active !== "Overview" && <button className="secondary-button" onClick={exportCsv}><Download size={15}/> Export CSV</button>}</div></section>
        <div className="live-banner"><span className="live-dot"/><b>Connected to PhoneLanka Finance database</b><span>Read-only dashboard</span><span className="last-updated">{lastUpdated ? "Updated " + lastUpdated.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""}</span></div>
        {dataError && <div className="error-banner"><CircleAlert size={17}/><span>{dataError}</span><button onClick={loadFinance}>Retry</button></div>}
        {pageLoading && <div className="loading-strip"><LoaderCircle size={15}/> Refreshing finance records…</div>}
        {active === "Overview" && <Overview totals={totals} pending={pending} ledger={ledger} currency={currency} onGo={setActive}/>}
        {["Income","Settlements","Expenses"].includes(active) && <LedgerPage active={active} rows={visibleRows} search={search} setSearch={setSearch} onExport={exportCsv}/>}
        {active === "Refunds" && <SimpleTable title="Refund records" description="Refund records linked to their original ledger entries." rows={data.refunds} columns={[["amount","Amount"],["currency","Currency"],["status","Status"],["reason","Reason"],["created_at","Created"]]}/>}
        {active === "Withdrawals" && <SimpleTable title="Withdrawal tracking" description="Tracking only; a paid status must reflect a confirmed external transfer." rows={data.withdrawals} columns={[["amount","Amount"],["currency","Currency"],["status","Status"],["destination_label","Destination"],["provider_reference","Reference"],["requested_at","Requested"]]}/>}
        {active === "Reports" && <Reports totals={totals} ledger={ledger}/>}
        {active === "Audit log" && <SimpleTable title="Audit history" description="Append-only record of finance workspace actions." rows={data.audit} columns={[["action","Action"],["entity_type","Entity"],["entity_id","Record ID"],["created_at","Time"]]}/>}
        {active === "Settings" && <SettingsPage user={user} onSignOut={signOut}/>}
        <footer><span>PhoneLanka Finance <i>•</i> Private owner workspace</span><span><LockKeyhole size={13}/> Row-level security enforced by Supabase</span></footer>
      </div>
    </main>
  </div>;
}

function LoadingScreen({ label }) { return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><CircleDollarSign size={22}/></div><LoaderCircle className="spin" size={20}/><p>{label}</p></div></div>; }
function LoginScreen({ email, setEmail, password, setPassword, onSubmit, busy, error, configured }) {
  return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><CircleDollarSign size={22}/></div><div><strong>PhoneLanka</strong><span>FINANCE WORKSPACE</span></div></div><div className="auth-eyebrow">PRIVATE OWNER ACCESS</div><h1>Welcome back.</h1><p className="auth-description">Sign in with the designated PhoneLanka Finance owner account.</p>
    {!configured && <div className="error-banner"><CircleAlert size={16}/> Supabase URL or publishable key is missing from the build configuration.</div>}
    <form onSubmit={onSubmit}><label>Email address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/><button className="primary-button login-button" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={16}/> : <LockKeyhole size={16}/>} Sign in securely</button></form>
    {error && <div className="form-error">{error}</div>}<div className="auth-foot"><ShieldCheck size={15}/> Only the configured owner can access finance records.</div></div></div>;
}
function Metric({ title, value, note, icon: Icon }) { return <div className="metric-card"><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={17}/></div></div><div className="metric-value">{value}</div><div className="metric-note"><span className="dot"/> {note}</div></div>; }
function Overview({ totals, pending, ledger, currency, onGo }) {
  const t = totals[currency];
  const recent = ledger.slice(0, 6);
  return <>
    <section className="currency-summary"><div><span>USD BALANCE</span><strong>{money(totals.USD.balance,"USD")}</strong><small>Settled income less settled debits</small></div><div><span>LKR BALANCE</span><strong>{money(totals.LKR.balance,"LKR")}</strong><small>Kept separate from USD</small></div></section>
    <section className="metric-grid"><Metric title={currency+" settled income"} value={money(t.income,currency)} note="Confirmed settled credits" icon={ArrowDownLeft}/><Metric title={currency+" available balance"} value={money(t.balance,currency)} note="Settled credits less debits" icon={Wallet}/><Metric title="Pending payments" value={pending.length.toLocaleString()} note="Not counted as available funds" icon={Clock3}/><Metric title={currency+" settled debits"} value={money(t.expenses,currency)} note="Expenses and other debits" icon={ReceiptText}/></section>
    <IncomeAnalytics ledger={ledger} currency={currency}/>
    <div className="section-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent financial activity</h2><p>Latest recorded ledger entries</p></div><button className="text-button" onClick={()=>onGo("Income")}>View ledger →</button></div>{recent.length ? <div className="table-wrap"><table><thead><tr><th>DETAIL</th><th>DATE</th><th>STATUS</th><th className="right">AMOUNT</th></tr></thead><tbody>{recent.map(e=><tr key={e.id}><td><b>{e.description || e.category}</b><small>{e.category}</small></td><td>{dateText(e.occurred_at || e.created_at)}</td><td><Status value={e.status}/></td><td className="right amount">{e.entry_type==="debit"?"−":"+"}{money(e.amount,e.currency)}</td></tr>)}</tbody></table></div> : <Empty icon={BarChart3} title="No financial activity yet" text="No verified transactions have been recorded. Your balances correctly start at zero."/>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Seller subscription plans</h2><p>Current PhoneLanka pricing reference</p></div><span className="tiny-tag">PLAN DETAILS</span></div><div className="plan-list">{plans.map(p=><div className="plan" key={p.name}><div className="plan-top"><div><strong>{p.name}</strong>{p.featured&&<span className="premium-tag">POPULAR</span>}</div><div className="plan-price">{p.price}<small> / {p.period}</small></div></div><ul>{p.features.map(f=><li key={f}>{f}</li>)}</ul></div>)}</div><div className="integrity-note"><ShieldCheck size={16}/> Only confirmed subscription payments count as received revenue.</div></section></div>
    <section className="notice-row"><ShieldCheck size={17}/><span><b>Financial integrity:</b> USD and LKR are never combined. Currency conversion requires a recorded rate, source, timestamp and matching ledger entries. Buyer-to-seller payments are not PhoneLanka revenue.</span></section>
  </>;
}
function Status({value}) { return <span className={"status status-"+String(value||"unknown").toLowerCase()}>{value||"unknown"}</span>; }
function Empty({icon:Icon=FileText,title,text}) { return <div className="empty-ledger"><Icon size={22}/><strong>{title}</strong><span>{text}</span></div>; }
function LedgerPage({active,rows,search,setSearch,onExport}) {
  return <section className="panel ledger-panel"><div className="panel-heading"><div><h2>{active} ledger</h2><p>Live records from the owner-protected finance ledger.</p></div><button className="text-button" onClick={onExport}><Download size={15}/> Export CSV</button></div><div className="table-tools"><div className="search-field"><Search size={16}/><input placeholder="Search description, category or reference…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span>{rows.length} records</span></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>DATE</th><th>TYPE / CATEGORY</th><th>DESCRIPTION</th><th>STATUS</th><th className="right">AMOUNT</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{dateText(e.occurred_at||e.created_at)}</td><td><b>{e.entry_type}</b><small>{e.category}</small></td><td>{e.description||"—"}<small>{e.source_reference||e.source||""}</small></td><td><Status value={e.status}/></td><td className="right amount">{e.entry_type==="debit"?"−":"+"}{money(e.amount,e.currency)}</td></tr>)}</tbody></table></div>:<Empty title="Nothing to show" text="No matching finance records are available."/>}</section>;
}
function SimpleTable({title,description,rows,columns}) {
  return <section className="panel ledger-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="tiny-tag">{rows.length} RECORDS</span></div>{rows.length ? <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c[0]}>{c[1].toUpperCase()}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{columns.map(([key,label])=><td key={key}>{key==="status"?<Status value={r[key]}/>:key.includes("_at")?dateText(r[key]):key==="amount"?money(r[key],r.currency):r[key]||"—"}</td>)}</tr>)}</tbody></table></div>:<Empty title="No records yet" text="This section will show verified records as they are securely added."/>}</section>;
}
function IncomeAnalytics({ ledger, currency }) {
  const [range, setRange] = useState("month");
  const chart = useMemo(() => {
    const now = new Date();
    const periods = [];
    if (range === "day") {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        periods.push({ key: d.toLocaleDateString("en-CA"), label: d.toLocaleDateString([], { weekday: "short" }), full: d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }), value: 0 });
      }
    } else if (range === "month") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString([], { month: "short" }), full: d.toLocaleDateString([], { month: "long", year: "numeric" }), value: 0 });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        periods.push({ key: String(year), label: String(year), full: String(year), value: 0 });
      }
    }
    const index = new Map(periods.map((p, i) => [p.key, i]));
    ledger.forEach(entry => {
      if (entry.status !== "settled" || entry.entry_type !== "credit" || entry.category !== "subscription_revenue" || entry.currency !== currency) return;
      const d = new Date(entry.occurred_at || entry.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = range === "day" ? d.toLocaleDateString("en-CA")
        : range === "month" ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
        : String(d.getFullYear());
      const i = index.get(key);
      if (i !== undefined) periods[i].value += Number(entry.amount || 0);
    });
    return periods;
  }, [ledger, currency, range]);
  const total = chart.reduce((sum, p) => sum + p.value, 0);
  const peak = chart.reduce((best, p) => p.value > best.value ? p : best, { value: 0, label: "—" });
  const max = Math.max(1, ...chart.map(p => p.value));
  const points = chart.map((p, i) => {
    const x = chart.length === 1 ? 50 : 8 + i * (84 / (chart.length - 1));
    const y = 92 - (p.value / max) * 76;
    return x + "," + y;
  }).join(" ");
  const ranges = [["day", "Day"], ["month", "Month"], ["year", "Year"]];
  return <section className="income-analytics">
    <div className="analytics-heading"><div><div className="eyebrow">REVENUE PERFORMANCE</div><h2>Income analytics</h2><p>Confirmed, settled PhoneLanka subscription income only · {currency}</p></div>
      <div className="range-switch">{ranges.map(([key, label]) => <button key={key} className={range === key ? "selected" : ""} onClick={() => setRange(key)}>{label}</button>)}</div>
    </div>
    <div className="analytics-summary">
      <div><span>{range === "day" ? "LAST 14 DAYS" : range === "month" ? "LAST 12 MONTHS" : "LAST 5 YEARS"}</span><strong>{money(total, currency)}</strong><small>Total settled income</small></div>
      <div><span>TOP PERIOD</span><strong>{money(peak.value, currency)}</strong><small>{peak.value ? peak.label : "No income recorded yet"}</small></div>
    </div>
    <div className="analytics-chart-grid">
      <div className="analytics-chart-card"><div className="chart-card-title"><div><h3>{range === "day" ? "Daily income" : range === "month" ? "Monthly income" : "Yearly income"}</h3><p>Income received in each period</p></div><span className="chart-legend"><i/> Income</span></div>
        {total > 0 ? <><div className="bar-chart" role="img" aria-label={range + " income bar chart"}>{chart.map(p => <div className="bar-column" key={p.key} title={p.full + ": " + money(p.value, currency)}><div className="bar-track"><i style={{ height: (p.value ? Math.max(3, p.value / max * 100) : 0) + "%" }}/></div><span>{p.label}</span></div>)}</div><div className="chart-footnote">Values are based on settled subscription credits in the selected currency.</div></> : <div className="chart-empty"><BarChart3 size={24}/><b>No settled income yet</b><span>Your real income chart will appear here when confirmed subscription payments are recorded.</span></div>}
      </div>
      <div className="analytics-chart-card trend-card"><div className="chart-card-title"><div><h3>Income trend</h3><p>{range === "day" ? "Daily movement" : range === "month" ? "Month-by-month movement" : "Year-by-year movement"}</p></div><Activity size={17}/></div>
        {total > 0 ? <><svg className="trend-svg" viewBox="0 0 100 100" role="img" aria-label={range + " income trend line"} preserveAspectRatio="none"><defs><linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9fcb79" stopOpacity=".35"/><stop offset="100%" stopColor="#9fcb79" stopOpacity="0"/></linearGradient></defs><path d={"M " + points.split(" ").join(" L ") + " L 92,96 L 8,96 Z"} fill="url(#incomeFill)"/><polyline points={points} fill="none" stroke="#79a956" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>{chart.map((p, i) => { const x = chart.length === 1 ? 50 : 8 + i * (84 / (chart.length - 1)); const y = 92 - (p.value / max) * 76; return <circle key={p.key} cx={x} cy={y} r="1.8" fill="#fff" stroke="#79a956" strokeWidth="1.2"><title>{p.full}: {money(p.value, currency)}</title></circle>; })}</svg><div className="trend-labels"><span>{chart[0]?.label}</span><span>{chart[Math.floor((chart.length - 1) / 2)]?.label}</span><span>{chart[chart.length - 1]?.label}</span></div></> : <div className="chart-empty"><Activity size={24}/><b>Waiting for income data</b><span>The trend line will reflect actual settled income, never example figures.</span></div>}
      </div>
    </div>
  </section>;
}

function Reports({totals,ledger}) {
  const months = useMemo(()=>{const out={};ledger.filter(e=>e.status==="settled").forEach(e=>{const d=new Date(e.occurred_at||e.created_at);const key=d.toLocaleDateString([],{month:"short",year:"2-digit"});out[key]??={USD:0,LKR:0};out[key][e.currency]+= (e.entry_type==="credit"?1:-1)*Number(e.amount);});return Object.entries(out).slice(-6);},[ledger]);
  return <><section className="currency-summary"><div><span>USD NET BALANCE</span><strong>{money(totals.USD.balance,"USD")}</strong><small>Settled ledger balance</small></div><div><span>LKR NET BALANCE</span><strong>{money(totals.LKR.balance,"LKR")}</strong><small>Settled ledger balance</small></div></section><section className="panel"><div className="panel-heading"><div><h2>Monthly net activity</h2><p>Separate currency totals; no automatic FX conversion.</p></div></div>{months.length?<div className="report-bars">{months.map(([month,v])=><div key={month}><span>{month}</span><div><i style={{height:Math.max(3,Math.min(100,Math.abs(v.USD)/Math.max(1,...months.map(x=>Math.abs(x[1].USD)))*100))+"%"}}/></div><small>{money(v.USD,"USD")}</small></div>)}</div>:<Empty icon={BarChart3} title="No report data yet" text="Monthly charts appear after settled transactions are recorded."/>}</section></>;
}
function SettingsPage({user,onSignOut}) {
  return <section className="panel section-empty"><div className="empty-large-icon"><Settings size={25}/></div><h2>Workspace settings</h2><p>Signed in as <b>{user.email}</b>. This workspace uses the PhoneLanka Finance tables with owner-only row-level security.</p><div className="disabled-note"><ShieldCheck size={15}/> Financial writes are disabled in this first release.</div><button className="secondary-button settings-signout" onClick={onSignOut}><LogOut size={15}/> Sign out</button></section>;
}
createRoot(document.getElementById("root")).render(<App/>);
