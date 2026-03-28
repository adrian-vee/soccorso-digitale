// ============================================================
// SOCCORSO DIGITALE — Email Design System v3
// Style: SD Brand — Navy / Teal  (docs/brand/BRAND_GUIDELINES.md)
// Colori: Palette Sito Web (Navy Deep, Teal Dark, Teal Light…)
// Font: system fonts — Gmail/Outlook strippano i web font
// Layout: table-based, CSS inline — compatibilità universale
// ============================================================

// PNG — compatibile con tutti i client email incluso Outlook (SVG non supportato da Outlook)
// logofooter.png = logo bianco per sfondi scuri (header navy)
export const LOGO_URL = 'https://soccorsodigitale.app/images/69b0b9ed30b3db9a0f666b2b_logofooter.png';
export const LOGIN_URL = 'https://soccorsodigitale.app/admin';
export const SITE_URL  = 'https://soccorsodigitale.app';

// Brand colors — docs/brand/BRAND_GUIDELINES.md (Palette Sito Web)
const C = {
  navy:      '#0B2E50',  // Navy Deep     — header, hero bg
  tealDark:  '#1F6583',  // Teal Dark     — CTA button, link, icone
  tealLight: '#5EB0BB',  // Teal Light    — accent, badge, highlight
  sageWhite: '#DFEAE8',  // Sage White    — background pagina esterno
  ink:       '#1A2B32',  // Ink           — testo corpo primario
  sageMuted: '#808976',  // Sage Muted    — testo secondario, label
  stone:     '#C4C8C7',  // Stone         — bordi, separatori
  white:     '#FFFFFF',
  // Semantic (docs/brand/BRAND_GUIDELINES.md — Colori semantici)
  warning:   '#F59E0B',
  success:   '#10B981',
};

const FONT = "Arial, Helvetica, sans-serif";

