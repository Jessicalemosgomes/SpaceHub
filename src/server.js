require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const authRoutes = require("./routes/auth");
const spaceRoutes = require("./routes/spaces");
const bookingRoutes = require("./routes/bookings");
const calendarRoutes = require("./routes/calendar");

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error("Configure DATABASE_URL e JWT_SECRET no arquivo .env.");
}
const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/calendar", calendarRoutes);
app.use(express.static(path.join(__dirname, "../public")));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "SpaceHub API" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ZodError") return res.status(400).json({ error: "Dados inválidos.", details: err.errors });
  if (err.code === "P2002") return res.status(409).json({ error: "Registro já existe." });
  if (err.code === "P2034") return res.status(409).json({ error: "Conflito de concorrência. Tente novamente." });
  res.status(err.status || 500).json({ error: err.message || "Erro interno do servidor." });
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SpaceHub disponível em http://localhost:${port}`));
