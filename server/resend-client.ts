import { Resend } from 'resend';
import { templateBenvenutoOrg, templateResetPassword } from './utils/email-templates';

// Use verified custom domain if RESEND_FROM_EMAIL is set, otherwise fall back to
// Resend's shared sandbox address (works without domain verification).
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL
  || 'Soccorso Digitale <onboarding@resend.dev>';

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  // Railway / production: use env var directly
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return { apiKey, fromEmail: FROM_EMAIL };
  }

  // Replit legacy: fetch from connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (hostname && xReplitToken) {
    const data = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken,
        },
      }
    ).then((res) => res.json()).then((d) => d.items?.[0]);

    if (data?.settings?.api_key) {
      return {
        apiKey: data.settings.api_key,
        fromEmail: data.settings.from_email || FROM_EMAIL,
      };
    }
  }

  throw new Error('RESEND_API_KEY not configured — email sending is unavailable');
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail,
  };
}

interface ConfidentialityEmailData {
  recipientEmail: string;
  firstName: string;
  lastName: string;
  staffType: string;
  role: string | null;
  signatureTimestamp: Date;
  documentId: string;
}

const COMPANY_ADDRESS = "Via Forte Garofolo 20, 37057 San Giovanni Lupatoto (VR)";

function getStaffTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    volontario: 'Volontario',
    dipendente: 'Dipendente', 
    collaboratore: 'Collaboratore'
  };
  return labels[type] || type;
}

function getRoleLabel(role: string | null): string {
  if (!role) return 'Non specificata';
  const labels: Record<string, string> = {
    autista: 'Autista',
    soccorritore: 'Soccorritore',
    infermiere: 'Infermiere',
    altro: 'Altro'
  };
  return labels[role] || role;
}

export async function sendConfidentialityConfirmationEmail(data: ConfidentialityEmailData): Promise<boolean> {
  try {
    console.log('Getting Resend client...');
    const { client, fromEmail } = await getResendClient();
    console.log(`Resend client obtained. From email: ${fromEmail}`);
    
    const formattedDate = data.signatureTimestamp.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long', 
      year: 'numeric'
    });
    const formattedTime = data.signatureTimestamp.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conferma Impegno alla Riservatezza</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0066CC 0%, #003D7A 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">SOCCORSO DIGITALE</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Impresa Sociale - Servizi di Trasporto Sanitario</p>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 11px;">${COMPANY_ADDRESS}</p>
            </td>
          </tr>
          
          <!-- Red accent -->
          <tr>
            <td style="background-color: #C41E3A; height: 4px;"></td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Success icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #ECFDF5; border-radius: 50%; line-height: 64px;">
                  <span style="color: #10B981; font-size: 32px;">✓</span>
                </div>
              </div>
              
              <h2 style="margin: 0 0 16px; color: #1F2937; font-size: 20px; text-align: center;">
                Impegno alla Riservatezza Firmato
              </h2>
              
              <p style="margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.6; text-align: center;">
                Gentile <strong>${data.firstName} ${data.lastName}</strong>,<br>
                confermiamo la corretta ricezione del tuo impegno alla riservatezza.
              </p>
              
              <!-- Details box -->
              <table role="presentation" style="width: 100%; background-color: #F9FAFB; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase;">Tipologia</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${getStaffTypeLabel(data.staffType)}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase;">Mansione</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${getRoleLabel(data.role)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 8px 0;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase;">Data e Ora Firma</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600;">${formattedDate} alle ${formattedTime}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Important notice -->
              <div style="background-color: #EBF5FF; border-left: 4px solid #0066CC; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #0066CC; font-size: 13px; font-weight: 600;">Cosa significa?</p>
                <p style="margin: 8px 0 0; color: #374151; font-size: 13px; line-height: 1.5;">
                  Ti sei impegnato/a a mantenere la riservatezza su tutti i dati personali e sensibili dei pazienti che tratterai durante la tua attività con Soccorso Digitale, in conformità al GDPR.
                </p>
              </div>
              
              <!-- Document ID -->
              <p style="margin: 0; color: #9CA3AF; font-size: 11px; text-align: center;">
                ID Documento: ${data.documentId}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: #374151; font-size: 13px; font-weight: 600;">Soccorso Digitale - Piattaforma Gestione Trasporti</p>
                    <p style="margin: 0 0 4px; color: #6B7280; font-size: 12px;">${COMPANY_ADDRESS}</p>
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">
                      <a href="mailto:supporto@croceeuropa.com" style="color: #0066CC; text-decoration: none;">supporto@croceeuropa.com</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Blue bottom bar -->
          <tr>
            <td style="background-color: #0066CC; height: 8px;"></td>
          </tr>
          
        </table>
        
        <!-- Disclaimer -->
        <p style="max-width: 600px; margin: 16px auto 0; color: #9CA3AF; font-size: 11px; text-align: center; line-height: 1.5;">
          Questa email è stata inviata automaticamente in seguito alla firma dell'impegno alla riservatezza. 
          Non rispondere a questa email. Per assistenza contattaci a supporto@croceeuropa.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textContent = `
SOCCORSO DIGITALE - Piattaforma Gestione Trasporti
Conferma Impegno alla Riservatezza

Gentile ${data.firstName} ${data.lastName},

Confermiamo la corretta ricezione del tuo impegno alla riservatezza.

DETTAGLI:
- Tipologia: ${getStaffTypeLabel(data.staffType)}
- Mansione: ${getRoleLabel(data.role)}
- Data firma: ${formattedDate} alle ${formattedTime}
- ID Documento: ${data.documentId}

Ti sei impegnato/a a mantenere la riservatezza su tutti i dati personali e sensibili dei pazienti che tratterai durante la tua attività con Soccorso Digitale, in conformità al GDPR.

---
Soccorso Digitale - Piattaforma Gestione Trasporti
${COMPANY_ADDRESS}
supporto@croceeuropa.com

Questa email è stata inviata automaticamente. Non rispondere a questa email.
`;

    // Use the configured fromEmail or default to privacy@croceeuropa.com
    const senderEmail = fromEmail || 'Soccorso Digitale <noreply@soccorsodigitale.app>';

    const result = await client.emails.send({
      from: senderEmail,
      to: data.recipientEmail,
      subject: `Conferma Impegno alla Riservatezza - Soccorso Digitale`,
      html: htmlContent,
      text: textContent,
    });

    console.log('Confidentiality confirmation email sent:', result);
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending confidentiality confirmation email:', error);
    return false;
  }
}

