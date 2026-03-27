/**
 * Crea le tabelle CRM nel database Railway.
 * Esegui con: railway run node scripts/crm-setup-db.js
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL mancante. Esegui con: railway run node scripts/crm-setup-db.js');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL?.includes('railway.internal')
  ? 'postgresql://postgres:oQbQTHEtQdNxfcSrNiyQjfNvwvZWaSJo@caboose.proxy.rlwy.net:28423/railway'
  : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creazione tabelle CRM...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'altro',
        region VARCHAR(50),
        province VARCHAR(5),
        city VARCHAR(100),
        address TEXT,
        email VARCHAR(255),
        email_secondary VARCHAR(255),
        phone VARCHAR(30),
        website VARCHAR(500),
        pec VARCHAR(255),
        codice_fiscale VARCHAR(16),
        source VARCHAR(50) DEFAULT 'manual',
        source_url TEXT,
        email_verified BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'new',
        num_ambulances INTEGER,
        num_volunteers INTEGER,
        conv_118 BOOLEAN,
        notes TEXT,
        tags TEXT[],
        last_contacted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ crm_organizations');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT,
        category VARCHAR(50) DEFAULT 'custom',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ crm_email_templates');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        template_id UUID REFERENCES crm_email_templates(id),
        status VARCHAR(50) DEFAULT 'draft',
        send_method VARCHAR(50) DEFAULT 'resend',
        filters JSONB DEFAULT '{}',
        scheduled_at TIMESTAMP,
        sent_at TIMESTAMP,
        total_recipients INTEGER DEFAULT 0,
        total_sent INTEGER DEFAULT 0,
        total_opened INTEGER DEFAULT 0,
        total_clicked INTEGER DEFAULT 0,
        total_bounced INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ crm_campaigns');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES crm_campaigns(id),
        organization_id UUID REFERENCES crm_organizations(id),
        email_to VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        bounced_at TIMESTAMP,
        bounce_reason TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ crm_email_logs');

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_smtp_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        password_encrypted TEXT NOT NULL,
        from_name VARCHAR(100),
        from_email VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT false,
        daily_limit INTEGER DEFAULT 200,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ crm_smtp_configs');

    // Indici
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_orgs_region ON crm_organizations(region)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_orgs_status ON crm_organizations(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_orgs_type ON crm_organizations(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_orgs_email ON crm_organizations(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_logs_campaign ON crm_email_logs(campaign_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crm_logs_org ON crm_email_logs(organization_id)`);
    console.log('✓ Indici creati');

    // Template predefiniti (solo se tabella vuota)
    const { rows } = await client.query('SELECT COUNT(*) FROM crm_email_templates');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO crm_email_templates (name, subject, body_html, body_text, category) VALUES
        (
          'Presentazione Soccorso Digitale',
          '{{org_name}}: gestisci la tua flotta sanitaria in modo digitale',
          '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F2F2F7;padding:32px 16px;"><table width="580" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#1E3A8A,#1e40af);padding:32px 40px;"><img src="https://soccorsodigitale.app/images/69b0dc9033646175674e6d28_logoicon.svg" height="32" style="filter:brightness(0) invert(1);margin-bottom:16px;display:block;"><h1 style="color:#fff;font-size:24px;margin:0;font-weight:800;">Ciao {{org_name}},</h1></td></tr><tr><td style="padding:32px 40px;"><p style="font-size:15px;color:#334155;line-height:1.7;">Siamo <strong>Soccorso Digitale</strong>, la piattaforma cloud italiana per la gestione di organizzazioni di trasporto sanitario e volontariato.</p><p style="font-size:15px;color:#334155;line-height:1.7;">Con la nostra piattaforma puoi gestire:</p><ul style="color:#334155;font-size:14px;line-height:2;"><li>📅 Turni e disponibilità dei volontari</li><li>🚑 Flotta veicoli e documenti</li><li>📋 Servizi e programma giornaliero</li><li>📊 Report e statistiche operative</li><li>🏥 Hub prenotazioni per i pazienti</li></ul><p style="font-size:15px;color:#334155;line-height:1.7;">Attualmente usata da organizzazioni in tutta Italia — <strong>prova gratuita di 7 giorni</strong>, nessuna carta di credito richiesta.</p><table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#1E3A8A;border-radius:10px;padding:14px 32px;"><a href="https://soccorsodigitale.app" style="color:#fff;text-decoration:none;font-size:15px;font-weight:700;">Inizia la prova gratuita →</a></td></tr></table></td></tr><tr><td style="padding:16px 40px;border-top:1px solid #E2E8F0;text-align:center;"><p style="font-size:11px;color:#CBD5E1;">Soccorso Digitale · soccorsodigitale.app<br><a href="{{unsubscribe_url}}" style="color:#94A3B8;">Cancella iscrizione</a></p></td></tr></table></body></html>',
          'Ciao {{org_name}}, siamo Soccorso Digitale. Inizia la prova gratuita su soccorsodigitale.app',
          'intro'
        ),
        (
          'Follow-up dopo primo contatto',
          '{{org_name}}: hai avuto modo di guardare la piattaforma?',
          '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F2F2F7;padding:32px 16px;"><table width="580" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:#0B2347;padding:28px 40px;"><img src="https://soccorsodigitale.app/images/69b0dc9033646175674e6d28_logoicon.svg" height="28" style="filter:brightness(0) invert(1);display:block;"></td></tr><tr><td style="padding:32px 40px;"><h2 style="font-size:20px;color:#0B2347;margin:0 0 16px;">Ciao {{org_name}},</h2><p style="font-size:15px;color:#334155;line-height:1.7;">Qualche giorno fa ti abbiamo scritto di <strong>Soccorso Digitale</strong>. Volevamo sapere se hai avuto modo di dare un''occhiata alla piattaforma.</p><p style="font-size:15px;color:#334155;line-height:1.7;">Se vuoi, possiamo organizzare una <strong>demo gratuita di 30 minuti</strong>.</p><table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#1E3A8A;border-radius:10px;padding:14px 32px;"><a href="https://soccorsodigitale.app" style="color:#fff;text-decoration:none;font-size:15px;font-weight:700;">Prenota una demo →</a></td></tr></table></td></tr><tr><td style="padding:16px 40px;border-top:1px solid #E2E8F0;text-align:center;"><p style="font-size:11px;color:#CBD5E1;">Soccorso Digitale · soccorsodigitale.app<br><a href="{{unsubscribe_url}}" style="color:#94A3B8;">Cancella iscrizione</a></p></td></tr></table></body></html>',
          'Ciao {{org_name}}, hai avuto modo di guardare Soccorso Digitale? Possiamo organizzare una demo gratuita.',
          'followup'
        ),
        (
          'Invito Demo Personalizzata',
          '{{org_name}}: ti offriamo una demo gratuita personalizzata',
          '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#F2F2F7;padding:32px 16px;"><table width="580" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#0B2347,#1E3A8A);padding:32px 40px;"><img src="https://soccorsodigitale.app/images/69b0dc9033646175674e6d28_logoicon.svg" height="32" style="filter:brightness(0) invert(1);margin-bottom:20px;display:block;"><h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">Costruiamo insieme la demo per {{org_name}}</h1></td></tr><tr><td style="padding:32px 40px;"><p style="font-size:15px;color:#334155;line-height:1.7;">Abbiamo preparato una demo personalizzata per organizzazioni come {{org_name}} in {{region}}.</p><ul style="color:#334155;font-size:14px;line-height:2.2;"><li>✅ Gestione turni e disponibilità</li><li>✅ Monitoraggio flotta in tempo reale</li><li>✅ Hub prenotazioni per i pazienti</li><li>✅ Report e statistiche operative</li></ul><table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background:#1E3A8A;border-radius:10px;padding:16px 36px;"><a href="https://soccorsodigitale.app" style="color:#fff;text-decoration:none;font-size:15px;font-weight:700;">Prenota la tua demo →</a></td></tr></table></td></tr><tr><td style="padding:16px 40px;border-top:1px solid #E2E8F0;text-align:center;"><p style="font-size:11px;color:#CBD5E1;">Soccorso Digitale · soccorsodigitale.app<br><a href="{{unsubscribe_url}}" style="color:#94A3B8;">Cancella iscrizione</a></p></td></tr></table></body></html>',
          'Ciao {{org_name}}, abbiamo preparato una demo personalizzata. Prenota 30 minuti su soccorsodigitale.app',
          'demo_invite'
        )
      `);
      console.log('✓ 3 template predefiniti inseriti');
    } else {
      console.log('ℹ Template già presenti, skip insert');
    }

    console.log('\n✅ Setup CRM completato con successo!');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Errore:', err.message);
  process.exit(1);
});
