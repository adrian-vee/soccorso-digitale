const fs = require('fs');

const CSS = `<style>
.sd-pricing-wrap{max-width:1100px;margin:0 auto;padding:0 1.5rem}
.sd-toggle{display:flex;align-items:center;background:#F1F5F9;border-radius:999px;padding:4px;width:fit-content;margin:2rem auto 3rem;position:relative}
.sd-toggle input[type=radio]{display:none}
.sd-toggle label{padding:9px 22px;border-radius:999px;font-size:13px;font-weight:600;color:#64748B;cursor:pointer;position:relative;z-index:1;transition:color .2s;white-space:nowrap;user-select:none}
.sd-pill{position:absolute;top:4px;left:4px;height:calc(100% - 8px);background:#fff;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.12);transition:transform .25s cubic-bezier(.4,0,.2,1),width .25s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:0}
.sd-lbl-active{color:#0C1A2E !important}
.sd-grid{display:grid;gap:24px;align-items:start;transition:none}
.sd-grid.is-monthly{grid-template-columns:repeat(3,1fr)}
.sd-grid.is-annual{grid-template-columns:1fr 1fr;max-width:860px;margin:0 auto}
.sd-grid.is-annual .sd-card-ent{grid-column:1/3;max-width:420px;margin:0 auto;width:100%}
.sd-badge-off{display:none;background:#DBEAFE;color:#1E3A8A;font-size:1.35rem;font-weight:800;padding:5px 16px;border-radius:999px;letter-spacing:-.01em;line-height:1.2;margin-bottom:4px}
.sd-card{background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:2rem;display:flex;flex-direction:column;gap:1.1rem;position:relative;overflow:hidden}
.sd-card-pro{background:#F8FAFF;border:2px solid #1E3A8A}
.sd-card-pro::before{content:'';position:absolute;width:80px;height:80px;background:radial-gradient(circle,rgba(139,92,246,.5),transparent);border-radius:50%;animation:sd-trail 4s linear infinite;offset-path:rect(0 100% 100% 0 round 20px);pointer-events:none;z-index:0}
@keyframes sd-trail{0%{offset-distance:0%}100%{offset-distance:100%}}
.sd-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sd-icon-base{background:#1A2B32}
.sd-icon-pro{background:linear-gradient(135deg,#C084FC,#818CF8)}
.sd-icon-ent{background:linear-gradient(135deg,#0B2E50,#1E3A8A)}
.sd-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.sd-badge-best{background:#0C1A2E;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.sd-card-title{font-size:1.1rem;font-weight:700;color:#0C1A2E;margin:0}
.sd-card-sub{font-size:.82rem;color:#64748B;margin:3px 0 0}
.sd-price-wrap{border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;padding:.9rem 0}
.sd-price{font-size:2.8rem;font-weight:800;color:#0C1A2E;line-height:1;letter-spacing:-.03em}
.sd-price sup{font-size:1.1rem;font-weight:700;vertical-align:super;letter-spacing:0}
.sd-dec{font-size:1.3rem;font-weight:700;letter-spacing:0}
.sd-per{font-size:.82rem;color:#64748B;margin-top:4px}
.sd-features{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px;flex:1}
.sd-feat{display:flex;align-items:flex-start;gap:8px;font-size:.875rem;color:#0C1A2E;position:relative}
.sd-chk{width:18px;height:18px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sd-chk svg{width:10px;height:10px}
.sd-tip{display:inline-flex;align-items:center;gap:3px;position:relative}
.sd-tip-i{width:14px;height:14px;border-radius:50%;background:#CBD5E1;color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:help;flex-shrink:0}
.sd-tip-b{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#0C1A2E;color:#fff;font-size:.72rem;padding:6px 10px;border-radius:8px;white-space:nowrap;z-index:10;pointer-events:none;line-height:1.4}
.sd-tip:hover .sd-tip-b{display:block}
.sd-cta{display:block;width:100%;background:#0C1A2E;color:#fff;text-align:center;padding:13px;border-radius:12px;font-size:.9rem;font-weight:700;text-decoration:none;transition:opacity .15s;position:relative;z-index:1;box-sizing:border-box}
.sd-cta:hover{opacity:.82}
@media(max-width:900px){.sd-grid.is-monthly,.sd-grid.is-annual{grid-template-columns:1fr;max-width:420px;margin:0 auto}.sd-grid.is-annual .sd-card-ent{grid-column:1}}
@media(max-width:479px){.sd-toggle label{padding:8px 14px;font-size:12px}.sd-price{font-size:2.2rem}}
</style>`;

