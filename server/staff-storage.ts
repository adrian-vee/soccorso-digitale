import { type User, type InsertUser, type Operatore, type Turno, type Scambio, type Crescita, type CrescitaEstesa, type AzioneReversibile, type StatoOggi, type StatoOggiEsteso, type Notifica, type KarmaScambi, type Milestone, type Disponibilita, type InsertDisponibilita, type FerieRichiesta, type InsertFerieRichiesta, type Sede, type Mansione, type PillolaFormativa, type ProgressoPillola, type StatoFormazione, type CategoriaFormazione, type CheckinBenessere, type StatoBenessere, type SessioneRespiro, type RiflessioneMensile, type InsertRiflessione, type ObiettivoPersonale, type InsertObiettivo, type MomentoOrgoglio, type InsertMomentoOrgoglio, type ScambioEsteso, type PreferenzeScambio, type InsertPreferenzeScambio, type RingraziamentoScambio, type InsertRingraziamentoScambio, type LivelloUrgenza, type ScambiStats, type InsertPropostaScambio, type TurnoEsteso, type TurniStats, type PrevisioneQualita, type CompagnoTurno, type CountdownIntelligente, type PreparazioneMentale, type LivelloIntensita, type BadgeCompetenza, type BadgeStats, type TurnoTabellone, type CandidaturaTurno, type TabelloneMese, type SlotTurno, type InsertCandidatura, type ProntezzaMissione, type MicroAzione, type Partner, type ConvenzioneUtilizzo, type CategoriaPartner, type InsertConvenzioneUtilizzo, type Timbratura, type InsertTimbratura, type TimbraturaGiornaliera, type Documento, type InsertDocumento, type Circolare, type ConfermaLettura, type InsertConfermaLettura, type Corso, type IscrizioneCorso, type InsertIscrizioneCorso, type StatoFormazioneOperatore, type QRVerifica, CATEGORIE_FORMAZIONE, SEDI } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getOperatore(id: string): Promise<Operatore | undefined>;
  getStatoOggi(operatoreId: string): Promise<StatoOggi>;
  getTurni(operatoreId: string): Promise<Turno[]>;
  getTurno(id: string): Promise<Turno | undefined>;
  
  getScambi(operatoreId: string): Promise<(Scambio & { turno: Turno })[]>;
  createScambio(turnoId: string, operatoreId: string, motivo?: string): Promise<Scambio>;
  accettaScambio(scambioId: string, operatoreId: string): Promise<Scambio>;
  annullaScambio(scambioId: string): Promise<Scambio>;
  
  getCrescita(operatoreId: string): Promise<Crescita[]>;
  
  getAzioni(operatoreId: string): Promise<AzioneReversibile[]>;
  annullaAzione(azioneId: string): Promise<AzioneReversibile>;
  
  getKarma(operatoreId: string): Promise<KarmaScambi>;
  getMilestones(operatoreId: string): Promise<Milestone[]>;
  celebrateMilestone(milestoneId: string): Promise<Milestone>;
  
  getDisponibilita(operatoreId: string, meseRiferimento: string): Promise<Disponibilita | undefined>;
  createDisponibilita(operatoreId: string, data: InsertDisponibilita): Promise<Disponibilita>;
  inviaDisponibilita(disponibilitaId: string): Promise<Disponibilita>;
  ritiraDisponibilita(disponibilitaId: string): Promise<Disponibilita>;
  
  getFerieRichieste(operatoreId: string): Promise<FerieRichiesta[]>;
  createFerieRichiesta(operatoreId: string, data: InsertFerieRichiesta): Promise<FerieRichiesta>;
  ritiraFerieRichiesta(richiestaId: string): Promise<FerieRichiesta>;
  
  getScambiFiltered(operatoreId: string): Promise<(Scambio & { turno: Turno })[]>;
  
  getPilloleFormative(): Promise<PillolaFormativa[]>;
  getPilloleByCategoria(categoria: CategoriaFormazione): Promise<PillolaFormativa[]>;
  getStatoFormazione(operatoreId: string): Promise<StatoFormazione>;
  completaPillola(operatoreId: string, pillolaId: string): Promise<ProgressoPillola>;
  
  getStatoOggiEsteso(operatoreId: string): Promise<StatoOggiEsteso>;
  getCheckinOggi(operatoreId: string): Promise<CheckinBenessere | undefined>;
  createCheckin(operatoreId: string, stato: StatoBenessere): Promise<CheckinBenessere>;
  createSessioneRespiro(operatoreId: string, durataSecondi: number): Promise<SessioneRespiro>;
  getSessioniRespiroSettimana(operatoreId: string): Promise<number>;
  
  getCrescitaEstesa(operatoreId: string, mese: string): Promise<CrescitaEstesa | undefined>;
  getRiflessione(operatoreId: string, mese: string): Promise<RiflessioneMensile | undefined>;
  createRiflessione(operatoreId: string, data: InsertRiflessione): Promise<RiflessioneMensile>;
  getObiettivo(operatoreId: string, mese: string): Promise<ObiettivoPersonale | undefined>;
  createObiettivo(operatoreId: string, data: InsertObiettivo): Promise<ObiettivoPersonale>;
  toggleObiettivoRaggiunto(obiettivoId: string): Promise<ObiettivoPersonale>;
  getMomentiOrgoglio(operatoreId: string): Promise<MomentoOrgoglio[]>;
  createMomentoOrgoglio(operatoreId: string, data: InsertMomentoOrgoglio): Promise<MomentoOrgoglio>;
  deleteMomentoOrgoglio(momentoId: string): Promise<void>;
  getAndamentoBenessere(operatoreId: string, mese: string): Promise<{ data: string; stato: StatoBenessere }[]>;
  
  getScambiEstesi(operatoreId: string): Promise<ScambioEsteso[]>;
  proponiScambio(operatoreId: string, data: InsertPropostaScambio): Promise<Scambio>;
  getPreferenzeScambio(operatoreId: string): Promise<PreferenzeScambio | undefined>;
  savePreferenzeScambio(operatoreId: string, data: InsertPreferenzeScambio): Promise<PreferenzeScambio>;
  inviaRingraziamento(operatoreId: string, data: InsertRingraziamentoScambio): Promise<RingraziamentoScambio>;
  getScambiStats(operatoreId: string): Promise<ScambiStats>;
  getTurniScambiabili(operatoreId: string): Promise<Turno[]>;
  
  getTurniEstesi(operatoreId: string): Promise<TurnoEsteso[]>;
  getTurnoEsteso(turnoId: string, operatoreId: string): Promise<TurnoEsteso | undefined>;
  getTurniStats(operatoreId: string): Promise<TurniStats>;
  completaPreparazione(turnoId: string, operatoreId: string): Promise<PreparazioneMentale>;
  
  getBadges(operatoreId: string): Promise<BadgeCompetenza[]>;
  getBadgeStats(operatoreId: string): Promise<BadgeStats>;
  
  getTabellone(sede: Sede, mese: string): Promise<TabelloneMese>;
  candidaTurno(operatoreId: string, data: InsertCandidatura): Promise<CandidaturaTurno>;
  ritiraCandidatura(candidaturaId: string): Promise<CandidaturaTurno>;
  getCandidature(operatoreId: string): Promise<CandidaturaTurno[]>;
  
  getProntezzaMissione(operatoreId: string): Promise<ProntezzaMissione>;
  completaAzioneProntezza(operatoreId: string, azioneId: string): Promise<MicroAzione>;
  
  getPartners(categoria?: CategoriaPartner): Promise<Partner[]>;
  getPartner(partnerId: string): Promise<Partner | undefined>;
  registraUtilizzoConvenzione(operatoreId: string, data: InsertConvenzioneUtilizzo): Promise<ConvenzioneUtilizzo>;
  getUtilizziConvenzione(operatoreId: string): Promise<ConvenzioneUtilizzo[]>;
  
  getTimbraturaOggi(operatoreId: string): Promise<Timbratura[]>;
  createTimbratura(operatoreId: string, data: InsertTimbratura): Promise<Timbratura>;
  annullaTimbratura(timbraturaId: string): Promise<Timbratura>;
  getTimbraturaGiornaliera(operatoreId: string, data: string): Promise<TimbraturaGiornaliera>;
  
  getDocumenti(operatoreId: string): Promise<Documento[]>;
  getDocumento(documentoId: string): Promise<Documento | undefined>;
  createDocumento(operatoreId: string, data: InsertDocumento): Promise<Documento>;
  updateDocumento(documentoId: string, data: Partial<InsertDocumento>): Promise<Documento>;
  deleteDocumento(documentoId: string): Promise<void>;
  getQRVerifica(operatoreId: string): Promise<QRVerifica>;
  
  getCircolari(): Promise<Circolare[]>;
  getCircolare(circolareId: string): Promise<Circolare | undefined>;
  getConfermeLettura(operatoreId: string): Promise<ConfermaLettura[]>;
  confermaLettura(operatoreId: string, data: InsertConfermaLettura): Promise<ConfermaLettura>;
  getCircolariNonLette(operatoreId: string): Promise<Circolare[]>;
  
  getCorsi(): Promise<Corso[]>;
  getCorso(corsoId: string): Promise<Corso | undefined>;
  getIscrizioniCorsi(operatoreId: string): Promise<IscrizioneCorso[]>;
  iscriviCorso(operatoreId: string, data: InsertIscrizioneCorso): Promise<IscrizioneCorso>;
  annullaIscrizioneCorso(iscrizioneId: string): Promise<IscrizioneCorso>;
  getStatoFormazioneOperatore(operatoreId: string): Promise<StatoFormazioneOperatore>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private operatori: Map<string, Operatore>;
  private turni: Map<string, Turno>;
  private scambi: Map<string, Scambio>;
  private crescita: Map<string, Crescita[]>;
  private azioni: Map<string, AzioneReversibile>;
  private karma: Map<string, KarmaScambi>;
  private milestones: Map<string, Milestone>;
  private disponibilita: Map<string, Disponibilita>;
  private ferieRichieste: Map<string, FerieRichiesta>;
  private pilloleFormative: Map<string, PillolaFormativa>;
  private progressoPillole: Map<string, ProgressoPillola>;
  private checkinBenessere: Map<string, CheckinBenessere>;
  private sessioniRespiro: Map<string, SessioneRespiro>;
  private riflessioni: Map<string, RiflessioneMensile>;
  private obiettivi: Map<string, ObiettivoPersonale>;
  private momentiOrgoglio: Map<string, MomentoOrgoglio>;
  private preferenzeScambio: Map<string, PreferenzeScambio>;
  private ringraziamenti: Map<string, RingraziamentoScambio>;
  private preparazioniMentali: Map<string, PreparazioneMentale>;
  private badges: Map<string, BadgeCompetenza>;
  private turniTabellone: Map<string, TurnoTabellone>;
  private candidature: Map<string, CandidaturaTurno>;
  private azioniProntezzaCompletate: Map<string, Set<string>>;
  private partners: Map<string, Partner>;
  private convenzioniUtilizzo: Map<string, ConvenzioneUtilizzo>;
  private timbrature: Map<string, Timbratura>;
  private documenti: Map<string, Documento>;
  private circolari: Map<string, Circolare>;
  private confermeLettura: Map<string, ConfermaLettura>;
  private corsi: Map<string, Corso>;
  private iscrizioniCorsi: Map<string, IscrizioneCorso>;
  
  private defaultOperatoreId = "op-001";

  constructor() {
    this.users = new Map();
    this.operatori = new Map();
    this.turni = new Map();
    this.scambi = new Map();
    this.crescita = new Map();
    this.azioni = new Map();
    this.karma = new Map();
    this.milestones = new Map();
    this.disponibilita = new Map();
    this.ferieRichieste = new Map();
    this.pilloleFormative = new Map();
    this.progressoPillole = new Map();
    this.checkinBenessere = new Map();
    this.sessioniRespiro = new Map();
    this.riflessioni = new Map();
    this.obiettivi = new Map();
    this.momentiOrgoglio = new Map();
    this.preferenzeScambio = new Map();
    this.ringraziamenti = new Map();
    this.preparazioniMentali = new Map();
    this.badges = new Map();
    this.turniTabellone = new Map();
    this.candidature = new Map();
    this.azioniProntezzaCompletate = new Map();
    this.partners = new Map();
    this.convenzioniUtilizzo = new Map();
    this.timbrature = new Map();
    this.documenti = new Map();
    this.circolari = new Map();
    this.confermeLettura = new Map();
    this.corsi = new Map();
    this.iscrizioniCorsi = new Map();
    
    this.initializeDefaultData();
    this.initializeDocumentiEFormazione();
    this.initializePartners();
    this.initializePilloleFormative();
    this.initializeBadges();
    this.initializeTabellone();
  }

  private initializeDefaultData() {
    // Demo user for login
    const demoUser: User = {
      id: "user-001",
      username: "marco",
      password: "demo123", // In production, this would be hashed
    };
    this.users.set(demoUser.id, demoUser);
    
    const operatore: Operatore = {
      id: this.defaultOperatoreId,
      nome: "Marco",
      cognome: "Rossi",
      ruolo: "Soccorritore",
      mansione: "soccorritore",
      sede: "Verona",
      categoriaRuolo: "volontario",
      dataInizio: "2022-03-15",
      turniCompletati: 247,
      giorniRiposo: 89,
      livelloEsperienza: 3,
    };
    this.operatori.set(operatore.id, operatore);

    const today = new Date();
    const generateShifts = (): Turno[] => {
      const shifts: Turno[] = [];
      const tipi: ('giorno' | 'notte' | 'riposo')[] = ['giorno', 'notte', 'riposo'];
      const luoghi = ['Sede Centrale', 'Postazione Nord', 'Postazione Sud', 'Ospedale San Raffaele'];
      const squadre = [
        ['Anna B.', 'Luca M.'],
        ['Giorgio P.', 'Silvia R.'],
        ['Paolo V.', 'Marta G.'],
        ['Sara L.', 'Marco T.'],
      ];

      for (let i = -3; i < 14; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const tipo = tipi[Math.floor(Math.abs(i + 5) % 3)];
        const isRest = tipo === 'riposo';
        
        const shift: Turno = {
          id: `turno-${i + 10}`,
          operatoreId: this.defaultOperatoreId,
          data: dateStr,
          oraInizio: tipo === 'giorno' ? '08:00' : tipo === 'notte' ? '20:00' : '00:00',
          oraFine: tipo === 'giorno' ? '20:00' : tipo === 'notte' ? '08:00' : '00:00',
          tipo,
          luogo: isRest ? '' : luoghi[Math.floor(Math.random() * luoghi.length)],
          ruoloTurno: isRest ? '' : 'Soccorritore',
          squadra: isRest ? [] : squadre[Math.floor(Math.random() * squadre.length)],
          qualita: {
            zonaTransquilla: Math.random() > 0.6,
            squadraPreferita: Math.random() > 0.5,
            seguitoDaRiposo: tipi[Math.floor(Math.abs(i + 6) % 3)] === 'riposo',
          },
        };
        shifts.push(shift);
        this.turni.set(shift.id, shift);
      }
      return shifts;
    };

    generateShifts();

    const scambio1: Scambio = {
      id: "scambio-001",
      turnoId: "turno-12",
      operatoreRichiedenteId: "op-002",
      sede: "Verona",
      mansioneRichiesta: "soccorritore",
      stato: "disponibile",
      motivoSuggerito: "Te lo proponiamo perché dopo questo turno hai 2 giorni di riposo.",
      dataCreazione: new Date().toISOString(),
      reversibile: true,
    };
    this.scambi.set(scambio1.id, scambio1);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);
    
    const crescitaData: Crescita[] = [
      {
        id: "crescita-001",
        operatoreId: this.defaultOperatoreId,
        mese: currentMonth,
        turniCompletati: 18,
        giorniRiposo: 8,
        scambiEffettuati: 2,
        continuita: 78,
        carico: "normale",
      },
      {
        id: "crescita-002",
        operatoreId: this.defaultOperatoreId,
        mese: lastMonth,
        turniCompletati: 16,
        giorniRiposo: 10,
        scambiEffettuati: 1,
        continuita: 72,
        carico: "leggero",
      },
    ];
    this.crescita.set(this.defaultOperatoreId, crescitaData);

    const azione1: AzioneReversibile = {
      id: "azione-001",
      operatoreId: this.defaultOperatoreId,
      tipo: "scambio",
      descrizione: "Hai proposto uno scambio per il turno del 15 dicembre",
      dataOra: new Date(Date.now() - 3600000).toISOString(),
      annullabile: true,
      annullata: false,
    };
    this.azioni.set(azione1.id, azione1);

    const karmaData: KarmaScambi = {
      operatoreId: this.defaultOperatoreId,
      favoriDati: 12,
      favoriRicevuti: 8,
    };
    this.karma.set(this.defaultOperatoreId, karmaData);

    const milestone1: Milestone = {
      id: "milestone-001",
      operatoreId: this.defaultOperatoreId,
      tipo: "turni_100",
      titolo: "100 turni completati",
      messaggio: "Hai raggiunto un traguardo importante nel tuo percorso",
      dataRaggiungimento: new Date(Date.now() - 86400000 * 30).toISOString(),
      celebrata: true,
    };
    this.milestones.set(milestone1.id, milestone1);

    const milestone2: Milestone = {
      id: "milestone-002",
      operatoreId: this.defaultOperatoreId,
      tipo: "aiuto_collega",
      titolo: "Hai aiutato un collega",
      messaggio: "Il tuo ultimo scambio ha fatto la differenza",
      dataRaggiungimento: new Date().toISOString(),
      celebrata: false,
    };
    this.milestones.set(milestone2.id, milestone2);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getOperatore(id: string): Promise<Operatore | undefined> {
    return this.operatori.get(id) || this.operatori.get(this.defaultOperatoreId);
  }

  async getStatoOggi(operatoreId: string): Promise<StatoOggi> {
    const today = new Date().toISOString().split('T')[0];
    const turni = Array.from(this.turni.values())
      .filter(t => t.operatoreId === (operatoreId || this.defaultOperatoreId))
      .sort((a, b) => a.data.localeCompare(b.data));
    
    const turnoOggi = turni.find(t => t.data === today);
    const prossimoTurnoNonRiposo = turni.find(t => t.data >= today && t.tipo !== 'riposo');
    
    let giorniRiposoConsecutivi = 0;
    const todayIndex = turni.findIndex(t => t.data === today);
    if (todayIndex >= 0 && turni[todayIndex]?.tipo === 'riposo') {
      for (let i = todayIndex; i < turni.length; i++) {
        if (turni[i].tipo === 'riposo') {
          giorniRiposoConsecutivi++;
        } else {
          break;
        }
      }
    }

    const deviPreoccuparti = turnoOggi?.tipo !== 'riposo';
    
    return {
      deviPreoccuparti,
      messaggio: deviPreoccuparti 
        ? `Hai un turno ${turnoOggi?.tipo === 'giorno' ? 'di giorno' : 'di notte'} oggi`
        : giorniRiposoConsecutivi > 0 
          ? 'Goditi il tuo riposo'
          : 'Nessun impegno per oggi',
      prossimoTurno: prossimoTurnoNonRiposo || turnoOggi,
      giorniRiposoConsecutivi,
      suggerimenti: prossimoTurnoNonRiposo?.qualita.seguitoDaRiposo ? [{
        testo: "Il tuo prossimo turno è seguito da riposo",
        perche: "Te lo segnaliamo per aiutarti a pianificare"
      }] : [],
    };
  }

  async getTurni(operatoreId: string): Promise<Turno[]> {
    return Array.from(this.turni.values())
      .filter(t => t.operatoreId === (operatoreId || this.defaultOperatoreId))
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  async getTurno(id: string): Promise<Turno | undefined> {
    return this.turni.get(id);
  }

  async getScambi(operatoreId: string): Promise<(Scambio & { turno: Turno })[]> {
    const scambiList = Array.from(this.scambi.values());
    return scambiList.map(s => ({
      ...s,
      turno: this.turni.get(s.turnoId)!,
    })).filter(s => s.turno);
  }

  async createScambio(turnoId: string, operatoreId: string, motivo?: string): Promise<Scambio> {
    const operatore = await this.getOperatore(operatoreId);
    const scambio: Scambio = {
      id: randomUUID(),
      turnoId,
      operatoreRichiedenteId: operatoreId,
      sede: operatore?.sede || 'Verona',
      mansioneRichiesta: operatore?.mansione || 'soccorritore',
      stato: "disponibile",
      motivoSuggerito: motivo,
      dataCreazione: new Date().toISOString(),
      reversibile: true,
    };
    this.scambi.set(scambio.id, scambio);
    
    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId,
      tipo: "scambio",
      descrizione: "Hai proposto uno scambio",
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false,
    };
    this.azioni.set(azione.id, azione);
    
    return scambio;
  }

  async accettaScambio(scambioId: string, operatoreId: string): Promise<Scambio> {
    const scambio = this.scambi.get(scambioId);
    if (!scambio) throw new Error("Scambio non trovato");
    
    scambio.stato = "accettato";
    scambio.operatoreAccettanteId = operatoreId;
    this.scambi.set(scambioId, scambio);
    
    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId,
      tipo: "scambio",
      descrizione: "Hai accettato uno scambio",
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false,
    };
    this.azioni.set(azione.id, azione);
    
    return scambio;
  }

  async annullaScambio(scambioId: string): Promise<Scambio> {
    const scambio = this.scambi.get(scambioId);
    if (!scambio) throw new Error("Scambio non trovato");
    
    scambio.stato = "annullato";
    scambio.reversibile = false;
    this.scambi.set(scambioId, scambio);
    
    return scambio;
  }

  async getCrescita(operatoreId: string): Promise<Crescita[]> {
    return this.crescita.get(operatoreId || this.defaultOperatoreId) || [];
  }

  async getAzioni(operatoreId: string): Promise<AzioneReversibile[]> {
    return Array.from(this.azioni.values())
      .filter(a => a.operatoreId === (operatoreId || this.defaultOperatoreId))
      .sort((a, b) => new Date(b.dataOra).getTime() - new Date(a.dataOra).getTime());
  }

  async annullaAzione(azioneId: string): Promise<AzioneReversibile> {
    const azione = this.azioni.get(azioneId);
    if (!azione) throw new Error("Azione non trovata");
    
    azione.annullata = true;
    azione.annullabile = false;
    this.azioni.set(azioneId, azione);
    
    return azione;
  }

  async getKarma(operatoreId: string): Promise<KarmaScambi> {
    return this.karma.get(operatoreId || this.defaultOperatoreId) || {
      operatoreId: operatoreId || this.defaultOperatoreId,
      favoriDati: 0,
      favoriRicevuti: 0,
    };
  }

  async getMilestones(operatoreId: string): Promise<Milestone[]> {
    return Array.from(this.milestones.values())
      .filter(m => m.operatoreId === (operatoreId || this.defaultOperatoreId))
      .sort((a, b) => new Date(b.dataRaggiungimento).getTime() - new Date(a.dataRaggiungimento).getTime());
  }

  async celebrateMilestone(milestoneId: string): Promise<Milestone> {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone) throw new Error("Milestone non trovata");
    
    milestone.celebrata = true;
    this.milestones.set(milestoneId, milestone);
    
    return milestone;
  }

  async getDisponibilita(operatoreId: string, meseRiferimento: string): Promise<Disponibilita | undefined> {
    return Array.from(this.disponibilita.values()).find(
      d => d.operatoreId === operatoreId && d.meseRiferimento === meseRiferimento
    );
  }

  async createDisponibilita(operatoreId: string, data: InsertDisponibilita): Promise<Disponibilita> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const meseRiferimento = nextMonth.toISOString().slice(0, 7);

    const existing = await this.getDisponibilita(operatoreId, meseRiferimento);
    if (existing && existing.stato !== 'ritirata') {
      existing.livelloEnergia = data.livelloEnergia;
      existing.giornateDisponibili = data.giornateDisponibili;
      existing.noteProtezione = data.noteProtezione;
      existing.stato = 'bozza';
      this.disponibilita.set(existing.id, existing);
      return existing;
    }

    const disponibilita: Disponibilita = {
      id: randomUUID(),
      operatoreId,
      meseRiferimento,
      livelloEnergia: data.livelloEnergia,
      giornateDisponibili: data.giornateDisponibili,
      noteProtezione: data.noteProtezione,
      stato: 'bozza',
      dataCreazione: new Date().toISOString(),
    };
    this.disponibilita.set(disponibilita.id, disponibilita);
    return disponibilita;
  }

  async inviaDisponibilita(disponibilitaId: string): Promise<Disponibilita> {
    const disponibilita = this.disponibilita.get(disponibilitaId);
    if (!disponibilita) throw new Error("Disponibilita non trovata");
    
    disponibilita.stato = 'inviata';
    disponibilita.dataInvio = new Date().toISOString();
    this.disponibilita.set(disponibilitaId, disponibilita);

    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId: disponibilita.operatoreId,
      tipo: "disponibilita",
      descrizione: "Hai inviato la tua disponibilità per il prossimo mese",
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false,
    };
    this.azioni.set(azione.id, azione);
    
    return disponibilita;
  }

  async ritiraDisponibilita(disponibilitaId: string): Promise<Disponibilita> {
    const disponibilita = this.disponibilita.get(disponibilitaId);
    if (!disponibilita) throw new Error("Disponibilita non trovata");
    
    disponibilita.stato = 'ritirata';
    this.disponibilita.set(disponibilitaId, disponibilita);
    
    return disponibilita;
  }

  async getFerieRichieste(operatoreId: string): Promise<FerieRichiesta[]> {
    return Array.from(this.ferieRichieste.values())
      .filter(f => f.operatoreId === operatoreId)
      .sort((a, b) => new Date(b.dataCreazione).getTime() - new Date(a.dataCreazione).getTime());
  }

  async createFerieRichiesta(operatoreId: string, data: InsertFerieRichiesta): Promise<FerieRichiesta> {
    const richiesta: FerieRichiesta = {
      id: randomUUID(),
      operatoreId,
      dataInizio: data.dataInizio,
      dataFine: data.dataFine,
      motivazione: data.motivazione,
      stato: 'in_attesa',
      dataCreazione: new Date().toISOString(),
    };
    this.ferieRichieste.set(richiesta.id, richiesta);

    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId,
      tipo: "disponibilita",
      descrizione: `Hai richiesto ferie dal ${data.dataInizio} al ${data.dataFine}`,
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false,
    };
    this.azioni.set(azione.id, azione);

    return richiesta;
  }

  async ritiraFerieRichiesta(richiestaId: string): Promise<FerieRichiesta> {
    const richiesta = this.ferieRichieste.get(richiestaId);
    if (!richiesta) throw new Error("Richiesta ferie non trovata");
    
    richiesta.stato = 'ritirata';
    this.ferieRichieste.set(richiestaId, richiesta);
    
    return richiesta;
  }

  async getScambiFiltered(operatoreId: string): Promise<(Scambio & { turno: Turno })[]> {
    const operatore = await this.getOperatore(operatoreId);
    if (!operatore) return [];

    const scambiList = Array.from(this.scambi.values());
    
    return scambiList
      .filter(s => {
        if (s.sede !== operatore.sede) return false;
        if (operatore.mansione === 'autista') {
          return true;
        }
        return s.mansioneRichiesta === 'soccorritore';
      })
      .map(s => ({
        ...s,
        turno: this.turni.get(s.turnoId)!,
      }))
      .filter(s => s.turno);
  }

  private initializePilloleFormative() {
    const pillole: PillolaFormativa[] = [
      // Tecniche di Soccorso
      {
        id: "pill-ts-001",
        categoria: "tecniche_soccorso",
        titolo: "Immobilizzazione spinale rapida",
        durata: 2,
        scenario: "Arrivi su un incidente stradale. Il paziente lamenta dolore al collo dopo un tamponamento. Come procedi?",
        perche: "Una corretta immobilizzazione spinale riduce del 60% il rischio di danni permanenti in caso di trauma cervicale.",
        consiglio: "Mantieni sempre la testa in posizione neutra mentre un collega prepara il collare. Mai ruotare il collo del paziente.",
        ordine: 1
      },
      {
        id: "pill-ts-002",
        categoria: "tecniche_soccorso",
        titolo: "Valutazione primaria ABCDE",
        durata: 3,
        scenario: "Trovi una persona a terra incosciente. Quali sono i primi passi da seguire?",
        perche: "Il protocollo ABCDE garantisce che le priorità salvavita vengano affrontate nell'ordine corretto.",
        consiglio: "A-Airway, B-Breathing, C-Circulation, D-Disability, E-Exposure. Segui sempre questo ordine.",
        ordine: 2
      },
      // Comunicazione Paziente
      {
        id: "pill-cp-001",
        categoria: "comunicazione_paziente",
        titolo: "Calmare un paziente agitato",
        durata: 2,
        scenario: "Il paziente è molto agitato dopo l'incidente e urla. Non riesci a valutarlo. Cosa fai?",
        perche: "Un paziente calmo collabora meglio e permette una valutazione più accurata delle sue condizioni.",
        consiglio: "Abbassati al suo livello visivo, parla con tono calmo e basso, usa il suo nome. Mai alzare la voce.",
        ordine: 1
      },
      {
        id: "pill-cp-002",
        categoria: "comunicazione_paziente",
        titolo: "Comunicare con i familiari",
        durata: 2,
        scenario: "I familiari del paziente sono in ansia e ti bombardano di domande. Come gestisci la situazione?",
        perche: "Familiari informati sono familiari che collaborano e non ostacolano il soccorso.",
        consiglio: "Designa un collega per parlare con loro. Dai informazioni essenziali senza promesse. 'Stiamo facendo tutto il possibile.'",
        ordine: 2
      },
      // Gestione Stress
      {
        id: "pill-gs-001",
        categoria: "gestione_stress",
        titolo: "Respirazione tattica 4-7-8",
        durata: 2,
        scenario: "Hai appena finito un intervento difficile. Senti il cuore che batte forte e le mani tremano.",
        perche: "La respirazione controllata attiva il sistema parasimpatico e riduce il cortisolo in pochi minuti.",
        consiglio: "Inspira per 4 secondi, trattieni per 7, espira per 8. Ripeti 3 volte. Funziona anche in ambulanza.",
        ordine: 1
      },
      {
        id: "pill-gs-002",
        categoria: "gestione_stress",
        titolo: "Decompressione post-turno",
        durata: 3,
        scenario: "Finisci un turno notturno con 3 interventi impegnativi. Come ti prepari a tornare a casa?",
        perche: "Portare lo stress a casa compromette il riposo e le relazioni personali.",
        consiglio: "Prima di scendere dalla macchina, fai 5 respiri profondi. Lascia mentalmente il turno in ambulanza.",
        ordine: 2
      },
      // Lavoro in Squadra
      {
        id: "pill-ls-001",
        categoria: "lavoro_squadra",
        titolo: "Comunicazione closed-loop",
        durata: 2,
        scenario: "Stai facendo un massaggio cardiaco e chiedi al collega l'adrenalina. Lui annuisce ma non risponde.",
        perche: "La comunicazione closed-loop riduce gli errori del 37% durante le emergenze.",
        consiglio: "Chi riceve un ordine deve ripeterlo: 'Adrenalina 1mg, confermo.' Chi dà l'ordine aspetta conferma.",
        ordine: 1
      },
      {
        id: "pill-ls-002",
        categoria: "lavoro_squadra",
        titolo: "Briefing di 30 secondi",
        durata: 2,
        scenario: "State partendo per un intervento. In ambulanza avete 5 minuti. Come li usate?",
        perche: "Un briefing rapido allinea la squadra e anticipa i problemi prima che diventino emergenze.",
        consiglio: "Chi guida, chi entra, ruoli. 30 secondi. 'Io valuto, tu prepari i monitor, lui gestisce i familiari.'",
        ordine: 2
      },
      // Sicurezza Personale
      {
        id: "pill-sp-001",
        categoria: "sicurezza_personale",
        titolo: "Valutazione della scena",
        durata: 2,
        scenario: "Arrivate di notte in una zona poco illuminata. Qualcuno vi ha chiamato ma non vedete nessuno.",
        perche: "Il soccorritore ferito non può aiutare nessuno. La tua sicurezza viene prima.",
        consiglio: "Mai entrare se la scena non è sicura. Chiedi supporto forze dell'ordine. Aspetta in ambulanza.",
        ordine: 1
      },
      {
        id: "pill-sp-002",
        categoria: "sicurezza_personale",
        titolo: "Sollevamento sicuro del paziente",
        durata: 3,
        scenario: "Dovete trasportare un paziente di 100kg per le scale. Siete in due.",
        perche: "Il mal di schiena è la causa numero uno di infortuni tra i soccorritori.",
        consiglio: "Piega le ginocchia, non la schiena. Conta insieme al collega: 'Pronti? 1, 2, 3, su!'",
        ordine: 2
      },
      // Aggiornamenti Normativi
      {
        id: "pill-an-001",
        categoria: "aggiornamenti_normativi",
        titolo: "Consenso informato in emergenza",
        durata: 2,
        scenario: "Il paziente è cosciente ma rifiuta il trasporto in ospedale nonostante i sintomi gravi.",
        perche: "Rispettare la volontà del paziente è un obbligo legale, ma devi proteggerti documentando.",
        consiglio: "Spiega i rischi, fai firmare il rifiuto, documenta tutto. Se incosciente, agisci per il suo bene.",
        ordine: 1
      },
      {
        id: "pill-an-002",
        categoria: "aggiornamenti_normativi",
        titolo: "Privacy e dati sanitari",
        durata: 2,
        scenario: "Un giornalista ti chiede informazioni su un incidente mentre stai caricando il paziente.",
        perche: "Violare la privacy sanitaria può portare a conseguenze legali per te e per l'associazione.",
        consiglio: "Nessuna informazione a nessuno che non sia personale sanitario. 'Mi dispiace, non posso rispondere.'",
        ordine: 2
      },
    ];

    pillole.forEach(p => this.pilloleFormative.set(p.id, p));

    // Add some demo progress for the user
    const progress1: ProgressoPillola = {
      id: randomUUID(),
      operatoreId: this.defaultOperatoreId,
      pillolaId: "pill-ts-001",
      completata: true,
      dataCompletamento: new Date(Date.now() - 86400000 * 3).toISOString()
    };
    const progress2: ProgressoPillola = {
      id: randomUUID(),
      operatoreId: this.defaultOperatoreId,
      pillolaId: "pill-gs-001",
      completata: true,
      dataCompletamento: new Date(Date.now() - 86400000 * 1).toISOString()
    };
    this.progressoPillole.set(progress1.id, progress1);
    this.progressoPillole.set(progress2.id, progress2);
  }

  async getPilloleFormative(): Promise<PillolaFormativa[]> {
    return Array.from(this.pilloleFormative.values()).sort((a, b) => a.ordine - b.ordine);
  }

  async getPilloleByCategoria(categoria: CategoriaFormazione): Promise<PillolaFormativa[]> {
    return Array.from(this.pilloleFormative.values())
      .filter(p => p.categoria === categoria)
      .sort((a, b) => a.ordine - b.ordine);
  }

  async getStatoFormazione(operatoreId: string): Promise<StatoFormazione> {
    const progressi = Array.from(this.progressoPillole.values())
      .filter(p => p.operatoreId === operatoreId && p.completata);
    
    const pilloleCompletateIds = new Set(progressi.map(p => p.pillolaId));
    
    const categorie = CATEGORIE_FORMAZIONE.map(categoria => {
      const pilloleCategoria = Array.from(this.pilloleFormative.values())
        .filter(p => p.categoria === categoria);
      const completate = pilloleCategoria.filter(p => pilloleCompletateIds.has(p.id));
      
      const ultimoProgress = progressi
        .filter(p => pilloleCategoria.some(pc => pc.id === p.pillolaId))
        .sort((a, b) => new Date(b.dataCompletamento!).getTime() - new Date(a.dataCompletamento!).getTime())[0];
      
      let stato: 'base' | 'aggiornato' | 'fresco' = 'base';
      if (completate.length > 0) {
        const daysSinceUpdate = ultimoProgress 
          ? Math.floor((Date.now() - new Date(ultimoProgress.dataCompletamento!).getTime()) / 86400000)
          : 999;
        if (daysSinceUpdate <= 7) stato = 'fresco';
        else if (daysSinceUpdate <= 30) stato = 'aggiornato';
      }
      
      return {
        categoria,
        pilloleCompletate: completate.length,
        pilloleTotali: pilloleCategoria.length,
        stato,
        ultimoAggiornamento: ultimoProgress?.dataCompletamento
      };
    });
    
    const minutiTotali = progressi.reduce((acc, p) => {
      const pillola = this.pilloleFormative.get(p.pillolaId);
      return acc + (pillola?.durata || 0);
    }, 0);
    
    // Calculate streak (simplified)
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const dateSet = new Set(progressi.map(p => p.dataCompletamento?.split('T')[0]).filter(Boolean) as string[]);
    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    
    if (sortedDates[0] === today || sortedDates[0] === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
      streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]!);
        const currDate = new Date(sortedDates[i]!);
        const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
        if (diffDays === 1) streak++;
        else break;
      }
    }
    
    return {
      operatoreId,
      categorie,
      minutiTotali,
      streak
    };
  }

  async completaPillola(operatoreId: string, pillolaId: string): Promise<ProgressoPillola> {
    const existing = Array.from(this.progressoPillole.values())
      .find(p => p.operatoreId === operatoreId && p.pillolaId === pillolaId);
    
    if (existing) {
      existing.completata = true;
      existing.dataCompletamento = new Date().toISOString();
      this.progressoPillole.set(existing.id, existing);
      return existing;
    }
    
    const progress: ProgressoPillola = {
      id: randomUUID(),
      operatoreId,
      pillolaId,
      completata: true,
      dataCompletamento: new Date().toISOString()
    };
    this.progressoPillole.set(progress.id, progress);
    return progress;
  }

  async getCheckinOggi(operatoreId: string): Promise<CheckinBenessere | undefined> {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.checkinBenessere.values())
      .find(c => c.operatoreId === operatoreId && c.data === today);
  }

  async createCheckin(operatoreId: string, stato: StatoBenessere): Promise<CheckinBenessere> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getCheckinOggi(operatoreId);
    
    if (existing) {
      existing.stato = stato;
      existing.dataOra = new Date().toISOString();
      this.checkinBenessere.set(existing.id, existing);
      return existing;
    }
    
    const checkin: CheckinBenessere = {
      id: randomUUID(),
      operatoreId,
      data: today,
      stato,
      dataOra: new Date().toISOString()
    };
    this.checkinBenessere.set(checkin.id, checkin);
    return checkin;
  }

  async createSessioneRespiro(operatoreId: string, durataSecondi: number): Promise<SessioneRespiro> {
    const sessione: SessioneRespiro = {
      id: randomUUID(),
      operatoreId,
      dataOra: new Date().toISOString(),
      durataSecondi,
      completata: true
    };
    this.sessioniRespiro.set(sessione.id, sessione);
    return sessione;
  }

  async getSessioniRespiroSettimana(operatoreId: string): Promise<number> {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return Array.from(this.sessioniRespiro.values())
      .filter(s => s.operatoreId === operatoreId && new Date(s.dataOra) >= weekAgo && s.completata)
      .length;
  }

  async getStatoOggiEsteso(operatoreId: string): Promise<StatoOggiEsteso> {
    const statoBase = await this.getStatoOggi(operatoreId);
    const checkinOggi = await this.getCheckinOggi(operatoreId);
    const sessioniSettimana = await this.getSessioniRespiroSettimana(operatoreId);
    
    const today = new Date().toISOString().split('T')[0];
    const turnoOggi = Array.from(this.turni.values())
      .find(t => t.operatoreId === operatoreId && t.data === today && t.tipo !== 'riposo');
    
    const prossimoTurnoConSquadra = Array.from(this.turni.values())
      .filter(t => t.operatoreId === operatoreId && t.data >= today && t.tipo !== 'riposo' && t.squadra && t.squadra.length > 0)
      .sort((a, b) => a.data.localeCompare(b.data))[0];
    
    let teamOggi: { nome: string; ruolo: string }[] = [];
    if (turnoOggi?.squadra && turnoOggi.squadra.length > 0) {
      teamOggi = turnoOggi.squadra.map((nome, i) => ({
        nome,
        ruolo: i === 0 ? 'Autista' : 'Soccorritore'
      }));
    } else if (prossimoTurnoConSquadra?.squadra && prossimoTurnoConSquadra.squadra.length > 0) {
      teamOggi = prossimoTurnoConSquadra.squadra.map((nome, i) => ({
        nome,
        ruolo: i === 0 ? 'Autista' : 'Soccorritore'
      }));
    }
    
    const ultimoRespiro = Array.from(this.sessioniRespiro.values())
      .filter(s => s.operatoreId === operatoreId)
      .sort((a, b) => new Date(b.dataOra).getTime() - new Date(a.dataOra).getTime())[0];
    
    return {
      ...statoBase,
      checkinOggi,
      teamOggi: teamOggi.length > 0 ? teamOggi : undefined,
      protezioneAttiva: statoBase.giorniRiposoConsecutivi > 0,
      ultimoRespiro: ultimoRespiro?.dataOra,
      sessioniRespiroSettimana: sessioniSettimana
    };
  }

  async getRiflessione(operatoreId: string, mese: string): Promise<RiflessioneMensile | undefined> {
    return Array.from(this.riflessioni.values())
      .find(r => r.operatoreId === operatoreId && r.mese === mese);
  }

  async createRiflessione(operatoreId: string, data: InsertRiflessione): Promise<RiflessioneMensile> {
    const existing = await this.getRiflessione(operatoreId, data.mese);
    if (existing) {
      existing.cosaBeneAndata = data.cosaBeneAndata;
      existing.cosaDifficile = data.cosaDifficile;
      this.riflessioni.set(existing.id, existing);
      return existing;
    }
    
    const riflessione: RiflessioneMensile = {
      id: randomUUID(),
      operatoreId,
      mese: data.mese,
      cosaBeneAndata: data.cosaBeneAndata,
      cosaDifficile: data.cosaDifficile,
      dataCreazione: new Date().toISOString()
    };
    this.riflessioni.set(riflessione.id, riflessione);
    return riflessione;
  }

  async getObiettivo(operatoreId: string, mese: string): Promise<ObiettivoPersonale | undefined> {
    return Array.from(this.obiettivi.values())
      .find(o => o.operatoreId === operatoreId && o.mese === mese);
  }

  async createObiettivo(operatoreId: string, data: InsertObiettivo): Promise<ObiettivoPersonale> {
    const existing = await this.getObiettivo(operatoreId, data.mese);
    if (existing) {
      existing.testo = data.testo;
      this.obiettivi.set(existing.id, existing);
      return existing;
    }
    
    const obiettivo: ObiettivoPersonale = {
      id: randomUUID(),
      operatoreId,
      mese: data.mese,
      testo: data.testo,
      raggiunto: false,
      dataCreazione: new Date().toISOString()
    };
    this.obiettivi.set(obiettivo.id, obiettivo);
    return obiettivo;
  }

  async toggleObiettivoRaggiunto(obiettivoId: string): Promise<ObiettivoPersonale> {
    const obiettivo = this.obiettivi.get(obiettivoId);
    if (!obiettivo) throw new Error("Obiettivo non trovato");
    obiettivo.raggiunto = !obiettivo.raggiunto;
    this.obiettivi.set(obiettivoId, obiettivo);
    return obiettivo;
  }

  async getMomentiOrgoglio(operatoreId: string): Promise<MomentoOrgoglio[]> {
    return Array.from(this.momentiOrgoglio.values())
      .filter(m => m.operatoreId === operatoreId)
      .sort((a, b) => new Date(b.dataCreazione).getTime() - new Date(a.dataCreazione).getTime());
  }

  async createMomentoOrgoglio(operatoreId: string, data: InsertMomentoOrgoglio): Promise<MomentoOrgoglio> {
    const momento: MomentoOrgoglio = {
      id: randomUUID(),
      operatoreId,
      testo: data.testo,
      data: data.data,
      dataCreazione: new Date().toISOString()
    };
    this.momentiOrgoglio.set(momento.id, momento);
    return momento;
  }

  async deleteMomentoOrgoglio(momentoId: string): Promise<void> {
    this.momentiOrgoglio.delete(momentoId);
  }

  async getAndamentoBenessere(operatoreId: string, mese: string): Promise<{ data: string; stato: StatoBenessere }[]> {
    const [year, month] = mese.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return Array.from(this.checkinBenessere.values())
      .filter(c => {
        const d = new Date(c.data);
        return c.operatoreId === operatoreId && d >= startDate && d <= endDate;
      })
      .map(c => ({ data: c.data, stato: c.stato }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  async getCrescitaEstesa(operatoreId: string, mese: string): Promise<CrescitaEstesa | undefined> {
    const crescitaList = this.crescita.get(operatoreId) || [];
    const base = crescitaList.find(c => c.mese === mese);
    if (!base) return undefined;

    const riflessione = await this.getRiflessione(operatoreId, mese);
    const obiettivo = await this.getObiettivo(operatoreId, mese);
    const momenti = await this.getMomentiOrgoglio(operatoreId);
    const andamento = await this.getAndamentoBenessere(operatoreId, mese);
    
    let mediaEnergia: 'bassa' | 'media' | 'alta' | null = null;
    if (andamento.length > 0) {
      const scores = andamento.map(a => a.stato === 'stanco' ? 1 : a.stato === 'ok' ? 2 : 3);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      mediaEnergia = avg < 1.67 ? 'bassa' : avg < 2.34 ? 'media' : 'alta';
    }

    return {
      ...base,
      riflessione,
      obiettivo,
      momentiOrgoglio: momenti.slice(0, 5),
      andamentoBenessere: andamento,
      mediaEnergia
    };
  }

  async getScambiEstesi(operatoreId: string): Promise<ScambioEsteso[]> {
    const scambiList = Array.from(this.scambi.values());
    const now = new Date();
    const operatore = await this.getOperatore(operatoreId);
    
    return scambiList.map(s => {
      const turno = this.turni.get(s.turnoId);
      if (!turno) return null;
      
      const turnoDate = new Date(turno.data + 'T' + turno.oraInizio);
      const oreRimanenti = Math.max(0, Math.floor((turnoDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
      
      let urgenza: LivelloUrgenza = 'normale';
      if (oreRimanenti < 12) urgenza = 'critico';
      else if (oreRimanenti < 48) urgenza = 'urgente';
      
      let matchScore: number | undefined;
      if (s.stato === 'disponibile' && operatore) {
        matchScore = 50;
        if (s.sede === operatore.sede) matchScore += 25;
        if (s.mansioneRichiesta === operatore.mansione || operatore.mansione === 'autista') matchScore += 25;
      }
      
      const richiedente = this.operatori.get(s.operatoreRichiedenteId);
      const ringraziamento = Array.from(this.ringraziamenti.values())
        .find(r => r.scambioId === s.id);
      
      return {
        ...s,
        turno,
        matchScore,
        urgenza,
        oreRimanenti,
        nomeRichiedente: richiedente ? `${richiedente.nome} ${richiedente.cognome.charAt(0)}.` : undefined,
        ringraziamento: ringraziamento?.messaggio
      } as ScambioEsteso;
    }).filter(Boolean) as ScambioEsteso[];
  }

  async proponiScambio(operatoreId: string, data: InsertPropostaScambio): Promise<Scambio> {
    const turno = this.turni.get(data.turnoId);
    if (!turno) throw new Error("Turno non trovato");
    
    const operatore = await this.getOperatore(operatoreId);
    
    const scambio: Scambio = {
      id: randomUUID(),
      turnoId: data.turnoId,
      operatoreRichiedenteId: operatoreId,
      sede: operatore?.sede || 'Verona',
      mansioneRichiesta: operatore?.mansione || 'soccorritore',
      stato: 'disponibile',
      motivoSuggerito: data.motivo,
      dataCreazione: new Date().toISOString(),
      reversibile: true
    };
    
    this.scambi.set(scambio.id, scambio);
    
    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId,
      tipo: 'scambio',
      descrizione: `Hai proposto uno scambio per il turno del ${new Date(turno.data).toLocaleDateString('it-IT')}`,
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false
    };
    this.azioni.set(azione.id, azione);
    
    return scambio;
  }

  async getPreferenzeScambio(operatoreId: string): Promise<PreferenzeScambio | undefined> {
    return this.preferenzeScambio.get(operatoreId);
  }

  async savePreferenzeScambio(operatoreId: string, data: InsertPreferenzeScambio): Promise<PreferenzeScambio> {
    const existing = this.preferenzeScambio.get(operatoreId);
    const preferenze: PreferenzeScambio = {
      id: existing?.id || randomUUID(),
      operatoreId,
      sediDisponibili: data.sediDisponibili,
      mansioniDisponibili: data.mansioniDisponibili,
      maxDistanzaKm: data.maxDistanzaKm,
      notificheUrgenti: data.notificheUrgenti
    };
    this.preferenzeScambio.set(operatoreId, preferenze);
    return preferenze;
  }

  async inviaRingraziamento(operatoreId: string, data: InsertRingraziamentoScambio): Promise<RingraziamentoScambio> {
    const scambio = this.scambi.get(data.scambioId);
    if (!scambio) throw new Error("Scambio non trovato");
    
    const ringraziamento: RingraziamentoScambio = {
      id: randomUUID(),
      scambioId: data.scambioId,
      daOperatoreId: operatoreId,
      aOperatoreId: scambio.operatoreAccettanteId || scambio.operatoreRichiedenteId,
      messaggio: data.messaggio,
      dataCreazione: new Date().toISOString()
    };
    this.ringraziamenti.set(ringraziamento.id, ringraziamento);
    
    const karma = this.karma.get(ringraziamento.aOperatoreId) || {
      operatoreId: ringraziamento.aOperatoreId,
      favoriDati: 0,
      favoriRicevuti: 0
    };
    karma.favoriRicevuti++;
    this.karma.set(ringraziamento.aOperatoreId, karma);
    
    return ringraziamento;
  }

  async getScambiStats(operatoreId: string): Promise<ScambiStats> {
    const scambiList = Array.from(this.scambi.values());
    const proposti = scambiList.filter(s => s.operatoreRichiedenteId === operatoreId);
    const accettati = scambiList.filter(s => s.operatoreAccettanteId === operatoreId && s.stato === 'accettato');
    
    const colleghiAiutati = new Set(
      [...proposti.filter(s => s.stato === 'accettato').map(s => s.operatoreAccettanteId),
       ...accettati.map(s => s.operatoreRichiedenteId)]
    ).size;
    
    return {
      scambiCompletati: proposti.filter(s => s.stato === 'accettato').length + accettati.length,
      scambiProposti: proposti.length,
      tempoMedioAccettazione: 45,
      affidabilita: 95,
      colleghiAiutati
    };
  }

  async getTurniScambiabili(operatoreId: string): Promise<Turno[]> {
    const today = new Date().toISOString().split('T')[0];
    const turni = Array.from(this.turni.values())
      .filter(t => 
        t.operatoreId === operatoreId && 
        t.data >= today && 
        t.tipo !== 'riposo'
      )
      .sort((a, b) => a.data.localeCompare(b.data));
    
    const turniGiaInScambio = new Set(
      Array.from(this.scambi.values())
        .filter(s => s.stato !== 'annullato')
        .map(s => s.turnoId)
    );
    
    return turni.filter(t => !turniGiaInScambio.has(t.id));
  }

  private generateCountdown(turno: Turno): CountdownIntelligente {
    const now = new Date();
    const turnoStart = new Date(`${turno.data}T${turno.oraInizio}`);
    const turnoEnd = new Date(`${turno.data}T${turno.oraFine}`);
    
    const diffMs = turnoStart.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const oreRimanenti = Math.floor(diffMins / 60);
    const minutiRimanenti = diffMins % 60;
    
    let fase: CountdownIntelligente['fase'];
    let suggerimento: string;
    let azione: CountdownIntelligente['azione'] | undefined;
    
    if (now >= turnoStart && now <= turnoEnd) {
      fase = 'in_corso';
      suggerimento = 'Il turno è in corso. Concentrati sul momento presente.';
    } else if (now > turnoEnd) {
      fase = 'completato';
      suggerimento = 'Turno completato. Prenditi un momento per recuperare.';
    } else if (oreRimanenti < 1) {
      fase = 'imminente';
      suggerimento = 'Tra poco si inizia. Fai qualche respiro profondo.';
      azione = { tipo: 'respiro', label: 'Respiro rapido' };
    } else if (oreRimanenti < 4) {
      fase = 'preparazione';
      suggerimento = 'È il momento di prepararti mentalmente.';
      azione = { tipo: 'preparazione', label: 'Prepara la mente' };
    } else if (oreRimanenti < 12) {
      fase = 'preparazione';
      suggerimento = 'Hai ancora tempo. Riposati e idratati.';
      azione = { tipo: 'riposo', label: 'Promemoria riposo' };
    } else {
      fase = 'distante';
      suggerimento = 'Il turno è ancora lontano. Goditi il tempo libero.';
    }
    
    return {
      oreRimanenti: Math.max(0, oreRimanenti),
      minutiRimanenti: Math.max(0, minutiRimanenti),
      fase,
      suggerimento,
      azione
    };
  }

  private generatePrevisione(turno: Turno): PrevisioneQualita {
    const dayOfWeek = new Date(turno.data).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const meteoOptions: PrevisioneQualita['fattori']['meteo'][] = ['favorevole', 'variabile', 'avverso'];
    const meteo = meteoOptions[Math.floor(Math.random() * meteoOptions.length)];
    
    const storico = turno.tipo === 'notte' 
      ? 60 + Math.floor(Math.random() * 20) 
      : 70 + Math.floor(Math.random() * 20);
    
    const teamSinergia = turno.qualita.squadraPreferita 
      ? 85 + Math.floor(Math.random() * 15) 
      : 60 + Math.floor(Math.random() * 25);
    
    let livello: LivelloIntensita;
    const avgScore = (storico + teamSinergia) / 2;
    if (avgScore >= 75 && meteo === 'favorevole') {
      livello = 'sereno';
    } else if (avgScore < 60 || meteo === 'avverso' || isWeekend) {
      livello = 'intenso';
    } else {
      livello = 'moderato';
    }
    
    const consigli = {
      sereno: 'Condizioni favorevoli. Mantieni la calma e la concentrazione.',
      moderato: 'Turno standard. Ricorda di fare pause quando possibile.',
      intenso: 'Potrebbe essere impegnativo. Preparati mentalmente e resta idratato.'
    };
    
    return {
      livello,
      fattori: {
        meteo,
        eventi: isWeekend,
        storico,
        teamSinergia
      },
      consiglio: consigli[livello]
    };
  }

  private generateCompagni(turno: Turno): CompagnoTurno[] {
    const nomi = [
      { nome: 'Marco', cognome: 'Rossi', ruolo: 'Autista' },
      { nome: 'Laura', cognome: 'Bianchi', ruolo: 'Soccorritore' },
      { nome: 'Giuseppe', cognome: 'Verdi', ruolo: 'Infermiere' },
      { nome: 'Alessia', cognome: 'Ferrari', ruolo: 'Soccorritore' },
      { nome: 'Luca', cognome: 'Romano', ruolo: 'Autista' }
    ];
    
    const puntiForte = [
      'Ottima gestione dello stress',
      'Comunicazione efficace',
      'Esperienza pediatrica',
      'Leadership naturale',
      'Grande empatia con i pazienti'
    ];
    
    return turno.squadra.slice(0, 3).map((_, i) => {
      const persona = nomi[i % nomi.length];
      return {
        id: `comp-${i}`,
        nome: persona.nome,
        cognome: persona.cognome,
        ruolo: persona.ruolo,
        turniInsieme: 5 + Math.floor(Math.random() * 20),
        affinita: 60 + Math.floor(Math.random() * 40),
        puntoForte: puntiForte[i % puntiForte.length]
      };
    });
  }

  private generateMeteo(): { icona: TurnoEsteso['meteoIcona']; temp: number } {
    const meteoOptions: TurnoEsteso['meteoIcona'][] = ['sole', 'nuvole', 'pioggia'];
    return {
      icona: meteoOptions[Math.floor(Math.random() * meteoOptions.length)],
      temp: 5 + Math.floor(Math.random() * 15)
    };
  }

  async getTurniEstesi(operatoreId: string): Promise<TurnoEsteso[]> {
    const today = new Date().toISOString().split('T')[0];
    const turni = Array.from(this.turni.values())
      .filter(t => t.operatoreId === operatoreId && t.data >= today)
      .sort((a, b) => a.data.localeCompare(b.data));
    
    return turni.map(turno => {
      const meteo = this.generateMeteo();
      const prepKey = `${turno.id}-${operatoreId}`;
      
      return {
        ...turno,
        previsione: this.generatePrevisione(turno),
        compagni: this.generateCompagni(turno),
        countdown: this.generateCountdown(turno),
        preparazioneMentale: this.preparazioniMentali.get(prepKey),
        meteoIcona: meteo.icona,
        temperaturaStimata: meteo.temp
      };
    });
  }

  async getTurnoEsteso(turnoId: string, operatoreId: string): Promise<TurnoEsteso | undefined> {
    const turno = this.turni.get(turnoId);
    if (!turno) return undefined;
    
    const meteo = this.generateMeteo();
    const prepKey = `${turnoId}-${operatoreId}`;
    
    return {
      ...turno,
      previsione: this.generatePrevisione(turno),
      compagni: this.generateCompagni(turno),
      countdown: this.generateCountdown(turno),
      preparazioneMentale: this.preparazioniMentali.get(prepKey),
      meteoIcona: meteo.icona,
      temperaturaStimata: meteo.temp
    };
  }

  async getTurniStats(operatoreId: string): Promise<TurniStats> {
    const today = new Date().toISOString().split('T')[0];
    const turni = Array.from(this.turni.values())
      .filter(t => t.operatoreId === operatoreId)
      .sort((a, b) => a.data.localeCompare(b.data));
    
    const turniProssimi = turni.filter(t => t.data >= today && t.tipo !== 'riposo');
    const turniNotte = turniProssimi.filter(t => t.tipo === 'notte').length;
    const turniGiorno = turniProssimi.filter(t => t.tipo === 'giorno').length;
    
    let prossimoRiposo = turni.find(t => t.data >= today && t.tipo === 'riposo');
    let giorniAlRiposo = 0;
    if (prossimoRiposo) {
      const ripDate = new Date(prossimoRiposo.data);
      const todayDate = new Date(today);
      giorniAlRiposo = Math.ceil((ripDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    let sequenzaAttuale = 0;
    for (const t of turniProssimi) {
      if (t.tipo !== 'riposo') sequenzaAttuale++;
      else break;
    }
    
    return {
      turniProssimi: turniProssimi.length,
      giorniAlProssimoRiposo: giorniAlRiposo,
      mediaQualitaSettimana: 72 + Math.floor(Math.random() * 15),
      turniNotte,
      turniGiorno,
      sequenzaAttuale,
      recordSequenza: 5
    };
  }

  async completaPreparazione(turnoId: string, operatoreId: string): Promise<PreparazioneMentale> {
    const prepKey = `${turnoId}-${operatoreId}`;
    const existing = this.preparazioniMentali.get(prepKey);
    
    const preparazione: PreparazioneMentale = {
      id: existing?.id || randomUUID(),
      turnoId,
      completata: true,
      dataCompletamento: new Date().toISOString(),
      tipologia: 'visualizzazione'
    };
    
    this.preparazioniMentali.set(prepKey, preparazione);
    return preparazione;
  }

  private initializeBadges() {
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const twoMonthsFromNow = new Date(today);
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    
    const sixMonthsFromNow = new Date(today);
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const badges: BadgeCompetenza[] = [
      {
        id: 'badge-001',
        operatoreId: this.defaultOperatoreId,
        tipo: 'BLSD',
        nome: 'BLSD',
        descrizione: 'Basic Life Support Defibrillation - Rianimazione cardiopolmonare e uso del defibrillatore',
        dataOttenimento: oneYearAgo.toISOString().split('T')[0],
        dataScadenza: sixMonthsFromNow.toISOString().split('T')[0],
        stato: 'attivo',
        ente: 'SOCCORSO DIGITALE',
        codiceCredenziale: 'BLSD-2023-0247'
      },
      {
        id: 'badge-002',
        operatoreId: this.defaultOperatoreId,
        tipo: 'PTC',
        nome: 'PTC',
        descrizione: 'Prehospital Trauma Care - Gestione del trauma in ambiente preospedaliero',
        dataOttenimento: threeMonthsAgo.toISOString().split('T')[0],
        dataScadenza: twoMonthsFromNow.toISOString().split('T')[0],
        stato: 'in_scadenza',
        ente: 'SOCCORSO DIGITALE',
        codiceCredenziale: 'PTC-2024-0089'
      },
      {
        id: 'badge-003',
        operatoreId: this.defaultOperatoreId,
        tipo: 'PRIMO_SOCCORSO',
        nome: 'Primo Soccorso',
        descrizione: 'Certificazione base di primo soccorso sanitario',
        dataOttenimento: oneYearAgo.toISOString().split('T')[0],
        dataScadenza: oneMonthAgo.toISOString().split('T')[0],
        stato: 'scaduto',
        ente: 'SOCCORSO DIGITALE',
        codiceCredenziale: 'PS-2022-1456'
      },
      {
        id: 'badge-004',
        operatoreId: this.defaultOperatoreId,
        tipo: 'PBLSD',
        nome: 'PBLSD',
        descrizione: 'Pediatric Basic Life Support Defibrillation - Rianimazione pediatrica',
        stato: 'da_ottenere',
        ente: 'SOCCORSO DIGITALE'
      }
    ];

    badges.forEach(b => this.badges.set(b.id, b));
  }

  async getBadges(operatoreId: string): Promise<BadgeCompetenza[]> {
    return Array.from(this.badges.values())
      .filter(b => b.operatoreId === operatoreId)
      .sort((a, b) => {
        const statiOrdine = { attivo: 0, in_scadenza: 1, scaduto: 2, da_ottenere: 3 };
        return statiOrdine[a.stato] - statiOrdine[b.stato];
      });
  }

  async getBadgeStats(operatoreId: string): Promise<BadgeStats> {
    const badges = Array.from(this.badges.values())
      .filter(b => b.operatoreId === operatoreId);
    
    return {
      totali: badges.length,
      attivi: badges.filter(b => b.stato === 'attivo').length,
      inScadenza: badges.filter(b => b.stato === 'in_scadenza').length,
      scaduti: badges.filter(b => b.stato === 'scaduto').length
    };
  }

  private initializeTabellone() {
    const operatoreNomi = [
      { id: 'op-001', nome: 'Marco R.' },
      { id: 'op-002', nome: 'Luca B.' },
      { id: 'op-003', nome: 'Sara M.' },
      { id: 'op-004', nome: 'Anna V.' },
      { id: 'op-005', nome: 'Giovanni P.' },
      { id: 'op-006', nome: 'Elena T.' },
    ];

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const turniConfig: { tipo: 'mattina' | 'pomeriggio' | 'notte'; oraInizio: string; oraFine: string }[] = [
      { tipo: 'mattina', oraInizio: '06:00', oraFine: '14:00' },
      { tipo: 'pomeriggio', oraInizio: '14:00', oraFine: '22:00' },
      { tipo: 'notte', oraInizio: '22:00', oraFine: '06:00' }
    ];

    for (const sede of SEDI) {
      for (let day = 1; day <= daysInMonth; day++) {
        const data = new Date(currentYear, currentMonth, day).toISOString().split('T')[0];
        
        for (const turnoConfig of turniConfig) {
          const turnoId = `tab-${sede.replace(/\s/g, '-')}-${data}-${turnoConfig.tipo}`;
          
          const slots: SlotTurno[] = [];
          
          const autista1Id = `slot-${turnoId}-aut1`;
          const soccorritore1Id = `slot-${turnoId}-soc1`;
          const soccorritore2Id = `slot-${turnoId}-soc2`;

          const isFuture = day > today.getDate();
          const isUncovered = Math.random() > 0.7 && isFuture;
          const isPartial = Math.random() > 0.6 && isFuture && !isUncovered;

          if (isUncovered) {
            slots.push({
              id: autista1Id,
              turnoTabelloneId: turnoId,
              mansione: 'autista',
              stato: 'scoperto'
            });
            slots.push({
              id: soccorritore1Id,
              turnoTabelloneId: turnoId,
              mansione: 'soccorritore',
              stato: 'scoperto'
            });
          } else if (isPartial) {
            const randomOp = operatoreNomi[Math.floor(Math.random() * operatoreNomi.length)];
            slots.push({
              id: autista1Id,
              turnoTabelloneId: turnoId,
              mansione: 'autista',
              operatoreId: randomOp.id,
              operatoreNome: randomOp.nome,
              stato: 'assegnato'
            });
            slots.push({
              id: soccorritore1Id,
              turnoTabelloneId: turnoId,
              mansione: 'soccorritore',
              stato: 'scoperto'
            });
          } else {
            const randomOps = [...operatoreNomi].sort(() => Math.random() - 0.5).slice(0, 2);
            slots.push({
              id: autista1Id,
              turnoTabelloneId: turnoId,
              mansione: 'autista',
              operatoreId: randomOps[0].id,
              operatoreNome: randomOps[0].nome,
              stato: 'assegnato'
            });
            slots.push({
              id: soccorritore1Id,
              turnoTabelloneId: turnoId,
              mansione: 'soccorritore',
              operatoreId: randomOps[1].id,
              operatoreNome: randomOps[1].nome,
              stato: 'assegnato'
            });
          }

          const hasUncovered = slots.some(s => s.stato === 'scoperto');
          const allCovered = slots.every(s => s.stato === 'assegnato');

          const turno: TurnoTabellone = {
            id: turnoId,
            sede: sede,
            data: data,
            tipo: turnoConfig.tipo,
            oraInizio: turnoConfig.oraInizio,
            oraFine: turnoConfig.oraFine,
            slots: slots,
            statoCopertura: allCovered ? 'coperto' : (hasUncovered && !allCovered ? 'parziale' : 'scoperto')
          };

          this.turniTabellone.set(turnoId, turno);
        }
      }
    }
  }

  async getTabellone(sede: Sede, mese: string): Promise<TabelloneMese> {
    const turni = Array.from(this.turniTabellone.values())
      .filter(t => t.sede === sede && t.data.startsWith(mese))
      .sort((a, b) => {
        const dateComp = a.data.localeCompare(b.data);
        if (dateComp !== 0) return dateComp;
        const tipoOrdine = { mattina: 0, pomeriggio: 1, notte: 2 };
        return tipoOrdine[a.tipo] - tipoOrdine[b.tipo];
      });

    const turniScoperti = turni.filter(t => 
      t.statoCopertura === 'scoperto' || t.statoCopertura === 'parziale'
    ).length;

    return {
      sede,
      mese,
      turni,
      turniScoperti,
      turniTotali: turni.length
    };
  }

  async candidaTurno(operatoreId: string, data: InsertCandidatura): Promise<CandidaturaTurno> {
    const operatore = await this.getOperatore(operatoreId);
    const turno = this.turniTabellone.get(data.turnoId);
    
    if (!turno) {
      throw new Error('Turno non trovato');
    }

    const slot = turno.slots.find(s => s.id === data.slotId);
    if (!slot) {
      throw new Error('Slot non trovato');
    }

    if (slot.stato !== 'scoperto') {
      throw new Error('Questo slot non è più disponibile');
    }

    const candidatura: CandidaturaTurno = {
      id: randomUUID(),
      slotId: data.slotId,
      turnoId: data.turnoId,
      operatoreId,
      operatoreNome: operatore ? `${operatore.nome} ${operatore.cognome.charAt(0)}.` : 'Operatore',
      mansione: slot.mansione,
      dataCreazione: new Date().toISOString(),
      stato: 'in_attesa'
    };

    this.candidature.set(candidatura.id, candidatura);

    slot.stato = 'candidato';

    return candidatura;
  }

  async ritiraCandidatura(candidaturaId: string): Promise<CandidaturaTurno> {
    const candidatura = this.candidature.get(candidaturaId);
    if (!candidatura) {
      throw new Error('Candidatura non trovata');
    }

    candidatura.stato = 'ritirata';

    const turno = this.turniTabellone.get(candidatura.turnoId);
    if (turno) {
      const slot = turno.slots.find(s => s.id === candidatura.slotId);
      if (slot) {
        slot.stato = 'scoperto';
      }
    }

    return candidatura;
  }

  async getCandidature(operatoreId: string): Promise<CandidaturaTurno[]> {
    return Array.from(this.candidature.values())
      .filter(c => c.operatoreId === operatoreId && c.stato !== 'ritirata')
      .sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione));
  }

  async getProntezzaMissione(operatoreId: string): Promise<ProntezzaMissione> {
    const checkin = await this.getCheckinOggi(operatoreId);
    const sessioni = await this.getSessioniRespiroSettimana(operatoreId);
    const completate = this.azioniProntezzaCompletate.get(operatoreId) || new Set<string>();
    
    const idratazioneCompletata = completate.has('idratazione');
    const respiroRapidoCompletato = completate.has('respiro-rapido');
    const checkinCompletato = completate.has('checkin-benessere');
    
    const bonusIdratazione = idratazioneCompletata ? 10 : 0;
    const bonusRespiro = respiroRapidoCompletato ? 20 : 0;
    const bonusCheckin = checkinCompletato ? 15 : 0;
    
    const benessereBase = checkin ? (checkin.stato === 'carico' ? 100 : checkin.stato === 'ok' ? 70 : 40) : 50;
    const benessereScore = Math.min(100, benessereBase + bonusIdratazione + bonusCheckin);
    const riposoScore = sessioni > 2 ? 90 : sessioni > 0 ? 70 : 50;
    const certificazioniScore = 85;
    const mezzoScore = 95;
    const preparazioneBase = sessioni > 0 ? 80 : 60;
    const preparazioneScore = Math.min(100, preparazioneBase + bonusRespiro);
    
    const punteggioTotale = Math.round((benessereScore + riposoScore + certificazioniScore + mezzoScore + preparazioneScore) / 5);
    
    const statoGenerale = punteggioTotale >= 80 ? 'pronto' : 
                          punteggioTotale >= 65 ? 'quasi_pronto' : 
                          punteggioTotale >= 45 ? 'attenzione' : 'non_pronto';
    
    const messaggi = {
      pronto: 'Sei in ottima forma per la missione di oggi',
      quasi_pronto: 'Qualche piccolo accorgimento ti rendera ancora piu pronto',
      attenzione: 'Prenditi qualche minuto per prepararti meglio',
      non_pronto: 'Ti consigliamo di seguire le azioni suggerite'
    };

    return {
      punteggioTotale,
      statoGenerale,
      messaggioMotivazionale: messaggi[statoGenerale],
      fattori: [
        {
          fattore: 'riposo',
          label: 'Riposo',
          punteggio: riposoScore,
          stato: riposoScore >= 80 ? 'ottimo' : riposoScore >= 60 ? 'buono' : riposoScore >= 40 ? 'attenzione' : 'critico',
          dettaglio: sessioni > 2 ? 'Hai fatto respiro regolarmente' : 'Potresti beneficiare di piu pause',
          perche: 'Il riposo influisce sulla capacita di prendere decisioni rapide in emergenza'
        },
        {
          fattore: 'benessere',
          label: 'Benessere',
          punteggio: benessereScore,
          stato: benessereScore >= 80 ? 'ottimo' : benessereScore >= 60 ? 'buono' : benessereScore >= 40 ? 'attenzione' : 'critico',
          dettaglio: checkin ? `Ti senti ${checkin.stato}` : (checkinCompletato ? 'Check-in completato' : 'Non hai ancora fatto il check-in'),
          perche: 'Il tuo stato emotivo impatta la qualita delle cure che fornisci'
        },
        {
          fattore: 'certificazioni',
          label: 'Certificazioni',
          punteggio: certificazioniScore,
          stato: 'ottimo',
          dettaglio: 'BLS-D valido, nessuna scadenza imminente',
          perche: 'Le certificazioni aggiornate garantiscono interventi secondo protocollo'
        },
        {
          fattore: 'mezzo',
          label: 'Controllo Mezzo',
          punteggio: mezzoScore,
          stato: 'ottimo',
          dettaglio: 'Ultimo controllo: oggi alle 06:30',
          perche: 'Un mezzo controllato riduce i tempi di intervento'
        },
        {
          fattore: 'preparazione',
          label: 'Preparazione',
          punteggio: preparazioneScore,
          stato: preparazioneScore >= 80 ? 'ottimo' : preparazioneScore >= 60 ? 'buono' : 'attenzione',
          dettaglio: (sessioni > 0 || respiroRapidoCompletato) ? 'Respirazione completata' : 'Prepara la mente per il turno',
          perche: 'Una breve preparazione mentale migliora i tempi di reazione'
        }
      ],
      azioniSuggerite: [
        {
          id: 'respiro-rapido',
          titolo: 'Respiro Rapido',
          descrizione: '60 secondi di respirazione controllata per calmare il sistema nervoso',
          impatto: 'alto',
          tempoStimato: '1 min',
          fattoreTarget: 'preparazione',
          completata: sessioni > 0 || completate.has('respiro-rapido'),
          perche: 'Attiva il sistema parasimpatico e migliora la lucidita'
        },
        {
          id: 'checkin-benessere',
          titolo: 'Check-in Benessere',
          descrizione: 'Registra come ti senti oggi',
          impatto: 'medio',
          tempoStimato: '10 sec',
          fattoreTarget: 'benessere',
          completata: !!checkin || completate.has('checkin-benessere'),
          perche: 'Consapevolezza del proprio stato = migliori decisioni'
        },
        {
          id: 'idratazione',
          titolo: 'Bevi un bicchiere d\'acqua',
          descrizione: 'L\'idratazione e fondamentale per la concentrazione',
          impatto: 'medio',
          tempoStimato: '30 sec',
          fattoreTarget: 'benessere',
          completata: idratazioneCompletata,
          perche: 'Anche una lieve disidratazione riduce le performance cognitive del 10%'
        }
      ],
      ultimoAggiornamento: new Date().toISOString()
    };
  }

  async completaAzioneProntezza(operatoreId: string, azioneId: string): Promise<MicroAzione> {
    let completate = this.azioniProntezzaCompletate.get(operatoreId);
    if (!completate) {
      completate = new Set<string>();
      this.azioniProntezzaCompletate.set(operatoreId, completate);
    }
    
    completate.add(azioneId);
    
    const prontezza = await this.getProntezzaMissione(operatoreId);
    const azione = prontezza.azioniSuggerite.find(a => a.id === azioneId);
    
    if (!azione) {
      throw new Error('Azione non trovata');
    }

    return azione;
  }

  private initializePartners(): void {
    const partnersData: Partner[] = [
      {
        id: 'partner-001',
        nome: 'Palestra FitLife',
        descrizione: 'Centro fitness con corsi e sala pesi. Accesso 24/7 per il personale sanitario.',
        categoria: 'sport_fitness',
        indirizzo: 'Via Roma 45',
        citta: 'Verona',
        telefono: '045 123456',
        sito: 'https://fitlife.example.com',
        sconto: '30% su abbonamento annuale',
        codiceSconto: 'CROCE30',
        condizioni: 'Valido per nuovi iscritti',
        attivo: true,
        sediVicine: ['Verona'],
        perche: 'Mantenersi in forma aiuta nelle operazioni di soccorso'
      },
      {
        id: 'partner-002',
        nome: 'Ristorante Da Mario',
        descrizione: 'Cucina tradizionale veronese con menu dedicato per chi lavora su turni.',
        categoria: 'ristorazione',
        indirizzo: 'Piazza Erbe 12',
        citta: 'Verona',
        telefono: '045 234567',
        sconto: '15% su pranzi e cene',
        codiceSconto: 'CROCEEUROPA',
        condizioni: 'Esclusi festivi',
        attivo: true,
        sediVicine: ['Verona'],
        perche: 'Pasti sani per chi ha poco tempo tra un turno e l\'altro'
      },
      {
        id: 'partner-003',
        nome: 'Officina AutoService',
        descrizione: 'Tagliandi, riparazioni e gomme. Priorita per emergenze.',
        categoria: 'automotive',
        indirizzo: 'Via Industria 8',
        citta: 'Legnago',
        telefono: '0442 123456',
        sconto: '20% su manodopera',
        condizioni: 'Prenotazione richiesta',
        attivo: true,
        sediVicine: ['Legnago', 'Nogara'],
        perche: 'Auto efficiente = arrivi puntuale al turno'
      },
      {
        id: 'partner-004',
        nome: 'Centro Benessere Oasi',
        descrizione: 'Massaggi, sauna e trattamenti rilassanti per recuperare dopo turni intensi.',
        categoria: 'salute_benessere',
        indirizzo: 'Via Wellness 3',
        citta: 'Verona',
        telefono: '045 345678',
        email: 'info@oasi.example.com',
        sconto: '25% su tutti i trattamenti',
        codiceSconto: 'RELAX25',
        attivo: true,
        sediVicine: ['Verona', 'Cologna Veneta'],
        perche: 'Il recupero fisico e mentale e fondamentale per chi fa soccorso'
      },
      {
        id: 'partner-005',
        nome: 'Libreria Formazione',
        descrizione: 'Testi medici, manuali di primo soccorso e corsi online.',
        categoria: 'formazione',
        indirizzo: 'Corso Italia 22',
        citta: 'Verona',
        sito: 'https://libreriaformazione.example.com',
        sconto: '10% su libri e 20% su corsi',
        attivo: true,
        sediVicine: ['Verona', 'Montecchio Maggiore'],
        perche: 'Formazione continua per migliorare le competenze'
      },
      {
        id: 'partner-006',
        nome: 'Assicurazioni Proteggi',
        descrizione: 'Polizze vita, infortuni e RC professionale con condizioni dedicate.',
        categoria: 'servizi',
        indirizzo: 'Via Sicurezza 7',
        citta: 'Verona',
        telefono: '045 456789',
        email: 'croce@proteggi.example.com',
        sconto: 'Consulenza gratuita + 15% su polizze',
        attivo: true,
        perche: 'Protezione per te e la tua famiglia'
      },
      {
        id: 'partner-007',
        nome: 'Ottica Visione Chiara',
        descrizione: 'Occhiali da vista e sole, lenti a contatto. Controllo gratuito della vista.',
        categoria: 'salute_benessere',
        indirizzo: 'Via Garibaldi 15',
        citta: 'Cologna Veneta',
        telefono: '0442 654321',
        sconto: '30% su montature + controllo gratuito',
        attivo: true,
        sediVicine: ['Cologna Veneta', 'Legnago'],
        perche: 'Vista perfetta per interventi sicuri'
      },
      {
        id: 'partner-008',
        nome: 'Cinema Multisala Star',
        descrizione: 'Tutti i film in prima visione, poltrone reclinabili.',
        categoria: 'tempo_libero',
        indirizzo: 'Centro Commerciale Le Corti',
        citta: 'Verona',
        sito: 'https://cinemastar.example.com',
        sconto: 'Biglietto ridotto 6 euro sempre',
        codiceSconto: 'CROCECINEMA',
        attivo: true,
        perche: 'Staccare la mente e importante quanto il riposo fisico'
      },
      {
        id: 'partner-009',
        nome: 'Decathlon Verona',
        descrizione: 'Abbigliamento sportivo, attrezzature e accessori per ogni attivita.',
        categoria: 'shopping',
        indirizzo: 'Via dello Sport 10',
        citta: 'Verona',
        telefono: '045 789012',
        sito: 'https://decathlon.example.com',
        sconto: '15% su tutto il catalogo',
        codiceSconto: 'CROCE15',
        attivo: true,
        sediVicine: ['Verona', 'Montecchio Maggiore'],
        perche: 'Attrezzatura di qualita per mantenerti in forma'
      }
    ];

    partnersData.forEach(partner => {
      this.partners.set(partner.id, partner);
    });
  }

  async getPartners(categoria?: CategoriaPartner): Promise<Partner[]> {
    const allPartners = Array.from(this.partners.values()).filter(p => p.attivo);
    
    if (categoria) {
      return allPartners.filter(p => p.categoria === categoria);
    }
    
    return allPartners;
  }

  async getPartner(partnerId: string): Promise<Partner | undefined> {
    return this.partners.get(partnerId);
  }

  async registraUtilizzoConvenzione(operatoreId: string, data: InsertConvenzioneUtilizzo): Promise<ConvenzioneUtilizzo> {
    const utilizzo: ConvenzioneUtilizzo = {
      id: randomUUID(),
      partnerId: data.partnerId,
      operatoreId,
      dataUtilizzo: new Date().toISOString(),
      feedback: data.feedback,
      note: data.note
    };

    this.convenzioniUtilizzo.set(utilizzo.id, utilizzo);
    return utilizzo;
  }

  async getUtilizziConvenzione(operatoreId: string): Promise<ConvenzioneUtilizzo[]> {
    return Array.from(this.convenzioniUtilizzo.values())
      .filter(u => u.operatoreId === operatoreId)
      .sort((a, b) => b.dataUtilizzo.localeCompare(a.dataUtilizzo));
  }

  async getTimbraturaOggi(operatoreId: string): Promise<Timbratura[]> {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.timbrature.values())
      .filter(t => t.operatoreId === operatoreId && t.dataOra.startsWith(today))
      .sort((a, b) => a.dataOra.localeCompare(b.dataOra));
  }

  async createTimbratura(operatoreId: string, data: InsertTimbratura): Promise<Timbratura> {
    const timbratura: Timbratura = {
      id: randomUUID(),
      operatoreId,
      tipo: data.tipo,
      dataOra: new Date().toISOString(),
      metodo: data.metodo,
      posizione: data.posizione,
      sede: data.sede,
      confermata: true,
      annullata: false
    };

    this.timbrature.set(timbratura.id, timbratura);

    const azione: AzioneReversibile = {
      id: randomUUID(),
      operatoreId,
      tipo: 'feedback',
      descrizione: `Timbratura ${data.tipo} registrata`,
      dataOra: new Date().toISOString(),
      annullabile: true,
      annullata: false
    };
    this.azioni.set(azione.id, azione);

    return timbratura;
  }

  async annullaTimbratura(timbraturaId: string): Promise<Timbratura> {
    const timbratura = this.timbrature.get(timbraturaId);
    if (!timbratura) throw new Error("Timbratura non trovata");

    timbratura.annullata = true;
    timbratura.dataAnnullamento = new Date().toISOString();
    this.timbrature.set(timbraturaId, timbratura);

    return timbratura;
  }

  async getTimbraturaGiornaliera(operatoreId: string, data: string): Promise<TimbraturaGiornaliera> {
    const timbrature = Array.from(this.timbrature.values())
      .filter(t => t.operatoreId === operatoreId && t.dataOra.startsWith(data) && !t.annullata)
      .sort((a, b) => a.dataOra.localeCompare(b.dataOra));

    let oreTotali: number | undefined;
    let stato: 'completo' | 'incompleto' | 'anomalia' = 'incompleto';

    if (timbrature.length >= 2) {
      const entrate = timbrature.filter(t => t.tipo === 'entrata');
      const uscite = timbrature.filter(t => t.tipo === 'uscita');
      
      if (entrate.length === uscite.length) {
        stato = 'completo';
        let totalMs = 0;
        for (let i = 0; i < entrate.length; i++) {
          const entrata = new Date(entrate[i].dataOra).getTime();
          const uscita = new Date(uscite[i].dataOra).getTime();
          totalMs += uscita - entrata;
        }
        oreTotali = totalMs / (1000 * 60 * 60);
      } else if (entrate.length !== uscite.length) {
        stato = entrate.length > uscite.length ? 'incompleto' : 'anomalia';
      }
    } else if (timbrature.length === 1) {
      stato = 'incompleto';
    }

    return {
      data,
      timbrature,
      oreTotali,
      stato
    };
  }

  private initializeDocumentiEFormazione() {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    const docs: Documento[] = [
      {
        id: 'doc-001',
        operatoreId: this.defaultOperatoreId,
        tipo: 'patente_guida',
        nome: 'Patente B',
        numero: 'VR1234567',
        enteRilascio: 'Motorizzazione Verona',
        dataRilascio: '2020-03-15',
        dataScadenza: formatDate(new Date(today.getFullYear() + 2, today.getMonth(), 15)),
        stato: 'valido',
        notificheInviate: []
      },
      {
        id: 'doc-002',
        operatoreId: this.defaultOperatoreId,
        tipo: 'blsd',
        nome: 'Certificato BLSD',
        numero: 'BLSD-2024-001',
        enteRilascio: 'IRC',
        dataRilascio: '2024-01-20',
        dataScadenza: formatDate(new Date(today.getFullYear(), today.getMonth() + 2, 20)),
        stato: 'in_scadenza',
        notificheInviate: [90, 60]
      },
      {
        id: 'doc-003',
        operatoreId: this.defaultOperatoreId,
        tipo: 'tesserino_ente',
        nome: 'Tesserino SOCCORSO DIGITALE',
        numero: 'CE-2022-247',
        enteRilascio: 'SOCCORSO DIGITALE Verona',
        dataRilascio: '2022-03-15',
        dataScadenza: formatDate(new Date(today.getFullYear() + 1, 2, 15)),
        stato: 'valido',
        notificheInviate: []
      },
      {
        id: 'doc-004',
        operatoreId: this.defaultOperatoreId,
        tipo: 'certificato_medico',
        nome: 'Idoneita Sanitaria',
        numero: 'MED-2024-089',
        enteRilascio: 'ASL Verona',
        dataRilascio: '2024-06-01',
        dataScadenza: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        stato: 'scaduto',
        notificheInviate: [90, 60, 30, 7]
      },
      {
        id: 'doc-005',
        operatoreId: this.defaultOperatoreId,
        tipo: 'ptc',
        nome: 'Certificato PTC',
        numero: 'PTC-2023-156',
        enteRilascio: 'IRC',
        dataRilascio: '2023-09-10',
        dataScadenza: formatDate(new Date(today.getFullYear() + 1, 8, 10)),
        stato: 'valido',
        notificheInviate: []
      }
    ];
    
    docs.forEach(d => this.documenti.set(d.id, d));

    const circolari: Circolare[] = [
      {
        id: 'circ-001',
        titolo: 'Nuove procedure di sanificazione mezzi',
        contenuto: 'A partire dal 1 gennaio 2025, tutti i mezzi devono essere sanificati secondo il nuovo protocollo allegato. La procedura prevede...',
        categoria: 'operativa',
        priorita: 'importante',
        dataCreazione: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5)),
        richiedeConferma: true
      },
      {
        id: 'circ-002',
        titolo: 'Corso aggiornamento BLSD obbligatorio',
        contenuto: 'Si comunica che entro il 28 febbraio 2025 tutti gli operatori dovranno completare il corso di aggiornamento BLSD. Le date disponibili sono...',
        categoria: 'formazione',
        priorita: 'urgente',
        dataCreazione: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)),
        richiedeConferma: true
      },
      {
        id: 'circ-003',
        titolo: 'Chiusura uffici periodo natalizio',
        contenuto: 'Gli uffici amministrativi rimarranno chiusi dal 24 dicembre al 6 gennaio. Per urgenze contattare...',
        categoria: 'amministrativa',
        priorita: 'normale',
        dataCreazione: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10)),
        richiedeConferma: false
      },
      {
        id: 'circ-004',
        titolo: 'Nuova convenzione carburante',
        contenuto: 'Attivata nuova convenzione con distributore ENI. Sconto 15% su tutti i rifornimenti presentando il tesserino...',
        categoria: 'generale',
        priorita: 'normale',
        dataCreazione: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15)),
        richiedeConferma: false
      }
    ];
    
    circolari.forEach(c => this.circolari.set(c.id, c));

    const corsi: Corso[] = [
      {
        id: 'corso-001',
        titolo: 'Rinnovo BLSD',
        descrizione: 'Corso di rinnovo per certificazione BLSD. Parte teorica e pratica con manichini.',
        categoria: 'obbligatorio',
        duratOre: 8,
        sede: 'Sede Verona',
        dataInizio: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 15)),
        dataFine: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 15)),
        oraInizio: '09:00',
        oraFine: '17:00',
        postiTotali: 20,
        postiDisponibili: 8,
        docente: 'Dott. Bianchi',
        stato: 'iscrizioni_aperte',
        obbligatorioPerRuoli: ['soccorritore', 'autista']
      },
      {
        id: 'corso-002',
        titolo: 'Gestione paziente psichiatrico',
        descrizione: 'Tecniche di comunicazione e gestione sicura del paziente in crisi psichiatrica.',
        categoria: 'specializzazione',
        duratOre: 4,
        sede: 'Sede Verona',
        dataInizio: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 22)),
        dataFine: formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 22)),
        oraInizio: '14:00',
        oraFine: '18:00',
        postiTotali: 15,
        postiDisponibili: 12,
        docente: 'Dott.ssa Verdi',
        stato: 'iscrizioni_aperte'
      },
      {
        id: 'corso-003',
        titolo: 'Sicurezza sul lavoro - Aggiornamento',
        descrizione: 'Aggiornamento obbligatorio annuale sulla sicurezza nei luoghi di lavoro.',
        categoria: 'sicurezza',
        duratOre: 4,
        sede: 'Online',
        dataInizio: formatDate(new Date(today.getFullYear(), today.getMonth(), 28)),
        dataFine: formatDate(new Date(today.getFullYear(), today.getMonth(), 28)),
        oraInizio: '09:00',
        oraFine: '13:00',
        postiTotali: 50,
        postiDisponibili: 35,
        stato: 'iscrizioni_aperte',
        obbligatorioPerRuoli: ['soccorritore', 'autista']
      },
      {
        id: 'corso-004',
        titolo: 'PTC Base',
        descrizione: 'Corso base Prehospital Trauma Care per la gestione del paziente traumatizzato.',
        categoria: 'obbligatorio',
        duratOre: 16,
        sede: 'Sede Legnago',
        dataInizio: formatDate(new Date(today.getFullYear(), today.getMonth() + 2, 8)),
        dataFine: formatDate(new Date(today.getFullYear(), today.getMonth() + 2, 9)),
        oraInizio: '08:00',
        oraFine: '17:00',
        postiTotali: 12,
        postiDisponibili: 4,
        docente: 'Dott. Rossi',
        stato: 'iscrizioni_aperte',
        prerequisiti: ['BLSD valido']
      }
    ];
    
    corsi.forEach(c => this.corsi.set(c.id, c));

    const iscrizione: IscrizioneCorso = {
      id: 'iscr-001',
      corsoId: 'corso-003',
      operatoreId: this.defaultOperatoreId,
      dataIscrizione: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3)),
      stato: 'confermata'
    };
    this.iscrizioniCorsi.set(iscrizione.id, iscrizione);
  }

  async getDocumenti(operatoreId: string): Promise<Documento[]> {
    return Array.from(this.documenti.values())
      .filter(d => d.operatoreId === operatoreId)
      .sort((a, b) => {
        if (!a.dataScadenza) return 1;
        if (!b.dataScadenza) return -1;
        return a.dataScadenza.localeCompare(b.dataScadenza);
      });
  }

  async getDocumento(documentoId: string): Promise<Documento | undefined> {
    return this.documenti.get(documentoId);
  }

  async createDocumento(operatoreId: string, data: InsertDocumento): Promise<Documento> {
    const now = new Date();
    let stato: 'valido' | 'in_scadenza' | 'scaduto' = 'valido';
    
    if (data.dataScadenza) {
      const scadenza = new Date(data.dataScadenza);
      const diffDays = Math.ceil((scadenza.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) stato = 'scaduto';
      else if (diffDays <= 90) stato = 'in_scadenza';
    }

    const documento: Documento = {
      id: randomUUID(),
      operatoreId,
      tipo: data.tipo,
      nome: data.nome,
      numero: data.numero,
      enteRilascio: data.enteRilascio,
      dataRilascio: data.dataRilascio,
      dataScadenza: data.dataScadenza,
      stato,
      notificheInviate: []
    };

    this.documenti.set(documento.id, documento);
    return documento;
  }

  async updateDocumento(documentoId: string, data: Partial<InsertDocumento>): Promise<Documento> {
    const documento = this.documenti.get(documentoId);
    if (!documento) throw new Error("Documento non trovato");

    Object.assign(documento, data);

    if (documento.dataScadenza) {
      const now = new Date();
      const scadenza = new Date(documento.dataScadenza);
      const diffDays = Math.ceil((scadenza.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) documento.stato = 'scaduto';
      else if (diffDays <= 90) documento.stato = 'in_scadenza';
      else documento.stato = 'valido';
    }

    this.documenti.set(documentoId, documento);
    return documento;
  }

  async deleteDocumento(documentoId: string): Promise<void> {
    this.documenti.delete(documentoId);
  }

  async getQRVerifica(operatoreId: string): Promise<QRVerifica> {
    const documenti = await this.getDocumenti(operatoreId);
    const hash = randomUUID().slice(0, 8).toUpperCase();

    return {
      operatoreId,
      timestamp: new Date().toISOString(),
      hash,
      documentiValidi: documenti.map(d => ({
        tipo: d.tipo,
        nome: d.nome,
        stato: d.stato,
        scadenza: d.dataScadenza
      })),
      certificazioniAttive: documenti.filter(d => d.stato === 'valido').map(d => d.nome)
    };
  }

  async getCircolari(): Promise<Circolare[]> {
    return Array.from(this.circolari.values())
      .sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione));
  }

  async getCircolare(circolareId: string): Promise<Circolare | undefined> {
    return this.circolari.get(circolareId);
  }

  async getConfermeLettura(operatoreId: string): Promise<ConfermaLettura[]> {
    return Array.from(this.confermeLettura.values())
      .filter(c => c.operatoreId === operatoreId);
  }

  async confermaLettura(operatoreId: string, data: InsertConfermaLettura): Promise<ConfermaLettura> {
    const existing = Array.from(this.confermeLettura.values())
      .find(c => c.operatoreId === operatoreId && c.circolareId === data.circolareId);
    
    if (existing) return existing;

    const conferma: ConfermaLettura = {
      id: randomUUID(),
      circolareId: data.circolareId,
      operatoreId,
      dataConferma: new Date().toISOString()
    };

    this.confermeLettura.set(conferma.id, conferma);
    return conferma;
  }

  async getCircolariNonLette(operatoreId: string): Promise<Circolare[]> {
    const conferme = await this.getConfermeLettura(operatoreId);
    const circolariLette = new Set(conferme.map(c => c.circolareId));
    
    return Array.from(this.circolari.values())
      .filter(c => c.richiedeConferma && !circolariLette.has(c.id))
      .sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione));
  }

  async getCorsi(): Promise<Corso[]> {
    return Array.from(this.corsi.values())
      .filter(c => c.stato === 'iscrizioni_aperte' || c.stato === 'programmato')
      .sort((a, b) => a.dataInizio.localeCompare(b.dataInizio));
  }

  async getCorso(corsoId: string): Promise<Corso | undefined> {
    return this.corsi.get(corsoId);
  }

  async getIscrizioniCorsi(operatoreId: string): Promise<IscrizioneCorso[]> {
    return Array.from(this.iscrizioniCorsi.values())
      .filter(i => i.operatoreId === operatoreId);
  }

  async iscriviCorso(operatoreId: string, data: InsertIscrizioneCorso): Promise<IscrizioneCorso> {
    const corso = await this.getCorso(data.corsoId);
    if (!corso) throw new Error("Corso non trovato");
    if (corso.postiDisponibili <= 0) throw new Error("Posti esauriti");

    const existing = Array.from(this.iscrizioniCorsi.values())
      .find(i => i.operatoreId === operatoreId && i.corsoId === data.corsoId && i.stato !== 'annullata');
    if (existing) throw new Error("Gia iscritto a questo corso");

    corso.postiDisponibili--;
    this.corsi.set(corso.id, corso);

    const iscrizione: IscrizioneCorso = {
      id: randomUUID(),
      corsoId: data.corsoId,
      operatoreId,
      dataIscrizione: new Date().toISOString(),
      stato: corso.postiDisponibili >= 0 ? 'confermata' : 'lista_attesa'
    };

    this.iscrizioniCorsi.set(iscrizione.id, iscrizione);
    return iscrizione;
  }

  async annullaIscrizioneCorso(iscrizioneId: string): Promise<IscrizioneCorso> {
    const iscrizione = this.iscrizioniCorsi.get(iscrizioneId);
    if (!iscrizione) throw new Error("Iscrizione non trovata");

    iscrizione.stato = 'annullata';
    this.iscrizioniCorsi.set(iscrizioneId, iscrizione);

    const corso = await this.getCorso(iscrizione.corsoId);
    if (corso) {
      corso.postiDisponibili++;
      this.corsi.set(corso.id, corso);
    }

    return iscrizione;
  }

  async getStatoFormazioneOperatore(operatoreId: string): Promise<StatoFormazioneOperatore> {
    const iscrizioni = await this.getIscrizioniCorsi(operatoreId);
    const corsiList = await this.getCorsi();
    const documenti = await this.getDocumenti(operatoreId);

    const completati = iscrizioni.filter(i => i.stato === 'completata');
    const inCorso = iscrizioni.filter(i => i.stato === 'confermata');

    let oreTotali = 0;
    for (const isc of completati) {
      const corso = corsiList.find(c => c.id === isc.corsoId);
      if (corso) oreTotali += corso.duratOre;
    }

    const corsiObbligatori = corsiList.filter(c => c.obbligatorioPerRuoli?.includes('soccorritore'));
    const iscrittiIds = new Set(iscrizioni.map(i => i.corsoId));
    const mancanti = corsiObbligatori.filter(c => !iscrittiIds.has(c.id));

    const blsd = documenti.find(d => d.tipo === 'blsd');
    let prossimaScadenza;
    if (blsd && blsd.dataScadenza) {
      const scad = new Date(blsd.dataScadenza);
      const oggi = new Date();
      const diffDays = Math.ceil((scad.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
      prossimaScadenza = {
        corsoId: 'corso-001',
        nomeCorso: 'Rinnovo BLSD',
        dataScadenza: blsd.dataScadenza,
        giorniRimanenti: diffDays
      };
    }

    return {
      operatoreId,
      annoCorrente: new Date().getFullYear(),
      oreTotaliAnno: oreTotali,
      oreObbligatorieAnno: 16,
      percentualeCompletamento: Math.min(100, Math.round((oreTotali / 16) * 100)),
      corsiCompletati: completati.map(i => i.corsoId),
      corsiInCorso: inCorso.map(i => i.corsoId),
      corsiMancanti: mancanti.map(c => c.id),
      gapFormativi: mancanti.length > 0 ? [{
        categoria: 'obbligatorio',
        oreMancanti: Math.max(0, 16 - oreTotali),
        corsiSuggeriti: mancanti.map(c => c.titolo)
      }] : [],
      prossimaScadenza
    };
  }
}

export const storage = new MemStorage();
