import { useEffect, useMemo, useState } from "react";
import api from "./api";

const money = value => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_SETTINGS = {
  shop_name: "DIGI DIGITAL SERVICE",
  pan_number: "",
  mobile_number: "",
  address: "",
  tagline: "Digital & Online Service Center",
  footer_note: "Thank you for your visit!",
  default_format: "thermal",
  logo_url: ""
};

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { const { data } = await api.post("/auth/login", { username, password }); localStorage.setItem("digi_token", data.token); onLogin(); }
    catch (err) { setError(err.response?.data?.error || "Could not connect to backend."); }
    finally { setBusy(false); }
  }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark">D</div><p className="eyebrow">DIGI DIGITAL SERVICE</p><h1>Welcome back</h1><p className="muted">Sign in to manage your digital service center.</p>
    <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" /></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label>
    {error && <div className="error">{error}</div>}<button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    <p className="tiny">Use the admin credentials configured in backend/.env.</p>
  </form></main>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("digi_token")));
  const [page, setPage] = useState("Dashboard");
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tx, setTx] = useState({ customer_name:"", customer_phone:"", service_charge:0, discount:0, payment_method:"Cash", payment_status:"Paid" });
  const [items, setItems] = useState([{ service_name:"", description:"", quantity:1, price:"" }]);
  const [expense, setExpense] = useState({ title:"", category:"Internet", amount:"", note:"", expense_date:today() });
  const [invoice, setInvoice] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState("thermal");

  async function loadData() {
    setLoading(true);
    try {
      const [t, e, s, cfg] = await Promise.all([
        api.get("/transactions"),
        api.get("/expenses"),
        api.get("/reports/summary", { params: { from: today(), to: today() } }),
        api.get("/settings").catch(() => ({ data: DEFAULT_SETTINGS }))
      ]);
      setTransactions(t.data);
      setExpenses(e.data);
      setSummary(s.data);
      if (cfg?.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...cfg.data });
        setReceiptFormat(cfg.data.default_format || "thermal");
      }
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem("digi_token"); setLoggedIn(false); }
      else setNotice(err.response?.data?.error || "Unable to load data. Check backend and database.");
    } finally { setLoading(false); }
  }
  useEffect(() => { if (loggedIn) loadData(); }, [loggedIn]);

  const visibleTransactions = useMemo(() => transactions.filter(t => [t.invoice_no,t.customer_name,t.customer_phone,t.service_name].join(" ").toLowerCase().includes(search.toLowerCase())), [transactions, search]);
  
  const gross = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price || 0)), 0);
  const total = Math.max(0, gross + Number(tx.service_charge || 0) - Number(tx.discount || 0));

  function addItem() {
    setItems([...items, { service_name:"", description:"", quantity:1, price:"" }]);
  }

  function updateItem(index, field, value) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function removeItem(index) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Logo file size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setSettings(prev => ({ ...prev, logo_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  async function saveTransaction(e) {
    e.preventDefault(); setNotice("");
    try {
      const payload = {
        ...tx,
        service_charge: Number(tx.service_charge || 0),
        discount: Number(tx.discount || 0),
        items: items.map(it => ({
          service_name: it.service_name,
          description: it.description,
          quantity: Number(it.quantity || 1),
          price: Number(it.price || 0)
        }))
      };
      const { data } = await api.post("/transactions", payload);
      setInvoice(data);
      setReceiptFormat(settings.default_format || "thermal");
      setPage("Transactions");
      setTx({ customer_name:"", customer_phone:"", service_charge:0, discount:0, payment_method:"Cash", payment_status:"Paid" });
      setItems([{ service_name:"", description:"", quantity:1, price:"" }]);
      setNotice("Transaction saved and invoice generated.");
      await loadData();
    } catch (err) {
      setNotice(err.response?.data?.error || "Could not save transaction.");
    }
  }

  async function saveExpense(e) {
    e.preventDefault();
    try {
      await api.post("/expenses", { ...expense, amount:Number(expense.amount) });
      setExpense({ title:"", category:"Internet", amount:"", note:"", expense_date:today() });
      setNotice("Expense saved.");
      await loadData();
    } catch (err) {
      setNotice(err.response?.data?.error || "Could not save expense.");
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setNotice("");
    try {
      const { data } = await api.post("/settings", settings);
      setSettings(data);
      setNotice("Shop settings & logo saved successfully!");
    } catch (err) {
      setNotice(err.response?.data?.error || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function openInvoiceModal(row, format) {
    setInvoice(row);
    setReceiptFormat(format || settings.default_format || "thermal");
  }

  function exportCsv() {
    const rows = [
      ["Invoice","Date","Customer","Phone","Services","Items Count","Charge","Discount","Total","Payment"],
      ...visibleTransactions.map(t => {
        const rowItems = Array.isArray(t.items) && t.items.length > 0 ? t.items : [{ service_name: t.service_name, quantity: t.quantity }];
        const servicesStr = rowItems.map(i => `${i.service_name} (x${i.quantity})`).join(", ");
        return [
          t.invoice_no,
          t.transaction_date,
          t.customer_name,
          t.customer_phone,
          servicesStr,
          rowItems.length,
          t.service_charge,
          t.discount,
          t.total,
          t.payment_method
        ];
      })
    ];
    const csv = rows.map(r=>r.map(v=>`"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href=url; a.download=`digi-transactions-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!loggedIn) return <Login onLogin={()=>setLoggedIn(true)} />;

  const nav = [
    ["Dashboard","▦"],
    ["New Transaction","+ "],
    ["Transactions","↔"],
    ["Expenses","−"],
    ["Reports","▥"],
    ["Settings","⚙"]
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="logo-row">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="Shop Logo" className="sidebar-logo" />
        ) : (
          <div className="brand-mark small">D</div>
        )}
        <div>
          <b>DIGI</b>
          <span>{settings.shop_name || "Digital Service"}</span>
        </div>
      </div>
      <div className="side-label">WORKSPACE</div>
      {nav.map(([name,icon])=><button key={name} className={`nav-item ${page===name?"active":""}`} onClick={()=>{setPage(name);setNotice("");}}><span>{icon}</span>{name}</button>)}
      <div className="sidebar-bottom"><div className="status-dot"/> Personal workspace <button className="logout" onClick={()=>{localStorage.removeItem("digi_token");setLoggedIn(false);}}>Log out</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">DIGI / WORKSPACE</p><h1>{page}</h1></div><div className="top-right"><span className="date-pill">{new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</span><div className="avatar">B</div></div></header>
      {notice && <div className="notice"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
      {loading && <p className="muted">Refreshing records…</p>}

      {page==="Dashboard" && <section>
        <div className="welcome"><div><p className="eyebrow light">YOUR BUSINESS AT A GLANCE</p><h2>Good work starts with clear numbers.</h2><p>Track transactions, expenses and invoices from one place.</p></div><button className="white-btn" onClick={()=>setPage("New Transaction")}>＋ New transaction</button></div>
        <div className="stats-grid">
          <Stat title="Today's sales" value={money(summary.total_sales)} icon="↗" tone="blue"/>
          <Stat title="Today's expenses" value={money(summary.total_expenses)} icon="↘" tone="orange"/>
          <Stat title="Net after expenses" value={money(summary.net_after_expenses)} icon="◈" tone="green"/>
          <Stat title="Transactions today" value={summary.transaction_count || 0} icon="▤" tone="purple"/>
        </div>
        <div className="panel"><div className="panel-head"><div><h3>Recent transactions</h3><p className="muted">Latest recorded customer work</p></div><button className="text-btn" onClick={()=>setPage("Transactions")}>View all →</button></div><TransactionTable rows={transactions.slice(0,6)} onInvoice={openInvoiceModal}/></div>
      </section>}

      {page==="New Transaction" && <section className="form-layout"><form className="panel form-panel" onSubmit={saveTransaction}><div className="panel-head"><div><h3>Record a sale</h3><p className="muted">Add customer info and one or more services to generate a single bill.</p></div><span className="tag">NEW BILL</span></div>
        <div className="form-grid">
          <Field label="Customer name"><input value={tx.customer_name} onChange={e=>setTx({...tx,customer_name:e.target.value})} placeholder="Walk-in customer if blank"/></Field>
          <Field label="Phone number"><input value={tx.customer_phone} onChange={e=>setTx({...tx,customer_phone:e.target.value})} placeholder="98XXXXXXXX"/></Field>

          {/* Dynamic Services / Items Section */}
          <div className="items-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#27364b" }}>
                Services / Items ({items.length})
              </span>
              <button type="button" className="add-service-btn" onClick={addItem}>
                ＋ Add another service
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="item-card">
                <div className="item-card-header">
                  <span>Service #{idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" className="remove-btn" onClick={() => removeItem(idx)}>
                      ✕ Remove
                    </button>
                  )}
                </div>
                <div className="item-grid">
                  <Field label="Service name">
                    <input
                      value={item.service_name}
                      onChange={e => updateItem(idx, "service_name", e.target.value)}
                      placeholder="e.g. Photocopy, Online Form, Print…"
                      required
                    />
                  </Field>
                  <Field label="Description / notes">
                    <input
                      value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                      placeholder="Optional details"
                    />
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={e => updateItem(idx, "quantity", e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Price per item (Rs.)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={e => updateItem(idx, "price", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <Field label="Service charge (Rs.)"><input type="number" min="0" step="0.01" value={tx.service_charge} onChange={e=>setTx({...tx,service_charge:e.target.value})}/></Field>
          <Field label="Discount (Rs.)"><input type="number" min="0" step="0.01" value={tx.discount} onChange={e=>setTx({...tx,discount:e.target.value})}/></Field>
          <Field label="Payment method"><select value={tx.payment_method} onChange={e=>setTx({...tx,payment_method:e.target.value})}>{["Cash","eSewa","Khalti","Bank","Other"].map(x=><option key={x}>{x}</option>)}</select></Field>
          <Field label="Payment status"><select value={tx.payment_status} onChange={e=>setTx({...tx,payment_status:e.target.value})}><option>Paid</option><option>Pending</option></select></Field>
        </div>
        <div className="total-strip"><span>Invoice total</span><strong>{money(total)}</strong></div><button className="primary" type="submit">Save transaction & generate invoice →</button>
      </form><div className="panel tips-panel"><h3>Before you save</h3><p className="muted">A unique invoice number is generated automatically after saving.</p><div className="tip-row"><span>01</span><div><b>Multiple services, one bill</b><p>Click '＋ Add another service' to add more items for the same customer.</p></div></div><div className="tip-row"><span>02</span><div><b>Automatic calculations</b><p>Subtotal is calculated across all service lines plus charges minus discount.</p></div></div><div className="tip-row"><span>03</span><div><b>Thermal Receipt Print</b><p>Prints directly in 80mm thermal receipt format with your PAN, Mobile, and Logo.</p></div></div></div></section>}

      {page==="Transactions" && <section className="panel"><div className="panel-head wrap-head"><div><h3>All transactions</h3><p className="muted">Search invoices, customers and services.</p></div><button className="secondary" onClick={exportCsv}>↓ Export CSV</button></div><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice, customer, phone or service…"/><TransactionTable rows={visibleTransactions} onInvoice={openInvoiceModal}/></section>}

      {page==="Expenses" && <section className="form-layout"><form className="panel form-panel" onSubmit={saveExpense}><div className="panel-head"><div><h3>Add an expense</h3><p className="muted">Record shop operating costs.</p></div></div><div className="form-grid"><Field label="Expense title" wide><input value={expense.title} onChange={e=>setExpense({...expense,title:e.target.value})} required placeholder="e.g. Internet bill"/></Field><Field label="Category"><select value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>{["Internet","Electricity","Rent","Stationery","Paper & ink","Maintenance","Transport","Other"].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Amount (Rs.)"><input type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})} required/></Field><Field label="Date"><input type="date" value={expense.expense_date} onChange={e=>setExpense({...expense,expense_date:e.target.value})} required/></Field><Field label="Note" wide><input value={expense.note} onChange={e=>setExpense({...expense,note:e.target.value})} placeholder="Optional note"/></Field></div><button className="primary">Save expense</button></form><div className="panel"><div className="panel-head"><div><h3>Recent expenses</h3><p className="muted">Latest operating costs</p></div></div><div className="expense-list">{expenses.slice(0,20).map(e=><div className="expense-row" key={e.id}><div className="expense-icon">−</div><div className="expense-desc"><b>{e.title}</b><span>{e.category} · {String(e.expense_date).slice(0,10)}</span></div><strong>{money(e.amount)}</strong></div>)}</div></div></section>}

      {page==="Reports" && <section><div className="stats-grid"><Stat title="All-time recorded sales" value={money(transactions.reduce((a,t)=>a+Number(t.total),0))} icon="↗" tone="blue"/><Stat title="All-time expenses" value={money(expenses.reduce((a,e)=>a+Number(e.amount),0))} icon="↘" tone="orange"/><Stat title="Net after expenses" value={money(transactions.reduce((a,t)=>a+Number(t.total),0)-expenses.reduce((a,e)=>a+Number(e.amount),0))} icon="◈" tone="green"/><Stat title="Total bills" value={transactions.length} icon="▤" tone="purple"/></div><div className="panel"><div className="panel-head"><div><h3>Report summary</h3><p className="muted">Totals based on currently loaded records (up to 500 of each type).</p></div><button className="secondary" onClick={exportCsv}>↓ Export transactions CSV</button></div><div className="report-lines"><div><span>Cash sales</span><b>{money(transactions.filter(t=>t.payment_method==="Cash").reduce((a,t)=>a+Number(t.total),0))}</b></div><div><span>Online / bank sales</span><b>{money(transactions.filter(t=>t.payment_method!=="Cash").reduce((a,t)=>a+Number(t.total),0))}</b></div><div><span>Pending payments (included in sales total)</span><b>{money(transactions.filter(t=>t.payment_status==="Pending").reduce((a,t)=>a+Number(t.total),0))}</b></div></div></div></section>}

      {page==="Settings" && <section className="form-layout">
        <form className="panel form-panel" onSubmit={handleSaveSettings}>
          <div className="panel-head">
            <div>
              <h3>Shop Profile & Bill Settings</h3>
              <p className="muted">Upload your logo, configure PAN, mobile number, and receipt information.</p>
            </div>
            <span className="tag">PROFILE</span>
          </div>

          <div className="form-grid">
            {/* Logo Uploader Field */}
            <Field label="Shop Logo (Receipts, Invoices & Sidebar)" wide>
              <div className="logo-uploader">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Shop Logo" className="logo-thumb-preview" />
                ) : (
                  <div className="brand-mark small" style={{ fontSize: "12px", width: "48px", height: "48px" }}>LOGO</div>
                )}
                <div>
                  <label className="logo-upload-btn">
                    📁 {settings.logo_url ? "Change Logo" : "Upload Logo Image"}
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      style={{ display: "none" }}
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {settings.logo_url && (
                    <button
                      type="button"
                      className="logo-remove-btn"
                      onClick={() => setSettings({ ...settings, logo_url: "" })}
                    >
                      Remove Logo
                    </button>
                  )}
                  <p className="muted" style={{ fontSize: "11px", marginTop: "5px" }}>
                    Supports PNG, JPG, or SVG (&lt;2MB). Formats automatically for thermal rolls & invoices.
                  </p>
                </div>
              </div>
            </Field>

            <Field label="Business / Shop Name" wide>
              <input
                value={settings.shop_name}
                onChange={e=>setSettings({...settings, shop_name: e.target.value})}
                placeholder="e.g. DIGI DIGITAL SERVICE"
                required
              />
            </Field>
            <Field label="PAN / VAT Number">
              <input
                value={settings.pan_number}
                onChange={e=>setSettings({...settings, pan_number: e.target.value})}
                placeholder="e.g. 601234567"
              />
            </Field>
            <Field label="Shop Mobile / Phone Number">
              <input
                value={settings.mobile_number}
                onChange={e=>setSettings({...settings, mobile_number: e.target.value})}
                placeholder="e.g. 98XXXXXXXX, 97XXXXXXXX"
              />
            </Field>
            <Field label="Shop Address / Location" wide>
              <input
                value={settings.address}
                onChange={e=>setSettings({...settings, address: e.target.value})}
                placeholder="e.g. Ward-4, Main Road, Kathmandu"
              />
            </Field>
            <Field label="Business Tagline / Subtitle" wide>
              <input
                value={settings.tagline}
                onChange={e=>setSettings({...settings, tagline: e.target.value})}
                placeholder="e.g. Digital & Online Service Center"
              />
            </Field>
            <Field label="Receipt Footer Note" wide>
              <input
                value={settings.footer_note}
                onChange={e=>setSettings({...settings, footer_note: e.target.value})}
                placeholder="e.g. Thank you for your visit!"
              />
            </Field>
            <Field label="Default Bill Format">
              <select
                value={settings.default_format}
                onChange={e=>setSettings({...settings, default_format: e.target.value})}
              >
                <option value="thermal">Thermal POS Receipt (80mm)</option>
                <option value="a4">Standard A4 Invoice</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop: "22px" }}>
            <button className="primary" type="submit" disabled={savingSettings}>
              {savingSettings ? "Saving Settings…" : "Save Shop Settings"}
            </button>
          </div>
        </form>

        <div className="panel tips-panel">
          <h3>Receipt Live Preview</h3>
          <p className="muted">Live preview with your logo, PAN, Mobile, and Shop info.</p>
          <div style={{ transform: "scale(0.92)", transformOrigin: "top left", width: "108%" }}>
            <ThermalReceipt
              row={{
                invoice_no: "DIGI-2026-SAMPLE",
                transaction_date: new Date().toISOString(),
                customer_name: "Sample Customer",
                customer_phone: "9812345678",
                payment_status: "Paid",
                payment_method: "Cash",
                service_charge: 0,
                discount: 0,
                total: 200,
                items: [
                  { service_name: "Passport Online Form", quantity: 1, price: 150 },
                  { service_name: "Photocopy B/W", quantity: 10, price: 5 }
                ]
              }}
              settings={settings}
            />
          </div>
        </div>
      </section>}

      <footer className="footer">DIGI Digital Service <span>•</span> Personal business workspace</footer>
    </main>

    {/* Invoice & Thermal Receipt Modal */}
    {invoice && (
      <div className="modal-backdrop" onClick={()=>setInvoice(null)}>
        <div className={`invoice-modal ${receiptFormat === "thermal" ? "is-thermal" : ""}`} onClick={e=>e.stopPropagation()}>
          <div className="invoice-actions no-print">
            <div className="format-toggle-bar">
              <button
                className={`format-toggle-btn ${receiptFormat === "thermal" ? "active" : ""}`}
                onClick={()=>setReceiptFormat("thermal")}
              >
                🧾 Thermal Receipt (80mm)
              </button>
              <button
                className={`format-toggle-btn ${receiptFormat === "a4" ? "active" : ""}`}
                onClick={()=>setReceiptFormat("a4")}
              >
                📄 Standard A4
              </button>
            </div>
            <button className="secondary" onClick={()=>window.print()}>
              🖨️ Print {receiptFormat === "thermal" ? "Thermal Receipt" : "A4 Invoice"}
            </button>
            <button className="icon-btn" onClick={()=>setInvoice(null)}>×</button>
          </div>

          {receiptFormat === "thermal" ? (
            <div className="thermal-preview-wrap">
              <ThermalReceipt row={invoice} settings={settings} />
            </div>
          ) : (
            <Invoice row={invoice} settings={settings} />
          )}
        </div>
      </div>
    )}
  </div>;
}

function Stat({title,value,icon,tone}) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><p>{title}</p><strong>{value}</strong><span className="stat-foot">DIGI workspace</span></div>; }
function Field({label,children,wide}) { return <label className={`field ${wide?"wide":""}`}><span>{label}</span>{children}</label>; }

function TransactionTable({rows,onInvoice}) {
  return <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Services</th><th>Date</th><th>Payment</th><th className="right">Total</th><th></th></tr></thead><tbody>{rows.length===0?<tr><td colSpan="7" className="empty">No transactions yet. Add your first transaction.</td></tr>:rows.map(t=>{
    const rowItems = Array.isArray(t.items) && t.items.length > 0 ? t.items : [{ service_name: t.service_name, quantity: t.quantity }];
    const isMulti = rowItems.length > 1;
    return (
      <tr key={t.id}>
        <td><b className="invoice-code">{t.invoice_no}</b></td>
        <td><b>{t.customer_name}</b><small>{t.customer_phone||"No phone"}</small></td>
        <td>
          <b>{rowItems[0]?.service_name || t.service_name}</b>
          {isMulti ? (
            <small style={{ color: "#287bc0", fontWeight: "700" }}>+{rowItems.length - 1} more service{rowItems.length > 2 ? "s" : ""}</small>
          ) : (
            <small>Qty {rowItems[0]?.quantity || t.quantity}</small>
          )}
        </td>
        <td>{new Date(t.transaction_date).toLocaleDateString("en-GB")}</td>
        <td><span className={`payment ${t.payment_status==="Pending"?"pending":""}`}>{t.payment_status} · {t.payment_method}</span></td>
        <td className="right amount">{money(t.total)}</td>
        <td>
          <button className="tiny-btn" onClick={()=>onInvoice(t, "thermal")}>🧾 Bill</button>
        </td>
      </tr>
    );
  })}</tbody></table></div>;
}

function ThermalReceipt({ row, settings }) {
  const rowItems = Array.isArray(row.items) && row.items.length > 0
    ? row.items
    : [{ service_name: row.service_name, description: row.description, quantity: row.quantity, price: row.price }];
  const subtotal = rowItems.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0);

  return (
    <div className="thermal-bill">
      <div className="thermal-header">
        {settings?.logo_url && (
          <img src={settings.logo_url} alt="Shop Logo" className="thermal-logo" />
        )}
        <h2 className="thermal-shop-name">{settings?.shop_name || "DIGI DIGITAL SERVICE"}</h2>
        <p className="thermal-tagline">{settings?.tagline || "Digital & Online Service Center"}</p>
        {settings?.address && <p className="thermal-tagline">{settings.address}</p>}
        {settings?.pan_number && <p className="thermal-info">PAN: {settings.pan_number}</p>}
        {settings?.mobile_number && <p className="thermal-info">TEL: {settings.mobile_number}</p>}
        <div className="thermal-divider" />
      </div>

      <div className="thermal-meta-row">
        <span>BILL NO:</span>
        <b>{row.invoice_no}</b>
      </div>
      <div className="thermal-meta-row">
        <span>DATE:</span>
        <span>{new Date(row.transaction_date).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
      <div className="thermal-meta-row">
        <span>CUSTOMER:</span>
        <b>{row.customer_name}</b>
      </div>
      {row.customer_phone && (
        <div className="thermal-meta-row">
          <span>PHONE:</span>
          <span>{row.customer_phone}</span>
        </div>
      )}

      <div className="thermal-divider" />

      <table className="thermal-table">
        <thead>
          <tr>
            <th align="left">ITEM</th>
            <th align="center">QTY</th>
            <th align="right">RATE</th>
            <th align="right">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rowItems.map((item, idx) => (
            <tr key={idx}>
              <td>
                <b>{item.service_name}</b>
                {item.description && <small>{item.description}</small>}
              </td>
              <td align="center">{item.quantity}</td>
              <td align="right">{Number(item.price).toFixed(2)}</td>
              <td align="right">{Number(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="thermal-divider" />

      <div className="thermal-totals-section">
        <div className="thermal-meta-row">
          <span>Subtotal:</span>
          <span>{money(subtotal)}</span>
        </div>
        {Number(row.service_charge) > 0 && (
          <div className="thermal-meta-row">
            <span>Service Charge:</span>
            <span>{money(row.service_charge)}</span>
          </div>
        )}
        {Number(row.discount) > 0 && (
          <div className="thermal-meta-row">
            <span>Discount:</span>
            <span>− {money(row.discount)}</span>
          </div>
        )}
        <div className="thermal-double-divider" />
        <div className="thermal-grand-row">
          <span>GRAND TOTAL:</span>
          <strong>{money(row.total)}</strong>
        </div>
        <div className="thermal-double-divider" />
        <div className="thermal-meta-row">
          <span>PAYMENT:</span>
          <span className={`thermal-paid-badge ${row.payment_status === "Pending" ? "pending" : "paid"}`}>
            {row.payment_status.toUpperCase()} ({row.payment_method})
          </span>
        </div>
      </div>

      <div className="thermal-divider" />
      <div className="thermal-footer">
        <p>*** {settings?.footer_note || "Thank you for your visit!"} ***</p>
        <p>Computerized Tax Invoice / Receipt</p>
      </div>
    </div>
  );
}

function Invoice({ row, settings }) {
  const rowItems = Array.isArray(row.items) && row.items.length > 0
    ? row.items
    : [{ service_name: row.service_name, description: row.description, quantity: row.quantity, price: row.price }];
  const subtotal = rowItems.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0);

  return <div className="invoice-paper">
    <div className="invoice-brand">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt="Shop Logo" className="invoice-custom-logo" />
      ) : (
        <div className="brand-mark">D</div>
      )}
      <div>
        <h2>{settings?.shop_name || "DIGI DIGITAL SERVICE"}</h2>
        <p>{settings?.tagline || "Digital & Online Service Center"}</p>
        {(settings?.pan_number || settings?.mobile_number) && (
          <p style={{ fontSize: "11px", fontWeight: "700", color: "#1e3a5f", marginTop: "3px" }}>
            {settings?.pan_number ? `PAN: ${settings.pan_number}` : ""} {settings?.mobile_number ? ` · Mobile: ${settings.mobile_number}` : ""}
          </p>
        )}
      </div>
      <span className="invoice-label">INVOICE</span>
    </div>
    <div className="invoice-meta">
      <div><span>Invoice number</span><b>{row.invoice_no}</b></div>
      <div><span>Date issued</span><b>{new Date(row.transaction_date).toLocaleString("en-GB")}</b></div>
      <div><span>Payment status</span><b>{row.payment_status} · {row.payment_method}</b></div>
    </div>
    <div className="bill-to">
      <span>BILLED TO</span>
      <b>{row.customer_name}</b>
      <p>{row.customer_phone || "—"}</p>
    </div>
    <table className="invoice-table">
      <thead>
        <tr><th>Description</th><th>Qty</th><th>Unit price</th><th className="right">Amount</th></tr>
      </thead>
      <tbody>
        {rowItems.map((item, idx) => (
          <tr key={idx}>
            <td>
              <b>{item.service_name}</b>
              {item.description && <small>{item.description}</small>}
            </td>
            <td>{item.quantity}</td>
            <td>{money(item.price)}</td>
            <td className="right">{money(Number(item.quantity) * Number(item.price))}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="invoice-totals">
      <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
      <div><span>Service charge</span><b>{money(row.service_charge)}</b></div>
      <div><span>Discount</span><b>− {money(row.discount)}</b></div>
      <div className="grand"><span>Grand total</span><strong>{money(row.total)}</strong></div>
    </div>
    <div className="invoice-thanks">
      <b>{settings?.footer_note || "Thank you for your business!"}</b>
      <p>Please keep this invoice for your records.</p>
    </div>
    <div className="invoice-foot">{settings?.shop_name || "DIGI DIGITAL SERVICE"} · Computerized invoice</div>
  </div>;
}

export default App;
