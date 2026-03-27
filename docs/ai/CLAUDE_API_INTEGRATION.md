# Claude API Integration — AI Insights per Soccorso Digitale

**Versione:** 1.0
**Autore:** MINERVA (AI/ML Engineer)
**Data:** 2026-03-27
**Modello:** claude-sonnet-4-6
**SDK:** @anthropic-ai/sdk (Node.js TypeScript)

---

## Overview

L'integrazione Claude API aggiunge tre capacità che i modelli statistici non coprono:

1. **Insights narrativi**: trasforma dati aggregati in frasi operative comprensibili
2. **Q&A normativa**: risponde a domande su accreditamento, normativa regionale, GDPR (RAG su docs/domain/)
3. **Anomaly explanation**: spiega perché un servizio è anomalo in linguaggio naturale

Claude non sostituisce i modelli statistici (Prophet, XGBoost, OR-Tools) — li complementa aggiungendo il layer di ragionamento e comunicazione in linguaggio naturale.

---

## Use Case 1: Natural Language Insights

### Problema

Un coordinatore vede nella dashboard che i servizi dialisi sono aumentati del 30% questa settimana. I numeri ci sono, ma la dashboard non dice cosa farne.

### Soluzione

Claude riceve i dati aggregati e produce un commento operativo con suggerimenti specifici:

```typescript
// server/routes/ai.routes.ts

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EMS_SYSTEM_PROMPT = `Sei un assistente AI specializzato in gestione operativa di servizi di emergenza e trasporto sanitario (EMS) in Italia.

Ricevi dati operativi strutturati di un'organizzazione di soccorso (Croce Rossa, Misericordia, cooperativa trasporto sanitario) e produci:
1. Osservazioni concise sui trend significativi
2. Suggerimenti operativi pratici e immediati
3. Eventuali rischi o anomalie da controllare

Regole:
- Usa linguaggio semplice, non tecnico. Il destinatario è un coordinatore operativo, non un analista dati.
- Frasi brevi. Massimo 3-4 insight per risposta.
- Ogni insight deve essere actionable (deve suggerire un'azione specifica, non solo descrivere)
- Non inventare dati. Basa le osservazioni solo sui dati forniti.
- Se i dati sono insufficienti per trarre conclusioni, dillo esplicitamente.
- Tono: professionale ma diretto, come un collega esperto che legge il report con te.
- Non usare mai termini come "machine learning", "algoritmo", "AI" nella risposta.`;

interface WeeklyMetrics {
  organization_id: string;
  organization_name: string;
  period: { from: string; to: string };
  trips: {
    total: number;
    vs_last_week_pct: number;
    vs_last_month_avg_pct: number;
    by_type: Record<string, { count: number; avg_duration_min: number }>;
  };
  fleet: {
    active_vehicles: number;
    total_vehicles: number;
    avg_utilization_pct: number;
    km_total: number;
  };
  staff: {
    shifts_completed: number;
    overtime_hours: number;
    absences: number;
  };
  alerts: string[];  // festività imminenti, veicoli in manutenzione, etc.
}

async function generateWeeklyInsights(metrics: WeeklyMetrics): Promise<string> {
  const userMessage = `Analizza questi dati operativi per ${metrics.organization_name}
Periodo: ${metrics.period.from} — ${metrics.period.to}

SERVIZI:
- Totale: ${metrics.trips.total} (${metrics.trips.vs_last_week_pct > 0 ? "+" : ""}${metrics.trips.vs_last_week_pct.toFixed(0)}% vs settimana scorsa, ${metrics.trips.vs_last_month_avg_pct > 0 ? "+" : ""}${metrics.trips.vs_last_month_avg_pct.toFixed(0)}% vs media mensile)
- Per tipo: ${Object.entries(metrics.trips.by_type)
    .map(([type, data]) => `${type}: ${data.count} (durata media ${data.avg_duration_min} min)`)
    .join(", ")}

FLOTTA:
- Veicoli attivi: ${metrics.fleet.active_vehicles}/${metrics.fleet.total_vehicles}
- Utilizzo medio: ${metrics.fleet.avg_utilization_pct.toFixed(0)}%
- Km percorsi: ${metrics.fleet.km_total.toLocaleString("it-IT")}

PERSONALE:
- Turni completati: ${metrics.staff.shifts_completed}
- Straordinari: ${metrics.staff.overtime_hours}h
- Assenze: ${metrics.staff.absences}

CONTESTO:
${metrics.alerts.length > 0 ? metrics.alerts.join("\n") : "Nessun alert specifico"}

Produci 3-4 insight operativi concreti.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: EMS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  return (response.content[0] as Anthropic.TextBlock).text;
}
```

### Esempio output

```
📈 Dialisi in aumento del 30% — La settimana prossima potrebbe richiedere un mezzo in più nelle
fasce 07:00-09:00 e 16:00-18:00. Verifica la disponibilità con anticipo.

