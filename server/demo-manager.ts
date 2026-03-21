import { db } from "./db";
import { organizations, users } from "@shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { getResendClient } from "./resend-client";
import crypto from "node:crypto";

const ALL_MODULES = [
  'report_accise',
  'carbon_footprint',
  'esg_dashboard',
  'analisi_economica',
  'gps_tracking',
  'checklist',
  'consegne_digitali',
  'registro_sanificazioni',
  'pianificazione_turni',
  'rimborsi_volontari',
  'benessere_staff',
  'governance_compliance',
  'partner_program',
  'registro_volontari_elettronico',
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function createDemoAccount(requestEmail: string, requestName: string, companyName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db.select().from(organizations)
      .where(and(
        eq(organizations.isDemo, true),
        eq(organizations.demoEmail, requestEmail)
      ));

    if (existing.length > 0) {
      const activeDemo = existing.find(org => org.demoExpiresAt && new Date(org.demoExpiresAt) > new Date());
      if (activeDemo) {
        return { success: false, error: 'Hai già una demo attiva. Controlla la tua email per le credenziali.' };
      }
    }

    const demoId = `demo-${Date.now()}`;
    const demoSuffix = demoId.slice(-6);
    const baseOrgName = companyName || `Demo ${requestName}`;
    const orgName = `${baseOrgName} (Demo ${demoSuffix})`;
    const slug = generateSlug(baseOrgName) + '-' + demoSuffix;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const password = generatePassword();
    const loginEmail = `d${Date.now().toString(36)}@sd.demo`;

    const [org] = await db.insert(organizations).values({
      name: orgName,
      slug: slug,
      status: 'trial',
      isDemo: true,
      demoExpiresAt: expiresAt,
      demoEmail: requestEmail,
      enabledModules: ALL_MODULES,
      maxVehicles: 3,
      maxUsers: 5,
      notes: `Demo automatica richiesta da ${requestName} (${requestEmail})`,
    }).returning();

    await db.insert(users).values({
      email: loginEmail,
      password: password,
      name: requestName,
      role: 'org_admin',
      organizationId: org.id,
      accountType: 'person',
    });

    const displayOrgName = baseOrgName;
    const emailSent = await sendDemoCredentialsEmail({
      recipientEmail: requestEmail,
      recipientName: requestName,
      loginEmail: loginEmail,
      password: password,
      expiresAt: expiresAt,
      orgName: displayOrgName,
    });

    if (!emailSent) {
      console.error('[DEMO] Email send failed, but account was created');
      return {
        success: true,
        emailFailed: true,
        credentials: { loginEmail, password, orgName: displayOrgName, expiresAt: expiresAt.toISOString() }
      };
    }

    console.log(`[DEMO] Demo account created for ${requestEmail}: org=${org.id}, login=${loginEmail}, expires=${expiresAt.toISOString()}`);

    return { success: true };
  } catch (error: any) {
    console.error('[DEMO] Error creating demo account:', error);
    return { success: false, error: 'Errore durante la creazione della demo. Riprova più tardi.' };
  }
}

export async function isDemoExpired(organizationId: string): Promise<boolean> {
  const [org] = await db.select().from(organizations)
    .where(and(
      eq(organizations.id, organizationId),
      eq(organizations.isDemo, true)
    ));

  if (!org) return false;
  if (!org.demoExpiresAt) return false;
  return new Date(org.demoExpiresAt) < new Date();
}

export async function cleanupExpiredDemos(): Promise<number> {
  try {
    const expiredOrgs = await db.select().from(organizations)
      .where(and(
        eq(organizations.isDemo, true),
        lt(organizations.demoExpiresAt!, new Date(Date.now() - 48 * 60 * 60 * 1000))
      ));

    let cleaned = 0;
    for (const org of expiredOrgs) {
      await db.delete(users).where(eq(users.organizationId, org.id));
      await db.delete(organizations).where(eq(organizations.id, org.id));
      cleaned++;
      console.log(`[DEMO] Cleaned up expired demo org: ${org.id} (${org.name})`);
    }

    return cleaned;
  } catch (error) {
    console.error('[DEMO] Error cleaning up expired demos:', error);
    return 0;
  }
}