// ─── Full document wrapper ───────────────────────────────────
export function emailWrap(content: string, preheaderText = 'Soccorso Digitale'): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${preheaderText}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.sageWhite};font-family:${FONT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${C.sageWhite};padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

  <!-- CARD -->
  <tr><td style="background:${C.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(11,46,80,0.08),0 1px 4px rgba(11,46,80,0.04);">
    ${content}
  </td></tr>

  <!-- PAGE FOOTER -->
  <tr><td style="padding:20px 0 0;text-align:center;">
    <div style="font-size:11px;color:${C.sageMuted};line-height:1.6;font-family:${FONT};">Email automatica &middot; Non rispondere a questo messaggio<br>&copy; ${new Date().getFullYear()} Soccorso Digitale &middot; soccorsodigitale.app</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Hero band (navy/teal gradient header) ───────────────────
export function heroBand(badge: string, title: string, titleAccent: string, subtitle: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td style="background:linear-gradient(135deg,${C.navy} 0%,${C.tealDark} 100%);padding:40px 40px 36px;border-radius:12px 12px 0 0;">
      <!-- Logo (PNG per compatibilità Outlook) -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${LOGO_URL}" alt="Soccorso Digitale" height="28" style="display:block;border:0;height:28px;max-height:28px;">
          </td>
        </tr>
      </table>
      <!-- Badge pill -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
        <tr><td style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:5px 12px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="8" style="font-size:0;line-height:0;vertical-align:middle;">
              <div style="width:6px;height:6px;background:${C.tealLight};border-radius:50%;"></div>
            </td>
            <td width="8"></td>
            <td style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.06em;text-transform:uppercase;font-family:${FONT};">${badge}</td>
          </tr></table>
        </td></tr>
      </table>
      <!-- Title -->
      <div style="font-size:28px;font-weight:800;color:${C.white};letter-spacing:-0.02em;line-height:1.2;margin-bottom:10px;font-family:${FONT};">${title} <span style="color:${C.tealLight};">${titleAccent}</span></div>
      <!-- Subtitle -->
      <div style="font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;max-width:420px;font-family:${FONT};">${subtitle}</div>
    </td></tr>
  </table>`;
}

// ─── Credentials box ─────────────────────────────────────────
export function credsBox(email: string, password: string): string {
  return `
  <div style="font-size:11px;font-weight:700;color:${C.sageMuted};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;font-family:${FONT};">Credenziali di accesso</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F4F8F8;border-radius:8px;padding:20px;margin-bottom:28px;border:1px solid ${C.stone};">
    <tr><td>
      <div style="font-size:11px;font-weight:600;color:${C.sageMuted};margin-bottom:6px;font-family:${FONT};">Email</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;">
        <tr><td style="background:${C.white};border:2px solid ${C.tealLight};border-radius:6px;padding:10px 14px;cursor:text;">
          <span style="font-size:14px;color:${C.ink};font-family:'Courier New',Courier,monospace;user-select:all;">${email}</span>
        </td></tr>
      </table>
      <div style="font-size:11px;color:${C.sageMuted};margin-bottom:14px;font-family:${FONT};">Tocca per selezionare e copiare</div>
      <div style="font-size:11px;font-weight:600;color:${C.sageMuted};margin-bottom:6px;font-family:${FONT};">Password temporanea</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;">
        <tr><td style="background:${C.white};border:2px solid ${C.tealLight};border-radius:6px;padding:10px 14px;cursor:text;">
          <span style="font-size:17px;font-weight:700;color:${C.navy};font-family:'Courier New',Courier,monospace;letter-spacing:0.04em;user-select:all;">${password}</span>
        </td></tr>
      </table>
      <div style="font-size:11px;color:${C.sageMuted};font-family:${FONT};">Tocca per selezionare e copiare</div>
    </td></tr>
  </table>`;
}

// ─── CTA button ──────────────────────────────────────────────
export function ctaButton(text: string, url: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;background:${C.tealDark};color:${C.white};text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:6px;text-align:center;font-family:${FONT};">${text} &rarr;</a>
      <div style="font-size:12px;color:${C.sageMuted};margin-top:8px;font-family:${FONT};">${url.replace('https://', '')}</div>
    </td></tr>
  </table>`;
}

// ─── Notice / alert box ──────────────────────────────────────
export function noticeBox(html: string, type: 'info' | 'warning' | 'success' = 'info'): string {
  const colors = {
    info:    { bg: '#EBF4F7', border: C.tealDark, icon: C.tealDark },
    warning: { bg: '#FFFBEB', border: C.warning,  icon: C.warning  },
    success: { bg: '#F0FDF4', border: C.success,  icon: C.success  },
  };
  const c = colors[type];
  const icons = {
    info:    `<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`,
    warning: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    success: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  };
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
    <tr><td style="background:${c.bg};border-radius:0 6px 6px 0;padding:14px 16px;border-left:3px solid ${c.border};">
      <table cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td style="vertical-align:top;padding-right:10px;padding-top:1px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c.icon}" stroke-width="2" stroke-linecap="round">${icons[type]}</svg>
        </td>
        <td style="font-size:13px;color:${C.ink};line-height:1.5;font-family:${FONT};">${html}</td>
      </tr></table>
    </td></tr>
  </table>`;
}

// ─── Upgrade banner ──────────────────────────────────────────
export function upgradeBanner(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;background:${C.sageWhite};border-radius:8px;border:1px solid ${C.stone};">
    <tr><td style="padding:20px 20px 12px;">
      <div style="font-size:15px;font-weight:700;color:${C.navy};margin-bottom:6px;letter-spacing:-0.01em;font-family:${FONT};">Attiva il piano completo</div>
      <div style="font-size:13px;color:${C.sageMuted};line-height:1.5;font-family:${FONT};">Scegli il piano e attiva i moduli che vuoi, in autonomia e in pochi minuti.</div>
    </td></tr>
    <tr><td style="padding:0 20px 20px;">
      <a href="${SITE_URL}/#pricing" style="display:inline-block;background:${C.tealDark};color:${C.white};text-decoration:none;font-size:13px;font-weight:600;padding:10px 22px;border-radius:6px;font-family:${FONT};">Vedi i Piani &rarr;</a>
    </td></tr>
  </table>`;
}

// ─── Modules grid (2-column) ─────────────────────────────────
export function modulesGrid(modules: Array<{ name: string; desc: string }>): string {
  if (!modules.length) return '';
  const cells = modules.map(m => `
    <td width="50%" style="padding:5px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td style="background:${C.white};border-radius:8px;padding:12px 14px;border:1px solid ${C.stone};vertical-align:top;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td style="width:20px;vertical-align:top;padding-right:8px;padding-top:1px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#E4F2F5"/>
                <path d="M8 12l3 3 5-5" stroke="${C.tealDark}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </td>
            <td>
              <div style="font-size:12px;font-weight:700;color:${C.navy};margin-bottom:2px;line-height:1.2;font-family:${FONT};">${m.name}</div>
              <div style="font-size:11px;color:${C.sageMuted};line-height:1.3;font-family:${FONT};">${m.desc}</div>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>`);

  let rows = '';
  for (let i = 0; i < cells.length; i += 2) {
    rows += `<tr>${cells[i]}${cells[i + 1] || '<td width="50%" style="padding:5px;"></td>'}</tr>`;
  }

  return `
  <div style="font-size:11px;font-weight:700;color:${C.sageMuted};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;font-family:${FONT};">Moduli inclusi</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>`;
}

// ─── Card footer ─────────────────────────────────────────────
export function cardFooter(replyTo = 'hello@soccorsodigitale.app'): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${C.stone};background:#F4F8F8;">
    <tr><td style="padding:18px 40px;text-align:center;">
      <span style="font-size:12px;font-weight:700;color:${C.sageMuted};vertical-align:middle;font-family:${FONT};">Soccorso Digitale</span>
      <span style="margin:0 10px;color:${C.stone};vertical-align:middle;">|</span>
      <a href="${SITE_URL}" style="font-size:12px;color:${C.sageMuted};text-decoration:none;vertical-align:middle;font-family:${FONT};">Sito web</a>
      <span style="margin:0 8px;color:${C.stone};vertical-align:middle;">&middot;</span>
      <a href="mailto:${replyTo}" style="font-size:12px;color:${C.sageMuted};text-decoration:none;vertical-align:middle;font-family:${FONT};">Supporto</a>
    </td></tr>
  </table>`;
}

// ─── Detail row (label + value) ──────────────────────────────
export function detailRow(label: string, value: string): string {
  return `
  <tr>
    <td style="font-size:11px;font-weight:700;color:${C.sageMuted};padding:8px 0 4px;text-transform:uppercase;letter-spacing:0.06em;font-family:${FONT};">${label}</td>
  </tr>
  <tr>
    <td style="background:${C.white};border:1px solid ${C.stone};border-radius:6px;padding:10px 14px;">
      <span style="font-size:14px;color:${C.ink};font-family:${FONT};">${value}</span>
    </td>
  </tr>
  <tr><td style="height:10px;"></td></tr>`;
}
