# Vivid Nexus — MongoDB backend

Real database layer for the payment portal. Same record shape the frontend
already produces, so wiring it up is a small swap, not a redesign.

## 1. Install & run

```bash
npm install
cp .env.example .env   # then paste your MongoDB URI
npm start               # or: npm run dev (with nodemon)
```

Local MongoDB: `mongod` running on your machine, use the local URI in `.env.example`.
No local Mongo: create a free cluster at mongodb.com/atlas and use that connection string.

## 2. Endpoints

| Method | Path                | Replaces                          |
|--------|---------------------|-------------------------------------|
| GET    | `/api/payments`     | `loadHistory()`                     |
| POST   | `/api/payments`     | `savePayment(record)`                |
| PATCH  | `/api/payments/:id` | `updatePayment()` / `refundPayment()`|
| GET    | `/health`           | connection check                    |

## 3. Point the frontend at it

In the artifact, `window.storage` calls become `fetch()` calls to this API.
Set `API_BASE` to wherever this server is deployed (e.g. `http://localhost:4000`
locally, or your Render/Railway/Fly URL in production).

```js
const API_BASE = "http://localhost:4000";

// loadHistory()
async function loadHistory() {
  setHistoryLoading(true);
  try {
    const res = await fetch(`${API_BASE}/api/payments`);
    setHistory(await res.json());
  } catch (e) {
    setHistory([]);
  }
  setHistoryLoading(false);
}

// savePayment(record)
async function savePayment(record) {
  await fetch(`${API_BASE}/api/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
}

// refundPayment(record) — inside the setTimeout, replace updatePayment(updated) with:
await fetch(`${API_BASE}/api/payments/${record.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "refunded", refundedAt: Date.now() }),
});
```

Everything else in the portal — plan selection, GST math, Razorpay Test Mode
simulation, UI — stays exactly as is. Only the persistence layer changes.

## 4. Why this couldn't live in the artifact itself

Claude.ai artifacts run as sandboxed frontend code in your browser. There's no
Node runtime, no outbound TCP to arbitrary hosts, and nowhere safe to hold a
database credential — so a live `mongodb://` connection has to run in a real
backend like this one, not in the artifact.
