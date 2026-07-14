require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const paymentsRouter = require("./routes/payments");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/payments", paymentsRouter);

app.get("/health", (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in .env — copy .env.example to .env and fill it in.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Vivid Nexus API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
