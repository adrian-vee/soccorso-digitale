import {
  emailWrapper, emailTopBar, emailCredentialBox, emailAlertBox,
  emailCTA, emailModuleList, emailDetailRow, emailDivider,
  emailFooter, EMAIL_FONTS,
} from './email-design-system';

// ── Tipi ──────────────────────────────────────────────────────

export interface EmailModule { name: string; desc: string; }

// ── Moduli base (mostrati nelle email demo/benvenuto) ─────────
export const DEFAULT_EMAIL_MODULES: EmailModule[] = [
  { name: 'Gestione Servizi',     desc: 'Pianifica e monitora ogni trasporto' },
  { name: 'Flotta Veicoli',       desc: 'Gestione mezzi e documenti' },
  { name: 'Anagrafica Personale', desc: 'Gestione volontari e operatori' },
  { name: 'Pianificazione Turni', desc: 'Turni e disponibilità' },
  { name: 'Consegne Digitali',    desc: 'Passaggio consegne tra equipaggi' },
  { name: 'Registro Sanificazioni', desc: 'Log pulizia post-servizio' },
  { name: 'Benessere Staff',      desc: 'Prevenzione burnout equipaggi' },
  { name: 'Registro Volontari',   desc: 'Anagrafica e certificazioni Art. 17 CTS' },
];

// ─────────────────────────────────────────────────────────────
// 1. CREDENZIALI DEMO
// ─────────────────────────────────────────────────────────────