// Reusable check icon
const chk = `<span class="sd-chk"><svg viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#1E3A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
const tip = (txt, t) => `<span class="sd-tip">${txt}<span class="sd-tip-i">?</span><span class="sd-tip-b">${t}</span></span>`;
const feat = (content) => `<li class="sd-feat">${chk}${content}</li>`;

const cards = `
<!-- BASE -->
<div class="sd-card sd-card-base">
  <span class="sd-badge-off">17% OFF</span>
  <div class="sd-card-head">
    <div class="sd-icon sd-icon-base"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
  </div>
  <div><div class="sd-card-title">Piano Base</div><div class="sd-card-sub">Per associazioni piccole e startup</div></div>
  <div class="sd-price-wrap">
    <div class="sd-price"><sup>€</sup><span class="sd-pm">79<span class="sd-dec">,00</span></span><span class="sd-pa" style="display:none">65<span class="sd-dec">,83</span></span></div>
    <div class="sd-per sd-perm">/mese, fatturato mensilmente</div>
    <div class="sd-per sd-pera" style="display:none">/mese &middot; <strong>€790/anno</strong></div>
  </div>
  <ul class="sd-features">
    ${feat('Turni e missioni illimitati')}
    ${feat('Flotta fino a 3 mezzi')}
    ${feat('App mobile inclusa')}
    ${feat('Dashboard operativa base')}
    ${feat('Supporto email')}
  </ul>
  <a href="/demo" class="sd-cta">Prova 7 Giorni</a>
</div>
<!-- PRO -->
<div class="sd-card sd-card-pro">
  <span class="sd-badge-off">17% OFF</span>
  <div class="sd-card-head">
    <div class="sd-icon sd-icon-pro"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></div>
    <span class="sd-badge-best">&#9733; Pi&ugrave; Scelto</span>
  </div>
  <div><div class="sd-card-title">Piano Pro</div><div class="sd-card-sub">Per cooperative e medie organizzazioni</div></div>
  <div class="sd-price-wrap">
    <div class="sd-price"><sup>€</sup><span class="sd-pm">149<span class="sd-dec">,00</span></span><span class="sd-pa" style="display:none">124<span class="sd-dec">,17</span></span></div>
    <div class="sd-per sd-perm">/mese, fatturato mensilmente</div>
    <div class="sd-per sd-pera" style="display:none">/mese &middot; <strong>€1.490/anno</strong></div>
  </div>
  <ul class="sd-features">
    ${feat('Flotta fino a 10 mezzi')}
    ${feat(tip('UTIF e rimborsi automatici', 'Calcolo automatico UTIF e gestione rimborsi volontari'))}
    ${feat('Analytics e statistiche avanzate')}
    ${feat('SLA monitoring e alert')}
    ${feat('Hub Prenotazioni Pazienti')}
    ${feat('Supporto prioritario')}
  </ul>
  <a href="/demo" class="sd-cta">Prova 7 Giorni</a>
</div>
<!-- ENTERPRISE -->
<div class="sd-card sd-card-ent">
  <span class="sd-badge-off">17% OFF</span>
  <div class="sd-card-head">
    <div class="sd-icon sd-icon-ent"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg></div>
  </div>
  <div><div class="sd-card-title">Piano Enterprise</div><div class="sd-card-sub">Per grandi cooperative e multi-sede</div></div>
  <div class="sd-price-wrap">
    <div class="sd-price"><sup>€</sup><span class="sd-pm">299<span class="sd-dec">,00</span></span><span class="sd-pa" style="display:none">249<span class="sd-dec">,00</span></span></div>
    <div class="sd-per sd-perm">/mese, fatturato mensilmente</div>
    <div class="sd-per sd-pera" style="display:none">/mese &middot; <strong>€2.990/anno</strong></div>
  </div>
  <ul class="sd-features">
    ${feat('Flotta e utenti illimitati')}
    ${feat(tip("Gare d'Appalto Intelligence ANAC", 'Monitoraggio automatico bandi ANAC per il tuo territorio'))}
    ${feat('Analisi economica avanzata + UTIF')}
    ${feat(tip('API access completo + White label', 'API REST completa + brandizzazione personalizzata'))}
    ${feat('SLA 99.9% + Manager account dedicato')}
    ${feat('Integrazione multi-sede')}
  </ul>
  <a href="/demo" class="sd-cta">Prova 7 Giorni</a>
