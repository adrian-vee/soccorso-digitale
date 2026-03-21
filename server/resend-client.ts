import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
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
    console.log('Getting Resend client for invitation email...');
    const { client, fromEmail } = await getResendClient();
    console.log(`Resend client obtained. From email: ${fromEmail}`);

    const senderEmail = 'Soccorso Digitale <noreply@soccorsodigitale.app>';
    const platformUrl = data.platformUrl || 'https://soccorsodigitale.app/admin/';
    const currentYear = new Date().getFullYear();

    const htmlContent = `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Credenziali di accesso - Soccorso Digitale</title>
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
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f2f5;border-collapse:collapse;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">

<!-- Header with gradient -->
<tr>
<td style="background:linear-gradient(135deg,#0066CC 0%,#004C99 50%,#003A75 100%);padding:40px 32px 32px;text-align:center;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center" style="padding-bottom:18px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="width:68px;height:68px;background-color:rgba(255,255,255,0.15);border-radius:16px;text-align:center;line-height:68px;border:2px solid rgba(255,255,255,0.25);">
<svg width="36" height="36" viewBox="0 0 36 36" style="display:inline-block;vertical-align:middle;" xmlns="http://www.w3.org/2000/svg">
<g fill="none" stroke="#00A651" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<!-- Medical cross -->
<line x1="18" y1="4" x2="18" y2="32"/><line x1="4" y1="18" x2="32" y2="18"/>
<!-- Heart shape integrated with cross -->
<path d="M 18 12 C 14.5 8 10 11 10 15 C 10 20 18 28 18 28 C 18 28 26 20 26 15 C 26 11 21.5 8 18 12" fill="none" stroke="#00A651" stroke-width="1.5"/>
<!-- Heartbeat line -->
<path d="M 8 20 L 10 20 L 12 16 L 14 20 L 16 20 L 18 14 L 20 24 L 22 20 L 28 20" stroke="#00A651" stroke-width="1.5" fill="none"/>
</g>
</svg>
</td></tr></table>
</td></tr>
<tr><td align="center" style="color:#ffffff;font-size:28px;font-weight:700;line-height:1.2;letter-spacing:-0.3px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Soccorso Digitale</td></tr>
<tr><td align="center" style="color:rgba(255,255,255,0.75);font-size:13px;padding-top:8px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Piattaforma di Gestione Operativa</td></tr>
</table>
</td>
</tr>

<!-- Green accent band with organization name -->
<tr>
<td style="background-color:#00A651;padding:16px 32px;text-align:center;">
<span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.5px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">${data.organizationName}</span>
</td>
</tr>

<!-- Body content -->
<tr>
<td style="padding:36px 32px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="color:#1a1a2e;font-size:18px;font-weight:600;padding-bottom:14px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Ciao ${data.recipientName},</td></tr>
<tr><td style="color:#4a4a68;font-size:15px;line-height:1.7;padding-bottom:8px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">sei stato invitato ad accedere alla piattaforma <strong style="color:#0066CC;">Soccorso Digitale</strong> dell'organizzazione <strong>${data.organizationName}</strong>.</td></tr>
<tr><td style="color:#4a4a68;font-size:15px;line-height:1.7;padding-bottom:8px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Ti &egrave; stato assegnato il ruolo di <strong style="color:#00A651;">${data.roleName}</strong>.</td></tr>
<tr><td style="color:#4a4a68;font-size:15px;line-height:1.7;padding-bottom:24px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Di seguito trovi le tue credenziali di accesso.</td></tr>
</table>

<!-- Credentials box -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
<tr>
<td style="background-color:#0066CC;padding:14px 20px;">
<span style="color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Credenziali di Accesso</span>
</td>
</tr>
<tr>
<td style="padding:24px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<!-- Email row -->
<tr>
<td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="110" valign="top" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding-top:3px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Email</td>
<td style="color:#1a1a2e;font-size:15px;font-weight:500;word-break:break-all;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">${data.recipientEmail}</td>
</tr>
</table>
</td>
</tr>
<!-- Password row -->
<tr>
<td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="110" valign="top" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding-top:3px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Password</td>
<td><span style="display:inline-block;color:#1a1a2e;font-size:15px;font-weight:600;font-family:'Courier New',Courier,monospace;background-color:#ffffff;padding:6px 12px;border-radius:6px;border:1px solid #d1d5db;letter-spacing:0.5px;">${data.password}</span></td>
</tr>
</table>
</td>
</tr>
<!-- Role row -->
<tr>
<td style="padding:10px 0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="110" valign="top" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding-top:3px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Ruolo</td>
<td><span style="display:inline-block;background-color:#e0f2fe;color:#0066CC;font-size:13px;font-weight:700;padding:5px 14px;border-radius:20px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">${data.roleName}</span></td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Security notice -->
<tr>
<td style="padding:0 32px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;">
<tr><td style="padding:14px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="24" valign="top" style="color:#4F46E5;font-size:16px;padding-right:10px;font-family:Arial,sans-serif;font-weight:bold;">&#10003;</td>
<td style="color:#3730A3;font-size:13px;line-height:1.6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;"><strong>Per la tua sicurezza,</strong> ti consigliamo di cambiare la password al primo accesso.</td>
</tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- Warning note -->
<tr>
<td style="padding:0 32px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;">
<tr><td style="padding:12px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="24" valign="top" style="color:#EA580C;font-size:16px;padding-right:8px;font-family:Arial,sans-serif;">&#9888;</td>
<td style="color:#9A3412;font-size:13px;line-height:1.5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Tieni al sicuro queste credenziali e non condividerle con altri. Contatta l'amministratore se hai domande.</td>
</tr>
</table>
</td></tr>
</table>
</td>
</tr>

<!-- CTA Button -->
<tr>
<td align="center" style="padding:8px 32px 36px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr>
<td align="center" style="border-radius:8px;background-color:#0066CC;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${platformUrl}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="15%" strokecolor="#0055AA" fillcolor="#0066CC">
<w:anchorlock/>
<center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Accedi alla Piattaforma</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${platformUrl}" target="_blank" style="display:inline-block;background-color:#0066CC;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 56px;border-radius:8px;letter-spacing:0.3px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;mso-hide:all;">Accedi alla Piattaforma</a>
<!--<![endif]-->
</td>
</tr>
</table>
</td>
</tr>

<!-- Divider -->
<tr>
<td style="padding:0 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="border-top:1px solid #e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 32px 20px;text-align:center;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center" style="color:#64748b;font-size:13px;font-weight:600;line-height:1.6;padding-bottom:6px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Soccorso Digitale</td></tr>
<tr><td align="center" style="color:#94a3b8;font-size:12px;line-height:1.6;padding-bottom:6px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Piattaforma SaaS per la gestione operativa dei servizi di trasporto sanitario</td></tr>
<tr><td align="center" style="color:#cbd5e1;font-size:11px;line-height:1.6;padding-bottom:12px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Questa email &egrave; stata inviata automaticamente. Non rispondere a questo messaggio.<br>Se non hai richiesto queste credenziali, contatta l'amministratore della tua organizzazione.</td></tr>
<tr><td align="center" style="color:#cbd5e1;font-size:11px;line-height:1.5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">&copy; ${currentYear} Soccorso Digitale. Tutti i diritti riservati.</td></tr>
</table>
</td>
</tr>

<!-- Bottom blue bar -->
<tr>
<td style="background-color:#0066CC;height:6px;font-size:0;line-height:0;">&nbsp;</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const result = await client.emails.send({
      from: senderEmail,
      to: data.recipientEmail,
      subject: `Credenziali di accesso - ${data.organizationName}`,
      html: htmlContent,
    });

    console.log('Invitation email send result:', JSON.stringify(result));

    if (result.error) {
      console.error('Resend API error sending invitation email:', JSON.stringify(result.error));
      return false;
    }
    console.log('Invitation email sent successfully to:', data.recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Error sending invitation email:', error?.message || error);
    if (error?.statusCode) {
      console.error('Resend status code:', error.statusCode);
    }
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
    const { client } = await getResendClient();
    const senderEmail = 'Soccorso Digitale <noreply@soccorsodigitale.app>';
    const platformUrl = data.platformUrl || 'https://soccorsodigitale.app/admin/';
    const currentYear = new Date().getFullYear();

    const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nuova password - Soccorso Digitale</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f2f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">

<tr>
<td style="background:linear-gradient(135deg,#0066CC 0%,#003A75 100%);padding:32px;text-align:center;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center" style="padding-bottom:12px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="width:56px;height:56px;background-color:rgba(255,255,255,0.2);border-radius:50%;text-align:center;line-height:56px;">
<span style="color:#ffffff;font-size:28px;font-weight:700;">+</span>
</td></tr></table>
</td></tr>
<tr><td align="center" style="color:#ffffff;font-size:24px;font-weight:700;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">Soccorso Digitale</td></tr>
</table>
</td>
</tr>

<tr>
<td style="background-color:#00A651;padding:12px 32px;text-align:center;">
<span style="color:#ffffff;font-size:15px;font-weight:700;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">${data.organizationName}</span>
</td>
</tr>

<tr>
<td style="padding:36px 32px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="color:#1a1a2e;font-size:18px;font-weight:600;padding-bottom:14px;">Ciao ${data.recipientName},</td></tr>
<tr><td style="color:#4a4a68;font-size:15px;line-height:1.7;padding-bottom:24px;">la tua password di accesso alla piattaforma <strong style="color:#0066CC;">Soccorso Digitale</strong> &egrave; stata aggiornata dall'amministratore della tua organizzazione.</td></tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
<tr>
<td style="background-color:#0066CC;padding:12px 20px;">
<span style="color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Nuova Password</span>
</td>
</tr>
<tr>
<td style="padding:20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td style="padding:8px 0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="110" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding-top:3px;">Email</td>
<td style="color:#1a1a2e;font-size:15px;font-weight:500;word-break:break-all;">${data.recipientEmail}</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:8px 0;border-top:1px solid #e2e8f0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>
<td width="110" style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;padding-top:3px;">Password</td>
<td><span style="display:inline-block;color:#1a1a2e;font-size:15px;font-weight:600;font-family:'Courier New',Courier,monospace;background-color:#ffffff;padding:6px 12px;border-radius:6px;border:1px solid #d1d5db;">${data.newPassword}</span></td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding-top:24px;">
<tr><td align="center">
<a href="${platformUrl}" target="_blank" style="display:inline-block;background-color:#0066CC;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 48px;border-radius:8px;">Accedi alla Piattaforma</a>
</td></tr>
</table>
</td>
</tr>

<tr><td style="padding:0 32px;"><table role="presentation" width="100%"><tr><td style="border-top:1px solid #e2e8f0;">&nbsp;</td></tr></table></td></tr>

<tr>
<td style="padding:16px 32px 20px;text-align:center;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td align="center" style="color:#94a3b8;font-size:12px;line-height:1.6;padding-bottom:8px;">Questa email &egrave; stata inviata automaticamente. Non rispondere a questo messaggio.</td></tr>
<tr><td align="center" style="color:#cbd5e1;font-size:11px;">&copy; ${currentYear} Soccorso Digitale. Tutti i diritti riservati.</td></tr>
</table>
</td>
</tr>

<tr><td style="background-color:#0066CC;height:6px;">&nbsp;</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const result = await client.emails.send({
      from: senderEmail,
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
