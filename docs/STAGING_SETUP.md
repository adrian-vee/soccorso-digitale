# Configurazione Ambiente Staging

> Questo documento descrive i passi manuali che Adrian deve eseguire su Railway
> per attivare l'ambiente staging. Il codice è già pronto (branch `staging`).

---

## Prerequisiti (Railway Dashboard)

### 1. Abilitare branch deploy

1. Railway Dashboard → Progetto `soccorso-digitale` → **Settings**
2. Sezione **Deploy** → Enable branch deploys
3. Selezionare branch: `staging`
4. Railway creerà automaticamente un deployment separato per il branch staging

### 2. Creare database staging

1. Railway Dashboard → **New** → Database → PostgreSQL
2. Nominare: `soccorso-digitale-staging-db`
3. Copiare il `DATABASE_URL` generato

### 3. Variabili ambiente staging

Copiare tutte le variabili da produzione e modificare quelle indicate:

| Variabile | Valore staging |
|-----------|---------------|
| `NODE_ENV` | `staging` |
| `DATABASE_URL` | `<URL del nuovo DB staging>` |
| `SENTRY_ENVIRONMENT` | `staging` |
| `RESEND_FROM_EMAIL` | Disabilitare o usare indirizzo test |
| `STRIPE_SECRET_KEY` | `sk_test_...` (chiave test Stripe) |
| `SESSION_SECRET` | Generare nuovo secret |

Le altre variabili (Google Maps, Sentry DSN, ecc.) possono essere le stesse di produzione.

---

## Banner staging (già nel codice)

Il middleware `server/middleware/staging-banner.ts` imposta automaticamente:
- `res.locals.isStaging = true`
- Header `X-Environment: staging`

quando `NODE_ENV=staging`.

Per mostrare il banner rosso nel frontend, aggiungere in `admin/public/index.html`:

```html
<!-- Prima del </body> -->
<div id="staging-banner"
     style="display:none;background:#EF4444;color:white;text-align:center;
            padding:6px;font-size:12px;font-weight:600;position:fixed;
            top:0;left:0;right:0;z-index:9999;letter-spacing:0.05em;">
  ⚠️ AMBIENTE STAGING — Non usare dati reali
</div>
<script>
  // Mostra il banner se il server è in staging
  fetch('/api/v1/health').then(r => r.json()).then(d => {
    if (d.environment === 'staging') {
      document.getElementById('staging-banner').style.display = 'block';
      document.body.style.marginTop = '30px';
    }
  }).catch(() => {});
</script>
```

> Per supportare questo, aggiungere `environment: process.env.NODE_ENV` alla risposta di `/api/health`.

---

## Workflow

```
feature/* → PR → staging (test) → merge → main (produzione)
```

### Seed dati staging

Dopo il primo deploy, eseguire:
```bash
# Connesso al DB staging
NODE_ENV=staging DATABASE_URL=<staging-db-url> npm run db:push
NODE_ENV=staging DATABASE_URL=<staging-db-url> npx tsx server/seed.ts
```

---

## Checklist attivazione

- [ ] Branch `staging` pushato su GitHub
- [ ] Railway: branch deploy abilitato per `staging`
- [ ] Railway: DB PostgreSQL staging creato
- [ ] Railway: variabili ambiente staging configurate (`NODE_ENV=staging`)
- [ ] Deploy staging verificato su URL Railway
- [ ] DB staging migrato (`db:push`)
- [ ] Dati demo seedati