interface SignatureRequestEmailData {
  recipientEmail: string;
  volunteerName: string;
  organizationName: string;
  documentTitle: string;
  signingUrl: string;
  expiresAt: Date;
}

export async function sendSignatureRequestEmail(data: SignatureRequestEmailData): Promise<boolean> {
  try {
    console.log('Getting Resend client for signature request...');
    const { client, fromEmail } = await getResendClient();
    console.log(`Resend client obtained. From email: ${fromEmail}`);

    const formattedExpiry = data.expiresAt.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const formattedExpiryTime = data.expiresAt.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Richiesta Firma Documento</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #00A651; padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${data.organizationName.toUpperCase()}</h1>
            </td>
          </tr>
          
          <!-- Green accent line -->
          <tr>
            <td style="background-color: #006B33; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <h2 style="margin: 0 0 20px; color: #1F2937; font-size: 20px; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                Richiesta di Firma Documento
              </h2>
              
              <p style="margin: 0 0 16px; color: #4B5563; font-size: 15px; line-height: 1.6; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                Gentile <strong>${data.volunteerName}</strong>,<br>
                l'organizzazione <strong>${data.organizationName}</strong> ti ha richiesto di firmare il seguente documento.
              </p>
              
              <p style="margin: 0 0 28px; color: #6B7280; font-size: 14px; line-height: 1.7; text-align: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                Il documento riguarda la tua iscrizione al Registro dei Volontari dell'organizzazione, ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017). Ti chiediamo di leggere attentamente il contenuto e apporre la tua firma digitale cliccando sul pulsante sottostante.
              </p>
              
              <!-- Document details box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Documento</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${data.documentTitle}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #E5E7EB;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Organizzazione</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${data.organizationName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #E5E7EB;">
                          <span style="color: #6B7280; font-size: 12px; text-transform: uppercase; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Destinatario</span><br>
                          <span style="color: #1F2937; font-size: 14px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${data.volunteerName}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button - Outlook compatible -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${data.signingUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="17%" strokecolor="#008C44" fillcolor="#00A651">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Firma il Documento</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${data.signingUrl}" style="display: inline-block; background-color: #00A651; color: #ffffff; text-decoration: none; padding: 14px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; mso-hide: all;">
                      Firma il Documento
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              
              <!-- Expiry notice -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td style="background-color: #FFF7ED; border-left: 4px solid #F59E0B; padding: 16px;">
                    <p style="margin: 0; color: #B45309; font-size: 13px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Attenzione: Scadenza</p>
                    <p style="margin: 8px 0 0; color: #374151; font-size: 13px; line-height: 1.5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                      Il link per la firma scadra il <strong>${formattedExpiry}</strong> alle <strong>${formattedExpiryTime}</strong>. 
                      Ti preghiamo di procedere alla firma entro tale data.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="margin: 0; color: #9CA3AF; font-size: 11px; text-align: center; line-height: 1.5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                Se il pulsante non funziona, copia e incolla questo link nel tuo browser:<br>
                <a href="${data.signingUrl}" style="color: #00A651; word-break: break-all;">${data.signingUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px; color: #374151; font-size: 13px; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${data.organizationName}</p>
                    <p style="margin: 0 0 8px; color: #6B7280; font-size: 11px; line-height: 1.5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                      Questa email contiene informazioni riservate destinate esclusivamente al destinatario indicato. Se hai ricevuto questa email per errore, ti preghiamo di cancellarla immediatamente e di non divulgarne il contenuto. Non condividere il link di firma con terze parti.
                    </p>
                    <p style="margin: 0; color: #9CA3AF; font-size: 11px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                      Questa email e stata inviata automaticamente. Non rispondere a questa email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Green bottom bar -->
          <tr>
            <td style="background-color: #00A651; height: 8px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const textContent = `
${data.organizationName.toUpperCase()}
Richiesta di Firma Documento

Gentile ${data.volunteerName},

L'organizzazione ${data.organizationName} ti ha richiesto di firmare il seguente documento.

Il documento riguarda la tua iscrizione al Registro dei Volontari dell'organizzazione, ai sensi dell'Art. 17 del Codice del Terzo Settore (D.Lgs. 117/2017). Ti chiediamo di leggere attentamente il contenuto e apporre la tua firma digitale.

DETTAGLI:
- Documento: ${data.documentTitle}
- Organizzazione: ${data.organizationName}

Per firmare il documento, visita il seguente link:
${data.signingUrl}

ATTENZIONE: Il link per la firma scadrà il ${formattedExpiry} alle ${formattedExpiryTime}. Ti preghiamo di procedere alla firma entro tale data.

---
${data.organizationName}

Questa email contiene informazioni riservate destinate esclusivamente al destinatario indicato. Se hai ricevuto questa email per errore, ti preghiamo di cancellarla immediatamente e di non divulgarne il contenuto. Non condividere il link di firma con terze parti.

Questa email e stata inviata automaticamente. Non rispondere a questa email.
`;

    const senderEmail = 'Soccorso Digitale <noreply@soccorsodigitale.app>';
    const subject = `Richiesta Firma Documento - ${data.organizationName}`;

    const result = await client.emails.send({
      from: senderEmail,
      to: data.recipientEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    console.log('Signature request email sent:', result);

    if (result.error) {
      console.error('Resend error:', result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending signature request email:', error);
    return false;
  }
}

interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  password: string;
  roleName: string;
  platformUrl?: string;
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const htmlContent = templateBenvenutoOrg({
      orgName: data.organizationName,
      recipientName: data.recipientName,
      loginEmail: data.recipientEmail,
      password: data.password,
      roleName: data.roleName,
      loginUrl: data.platformUrl,
    });
    const result = await client.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: `Credenziali di accesso - ${data.organizationName}`,
      html: htmlContent,
    });
    if (result.error) {
      console.error('Resend API error sending invitation email:', JSON.stringify(result.error));
      return false;
    }
    console.log('Invitation email sent successfully to:', data.recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Error sending invitation email:', error?.message || error);
    return false;
  }
}

export interface PasswordResetEmailData {
  recipientEmail: string;
  recipientName: string;
  organizationName: string;
  newPassword: string;
  platformUrl?: string;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();
    const htmlContent = templateResetPassword({
      orgName: data.organizationName,
      recipientName: data.recipientName,
      loginEmail: data.recipientEmail,
      newPassword: data.newPassword,
      loginUrl: data.platformUrl,
    });
    const result = await client.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: `Nuova password - ${data.organizationName}`,
      html: htmlContent,
    });
    if (result.error) {
      console.error('Error sending password reset email:', JSON.stringify(result.error));
      return false;
    }
    console.log('Password reset email sent to:', data.recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Error sending password reset email:', error?.message);
    return false;
  }
}
