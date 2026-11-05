"use strict";
// Aplicación Express mínima: login + dashboard con SQLite, lista para Render.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cookieSession = require("cookie-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === "production";
const SECRET_KEY = process.env.SECRET_KEY || "dev-only-change-me";
const DATABASE_PATH = process.env.DATABASE_PATH || path.join("data", "app.db");

const SAMPLE_PRODUCTS = [
  ["Teclado mecánico", "Periféricos", 89.9, 34],
  ["Ratón inalámbrico", "Periféricos", 29.5, 120],
  ["Monitor 27''", "Pantallas", 249.0, 15],
  ["Webcam HD", "Video", 59.99, 48],
  ["Auriculares USB", "Audio", 45.0, 62],
  ["Disco SSD 1TB", "Almacenamiento", 74.9, 27],
  ["Hub USB-C", "Accesorios", 35.0, 80],
  ["Micrófono condensador", "Audio", 99.0, 12],
];

/** Abre la base, crea el esquema y siembra datos (idempotente). */
function initDb() {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
  const db = new Database(DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL
    );
  `);

  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  if (!db.prepare("SELECT 1 FROM users WHERE username = ?").get(adminUser)) {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(adminUser, bcrypt.hashSync(adminPass, 10));
  }
  if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n === 0) {
    const insert = db.prepare(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)");
    db.transaction((rows) => rows.forEach((r) => insert.run(...r)))(SAMPLE_PRODUCTS);
  }
  return db;
}

const db = initDb();
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1); // Render termina TLS en su proxy
app.disable("x-powered-by");

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieSession({
  name: "sid",
  keys: [SECRET_KEY],
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  maxAge: 8 * 60 * 60 * 1000,
}));

// Token CSRF por sesión, disponible en todas las vistas.
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString("hex");
  res.locals.csrfToken = req.session.csrf;
  res.locals.username = req.session.username || null;
  next();
});

function verifyCsrf(req, res, next) {
  const sent = Buffer.from(String(req.body.csrf || ""));
  const expected = Buffer.from(req.session.csrf);
  if (sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    return res.status(400).send("Token CSRF inválido.");
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

app.get("/", (req, res) => res.redirect(req.session.userId ? "/dashboard" : "/login"));

app.get("/login", (req, res) => res.render("login", { error: null }));

app.post("/login", verifyCsrf, (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (user && bcrypt.compareSync(password, user.password_hash)) {
    req.session = { userId: user.id, username: user.username, csrf: req.session.csrf };
    return res.redirect("/dashboard");
  }
  res.status(401).render("login", { error: "Credenciales inválidas." });
});

app.post("/logout", verifyCsrf, (req, res) => {
  req.session = null;
  res.redirect("/login");
});

app.get("/dashboard", requireLogin, (req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY id").all();
  const stats = db.prepare(
    `SELECT COUNT(*) AS total, COALESCE(SUM(stock), 0) AS units,
            COALESCE(SUM(price * stock), 0) AS inventoryValue FROM products`).get();
  res.render("dashboard", { products, stats });
});

// Endpoint para el health check de Render.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

module.exports = app;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => console.log(`Servidor escuchando en el puerto ${PORT}`));
}
