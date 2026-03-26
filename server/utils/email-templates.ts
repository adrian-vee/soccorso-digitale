import {
  emailWrap, heroBand, credsBox, ctaButton,
  noticeBox, upgradeBanner, modulesGrid, cardFooter, detailRow,
  LOGIN_URL, SITE_URL,
} from './email-design-system';

export interface EmailModule { name: string; desc: string; }

export const DEFAULT_EMAIL_MODULES: EmailModule[] = [
  { name: 'Gestione Servizi',      desc: 'Pianifica e monitora ogni trasporto' },
  { name: 'Flotta Veicoli',        desc: 'Gestione mezzi e documenti' },
  { name: 'Anagrafica Personale',  desc: 'Gestione volontari e operatori' },
  { name: 'Pianificazione Turni',  desc: 'Turni e disponibilità' },
  { name: 'Consegne Digitali',     desc: 'Passaggio consegne tra equipaggi' },
  { name: 'Registro Sanificazioni',desc: 'Log pulizia post-servizio' },
  { name: 'Benessere Staff',       desc: 'Prevenzione burnout equipaggi' },
  { name: 'Registro Volontari',    desc: 'Anagrafica e certificazioni Art. 17 CTS' },
];

// ─────────────────────────────────────────
// 1. Credenziali Demo
// ─────────────────────────────────────────
export function templateCredenzialiDemo(params: {
  orgName: string;
  loginEmail: string;
  password: string;
  expiresAt: Date;
  loginUrl?: string;
  modules?: EmailModule[];
}): string {
  const { orgName, loginEmail, password, expiresAt, loginUrl = LOGIN_URL, modules = DEFAULT_EMAIL_MODULES } = params;
  const expiry = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(expiresAt);

  const content = `
    ${heroBand(
      'Accesso Demo Attivato',
      'Benvenuto,',
      `${orgName}.`,
      'La tua demo è pronta. Accedi con le credenziali qui sotto ed esplora la piattaforma senza limiti.',
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        ${credsBox(loginEmail, password)}
        ${ctaButton('Accedi al Pannello di Controllo', loginUrl)}
        ${noticeBox(`<strong style="color:#1D1D1F;">Demo attiva fino al ${expiry}.</strong> Contattaci per estendere o attivare il piano completo.`, 'info')}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="height:1px;background:#E5E5EA;"></td></tr></table>
        ${upgradeBanner()}
        ${modulesGrid(modules)}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, `Accesso Demo — ${orgName}`);
}

// ─────────────────────────────────────────
// 2. Benvenuto Organizzazione / Invito Utente
// ─────────────────────────────────────────
export function templateBenvenutoOrg(params: {
  orgName: string;
  recipientName: string;
  loginEmail: string;
  password: string;
  roleName?: string;
  loginUrl?: string;
  modules?: EmailModule[];
}): string {
  const { orgName, recipientName, loginEmail, password, roleName, loginUrl = LOGIN_URL, modules } = params;

  const content = `
    ${heroBand(
      'Account Attivato',
      'Benvenuto in',
      'Soccorso Digitale.',
      `${orgName} è ora attiva sulla piattaforma. Accedi con le credenziali qui sotto.`,
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        <p style="font-size:15px;color:#1D1D1F;line-height:1.6;margin:0 0 28px;">
          Ciao <strong>${recipientName}</strong>,
          ${roleName ? `il tuo account <strong>${roleName}</strong> è pronto.` : 'il tuo account è pronto.'}
        </p>
        ${credsBox(loginEmail, password)}
        ${ctaButton('Accedi ora', loginUrl)}
        ${noticeBox(`Per sicurezza, cambia la password al primo accesso dalla sezione <strong style="color:#1D1D1F;">Impostazioni</strong>.`, 'warning')}
        ${modules ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;"><tr><td style="height:1px;background:#E5E5EA;"></td></tr></table>${modulesGrid(modules)}` : ''}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, `Benvenuto — ${orgName}`);
}

// ─────────────────────────────────────────
// 3. Conferma Richiesta Demo Ricevuta
// ─────────────────────────────────────────
export function templateRichiestaRicevuta(params: {
  contactName: string;
  orgName: string;
}): string {
  const { contactName, orgName } = params;

  const content = `
    ${heroBand(
      'Richiesta Ricevuta',
      'Grazie,',
      `${contactName}.`,
      'Abbiamo ricevuto la tua richiesta demo. Il nostro team la verificherà a breve.',
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        ${noticeBox(`Il nostro team verificherà la richiesta per <strong style="color:#1D1D1F;">${orgName}</strong> e attiverà l'accesso demo entro <strong style="color:#1D1D1F;">24 ore</strong>. Riceverai un'email con le credenziali di accesso.`, 'success')}
        ${ctaButton('Scopri la piattaforma', SITE_URL)}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, 'Richiesta Demo Ricevuta');
}

// ─────────────────────────────────────────
// 4. Notifica Superadmin — Nuova Richiesta
// ─────────────────────────────────────────
export function templateNotificaAdmin(params: {
  orgName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  city?: string | null;
  province?: string | null;
  vehicleCount?: number | null;
  notes?: string | null;
  dashboardUrl?: string;
}): string {
  const {
    orgName, contactName, contactEmail, contactPhone,
    city, province, vehicleCount, notes,
    dashboardUrl = 'https://soccorsodigitale.app/admin/',
  } = params;

  const location = [city, province].filter(Boolean).join(', ') || '—';

  const rows = [
    { label: 'Organizzazione', value: orgName },
    { label: 'Contatto', value: contactName },
    { label: 'Email', value: contactEmail },
    ...(contactPhone ? [{ label: 'Telefono', value: contactPhone }] : []),
    { label: 'Città', value: location },
    ...(vehicleCount != null ? [{ label: 'Numero mezzi', value: String(vehicleCount) }] : []),
    ...(notes ? [{ label: 'Note', value: notes }] : []),
  ].map(r => detailRow(r.label, r.value)).join('');

  const content = `
    ${heroBand(
      'Nuova Richiesta Demo',
      'Richiede',
      'approvazione.',
      `${orgName} ha richiesto accesso alla piattaforma.`,
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        <div style="font-size:11px;font-weight:700;color:#86868B;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:16px;">Dettagli richiesta</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;border-radius:16px;padding:24px;margin-bottom:32px;border:1px solid #E5E5EA;">
          <tr><td><table width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
        </table>
        ${ctaButton('Gestisci nella Dashboard', dashboardUrl)}
      </td></tr>
    </table>
    ${cardFooter('superadmin@soccorsodigitale.app')}`;

  return emailWrap(content, `Nuova Richiesta — ${orgName}`);
}

// ─────────────────────────────────────────
// 5. Reset Password
// ─────────────────────────────────────────
export function templateResetPassword(params: {
  orgName: string;
  recipientName: string;
  loginEmail: string;
  newPassword: string;
  loginUrl?: string;
}): string {
  const { orgName, recipientName, loginEmail, newPassword, loginUrl = LOGIN_URL } = params;

  const content = `
    ${heroBand(
      'Password Aggiornata',
      'Nuova password',
      'impostata.',
      `${orgName} — accesso piattaforma.`,
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        <p style="font-size:15px;color:#1D1D1F;line-height:1.6;margin:0 0 28px;">
          Ciao <strong>${recipientName}</strong>, la tua password è stata aggiornata.
        </p>
        ${credsBox(loginEmail, newPassword)}
        ${ctaButton('Accedi ora', loginUrl)}
        ${noticeBox(`Se non hai richiesto questa modifica, contatta subito <a href="mailto:info@soccorsodigitale.app" style="color:#2997FF;text-decoration:none;">info@soccorsodigitale.app</a>`, 'warning')}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, `Password Aggiornata — ${orgName}`);
}

// ─────────────────────────────────────────
// 6. Trial Benvenuto
// ─────────────────────────────────────────
export function templateTrialBenvenuto(params: {
  orgName: string;
  adminName: string;
  loginEmail: string;
  password: string;
  trialEndsAt: Date;
  loginUrl?: string;
}): string {
  const { orgName, adminName, loginEmail, password, trialEndsAt, loginUrl = LOGIN_URL } = params;
  const expiry = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(trialEndsAt);

  const content = `
    ${heroBand(
      'Trial Attivato',
      'Benvenuto in',
      'Soccorso Digitale.',
      `${orgName} — il tuo trial è iniziato. Scade il ${expiry}.`,
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        <p style="font-size:15px;color:#1D1D1F;line-height:1.6;margin:0 0 28px;">
          Ciao <strong>${adminName}</strong>, il tuo account trial è pronto. Hai tempo fino al <strong>${expiry}</strong> per esplorare la piattaforma.
        </p>
        ${credsBox(loginEmail, password)}
        ${ctaButton('Accedi al Pannello', loginUrl)}
        ${noticeBox(`Il trial scade il <strong style="color:#1D1D1F;">${expiry}</strong>. Al termine, contattaci per attivare il piano completo.`, 'info')}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, `Trial Attivato — ${orgName}`);
}

// ─────────────────────────────────────────
// 7. Trial in Scadenza
// ─────────────────────────────────────────
export function templateTrialInScadenza(params: {
  orgName: string;
  adminName: string;
  trialEndsAt: Date;
  planName: string;
  upgradeUrl?: string;
}): string {
  const { orgName, adminName, trialEndsAt, planName, upgradeUrl = `${SITE_URL}/#pricing` } = params;
  const expiry = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(trialEndsAt);

  const content = `
    ${heroBand(
      'Trial in Scadenza',
      `${orgName} —`,
      'rinnova ora.',
      `Il tuo trial scade il ${expiry}. Attiva il piano per non perdere i dati.`,
    )}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 44px;">
        <p style="font-size:15px;color:#1D1D1F;line-height:1.6;margin:0 0 28px;">
          Ciao <strong>${adminName}</strong>, il trial di <strong>${orgName}</strong> scade tra 2 giorni. Per continuare ad usare la piattaforma senza interruzioni, attiva il piano <strong>${planName}</strong>.
        </p>
        ${noticeBox(`Trial scade il <strong style="color:#1D1D1F;">${expiry}</strong>. Attiva il piano ora per non perdere i tuoi dati.`, 'warning')}
        ${upgradeBanner()}
        ${ctaButton('Attiva il Piano', upgradeUrl)}
      </td></tr>
    </table>
    ${cardFooter()}`;

  return emailWrap(content, `Trial in Scadenza — ${orgName}`);
}
