'use client';
import React from 'react';
import { PricingModule, PricingModulePlan } from '@/components/ui/pricing-module';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Package, Puzzle, Wrench, Lock, Zap,
  ShoppingBag, Star, CheckCircle2, ArrowRight,
  Car, TrendingUp, Building2, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ── Category definitions ─────────────────────────── */
const CATEGORIES = [
  { key: 'all',       label: 'Tutti',     icon: ShoppingBag },
  { key: 'modulo',    label: 'Moduli',    icon: Puzzle },
  { key: 'servizio',  label: 'Servizi',   icon: Wrench },
  { key: 'licenza',   label: 'Licenze',   icon: Lock },
  { key: 'addon',     label: 'Add-on',    icon: Zap },
  { key: 'pacchetto', label: 'Pacchetti', icon: Package },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

/* ── Piani per i Pacchetti ────────────────────────── */
const PIANI_PACCHETTI: PricingModulePlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Per associazioni di piccole dimensioni che vogliono digitalizzare i servizi.',
    price: { monthly: 119, yearly: Math.round(119 * 0.88) },
    icon: <Car size={20} />,
    features: [
      { text: 'Fino a 5 mezzi' },
      { text: 'Gestione turni base' },
      { text: 'Programma giornaliero' },
      { text: 'App mobile Android/iOS' },
      { text: 'Supporto community' },
    ],
    cta: 'Inizia Prova Gratuita',
    ctaHref: '/inizia?piano=starter',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: "Per organizzazioni operative in crescita con esigenze avanzate.",
    price: { monthly: 249, yearly: Math.round(249 * 0.88) },
    icon: <TrendingUp size={20} />,
    badge: 'Più scelto',
    highlighted: true,
    features: [
      { text: 'Fino a 20 mezzi', highlighted: true },
      { text: 'Turni avanzati + reperibilità' },
      { text: 'Analytics operative complete' },
      { text: 'GPS tracking in tempo reale' },
      { text: 'Fatturazione & finance' },
      { text: 'Supporto prioritario 4h' },
    ],
    cta: 'Attiva Professional',
    ctaHref: '/inizia?piano=professional',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Per organizzazioni strutturate con più sedi e integrazioni istituzionali.',
    price: { monthly: 449, yearly: Math.round(449 * 0.88) },
    icon: <Building2 size={20} />,
    features: [
      { text: 'Fino a 30 mezzi' },
      { text: 'Multi-sede (3 incluse)' },
      { text: 'Integrazione SUEM 118' },
      { text: 'SPID/CIE login operatori' },
      { text: 'SLA 99.5% garantito' },
      { text: 'Onboarding assistito' },
    ],
    cta: 'Attiva Business',
    ctaHref: '/inizia?piano=business',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Soluzione su misura per grandi organizzazioni regionali e consorzi.',
    price: { monthly: null, yearly: null },
    priceLabel: 'Su misura',
    icon: <Crown size={20} />,
    features: [
      { text: 'Mezzi e sedi illimitati' },
      { text: 'API personalizzate' },
      { text: 'Integrazioni FSE / ULSS' },
      { text: 'SLA 99.9% con penali' },
      { text: 'Account manager dedicato' },
      { text: 'Formazione on-site' },
    ],
    cta: 'Contatta il Team',
    ctaHref: '/demo',
  },
];

/* ── Moduli ───────────────────────────────────────── */
interface ModuleItem {
  id: string;
  name: string;
  description: string;
  price: number;
  billingType: 'monthly' | 'one_time';
  badge?: string;
  badgeColor?: string;
  features: string[];
  isOwned?: boolean;
}

