const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'conicorn', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');
const original = html;

function rep(from, to) {
  if (html.indexOf(from) === -1) {
    console.warn('NOT FOUND: ' + from.substring(0, 80));
    return;
  }
  html = html.split(from).join(to);
  console.log('OK: ' + from.substring(0, 60));
}

function repAll(from, to) {
  const count = html.split(from).length - 1;
  if (count === 0) {
    console.warn('NOT FOUND (all): ' + from.substring(0, 80));
    return;
  }
  html = html.split(from).join(to);
  console.log('OK x' + count + ': ' + from.substring(0, 60));
}

// ── Garbled/mixed strings ─────────────────────────────────────────────────────
rep(
  'Prenota una chiamata gratuita di 20 minuti con il nostro team. We\'ll analyze your current Ogni strumento \u00e8 progettato per le esigenze reali delle organizzazioni di soccorso italiane.',
  'Prenota una chiamata gratuita di 20 minuti con il nostro team. Analizzeremo la tua organizzazione e ti mostreremo come Soccorso Digitale pu\u00f2 aiutarti concretamente.'
);

rep(
  'Meet the Il Nostro Team',
  'Il Nostro Team'
);

// ── Case Studies section ──────────────────────────────────────────────────────
rep(
  'What They\'re Saying',
  'Cosa Dicono di Noi'
);

// Testimonials - replace English ones
rep(
  'We\'ve increased enrollment conversion by 35% in just one quarter.',
  'Con Soccorso Digitale abbiamo ridotto il tempo di gestione turni dell\u2019 80%. Ora generiamo il piano mensile in un click.'
);

rep(
  'We struggled with inconsistent lead follow-ups and slow response times. Their AI automation blueprint gave us clarity first, then execution.',
  'Prima passavamo ore a compilare i fogli UTIF a mano. Ora li generiamo automaticamente con un click: dati precisi, zero errori.'
);

rep(
  'Now, our CRM runs intelligently, leads are scored automatically, and follow-ups happen without manual effort. We\'ve increased demo bookings by 40% while reducing operational friction.',
  'La gestione della flotta \u00e8 diventata molto pi\u00f9 semplice. Teniamo traccia dei km, delle revisioni e dei costi per ogni mezzo in tempo reale.'
);

rep(
  'We were scaling fast but drowning in manual workflows. Their automation system connected our CRM, email marketing, and reporting into one intelligent flow.',
  'Il modulo per il calcolo del burnout del personale ci ha permesso di intervenire prima che il problema diventasse critico. Uno strumento indispensabile.'
);

rep(
  'The result? 30+ hours saved per week and complete visibility across our pipeline.',
  'Risparmiamo pi\u00f9 di 30 ore a settimana nella pianificazione. La piattaforma \u00e8 intuitiva anche per i volontari meno esperti di tecnologia.'
);

rep(
  'We reduced admin work by nearly 50% and doubled our qualified appointment bookings. The ROI was faster than we expected \u2014 and the system continues to scale with us.',
  'Abbiamo ridotto il lavoro amministrativo del 50%. Le statistiche sui servizi ci aiutano a capire dove siamo pi\u00f9 efficienti e dove migliorare.'
);

rep(
  'Scaling SaaS Operations with AI Automation',
  'Gestione Operativa con Soccorso Digitale'
);

rep(
  'They unified everything into one intelligent ecosystem. Campaign triggers, abandoned cart flows, segmentation \u2014 all automated with precision.',
  'Prima avevamo dati sparsi tra email, fogli Excel e registri cartacei. Ora tutto \u00e8 in un unico cloud accessibile da smartphone, anche durante un intervento.'
);

// ── Data & Privacy section ────────────────────────────────────────────────────
rep('Your Data. Protected. Always.', 'I Tuoi Dati. Protetti. Sempre.');
rep('Data Minimization', 'Minimizzazione dei Dati');