interface DemoEmailData {
  recipientEmail: string;
  recipientName: string;
  loginEmail: string;
  password: string;
  expiresAt: Date;
  orgName: string;
}

async function sendDemoCredentialsEmail(data: DemoEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const expiresFormatted = data.expiresAt.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Rome',
    });

    const adminUrl = 'https://soccorsodigitale.app/admin/';

    const modulesList = [
      { name: 'Gestione Flotta', desc: 'Veicoli, sedi, personale' },
      { name: 'Report UTIF', desc: 'Compliance accise carburante' },
      { name: 'Analisi Economica', desc: 'Statistiche e costi operativi' },
      { name: 'ESG Dashboard', desc: 'Sostenibilit&agrave; e impatto sociale' },
      { name: 'Carbon Footprint', desc: 'Monitoraggio emissioni CO2' },
      { name: 'GPS Tracking', desc: 'Tracciamento flotta in tempo reale' },
      { name: 'Checklist Operative', desc: 'Controlli pre-servizio digitali' },
      { name: 'Consegne Digitali', desc: 'Passaggio consegne tra equipaggi' },
      { name: 'Registro Sanificazioni', desc: 'Log pulizia post-servizio' },
      { name: 'Pianificazione Turni', desc: 'Gestione turni del personale' },
      { name: 'Rimborsi Volontari', desc: 'Gestione rimborsi e spese' },
      { name: 'Benessere Staff', desc: 'Prevenzione burnout equipaggi' },
      { name: 'Governance &amp; Compliance', desc: 'Audit trail e conformit&agrave;' },
      { name: 'Registro Volontari Elettronico', desc: 'Art. 17 CTS con firma HMAC-SHA256' },
    ];

    const modulesHtml = modulesList.map(m => `
                          <tr>
                            <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td style="width: 24px; vertical-align: top; padding-top: 2px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                      <tr>
                                        <td style="width: 20px; height: 20px; background-color: #ECFDF5; border-radius: 50%; text-align: center; vertical-align: middle;">
                                          <span style="color: #00A651; font-size: 12px; line-height: 20px;">&#10003;</span>
                                        </td>
                                      </tr>
                                    </table>
                                  </td>
                                  <td style="padding-left: 10px;">
                                    <p style="margin: 0; color: #111827; font-size: 13px; font-weight: 600; line-height: 1.3;">${m.name}</p>
                                    <p style="margin: 2px 0 0; color: #9CA3AF; font-size: 11px; line-height: 1.3;">${m.desc}</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>`).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Credenziali Demo - SOCCORSO DIGITALE</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    body, table, td, p, a, span { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .header-pad { padding: 36px 20px 28px !important; }
      .credential-val { font-size: 14px !important; }
      .cta-td { padding-left: 20px !important; padding-right: 20px !important; }
      .footer-pad { padding: 24px 20px !important; }
      .module-cell { padding: 8px 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9;">
    <tr>
      <td style="padding: 24px 12px;">

        <table role="presentation" class="email-container" width="560" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto; max-width: 560px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(155deg, #003d7a 0%, #0066CC 50%, #0077E6 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="header-pad" style="padding: 44px 40px 36px; text-align: center;">
                    <!-- Logo SVG inline -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                      <tr>
                        <td style="width: 56px; height: 56px; text-align: center; vertical-align: middle;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" style="width:56px;height:56px;" arcsize="25%" fillcolor="#ffffff" stroke="f">
                            <v:fill type="solid" color="#ffffff"/>
                            <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                          <![endif]-->
                          <div style="width: 56px; height: 56px; background: #ffffff; border-radius: 14px; display: inline-block; text-align: center; line-height: 56px;">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="36" height="36" style="vertical-align: middle;">
                              <rect x="35" y="15" width="30" height="70" rx="4" fill="#0066CC"/>
                              <rect x="15" y="35" width="70" height="30" rx="4" fill="#0066CC"/>
                              <path d="M 20 75 Q 50 55 80 75" stroke="#00A651" stroke-width="8" fill="none" stroke-linecap="round"/>
                            </svg>
                          </div>
                          <!--[if mso]>
                            </v:textbox>
                          </v:roundrect>
                          <![endif]-->
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 0 0 4px; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; line-height: 1.3;">SOCCORSO DIGITALE</h1>
                    <p style="margin: 0; color: rgba(255,255,255,0.65); font-size: 12px; font-weight: 500; letter-spacing: 0.3px;">Piattaforma di Gestione Trasporti Sanitari</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- GREEN ACCENT -->
          <tr>
            <td style="background: linear-gradient(90deg, #00A651, #00C853, #00A651); height: 3px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- MAIN CONTENT -->
          <tr>
            <td style="background-color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                <!-- Welcome -->
                <tr>
                  <td class="content-pad" style="padding: 36px 40px 4px; text-align: center;">
                    <h2 style="margin: 0 0 8px; color: #111827; font-size: 22px; font-weight: 800; line-height: 1.3;">La tua Demo &egrave; pronta</h2>
                    <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.7;">
                      Ciao <strong style="color: #111827;">${data.recipientName}</strong>,<br>
                      ecco le credenziali per accedere alla piattaforma con tutti i <strong style="color: #00A651;">13 moduli premium</strong> attivi.
                    </p>
                  </td>
                </tr>

                <!-- Credentials Card -->
                <tr>
                  <td class="content-pad" style="padding: 24px 40px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden;">

                      <!-- Card Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, #0066CC, #004FA3); padding: 12px 20px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="vertical-align: middle;">
                                <p style="margin: 0; color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.8px;">CREDENZIALI DI ACCESSO</p>
                              </td>
                              <td style="text-align: right; vertical-align: middle;">
                                <span style="color: rgba(255,255,255,0.6); font-size: 11px;">${data.orgName}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Email -->
                      <tr>
                        <td style="padding: 20px 20px 0; background-color: #f8fafc;">
                          <p style="margin: 0 0 6px; color: #6B7280; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;">Email</p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background-color: #ffffff; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 12px 14px;">
                                <p class="credential-val" style="margin: 0; color: #111827; font-size: 15px; font-weight: 600; font-family: 'SF Mono', 'Fira Code', 'Roboto Mono', 'Courier New', monospace; line-height: 1.4; word-break: break-all; -webkit-user-select: all; user-select: all;">
                                  ${data.loginEmail}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Password -->
                      <tr>
                        <td style="padding: 14px 20px 0; background-color: #f8fafc;">
                          <p style="margin: 0 0 6px; color: #6B7280; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;">Password</p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="background-color: #ffffff; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 12px 14px;">
                                <p class="credential-val" style="margin: 0; color: #111827; font-size: 17px; font-weight: 700; font-family: 'SF Mono', 'Fira Code', 'Roboto Mono', 'Courier New', monospace; letter-spacing: 1.5px; line-height: 1.4; -webkit-user-select: all; user-select: all;">
                                  ${data.password}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Copy hint -->
                      <tr>
                        <td style="padding: 10px 20px 16px; background-color: #f8fafc; text-align: center;">
                          <p style="margin: 0; color: #9CA3AF; font-size: 11px; line-height: 1.4;">
                            Tieni premuto sul testo per selezionare e copiare
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td class="cta-td" style="padding: 24px 40px 0; text-align: center;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #00A651, #008C44); border-radius: 10px; text-align: center;">
                          <a href="${adminUrl}" target="_blank" style="display: block; padding: 15px 24px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; line-height: 1.2;">
                            Accedi al Pannello di Controllo &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 8px 0 0; color: #9CA3AF; font-size: 11px;">soccorsodigitale.app/admin/</p>
                  </td>
                </tr>

                <!-- Expiration Notice -->
                <tr>
                  <td class="content-pad" style="padding: 24px 40px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FFFBEB; border-radius: 10px; border: 1px solid #FDE68A;">
                      <tr>
                        <td style="padding: 14px 16px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="vertical-align: top;">
                                <p style="margin: 0 0 2px; color: #92400E; font-size: 12px; font-weight: 700;">Scadenza Demo</p>
                                <p style="margin: 0; color: #78350F; font-size: 12px; line-height: 1.5;">
                                  La demo scade il <strong>${expiresFormatted}</strong>.<br>Tutti i 13 moduli premium sono attivi.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Modules Section -->
                <tr>
                  <td class="content-pad" style="padding: 24px 40px 0;">
                    <p style="margin: 0 0 12px; color: #111827; font-size: 14px; font-weight: 700; text-align: center;">Moduli inclusi nella tua demo</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                      ${modulesHtml}
                    </table>
                  </td>
                </tr>

                <!-- Help -->
                <tr>
                  <td class="content-pad" style="padding: 24px 40px 32px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 10px;">
                      <tr>
                        <td style="padding: 16px 20px; text-align: center;">
                          <p style="margin: 0 0 4px; color: #374151; font-size: 13px; font-weight: 600;">Hai bisogno di aiuto?</p>
                          <p style="margin: 0; color: #6B7280; font-size: 12px; line-height: 1.5;">
                            Rispondi direttamente a questa email e ti assisteremo.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- FOOTER - Branding colors -->
          <tr>
            <td style="background: linear-gradient(155deg, #003d7a 0%, #0066CC 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="footer-pad" style="padding: 24px 40px; text-align: center;">
                    <p style="margin: 0 0 4px; color: #ffffff; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">SOCCORSO DIGITALE</p>
                    <p style="margin: 0 0 10px; color: rgba(255,255,255,0.5); font-size: 11px;">Piattaforma di Gestione Trasporti Sanitari</p>
                    <a href="https://soccorsodigitale.app" style="color: rgba(255,255,255,0.6); text-decoration: none; font-size: 11px;">soccorsodigitale.app</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Legal -->
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="margin: 12px auto 0; max-width: 560px;">
          <tr>
            <td style="text-align: center; padding: 0 16px;">
              <p style="margin: 0; color: #9CA3AF; font-size: 10px; line-height: 1.6;">
                Email inviata automaticamente in seguito alla tua richiesta di demo.<br>
                &copy; ${new Date().getFullYear()} SOCCORSO DIGITALE. Tutti i diritti riservati.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textContent = `
SOCCORSO DIGITALE - Credenziali Demo

Ciao ${data.recipientName},

Ecco le credenziali per accedere alla piattaforma:

Organizzazione: ${data.orgName}
Email di accesso: ${data.loginEmail}
Password: ${data.password}

Accedi al pannello di controllo: ${adminUrl}

IMPORTANTE: La demo scade il ${expiresFormatted} (24 ore).
Tutti i 13 moduli premium sono attivi.

Moduli inclusi:
- Gestione Flotta
- Report UTIF
- Analisi Economica
- ESG Dashboard
- Carbon Footprint
- GPS Tracking
- Checklist Operative
- Consegne Digitali
- Registro Sanificazioni
- Pianificazione Turni
- Rimborsi Volontari
- Benessere Staff
- Governance & Compliance

---
SOCCORSO DIGITALE
Piattaforma di Gestione Trasporti Sanitari
soccorsodigitale.app
`;

    const senders = [
      'noreply@soccorsodigitale.app',
      fromEmail,
      'onboarding@resend.dev',
    ].filter(Boolean) as string[];
    const uniqueSenders = [...new Set(senders)];

    for (const sender of uniqueSenders) {
      const formatted = sender.includes('<') ? sender : `SOCCORSO DIGITALE <${sender}>`;
      console.log(`[DEMO] Trying to send email from: ${formatted} to: ${data.recipientEmail}`);

      const result = await client.emails.send({
        from: formatted,
        to: data.recipientEmail,
        subject: `Le tue credenziali demo - SOCCORSO DIGITALE`,
        html: htmlContent,
        text: textContent,
      });

      if (result.error) {
        console.warn(`[DEMO] Resend error with ${sender}:`, result.error);
        if ((result.error as any).statusCode === 403 && uniqueSenders.indexOf(sender) < uniqueSenders.length - 1) {
          console.log('[DEMO] Retrying with fallback sender...');
          continue;
        }
        return false;
      }

      console.log('[DEMO] Credentials email sent to:', data.recipientEmail);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[DEMO] Error sending demo email:', error);
    return false;
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startDemoCleanupScheduler() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(async () => {
    const cleaned = await cleanupExpiredDemos();
    if (cleaned > 0) {
      console.log(`[DEMO] Scheduled cleanup removed ${cleaned} expired demo(s)`);
    }
  }, 60 * 60 * 1000);
  console.log('[DEMO] Cleanup scheduler started (every hour)');
}