⏱️ Durata media dialisi: 52 min (+8 min vs media). Potrebbe indicare traffico più intenso sulla
tratta ospedaliera principale. Considera orari di partenza anticipati di 10 minuti.

🚗 Utilizzo flotta all'87% — Sei vicino al massimo. Se arriva un servizio urgente non pianificato,
potresti avere difficoltà. Identifica un mezzo di riserva per la settimana entrante.

⚠️ 12 ore straordinarie in 5 giorni. Verifica se è concentrato su un solo operatore — in tal caso
è opportuno distribuire i turni prima del weekend.
```

---

## Use Case 2: Q&A Normativa (RAG)

### Problema

Un direttore vuole sapere i requisiti per l'accreditamento in Lombardia, o un coordinatore chiede cosa fare in caso di sinistro durante trasporto. Oggi devono cercare su PDF e siti regionali.

### Architettura RAG

```
Domanda utente
    │
    ▼
Embedding query (text-embedding-3-small via OpenAI, o Claude Haiku)
    │
    ▼
Vector similarity search su docs/domain/ indicizzati
    │
    ▼
Recupera top-K chunks rilevanti (K=5-8)
    │
    ▼
Claude riceve: [chunks normativi] + [domanda utente]
    │
    ▼
Risposta con citazioni specifiche
```

### Documenti da indicizzare

```
docs/domain/
├── normativa/
│   ├── accreditamento-per-regione/
│   │   ├── lombardia.md
│   │   ├── veneto.md
│   │   └── ...
│   ├── requisiti-mezzi-sanitari.md
│   ├── certificazioni-personale.md
│   └── gdpr-ems.md
├── protocolli/
│   ├── trasporto-dialisi.md
│   ├── trasporto-oncologico.md
│   └── emergenze-durante-trasporto.md
└── convenzioni/
    ├── SSN-tariffe.md
    └── accreditamento-ASL.md
```

### Implementazione RAG semplificata (senza vector DB esterno)

Per SD con un corpus limitato (< 500 documenti), si può usare un approccio senza vector DB dedicato:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

interface DocumentChunk {
  content: string;
  source: string;
  title: string;
}

// Cache dei documenti in memoria (refresh ogni ora)
let documentCache: DocumentChunk[] = [];
let cacheLastLoaded = 0;

function loadDocumentCache(): DocumentChunk[] {
  const now = Date.now();
  if (documentCache.length > 0 && now - cacheLastLoaded < 3600000) {
    return documentCache;
  }

  const docsPath = path.join(__dirname, "../../docs/domain");
  const chunks: DocumentChunk[] = [];

  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf8");
        // Chunking semplice: divide per sezioni (##)
        const sections = content.split(/^## /m);
        for (const section of sections) {
          if (section.trim().length > 100) {
            chunks.push({
              content: section.slice(0, 2000), // max 2000 char per chunk
              source: fullPath.replace(docsPath, ""),
              title: section.split("\n")[0].trim(),
            });
          }
        }
      }
    }
  }

  walkDir(docsPath);
  documentCache = chunks;
  cacheLastLoaded = now;
  return chunks;
}

// Ricerca keyword semplice (sufficiente per corpus piccolo)
// Per corpus > 500 doc, sostituire con pgvector o Pinecone
function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 6
): DocumentChunk[] {
  const queryWords = query.toLowerCase().split(/\s+/);

  const scored = chunks.map((chunk) => {
    const text = (chunk.title + " " + chunk.content).toLowerCase();
    const score = queryWords.reduce((acc, word) => {
      const count = (text.match(new RegExp(word, "g")) || []).length;
      return acc + count;
    }, 0);
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

async function answerNormativeQuestion(
  question: string,
  organizationRegion: string
): Promise<{ answer: string; sources: string[] }> {
  const chunks = loadDocumentCache();
  const relevant = retrieveRelevantChunks(question, chunks);

  if (relevant.length === 0) {
    return {
      answer: "Non ho trovato documentazione pertinente a questa domanda. Ti consiglio di contattare il supporto o consultare direttamente il sito della tua ASL/Regione.",
      sources: [],
    };
  }

  const context = relevant
    .map((c) => `[Fonte: ${c.source}]\n${c.content}`)
    .join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: `Sei un esperto di normativa per servizi di trasporto sanitario ed emergenza medica in Italia.
