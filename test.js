"use strict";
// Prueba de humo: login inválido/válido, ruta protegida, dashboard y health.
process.env.DATABASE_PATH = require("path").join(require("os").tmpdir(), `t-${Date.now()}`, "app.db");
const assert = require("assert");
const app = require("./server");

const cookieJar = {};
const cookieHeader = () => Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
const saveCookies = (res) => res.headers.getSetCookie().forEach((c) => {
  const [pair] = c.split(";"); const i = pair.indexOf("=");
  cookieJar[pair.slice(0, i)] = pair.slice(i + 1);
});

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, opts = {}) => {
    const res = await fetch(base + p, { redirect: "manual", ...opts, headers: { cookie: cookieHeader(), ...(opts.headers || {}) } });
    saveCookies(res); return res;
  };
  const form = (data) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data) });

  const loginPage = await (await call("/login")).text();
  const csrf = loginPage.match(/name="csrf" value="(\w+)"/)[1];
  assert.strictEqual((await call("/dashboard")).status, 302);
  assert.strictEqual((await call("/login", form({ username: "admin", password: "mala", csrf }))).status, 401);
  assert.strictEqual((await call("/login", form({ username: "admin", password: "admin123", csrf: "x" }))).status, 400);
  assert.strictEqual((await call("/login", form({ username: "admin", password: "admin123", csrf }))).status, 302);
  const dash = await call("/dashboard");
  assert.strictEqual(dash.status, 200);
  assert.ok((await dash.text()).includes("Teclado"));
  assert.deepStrictEqual(await (await call("/health")).json(), { status: "ok" });
  console.log("OK");
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
