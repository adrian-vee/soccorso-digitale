/**
 * SaaS Onboarding & Trial Routes
 *
 * Handles:
 * - GET  /inizia          — signup landing page
 * - POST /api/public/start-trial  — create org + admin user + Stripe SetupIntent + activate trial
 * - POST /api/public/cancel-trial — cancel trial before billing
 * - GET  /api/public/trial-status — check trial status by token
 *
 * Trial lifecycle cron is also exported from here for use in server/index.ts.
 */

import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { db } from "../db";
import { organizations, users, orgSubscriptions } from "@shared/schema";
import { eq, and, lte, or } from "drizzle-orm";
import { getResendClient } from "../resend-client";

const FROM_EMAIL = "Soccorso Digitale <noreply@soccorsodigitale.app>";
const APP_URL = process.env.APP_URL || "https://soccorsodigitale.app";

// ─── Stripe lazy loader ──────────────────────────────────────────────────────

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-04-10" });
}

// ─── Slug helper ─────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

// ─── Email templates ─────────────────────────────────────────────────────────

function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Tahoma,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#0066CC,#003A75);padding:32px;text-align:center;">
<p style="margin:0;color:#fff;font-size:24px;font-weight:700;">Soccorso Digitale</p>
<p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Piattaforma di Gestione Operativa</p>
</td></tr>
<!-- Body -->
<tr><td style="padding:36px 32px;">${body}</td></tr>
<!-- Footer -->
<tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;">© ${new Date().getFullYear()} Soccorso Digitale. Tutti i diritti riservati.<br>
Questa email è stata inviata automaticamente. Non rispondere.</p>
</td></tr>
<tr><td style="background:#0066CC;height:6px;"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, bodyHtml: string): Promise<void> {
  try {
    const { client } = await getResendClient();
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html: emailLayout(bodyHtml),
    });
    if (result.error) {
      console.error("Resend error:", result.error);
    }
  } catch (err) {
    console.error("sendEmail failed:", err);
  }
}

export async function sendWelcomeTrialEmail(
  email: string,
  orgName: string,
  adminName: string,
  password: string,
  trialEndsAt: Date
): Promise<void> {
  const dashboardUrl = `${APP_URL}/admin`;
  const formatted = trialEndsAt.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  await sendEmail(email, `Benvenuto in Soccorso Digitale – Trial attivo per ${orgName}`, `
<h2 style="margin:0 0 8px;color:#0D2440;font-size:20px;">Benvenuto, ${adminName}!</h2>
<p style="color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 20px;">
  Il tuo account Soccorso Digitale per <strong>${orgName}</strong> è stato attivato con successo.<br>
  Hai <strong>14 giorni</strong> per esplorare tutte le funzionalità — il trial scade il <strong>${formatted}</strong>.
</p>
<table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
<tr><td style="background:#0066CC;padding:12px 20px;border-radius:10px 10px 0 0;">
<span style="color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Credenziali di accesso</span>
</td></tr>
<tr><td style="padding:20px;">
<p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Email</p>
<p style="margin:0 0 16px;color:#1a1a2e;font-size:14px;font-weight:500;">${email}</p>
<p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Password provvisoria</p>
<p style="margin:0;font-family:'Courier New',monospace;background:#fff;border:1px solid #d1d5db;padding:8px 14px;border-radius:6px;color:#1a1a2e;font-size:15px;font-weight:600;display:inline-block;">${password}</p>
</td></tr>
</table>
<div style="background:#EBF5FF;border-left:4px solid #0066CC;padding:14px 16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
<p style="margin:0;color:#0066CC;font-size:13px;font-weight:600;">Suggerimento sicurezza</p>
<p style="margin:6px 0 0;color:#374151;font-size:13px;">Cambia la password al primo accesso nelle impostazioni del tuo profilo.</p>
</div>
<p style="text-align:center;margin-bottom:24px;">
<a href="${dashboardUrl}" style="display:inline-block;background:#0066CC;color:#fff;text-decoration:none;padding:14px 48px;border-radius:8px;font-size:16px;font-weight:700;">Accedi alla Piattaforma</a>
</p>
<p style="color:#6B7280;font-size:13px;line-height:1.6;">
  Durante il trial hai accesso completo a tutte le funzionalità. Prima della scadenza ti invieremo un avviso per confermare o cancellare la sottoscrizione.
</p>
`);
}