export function templateCredenzialiDemo(params: {
  orgName: string;
  loginEmail: string;
  password: string;
  expiresAt: Date;
  loginUrl?: string;
  modules?: EmailModule[];
}): string {
  const { orgName, loginEmail, password, expiresAt, loginUrl = 'https://soccorsodigitale.app/admin/', modules = DEFAULT_EMAIL_MODULES } = params;

  const expiry = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(expiresAt);

  const content = `
    ${emailTopBar('Accesso Demo Attivato', `Benvenuto, ${orgName}`, 'Il tuo accesso demo è pronto. Esplora tutte le funzionalità della piattaforma.')}
    <tr><td style="padding:28px 40px;">

      <!-- Credenziali -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td>
          <p style="margin:0 0 16px;font-size:10px;font-weight:700;color:#94A3B8;letter-spacing:0.1em;text-transform:uppercase;${EMAIL_FONTS}">Credenziali di accesso</p>
          ${emailCredentialBox('Email', loginEmail)}
          ${emailCredentialBox('Password temporanea', password, true)}
        </td></tr>
      </table>

      ${emailCTA('Accedi al Pannello →', loginUrl)}
      ${emailAlertBox(`<strong>Scadenza demo:</strong> ${expiry}<br>Contattaci per estendere o attivare il piano completo.`, 'warning')}
      ${emailModuleList(modules)}

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 2. BENVENUTO ORG / INVITO UTENTE
// ─────────────────────────────────────────────────────────────

export function templateBenvenutoOrg(params: {
  orgName: string;
  recipientName: string;
  loginEmail: string;
  password: string;
  roleName?: string;
  loginUrl?: string;
  modules?: EmailModule[];
}): string {
  const { orgName, recipientName, loginEmail, password, roleName, loginUrl = 'https://soccorsodigitale.app/admin/', modules } = params;

  const content = `
    ${emailTopBar('Account Attivato', 'Benvenuto in Soccorso Digitale', `${orgName} è ora attiva sulla piattaforma.`)}
    <tr><td style="padding:28px 40px;">

      <p style="margin:0 0 20px;font-size:14px;color:#0F172A;line-height:1.6;${EMAIL_FONTS}">
        Ciao <strong>${recipientName}</strong>,<br>
        ${roleName ? `il tuo account <strong>${roleName}</strong> è pronto` : 'il tuo account è pronto'}. Usa le credenziali qui sotto per accedere.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td>
          ${emailCredentialBox('Email', loginEmail)}
          ${emailCredentialBox('Password', password, true)}
        </td></tr>
      </table>

      ${emailCTA('Accedi ora →', loginUrl)}
      ${modules ? emailModuleList(modules) : ''}

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 3. RESET PASSWORD
// ─────────────────────────────────────────────────────────────

export function templateResetPassword(params: {
  orgName: string;
  recipientName: string;
  loginEmail: string;
  newPassword: string;
  loginUrl?: string;
}): string {
  const { orgName, recipientName, loginEmail, newPassword, loginUrl = 'https://soccorsodigitale.app/admin/' } = params;

  const content = `
    ${emailTopBar('Password Aggiornata', 'Nuova password impostata', `${orgName} — accesso piattaforma.`)}
    <tr><td style="padding:28px 40px;">

      <p style="margin:0 0 20px;font-size:14px;color:#0F172A;line-height:1.6;${EMAIL_FONTS}">
        Ciao <strong>${recipientName}</strong>,<br>
        la tua password è stata aggiornata. Usa le credenziali qui sotto per accedere.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td>
          ${emailCredentialBox('Email', loginEmail)}
          ${emailCredentialBox('Nuova password', newPassword, true)}
        </td></tr>
      </table>

      ${emailCTA('Accedi ora →', loginUrl)}
      ${emailAlertBox('Se non hai richiesto questa modifica, contatta subito <a href="mailto:info@soccorsodigitale.app" style="color:#1e40af;">info@soccorsodigitale.app</a>', 'warning')}

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 4. RICHIESTA DEMO RICEVUTA (al richiedente)
// ─────────────────────────────────────────────────────────────

export function templateRichiestaRicevuta(params: {
  contactName: string;
  orgName: string;
}): string {
  const { contactName, orgName } = params;

  const content = `
    ${emailTopBar('Richiesta Ricevuta', 'Grazie per il tuo interesse', 'Ti risponderemo entro 24 ore lavorative.')}
    <tr><td style="padding:28px 40px;">

      <p style="margin:0 0 20px;font-size:14px;color:#0F172A;line-height:1.6;${EMAIL_FONTS}">
        Ciao <strong>${contactName}</strong>,<br>
        abbiamo ricevuto la richiesta demo per <strong>${orgName}</strong>.
      </p>

      ${emailAlertBox('Il nostro team verificherà la tua richiesta e attiverà l\'accesso demo entro <strong>24 ore</strong>. Riceverai una seconda email con le credenziali di accesso.', 'info')}

      <!-- Cosa succede ora -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#0F172A;${EMAIL_FONTS}">Cosa succede ora</p>

          ${[
    ['1', 'Il team verifica la tua richiesta e predispone l\'ambiente demo'],
    ['2', 'Ricevi via email le credenziali di accesso con i moduli attivati'],
    ['3', 'Esplori la piattaforma liberamente per 24 ore'],
  ].map(([n, text]) => `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr>
              <td style="background:#F8FAFC;border-radius:8px;padding:10px 14px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:22px;vertical-align:top;padding-right:10px;padding-top:1px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:18px;height:18px;background:#1E3A8A;border-radius:50%;text-align:center;line-height:18px;">
                        <span style="font-size:10px;color:#FFFFFF;font-weight:700;">${n}</span>
                      </td>
                    </tr></table>
                  </td>
                  <td><p style="margin:0;font-size:13px;color:#0F172A;${EMAIL_FONTS}">${text}</p></td>
                </tr></table>
              </td>
            </tr>
          </table>`).join('')}

        </td></tr>
      </table>

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 5. NOTIFICA SUPERADMIN — nuova richiesta demo
// ─────────────────────────────────────────────────────────────

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

  const content = `
    ${emailTopBar('Nuova Richiesta Demo', orgName, 'Richiede approvazione nella dashboard.')}
    <tr><td style="padding:28px 40px;">

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td>
          <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:#94A3B8;letter-spacing:0.1em;text-transform:uppercase;${EMAIL_FONTS}">Dettagli richiesta</p>
          ${emailDetailRow('Organizzazione', orgName)}
          ${emailDetailRow('Contatto', contactName)}
          ${emailDetailRow('Email', contactEmail)}
          ${contactPhone ? emailDetailRow('Telefono', contactPhone) : ''}
          ${emailDetailRow('Città', location)}
          ${vehicleCount != null ? emailDetailRow('Numero mezzi', String(vehicleCount)) : ''}
          ${notes ? emailDetailRow('Note', notes) : ''}
        </td></tr>
      </table>

      ${emailCTA('Gestisci nella Dashboard →', dashboardUrl)}

    </td></tr>
    ${emailDivider()}
    ${emailFooter('superadmin@soccorsodigitale.app')}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 6. TRIAL BENVENUTO (SaaS onboarding)
// ─────────────────────────────────────────────────────────────

export function templateTrialBenvenuto(params: {
  orgName: string;
  adminName: string;
  loginEmail: string;
  password: string;
  trialEndsAt: Date;
  loginUrl?: string;
}): string {
  const { orgName, adminName, loginEmail, password, trialEndsAt, loginUrl = 'https://soccorsodigitale.app/admin/' } = params;

  const expiry = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(trialEndsAt);

  const content = `
    ${emailTopBar('Trial Attivato', `Benvenuto in Soccorso Digitale`, `${orgName} — il tuo trial di 30 giorni è iniziato.`)}
    <tr><td style="padding:28px 40px;">

      <p style="margin:0 0 20px;font-size:14px;color:#0F172A;line-height:1.6;${EMAIL_FONTS}">
        Ciao <strong>${adminName}</strong>,<br>
        il tuo account trial è pronto. Hai tempo fino al <strong>${expiry}</strong> per esplorare la piattaforma.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;margin-bottom:20px;">
        <tr><td>
          ${emailCredentialBox('Email', loginEmail)}
          ${emailCredentialBox('Password', password, true)}
        </td></tr>
      </table>

      ${emailCTA('Accedi al Pannello →', loginUrl)}
      ${emailAlertBox(`Il trial scade il <strong>${expiry}</strong>. Al termine, contattaci per attivare il piano completo.`, 'info')}

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}

// ─────────────────────────────────────────────────────────────
// 7. TRIAL IN SCADENZA
// ─────────────────────────────────────────────────────────────

export function templateTrialInScadenza(params: {
  orgName: string;
  adminName: string;
  trialEndsAt: Date;
  planName: string;
  upgradeUrl?: string;
}): string {
  const { orgName, adminName, trialEndsAt, planName, upgradeUrl = 'https://soccorsodigitale.app/admin/' } = params;
  const expiry = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(trialEndsAt);

  const content = `
    ${emailTopBar('Trial in Scadenza', `${orgName}`, `Il tuo trial scade il ${expiry}.`)}
    <tr><td style="padding:28px 40px;">

      <p style="margin:0 0 20px;font-size:14px;color:#0F172A;line-height:1.6;${EMAIL_FONTS}">
        Ciao <strong>${adminName}</strong>,<br>
        il trial di <strong>${orgName}</strong> scade tra 2 giorni. Per continuare a usare la piattaforma senza interruzioni, attiva il piano <strong>${planName}</strong>.
      </p>

      ${emailAlertBox(`Trial scade il <strong>${expiry}</strong>. Attiva il piano ora per non perdere i tuoi dati.`, 'warning')}
      ${emailCTA('Attiva il piano →', upgradeUrl)}

    </td></tr>
    ${emailDivider()}
    ${emailFooter()}`;

  return emailWrapper(content);
}
