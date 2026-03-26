// ============================================================
// SOCCORSO DIGITALE — Email Design System
// Stile: Apple-inspired, light, professional
// ============================================================

export const EMAIL_FONTS = `font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;`;
export const EMAIL_MONO  = `font-family:'SF Mono','Fira Code','Courier New',monospace;`;

// ─── Header logo pill ────────────────────────────────────────
export function emailHeader(): string {
  return `
  <tr>
    <td align="center" style="padding:0 0 24px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#1E3A8A;border-radius:12px;padding:10px 18px;">
            <span style="font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.08em;${EMAIL_FONTS}">SOCCORSO DIGITALE</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── Top bar blu con titolo ───────────────────────────────────
export function emailTopBar(label: string, title: string, subtitle?: string): string {
  return `
  <tr>
    <td style="background:#1E3A8A;border-radius:16px 16px 0 0;padding:28px 40px 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#93C5FD;letter-spacing:0.1em;text-transform:uppercase;${EMAIL_FONTS}">${label}</p>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.2;${EMAIL_FONTS}">${title}</h1>
      ${subtitle ? `<p style="margin:6px 0 0;font-size:13px;color:#BFDBFE;line-height:1.5;${EMAIL_FONTS}">${subtitle}</p>` : ''}
    </td>
  </tr>`;
}

// ─── Box singola credenziale ──────────────────────────────────
export function emailCredentialBox(label: string, value: string, highlight = false): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td>
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;${EMAIL_FONTS}">${label}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#FFFFFF;border:${highlight ? '1.5px solid #1E3A8A' : '1px solid #E2E8F0'};border-radius:10px;padding:12px 16px;">
              <p style="margin:0;font-size:${highlight ? '17px' : '14px'};font-weight:${highlight ? '700' : '500'};color:${highlight ? '#1E3A8A' : '#0F172A'};${EMAIL_MONO}">${value}</p>
            </td>
          </tr>
        </table>
        ${highlight ? `<p style="margin:4px 0 0;font-size:10px;color:#94A3B8;${EMAIL_FONTS}">Tieni premuto per selezionare e copiare</p>` : ''}
      </td>
    </tr>
  </table>`;
}

// ─── Alert box ───────────────────────────────────────────────
export function emailAlertBox(text: string, type: 'warning' | 'info' | 'success' = 'info'): string {
  const colors = {
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1e40af' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
  };
  const c = colors[type];
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:${c.text};line-height:1.5;${EMAIL_FONTS}">${text}</p>
      </td>
    </tr>
  </table>`;
}

// ─── CTA button ──────────────────────────────────────────────
export function emailCTA(text: string, url: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td align="center">
        <a href="${url}" style="display:inline-block;background:#1E3A8A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:14px 36px;border-radius:10px;letter-spacing:0.01em;${EMAIL_FONTS}">${text}</a>
        <p style="margin:6px 0 0;font-size:11px;color:#94A3B8;${EMAIL_FONTS}">${url}</p>
      </td>
    </tr>
  </table>`;
}

// ─── Lista moduli ─────────────────────────────────────────────
export function emailModuleList(modules: Array<{ name: string; desc: string }>): string {
  if (!modules.length) return '';
  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#0F172A;${EMAIL_FONTS}">Moduli inclusi</p>
        ${modules.map(m => `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
          <tr>
            <td style="background:#F8FAFC;border-radius:8px;padding:10px 14px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:22px;vertical-align:middle;padding-right:10px;">
                    <table cellpadding="0" cellspacing="0"><tr>
                      <td style="width:16px;height:16px;background:#DCFCE7;border-radius:50%;text-align:center;line-height:16px;">
                        <span style="font-size:9px;color:#16A34A;font-weight:700;">&#10003;</span>
                      </td>
                    </tr></table>
                  </td>
                  <td>
                    <p style="margin:0;font-size:12px;font-weight:600;color:#0F172A;${EMAIL_FONTS}">${m.name}</p>
                    <p style="margin:1px 0 0;font-size:11px;color:#64748B;${EMAIL_FONTS}">${m.desc}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`).join('')}
      </td>
    </tr>
  </table>`;
}

// ─── Row dettaglio (label/value) ──────────────────────────────
export function emailDetailRow(label: string, value: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
    <tr>
      <td style="background:#F8FAFC;border-radius:8px;padding:10px 14px;">
        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#94A3B8;letter-spacing:0.08em;text-transform:uppercase;${EMAIL_FONTS}">${label}</p>
        <p style="margin:0;font-size:13px;color:#0F172A;${EMAIL_FONTS}">${value}</p>
      </td>
    </tr>
  </table>`;
}

// ─── Divisore ─────────────────────────────────────────────────
export function emailDivider(): string {
  return `
  <tr>
    <td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="border-top:1px solid #E2E8F0;font-size:0;line-height:0;">&nbsp;</td>
      </tr></table>
    </td>
  </tr>`;
}

// ─── Footer con link aiuto ────────────────────────────────────
export function emailFooter(replyTo = 'info@soccorsodigitale.app'): string {
  return `
  <tr>
    <td style="padding:20px 40px 28px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#64748B;${EMAIL_FONTS}">
        Hai bisogno di aiuto? Scrivi a
        <a href="mailto:${replyTo}" style="color:#1E3A8A;text-decoration:none;font-weight:500;">${replyTo}</a>
      </p>
    </td>
  </tr>`;
}

// ─── Footer pagina (fuori card) ───────────────────────────────
export function emailPageFooter(): string {
  return `
  <tr>
    <td style="padding:24px 0 0;text-align:center;">
      <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#1E3A8A;letter-spacing:0.04em;${EMAIL_FONTS}">SOCCORSO DIGITALE</p>
      <p style="margin:0 0 2px;font-size:11px;color:#94A3B8;${EMAIL_FONTS}">Piattaforma di Gestione Trasporti Sanitari</p>
      <a href="https://soccorsodigitale.app" style="font-size:11px;color:#CBD5E1;text-decoration:none;${EMAIL_FONTS}">soccorsodigitale.app</a>
      <p style="margin:10px 0 0;font-size:10px;color:#CBD5E1;${EMAIL_FONTS}">Email automatica &middot; Non rispondere &middot; &copy; ${new Date().getFullYear()} Soccorso Digitale</p>
    </td>
  </tr>`;
}

// ─── Wrapper principale ───────────────────────────────────────
export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background:#F5F5F7;${EMAIL_FONTS}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:32px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          ${emailHeader()}
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${content}
              </table>
            </td>
          </tr>
          ${emailPageFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
