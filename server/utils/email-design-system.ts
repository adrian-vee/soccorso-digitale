// ============================================================
// SOCCORSO DIGITALE — Email Design System v2
// Style: Midnight Tech (approvato da Adrian)
// ============================================================

export const LOGO_URL = 'https://soccorsodigitale.app/images/69b0dc9033646175674e6d28_logoicon.svg';
export const LOGIN_URL = 'https://soccorsodigitale.app/admin';
export const SITE_URL  = 'https://soccorsodigitale.app';

// ─── Full document wrapper ───────────────────────────────────
export function emailWrap(content: string, preheaderText = 'Soccorso Digitale'): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${preheaderText}</title>
</head>
<body style="margin:0;padding:0;background-color:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2F7;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- PRE-HEADER LOGO -->
  <tr><td align="center" style="padding:0 0 24px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;padding-right:8px;">
        <img src="${LOGO_URL}" alt="Soccorso Digitale" width="18" height="18" style="display:block;opacity:0.5;filter:grayscale(100%);">
      </td>
      <td style="font-size:11px;font-weight:600;color:#86868B;letter-spacing:0.08em;text-transform:uppercase;vertical-align:middle;">Soccorso Digitale</td>
    </tr></table>
  </td></tr>

  <!-- CARD -->
  <tr><td style="background:#FFFFFF;border-radius:28px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.04),0 1px 3px rgba(0,0,0,0.02);">
    ${content}
  </td></tr>

  <!-- PAGE FOOTER -->
  <tr><td style="padding:20px 0 0;text-align:center;">
    <div style="font-size:11px;color:#AEAEB2;line-height:1.6;">Email automatica &middot; Non rispondere a questo messaggio<br>&copy; ${new Date().getFullYear()} Soccorso Digitale &middot; soccorsodigitale.app</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Hero band (dark header) ─────────────────────────────────
export function heroBand(badge: string, title: string, titleAccent: string, subtitle: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:linear-gradient(145deg,#000000 0%,#1A1A24 100%);padding:48px 44px 40px;border-radius:28px 28px 0 0;">
      <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${LOGO_URL}" alt="Soccorso Digitale" width="26" height="26" style="display:block;filter:brightness(0) invert(1);opacity:0.95;">
          </td>
          <td style="font-size:14px;font-weight:700;color:#FFFFFF;letter-spacing:0.03em;vertical-align:middle;">Soccorso Digitale</td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr><td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:30px;padding:6px 14px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:6px;height:6px;background:#32D74B;border-radius:50%;vertical-align:middle;padding-right:8px;"></td>
            <td style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.9);letter-spacing:0.05em;text-transform:uppercase;">${badge}</td>
          </tr></table>
        </td></tr>
      </table>
      <div style="font-size:30px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;line-height:1.15;margin-bottom:12px;">${title}<br><span style="color:#2997FF;">${titleAccent}</span></div>
      <div style="font-size:15px;color:#A1A1A6;line-height:1.5;max-width:420px;">${subtitle}</div>
    </td></tr>
  </table>`;
}

// ─── Credentials box ─────────────────────────────────────────
export function credsBox(email: string, password: string): string {
  return `
  <div style="font-size:11px;font-weight:700;color:#86868B;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:16px;">Credenziali di accesso</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;border-radius:16px;padding:24px;margin-bottom:32px;border:1px solid #E5E5EA;">
    <tr><td>
      <div style="font-size:11px;font-weight:600;color:#86868B;margin-bottom:6px;">Email</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr><td style="background:#FFFFFF;border:1px solid #D1D1D6;border-radius:10px;padding:12px 16px;">
          <span style="font-size:14px;color:#1D1D1F;font-family:'SF Mono','Roboto Mono',monospace;">${email}</span>
        </td></tr>
      </table>
      <div style="font-size:11px;font-weight:600;color:#86868B;margin-bottom:6px;">Password temporanea</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
        <tr><td style="background:#FFFFFF;border:1px solid #D1D1D6;border-radius:10px;padding:12px 16px;">
          <span style="font-size:18px;font-weight:700;color:#000000;font-family:'SF Mono','Roboto Mono',monospace;letter-spacing:0.05em;">${password}</span>
        </td></tr>
      </table>
      <div style="font-size:11px;color:#86868B;">Tieni premuto per selezionare e copiare</div>
    </td></tr>
  </table>`;
}

// ─── CTA button ──────────────────────────────────────────────
export function ctaButton(text: string, url: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr><td align="center">
      <a href="${url}" style="display:block;background:#000000;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:16px 40px;border-radius:14px;text-align:center;">${text} &rarr;</a>
      <div style="font-size:12px;color:#86868B;margin-top:10px;">${url.replace('https://', '')}</div>
    </td></tr>
  </table>`;
}

