/**
 * mydogcanfly-api — Cloudflare Worker (Phase 2 skeleton)
 *
 * Roles:
 *   A. Weather proxy + cache   ->  GET  /api/weather?lat&lon
 *   B. Email capture (opt-in)  ->  POST /api/subscribe/heat
 *                                  POST /api/subscribe/plan
 *                                  GET  /api/confirm?token
 *                                  GET  /api/unsubscribe?token
 *   C. Scheduled (cron)        ->  heat alerts + dated plan reminders
 *
 * Bindings (wrangler.toml): WX_CACHE (KV), DB (D1)
 * Secrets: RESEND_API_KEY  (wrangler secret put RESEND_API_KEY)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS preflight
    if (request.method === "OPTIONS") return cors(env, new Response(null, { status: 204 }));

    try {
      if (pathname === "/api/weather" && request.method === "GET")
        return cors(env, await handleWeather(url, env, ctx));

      if (pathname === "/api/subscribe/heat" && request.method === "POST")
        return cors(env, await handleSubscribe("heat", request, env));

      if (pathname === "/api/subscribe/plan" && request.method === "POST")
        return cors(env, await handleSubscribe("plan", request, env));

      if (pathname === "/api/confirm" && request.method === "GET")
        return handleConfirm(url, env);

      if (pathname === "/api/unsubscribe" && request.method === "GET")
        return handleUnsubscribe(url, env);

      return cors(env, json({ error: "Not found" }, 404));
    } catch (err) {
      return cors(env, json({ error: "Server error", detail: String(err && err.message || err) }, 500));
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },
};

/* ------------------------------------------------------------------ helpers */

function cors(env, res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN || "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
function token() { return crypto.randomUUID().replace(/-/g, ""); }

/* --------------------------------------------------------- A. weather proxy */

async function handleWeather(url, env, ctx) {
  const lat = parseFloat(url.searchParams.get("lat"));
  const lon = parseFloat(url.searchParams.get("lon"));
  if (!isFinite(lat) || !isFinite(lon)) return json({ error: "lat/lon required" }, 400);

  const data = await getWeather(lat, lon, env, ctx);
  if (!data) return json({ error: "weather unavailable" }, 502);
  return json(data);
}

// Rounded to ~0.1deg (~11km) so nearby visitors share one cache entry.
function wxKey(lat, lon) {
  return `wx:${lat.toFixed(1)}:${lon.toFixed(1)}`;
}

async function getWeather(lat, lon, env, ctx) {
  const key = wxKey(lat, lon);
  const cached = await env.WX_CACHE.get(key, "json");
  if (cached) return { ...cached, cached: true };

  let api = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day`;
  if (env.OPEN_METEO_KEY) api = api.replace("api.open-meteo.com", "customer-api.open-meteo.com") + `&apikey=${env.OPEN_METEO_KEY}`;

  const r = await fetch(api, { cf: { cacheTtl: 600 } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.current) return null;

  const out = {
    tempC: j.current.temperature_2m,
    feelsC: j.current.apparent_temperature != null ? j.current.apparent_temperature : j.current.temperature_2m,
    hum: j.current.relative_humidity_2m,
    isDay: j.current.is_day,
    cached: false,
  };
  // TTL 30 min
  const put = env.WX_CACHE.put(key, JSON.stringify(out), { expirationTtl: 1800 });
  if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  return out;
}

/* -------------------------------------------------- B. subscribe / opt-in */

async function handleSubscribe(type, request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }

  // Honeypot: hidden field must stay empty
  if (body.website) return json({ ok: true }); // silently drop bots
  if (!body.consent) return json({ error: "consent required" }, 400);
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "invalid email" }, 400);

  const tk = token();
  const created = nowISO();

  if (type === "heat") {
    const lat = parseFloat(body.lat), lon = parseFloat(body.lon);
    if (!isFinite(lat) || !isFinite(lon)) return json({ error: "location required" }, 400);
    await env.DB.prepare(
      `INSERT INTO subscribers (type,email,status,token,lat,lon,place,threshold,created_at)
       VALUES ('heat',?,'pending',?,?,?,?,?,?)`
    ).bind(email, tk, lat, lon, body.place || null, body.threshold || null, created).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO subscribers (type,email,status,token,pet,origin,destination,travel_date,created_at)
       VALUES ('plan',?,'pending',?,?,?,?,?,?)`
    ).bind(email, tk, body.pet || "dog", body.origin || null, body.destination || null, body.travelDate || null, created).run();
  }

  await sendConfirmEmail(env, email, tk, type);
  return json({ ok: true, status: "pending" }, 202);
}

