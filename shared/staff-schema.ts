import { z } from "zod";

export const SEDI_STAFF = ['Verona', 'Cologna Veneta', 'Nogara', 'Legnago', 'Montecchio Maggiore'] as const;
export type SedeStaff = typeof SEDI_STAFF[number];

export const MANSIONI = ['autista', 'soccorritore'] as const;
export type Mansione = typeof MANSIONI[number];

export interface Operatore {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  mansione: Mansione;
  sede: SedeStaff;
  categoriaRuolo: 'volontario' | 'collaboratore' | 'dipendente';
  dataInizio: string;
  turniCompletati: number;
  giorniRiposo: number;
  livelloEsperienza: number;
}

export interface Disponibilita {
  id: string;
  operatoreId: string;
  meseRiferimento: string;
  livelloEnergia: 'basso' | 'normale' | 'alto';
  giornateDisponibili: string[];
  noteProtezione?: string;
  stato: 'bozza' | 'inviata' | 'ritirata';
  dataCreazione: string;
  dataInvio?: string;
}

export const insertDisponibilitaSchema = z.object({
  livelloEnergia: z.enum(['basso', 'normale', 'alto']),
  giornateDisponibili: z.array(z.string()),
  noteProtezione: z.string().optional(),
});

export interface FerieRichiesta {
  id: string;
  operatoreId: string;
  dataInizio: string;
  dataFine: string;
  motivazione?: string;
  stato: 'in_attesa' | 'approvata' | 'rifiutata' | 'ritirata';
  dataCreazione: string;
  dataRisposta?: string;
}

export const insertFerieRichiestaSchema = z.object({
  dataInizio: z.string(),
  dataFine: z.string(),
  motivazione: z.string().optional(),
});

export interface TurnoStaff {
  id: string;
  operatoreId: string;
  data: string;
  oraInizio: string;
  oraFine: string;
  tipo: 'giorno' | 'notte' | 'riposo';
  luogo: string;
  ruoloTurno: string;
  squadra: string[];
  qualita: {
    zonaTransquilla: boolean;
    squadraPreferita: boolean;
    seguitoDaRiposo: boolean;
  };
  note?: string;
}

export interface Scambio {
  id: string;
  turnoId: string;
  operatoreRichiedenteId: string;
  operatoreAccettanteId?: string;
  sede: SedeStaff;
  mansioneRichiesta: Mansione;
  stato: 'disponibile' | 'in_attesa' | 'accettato' | 'annullato';
  motivoSuggerito?: string;
  dataCreazione: string;
  reversibile: boolean;
}

export interface Crescita {
  id: string;
  operatoreId: string;
  mese: string;
  turniCompletati: number;
  giorniRiposo: number;
  scambiEffettuati: number;
  continuita: number;
  carico: 'leggero' | 'normale' | 'intenso';
}

export interface AzioneReversibile {
  id: string;
  operatoreId: string;
  tipo: 'scambio' | 'disponibilita' | 'feedback';
  descrizione: string;
  dataOra: string;
  annullabile: boolean;
  annullata: boolean;
}

export interface Notifica {
  id: string;
  operatoreId: string;
  tipo: 'critica' | 'informativa';
  messaggio: string;
  perche: string;
  dataOra: string;
  letta: boolean;
}

export interface StatoOggi {
  deviPreoccuparti: boolean;
  messaggio: string;
  prossimoTurno?: TurnoStaff;
  giorniRiposoConsecutivi: number;
  suggerimenti: {
    testo: string;
    perche: string;
  }[];
}

export const STATI_BENESSERE = ['stanco', 'ok', 'carico'] as const;
export type StatoBenessere = typeof STATI_BENESSERE[number];

export interface CheckinBenessere {
  id: string;
  operatoreId: string;
  data: string;
  stato: StatoBenessere;
  dataOra: string;
}

export const insertCheckinBenessereSchema = z.object({
  stato: z.enum(['stanco', 'ok', 'carico']),
});

export interface SessioneRespiro {
  id: string;
  operatoreId: string;
  dataOra: string;
  durataSecondi: number;
  completata: boolean;
}

export interface StatoOggiEsteso extends StatoOggi {
  checkinOggi?: CheckinBenessere;
  teamOggi?: {
    nome: string;
    ruolo: string;
  }[];
  protezioneAttiva: boolean;
  ultimoRespiro?: string;
  sessioniRespiroSettimana: number;
}

export interface KarmaScambi {
  operatoreId: string;
  favoriDati: number;
  favoriRicevuti: number;
}

export interface Milestone {
  id: string;
  operatoreId: string;
  tipo: "turni_100" | "turni_500" | "anniversario_1" | "anniversario_5" | "primo_scambio" | "aiuto_collega";
  titolo: string;
  messaggio: string;
  dataRaggiungimento: string;
  celebrata: boolean;
}

export type InsertDisponibilita = z.infer<typeof insertDisponibilitaSchema>;
export type InsertFerieRichiesta = z.infer<typeof insertFerieRichiestaSchema>;
export type InsertCheckinBenessere = z.infer<typeof insertCheckinBenessereSchema>;