// ─── Notice / alert box ──────────────────────────────────────
export function noticeBox(html: string, type: 'info' | 'warning' | 'success' = 'info'): string {
  const colors = {
    info:    { bg: 'rgba(41,151,255,0.05)',  border: 'rgba(41,151,255,0.15)', icon: '#2997FF' },
    warning: { bg: 'rgba(255,159,10,0.05)',  border: 'rgba(255,159,10,0.2)',  icon: '#FF9F0A' },
    success: { bg: 'rgba(50,215,75,0.05)',   border: 'rgba(50,215,75,0.2)',   icon: '#32D74B' },
  };
  const c = colors[type];
  const icons = {
    info:    `<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`,
    warning: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    success: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  };
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr><td style="background:${c.bg};border-radius:12px;padding:16px;border:1px solid ${c.border};">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;padding-right:12px;padding-top:2px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c.icon}" stroke-width="1.5" stroke-linecap="round">${icons[type]}</svg>
        </td>
        <td style="font-size:13px;color:#333336;line-height:1.5;">${html}</td>
      </tr></table>
    </td></tr>
  </table>`;
}

// ─── Upgrade banner ──────────────────────────────────────────
export function upgradeBanner(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background:#F5F5F7;border-radius:16px;border:1px solid #E5E5EA;">
    <tr><td style="padding:24px 24px 16px;">
      <div style="font-size:15px;font-weight:700;color:#1D1D1F;margin-bottom:6px;letter-spacing:-0.01em;">Attiva il piano completo</div>
      <div style="font-size:13px;color:#86868B;line-height:1.5;">Scegli il piano e attiva i moduli che vuoi, in autonomia e in pochi minuti.</div>
    </td></tr>
    <tr><td style="padding:0 24px 24px;">
      <a href="${SITE_URL}/#pricing" style="display:inline-block;background:#000000;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:20px;">Vedi i Piani &rarr;</a>
    </td></tr>
  </table>`;
}

// ─── Modules grid (2-column) ─────────────────────────────────
export function modulesGrid(modules: Array<{ name: string; desc: string }>): string {
  if (!modules.length) return '';
  const cells = modules.map(m => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="background:#FFFFFF;border-radius:12px;padding:14px 16px;border:1px solid #E5E5EA;min-height:72px;vertical-align:top;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:22px;vertical-align:top;padding-right:10px;padding-top:2px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#EBF5FF"/>
                <path d="M8 12l3 3 5-5" stroke="#2997FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </td>
            <td>
              <div style="font-size:13px;font-weight:600;color:#1D1D1F;margin-bottom:3px;line-height:1.2;">${m.name}</div>
              <div style="font-size:11px;color:#86868B;line-height:1.3;">${m.desc}</div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>`);

  let rows = '';
  for (let i = 0; i < cells.length; i += 2) {
    rows += `<tr>${cells[i]}${cells[i + 1] || '<td width="50%" style="padding:6px;"></td>'}</tr>`;
  }

  return `
  <div style="font-size:11px;font-weight:700;color:#86868B;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:16px;">Moduli inclusi</div>
  <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

// ─── Card footer ─────────────────────────────────────────────
export function cardFooter(replyTo = 'info@soccorsodigitale.app'): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5E5EA;background:#FAFAFC;">
    <tr><td style="padding:20px 44px;text-align:center;">
      <img src="${LOGO_URL}" alt="" width="16" height="16" style="display:inline-block;filter:grayscale(100%);opacity:0.4;vertical-align:middle;margin-right:6px;">
      <span style="font-size:12px;font-weight:600;color:#86868B;vertical-align:middle;">Soccorso Digitale</span>
      <span style="margin:0 12px;color:#E5E5EA;vertical-align:middle;">|</span>
      <a href="${SITE_URL}" style="font-size:12px;color:#86868B;text-decoration:none;vertical-align:middle;">Sito web</a>
      <span style="margin:0 8px;color:#E5E5EA;vertical-align:middle;">·</span>
      <a href="mailto:${replyTo}" style="font-size:12px;color:#86868B;text-decoration:none;vertical-align:middle;">Supporto</a>
    </td></tr>
    <tr><td style="padding:0 44px 20px;text-align:center;">
      <div style="font-size:11px;color:#AEAEB2;line-height:1.6;">Email automatica · Non rispondere · &copy; 2026 Soccorso Digitale</div>
    </td></tr>
  </table>`;
}

// ─── Detail row (label + value) ──────────────────────────────
export function detailRow(label: string, value: string): string {
  return `
  <tr>
    <td style="font-size:11px;font-weight:600;color:#86868B;padding:8px 0 4px;text-transform:uppercase;letter-spacing:0.06em;">${label}</td>
  </tr>
  <tr>
    <td style="background:#FFFFFF;border:1px solid #D1D1D6;border-radius:10px;padding:12px 16px;">
      <span style="font-size:14px;color:#1D1D1F;">${value}</span>
    </td>
  </tr>
  <tr><td style="height:12px;"></td></tr>`;
}
