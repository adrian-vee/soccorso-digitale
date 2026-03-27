# Guida per l'Amministratore IT

**Cosa imparerai in questa guida:**
- Come gestire utenti e permessi
- Come configurare i moduli attivi
- Come eseguire import/export dati e gestire le impostazioni avanzate

---

## Gestione utenti

### Creare un nuovo utente

1. Vai su **Impostazioni → Utenti**
2. Clicca **"+ Nuovo utente"**
3. Compila email, nome, ruolo
4. Clicca **"Crea e invia credenziali"** — l'utente riceve l'email di accesso automaticamente

### Ruoli disponibili e permessi

| Ruolo | Dashboard | Servizi | Turni | Flotta | Analytics | Utenti | Impostazioni |
|---|---|---|---|---|---|---|---|
| **Autista** | Solo app | Solo i suoi | — | — | — | — | — |
| **Coordinatore** | ✅ | ✅ | ✅ | Lettura | — | — | — |
| **Direttore** | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Super Admin** | Tutto | Tutto | Tutto | Tutto | Tutto | Tutto | Tutto |

### Disattivare un utente (es. dimissioni)

1. Vai su **Impostazioni → Utenti**
2. Cerca il nome dell'utente
3. Clicca sui tre puntini a destra → **"Disattiva account"**
4. L'utente non può più accedere ma i suoi dati e i servizi che ha gestito rimangono nel sistema

> Non eliminare mai un utente — disattivalo. I dati storici devono restare per la tracciabilità.

---

## Configurazione moduli

I moduli attivi della tua organizzazione si gestiscono da due posti:

1. **Marketplace** (per attivare/disattivare moduli a pagamento) — vedi Guida MARKETPLACE
2. **Impostazioni → Moduli** — per configurare ogni modulo attivo

Per ogni modulo puoi impostare quali ruoli hanno accesso. Es: il modulo Analisi Economica può essere visibile solo al Direttore e non ai Coordinatori.

---

## Import dati da Excel

Se hai dati storici (veicoli, personale, servizi passati) in Excel, puoi importarli.

### Import veicoli
1. Vai su **Impostazioni → Import dati → Veicoli**
2. Scarica il template Excel
3. Compila il template con i tuoi dati (una riga per veicolo)
4. Carica il file compilato
5. Verifica l'anteprima e clicca **"Importa"**

### Import personale
Stesso procedimento di cui sopra, dalla voce **Import dati → Personale**.

> **Consiglio:** Fai sempre l'import in un giorno non operativo e verifica il risultato prima di procedere.

---

## Export dati

Puoi esportare qualsiasi dato dalla piattaforma:

- **Servizi**: Programma Giornaliero → filtri → "Esporta Excel"
- **Personale**: Personale → "Esporta"
- **Veicoli**: Flotta → "Esporta"
- **Inventario**: Inventario → "Esporta"

Tutti i dati vengono esportati in formato Excel o CSV, compatibile con qualsiasi programma di contabilità.

---

## Backup e sicurezza dei dati

I dati sono automaticamente salvati su server sicuri con backup ogni 6 ore. Non devi fare nulla manualmente.

Se hai bisogno di un **export completo** di tutti i dati della tua organizzazione (es. cambio gestionale, richiesta legale):

1. Scrivi a hello@soccorsodigitale.app con oggetto "Richiesta export completo dati — [nome org]"
2. Forniamo un archivio completo entro 5 giorni lavorativi

---

## Integrazione con altri sistemi

Se la tua organizzazione usa altri software (contabilità, gestione soci, sistemi regionali), Soccorso Digitale può scambiare dati via **API** o tramite file CSV automatici.

Contatta hello@soccorsodigitale.app per valutare le possibilità di integrazione con il tuo sistema specifico.

---

**Hai bisogno di aiuto? Scrivi a hello@soccorsodigitale.app**