const MODULI: ModuleItem[] = [
  {
    id: 'gps-tracking',
    name: 'GPS Tracking Avanzato',
    description: 'Tracciamento in tempo reale di tutti i mezzi con storico percorsi e geofencing.',
    price: 29,
    billingType: 'monthly',
    badge: 'Più usato',
    badgeColor: '#2E5E99',
    features: ['Tracking live', 'Storico 90 giorni', 'Geofencing alert', 'Export KML/GPX'],
  },
  {
    id: 'analytics-pro',
    name: 'Analytics Pro',
    description: 'Dashboard avanzata con KPI operativi, report ULSS e previsioni AI.',
    price: 19,
    billingType: 'monthly',
    features: ['KPI personalizzabili', 'Report automatici', 'Export PDF/Excel', 'Previsioni AI'],
  },
  {
    id: 'finance',
    name: 'Gestione Finanziaria',
    description: 'Fatturazione, rimborsi volontari, budget e rendiconti economici.',
    price: 24,
    billingType: 'monthly',
    features: ['Fatturazione automatica', 'Rimborsi km', 'Report bilancio', 'Integrazione contabile'],
  },
  {
    id: 'checklist',
    name: 'Checklist & Ispezioni',
    description: 'Checklist digitali per ispezione mezzi, attrezzature e ambienti.',
    price: 12,
    billingType: 'monthly',
    features: ['Template personalizzabili', 'Firma digitale', 'Report non conformità', 'Storico audit'],
  },
];

const SERVIZI: ModuleItem[] = [
  {
    id: 'onboarding',
    name: 'Onboarding Assistito',
    description: 'Setup completo della piattaforma con formazione del personale amministrativo.',
    price: 299,
    billingType: 'one_time',
    badge: 'Consigliato',
    badgeColor: '#10b981',
    features: ['Setup iniziale', '2 sessioni formazione', 'Migrazione dati', 'Supporto 30 giorni'],
  },
  {
    id: 'integrazione-118',
    name: 'Integrazione SUEM 118',
    description: 'Connessione diretta con la centrale operativa SUEM 118 della tua ULSS.',
    price: 499,
    billingType: 'one_time',
    features: ['API certificata', 'Test con centrale', 'Documentazione', 'Manutenzione inclusa 1 anno'],
  },
  {
    id: 'custom-report',
    name: 'Report Personalizzati',
    description: 'Sviluppo di report su misura per normative locali o esigenze specifiche.',
    price: 149,
    billingType: 'one_time',
    features: ['Analisi requisiti', 'Sviluppo custom', 'Revisioni incluse', 'Consegna 10 gg'],
  },
];

const LICENZE: ModuleItem[] = [
  {
    id: 'extra-vehicles',
    name: 'Veicoli Aggiuntivi',
    description: 'Estendi il tuo piano con slot veicolo aggiuntivi.',
    price: 5,
    billingType: 'monthly',
    features: ['Per ogni veicolo aggiuntivo', 'Attivazione istantanea', 'Stesso piano base'],
  },
  {
    id: 'extra-sede',
    name: 'Sede Aggiuntiva',
    description: 'Aggiungi una sede operativa separata con gestione autonoma.',
    price: 29,
    billingType: 'monthly',
    features: ['Dashboard separata', 'Utenti indipendenti', 'Report consolidati'],
  },
  {
    id: 'archivio-esteso',
    name: 'Archivio Esteso',
    description: 'Estendi la conservazione dati da 12 a 60 mesi.',
    price: 9,
    billingType: 'monthly',
    features: ['Storico 5 anni', 'Export completo', 'Backup giornaliero'],
  },
];

const ADDONS: ModuleItem[] = [
  {
    id: 'spid',
    name: 'Accesso SPID/CIE',
    description: 'Abilita il login tramite SPID o CIE per i tuoi operatori.',
    price: 15,
    billingType: 'monthly',
    badge: 'Novità',
    badgeColor: '#f59e0b',
    features: ['SPID L1 e L2', 'CIE 3.0', 'SSO abilitato', 'Audit login'],
  },
  {
    id: 'white-label',
    name: 'White Label App',
    description: 'Personalizza l\'app mobile con il tuo logo e i colori dell\'organizzazione.',
    price: 49,
    billingType: 'monthly',
    features: ['Logo personalizzato', 'Colori brand', 'Store listing custom', 'Aggiornamenti inclusi'],
  },
  {
    id: 'sms-notify',
    name: 'Notifiche SMS',
    description: 'Invia SMS automatici a pazienti e operatori per conferme e avvisi.',
    price: 19,
    billingType: 'monthly',
    features: ['500 SMS/mese inclusi', 'Template personalizzabili', 'Log consegne', 'Extra €0.05/SMS'],
  },
];

