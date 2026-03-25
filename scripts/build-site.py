#!/usr/bin/env python3
"""
Builds site/index.html from conicorn/index.html by:
1. Fixing all asset paths (relative → /conicorn/...)
2. Replacing text content with SoccorsoDigitale content
"""

import re
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(BASE, "conicorn", "index.html")
DEST = os.path.join(BASE, "site", "index.html")

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

# ── 1. Fix asset paths ─────────────────────────────────────────────────────
# CSS, JS, images, media, fonts: prefix with /conicorn/
def prefix_asset(m):
    attr = m.group(1)   # href= or src=
    quote = m.group(2)  # " or '
    path = m.group(3)   # the path value
    # Skip absolute URLs and already-prefixed paths
    if path.startswith("http") or path.startswith("/") or path.startswith("#") or path.startswith("data:"):
        return m.group(0)
    return f'{attr}={quote}/conicorn/{path}{quote}'

html = re.sub(r'(href|src)=(["\'])(?!http|/|#|data:)([^"\']+)\2', prefix_asset, html)

# ── 2. Text replacements ───────────────────────────────────────────────────
replacements = [
    # HEAD
    ("<title>Conicorn - Webflow HTML website template</title>",
     "<title>Soccorso Digitale — Piattaforma Gestionale per Organizzazioni di Soccorso</title>"),
    ('content="Conicorns is a modern Webflow template designed for startups to build beautiful websites, manage workflows, and grow their business."',
     'content="Soccorso Digitale è la piattaforma cloud per gestire turni, mezzi, missioni e analytics nelle organizzazioni di emergenza sanitaria."'),
    ('"Conicorn - Webflow HTML website template" property="og:title"',
     '"Soccorso Digitale — Piattaforma Gestionale per Soccorso" property="og:title"'),
    ('"Conicorn - Webflow HTML website template" property="twitter:title"',
     '"Soccorso Digitale — Piattaforma Gestionale per Soccorso" property="twitter:title"'),
    ('"Conicorns is a modern Webflow template designed for startups to build beautiful websites, manage workflows, and grow their business." property="og:description"',
     '"Soccorso Digitale è la piattaforma cloud per gestire turni, mezzi, missioni e analytics nelle organizzazioni di emergenza sanitaria." property="og:description"'),
    ('"Conicorns is a modern Webflow template designed for startups to build beautiful websites, manage workflows, and grow their business." property="twitter:description"',
     '"Soccorso Digitale è la piattaforma cloud per gestire turni, mezzi, missioni e analytics nelle organizzazioni di emergenza sanitaria." property="twitter:description"'),

    # NAVBAR links
    ('>About<', '>Chi Siamo<'),
    ('>Values<', '>Valori<'),
    ('>Services<', '>Servizi<'),
    ('>Process<', '>Come Funziona<'),
    ('>Projects<', '>Case Study<'),
    ('>Integrations<', '>Moduli<'),
    ('>Testimonials<', '>Testimonianze<'),
    ('>Pricing<', '>Prezzi<'),
    ('>Team<', '>Team<'),
    ('>FAQs<', '>FAQ<'),
    ('>Work with Us<', '>Richiedi Demo<'),
    ('>Schedule a Session<', '>Prenota una Demo<'),
    ('>Book a Free Consultation<', '>Inizia Gratis<'),
    ('>Contact Us<', '>Contattaci<'),

    # HERO
    ('Unicorn AI Partner - Intelligent Automation for Modern Teams',
     'Piattaforma SaaS · Settore Emergenza Sanitaria'),
    ('We build AI-powered automation systems that eliminate manual work, reduce costs, and multiply your business performance.',
     'Piattaforma cloud all-in-one per turni, mezzi, missioni e analytics. Progettata per Croce Rossa, ANPAS, AVS e organizzazioni di emergenza sanitaria.'),
    ('>Get Started for Free<', '>Inizia la Prova Gratuita<'),
    ('>Explore our Services<', '>Scopri la Piattaforma<'),
    ('>Get started for free<', '>Inizia la Prova Gratuita<'),
    ('>Explore our services<', '>Scopri la Piattaforma<'),

    # CLIENT LOGOS section
    ('Trusted by 500+ companies', 'Scelto da organizzazioni di soccorso in tutta Italia'),
    ('trusted by 500+ companies', 'Scelto da organizzazioni di soccorso in tutta Italia'),

    # ABOUT (001)
    ('>About Us<', '>Chi Siamo<'),
    ('>About us<', '>Chi Siamo<'),
    ('We helps startups, SMEs &amp; enterprises design and deploy intelligent automation systems that streamline operations and unlock scalable growth.',
     'Soccorso Digitale aiuta associazioni di volontariato, CRI, ANPAS e organizzazioni di emergenza sanitaria a gestire turni, mezzi e missioni con un\'unica piattaforma cloud.'),
    ('500+ saved hours', '500+ Ore Risparmiate'),
    ('saved hours', 'ore risparmiate al mese'),
    ('80% productivity boost', '80% Riduzione Lavoro Manuale'),
    ('productivity boost', 'riduzione lavoro manuale'),
    ('5x faster response', '5x Velocità Coordinamento'),
    ('faster response', 'velocità di coordinamento'),

    # VALUES (002)
    ('>Why Choose Us?<', '>Perché Sceglierci<'),
    ('>Why choose us?<', '>Perché Sceglierci<'),
    ('Business-First AI Strategy',
     'Strategia Operativa Prima di Tutto'),
    ('We design AI strategies around your business goals, not the other way around.',
     'Progettiamo ogni funzione intorno alle esigenze reali delle organizzazioni di soccorso.'),
    ('End-to-End Implementation',
     'Implementazione Completa'),
    ('From workflow design to full deployment, we handle everything so you can focus on growth.',
     'Ti affianchiamo dall\'onboarding all\'operatività piena, con formazione inclusa e migrazione dati.'),
    ('Custom-Built Automation',
     'Automazione Su Misura'),
    ('Every solution is tailored to your unique workflows, tools, and team structure.',
     'Turni automatici, notifiche, report ULSS e integrazioni con sistemi istituzionali già pronti.'),
    ('Your Data. Protected. Always.',
     'I Tuoi Dati. Protetti. Sempre.'),
    ('End-to-End Encryption', 'Crittografia End-to-End'),
    ('Secure API Integrations', 'API Sicure Certificate'),
    ('Role-Based Access Control', 'Controllo Accessi per Ruolo'),
    ('Data Minimization', 'Minimizzazione dei Dati'),

    # CAPABILITIES (003)
    ('>Our AI-Driven Services<', '>La Suite Operativa per il Soccorso<'),
    ('>Our AI-driven services<', '>La Suite Operativa per il Soccorso<'),
    ('AI Workflow Automation', 'Gestione Turni e Reperibilità'),
    ('AI Chatbots &amp; Conversational Agents', 'Tracciamento GPS Mezzi'),
    ('AI Chatbots & Conversational Agents', 'Tracciamento GPS Mezzi'),
    ('AI Data &amp; Reporting Systems', 'Analytics e Report ULSS'),
    ('AI Data & Reporting Systems', 'Analytics e Report ULSS'),
    ('CRM &amp; Sales Automation', 'Gestione Flotta e Manutenzione'),
    ('CRM & Sales Automation', 'Gestione Flotta e Manutenzione'),
    ('Marketing Automation', 'Prenotazioni e Hub Servizi'),

    # PROCESS (004)
    ('>How It Works<', '>Come Funziona<'),
    ('>How it works<', '>Come Funziona<'),
    ('Our Process', 'Il Nostro Processo'),
    ('>Discovery &amp; Audit<', '>Analisi &amp; Onboarding<'),
    ('>Discovery & Audit<', '>Analisi & Onboarding<'),
    ('>Automation Blueprint<', '>Configurazione Piattaforma<'),
    ('>Build &amp; Integration<', '>Build &amp; Integrazione<'),
    ('>Build & Integration<', '>Build & Integrazione<'),
    ('>Testing &amp; Optimization<', '>Test &amp; Ottimizzazione<'),
    ('>Testing & Optimization<', '>Test & Ottimizzazione<'),
    ('>Deployment &amp; Scaling<', '>Deploy &amp; Supporto<'),
    ('>Deployment & Scaling<', '>Deploy & Supporto<'),

    # CASE STUDIES (005)
    ('>Case Studies<', '>Case Study<'),
    ('>Real Results for Real Businesses<', '>Risultati Reali per Organizzazioni Reali<'),
    ('AI Workflow Automation for SaaS Company',
     'Automazione Turni per Associazione CRI'),
    ('+40% Demo Booking', '+40% Efficienza Turni'),
    ('+25% Closing Rate', '−30% Assenze'),
    ('3x Engagement', '3x Velocità Pianificazione'),
    ('AI Project Management Automation for Creative Teams',
     'GPS e Tracciamento per Flotta ANPAS'),
    ('+38% Faster Delivery', '+38% Puntualità'),
    ('-62% Admin Work', '−62% Telefonate Dispatching'),
    ('4x Productivity', '4x Visibilità Operativa'),
    ('AI Property Inquiry Chatbot for Real Estate Firms',
     'Hub Prenotazioni per Servizi Programmati'),
    ('3x Lead Response', '3x Prenotazioni Online'),
    ('+40% Viewing Bookings', '+40% Saturazione Mezzi'),
    ('24/7 Engagement', 'Operativo 24/7'),

    # INTEGRATIONS (006)
    ('>30+ Integrations<', '>30+ Moduli e Integrazioni<'),
    ('>30+ integrations<', '>30+ Moduli e Integrazioni<'),
    ('Everything you need, all in one place.',
     'Tutto ciò che serve, integrato in un\'unica piattaforma.'),

    # TESTIMONIALS (007)
    ('>What Our Clients Say<', '>Cosa Dicono di Noi<'),
    ('>What our clients say<', '>Cosa Dicono di Noi<'),
    ('98% Client retention rate', '97% Tasso di rinnovo contratto'),
    ('client retention rate', 'tasso di rinnovo contratto'),
    # Testimonial names/roles/orgs
    ('David Lee', 'Marco Rossi'),
    ('Atodio Studio', 'Croce Europa Verona'),
    ('Daniel Kim', 'Giulia Ferri'),
    ('ScaleLabs Education', 'ALS Soccorso Milano'),
    ('Alex Johnson', 'Andrea Bianchi'),
    ('Finovate Consulting', 'FVS Volontari Friuli'),
    ('Sarah Mitchell', 'Laura Conti'),
    ('BrightPath SaaS', 'Associazione ANPAS Toscana'),
    ('Jonathan Reed', 'Roberto Mancini'),
    ('Nexora Digital Agency', 'Croce Rossa Padova'),
    ('Michael Tran', 'Silvia Greco'),
    ('Skyline Realty Group', 'Soccorso Alpino Veneto'),
    ('Laura Martinez', 'Federica Russo'),
    ('Elevate Commerce Co.', 'Misericordia Firenze'),

    # PRICING (008)
    ('>Simple, Transparent Pricing<', '>Piani Pensati per Ogni Organizzazione<'),
    ('>Simple, transparent pricing<', '>Piani Pensati per Ogni Organizzazione<'),
    ('No hidden fees. Cancel anytime.',
     '14 giorni di prova gratuita. Nessuna carta di credito richiesta.'),
    ('>Monthly<', '>Mensile<'),
    ('>Annual<', '>Annuale<'),
    ('Save 10%', 'Risparmia 12%'),
    ('>Starter<', '>Starter<'),
    ('$499', '€119'),
    ('$399', '€105'),
    ('>Growth<', '>Professional<'),
    ('Most Popular', 'Più Scelto'),
    ('$1,199', '€249'),
    ('$1,099', '€219'),
    ('>Enterprise<', '>Enterprise<'),
    ('$2,499', 'Su misura'),
    ('$2,199', 'Su misura'),
    ('>Contact Sales<', '>Contattaci<'),
    ('>Contact sales<', '>Contattaci<'),
    # Pricing features Starter
    ('Infinite generation queue', 'Fino a 5 mezzi'),
    ('Commercial usage rights', 'Turni base'),
    ('Standard rendering velocity', 'App mobile'),
    ('4K uncompressed export', 'Supporto community'),
    ('Single user license', 'Export PDF'),
    # Pricing features Growth/Professional
    ('Priority rendering (0.4s latency)', 'Fino a 20 mezzi'),
    ('8K ultra-fidelity export', 'GPS tracking'),
    ('5 team seats', 'Analytics avanzate'),
    ('Private "Stealth Mode" generation', 'Integrazione SUEM 118'),
    ('Priority editorial support', 'Supporto prioritario'),
    # Pricing features Enterprise
    ('Dedicated GPU nodes', 'Mezzi illimitati'),
    ('Custom model fine-tuning', 'Multi-sede'),
    ('API access for deployment', 'API personalizzate'),
    ('Unlimited team seats', 'SLA 99.9%'),
    ('24/7 account manager', 'Account manager dedicato'),
    # CTAs pricing
    ('>Get Started<', '>Inizia Gratis<'),
    ('>Get started<', '>Inizia Gratis<'),

    # TEAM (009)
    ('>Meet Our Team<', '>Le Persone Dietro la Piattaforma<'),
    ('>Meet our team<', '>Le Persone Dietro la Piattaforma<'),
    ('Taylor Jones', 'Adriano Vian'),
    ('Leo Martin', 'Marco Dev'),
    ('Minh Nguyen', 'Elena UX'),
    ('Aisha Rahman', 'Luca Ops'),
    ('Arjun Lim', 'Sara Data'),
    ('>Founder<', '>Founder &amp; CEO<'),
    ('CEO', 'Lead Engineer'),
    ('Design Lead', 'Product Designer'),
    ('Marketing Manager', 'Customer Success'),
    ('Video Editor', 'Data &amp; Analytics'),

    # FAQ (010)
    ('>Frequently Asked Questions<', '>Domande Frequenti<'),
    ('>Frequently asked questions<', '>Domande Frequenti<'),
    ('What industries do you serve?',
     'A quali organizzazioni si rivolge?'),
    ('How long does implementation take?',
     'Quanto tempo richiede l\'implementazione?'),
    ('Do I need technical knowledge?',
     'Serve esperienza tecnica per usarla?'),
    ('How do you ensure data security?',
     'Come vengono protetti i dati sanitari?'),
    ('What ROI can I expect?',
     'Quanto posso aspettarmi di risparmiare?'),
    ('Can you integrate with existing tools?',
     'Posso integrare con i sistemi ULSS/118?'),
    ('Is there an app available?',
     'Esiste un\'app mobile?'),
    ('What kind of support do you offer?',
     'Come funziona il supporto?'),

    # CTA SECTION
    ('Cross the threshold. Enter the fold of uncompromising visionaries.',
     'Pronto a Digitalizzare la Tua Organizzazione?'),
    ('Full name', 'Il tuo nome'),
    ('Business email', 'Email organizzazione'),
    ('>Submit<', '>Prenota una Demo Gratuita<'),
    ('>Send<', '>Prenota una Demo Gratuita<'),
    ('Terms of Service', 'Termini di Servizio'),
    ('Privacy Policy', 'Privacy Policy'),

    # FOOTER
    ('© 2025 Conicorn. All rights reserved.',
     '© 2026 Soccorso Digitale S.r.l. — P.IVA IT04012290237'),
    ('© 2026 Conicorn. All rights reserved.',
     '© 2026 Soccorso Digitale S.r.l. — P.IVA IT04012290237'),
    ('Conicorn. All rights reserved.',
     'Soccorso Digitale S.r.l. — P.IVA IT04012290237'),
    ('We build AI-powered automation that transforms how modern teams operate.',
     'Piattaforma cloud per la gestione operativa delle organizzazioni di soccorso in Italia.'),
    ('Powered by Webflow', ''),
    ('Designed by Vlad', 'Made in Italy'),
    ("Vlad – Templates' Dad", 'Soccorso Digitale'),
]