Rispondi basandoti ESCLUSIVAMENTE sui documenti forniti nel contesto.
Se la risposta non è nei documenti, dì "Non ho informazioni sufficienti su questo punto — ti consiglio di verificare con la tua ASL o regione".
Cita sempre la fonte specifica ([Fonte: ...]) per ogni affermazione importante.
Il contesto geografico è la regione: ${organizationRegion}.`,
    messages: [
      {
        role: "user",
        content: `Domanda: ${question}\n\nDocumenti disponibili:\n${context}`,
      },
    ],
  });

  return {
    answer: (response.content[0] as Anthropic.TextBlock).text,
    sources: relevant.map((c) => c.source),
  };
}
```

---

## Use Case 3: Anomaly Explanation

### Problema

Il sistema rileva che il servizio #4523 ha impiegato 115 minuti invece dei soliti 35. Questo è un dato, non un'insight.

### Soluzione

Claude riceve il contesto del servizio (tipo, ora, mezzo, equipaggio, meteo, traffico stimato, storico percorso) e genera una spiegazione delle possibili cause con azioni di follow-up.

```typescript
interface ServiceAnomaly {
  service_id: string;
  service_type: string;
  expected_duration_min: number;
  actual_duration_min: number;
  deviation_pct: number;
  vehicle: string;
  crew: string[];
  time_of_day: string;
  day_of_week: string;
  route: { origin: string; destination: string };
  notes: string;
  weather: string;
  similar_services_avg_min: number;  // media storica stesso percorso
}

async function explainAnomaly(anomaly: ServiceAnomaly): Promise<string> {
  const prompt = `Servizio di trasporto sanitario anomalo — analisi richiesta:

Tipo servizio: ${anomaly.service_type}
Percorso: ${anomaly.route.origin} → ${anomaly.route.destination}
Durata attesa: ${anomaly.expected_duration_min} min (media storica: ${anomaly.similar_services_avg_min} min)
Durata effettiva: ${anomaly.actual_duration_min} min
Scostamento: +${anomaly.deviation_pct.toFixed(0)}%
Data/ora: ${anomaly.day_of_week}, ${anomaly.time_of_day}
Mezzo: ${anomaly.vehicle}
Equipaggio: ${anomaly.crew.join(", ")}
Condizioni meteo: ${anomaly.weather}
Note operatore: "${anomaly.notes}"

Elenca le possibili cause (2-3) e suggerisci se serve un'azione di follow-up.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: EMS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  return (response.content[0] as Anthropic.TextBlock).text;
}
```

### Esempio output

```
Possibili cause del ritardo di 80 minuti:

1. Traffico intenso nella fascia 17:30-19:00 sul percorso Via Roma → Ospedale Civile — questa
   tratta ha uno storico di +40-60% in orario di punta. Nessuna azione necessaria se ricorrente.

2. Le note indicano "paziente con difficoltà alla mobilizzazione" — questo può aggiungere
   20-40 minuti alla fase di carico. Valutare se questo paziente richiede equipaggio con
   formazione specifica MSB.

3. Azione consigliata: se questo servizio è ricorrente (stessa tratta, stesso paziente),
   aggiornare la durata stimata nel sistema da 35 a 60 minuti per evitare
   sovrapposizioni nei turni.
```

---

## Prompt Engineering — Sistema EMS

### Principi chiave

```typescript
// Template per il system prompt — da personalizzare per ogni use case
const buildSystemPrompt = (useCase: string, orgContext: OrgContext): string => {
  const base = `Sei un assistente AI specializzato in gestione operativa EMS in Italia.
Organizzazione: ${orgContext.name} (${orgContext.type}, ${orgContext.region})
Piano: ${orgContext.plan}
Moduli attivi: ${orgContext.activeModules.join(", ")}

REGOLE INVIOLABILI:
1. Basa le risposte SOLO sui dati forniti — non inventare numeri o situazioni
2. Linguaggio semplice — il destinatario è un operatore sanitario, non un tecnico
3. Ogni osservazione deve avere un'azione concreta collegata
4. Se i dati sono insufficienti, dillo esplicitamente
5. Non fare riferimento a "AI", "algoritmi", "modelli" — parla come un collega esperto
6. Massimo 4 punti per risposta — concisione sopra completezza`;

  const useCaseInstructions: Record<string, string> = {
    insights: "\nFocus: trend operativi settimanali, pianificazione mezzi e personale",
    normativa: "\nFocus: normativa italiana accreditamento EMS, cita sempre la fonte",
    anomaly: "\nFocus: spiegazione cause possibili + azione di follow-up",
  };

  return base + (useCaseInstructions[useCase] || "");
};
```

### Guardrail contro risposte pericolose

```typescript
const DANGEROUS_TOPICS = [
  "protocollo medico",
  "diagnosi",
  "terapia",
  "farmaci",
  "trattamento paziente",
  "decisione clinica",
];