// ── Features / Value props still in English ──────────────────────────────────
rep(
  '24/7 customer support, lead qualification, booking systems, and AI sales reps.',
  'Turni, missioni e notifiche gestiti automaticamente: zero telefonate di recupero, zero conflitti di orario.'
);
rep(
  'Automated dashboards, business intelligence, performance forecasting.',
  'Dashboard intelligenti, statistiche sui servizi, previsione dei picchi operativi.'
);
rep(
  'Pipeline automation, AI lead scoring, follow-ups, predictive insights.',
  'Automazione dei processi, scoring delle priorit\u00e0, alert automatici e insight predittivi.'
);
rep(
  'Email sequences, personalization engines, AI-generated content systems.',
  'Comunicazioni automatizzate, rendicontazione personalizzata e reportistica generata in automatico.'
);
rep('Not sure what to automate first?', 'Non sai da dove iniziare?');

// ── Read More buttons ─────────────────────────────────────────────────────────
repAll('Read More', 'Scopri di pi\u00f9');

// ── Pricing section ───────────────────────────────────────────────────────────
repAll('What\'s included:', 'Cosa \u00e8 incluso:');
repAll('Workflow setup (1\u20133 systems)', 'Configurazione iniziale guidata');
repAll('Basic AI chatbot', 'Notifiche e alert automatici');
repAll('CRM integration', 'Integrazione app mobile');
repAll('Advanced workflow automation', 'Automazione avanzata dei turni');
repAll('Multi-channel AI chatbot', 'Supporto multi-sede');
repAll('Dashboard & reporting', 'Dashboard e reportistica avanzata');
rep('Book a Free Consultation', 'Prenota una Consulenza Gratuita');

// ── CTA section ───────────────────────────────────────────────────────────────
rep('Your Competitors Are Automating.', 'Il Tuo Quartier Generale Digitale');
rep('Are you?', 'Ti aspetta.');
rep(
  'Stop wasting time on manual processes. Start building a self-running business.',
  'Smetti di perdere ore con fogli Excel e telefonate. Inizia a gestire la tua organizzazione in modo professionale, digitale e senza stress.'
);

// ── Form messages ─────────────────────────────────────────────────────────────
repAll('Thank you!', 'Grazie!');
repAll('Your submission has been received!', 'Abbiamo ricevuto la tua richiesta. Ti contatteremo presto!');
repAll('Oops! Something went wrong while submitting the form.', 'Ops! Qualcosa \u00e8 andato storto. Riprova o scrivici direttamente.');

// ── data-wait ─────────────────────────────────────────────────────────────────
repAll('data-wait="Please wait..."', 'data-wait="Attendere..."');

// ── Footer ────────────────────────────────────────────────────────────────────
rep('| Powered by', '| Sviluppato con');
rep('Designed by NinhStudio', 'Soccorso Digitale S.r.l.');
rep('>License<', '>Licenza<');
// Also handle footer copyright Conicorn reference if present
repAll('Conicorn 2026', 'Soccorso Digitale 2026');
repAll('&copy; Conicorn', '&copy; Soccorso Digitale');

// ── Placeholders ─────────────────────────────────────────────────────────────
repAll('placeholder="Your name*"', 'placeholder="Nome e cognome*"');
repAll('placeholder="Your company name*"', 'placeholder="Nome dell\'associazione*"');
repAll('placeholder="Your business email*"', 'placeholder="Email di lavoro*"');
repAll('placeholder="Message"', 'placeholder="Messaggio"');
repAll('placeholder="Send Your Request!"', 'placeholder="Invia la tua richiesta!"');

// ── Submit button text ────────────────────────────────────────────────────────
repAll('Send Your Request!', 'Invia la Richiesta');
repAll('Schedule a Session', 'Contattaci');
repAll('Book a Free Call', 'Prenota una Chiamata');

// Write output
fs.writeFileSync(filePath, html);
console.log('\nDone. File saved.');
const changed = html.split('').filter((c, i) => c !== original[i]).length;
console.log('Characters changed:', changed);