for old, new in replacements:
    html = html.replace(old, new)

# ── 3. Fix remaining Conicorn references ──────────────────────────────────
extra = [
    ('preload-text">Conicorn</div>',     'preload-text">SD</div>'),
    ('>Try with Conicorn<',              '>Prova Soccorso Digitale<'),
    ("Meet the Conicorn\u2019s Minds",   'Le Persone Dietro la Piattaforma'),
    ("Meet the Conicorn's Minds",        'Le Persone Dietro la Piattaforma'),
    ('(Founder of Conicorn)',            '(Founder di Soccorso Digitale)'),
    ('(Lead Engineer of Conicorn)',      '(Lead Engineer di Soccorso Digitale)'),
    ('(Design Lead of Conicorn)',        '(Product Designer di Soccorso Digitale)'),
    ('(Marketing Manager of Conicorn)',  '(Customer Success di Soccorso Digitale)'),
    ('(Video Editor of Conicorn)',       '(Data & Analytics di Soccorso Digitale)'),
    ('\u00a9 Conicorn 2026',             '\u00a9 2026 Soccorso Digitale'),
    ('© Conicorn 2026',                  '© 2026 Soccorso Digitale'),
]
for old, new in extra:
    html = html.replace(old, new)

# ── 4. Fix integration labels (marquee duplicates 30 items twice) ──────────
SD_MODULES = [
    'SUEM 118', 'GPS Live', 'Turni Auto', 'Analytics', 'Flotta',
    'Inventario', 'Fatturazione', 'SPID/CIE', 'App Mobile', 'Notifiche SMS',
    'SUEM 118', 'GPS Live', 'Turni Auto', 'Analytics', 'Flotta',
    'Inventario', 'Fatturazione', 'SPID/CIE', 'App Mobile', 'Notifiche SMS',
    'Report ULSS', 'Checklist', 'Export PDF', 'Prenotazioni', 'Hub Servizi',
    'Multi-sede', 'API REST', 'FSE', 'Backup Auto', 'Reperibilità',
    'Report ULSS', 'Checklist', 'Export PDF', 'Prenotazioni', 'Hub Servizi',
    'Multi-sede', 'API REST', 'FSE', 'Backup Auto', 'Reperibilità',
    'Dispatching', 'Manutenzione', 'GDPR Auto', 'Missioni', 'Calendario',
    'Firme Digit.', 'WhatsApp', 'Email Auto', 'Accreditamento', 'CIE 3.0',
    'Dispatching', 'Manutenzione', 'GDPR Auto', 'Missioni', 'Calendario',
    'Firme Digit.', 'WhatsApp', 'Email Auto', 'Accreditamento', 'CIE 3.0',
]

import re as _re
_idx = [0]
def _replace_label(m):
    i = _idx[0]
    if i < len(SD_MODULES):
        _idx[0] += 1
        return 'intergration-item-title">' + SD_MODULES[i] + '<'
    return m.group(0)

html = _re.sub(r'intergration-item-title\">[^<]+<', _replace_label, html)

# ── 5. Fix srcset paths (missed by href/src regex) ─────────────────────────
def fix_srcset(m):
    parts = m.group(1).split(',')
    fixed = []
    for part in parts:
        part = part.strip()
        if part and not part.startswith('/') and not part.startswith('http'):
            part = '/conicorn/' + part
        fixed.append(part)
    return 'srcset="' + ', '.join(fixed) + '"'

html = _re.sub(r'srcset="([^"]+)"', fix_srcset, html)

# ── 6. Write output ────────────────────────────────────────────────────────
with open(DEST, "w", encoding="utf-8") as f:
    f.write(html)

print("OK Written: " + DEST)
print("  Size: " + str(os.path.getsize(DEST)) + " bytes")
