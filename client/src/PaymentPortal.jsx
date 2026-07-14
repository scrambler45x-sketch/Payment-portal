import { useState, useEffect, useRef } from "react";
import { Share2, ChevronRight, Check, Clock, Copy, ShieldCheck, ArrowLeft, X, Lock } from "lucide-react";

const PLANS = [
  { id: "pulse", name: "Pulse", tagline: "Start the signal", amount: 99900, features: ["1 workspace", "Email support", "Core analytics"] },
  { id: "core", name: "Core", tagline: "Most connected", amount: 249900, features: ["5 workspaces", "Priority support", "Advanced analytics", "Team seats"], featured: true },
  { id: "apex", name: "Apex", tagline: "Full bandwidth", amount: 499900, features: ["Unlimited workspaces", "Dedicated manager", "Custom reporting", "SLA guarantee"] },
];

const rupees = (paise) => (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// Point this at your Express server (see vivid-nexus-backend). Use an env
// var in a real Vite/CRA app instead of hardcoding, e.g. import.meta.env.VITE_API_BASE
const API_BASE = "http://localhost:4000";

function genId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36).slice(-4)}`;
}

export default function PaymentPortal() {
  const [view, setView] = useState("checkout");
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState("form"); // form | processing | success | failed
  const [method, setMethod] = useState("card"); // card | upi | netbanking
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [upiId, setUpiId] = useState("varad@oksbi");
  const [bank, setBank] = useState("HDFC Bank");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const receiptRef = useRef(null);

  const GST_RATE = 0.18;
  const subtotal = useCustom ? Math.round(parseFloat(customAmount || "0") * 100) : selectedPlan.amount;
  const tax = Math.round(subtotal * GST_RATE);
  const amount = subtotal + tax;

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const records = await res.json();
      setHistory(records);
    } catch (e) {
      console.error("Failed to load payment history", e);
      setHistory([]);
    }
    setHistoryLoading(false);
  }

  async function savePayment(record) {
    try {
      const res = await fetch(`${API_BASE}/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
    } catch (e) {
      console.error("Failed to save payment", e);
    }
  }

  async function updatePayment(record) {
    try {
      const res = await fetch(`${API_BASE}/api/payments/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: record.status, refundedAt: record.refundedAt }),
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
    } catch (e) {
      console.error("Failed to update payment", e);
    }
  }

  async function refundPayment(record) {
    setHistory((h) => h.map((r) => (r.id === record.id ? { ...r, status: "refunding" } : r)));
    setTimeout(async () => {
      const updated = { ...record, status: "refunded", refundedAt: Date.now() };
      await updatePayment(updated);
      setHistory((h) => h.map((r) => (r.id === record.id ? updated : r)));
    }, 1100);
  }

  function openCheckout() {
    if (!name.trim() || !email.trim()) return;
    if (amount <= 0) return;
    setCheckoutStage("form");
    setCheckoutOpen(true);
  }

  function runPayment() {
    setCheckoutStage("processing");
    setTimeout(async () => {
      let willSucceed = true;
      let methodDetail = {};
      if (method === "card") {
        willSucceed = !cardNumber.replace(/\s/g, "").endsWith("0002"); // Razorpay's own test decline pattern
        methodDetail = { last4: cardNumber.replace(/\s/g, "").slice(-4) };
      } else if (method === "upi") {
        willSucceed = !upiId.toLowerCase().includes("fail");
        methodDetail = { upiId };
      } else if (method === "netbanking") {
        willSucceed = bank !== "Fail Bank Ltd (test decline)";
        methodDetail = { bank };
      }
      const record = {
        id: genId("pay"),
        orderId: genId("order"),
        amount,
        subtotal,
        tax,
        currency: "INR",
        plan: useCustom ? "Custom" : selectedPlan.name,
        customer: name,
        email,
        status: willSucceed ? "captured" : "failed",
        method,
        ...methodDetail,
        timestamp: Date.now(),
        mode: "test",
      };
      await savePayment(record);
      setHistory((h) => [record, ...h]);
      setLastReceipt(record);
      setCheckoutStage(willSucceed ? "success" : "failed");
    }, 1400);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    if (checkoutStage === "success") {
      setName("");
      setEmail("");
    }
  }

  function copyId(id) {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function downloadReceipt(r) {
    const lines = [
      "VIVID NEXUS — PAYMENT RECEIPT (TEST MODE)",
      "----------------------------------------",
      `Payment ID   : ${r.id}`,
      `Order ID     : ${r.orderId}`,
      `Date         : ${new Date(r.timestamp).toLocaleString("en-IN")}`,
      `Customer     : ${r.customer} <${r.email}>`,
      `Plan         : ${r.plan}`,
      `Method       : ${r.method}${r.last4 ? " •••• " + r.last4 : ""}${r.upiId ? " " + r.upiId : ""}${r.bank ? " " + r.bank : ""}`,
      "",
      `Subtotal     : ${rupees(r.subtotal ?? r.amount)}`,
      `GST (18%)    : ${rupees(r.tax ?? 0)}`,
      `Total charged: ${rupees(r.amount)}`,
      "",
      `Status       : ${r.status}`,
      "This is a simulated Razorpay Test Mode receipt. No real money moved.",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.id}-receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", fontFamily: "'Avenir Next','Century Gothic','Trebuchet MS',sans-serif", color: "#F1F3FF", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", top: -140, left: -120, width: 420, height: 420, borderRadius: "50%", background: "#7C5CFF", filter: "blur(140px)", opacity: 0.18, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -160, right: -140, width: 460, height: 460, borderRadius: "50%", background: "#38E1C6", filter: "blur(150px)", opacity: 0.14, pointerEvents: "none" }} />
      <style>{`
        * { box-sizing: border-box; }
        .sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; }
        .mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; }
        .fade-in { animation: fadeIn 0.4s ease both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes stamp { 0% { opacity: 0; transform: scale(2.2) rotate(-14deg); } 60% { opacity: 1; } 100% { opacity: 1; transform: scale(1) rotate(-8deg); } }
        .stamp-in { animation: stamp 0.55s cubic-bezier(.2,.9,.3,1.2) both; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 #38E1C655; } 70% { box-shadow: 0 0 0 18px #38E1C600; } 100% { box-shadow: 0 0 0 0 #38E1C600; } }
        .pulse-ring { animation: pulseRing 1.3s ease-out 0.35s 2; }
        @keyframes shake { 10%,90% { transform: translateX(-1px); } 20%,80% { transform: translateX(2px); } 30%,50%,70% { transform: translateX(-4px); } 40%,60% { transform: translateX(4px); } }
        .shake-in { animation: shake 0.5s ease 0.4s; }
        input:focus, button:focus-visible { outline: 2px solid #7C5CFF; outline-offset: 2px; }
        ::selection { background: #7C5CFF33; }
      `}</style>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #262F4A", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7C5CFF,#38E1C6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Share2 size={14} color="#0B0F1A" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 19, letterSpacing: "0.01em", fontWeight: 600 }}>Vivid Nexus</span>
          <span className="sans mono" style={{ fontSize: 10, color: "#8891B0", border: "1px solid #2E375A", borderRadius: 999, padding: "2px 8px", marginLeft: 6 }}>TEST MODE</span>
        </div>
        <div className="sans" style={{ display: "flex", gap: 4, background: "#131828", padding: 4, borderRadius: 10, border: "1px solid #262F4A" }}>
          <TabButton active={view === "checkout"} onClick={() => setView("checkout")}>New payment</TabButton>
          <TabButton active={view === "history"} onClick={() => setView("history")}>History</TabButton>
        </div>
      </div>

      {view === "checkout" ? (
        <Checkout
          selectedPlan={selectedPlan}
          setSelectedPlan={(p) => { setSelectedPlan(p); setUseCustom(false); }}
          useCustom={useCustom}
          setUseCustom={setUseCustom}
          customAmount={customAmount}
          setCustomAmount={setCustomAmount}
          name={name} setName={setName}
          email={email} setEmail={setEmail}
          subtotal={subtotal}
          tax={tax}
          amount={amount}
          onPay={openCheckout}
        />
      ) : (
        <History history={history} loading={historyLoading} copiedId={copiedId} copyId={copyId} onNew={() => setView("checkout")} onRefund={refundPayment} />
      )}

      {checkoutOpen && (
        <CheckoutModal
          stage={checkoutStage}
          amount={amount}
          subtotal={subtotal}
          tax={tax}
          plan={useCustom ? "Custom amount" : selectedPlan.name}
          method={method}
          setMethod={setMethod}
          cardNumber={cardNumber}
          setCardNumber={setCardNumber}
          upiId={upiId}
          setUpiId={setUpiId}
          bank={bank}
          setBank={setBank}
          onPay={runPayment}
          onClose={closeCheckout}
          receipt={lastReceipt}
          onRetry={() => setCheckoutStage("form")}
          onDownload={downloadReceipt}
        />
      )}
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 7,
        border: "none",
        fontSize: 13,
        cursor: "pointer",
        background: active ? "#7C5CFF" : "transparent",
        color: active ? "#0B0F1A" : "#8891B0",
        fontWeight: active ? 600 : 500,
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function Checkout({ selectedPlan, setSelectedPlan, useCustom, setUseCustom, customAmount, setCustomAmount, name, setName, email, setEmail, subtotal, tax, amount, onPay }) {
  return (
    <div className="fade-in" style={{ maxWidth: 980, margin: "0 auto", padding: "56px 28px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <div className="sans mono" style={{ fontSize: 11, letterSpacing: "0.14em", marginBottom: 10, backgroundImage: "linear-gradient(90deg,#7C5CFF,#38E1C6)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", display: "inline-block" }}>SELECT A PLAN</div>
        <h1 style={{ fontSize: 34, margin: 0, fontWeight: 600 }}>Choose how you'd like to connect</h1>
        <p className="sans" style={{ color: "#8891B0", fontSize: 14, marginTop: 10 }}>All transactions route through Razorpay Test Mode — no real money moves.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 20 }}>
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPlan(p)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 14,
              padding: 22,
              background: p.featured ? "linear-gradient(160deg,#1A2040,#131828)" : "#121729",
              border: !useCustom && selectedPlan.id === p.id ? "1px solid #7C5CFF" : "1px solid #262F4A",
              boxShadow: !useCustom && selectedPlan.id === p.id ? "0 0 0 3px #7C5CFF22" : "none",
              transition: "all 0.15s ease",
              position: "relative",
            }}
          >
            {p.featured && (
              <div className="sans" style={{ position: "absolute", top: -10, right: 18, background: "#7C5CFF", color: "#0B0F1A", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 999 }}>
                MOST CHOSEN
              </div>
            )}
            <div className="sans" style={{ fontSize: 12, color: "#8891B0", marginBottom: 4 }}>{p.tagline}</div>
            <div style={{ fontSize: 21, marginBottom: 2 }}>{p.name}</div>
            <div className="mono" style={{ fontSize: 26, color: "#F1F3FF", marginTop: 8, marginBottom: 14 }}>{rupees(p.amount)}<span className="sans" style={{ fontSize: 12, color: "#8891B0" }}> /mo</span></div>
            <div className="sans" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {p.features.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#B7BEC9" }}>
                  <Check size={13} color="#7C5CFF" /> {f}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setUseCustom(!useCustom)}
        className="sans"
        style={{ background: "none", border: "none", color: "#7C5CFF", fontSize: 12.5, cursor: "pointer", padding: "4px 0", marginBottom: 28 }}
      >
        {useCustom ? "← Use a plan instead" : "Or enter a custom amount →"}
      </button>

      {useCustom && (
        <div className="fade-in sans" style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 12, color: "#8891B0", display: "block", marginBottom: 6 }}>Amount (INR)</label>
          <input
            type="number"
            min="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="1500"
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ background: "#121729", border: "1px solid #262F4A", borderRadius: 14, padding: 28 }}>
        <div className="sans" style={{ fontSize: 12, color: "#8891B0", marginBottom: 18, letterSpacing: "0.05em" }}>BILLING DETAILS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
          <div className="sans">
            <label style={labelStyle}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Varad Deshmukh" style={inputStyle} />
          </div>
          <div className="sans">
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="varad@example.com" style={inputStyle} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid #262F4A", paddingTop: 20 }}>
          <div className="sans" style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#8891B0", marginBottom: 6 }}>
            <span>Subtotal</span><span className="mono">{subtotal > 0 ? rupees(subtotal) : "—"}</span>
          </div>
          <div className="sans" style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#8891B0", marginBottom: 14 }}>
            <span>GST (18%)</span><span className="mono">{subtotal > 0 ? rupees(tax) : "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="sans" style={{ fontSize: 12, color: "#8891B0" }}>Total due</div>
              <div className="mono" style={{ fontSize: 24 }}>{amount > 0 ? rupees(amount) : "—"}</div>
            </div>
            <button
              onClick={onPay}
              disabled={!name.trim() || !email.trim() || amount <= 0}
              className="sans"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: !name.trim() || !email.trim() || amount <= 0 ? "#2E375A" : "linear-gradient(135deg,#8B6CFF,#38E1C6)",
                color: !name.trim() || !email.trim() || amount <= 0 ? "#6B7399" : "#0B0F1A",
                border: "none", borderRadius: 9, padding: "13px 22px", fontSize: 14, fontWeight: 600,
                cursor: !name.trim() || !email.trim() || amount <= 0 ? "not-allowed" : "pointer",
              }}
            >
              <Lock size={14} /> Pay with Razorpay <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Trust badges */}
      <div className="sans" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, marginTop: 28, color: "#6B7399", fontSize: 11.5 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={14} color="#38E1C6" /> PCI-DSS compliant</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} color="#38E1C6" /> 256-bit SSL encryption</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Share2 size={14} color="#38E1C6" /> Powered by Razorpay</span>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 56 }}>
        <div className="sans mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "#7C5CFF", marginBottom: 16, textAlign: "center" }}>PAYMENT FAQ</div>
        <Faq />
      </div>
    </div>
  );
}

function Faq() {
  const items = [
    { q: "Is this a real charge?", a: "No. This portal runs entirely on Razorpay Test Mode — no real money moves and no real card is charged." },
    { q: "Which payment methods are supported?", a: "Card, UPI, and Netbanking are all available in the checkout, each simulating Razorpay's Test Mode responses." },
    { q: "How do I simulate a failed payment?", a: "Use a card ending in 0002, a UPI ID containing \"fail\", or select the test decline bank in Netbanking." },
    { q: "Can I get a refund?", a: "Yes — captured test payments show a \"Request refund\" option in Payment history, which simulates Razorpay's refund flow." },
    { q: "Where's my receipt?", a: "Every successful payment shows a downloadable receipt with the subtotal, GST, and total charged." },
  ];
  const [open, setOpen] = useState(0);
  return (
    <div className="sans" style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={it.q} style={{ background: "#121729", border: "1px solid #262F4A", borderRadius: 10, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#F1F3FF", padding: "14px 16px", fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            {it.q}
            <ChevronRight size={14} color="#6B7399" style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
          </button>
          {open === i && (
            <div className="fade-in" style={{ padding: "0 16px 16px", fontSize: 12.5, color: "#8891B0", lineHeight: 1.6 }}>{it.a}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const labelStyle = { fontSize: 11.5, color: "#8891B0", display: "block", marginBottom: 6 };
const inputStyle = {
  width: "100%", background: "#0B0F1A", border: "1px solid #2E375A", borderRadius: 8,
  padding: "11px 13px", color: "#F1F3FF", fontSize: 14, fontFamily: "inherit",
};

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Fail Bank Ltd (test decline)"];

function CheckoutModal({ stage, amount, subtotal, tax, plan, method, setMethod, cardNumber, setCardNumber, upiId, setUpiId, bank, setBank, onPay, onClose, receipt, onRetry, onDownload }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#05070ADD", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div className="fade-in" style={{ width: 400, maxWidth: "100%", background: "#111528", border: "1px solid #262F4A", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #262F4A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="sans" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8891B0" }}>
            {stage === "form" && <ArrowLeft size={14} style={{ cursor: "pointer" }} onClick={onClose} />}
            <span>{plan} · <span className="mono">{rupees(amount)}</span></span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8891B0" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {stage === "form" && (
            <div className="sans fade-in">
              <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7399", marginBottom: 16, background: "#0B0F1A", border: "1px solid #262F4A", borderRadius: 8, padding: "8px 10px" }}>
                <span>Subtotal {rupees(subtotal)}</span><span>+ GST {rupees(tax)}</span>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 18, background: "#0B0F1A", border: "1px solid #262F4A", borderRadius: 9, padding: 4 }}>
                {[["card", "Card"], ["upi", "UPI"], ["netbanking", "Netbanking"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setMethod(id)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 6, border: "none", fontSize: 12.5, cursor: "pointer",
                      background: method === id ? "#7C5CFF" : "transparent",
                      color: method === id ? "#0B0F1A" : "#8891B0",
                      fontWeight: method === id ? 600 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === "card" && (
                <>
                  <div style={{ fontSize: 12.5, color: "#8891B0", marginBottom: 14 }}>Razorpay · Test Mode card</div>
                  <label style={labelStyle}>Card number</label>
                  <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} className="mono" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={labelStyle}>Expiry</label>
                      <input defaultValue="12/29" style={inputStyle} className="mono" />
                    </div>
                    <div>
                      <label style={labelStyle}>CVV</label>
                      <input defaultValue="123" style={inputStyle} className="mono" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7399", marginBottom: 16, lineHeight: 1.5 }}>
                    Any test card works. End the number in <span className="mono">0002</span> to simulate a decline.
                  </div>
                </>
              )}

              {method === "upi" && (
                <>
                  <div style={{ fontSize: 12.5, color: "#8891B0", marginBottom: 14 }}>Razorpay · Test Mode UPI</div>
                  <label style={labelStyle}>UPI ID</label>
                  <input value={upiId} onChange={(e) => setUpiId(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} className="mono" placeholder="yourname@bank" />
                  <div style={{ fontSize: 11, color: "#6B7399", marginBottom: 16, lineHeight: 1.5 }}>
                    Any UPI ID works. Include <span className="mono">fail</span> in it to simulate a decline.
                  </div>
                </>
              )}

              {method === "netbanking" && (
                <>
                  <div style={{ fontSize: 12.5, color: "#8891B0", marginBottom: 14 }}>Razorpay · Test Mode Netbanking</div>
                  <label style={labelStyle}>Select bank</label>
                  <select value={bank} onChange={(e) => setBank(e.target.value)} style={{ ...inputStyle, marginBottom: 16, appearance: "auto" }}>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: "#6B7399", marginBottom: 16, lineHeight: 1.5 }}>
                    Pick the decline option to simulate a failed bank redirect.
                  </div>
                </>
              )}

              <button onClick={onPay} style={{ width: "100%", background: "linear-gradient(135deg,#8B6CFF,#38E1C6)", color: "#0B0F1A", border: "none", borderRadius: 9, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Pay {rupees(amount)}
              </button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, fontSize: 11, color: "#6B7399" }}>
                <ShieldCheck size={13} /> Secured, simulated Test Mode transaction
              </div>
            </div>
          )}

          {stage === "processing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0" }}>
              <div className="spin" style={{ width: 30, height: 30, border: "2.5px solid #2E375A", borderTopColor: "#7C5CFF", borderRadius: "50%" }} />
              <div className="sans" style={{ marginTop: 16, fontSize: 13, color: "#8891B0" }}>Routing through Razorpay Test Mode…</div>
            </div>
          )}

          {stage === "success" && receipt && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div className="stamp-in pulse-ring" style={{ display: "inline-flex", width: 62, height: 62, borderRadius: "50%", border: "3px solid #38E1C6", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Check size={28} color="#38E1C6" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 19, marginBottom: 4 }}>Payment captured</div>
              <div className="mono" style={{ fontSize: 22, marginBottom: 18 }}>{rupees(receipt.amount)}</div>
              <div className="sans mono" style={{ background: "#0B0F1A", border: "1px solid #262F4A", borderRadius: 9, padding: 14, fontSize: 11.5, color: "#8891B0", textAlign: "left" }}>
                <Row k="Payment ID" v={receipt.id} />
                <Row k="Order ID" v={receipt.orderId} />
                <Row k="Method" v={receipt.method === "card" ? `•••• ${receipt.last4}` : receipt.method === "upi" ? receipt.upiId : receipt.bank} />
                <Row k="Subtotal" v={rupees(receipt.subtotal)} />
                <Row k="GST (18%)" v={rupees(receipt.tax)} />
                <Row k="Status" v="captured" last />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={() => onDownload(receipt)} className="sans" style={{ flex: 1, background: "#1A2040", color: "#F1F3FF", border: "1px solid #2E375A", borderRadius: 9, padding: "11px", fontSize: 13.5, cursor: "pointer" }}>
                  Download receipt
                </button>
                <button onClick={onClose} className="sans" style={{ flex: 1, background: "linear-gradient(135deg,#8B6CFF,#38E1C6)", color: "#0B0F1A", border: "none", borderRadius: 9, padding: "11px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  Done
                </button>
              </div>
            </div>
          )}

          {stage === "failed" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div className="stamp-in shake-in" style={{ display: "inline-flex", width: 62, height: 62, borderRadius: "50%", border: "3px solid #FF5C7A", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <X size={28} color="#FF5C7A" strokeWidth={3} />
              </div>
              <div style={{ fontSize: 19, marginBottom: 6 }}>Payment declined</div>
              <div className="sans" style={{ fontSize: 12.5, color: "#8891B0", marginBottom: 18 }}>The test details you entered simulate a decline for this method.</div>
              <button onClick={onRetry} className="sans" style={{ width: "100%", background: "linear-gradient(135deg,#8B6CFF,#38E1C6)", color: "#0B0F1A", border: "none", borderRadius: 9, padding: "11px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: last ? "none" : "1px solid #1A2040" }}>
      <span style={{ color: "#6B7399" }}>{k}</span>
      <span style={{ color: "#F1F3FF" }}>{v}</span>
    </div>
  );
}

function History({ history, loading, copiedId, copyId, onNew, onRefund }) {
  const statusStyle = {
    captured: { bg: "#38E1C622", color: "#38E1C6", icon: Check, label: "captured" },
    failed: { bg: "#FF5C7A22", color: "#FF5C7A", icon: X, label: "failed" },
    refunding: { bg: "#7C5CFF22", color: "#7C5CFF", icon: Clock, label: "refunding…" },
    refunded: { bg: "#8891B022", color: "#8891B0", icon: Check, label: "refunded" },
  };
  return (
    <div className="fade-in" style={{ maxWidth: 820, margin: "0 auto", padding: "56px 28px 80px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 30 }}>
        <div>
          <div className="sans mono" style={{ fontSize: 11, letterSpacing: "0.14em", marginBottom: 8, backgroundImage: "linear-gradient(90deg,#7C5CFF,#38E1C6)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", display: "inline-block" }}>THE FEED</div>
          <h1 style={{ fontSize: 30, margin: 0, fontWeight: 600 }}>Payment history</h1>
        </div>
        <button onClick={onNew} className="sans" style={{ background: "#131828", border: "1px solid #262F4A", color: "#F1F3FF", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
          New payment
        </button>
      </div>

      {loading ? (
        <div className="sans" style={{ color: "#6B7399", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Loading feed…</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0", border: "1px dashed #262F4A", borderRadius: 14 }}>
          <Clock size={22} color="#3A4150" style={{ marginBottom: 10 }} />
          <div className="sans" style={{ color: "#8891B0", fontSize: 13.5 }}>No entries yet. Every payment you make will be recorded here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((h) => {
            const s = statusStyle[h.status] || statusStyle.captured;
            const Icon = s.icon;
            const methodLabel = h.method === "card" ? `•••• ${h.last4}` : h.method === "upi" ? h.upiId : h.method === "netbanking" ? h.bank : "";
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#121729", border: "1px solid #262F4A", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: s.bg }}>
                    <Icon size={15} color={s.color} className={h.status === "refunding" ? "spin" : ""} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15 }}>{h.plan} <span className="sans" style={{ color: "#6B7399", fontSize: 12 }}>· {h.customer}</span></div>
                    <div className="sans" style={{ fontSize: 11.5, color: "#6B7399", marginTop: 2 }}>
                      {new Date(h.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{methodLabel ? ` · ${methodLabel}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <div className="mono" style={{ fontSize: 15 }}>{rupees(h.amount)}</div>
                    <button onClick={() => copyId(h.id)} className="sans mono" style={{ background: "none", border: "none", color: "#6B7399", fontSize: 10.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      {copiedId === h.id ? "copied" : h.id} <Copy size={10} />
                    </button>
                  </div>
                  {h.status === "captured" && (
                    <button onClick={() => onRefund(h)} className="sans" style={{ background: "none", border: "1px solid #2E375A", color: "#8891B0", borderRadius: 7, padding: "6px 10px", fontSize: 11.5, cursor: "pointer" }}>
                      Request refund
                    </button>
                  )}
                  {h.status !== "captured" && (
                    <span className="sans" style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