export async function sendTrialWarningEmail(
  email: string,
  orgName: string,
  adminName: string,
  trialEndsAt: Date,
  planName: string
): Promise<void> {
  const formatted = trialEndsAt.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  const cancelUrl = `${APP_URL}/cancella-trial`;

  await sendEmail(email, `Il tuo trial scade tra 2 giorni – ${orgName}`, `
<h2 style="margin:0 0 8px;color:#0D2440;font-size:20px;">Caro ${adminName},</h2>
<div style="background:#FFF7ED;border-left:4px solid #F59E0B;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
<p style="margin:0;color:#B45309;font-size:13px;font-weight:600;">Trial in scadenza il ${formatted}</p>
<p style="margin:8px 0 0;color:#374151;font-size:13px;line-height:1.5;">
  Il piano <strong>${planName}</strong> di <strong>${orgName}</strong> verrà attivato automaticamente al termine del trial con il metodo di pagamento già inserito.
</p>
</div>
<p style="color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 20px;">
  Se sei soddisfatto non devi fare nulla — il piano si attiva automaticamente.<br>
  Se vuoi cancellare prima della scadenza, clicca qui sotto.
</p>
<p style="text-align:center;margin-bottom:16px;">
<a href="${APP_URL}/admin" style="display:inline-block;background:#0066CC;color:#fff;text-decoration:none;padding:12px 36px;border-radius:8px;font-size:15px;font-weight:700;margin-right:12px;">Continua con il Piano</a>
<a href="${cancelUrl}" style="display:inline-block;background:#fff;color:#dc2626;text-decoration:none;padding:12px 36px;border-radius:8px;font-size:15px;font-weight:700;border:1px solid #dc2626;">Cancella Trial</a>
</p>
`);
}

export async function sendTrialExpiredEmail(
  email: string,
  orgName: string,
  adminName: string
): Promise<void> {
  await sendEmail(email, `Trial scaduto – riattiva il tuo account ${orgName}`, `
<h2 style="margin:0 0 8px;color:#0D2440;font-size:20px;">Caro ${adminName},</h2>
<p style="color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 20px;">
  Il trial di <strong>${orgName}</strong> è scaduto. L'accesso alla piattaforma è stato sospeso.<br>
  Per riattivare il tuo account scegli un piano dal marketplace.
</p>
<p style="text-align:center;">
<a href="${APP_URL}/admin" style="display:inline-block;background:#0066CC;color:#fff;text-decoration:none;padding:14px 48px;border-radius:8px;font-size:16px;font-weight:700;">Riattiva Account</a>
</p>
`);
}

export async function sendTrialCancelledEmail(
  email: string,
  orgName: string,
  adminName: string
): Promise<void> {
  await sendEmail(email, `Trial cancellato – ${orgName}`, `
<h2 style="margin:0 0 8px;color:#0D2440;font-size:20px;">Caro ${adminName},</h2>
<p style="color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 20px;">
  La cancellazione del trial di <strong>${orgName}</strong> è stata confermata.<br>
  I tuoi dati saranno conservati per 30 giorni. Puoi riattivare in qualsiasi momento.
</p>
<p style="text-align:center;">
<a href="${APP_URL}" style="display:inline-block;background:#0066CC;color:#fff;text-decoration:none;padding:14px 48px;border-radius:8px;font-size:16px;font-weight:700;">Torna al sito</a>
</p>
`);
}

// ─── Trial cron (exported for server/index.ts) ───────────────────────────────