function hasDangerousTopic(query: string): boolean {
  const lower = query.toLowerCase();
  return DANGEROUS_TOPICS.some((topic) => lower.includes(topic));
}

// In ogni handler Claude API:
if (hasDangerousTopic(userQuery)) {
  return {
    answer: "Questa domanda riguarda decisioni cliniche o mediche. Non posso rispondere su questi temi — consulta il medico responsabile o i protocolli interni della tua organizzazione.",
    blocked: true,
  };
}
```

---

## Costi Stimati

### Modello: claude-sonnet-4-6

Prezzi attuali Anthropic (verificare per aggiornamenti):
- Input: ~$3 per 1M token
- Output: ~$15 per 1M token

### Stima per use case

| Use Case | Token input | Token output | Costo per chiamata | Frequenza | Costo mensile (100 org) |
|---|---|---|---|---|---|
| Weekly insights | ~800 | ~500 | ~$0.010 | 4x/mese/org | ~$4 |
| Normativa Q&A | ~2000 (con context) | ~600 | ~$0.015 | 10x/mese/org | ~$15 |
| Anomaly explanation | ~400 | ~300 | ~$0.006 | 20x/mese/org | ~$12 |
| **Totale** | | | | | **~$31/mese** |

Con 100 organizzazioni attive: **~$31/mese** — molto sotto il budget.

Con 500 organizzazioni: ~$155/mese — ancora gestibile.

### Budget alert

```typescript
// Tracking costi in PostgreSQL
interface ClaudeAPIUsage {
  organization_id: string;
  use_case: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  called_at: Date;
}

// Alert se costi mensili superano soglia
const MONTHLY_BUDGET_USD = 500;

async function checkBudgetAlert(db: DB): Promise<void> {
  const monthlyCost = await db.queryOne<{ total: number }>(
    `SELECT SUM(cost_usd) as total FROM claude_api_usage
     WHERE called_at >= DATE_TRUNC('month', NOW())`
  );

  if (monthlyCost.total > MONTHLY_BUDGET_USD * 0.8) {
    await sendAlert(
      `Claude API cost this month: $${monthlyCost.total.toFixed(2)} — 80% of budget`
    );
  }
}
```

---

## Rate Limiting e Gestione Errori

```typescript
import pLimit from "p-limit";

// Max 3 chiamate simultanee a Claude per non superare rate limits Anthropic
const claudeRateLimiter = pLimit(3);

// Cache risposte per 1 ora (stessi insights non cambiano in 60 min)
const responseCache = new Map<string, { response: string; cachedAt: number }>();

async function cachedClaudeCall(
  cacheKey: string,
  callFn: () => Promise<string>,
  ttlMs: number = 3600000  // 1 ora
): Promise<string> {
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < ttlMs) {
    return cached.response;
  }

  const response = await claudeRateLimiter(() => callFn());
  responseCache.set(cacheKey, { response, cachedAt: Date.now() });
  return response;
}

// Gestione errori con fallback graceful
async function safeClaudeCall(callFn: () => Promise<string>): Promise<string | null> {
  try {
    return await callFn();
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        console.warn("[Claude API] Rate limit hit — will retry after backoff");
        // Non ritentare immediatamente — log e restituisci null
        // Il frontend mostra "Insights temporaneamente non disponibili"
      } else if (err.status >= 500) {
        console.error("[Claude API] Server error:", err.message);
      }
    }
    return null;  // graceful degradation — la dashboard funziona senza insights
  }
}
```

---

## Endpoint Express

```typescript
// server/routes/ai.routes.ts

router.get("/ai/insights/weekly", requireAuth, async (req, res) => {
  const { organizationId } = req.user;

  const cacheKey = `weekly_insights_${organizationId}_${getISOWeek(new Date())}`;

  const insights = await cachedClaudeCall(cacheKey, async () => {
    const metrics = await fetchWeeklyMetrics(organizationId);
    return generateWeeklyInsights(metrics);
  });

  if (!insights) {
    return res.status(503).json({ error: "AI insights temporarily unavailable" });
  }

  res.json({ insights, generated_at: new Date().toISOString() });
});

router.post("/ai/normativa/question", requireAuth, async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string" || question.length > 500) {
    return res.status(400).json({ error: "Question must be a string under 500 characters" });
  }

  if (hasDangerousTopic(question)) {
    return res.status(200).json({
      answer: "Questa domanda riguarda decisioni cliniche. Consulta il medico responsabile.",
      blocked: true,
      sources: [],
    });
  }

  const org = await fetchOrganization(req.user.organizationId);
  const result = await safeClaudeCall(() =>
    answerNormativeQuestion(question, org.region)
  );

  if (!result) {
    return res.status(503).json({ error: "AI temporarily unavailable" });
  }

  res.json(result);
});
```