async function handleConfirm(url, env) {
  const tk = url.searchParams.get("token");
  if (!tk) return html(page("Invalid link", "This confirmation link is missing its token."), 400);

  const sub = await env.DB.prepare(`SELECT * FROM subscribers WHERE token=?`).bind(tk).first();
  if (!sub) return html(page("Link expired", "We couldn't find this subscription."), 404);

  if (sub.status !== "confirmed") {
    await env.DB.prepare(`UPDATE subscribers SET status='confirmed', confirmed_at=? WHERE id=?`)
      .bind(nowISO(), sub.id).run();
    if (sub.type === "plan") {
      await buildPlanSteps(env, sub);
      await sendPlanReport(env, sub);
    }
  }
  // In production, redirect to a nice page on the site:
  // return Response.redirect(`${env.SITE_URL}/email-confirmed/`, 302);
  return html(page("You're all set ✅", "Your subscription is confirmed. You can close this tab."));
}

async function handleUnsubscribe(url, env) {
  const tk = url.searchParams.get("token");
  if (!tk) return html(page("Invalid link", "Missing token."), 400);
  await env.DB.prepare(`UPDATE subscribers SET status='unsubscribed', unsub_at=? WHERE token=?`)
    .bind(nowISO(), tk).run();
  return html(page("Unsubscribed", "You won't receive any more emails. Sorry to see you go!"));
}

/* --------------------------------------------------------- C. scheduled */

async function runScheduled(env) {
  await runHeatAlerts(env);
  await runPlanReminders(env);
}

async function runHeatAlerts(env) {
  const minLevel = parseInt(env.HEAT_MIN_LEVEL || "3", 10);
  const day = today();
  const { results } = await env.DB.prepare(
    `SELECT * FROM subscribers WHERE type='heat' AND status='confirmed'
     AND (last_alert_at IS NULL OR last_alert_at < ?)`
  ).bind(day).all();

  for (const sub of results || []) {
    const wx = await getWeather(sub.lat, sub.lon, env, null); // shares the KV cache
    if (!wx) continue;
    const level = walkRisk(wx.tempC, wx.hum, "m", false, false); // baseline profile
    const userMin = sub.threshold ? parseInt(sub.threshold, 10) : minLevel;
    if (level >= userMin) {
      await sendHeatAlert(env, sub, wx, level);
      await env.DB.prepare(`UPDATE subscribers SET last_alert_at=? WHERE id=?`).bind(day, sub.id).run();
    }
  }
}

async function runPlanReminders(env) {
  const day = today();
  const { results } = await env.DB.prepare(
    `SELECT ps.*, s.email, s.token, s.destination
       FROM plan_steps ps JOIN subscribers s ON s.id = ps.subscriber_id
      WHERE ps.sent_at IS NULL AND ps.due_date <= ? AND s.status='confirmed'`
  ).bind(day).all();

  for (const step of results || []) {
    await sendReminder(env, step);
    await env.DB.prepare(`UPDATE plan_steps SET sent_at=? WHERE id=?`).bind(nowISO(), step.id).run();
  }
}

/* ----------------------------------------------- plan step generator (basic)
 * NOTE: this is a minimal, extensible skeleton. Replace/extend DEST_RULES with
 * the real lead-times from the country-requirements dataset so each step lands
 * on the correct backward-dated day. Offsets are in days BEFORE the travel date.
 */
const DEST_RULES = {
  _default: [
    { key: "microchip_vaccine", label: "Microchip + rabies vaccine done and valid", offset: 30 },
    { key: "certificate",       label: "Get the health certificate issued/endorsed", offset: 10 },
    { key: "final_check",       label: "Final paperwork check before departure", offset: 2 },
  ],
  japan:     [ { key: "start", label: "Start the Japan process (titer + 180-day wait)", offset: 240 },
               { key: "titer", label: "Rabies titer test drawn", offset: 210 },
               { key: "certificate", label: "Health certificate endorsed", offset: 10 } ],
  australia: [ { key: "start", label: "Start the Australia process (import permit + titer)", offset: 240 },
               { key: "titer", label: "Rabies titer test drawn", offset: 200 },
               { key: "permit", label: "Apply for the DAFF import permit", offset: 60 } ],
  "european-union": [ { key: "vaccine", label: "Rabies vaccine (21-day wait starts)", offset: 30 },
                      { key: "certificate", label: "EU pet passport / health certificate ready", offset: 10 } ],
};