export async function runTrialExpiryCheck(): Promise<void> {
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  try {
    // Orgs with trial expiring in next 48 hours (warn them)
    const expiringSoon = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.status, "trial"),
          lte(organizations.trialEndsAt, twoDaysFromNow)
        )
      );

    for (const org of expiringSoon) {
      if (!org.trialEndsAt) continue;
      if (org.trialEndsAt < now) continue; // already expired, handled below

      // Find admin user for this org
      const [admin] = await db
        .select()
        .from(users)
        .where(and(eq(users.organizationId, org.id), eq(users.role, "admin")));
      if (!admin || !org.email) continue;

      await sendTrialWarningEmail(
        org.email,
        org.name,
        admin.name,
        org.trialEndsAt,
        "Pro"
      );
    }

    // Orgs whose trial has actually expired — suspend them
    const expired = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.status, "trial"),
          lte(organizations.trialEndsAt, now)
        )
      );

    for (const org of expired) {
      await db
        .update(organizations)
        .set({ status: "suspended" })
        .where(eq(organizations.id, org.id));

      const [admin] = await db
        .select()
        .from(users)
        .where(and(eq(users.organizationId, org.id), eq(users.role, "admin")));
      if (admin && org.email) {
        await sendTrialExpiredEmail(org.email, org.name, admin.name);
      }
    }

    if (expiringSoon.length || expired.length) {
      console.log(
        `[trial-cron] warned=${expiringSoon.length} expired=${expired.length}`
      );
    }
  } catch (err) {
    console.error("[trial-cron] error:", err);
  }
}

// ─── Signup page HTML ────────────────────────────────────────────────────────