/* ── Item Card ────────────────────────────────────── */
function ModuleCard({ item }: { item: ModuleItem }) {
  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border bg-card transition-all hover:shadow-md hover:-translate-y-0.5',
      item.isOwned && 'border-green-200 bg-green-50/30',
    )}>
      {item.badge && !item.isOwned && (
        <div
          className="absolute top-3 right-3 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
          style={{ background: item.badgeColor ?? '#2E5E99' }}
        >
          {item.badge}
        </div>
      )}
      {item.isOwned && (
        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
          <CheckCircle2 size={11} />
          Attivo
        </div>
      )}

      <div className="p-5 pb-3 border-b bg-muted/10 rounded-t-xl">
        <div className="text-base font-semibold">{item.name}</div>
        <p className="text-muted-foreground mt-1 text-sm leading-snug">{item.description}</p>
        <div className="mt-3 flex items-end gap-1">
          <span className="text-2xl font-bold">€{item.price}</span>
          <span className="text-muted-foreground text-sm mb-0.5">
            {item.billingType === 'monthly' ? '/mese' : ' una tantum'}
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-2.5">
        {item.features.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={14} className="text-foreground shrink-0" />
            {f}
          </div>
        ))}
      </div>

      <div className="p-4 pt-2 border-t">
        <Button
          className="w-full"
          variant={item.isOwned ? 'outline' : 'default'}
          size="sm"
        >
          {item.isOwned ? 'Gestisci' : 'Aggiungi'}
          {!item.isOwned && <ArrowRight size={14} className="ml-1" />}
        </Button>
      </div>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────── */
function Section({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: ModuleItem[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-[#2E5E99]" />
        <h2 className="text-lg font-bold text-[#0D2440]">{title}</h2>
        <Badge variant="secondary" className="text-xs">{items.length}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <ModuleCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
export default function MarketplacePage() {
  const [activeCategory, setActiveCategory] = React.useState<CategoryKey>('all');

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#f0f6ff] to-white">
      {/* Hero */}
      <div className="px-6 pt-10 pb-8 text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-[#2E5E99] shadow-sm">
          <Star size={12} className="fill-[#2E5E99] text-[#2E5E99]" />
          Marketplace Soccorso Digitale
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#0D2440]">
          Potenzia la tua organizzazione
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          Moduli, servizi, licenze e add-on per personalizzare la piattaforma sulle tue esigenze operative.
        </p>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-3 max-w-5xl mx-auto">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                activeCategory === key
                  ? 'bg-[#2E5E99] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-12">

        {/* Pacchetti — pricing cards */}
        {(activeCategory === 'all' || activeCategory === 'pacchetto') && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package size={18} className="text-[#2E5E99]" />
              <h2 className="text-lg font-bold text-[#0D2440]">Pacchetti</h2>
              <Badge variant="secondary" className="text-xs">{PIANI_PACCHETTI.length}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mb-6">
              Piani tutto incluso con fatturazione mensile o annuale. 14 giorni di prova gratuita.
            </p>
            <PricingModule plans={PIANI_PACCHETTI} />
          </div>
        )}

        {/* Moduli */}
        {(activeCategory === 'all' || activeCategory === 'modulo') && (
          <Section title="Moduli" icon={Puzzle} items={MODULI} />
        )}

        {/* Servizi */}
        {(activeCategory === 'all' || activeCategory === 'servizio') && (
          <Section title="Servizi" icon={Wrench} items={SERVIZI} />
        )}

        {/* Licenze */}
        {(activeCategory === 'all' || activeCategory === 'licenza') && (
          <Section title="Licenze" icon={Lock} items={LICENZE} />
        )}

        {/* Add-on */}
        {(activeCategory === 'all' || activeCategory === 'addon') && (
          <Section title="Add-on" icon={Zap} items={ADDONS} />
        )}
      </div>
    </div>
  );
}