async function buildPlanSteps(env, sub) {
  if (!sub.travel_date) return;
  const rules = DEST_RULES[(sub.destination || "").toLowerCase()] || DEST_RULES._default;
  const travel = new Date(sub.travel_date + "T09:00:00Z");
  const stmts = [];
  for (const r of rules) {
    const due = new Date(travel.getTime() - r.offset * 86400000).toISOString().slice(0, 10);
    stmts.push(env.DB.prepare(
      `INSERT INTO plan_steps (subscriber_id,step_key,label,due_date) VALUES (?,?,?,?)`
    ).bind(sub.id, r.key, r.label, due));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

/* ----------------------------------------------- heat risk (server copy) */
function walkRisk(airC, hum, size, brachy, atRisk) {
  let s;
  if (airC < 20) s = 0; else if (airC < 25) s = 1; else if (airC < 29) s = 2; else if (airC < 32) s = 3; else s = 4;
  if (airC >= 25 && hum >= 60) s += 1;
  if (brachy) s += 1;
  if (size === "l") s += 1;
  if (atRisk) s += 1;
  if (s < 1) s = 1; if (s > 4) s = 4;
  return s;
}

/* --------------------------------------------------------- email (Resend) */

async function sendEmail(env, to, subject, htmlBody) {
  if (!env.RESEND_API_KEY) { console.log("[email] no RESEND_API_KEY; skipping", { to, subject }); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.FROM_EMAIL, to, subject, html: htmlBody }),
  });
  if (!res.ok) console.log("[email] send failed", res.status, await res.text());
}

function link(env, path) { return `${env.API_URL}${path}`; }
function footer(env, tk) {
  return `<hr><p style="font:12px sans-serif;color:#888">My Dog Can Fly · ` +
         `<a href="${link(env, `/api/unsubscribe?token=${tk}`)}">Unsubscribe</a></p>`;
}

async function sendConfirmEmail(env, email, tk, type) {
  const what = type === "heat" ? "heat alerts for your dog" : "your dated travel checklist";
  await sendEmail(env, email, "Confirm your subscription",
    `<div style="font:15px/1.6 sans-serif;color:#2d3748">
      <h2 style="color:#14294B">One click to confirm</h2>
      <p>Please confirm you want to receive ${what} from My Dog Can Fly.</p>
      <p><a href="${link(env, `/api/confirm?token=${tk}`)}"
            style="background:#C89048;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Confirm</a></p>
      <p style="color:#888;font-size:13px">If you didn't request this, just ignore this email.</p>
    </div>`);
}

async function sendPlanReport(env, sub) {
  const { results } = await env.DB.prepare(
    `SELECT label, due_date FROM plan_steps WHERE subscriber_id=? ORDER BY due_date`
  ).bind(sub.id).all();
  const rows = (results || []).map(s => `<li><b>${s.due_date}</b> — ${s.label}</li>`).join("");
  await sendEmail(env, sub.email, `Your dated checklist: ${sub.origin || "?"} → ${sub.destination || "?"}`,
    `<div style="font:15px/1.6 sans-serif;color:#2d3748">
      <h2 style="color:#14294B">Your dog's travel timeline</h2>
      <p>Travel date: <b>${sub.travel_date}</b>. Here is your backward-dated plan:</p>
      <ul>${rows || "<li>No dated steps for this route yet.</li>"}</ul>
      <p>We'll email you a reminder before each critical date.</p>
      ${footer(env, sub.token)}
    </div>`);
}

async function sendHeatAlert(env, sub, wx, level) {
  const lbl = ["", "Low", "Watch", "High", "Danger"][level];
  await sendEmail(env, sub.email, `🌡️ Heat alert for your dog — ${lbl}`,
    `<div style="font:15px/1.6 sans-serif;color:#2d3748">
      <h2 style="color:#14294B">It's getting hot in ${sub.place || "your area"}</h2>
      <p>Current temperature: <b>${Math.round(wx.tempC)} °C (${Math.round(wx.tempC * 9 / 5 + 32)} °F)</b>,
         humidity ${Math.round(wx.hum)}%. Risk level for a dog: <b>${lbl}</b>.</p>
      <p>Walk early or late, keep it short, avoid hot pavement, and carry water.
         <a href="${env.SITE_URL}/tools/is-it-too-hot-for-my-dog/">Open the checker</a>.</p>
      ${footer(env, sub.token)}
    </div>`);
}

async function sendReminder(env, step) {
  await sendEmail(env, step.email, `⏳ Reminder: ${step.label}`,
    `<div style="font:15px/1.6 sans-serif;color:#2d3748">
      <h2 style="color:#14294B">Time for the next step</h2>
      <p><b>${step.label}</b> — this is a key date for your trip to ${step.destination || "your destination"}.</p>
      <p><a href="${env.SITE_URL}/tools/dog-entry-requirements-by-country/">Review the full requirements</a>.</p>
      ${footer(env, step.token)}
    </div>`);
}

/* --------------------------------------------------------- tiny HTML page */
function page(title, msg) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <div style="max-width:520px;margin:12vh auto;font:16px/1.6 sans-serif;color:#2d3748;text-align:center;padding:0 16px">
    <h1 style="color:#14294B">${title}</h1><p>${msg}</p>
    <p><a href="https://mydogcanfly.com/" style="color:#1D4E82">← Back to My Dog Can Fly</a></p>
  </div>`;
}