function buildSignupPage(): string {
  const plans = [
    { key: "base", name: "Base", price: 49, features: ["Fino a 5 mezzi", "Gestione turni base", "Programma giornaliero", "App mobile Android", "Supporto community"] },
    { key: "pro",  name: "Pro",  price: 99, popular: true, features: ["Fino a 20 mezzi", "Turni avanzati + reperibilità", "Analytics operative complete", "GPS tracking in tempo reale", "Fatturazione & finance", "Supporto prioritario"] },
    { key: "enterprise", name: "Enterprise", price: 199, features: ["Mezzi illimitati", "Multi-sede illimitata", "API personalizzate", "SLA 99.9%", "Onboarding dedicato", "Account manager dedicato"] },
  ];

  const plansHtml = plans.map(p => `
    <div class="plan-card ${p.popular ? 'popular' : ''}" data-plan="${p.key}" data-price="${p.price}" onclick="selectPlan('${p.key}')">
      ${p.popular ? '<div class="popular-badge">⭐ Più scelto</div>' : ''}
      <div class="plan-name">${p.name}</div>
      <div class="plan-price">€${p.price}<span>/mese</span></div>
      <ul class="plan-features">
        ${p.features.map(f => `<li>✓ ${f}</li>`).join("")}
      </ul>
      <button class="plan-select-btn" type="button">Scegli ${p.name}</button>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Inizia il tuo trial gratuito – Soccorso Digitale</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#f0f6ff 0%,#e8f0ff 100%);min-height:100vh;color:#1a1a2e}
.header{background:linear-gradient(135deg,#0066CC,#003A75);padding:20px 32px;display:flex;align-items:center;gap:12px}
.header-logo{width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center}
.header-logo svg{width:20px;height:20px;stroke:#fff;fill:none}
.header h1{color:#fff;font-size:20px;font-weight:700}
.header p{color:rgba(255,255,255,.7);font-size:12px}
.container{max-width:960px;margin:0 auto;padding:48px 16px}
h2{font-size:28px;font-weight:700;color:#0D2440;text-align:center;margin-bottom:8px}
.subtitle{text-align:center;color:#64748b;margin-bottom:40px;font-size:15px}
/* Plans */
.plans-row{display:flex;gap:20px;justify-content:center;margin-bottom:48px;flex-wrap:wrap}
.plan-card{background:#fff;border:2px solid #e2e8f0;border-radius:16px;padding:28px 24px;width:280px;cursor:pointer;transition:all .2s;position:relative}
.plan-card:hover,.plan-card.selected{border-color:#0066CC;box-shadow:0 0 0 3px rgba(0,102,204,.15)}
.plan-card.popular{border-color:#0066CC;background:linear-gradient(180deg,#f0f6ff,#fff)}
.popular-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#0066CC;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap}
.plan-name{font-size:18px;font-weight:700;color:#0D2440;margin-bottom:8px}
.plan-price{font-size:32px;font-weight:800;color:#0066CC;margin-bottom:16px}
.plan-price span{font-size:14px;color:#64748b;font-weight:400}
.plan-features{list-style:none;margin-bottom:20px}
.plan-features li{padding:6px 0;color:#4a4a68;font-size:13px;border-bottom:1px solid #f1f5f9}
.plan-features li:last-child{border:none}
.plan-select-btn{width:100%;background:#0066CC;color:#fff;border:none;padding:10px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .2s}
.plan-select-btn:hover{background:#0052a3}
.plan-card.selected .plan-select-btn{background:#00A651}
/* Form */
.form-card{background:#fff;border-radius:16px;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,.06);max-width:560px;margin:0 auto}
.form-card h3{font-size:18px;font-weight:700;color:#0D2440;margin-bottom:24px}
.form-row{display:flex;gap:16px}
.form-group{flex:1;margin-bottom:18px}
.form-group label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
.form-group input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:14px;color:#1a1a2e;transition:border .2s}
.form-group input:focus{outline:none;border-color:#0066CC;box-shadow:0 0 0 3px rgba(0,102,204,.1)}
.plan-summary{background:#f0f6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:none}
.plan-summary.visible{display:block}
.plan-summary p{font-size:13px;color:#1e3a5f}
.stripe-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:20px}
.stripe-section p{font-size:13px;color:#64748b;line-height:1.5}
.stripe-section strong{color:#374151}
#stripe-card-element{border:1px solid #d1d5db;border-radius:8px;padding:12px;background:#fff;margin-top:8px}
.submit-btn{width:100%;background:#0066CC;color:#fff;border:none;padding:14px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s}
.submit-btn:hover:not(:disabled){background:#0052a3}
.submit-btn:disabled{background:#94a3b8;cursor:not-allowed}
.legal{font-size:11px;color:#94a3b8;text-align:center;margin-top:12px;line-height:1.5}
.error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:8px;padding:12px;font-size:13px;margin-bottom:16px;display:none}
.success{background:#f0fdf4;border:1px solid #86efac;color:#15803d;border-radius:8px;padding:16px;font-size:14px;display:none}
#step1{display:block}
#step2{display:none}
.back-btn{background:none;border:none;color:#0066CC;font-size:14px;cursor:pointer;margin-bottom:20px;padding:0;display:flex;align-items:center;gap:4px}
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">
    <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  </div>
  <div><h1>Soccorso Digitale</h1><p>Piattaforma di Gestione Operativa</p></div>
</div>

<div class="container">
  <div id="step1">
    <h2>Scegli il piano giusto per la tua organizzazione</h2>
    <p class="subtitle">14 giorni di prova gratuita • Nessun addebito fino alla fine del trial • Cancella in qualsiasi momento</p>
    <div class="plans-row">${plansHtml}</div>
  </div>

  <div id="step2">
    <button class="back-btn" onclick="goBack()">← Torna ai piani</button>
    <div class="form-card">
      <h3>Attiva il tuo trial gratuito</h3>

      <div class="error" id="form-error"></div>
      <div class="success" id="form-success"></div>

      <div class="plan-summary visible" id="plan-summary">
        <p><strong id="summary-plan"></strong> – €<span id="summary-price"></span>/mese • Prova gratuita 14 giorni</p>
      </div>

      <form id="signup-form">
        <div class="form-group">
          <label>Nome organizzazione *</label>
          <input type="text" id="org-name" placeholder="es. Croce Rossa Verona" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Il tuo nome *</label>
            <input type="text" id="admin-name" placeholder="Mario Rossi" required />
          </div>
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="admin-email" placeholder="mario@croce.it" required />
          </div>
        </div>

        <div class="stripe-section">
          <p><strong>Metodo di pagamento</strong> — richiesto per attivare il trial</p>
          <p>Non verrà addebitato nulla fino al termine dei 14 giorni. Puoi cancellare prima senza costi.</p>
          <div id="stripe-card-element"></div>
          <div id="stripe-errors" style="color:#dc2626;font-size:12px;margin-top:6px;"></div>
          <div id="no-stripe-notice" style="display:none;margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px;font-size:12px;color:#92400e;">
            Il metodo di pagamento è momentaneamente non disponibile. Il trial verrà attivato comunque e potrai inserire i dati di pagamento in seguito dalle impostazioni.
          </div>
        </div>

        <button type="submit" class="submit-btn" id="submit-btn">
          Attiva Trial Gratuito
        </button>
        <p class="legal">
          Attivando il trial accetti i <a href="/termini" style="color:#0066CC;">Termini di Servizio</a>
          e l'<a href="/privacy" style="color:#0066CC;">Informativa Privacy</a> di Soccorso Digitale.
        </p>
      </form>
    </div>
  </div>
</div>

<script>
let selectedPlan = null;
let stripe = null;
let cardElement = null;

// Init Stripe if available
fetch('/api/public/stripe-config')
  .then(r => r.json())
  .then(d => {
    if (d.publishableKey) {
      stripe = Stripe(d.publishableKey);
      const elements = stripe.elements();
      cardElement = elements.create('card', { style: { base: { fontSize: '14px', color: '#1a1a2e' } } });
      cardElement.mount('#stripe-card-element');
      cardElement.on('change', e => {
        document.getElementById('stripe-errors').textContent = e.error ? e.error.message : '';
      });
    } else {
      document.getElementById('stripe-card-element').style.display = 'none';
      document.getElementById('no-stripe-notice').style.display = 'block';
    }
  })
  .catch(() => {
    document.getElementById('stripe-card-element').style.display = 'none';
    document.getElementById('no-stripe-notice').style.display = 'block';
  });

function selectPlan(key) {
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('[data-plan="' + key + '"]');
  card.classList.add('selected');
  selectedPlan = { key, name: card.querySelector('.plan-name').textContent, price: card.dataset.price };
  document.getElementById('summary-plan').textContent = selectedPlan.name;
  document.getElementById('summary-price').textContent = selectedPlan.price;
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  // Load Stripe.js if not loaded yet
  if (!window.Stripe) {
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = () => {
      fetch('/api/public/stripe-config').then(r => r.json()).then(d => {
        if (d.publishableKey) {
          stripe = Stripe(d.publishableKey);
          const elements = stripe.elements();
          cardElement = elements.create('card', { style: { base: { fontSize: '14px', color: '#1a1a2e' } } });
          cardElement.mount('#stripe-card-element');
        } else {
          document.getElementById('stripe-card-element').style.display = 'none';
          document.getElementById('no-stripe-notice').style.display = 'block';
        }
      }).catch(() => {
        document.getElementById('stripe-card-element').style.display = 'none';
        document.getElementById('no-stripe-notice').style.display = 'block';
      });
    };
    document.head.appendChild(s);
  }
}

function goBack() {
  document.getElementById('step1').style.display = 'block';
  document.getElementById('step2').style.display = 'none';
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const errBox = document.getElementById('form-error');
  const successBox = document.getElementById('form-success');
  errBox.style.display = 'none';
  successBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Attivazione in corso...';

  try {
    const orgName = document.getElementById('org-name').value.trim();
    const adminName = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();

    if (!orgName || !adminName || !email || !selectedPlan) {
      throw new Error('Compila tutti i campi obbligatori');
    }

    let paymentMethodId = null;
    if (stripe && cardElement) {
      const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
      if (error) throw new Error(error.message);
      paymentMethodId = paymentMethod.id;
    }

    const resp = await fetch('/api/public/start-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, adminName, email, plan: selectedPlan.key, paymentMethodId }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Errore nella registrazione');

    successBox.innerHTML = '<strong>✓ Trial attivato!</strong> Controlla la tua email per le credenziali di accesso.';
    successBox.style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
    setTimeout(() => window.location.href = '/admin', 4000);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Attiva Trial Gratuito';
  }
});
</script>
<!-- Load Stripe.js -->
<script src="https://js.stripe.com/v3/"></script>
</body>
</html>`;
}

// ─── Cancella Trial page ─────────────────────────────────────────────────────

function buildCancelPage(): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cancella Trial – Soccorso Digitale</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#f0f4f8;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:16px;padding:40px;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
h2{color:#0D2440;font-size:22px;margin-bottom:12px}
p{color:#4a4a68;font-size:14px;line-height:1.7;margin-bottom:24px}
.form-group{margin-bottom:16px;text-align:left}
label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:5px}
input{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:14px}
.cancel-btn{background:#dc2626;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;width:100%;margin-bottom:12px}
.back-link{color:#0066CC;font-size:13px;text-decoration:none}
.msg{padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;display:none}
.msg.error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.msg.success{background:#f0fdf4;color:#15803d;border:1px solid #86efac}
</style>
</head>
<body>
<div class="card">
  <h2>Cancella il tuo Trial</h2>
  <p>Inserisci l'email del tuo account per confermare la cancellazione del trial. Nessun addebito verrà effettuato.</p>
  <div class="msg error" id="err"></div>
  <div class="msg success" id="ok"></div>
  <form id="cancel-form">
    <div class="form-group">
      <label>Email account *</label>
      <input type="email" id="cancel-email" placeholder="la-tua@email.it" required />
    </div>
    <button type="submit" class="cancel-btn">Conferma Cancellazione</button>
  </form>
  <a href="/" class="back-link">← Torna al sito</a>
</div>
<script>
document.getElementById('cancel-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('cancel-email').value.trim();
  const errEl = document.getElementById('err');
  const okEl = document.getElementById('ok');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  const r = await fetch('/api/public/cancel-trial', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email })
  });
  const d = await r.json();
  if (!r.ok) { errEl.textContent = d.error || 'Errore'; errEl.style.display = 'block'; }
  else { document.getElementById('cancel-form').style.display = 'none'; okEl.textContent = 'Trial cancellato. Grazie per aver provato Soccorso Digitale.'; okEl.style.display = 'block'; }
});
</script>
</body>
</html>`;
}

// ─── Route registration ───────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, { maxVehicles: number; maxUsers: number; amount: number }> = {
  base:       { maxVehicles: 5,   maxUsers: 20,  amount: 4900  },
  pro:        { maxVehicles: 20,  maxUsers: 100, amount: 9900  },
  enterprise: { maxVehicles: 999, maxUsers: 999, amount: 19900 },
};

export function registerSaasOnboardingRoutes(app: Express): void {
  // ── Signup page ────────────────────────────────────────────────────────────
  app.get("/inizia", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(buildSignupPage());
  });

  // ── Cancel-trial page ──────────────────────────────────────────────────────
  app.get("/cancella-trial", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(buildCancelPage());
  });

  // ── Stripe publishable key (public) ───────────────────────────────────────
  app.get("/api/public/stripe-config", (_req: Request, res: Response) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
  });

  // ── Start trial ────────────────────────────────────────────────────────────
  app.post("/api/public/start-trial", async (req: Request, res: Response) => {
    const { orgName, adminName, email, plan, paymentMethodId } = req.body;

    if (!orgName || !adminName || !email || !plan) {
      return res.status(400).json({ error: "Campi obbligatori mancanti" });
    }
    if (!PLAN_LIMITS[plan]) {
      return res.status(400).json({ error: "Piano non valido" });
    }

    // Check email not already used
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    if (existingUser) {
      return res.status(409).json({ error: "Email già registrata. Accedi alla tua piattaforma." });
    }

    const limits = PLAN_LIMITS[plan];
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Create organization
    const baseSlug = toSlug(orgName);
    const [existingOrg] = await db.select().from(organizations).where(eq(organizations.slug, baseSlug));
    const slug = existingOrg ? `${baseSlug}-${Date.now()}` : baseSlug;

    const [org] = await db
      .insert(organizations)
      .values({
        name: orgName,
        slug,
        email,
        status: "trial",
        maxVehicles: limits.maxVehicles,
        maxUsers: limits.maxUsers,
        trialEndsAt,
      })
      .returning();

    // Create admin user
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    await db.insert(users).values({
      email,
      password: hashed,
      name: adminName,
      role: "admin",
      accountType: "person",
      organizationId: org.id,
      isActive: true,
    });

    // Stripe: create customer + attach payment method
    let stripeCustomerId: string | null = null;
    const stripe = getStripe();
    if (stripe && paymentMethodId) {
      try {
        const customer = await stripe.customers.create({
          email,
          name: orgName,
          payment_method: paymentMethodId,
          invoice_settings: { default_payment_method: paymentMethodId },
          metadata: { organizationId: org.id, plan },
        });
        stripeCustomerId = customer.id;

        // Record subscription as trialing
        await db.insert(orgSubscriptions).values({
          organizationId: org.id,
          moduleKey: `plan_${plan}`,
          moduleName: `Piano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
          stripeCustomerId,
          status: "trialing",
          billingPeriod: "monthly",
          amount: limits.amount,
          trialStart: new Date(),
          trialEnd: trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        });
      } catch (stripeErr) {
        console.error("Stripe error (non-fatal):", stripeErr);
        // Trial proceeds without Stripe — can be updated later
      }
    }

    // Send welcome email
    await sendWelcomeTrialEmail(email, orgName, adminName, tempPassword, trialEndsAt);

    res.json({
      success: true,
      message: "Trial attivato! Controlla la tua email per le credenziali.",
      organizationId: org.id,
    });
  });

  // ── Demo request ──────────────────────────────────────────────────────────
  app.post("/api/public/demo-request", async (req: Request, res: Response) => {
    const { nome, email, organizzazione, veicoli, ruolo, messaggio } = req.body;
    if (!nome || !email || !organizzazione) {
      return res.status(400).json({ error: "Campi obbligatori mancanti" });
    }
    // Send notification to internal team
    try {
      const { client } = await getResendClient();
      await client.emails.send({
        from: FROM_EMAIL,
        to: "info@soccorsodigitale.app",
        subject: `Nuova richiesta demo — ${organizzazione}`,
        html: `<p><strong>Nome:</strong> ${nome}<br><strong>Email:</strong> ${email}<br><strong>Organizzazione:</strong> ${organizzazione}<br><strong>Veicoli:</strong> ${veicoli || "n/d"}<br><strong>Ruolo:</strong> ${ruolo || "n/d"}<br><strong>Messaggio:</strong> ${messaggio || "—"}</p>`,
      });
      // Send confirmation to requester
      await sendEmail(email, "Richiesta demo ricevuta — Soccorso Digitale", `
<h2 style="color:#0D2440;font-size:20px;margin:0 0 12px;">Ciao ${nome}!</h2>
<p style="color:#4a4a68;font-size:15px;line-height:1.7;margin:0 0 16px;">
  Abbiamo ricevuto la tua richiesta di demo per <strong>${organizzazione}</strong>.<br>
  Ti contatteremo entro <strong>24 ore lavorative</strong> per fissare un appuntamento.
</p>
<p style="text-align:center;">
<a href="${APP_URL}/admin" style="display:inline-block;background:#2E5E99;color:#fff;text-decoration:none;padding:12px 36px;border-radius:8px;font-size:15px;font-weight:700;">Visita la Piattaforma</a>
</p>
`);
    } catch (err) {
      console.error("Demo request email error (non-fatal):", err);
    }
    res.json({ success: true });
  });

  // ── General contact ────────────────────────────────────────────────────────
  app.post("/api/public/contact", async (req: Request, res: Response) => {
    const { nome, email, tipo, messaggio } = req.body;
    if (!nome || !email || !messaggio) {
      return res.status(400).json({ error: "Campi obbligatori mancanti" });
    }
    try {
      const { client } = await getResendClient();
      await client.emails.send({
        from: FROM_EMAIL,
        to: "info@soccorsodigitale.app",
        subject: `[${tipo || "Contatto"}] da ${nome}`,
        html: `<p><strong>Nome:</strong> ${nome}<br><strong>Email:</strong> ${email}<br><strong>Tipo:</strong> ${tipo || "—"}<br><strong>Messaggio:</strong><br>${messaggio}</p>`,
      });
    } catch (err) {
      console.error("Contact email error (non-fatal):", err);
    }
    res.json({ success: true });
  });

  // ── Cancel trial ───────────────────────────────────────────────────────────
  app.post("/api/public/cancel-trial", async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email obbligatoria" });

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !user.organizationId) {
      return res.status(404).json({ error: "Account non trovato" });
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
    if (!org || org.status !== "trial") {
      return res.status(400).json({ error: "Nessun trial attivo per questo account" });
    }

    await db
      .update(organizations)
      .set({ status: "inactive" })
      .where(eq(organizations.id, org.id));

    // Cancel Stripe subscriptions
    const stripe = getStripe();
    const subs = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.organizationId, org.id));
    if (stripe) {
      for (const sub of subs) {
        if (sub.stripeSubscriptionId) {
          try { await stripe.subscriptions.cancel(sub.stripeSubscriptionId); } catch {}
        }
      }
    }

    await sendTrialCancelledEmail(email, org.name, user.name);

    res.json({ success: true, message: "Trial cancellato con successo." });
  });
}