</div>`.replace(/\n\s*/g, '');

const JS = `<script>(function(){
var pill=document.getElementById('sd-pill');
var lm=document.getElementById('sd-lm');
var la=document.getElementById('sd-la');
var im=document.getElementById('sd-im');
var ia=document.getElementById('sd-ia');
var grid=document.getElementById('sd-grid');
function updatePill(){
  var active=im.checked?lm:la;
  pill.style.width=active.offsetWidth+'px';
  pill.style.transform='translateX('+active.offsetLeft+'px)';
  lm.classList.toggle('sd-lbl-active',im.checked);
  la.classList.toggle('sd-lbl-active',ia.checked);
}
function updateGrid(){
  var ann=ia.checked;
  grid.className='sd-grid '+(ann?'is-annual':'is-monthly');
  document.querySelectorAll('.sd-pm').forEach(function(e){e.style.display=ann?'none':'inline'});
  document.querySelectorAll('.sd-pa').forEach(function(e){e.style.display=ann?'inline':'none'});
  document.querySelectorAll('.sd-perm').forEach(function(e){e.style.display=ann?'none':'block'});
  document.querySelectorAll('.sd-pera').forEach(function(e){e.style.display=ann?'block':'none'});
  document.querySelectorAll('.sd-badge-off').forEach(function(e){e.style.display=ann?'inline-block':'none'});
}
var tog=document.getElementById('sd-toggle');
tog.addEventListener('change',function(){updatePill();updateGrid();});
setTimeout(function(){updatePill();updateGrid();},50);
window.addEventListener('resize',updatePill);
})();</script>`;

const newSection =
  `<section id="pricing-section" class="section">${CSS}` +
  `<div class="padding-global"><div class="container-medium"><div class="pricing-layout">` +
  `<div class="heading-layout"><div class="eye-brow"><div class="eye-brow-number">008</div><div class="eye-brow-text-wrap"><div class="eye-brow-dot"></div><div class="eye-brow-text">Prezzi</div></div></div><div class="heading-wrap"><h2 class="heading-style-h2">Il Piano Giusto per la Tua Organizzazione</h2><p class="subheading-text">Scegli il piano adatto alla dimensione della tua sede. Puoi cambiare o disdire quando vuoi.</p></div></div>` +
  `<div class="sd-pricing-wrap">` +
  `<div class="sd-toggle" id="sd-toggle"><input type="radio" name="sd-b" id="sd-im" checked><input type="radio" name="sd-b" id="sd-ia"><div class="sd-pill" id="sd-pill"></div><label for="sd-im" id="sd-lm" class="sd-lbl-active">MENSILE</label><label for="sd-ia" id="sd-la">ANNUALE&nbsp;<span style="font-size:.75em;font-weight:700;color:#1E3A8A">(RISPARMI&nbsp;<strong>17%</strong>)</span></label></div>` +
  `<div class="sd-grid is-monthly" id="sd-grid">${cards}</div>` +
  `</div></div></div></div>${JS}</section>`;

// Read and replace
let html = fs.readFileSync('conicorn/index.html', 'utf8');
const secStart = html.indexOf('<section id="pricing-section"');
const secEnd   = html.indexOf('<section id="team-section"');

if (secStart === -1 || secEnd === -1) {
  console.error('Boundaries not found! secStart:', secStart, 'secEnd:', secEnd);
  process.exit(1);
}

console.log('Old section:', secEnd - secStart, 'chars');
html = html.slice(0, secStart) + newSection + html.slice(secEnd);
console.log('New section:', newSection.length, 'chars');
fs.writeFileSync('conicorn/index.html', html);
console.log('Done.');
