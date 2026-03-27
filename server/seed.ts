import { db } from "./db";
import { locations, vehicles, structures, departments, users, trips, privacyPolicies, checklistTemplateItems, structureDepartments, organizations, staffMembers, hubServicePricing, premiumModules } from "@shared/schema";
import { sql, eq, isNull } from "drizzle-orm";
import { seedDefaultSlaTargets } from "./sla";
import { seedDefaultBackupPolicies } from "./backup";
import { bulkSignTrips } from "./trip-integrity";
import * as path from "path";
import * as fs from "fs";

const ALL_STRUCTURES = [
  // Ospedali (60)
  { name: "AZIENDA OSPEDALIERA PADOVA", address: "VIA GIUSTINIANI 2, PADOVA (PD)", type: "ospedale" },
  { name: "CASA DI CURA ABANO TERME", address: "VIA MONTICELLO 1, TEOLO (PD)", type: "ospedale" },
  { name: "CASA DI CURA DOTT. PEDERZOLI", address: "VIA MONTE BALDO 24, PESCHIERA DEL GARDA (VR)", type: "ospedale" },
  { name: "CASA DI CURA ERETENIA", address: "VIALE ERETENIO 12, VICENZA (VI)", type: "ospedale" },
  { name: "CASA DI CURA SAN CAMILLO", address: "VIA TURATI 50, CREMONA (CR)", type: "ospedale" },
  { name: "CASA DI CURA SAN CLEMENTE", address: "VIA PINETA 1, MANTOVA (MN)", type: "ospedale" },
  { name: "CASA DI CURA VILLA BERICA", address: "VIA VOLTA 10, VICENZA (VI)", type: "ospedale" },
  { name: "CASA DI CURA VILLA MARIA", address: "VIA SPALATO 2, PADOVA (PD)", type: "ospedale" },
  { name: "CENTRO RIABILITATIVO VERONESE", address: "VIA FRA GEROLAMO SAVONAROLA 7/A, CASTEL D'AZZANO (VR)", type: "ospedale" },
  { name: "CLINICA SAN ROCCO", address: "VIA MONSIGNOR BRAVI 65, FRANCIACORTA (BS)", type: "ospedale" },
  { name: "FONDAZIONE DON GNOCCHI", address: "VIA POZZUOLO DEL FRIULI 1, UDINE (UD)", type: "ospedale" },
  { name: "IOV - ISTITUTO ONCOLOGICO VENETO", address: "VIA GATTAMELATA 64, PADOVA (PD)", type: "ospedale" },
  { name: "IRCCS OSPEDALE SACRO CUORE DON CALABRIA", address: "VIA DON ANTONIO SEMPREBONI 5, NEGRAR DI VALPOLICELLA (VR)", type: "ospedale" },
  { name: "ISTITUTO DON CALABRIA VERONA", address: "VIA S. GIULIANA 3, VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE ALTO VICENTINO", address: "VIA CAMILLO DE LELLIS 20, SANTORSO (VI)", type: "ospedale" },
  { name: "OSPEDALE BORGO ROMA", address: "PIAZZALE L. A. SCURO, VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE BORGO TRENTO", address: "PIAZZALE ARISTIDE STEFANI, VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE CA' FONCELLO", address: "PIAZZALE OSPEDALE 1, TREVISO (TV)", type: "ospedale" },
  { name: "OSPEDALE CIVILE DI CITTADELLA", address: "VIA RIVA OSPEDALE 35, CITTADELLA (PD)", type: "ospedale" },
  { name: "OSPEDALE CIVILE DI MONTECCHIO MAGGIORE", address: "VIA CAV. VITTORIO VENETO 21, MONTECCHIO MAGGIORE (VI)", type: "ospedale" },
  { name: "OSPEDALE CIVILE DI THIENE", address: "VIA BOLDRINI 1, THIENE (VI)", type: "ospedale" },
  { name: "OSPEDALE DELL'ANGELO", address: "VIA PACCAGNELLA 11, MESTRE (VE)", type: "ospedale" },
  { name: "OSPEDALE DI ARZIGNANO", address: "VIA DEL PARCO, ARZIGNANO (VI)", type: "ospedale" },
  { name: "OSPEDALE DI ASIAGO", address: "VIA MARTIRI DI GRANEZZA 42, ASIAGO (VI)", type: "ospedale" },
  { name: "OSPEDALE DI BASSANO DEL GRAPPA", address: "VIA DEI LOTTI 40, BASSANO DEL GRAPPA (VI)", type: "ospedale" },
  { name: "OSPEDALE DI BUSSOLENGO", address: "VIA OSPEDALE, BUSSOLENGO (VR)", type: "ospedale" },
  { name: "OSPEDALE DI CAMPOSAMPIERO", address: "VIA PIETRO COSMA 1, CAMPOSAMPIERO (PD)", type: "ospedale" },
  { name: "OSPEDALE DI CAPRINO VERONESE", address: "VIA CAPPUCCINI 34, CAPRINO VERONESE (VR)", type: "ospedale" },
  { name: "OSPEDALE DI COLOGNA VENETA", address: "VIALE DELL'ARTIGIANATO 3, COLOGNA VENETA (VR)", type: "ospedale" },
  { name: "OSPEDALE DI CONSELVE", address: "VIA DELLA REPUBBLICA, CONSELVE (PD)", type: "ospedale" },
  { name: "OSPEDALE DI DOLO", address: "VIA ARINO 1, DOLO (VE)", type: "ospedale" },
  { name: "OSPEDALE DI ESTE", address: "VIA SAN FERMO 10, ESTE (PD)", type: "ospedale" },
  { name: "OSPEDALE DI FELTRE", address: "VIA BAGNOLS SUR CEZE 3, FELTRE (BL)", type: "ospedale" },
  { name: "OSPEDALE DI ISOLA DELLA SCALA", address: "VIA ROMA 1, ISOLA DELLA SCALA (VR)", type: "ospedale" },
  { name: "OSPEDALE DI LEGNAGO", address: "VIA CARLO GIANELLA, LEGNAGO (VR)", type: "ospedale" },
  { name: "OSPEDALE DI LONIGO", address: "VIA SAN GIOVANNI, LONIGO (VI)", type: "ospedale" },
  { name: "OSPEDALE DI MARZANA", address: "VIA DELLE COSTE 17, VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE DI MONSELICE", address: "VIA MONTE RICCO 1, MONSELICE (PD)", type: "ospedale" },
  { name: "OSPEDALE DI MONTAGNANA", address: "VIA OSPEDALE, MONTAGNANA (PD)", type: "ospedale" },
  { name: "OSPEDALE DI NEGRAR SACRO CUORE DON CALABRIA", address: "VIA DON A. SEMINATI, NEGRAR (VR)", type: "ospedale" },
  { name: "OSPEDALE DI NOVENTA VICENTINA", address: "VIA KENNEDY 1, NOVENTA VICENTINA (VI)", type: "ospedale" },
  { name: "OSPEDALE DI PESCHIERA DEL GARDA", address: "VIA MONTE BALDO 24, PESCHIERA DEL GARDA (VR)", type: "ospedale" },
  { name: "OSPEDALE DI PIEVE DI CADORE", address: "VIA OSPEDALE 1, PIEVE DI CADORE (BL)", type: "ospedale" },
  { name: "OSPEDALE DI PIOVE DI SACCO", address: "VIA ROMA 105, PIOVE DI SACCO (PD)", type: "ospedale" },
  { name: "OSPEDALE DI SAN BONIFACIO", address: "VIA CIRCONVALLAZIONE, SAN BONIFACIO (VR)", type: "ospedale" },
  { name: "OSPEDALE DI SANT'AMBROGIO DI VALPOLICELLA", address: "VIA STAZIONE 7, SANT'AMBROGIO DI VALPOLICELLA (VR)", type: "ospedale" },
  { name: "OSPEDALE DI SCHIO", address: "VIA BOLDRINI 1, SCHIO (VI)", type: "ospedale" },
  { name: "OSPEDALE DI SOAVE", address: "VIA OSPEDALE 1, SOAVE (VR)", type: "ospedale" },
  { name: "OSPEDALE DI TRENTO", address: "LARGO MEDAGLIE D'ORO 9, TRENTO (TN)", type: "ospedale" },
  { name: "OSPEDALE DI VALDAGNO", address: "VIA GALILEO GALILEI, VALDAGNO (VI)", type: "ospedale" },
  { name: "OSPEDALE DI VILLAFRANCA", address: "VIA OSPEDALE, VILLAFRANCA DI VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE FRACASTORO", address: "VIA FRACASTORO 1, SAN BONIFACIO (VR)", type: "ospedale" },
  { name: "OSPEDALE MAGALINI VILLAFRANCA", address: "VIA OSPEDALE 12, VILLAFRANCA DI VERONA (VR)", type: "ospedale" },
  { name: "OSPEDALE MATER SALUTIS", address: "VIA GIANELLA 1, LEGNAGO (VR)", type: "ospedale" },
  { name: "OSPEDALE ORLANDI", address: "VIA OSPEDALE 2, BUSSOLENGO (VR)", type: "ospedale" },
  { name: "OSPEDALE SAN BORTOLO", address: "VIALE FERDINANDO RODOLFI, VICENZA (VI)", type: "ospedale" },
  { name: "OSPEDALE SAN MARTINO", address: "VIA OSPEDALE 1, BELLUNO (BL)", type: "ospedale" },
  { name: "OSPEDALI RIUNITI PADOVA SUD MADRE TERESA DI CALCUTTA", address: "VIA ALBERE 30, MONSELICE (PD)", type: "ospedale" },
  { name: "POLICLINICO ABANO TERME", address: "PIAZZA COLOMBO 1, ABANO TERME (PD)", type: "ospedale" },
  { name: "POLICLINICO SAN MARCO", address: "CORSO ITALIA 3, ZINGONIA (BG)", type: "ospedale" },
  // Case di Riposo (89)
  { name: "CASA DI RIPOSO ABANO TERME", address: "VIA ROMA 35, ABANO TERME (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ALBAREDO D'ADIGE", address: "VIA ROMA 5, ALBAREDO D'ADIGE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ARCOLE", address: "VIA ROMA 30, ARCOLE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ARZIGNANO", address: "VIA ROMA 40, ARZIGNANO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ASIAGO", address: "VIA ROMA 15, ASIAGO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BARDOLINO", address: "VIA GARDESANA 50, BARDOLINO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BOSCO CHIESANUOVA", address: "VIA ROMA 10, BOSCO CHIESANUOVA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BOVOLENTA", address: "VIA ROMA 5, BOVOLENTA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BOVOLONE", address: "PIAZZALE FLEMING ALEXANDER 1, BOVOLONE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BRENZONE SUL GARDA", address: "VIA MONSIGNORE GIUSEPPE NASCIMBENI 6, BRENZONE SUL GARDA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BUSSOLENGO", address: "VIA OSPEDALE 10, BUSSOLENGO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO BUTTAPIETRA", address: "VIA ROMA 8, BUTTAPIETRA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CALDIERO", address: "VIA STRÀ 12, CALDIERO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CAMPO SAN MARTINO", address: "VIA ROMA 18, CAMPO SAN MARTINO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CAMPOSAMPIERO", address: "VIA ROMA 22, CAMPOSAMPIERO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CAMPOSTRINI", address: "VIA SANTA MARIA IN ORGANO 2, VERONA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CAPRINO VERONESE", address: "VIA CAPPUCCINI 20, CAPRINO VERONESE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CASALE DI SCODOSIA", address: "VIA ROMA 25, CASALE DI SCODOSIA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CASTAGNARO", address: "VIA ROMA 25, CASTAGNARO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CITTADELLA", address: "VIA ROMA 15, CITTADELLA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO COLOGNOLA AI COLLI", address: "VIA ROMA 15, COLOGNOLA AI COLLI (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO CONSELVE", address: "VIA TRAVERSO L. 1/A, CONSELVE (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO DANIELE COMBONI", address: "VIA MENTANA 26, VERONA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO DON A. SIMIONATI E CAV. D. SOATTINI", address: "VIA A. PALLADIO 13, BARBARANO MOSSANO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO DON ANTONIO BRUZZO", address: "VIA ROMA 37, GAMBELLARA (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ESTE", address: "VIA ROMA 20, ESTE (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO GALZIGNANO TERME", address: "VIA ROMA 10, GALZIGNANO TERME (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO GAZZO VERONESE", address: "VIA DELLA CHIESA 8, GAZZO VERONESE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO GODI-SGARGI", address: "VIA ROMA 152, TORRI DI QUARTESOLO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ILLASI", address: "PIAZZA SPREA BONIFACIO 18, ILLASI (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO ISOLA DELLA SCALA", address: "VIA DEL DONATORE DI SANGUE 4, ISOLA DELLA SCALA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO LE BETULLE", address: "VIA GIOVANNI COTTA 4, VERONA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO LEGNAGO", address: "CORSO DELLA VITTORIA 14, LEGNAGO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO LONIGO", address: "VIA ROMA 10, LONIGO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO LOZZO ATESTINO", address: "VIA ROMA 10, LOZZO ATESTINO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO MAROSTICA", address: "VIA ROMA 20, MAROSTICA (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO MONSELICE", address: "VIA ROMA 25, MONSELICE (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO MONTAGNANA", address: "VIA ROMA 30, MONTAGNANA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO NOVENTA PADOVANA", address: "VIA ROMA 20, NOVENTA PADOVANA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO PESCANTINA", address: "CORSO S. LORENZO 27, PESCANTINA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO PIAZZOLA SUL BRENTA", address: "VIA XX SETTEMBRE 2, PIAZZOLA SUL BRENTA (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO PONTELONGO", address: "VIA ROMA 8, PONTELONGO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO RONCO ALL'ADIGE", address: "VIA FORANTE IPPOLITA 10, RONCO ALL'ADIGE (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO RUBANO", address: "VIA ROMA 15, RUBANO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SAN GIOVANNI LUPATOTO", address: "VIA ROMA 15, SAN GIOVANNI LUPATOTO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SAN GIUSEPPE", address: "Via Milano 12, Legnago", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SAN PIO FATEBENEFRATELLI", address: "VIA ROMA 50, ROMANO D'EZZELINO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SANT'ANNA", address: "VIA MARSALA 8, VERONA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SANT'URBANO", address: "VIA ROMA 12, SANT'URBANO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SANTA MARIA", address: "Via Dante 34, San Bonifacio", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SCHIO", address: "VIA ROMA 30, SCHIO (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SELVAZZANO DENTRO", address: "VIA ROMA 20, SELVAZZANO DENTRO (PD)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO SOMMACAMPAGNA", address: "VIA MATTEOTTI GIACOMO 3, SOMMACAMPAGNA (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO THIENE", address: "VIA ROMA 25, THIENE (VI)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO TORRI DEL BENACO", address: "VIA GARDESANA 113, TORRI DEL BENACO (VR)", type: "casa_di_riposo" },
  { name: "CASA DI RIPOSO VALDAGNO", address: "VIA ROMA 35, VALDAGNO (VI)", type: "casa_di_riposo" },
  { name: "CASA DON ORIONE", address: "VIA DON ORIONE 5, TREBASELEGHE (PD)", type: "casa_di_riposo" },
  { name: "CASA FAMIGLIA ANZIANI MARIA BRUNETTA", address: "PIAZZA DELLA COMUNITA' 6, MARANO DI VALPOLICELLA (VR)", type: "casa_di_riposo" },
  { name: "CASA RIPOSO CA' ARNALDI", address: "VIA ROMA 30, NOVENTA VICENTINA (VI)", type: "casa_di_riposo" },
  { name: "CASA RIPOSO DR. UMBERTO ALICE TASSONI", address: "VIA ROMA 40, CORNEDO VICENTINO (VI)", type: "casa_di_riposo" },
  { name: "CASA RIPOSO SAN GIOVANNI BATTISTA", address: "VIA ROMA 10, MONTEBELLO VICENTINO (VI)", type: "casa_di_riposo" },
  { name: "CENTRO SERVIZI ANZIANI CA FORNELLETTI", address: "Via Ca Fornelletti 3, Vicenza", type: "casa_di_riposo" },
  { name: "CENTRO SERVIZI MORELLI BUGNA", address: "VIA RINALDO 16, VILLAFRANCA DI VERONA (VR)", type: "casa_di_riposo" },
  { name: "CENTRO SERVIZI VILLA SERENA", address: "VIA ROMA 20, TRISSINO (VI)", type: "casa_di_riposo" },
  { name: "CRAUP RSA", address: "VIA BOTTA 15, PIOVE DI SACCO (PD)", type: "casa_di_riposo" },
  { name: "CSA GIORGIONE GRUPPO GHERON", address: "VIA ROMA 25, VIGONZA (PD)", type: "casa_di_riposo" },
  { name: "CSA MANTEGNA", address: "VIA WOLFGANG AMADEUS MOZART 1, CAMPODARSEGO (PD)", type: "casa_di_riposo" },
  { name: "CSA TIEPOLO GRUPPO GHERON", address: "VIA ROMA 30, SAN MARTINO DI LUPARI (PD)", type: "casa_di_riposo" },
  { name: "CSA TIZIANO GRUPPO GHERON", address: "VIA MONSIGNOR L. ZANE 59, MASERA' DI PADOVA (PD)", type: "casa_di_riposo" },
  { name: "ERMITAGE BEL AIR MEDICAL HOTEL", address: "VIA ROMA 50, TEOLO (PD)", type: "casa_di_riposo" },
  { name: "IPAB G. BISOGNIN SERVIZI SOCIO ASSISTENZIALI", address: "VIA ROMA 15, SALCEDO (VI)", type: "casa_di_riposo" },
  { name: "IPAB LA PIEVE SERVIZI ASSISTENZIALI", address: "VIA ROMA 25, MONTECCHIO MAGGIORE (VI)", type: "casa_di_riposo" },
  { name: "IPAB VICENZA", address: "CONTRA' S. PIETRO 60, VICENZA (VI)", type: "casa_di_riposo" },
  { name: "IPAB VICENZA RESIDENZA OTTAVIO TRENTO", address: "PIAZZA S. PIETRO 9, VICENZA (VI)", type: "casa_di_riposo" },
  { name: "IRA ALTAVITA ISTITUZIONI RIUNITE DI ASSISTENZA", address: "VIA FORTIN MONSIGNOR GIOVANNI 34/43, PADOVA (PD)", type: "casa_di_riposo" },
  { name: "IRA ALTAVITA PIAZZA DE CLARICINI", address: "PIAZZA B. DE CLARICINI 12, PADOVA (PD)", type: "casa_di_riposo" },
  { name: "IRA ALTAVITA PIAZZALE MAZZINI", address: "PIAZZALE MAZZINI 14, PADOVA (PD)", type: "casa_di_riposo" },
  { name: "IRA ALTAVITA VIA BRESSAN", address: "VIA LUDOVICO BRESSAN 6, PADOVA (PD)", type: "casa_di_riposo" },
  { name: "LA MADONNINA RESIDENZA PER ANZIANI", address: "VIA TRIESTE 1, BASSANO DEL GRAPPA (VI)", type: "casa_di_riposo" },
  { name: "RESIDENZA ANNI SERENI", address: "Via Trieste 78, Soave", type: "casa_di_riposo" },
  { name: "RESIDENZA ANZIANI VILLA ROSA", address: "Via Verdi 23, Montecchio Maggiore", type: "casa_di_riposo" },
  { name: "RESIDENZA VILLA CALDOGNO", address: "VIA ROMA 15, CALDOGNO (VI)", type: "casa_di_riposo" },
  { name: "RSA BERTO BARBARANI", address: "PIAZZALE LUDOVICO ANTONIO SCURO 12, VERONA (VR)", type: "casa_di_riposo" },
  { name: "RSA MADONNA DEL POPOLO", address: "Via Garibaldi 8, Cologna Veneta", type: "casa_di_riposo" },
  { name: "RSA SACRO CUORE", address: "Viale Europa 56, Nogara", type: "casa_di_riposo" },
  { name: "RSA SAN MICHELE", address: "VIALE EUROPA UNITA 12, MONTECCHIO PRECALCINO (VI)", type: "casa_di_riposo" },
  { name: "RSA SOAVE", address: "VIA ROMA 50, SOAVE (VR)", type: "casa_di_riposo" },
  { name: "RSA VILLA SERENA", address: "Via Roma 45, Verona", type: "casa_di_riposo" },
  { name: "VILLA IN VILLA CENTRO DIURNO", address: "VIA ROMA 10, VILLA ESTENSE (PD)", type: "casa_di_riposo" },
  // Altro (9)
  { name: "CASA DI RIPOSO DI CASTEL D'AZZANO", address: "VIA EUROPA 2, CASTEL D'AZZANO (VR)", type: "altro" },
  { name: "CASA DI RIPOSO DI CEREA", address: "VIA GENERALE DALLA CHIESA 2, CEREA (VR)", type: "altro" },
  { name: "CASA DI RIPOSO DI VERONA", address: "VIA DELLE FRANCESCHINE 6, VERONA (VR)", type: "altro" },
  { name: "CENTRO DIALISI SAN BONIFACIO", address: "VIA VITTORIO EMANUELE 23, SAN BONIFACIO (VR)", type: "altro" },
  { name: "CENTRO DIALISI VERONA", address: "VIA MAMELI 15, VERONA (VR)", type: "altro" },
  { name: "CENTRO RIABILITAZIONE FRACASTORO", address: "VIA FRACASTORO 1, SAN BONIFACIO (VR)", type: "altro" },
  { name: "FONDAZIONE MARZOTTO", address: "VIA PETRARCA, VALDAGNO (VI)", type: "altro" },
  { name: "HOSPICE CASA DEL SOLE", address: "VIA MAGENTA 10, VILLAFRANCA DI VERONA (VR)", type: "altro" },
  { name: "VILLA MARGHERITA", address: "VIALE MAZZINI 42, ARCUGNANO (VI)", type: "altro" },
];

async function syncStructures() {
  const existingStructures = await db.select({ name: structures.name }).from(structures);
  const existingNames = new Set(existingStructures.map(s => s.name));
  
  const missingStructures = ALL_STRUCTURES.filter(s => !existingNames.has(s.name));
  
  if (missingStructures.length > 0) {
    console.log(`Adding ${missingStructures.length} missing structures...`);
    const inserted = await db.insert(structures).values(missingStructures).returning();
    console.log(`Inserted ${inserted.length} new structures`);
  } else {
    console.log(`All ${ALL_STRUCTURES.length} structures already present`);
  }
}

// Embedded trip data for seeding - no file dependency
const INITIAL_TRIPS = [
  { progressive_number: "1765498361433", vehicle_code: "J 30", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "10:00:00", return_time: "10:35:00", patient_birth_year: 1955, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO TRENTO", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "ospedale", destination_structure_name: "OSPEDALE BORGO ROMA", destination_department_name: "REPARTO CARDIOLOGIA", destination_address: null, km_initial: 417945, km_final: 417955, km_traveled: 10, duration_minutes: 35, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "1765534212729", vehicle_code: "J 60", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "11:10:00", return_time: "11:23:00", patient_birth_year: 1955, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA GIBILROSSA, VERONA", km_initial: 165000, km_final: 165006, km_traveled: 6, duration_minutes: 13, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "1765534655469", vehicle_code: "J 45", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "10:00:00", return_time: "11:00:00", patient_birth_year: 1950, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: null, origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA GIBILROSSA, VERONA", km_initial: 195000, km_final: 195006, km_traveled: 6, duration_minutes: 60, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "1765535155135", vehicle_code: "J 45", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "08:00:00", return_time: "09:00:00", patient_birth_year: 1970, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: null, origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA VERDI, VERONA", km_initial: 195006, km_final: 195038, km_traveled: 32, duration_minutes: 60, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "1765539563264", vehicle_code: "J 46", user_email: "demo@croceeuropa.it", service_date: "2025-12-12", departure_time: "12:39:00", return_time: "13:24:00", patient_birth_year: 1988, patient_gender: "F", origin_type: "ospedale", origin_structure_name: "OSPEDALE BORGO ROMA", origin_department_name: "REPARTO PRONTO SOCCORSO", origin_address: null, destination_type: "domicilio", destination_structure_name: null, destination_department_name: null, destination_address: "VIA BASSANESE SUPERIORE, POZZOLEONE, VICENZA", km_initial: 210000, km_final: 210087, km_traveled: 87, duration_minutes: 45, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "123456", vehicle_code: "J 30", user_email: "demo@croceeuropa.it", service_date: "2025-12-13", departure_time: "16:43:00", return_time: "17:39:00", patient_birth_year: 1989, patient_gender: "F", origin_type: "ospedale", origin_structure_name: "OSPEDALE MATER SALUTIS", origin_department_name: "REPARTO CARDIOLOGIA", origin_address: null, destination_type: "ospedale", destination_structure_name: "OSPEDALE BORGO TRENTO", destination_department_name: "REPARTO CHIRURGIA GENERALE", destination_address: null, km_initial: 500149, km_final: 500237, km_traveled: 88, duration_minutes: 56, service_type: null, is_return_trip: false, notes: null },
  { progressive_number: "77777", vehicle_code: "J 55", user_email: "demo@croceeuropa.it", service_date: "2025-12-13", departure_time: "00:06:00", return_time: "00:28:00", patient_birth_year: 1988, patient_gender: "M", origin_type: "ospedale", origin_structure_name: "OSPEDALE MATER SALUTIS", origin_department_name: "RADIOLOGIA", origin_address: null, destination_type: "ospedale", destination_structure_name: null, destination_department_name: null, destination_address: null, km_initial: 150000, km_final: 150021, km_traveled: 21, duration_minutes: 22, service_type: null, is_return_trip: false, notes: null },
];

async function syncTrips() {
  try {
    const [{ count: tripCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(trips);
    const tripCount = Number(tripCountRaw);
    
    const exportPath = path.join(process.cwd(), 'server', 'data', 'trips_export.json');
    
    if (!fs.existsSync(exportPath)) {
      console.log('No trips_export.json found, using INITIAL_TRIPS only');
      if (tripCount >= 7) {
        console.log(`Already have ${tripCount} trips, skipping import`);
        return;
      }
    }
    
    if (tripCount >= 2800) {
      console.log(`Already have ${tripCount} trips, skipping import (fast path)`);
      return;
    }
    
    let exportedTripsData: any[];
    if (fs.existsSync(exportPath)) {
      const rawData = fs.readFileSync(exportPath, 'utf-8');
      exportedTripsData = JSON.parse(rawData);
      console.log(`Loaded ${exportedTripsData.length} trips from export file`);
    } else {
      exportedTripsData = INITIAL_TRIPS;
    }
    
    if (tripCount >= exportedTripsData.length) {
      console.log(`Already have ${tripCount} trips, skipping import`);
      return;
    }
    
    const existingTrips = await db.select({
      key: sql<string>`progressive_number || '|' || service_date || '|' || departure_time`
    }).from(trips);
    const existingKeys = new Set(existingTrips.map(t => t.key));
    
    const tripsToImport = exportedTripsData.filter((t: any) => {
      const key = `${t.progressive_number}|${t.service_date}|${t.departure_time}`;
      return !existingKeys.has(key);
    });
    
    if (tripsToImport.length === 0) {
      console.log("All exported trips already present");
      return;
    }
    
    console.log(`Building lookup maps for trip import (${tripsToImport.length} new trips)...`);
    
    const allVehicles = await db.select().from(vehicles);
    const vehicleByCode = new Map(allVehicles.map(v => [v.code, v.id]));
    
    const allUsers = await db.select().from(users);
    const userByEmail = new Map(allUsers.map(u => [u.email, u.id]));
    const defaultUserId = allUsers.find(u => u.role === 'crew')?.id || allUsers[0]?.id;
    
    const allStructures = await db.select().from(structures);
    const structureByName = new Map(allStructures.map(s => [s.name, s.id]));
    
    const allDepartments = await db.select().from(departments);
    const departmentByName = new Map(allDepartments.map(d => [d.name, d.id]));
    
    console.log(`Importing ${tripsToImport.length} trips using name-based mappings...`);
    
    let imported = 0;
    let skipped = 0;
    const batchSize = 50;
    
    for (let i = 0; i < tripsToImport.length; i += batchSize) {
      const batch = tripsToImport.slice(i, i + batchSize);
      const batchValues: any[] = [];
      
      for (const trip of batch) {
        try {
          const vehicleId = trip.vehicle_code ? vehicleByCode.get(trip.vehicle_code) : null;
          const userId = trip.user_email ? userByEmail.get(trip.user_email) : null;
          
          const effectiveUserId = userId || defaultUserId;
          const effectiveVehicleId = vehicleId || allVehicles[0]?.id;
          if (!effectiveUserId || !effectiveVehicleId) {
            skipped++;
            continue;
          }
          
          const originStructureId = trip.origin_structure_name ? structureByName.get(trip.origin_structure_name) || null : null;
          const originDepartmentId = trip.origin_department_name ? departmentByName.get(trip.origin_department_name) || null : null;
          const destinationStructureId = trip.destination_structure_name ? structureByName.get(trip.destination_structure_name) || null : null;
          const destinationDepartmentId = trip.destination_department_name ? departmentByName.get(trip.destination_department_name) || null : null;
          
          batchValues.push({
            progressiveNumber: trip.progressive_number,
            vehicleId: effectiveVehicleId,
            userId: effectiveUserId,
            serviceDate: trip.service_date,
            departureTime: trip.departure_time,
            returnTime: trip.return_time,
            patientBirthYear: trip.patient_birth_year,
            patientGender: trip.patient_gender,
            originType: trip.origin_type,
            originStructureId: originStructureId,
            originDepartmentId: originDepartmentId,
            originAddress: trip.origin_address,
            destinationType: trip.destination_type,
            destinationStructureId: destinationStructureId,
            destinationDepartmentId: destinationDepartmentId,
            destinationAddress: trip.destination_address,
            kmInitial: trip.km_initial,
            kmFinal: trip.km_final,
            kmTraveled: trip.km_traveled,
            durationMinutes: trip.duration_minutes,
            serviceType: trip.service_type,
            isReturnTrip: trip.is_return_trip,
            notes: trip.notes,
            crewType: trip.crew_type || null,
            isEmergencyService: trip.is_emergency_service || false,
            totalWaypointKm: trip.total_waypoint_km || null,
            organizationId: 'croce-europa-default',
          });
        } catch (err) {
          skipped++;
        }
      }
      
      if (batchValues.length > 0) {
        try {
          await db.insert(trips).values(batchValues);
          imported += batchValues.length;
        } catch (err) {
          for (const val of batchValues) {
            try {
              await db.insert(trips).values(val);
              imported++;
            } catch (e) {
              skipped++;
            }
          }
        }
      }
      
      if ((i + batchSize) % 500 === 0 || i + batchSize >= tripsToImport.length) {
        console.log(`  Progress: ${Math.min(i + batchSize, tripsToImport.length)}/${tripsToImport.length} processed`);
      }
    }
    
    console.log(`Trip import completed: ${imported} imported, ${skipped} skipped`);
  } catch (error) {
    console.error("Error syncing trips:", error);
  }
}

async function syncChecklistTemplateItems() {
  try {
    console.log("Syncing checklist template items...");
    await db.execute(sql`
      INSERT INTO checklist_template_items (id, label, category, sub_zone, quantity, is_required, sort_order, is_active, has_expiry, expiry_alert_days, zone_color)
      VALUES
        ('b6b72d26-9501-4a74-9f41-80eeb2c81240', 'Olio motore', 'Controlli Autista', NULL, 1, true, 1, true, false, 30, '#FFA500'),
        ('2159e78b-b07c-4e75-89d3-36dbeabe65d4', 'Olio idroguida', 'Controlli Autista', NULL, 1, true, 2, true, false, 30, '#FFA500'),
        ('3ce139fe-db36-4308-8015-595157ce4bf4', 'Acqua radiatore', 'Controlli Autista', NULL, 1, true, 3, true, false, 30, '#FFA500'),
        ('7a061ffb-bbc8-43a9-95ff-5e1965b53f02', 'Acqua tergicristalli', 'Controlli Autista', NULL, 1, true, 4, true, false, 30, '#FFA500'),
        ('66dc4f0c-d29d-468c-80c9-d0268570b6aa', 'Livello carburante', 'Controlli Autista', NULL, 1, true, 5, true, false, 30, '#FFA500'),
        ('d720202b-3fec-44a3-8757-e256c79a0e82', 'Pneumatici in buono stato', 'Controlli Autista', NULL, 1, true, 6, true, false, 30, '#FFA500'),
        ('9caaf3bf-b23d-4059-b6c2-ebdad7259def', 'Controllo luci varie', 'Controlli Autista', NULL, 1, true, 7, true, false, 30, '#FFA500'),
        ('a73c8490-d96c-440f-a0c5-f874b7b95d21', 'Controllo dispositivi di segnalazione', 'Controlli Autista', NULL, 1, true, 8, true, false, 30, '#FFA500'),
        ('5d559bd3-42a0-44c4-b168-e5b9c40b44fd', 'Controllo assicurazione e revisione', 'Controlli Autista', NULL, 1, true, 9, true, false, 30, '#FFA500'),
        ('fa7858a7-e2b5-445a-a0a6-5372ec22317f', 'Mezzo pulito esternamente ed internamente', 'Controlli Autista', NULL, 1, true, 10, true, false, 30, '#FFA500'),
        ('f201ff64-d629-46a6-9f9f-66f0a11d2faf', 'Cellulare', 'Controlli Autista', NULL, 1, true, 11, true, false, 30, '#FFA500'),
        ('f1e6b784-d059-459f-85a8-5a72d2e0e7a3', 'Navigatore con cavo caricabatteria', 'Controlli Autista', NULL, 1, true, 12, true, false, 30, '#FFA500'),
        ('6d1a7008-e7a7-469e-9355-01f886a007f0', 'Caschetti protettivi (nel vano sanitario)', 'Controlli Autista', NULL, 2, true, 13, true, false, 30, '#FFA500'),
        ('3e496318-48ba-493d-9ef0-7579ac3c4612', 'Torcia notturna', 'Controlli Autista', NULL, 1, true, 14, true, false, 30, '#FFA500'),
        ('76ec15bf-faf7-4f48-bbb1-2f7b6d45824e', 'Telepass', 'Controlli Autista', NULL, 1, true, 15, true, false, 30, '#FFA500'),
        ('69497955-e8d1-4aa3-b9f1-0729286e42db', 'Schede intervento e moduli vari', 'Controlli Autista', NULL, 1, true, 16, true, false, 30, '#FFA500'),
        ('5acf69a0-e0f5-487f-b319-d75b8394013f', 'Estintore vano guida e vano sanitario', 'Controlli Autista', NULL, 2, true, 17, true, false, 30, '#FFA500'),
        ('045b9818-3c00-488c-bc6e-967bc78d4c4a', 'Guanti da lavoro', 'Controlli Autista', NULL, 1, true, 18, true, false, 30, '#FFA500'),
        ('72b8b55f-3b4f-4c01-af07-18c55afffca5', 'Saturimetro', 'Materiale Zaino', 'Parametri', 1, true, 100, true, false, 30, '#00A651'),
        ('34ccc422-9413-43f8-9c63-32d0e418ea1e', 'Sfigmomanometro', 'Materiale Zaino', 'Parametri', 1, true, 101, true, false, 30, '#00A651'),
        ('3141637c-b118-43f2-ba7d-4e10ede79609', 'Fonendoscopio', 'Materiale Zaino', 'Parametri', 1, true, 102, true, false, 30, '#00A651'),
        ('dd13919f-0826-4bf0-9783-08a2180c30f1', 'Compressive', 'Materiale Zaino', 'Medicazione', 2, true, 110, true, true, 30, '#00A651'),
        ('925a1d82-835a-4bab-8178-67165967399f', 'Garze sterili', 'Materiale Zaino', 'Medicazione', 10, true, 111, true, true, 30, '#00A651'),
        ('0a9235f4-c1c1-41a6-8649-71b1f9b14c5b', 'Garze non sterili', 'Materiale Zaino', 'Medicazione', 1, true, 112, true, true, 30, '#00A651'),
        ('f073c39d-4a5e-4c71-b313-5c2dafccbd2c', 'Acqua ossigenata', 'Materiale Zaino', 'Medicazione', 1, true, 113, true, true, 30, '#00A651'),
        ('7de01e53-3de9-4d3c-9bc4-49fd479653b4', 'Amuchina 250 ml', 'Materiale Zaino', 'Medicazione', 1, true, 114, true, true, 30, '#00A651'),
        ('f0a680d8-f324-44ed-8f01-332885fcbeef', 'Fisiologiche 250ml', 'Materiale Zaino', 'Infusione', 2, true, 120, true, true, 30, '#00A651'),
        ('0dda7fc0-9e91-4c83-8cdc-bee15e620d20', 'Glucosata 5% da 250ml', 'Materiale Zaino', 'Infusione', 1, true, 121, true, true, 30, '#00A651'),
        ('78fe80e1-df49-4d17-856f-147472a45be9', 'Deflussori', 'Materiale Zaino', 'Infusione', 2, true, 122, true, true, 30, '#00A651'),
        ('9e8c0f21-f6b8-43be-b2fe-2c38becc3f56', 'Aghi canula per misura + tappi blu', 'Materiale Zaino', 'Infusione', 2, true, 123, true, true, 30, '#00A651'),
        ('579f5889-bf3d-4187-98be-a20218a84d5b', 'Siringa per misura (2.5ml+5ml+10ml)', 'Materiale Zaino', 'Infusione', 1, true, 124, true, true, 30, '#00A651'),
        ('eb1bdbb8-7df1-472a-bd91-3de338851b45', 'Garze non sterili + Fixomull pre tagliato', 'Materiale Zaino', 'Infusione', 1, true, 125, true, true, 30, '#00A651'),
        ('28996f48-01d5-47ad-9718-e03879a1a49b', 'Laccio emostatico', 'Materiale Zaino', 'Infusione', 1, true, 126, true, false, 30, '#00A651'),
        ('18419a43-f22c-4d2e-84f6-c8511461c11c', 'Barattolo porta aghi', 'Materiale Zaino', 'Infusione', 1, true, 127, true, false, 30, '#00A651'),
        ('0c05b66e-620e-47e1-9cf2-068e14f0729d', 'Disinfettante', 'Materiale Zaino', 'Infusione', 1, true, 128, true, true, 30, '#00A651'),
        ('26befae6-33a0-4c9c-b208-4582e86fb80a', 'Pallone AMBU + Reservoir', 'Materiale Zaino', 'Ventilazione', 1, true, 130, true, true, 30, '#00A651'),
        ('4239dd56-4ba1-4954-bfce-dde7442e215b', 'Guedel per misura', 'Materiale Zaino', 'Ventilazione', 1, true, 131, true, true, 30, '#00A651'),
        ('ab6232e2-cb9f-4a21-b879-d558e28ebc94', 'Filtro pallone AMBU', 'Materiale Zaino', 'Ventilazione', 1, true, 132, true, true, 30, '#00A651'),
        ('c9f1e72f-d384-4ee7-b14f-53a254e5e43b', 'Maschera per misura', 'Materiale Zaino', 'Ventilazione', 1, true, 133, true, true, 30, '#00A651'),
        ('1b22fd94-8ebe-430e-be2b-1507b46a02e9', 'Catetere di Mount', 'Materiale Zaino', 'Ventilazione', 1, true, 134, true, true, 30, '#00A651'),
        ('185e17c7-e486-415a-a970-c1963ce243db', 'Prolunga per O2', 'Materiale Zaino', 'Ventilazione', 1, true, 135, true, false, 30, '#00A651'),
        ('0e37e43e-24b4-40c3-8bfc-6358a72d9869', 'Siringa da 10 ml', 'Materiale Zaino', 'Ventilazione', 1, true, 136, true, true, 30, '#00A651'),
        ('e854354e-b860-4c60-9429-d7943517505f', 'Telo isotermico', 'Materiale Zaino', 'Materiale Vario', 1, true, 140, true, false, 30, '#00A651'),
        ('6c525aa0-fbc9-49e3-bc0e-9ed5ee1982ae', 'Maschera O2 + Maschera O2 con Reservoir', 'Materiale Zaino', 'Materiale Vario', 2, true, 141, true, true, 30, '#00A651'),
        ('51cbbd70-63fc-4b17-8ca3-01f75c0b8cc3', 'Forbice taglia vestiti', 'Materiale Zaino', 'Materiale Vario', 1, true, 142, true, false, 30, '#00A651'),
        ('0e581535-9787-462c-909d-541f9c9e2572', 'Sacchetto porta rifiuti', 'Materiale Zaino', 'Materiale Vario', 1, true, 143, true, false, 30, '#00A651'),
        ('2f436c06-e7b9-442e-987e-042f81ba1c2a', 'Lenzuola pulite', 'Materiale Ambulanza', 'Scomparto 1', 1, true, 200, true, false, 30, '#0066CC'),
        ('6338374a-e07e-4904-b5ee-873778dba2f2', 'Collari cervicali adulti', 'Materiale Ambulanza', 'Scomparto 1', 2, true, 201, true, false, 30, '#0066CC'),
        ('2b7e5a0f-9035-4f03-93f2-2a4ca5fd81a4', 'Collare pediatrico', 'Materiale Ambulanza', 'Scomparto 1', 1, true, 202, true, false, 30, '#0066CC'),
        ('cfc21d2c-114f-42e3-82d3-ee67ffd88121', 'Ragno e fermacapo', 'Materiale Ambulanza', 'Scomparto 2', 1, true, 210, true, false, 30, '#0066CC'),
        ('4f7a3e1d-8613-47f8-8050-02ea303d66fd', 'Set cinture cucchiaio', 'Materiale Ambulanza', 'Scomparto 2', 1, true, 211, true, false, 30, '#0066CC'),
        ('ca70c96f-1de8-49a3-8452-b2df24868759', 'Sacchetti rifiuti di scorta', 'Materiale Ambulanza', 'Scomparto 3', 1, true, 220, true, false, 30, '#0066CC'),
        ('6fc4b6c3-d752-4bf3-9c97-e8edf53774c4', 'Telo sterile', 'Materiale Ambulanza', 'Scomparto 4', 1, true, 230, true, true, 30, '#0066CC'),
        ('51d4d5fb-3bc6-4107-925e-6f0c3d671b35', 'Compressive', 'Materiale Ambulanza', 'Scomparto 4', 2, true, 231, true, true, 30, '#0066CC'),
        ('59ad97de-6b0a-47e6-9f32-50030aca86d5', 'Teli isotermici', 'Materiale Ambulanza', 'Scomparto 4', 2, true, 232, true, false, 30, '#0066CC'),
        ('a027c997-cd31-4fe6-b1d1-8fbbc5e74d0f', 'Ghiacci istantanei', 'Materiale Ambulanza', 'Scomparto 4', 2, true, 233, true, true, 30, '#0066CC'),
        ('c8cb6038-2425-4a6e-917b-cc66362ff10f', 'Fisiologiche da 100 ml', 'Materiale Ambulanza', 'Scomparto 5', 2, true, 240, true, true, 30, '#0066CC'),
        ('e4e40bbd-bdbe-4cac-8c2b-b32e1124d488', 'Fisiologiche da 250 ml', 'Materiale Ambulanza', 'Scomparto 5', 2, true, 241, true, true, 30, '#0066CC'),
        ('c565edbc-239b-4168-9b0c-91aa806a02cf', 'Fisiologica da 500 ml', 'Materiale Ambulanza', 'Scomparto 5', 1, true, 242, true, true, 30, '#0066CC'),
        ('a5f451c2-0316-4afa-82e5-c616112b16ef', 'Glucosata da 250 ml', 'Materiale Ambulanza', 'Scomparto 5', 1, true, 243, true, true, 30, '#0066CC'),
        ('bf02be6a-48b2-4fb0-b4cd-2fa97daee05a', 'Deflussori + regolatore di flusso', 'Materiale Ambulanza', 'Scomparto 5', 3, true, 244, true, true, 30, '#0066CC'),
        ('1c2da29d-7e9d-4c6f-bf3e-62e092b86bb6', 'Siringhe per misura (2.5ml+5ml+10ml)', 'Materiale Ambulanza', 'Scomparto 5', 2, true, 245, true, true, 30, '#0066CC'),
        ('c063452f-6d1a-4014-ac86-af9b4e33eefc', 'Maschera O2', 'Materiale Ambulanza', 'Scomparto 6', 2, true, 250, true, true, 30, '#0066CC'),
        ('1a312277-c118-4c59-a50e-89b8f6bf90a9', 'Maschera O2 con reservoir', 'Materiale Ambulanza', 'Scomparto 6', 2, true, 251, true, true, 30, '#0066CC'),
        ('e3751f31-32de-44a5-a950-1a46bb558e80', 'Occhialini O2', 'Materiale Ambulanza', 'Scomparto 6', 2, true, 252, true, true, 30, '#0066CC'),
        ('b4f2fb3f-9b20-40b7-8b3f-c82ba27e54e3', 'Sacchetto aspiratore di scorta', 'Materiale Ambulanza', 'Scomparto 7', 1, true, 260, true, false, 30, '#0066CC'),
        ('a5c8126c-c27b-4934-8700-ed8c8344dbfa', 'Tubo aspiratore di scorta', 'Materiale Ambulanza', 'Scomparto 7', 1, true, 261, true, false, 30, '#0066CC'),
        ('1da151f3-0ffc-4262-ad6f-7cb35df7934e', 'Busta D.P.I.', 'Materiale Ambulanza', 'Scomparto 7', 1, true, 262, true, false, 30, '#0066CC'),
        ('c07c25c8-3fb3-4e42-a50f-992310074950', 'Pompa materassino', 'Materiale Ambulanza', 'Scomparto 8', 1, true, 270, true, false, 30, '#0066CC'),
        ('59d42d46-8a67-4ac8-80b1-2243f8685fa3', 'Caschetti protettivi', 'Materiale Ambulanza', 'Scomparto 9', 2, true, 280, true, false, 30, '#0066CC'),
        ('a5094dd4-3668-4dcb-b39c-26fe99c5befa', 'Ago canula per misura', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 290, true, true, 30, '#0066CC'),
        ('8fb58eab-4cad-4abe-b160-ced7517347fa', 'Garze sterili', 'Materiale Ambulanza', 'Scomparto 10', 10, true, 291, true, true, 30, '#0066CC'),
        ('34b90a9c-c462-4be4-9f36-d533939fb75b', 'Garze non sterili', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 292, true, true, 30, '#0066CC'),
        ('25d18ff1-5440-4e2e-a1c3-10a17634a251', 'Fixomull', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 293, true, true, 30, '#0066CC'),
        ('161887cc-c122-4ff5-910f-c4812bec41f5', 'Rotolo cerotto', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 294, true, true, 30, '#0066CC'),
        ('9c60e703-1e16-4d6e-af09-b83873d9b29f', 'Forbice taglia vestiti', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 295, true, false, 30, '#0066CC'),
        ('db3b4491-9ef7-4901-bacd-d08fe55c5cb3', 'Disinfettante Amuchina', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 296, true, true, 30, '#0066CC'),
        ('f19b20bf-d939-4e64-a603-6132d73a2a9d', 'Acqua ossigenata', 'Materiale Ambulanza', 'Scomparto 10', 1, true, 297, true, true, 30, '#0066CC'),
        ('097b730d-ed03-4524-b743-894c2d0d5d0f', 'Estricatore KED', 'Materiale Vario', NULL, 1, true, 300, true, false, 30, '#CC0000'),
        ('e2fc5b63-76c0-4dec-901e-64ac36d709d8', 'Telo porta feriti', 'Materiale Vario', NULL, 1, true, 301, true, false, 30, '#CC0000'),
        ('2f3e5dd1-f1d0-4448-8cdb-6941a846c2e6', 'Materasso a depressione', 'Materiale Vario', NULL, 1, true, 302, true, false, 30, '#CC0000'),
        ('490aea74-abf0-4521-8e11-ab922c0bb075', 'Set steccobende', 'Materiale Vario', NULL, 1, true, 303, true, false, 30, '#CC0000'),
        ('7fb0cf8a-dea2-4f9d-ba26-b85475b8cb0b', 'Tavola spinale', 'Materiale Vario', NULL, 1, true, 304, true, false, 30, '#CC0000'),
        ('303fd2c6-a978-41a8-8676-65b4569186fe', 'Barella cucchiaio', 'Materiale Vario', NULL, 1, true, 305, true, false, 30, '#CC0000'),
        ('736f9f15-4e21-441e-ba50-966073a9bf91', 'Sedia portantina', 'Materiale Vario', NULL, 1, true, 306, true, false, 30, '#CC0000'),
        ('14765c02-df06-4832-9050-f5f55d4468d2', 'DAE (carica + coppia di placche)', 'Materiale Vario', NULL, 1, true, 310, true, true, 30, '#CC0000'),
        ('f1bbbbec-4223-43e8-90cf-893f02ea28c9', 'Aspiratore con sondini (1 x misura)', 'Materiale Vario', NULL, 1, true, 311, true, false, 30, '#CC0000'),
        ('bfa7ab19-cea7-40f5-8be2-b5b13c8b7e63', 'Guanti monouso S-M-L', 'Materiale Vario', NULL, 1, true, 312, true, true, 30, '#CC0000'),
        ('d7bf1773-d68d-4882-a425-4e8d6ab38711', 'Laccio emostatico', 'Materiale Vario', NULL, 1, true, 313, true, false, 30, '#CC0000'),
        ('9c90542b-3935-40bf-96d6-5b91e1b27bb6', 'Pappagallo monouso kit da 3', 'Materiale Vario', NULL, 3, true, 314, true, false, 30, '#CC0000')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("Checklist template items synced (90 items)");
  } catch (error) {
    console.error("Error syncing checklist template items:", error);
  }
}

async function syncAllDepartments() {
  try {
    console.log("Syncing departments...");

    await db.execute(sql`UPDATE departments SET name = REPLACE(name, 'REPARTO ', '') WHERE name LIKE 'REPARTO %'`);

    // Handle duplicates: move trip references from lowercase to uppercase duplicate, then delete lowercase
    const dupes = await db.execute(sql`
      SELECT d1.id as lower_id, d2.id as upper_id
      FROM departments d1
      JOIN departments d2 ON UPPER(d1.name) = d2.name AND d1.id != d2.id
      WHERE d1.name != UPPER(d1.name)
    `);
    for (const row of dupes.rows) {
      const lowerId = (row as any).lower_id;
      const upperId = (row as any).upper_id;
      await db.execute(sql`UPDATE trips SET origin_department_id = ${upperId} WHERE origin_department_id = ${lowerId}`);
      await db.execute(sql`UPDATE trips SET destination_department_id = ${upperId} WHERE destination_department_id = ${lowerId}`);
      await db.execute(sql`UPDATE structure_departments SET department_id = ${upperId} WHERE department_id = ${lowerId}`);
      await db.execute(sql`DELETE FROM departments WHERE id = ${lowerId}`);
      console.log(`Merged duplicate department ${lowerId} -> ${upperId}`);
    }

    // Now safe to uppercase remaining
    await db.execute(sql`UPDATE departments SET name = UPPER(name) WHERE name != UPPER(name)`);

    const ALL_DEPARTMENTS = [
      'ANATOMIA PATOLOGICA', 'ANESTESIA E RIANIMAZIONE', 'CARDIOCHIRURGIA', 'CARDIOCHIRURGIA PEDIATRICA',
      'CARDIOLOGIA', 'CHIRURGIA BARIATRICA', 'CHIRURGIA DEI TRAPIANTI DI RENE',
      'CHIRURGIA DELL\'ESOFAGO E DELLO STOMACO', 'CHIRURGIA DELLA MANO', 'CHIRURGIA GENERALE',
      'CHIRURGIA MAXILLO-FACCIALE', 'CHIRURGIA PEDIATRICA', 'CHIRURGIA PLASTICA', 'CHIRURGIA SENOLOGICA',
      'CHIRURGIA TORACICA', 'CHIRURGIA VASCOLARE', 'DERMATOLOGIA', 'DIABETOLOGIA', 'DIALISI',
      'DIREZIONE MEDICA', 'EMATOLOGIA', 'EMODIALISI', 'EMODINAMICA', 'ENDOCRINOLOGIA',
      'ENDOSCOPIA DIGESTIVA', 'FARMACIA', 'GASTROENTEROLOGIA', 'GERIATRIA', 'GINECOLOGIA',
      'IMMUNOEMATOLOGIA E TRASFUSIONALE', 'LABORATORIO ANALISI', 'LUNGODEGENZA', 'MALATTIE INFETTIVE',
      'MEDICINA D\'URGENZA', 'MEDICINA FISICA E RIABILITAZIONE', 'MEDICINA GENERALE', 'MEDICINA INTERNA',
      'MEDICINA NUCLEARE', 'MICROBIOLOGIA', 'NEFROLOGIA', 'NEUROCHIRURGIA', 'NEUROLOGIA',
      'NEUROPSICHIATRIA INFANTILE', 'NEURORADIOLOGIA', 'OCULISTICA', 'ONCOEMATOLOGIA PEDIATRICA',
      'ONCOLOGIA', 'ONCOLOGIA MEDICA', 'ORTOPEDIA E TRAUMATOLOGIA', 'OSPEDALE DI COMUNITA',
      'OSTETRICIA', 'OSTETRICIA E GINECOLOGIA', 'OTORINOLARINGOIATRIA', 'PATOLOGIA NEONATALE',
      'PEDIATRIA', 'PNEUMOLOGIA', 'PRONTO SOCCORSO', 'PSICHIATRIA', 'PSICOLOGIA CLINICA',
      'RADIOLOGIA', 'RADIOTERAPIA', 'RECUPERO E RIABILITAZIONE FUNZIONALE', 'RIABILITAZIONE',
      'STROKE UNIT', 'TERAPIA INTENSIVA', 'TERAPIA INTENSIVA NEONATALE', 'UROLOGIA', 'UTIC',
      'POLIAMBULATORI', 'UNITA SPINALE', 'ORTOPEDIA'
    ];

    const existingDepts = await db.select().from(departments);
    const existingNames = new Set(existingDepts.map(d => d.name));
    const missingDepts = ALL_DEPARTMENTS.filter(name => !existingNames.has(name));

    if (missingDepts.length > 0) {
      await db.insert(departments).values(missingDepts.map(name => ({ name }))).onConflictDoNothing();
      console.log(`Inserted ${missingDepts.length} missing departments`);
    } else {
      console.log("All departments already present");
    }
  } catch (error) {
    console.error("Error syncing departments:", error);
  }
}

async function syncLocationData() {
  try {
    console.log("Syncing location data...");
    await db.execute(sql`UPDATE locations SET name = 'SAN GIOVANNI LUPATOTO', address = 'VIA FORTE GAROFOLO, SAN GIOVANNI LUPATOTO (VR)' WHERE id = 'b73829f0-8cb9-453b-8f91-f5a1efc59061'`);
    await db.execute(sql`UPDATE locations SET name = 'COLOGNA VENETA', address = 'VIA RINASCIMENTO, COLOGNA VENETA (VR)' WHERE id = 'a362c8c4-4c89-4a3b-b362-c8c44c894a3b' OR name = 'Cologna Veneta'`);
    await db.execute(sql`UPDATE locations SET name = 'MONTECCHIO MAGGIORE', address = 'VIALE MILANO, MONTECCHIO MAGGIORE (VI)' WHERE id = 'dde6b010-8cb9-453b-8f91-f5a1efc59061' OR name = 'Montecchio Maggiore'`);
    await db.execute(sql`UPDATE locations SET name = 'LEGNAGO', address = 'VIA CARLO GIANELLA 5, LEGNAGO (VR)' WHERE id = '5c40c432-8cb9-453b-8f91-f5a1efc59061' OR name = 'Legnago'`);
    await db.execute(sql`UPDATE locations SET name = 'NOGARA', address = 'VIA RAFFA, NOGARA (VR)' WHERE id = '3a897440-8cb9-453b-8f91-f5a1efc59061' OR name = 'Nogara'`);
    console.log("Location data synced");
  } catch (error) {
    console.error("Error syncing location data:", error);
  }
}

async function syncMissingVehiclesAndUsers() {
  try {
    console.log("Syncing missing vehicles and users...");

    await db.execute(sql`DELETE FROM users WHERE email LIKE 'j %@croceeuropa.com'`);

    const existingJ47 = await db.select().from(users).where(eq(users.email, 'j47@croceeuropa.com'));
    if (existingJ47.length === 0) {
      const locationId = 'b73829f0-8cb9-453b-8f91-f5a1efc59061';
      const existingLoc = await db.select().from(locations).where(eq(locations.id, locationId));
      if (existingLoc.length > 0) {
        const [newVehicle] = await db.insert(vehicles).values({
          code: "J 47",
          licensePlate: "FX172LT",
          model: "DUCATO",
          vehicleType: "MSB",
          fuelType: "Gasolio",
          locationId: locationId,
          currentKm: 438187,
        }).returning();

        await db.insert(users).values({
          email: "j47@croceeuropa.com",
          password: "CroceJ47!",
          name: "Ambulanza J 47",
          role: "crew",
          accountType: "vehicle",
          vehicleId: newVehicle.id,
          locationId: locationId,
        });
        console.log("Created J 47 vehicle and user");
      } else {
        console.log("Skipping J 47 creation - location not found");
      }
    }

    await db.execute(sql`UPDATE users SET name = REPLACE(name, 'Ambulanza J', 'Ambulanza J ') WHERE name LIKE 'Ambulanza J%' AND name NOT LIKE 'Ambulanza J %' AND name NOT LIKE 'Ambulanza ROMEO%' AND name NOT LIKE 'Ambulanza SIERRA%'`);
    await db.execute(sql`UPDATE users SET account_type = 'person' WHERE role IN ('admin', 'director') AND account_type = 'vehicle'`);

    console.log("Vehicles and users sync completed");
  } catch (error) {
    console.error("Error syncing vehicles and users:", error);
  }
}

async function syncStructureDepartments() {
  try {
    console.log("Syncing structure-department mappings...");

    const allStructuresList = await db.select({ id: structures.id, name: structures.name, type: structures.type }).from(structures);
    const allDepartmentsList = await db.select({ id: departments.id, name: departments.name }).from(departments);
    const existingMappings = await db.select({ structureId: structureDepartments.structureId, departmentId: structureDepartments.departmentId }).from(structureDepartments);

    const DEFAULT_DEPT_NAMES = [
      'PRONTO SOCCORSO', 'RADIOLOGIA', 'CARDIOLOGIA', 'CHIRURGIA GENERALE',
      'MEDICINA INTERNA', 'NEUROLOGIA', 'ORTOPEDIA E TRAUMATOLOGIA', 'ONCOLOGIA',
      'GERIATRIA', 'PNEUMOLOGIA', 'UROLOGIA', 'OCULISTICA', 'PEDIATRIA',
      'GINECOLOGIA', 'OTORINOLARINGOIATRIA', 'DERMATOLOGIA', 'NEFROLOGIA'
    ];

    const deptByName = new Map(allDepartmentsList.map(d => [d.name, d.id]));
    const defaultDeptIds = DEFAULT_DEPT_NAMES.map(name => deptByName.get(name)).filter(Boolean) as string[];

    const structuresWithMappings = new Set(existingMappings.map(m => m.structureId));
    const hospitalStructures = allStructuresList.filter(s => s.type === 'ospedale' && !structuresWithMappings.has(s.id));

    if (hospitalStructures.length > 0 && defaultDeptIds.length > 0) {
      const mappingsToInsert: { structureId: string; departmentId: string }[] = [];
      for (const structure of hospitalStructures) {
        for (const deptId of defaultDeptIds) {
          mappingsToInsert.push({ structureId: structure.id, departmentId: deptId });
        }
      }
      if (mappingsToInsert.length > 0) {
        await db.insert(structureDepartments).values(mappingsToInsert).onConflictDoNothing();
        console.log(`Assigned default departments to ${hospitalStructures.length} hospitals`);
      }
    } else {
      console.log("All hospital structures already have department mappings");
    }
  } catch (error) {
    console.error("Error syncing structure-department mappings:", error);
  }
}

async function assignOrphanedDataToDefaultOrg() {
  const DEFAULT_ORG_ID = 'croce-europa-default';
  
  const [orgExists] = await db.select().from(organizations).where(eq(organizations.id, DEFAULT_ORG_ID));
  if (!orgExists) return;

  const tables = [
    { table: locations, name: 'locations' },
    { table: vehicles, name: 'vehicles' },
    { table: trips, name: 'trips' },
    { table: users, name: 'users' },
    { table: staffMembers, name: 'staff_members' },
  ];

  for (const { table, name } of tables) {
    try {
      const orphaned = await db.select({ id: (table as any).id }).from(table).where(isNull((table as any).organizationId));
      if (orphaned.length > 0) {
        await db.update(table).set({ organizationId: DEFAULT_ORG_ID } as any).where(isNull((table as any).organizationId));
        console.log(`Assigned ${orphaned.length} orphaned ${name} records to ${DEFAULT_ORG_ID}`);
      }
    } catch (e) {
      // Table might not have organizationId column
    }
  }

  const superAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
  for (const admin of superAdmins) {
    if (admin.organizationId) {
      await db.update(users).set({ organizationId: null }).where(eq(users.id, admin.id));
      console.log(`Cleared organizationId for super admin: ${admin.email}`);
    }
  }
}

export async function seedDatabase() {
  await syncStructures();
  
  await assignOrphanedDataToDefaultOrg();
  
  const [{ count: locCount }] = await db.select({ count: sql<number>`count(*)` }).from(locations);
  const [{ count: vehCount }] = await db.select({ count: sql<number>`count(*)` }).from(vehicles);
  const [{ count: usrCount }] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [{ count: deptCount }] = await db.select({ count: sql<number>`count(*)` }).from(departments);
  
  const numLoc = Number(locCount);
  const numVeh = Number(vehCount);
  const numUsr = Number(usrCount);
  const numDept = Number(deptCount);
  
  const hasBasicData = numLoc > 0 && numVeh > 0 && numUsr > 0 && numDept > 0;

  if (!hasBasicData) {
    console.log("Seeding database (missing data detected)...");
  }

  // Seed locations (Sedi) if missing
  const locationData = [
    { name: "San Giovanni Lupatoto", address: "Via Forte Garofolo 1, San Giovanni Lupatoto (VR)", latitude: "45.3833", longitude: "11.0458", isPrimary: true },
    { name: "Cologna Veneta", address: "Via Cologna 1, Cologna Veneta (VR)" },
    { name: "Montecchio Maggiore", address: "Via Montecchio 1, Montecchio Maggiore (VI)" },
    { name: "Nogara", address: "Via Nogara 1, Nogara (VR)" },
    { name: "Legnago", address: "Via Legnago 1, Legnago (VR)" },
  ];

  let insertedLocations: any[] = [];
  if (numLoc === 0) {
    insertedLocations = await db.insert(locations).values(locationData).returning();
    console.log(`Inserted ${insertedLocations.length} locations`);
  } else {
    insertedLocations = await db.select().from(locations);
    console.log(`Locations already exist (${numLoc})`);
    // Ensure primary location has coordinates (idempotent update)
    try {
      const primaryLoc = insertedLocations.find((l: any) => l.name === 'San Giovanni Lupatoto')
        || insertedLocations.find((l: any) => l.name === 'Verona')
        || insertedLocations[0];
      if (primaryLoc) {
        await db.execute(sql`
          UPDATE locations
          SET latitude = '45.3833', longitude = '11.0458', is_primary = TRUE
          WHERE id = ${primaryLoc.id}
            AND (latitude IS NULL OR longitude IS NULL OR is_primary IS NULL OR is_primary = FALSE)
        `);
        console.log(`Primary location coordinates set for: ${primaryLoc.name}`);
      }
    } catch (e) {
      // columns may not exist yet on first run before migration
    }
  }

  if (numVeh === 0) {
    const vehicleData = [
      { code: "J 30", licensePlate: "FL929VM", model: "Fiat Ducato", locationId: insertedLocations[0].id, currentKm: 417945 },
      { code: "J 31", licensePlate: "FL930VM", model: "Fiat Ducato", locationId: insertedLocations[0].id, currentKm: 325000 },
      { code: "J 63", licensePlate: "FL963VM", model: "Fiat Ducato", locationId: insertedLocations[0].id, currentKm: 280000 },
      { code: "J 45", licensePlate: "FL945VM", model: "Fiat Ducato", locationId: insertedLocations[1].id, currentKm: 195000 },
      { code: "J 46", licensePlate: "FL946VM", model: "Fiat Ducato", locationId: insertedLocations[1].id, currentKm: 210000 },
      { code: "J 50", licensePlate: "FL950VM", model: "Fiat Ducato", locationId: insertedLocations[2].id, currentKm: 175000 },
      { code: "J 51", licensePlate: "FL951VM", model: "Fiat Ducato", locationId: insertedLocations[2].id, currentKm: 185000 },
      { code: "J 55", licensePlate: "FL955VM", model: "Fiat Ducato", locationId: insertedLocations[3].id, currentKm: 150000 },
      { code: "J 60", licensePlate: "FL960VM", model: "Fiat Ducato", locationId: insertedLocations[4].id, currentKm: 165000 },
    ];
    const insertedVehicles = await db.insert(vehicles).values(vehicleData).returning();
    console.log(`Inserted ${insertedVehicles.length} vehicles`);
  } else {
    console.log(`Vehicles already exist (${numVeh})`);
  }

  if (numDept === 0) {
    const departmentData = [
      { name: "REPARTO PRONTO SOCCORSO" },
      { name: "REPARTO CARDIOLOGIA" },
      { name: "REPARTO CARDIOCHIRURGIA" },
      { name: "REPARTO CARDIOCHIRURGIA PEDIATRICA" },
      { name: "REPARTO CHIRURGIA GENERALE" },
      { name: "REPARTO CHIRURGIA DELL'ESOFAGO E DELLO STOMACO" },
      { name: "REPARTO CHIRURGIA DELLA MANO" },
      { name: "REPARTO CHIRURGIA DEI TRAPIANTI DI RENE" },
      { name: "EMODIALISI" },
      { name: "REPARTO GERIATRIA" },
      { name: "REPARTO RECUPERO E RIABILITAZIONE FUNZIONALE" },
      { name: "EMODINAMICA" },
      { name: "RADIOLOGIA" },
      { name: "REPARTO NEUROLOGIA" },
      { name: "REPARTO ONCOLOGIA" },
      { name: "REPARTO ORTOPEDIA" },
      { name: "REPARTO PNEUMOLOGIA" },
      { name: "REPARTO MEDICINA INTERNA" },
      { name: "REPARTO OCULISTICA" },
      { name: "REPARTO UROLOGIA" },
    ];
    const insertedDepartments = await db.insert(departments).values(departmentData).returning();
    console.log(`Inserted ${insertedDepartments.length} departments`);
  } else {
    console.log(`Departments already exist (${numDept})`);
  }

  const [{ count: orgCount }] = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  if (Number(orgCount) === 0) {
    const orgData = [
      {
        id: 'croce-europa-default',
        name: 'CROCE EUROPA',
        slug: 'croce-europa',
        legalName: 'Croce Europa SRL Impresa Sociale',
        address: null,
        city: 'Verona',
        province: 'VR',
        phone: '045-8203000',
        email: 'info@croceeuropa.com',
        pec: 'croceeuropa.srl@pec.s3sas.com',
        website: 'www.croceeuropa.it',
        logoUrl: '/uploads/logos/croce-europa-default.png',
        status: 'active' as const,
        maxVehicles: 100,
        maxUsers: 500,
        enabledModules: JSON.stringify(["report_accise", "checklist", "benessere_staff", "carbon_footprint", "consegne_digitali", "esg_dashboard", "registro_sanificazioni", "analisi_economica", "pianificazione_turni", "rimborsi_volontari", "gps_tracking", "registro_volontari_elettronico", "governance_compliance", "partner_program", "booking_hub", "inventario", "turnistica_mensile", "gestione_ruoli"]),
      },
      {
        id: '1e63fc6f-4e1a-4054-a352-346a7f6b2b16',
        name: 'ALS SOCCORSO',
        slug: 'als-soccorso',
        legalName: 'ODV',
        vatNumber: '05036580230',
        fiscalCode: '93102670234',
        address: 'Via Cavour 72',
        city: 'Cologna Veneta',
        province: 'VR',
        postalCode: '37044',
        email: 'info@alssoccorso.it',
        website: 'https://alssoccorso.it',
        logoUrl: '/uploads/logos/1e63fc6f-4e1a-4054-a352-346a7f6b2b16.png',
        status: 'active' as const,
        maxVehicles: 5,
        maxUsers: 6,
        enabledModules: JSON.stringify(["report_accise", "gps_tracking", "checklist", "consegne_digitali", "carbon_footprint", "esg_dashboard", "analisi_economica", "pianificazione_turni", "registro_sanificazioni", "rimborsi_volontari", "benessere_staff", "registro_volontari_elettronico", "governance_compliance", "partner_program", "booking_hub", "inventario", "turnistica_mensile", "gestione_ruoli"]),
      }
    ];
    await db.insert(organizations).values(orgData).returning();
    console.log(`Inserted ${orgData.length} organizations`);
  } else {
    console.log(`Organizations already exist (${orgCount})`);
  }

  if (numUsr === 0) {
    const userData = [
      { 
        email: "demo@croceeuropa.it", 
        password: "demo123", 
        name: "Mario Rossi", 
        role: "crew",
        locationId: insertedLocations[0].id 
      },
      { 
        email: "superadmin@soccorsodigitale.app", 
        password: process.env.SEED_PASSWORD || "$2b$12$defaulthashfordevonly00000000000000000000000000000000000",
        name: "Adrian Vasile",
        role: "admin",
        locationId: null
      },
      { 
        email: "direttore@croceeuropa.it", 
        password: process.env.SEED_PASSWORD || "$2b$12$defaulthashfordevonly00000000000000000000000000000000000",
        name: "Laura Bianchi", 
        role: "director",
        locationId: null
      },
    ];
    const insertedUsers = await db.insert(users).values(userData).returning();
    console.log(`Inserted ${insertedUsers.length} users`);
  } else {
    console.log(`Users already exist (${numUsr})`);
    
    const adminUser = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, 'admin')).limit(1);
    if (adminUser.length > 0 && adminUser[0].email !== 'superadmin@soccorsodigitale.app') {
      await db.update(users)
        .set({ 
          email: 'superadmin@soccorsodigitale.app', 
          password: process.env.SEED_PASSWORD || "$2b$12$defaulthashfordevonly00000000000000000000000000000000000",
        })
        .where(eq(users.id, adminUser[0].id));
      console.log(`Updated super admin credentials to superadmin@soccorsodigitale.app`);
    }

    const [orgAdminCE] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@croceeuropa.com')).limit(1);
    if (!orgAdminCE) {
      await db.insert(users).values({
        email: 'admin@croceeuropa.com',
        password: 'CroceAdmin2026!',
        name: 'Admin Croce Europa',
        role: 'org_admin',
        organizationId: 'croce-europa-default',
        isActive: true,
      });
      console.log('Created org_admin for Croce Europa');
    }

    const [orgAdminALS] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@alssoccorso.it')).limit(1);
    if (!orgAdminALS) {
      await db.insert(users).values({
        email: 'admin@alssoccorso.it',
        password: 'ALSAdmin2026!',
        name: 'Admin ALS Soccorso',
        role: 'org_admin',
        organizationId: '1e63fc6f-4e1a-4054-a352-346a7f6b2b16',
        isActive: true,
      });
      console.log('Created org_admin for ALS Soccorso');
    }
  }

  // Always run comprehensive data sync (idempotent)
  await syncChecklistTemplateItems();
  await syncAllDepartments();
  await syncLocationData();
  await syncMissingVehiclesAndUsers();
  await syncStructureDepartments();

  // Now sync trips from exported file (after vehicles and users exist)
  await syncTrips();

  try {
    const [{ count: unsignedCountRaw }] = await db.select({ count: sql<number>`count(*)` }).from(trips).where(
      sql`${trips.organizationId} = 'croce-europa-default' AND (${trips.integrityStatus} = 'NOT_SIGNED' OR ${trips.integrityStatus} IS NULL OR ${trips.integrityStatus} = 'BROKEN')`
    );
    const numUnsigned = Number(unsignedCountRaw);
    if (numUnsigned > 0) {
      console.log(`Found ${numUnsigned} unsigned trips for Croce Europa, signing...`);
      const signResult = await bulkSignTrips('croce-europa-default');
      console.log(`Bulk sign result: ${signResult.signed} signed, ${signResult.errors} errors`);
    } else {
      console.log('All Croce Europa trips already signed');
    }
  } catch (err) {
    console.error('Error during bulk trip signing:', err);
  }

  // Seed privacy policy if missing
  const existingPolicies = await db.select().from(privacyPolicies).where(eq(privacyPolicies.isActive, true));
  if (existingPolicies.length === 0) {
    const policyContent = `INFORMATIVA SULLA PRIVACY

SOCCORSO DIGITALE ("noi", "nostro" o "Societa") rispetta la privacy dei propri utenti.

DATI RACCOLTI
Raccogliamo i seguenti dati personali necessari per l'erogazione dei servizi di trasporto sanitario:
- Nome e cognome del personale
- Dati di contatto (email, telefono)
- Dati relativi ai servizi di trasporto effettuati
- Dati di geolocalizzazione dei veicoli durante il servizio

FINALITA DEL TRATTAMENTO
I dati sono trattati per:
- Gestione operativa dei servizi di trasporto sanitario
- Adempimenti normativi e fiscali (es. UTIF per carburanti)
- Statistiche interne e miglioramento del servizio
- Comunicazioni di servizio

BASE GIURIDICA
Il trattamento e basato su:
- Esecuzione del contratto di lavoro
- Obblighi legali
- Consenso per finalita opzionali (marketing, statistiche)

DIRITTI DELL'INTERESSATO
Puoi esercitare i seguenti diritti:
- Accesso ai tuoi dati personali
- Rettifica dei dati inesatti
- Cancellazione dei dati (diritto all'oblio)
- Limitazione del trattamento
- Portabilita dei dati
- Opposizione al trattamento

CONTATTI
Per esercitare i tuoi diritti o per informazioni: privacy@croceeuropa.it

CONSERVAZIONE DEI DATI
I dati sono conservati per il tempo necessario alle finalita del trattamento e comunque nel rispetto degli obblighi di legge.

Ultimo aggiornamento: Dicembre 2024`;
    
    // Create a simple hash for the content
    const crypto = await import("crypto");
    const contentHash = crypto.createHash("sha256").update(policyContent).digest("hex");
    
    await db.insert(privacyPolicies).values({
      version: "2.0.0",
      title: "Informativa Privacy SOCCORSO DIGITALE",
      content: policyContent,
      contentHash: contentHash,
      isActive: true,
      effectiveAt: new Date(),
    });
    console.log("Privacy policy created");
  } else {
    await db.execute(sql`UPDATE privacy_policies SET version = '2.0.0' WHERE version = '1.0.0'`);
    console.log("Privacy policy already exists (version synced)");
  }

  // Seed SLA targets and backup policies
  await seedDefaultSlaTargets();
  await seedDefaultBackupPolicies();

  // Seed hub service pricing for Croce Europa
  const existingPricing = await db.select().from(hubServicePricing).where(eq(hubServicePricing.organizationId, "croce-europa-default"));
  if (existingPricing.length === 0) {
    await db.insert(hubServicePricing).values([
      {
        organizationId: "croce-europa-default",
        serviceType: "taxi_sanitario",
        serviceName: "Ambulanza",
        serviceDescription: "Trasporto in ambulanza con equipaggio certificato",
        baseFee: 30, perKmRate: 1.2, nightSupplement: 15, holidaySupplement: 10,
        waitingTimeRate: 0, stretcherSupplement: 25, wheelchairSupplement: 0,
        oxygenSupplement: 15, medicalStaffSupplement: 0, roundTripDiscount: 10,
        minimumCharge: 50, isActive: true, sortOrder: 1,
      },
      {
        organizationId: "croce-europa-default",
        serviceType: "trasporto_programmato",
        serviceName: "Auto sanitaria",
        serviceDescription: "Auto sanitaria per trasporti programmati e visite mediche",
        baseFee: 20, perKmRate: 0.8, nightSupplement: 10, holidaySupplement: 8,
        waitingTimeRate: 0, stretcherSupplement: 0, wheelchairSupplement: 0,
        oxygenSupplement: 0, medicalStaffSupplement: 0, roundTripDiscount: 5,
        minimumCharge: 35, isActive: true, sortOrder: 2,
      },
      {
        organizationId: "croce-europa-default",
        serviceType: "trasporto_disabili",
        serviceName: "Pulmino con pedana",
        serviceDescription: "Pulmino attrezzato con pedana per disabili e carrozzine",
        baseFee: 25, perKmRate: 1, nightSupplement: 12, holidaySupplement: 10,
        waitingTimeRate: 0, stretcherSupplement: 0, wheelchairSupplement: 0,
        oxygenSupplement: 10, medicalStaffSupplement: 0, roundTripDiscount: 8,
        minimumCharge: 45, isActive: true, sortOrder: 3,
      },
    ]);
    console.log("Hub service pricing seeded (3 items)");
  } else {
    console.log(`Hub pricing already exists (${existingPricing.length} items)`);
  }

  const [{ count: staffCount }] = await db.select({ count: sql<number>`count(*)` }).from(staffMembers);
  if (Number(staffCount) === 0) {
    try {
      const staffPath = path.join(process.cwd(), 'server', 'data', 'staff_export.json');
      if (fs.existsSync(staffPath)) {
        const staffData = JSON.parse(fs.readFileSync(staffPath, 'utf-8'));
        const defaultLocationId = 'a362c8c4-9346-49c6-8162-206d939444fa';
        const staffToInsert = staffData.map((s: any) => ({
          firstName: s.firstName,
          lastName: s.lastName,
          fiscalCode: s.fiscalCode || null,
          email: s.email || null,
          phone: s.phone || null,
          primaryRole: s.primaryRole || 'soccorritore',
          secondaryRoles: s.secondaryRoles || null,
          qualifications: s.qualifications || null,
          qualificationExpiries: s.qualificationExpiries || null,
          maxHoursPerWeek: s.maxHoursPerWeek || null,
          maxHoursPerMonth: s.maxHoursPerMonth || null,
          contractType: s.contractType || null,
          isActive: s.isActive !== false,
          notes: s.notes || null,
          homeAddress: s.homeAddress || null,
          homeCity: s.homeCity || null,
          homeProvince: s.homeProvince || null,
          homePostalCode: s.homePostalCode || null,
          homeDistanceKm: s.homeDistanceKm || null,
          iban: s.iban || null,
          organizationId: s.organizationId || 'croce-europa-default',
          locationId: s.locationId || defaultLocationId,
        }));
        await db.insert(staffMembers).values(staffToInsert);
        console.log(`Staff members seeded (${staffToInsert.length} members)`);
      } else {
        console.log("No staff_export.json found, skipping staff seed");
      }
    } catch (e: any) {
      console.log(`Staff seed error: ${e.message}`);
    }
  } else {
    console.log(`Staff members already exist (${staffCount} members)`);
  }

  const [{ count: moduleCount }] = await db.select({ count: sql<number>`count(*)` }).from(premiumModules);
  if (Number(moduleCount) === 0) {
    await db.insert(premiumModules).values([
      {
        moduleKey: "turnistica_mensile", name: "Turnistica Mensile",
        description: "Gestione turni mensili con griglia interattiva per veicoli e personale",
        category: "modulo", icon: "calendar", billingType: "recurring",
        priceMonthly: 3500, priceYearly: 29000, trialDays: 7,
        badgeText: null, badgeColor: null,
        features: ["Griglia turni mensile interattiva", "Assegnazione personale drag&drop", "Generazione automatica turni", "Import/Export turni", "Copia da mese precedente"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 1,
      },
      {
        moduleKey: "pianificazione_turni", name: "Pianificazione Turni",
        description: "Pianificazione avanzata dei turni con gestione disponibilità",
        category: "modulo", icon: "clock", billingType: "recurring",
        priceMonthly: 1900, priceYearly: 19000, trialDays: 0,
        features: ["Pianificazione turni avanzata", "Gestione disponibilità personale", "Conflitti turni automatici", "Report ore lavorate"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 2,
      },
      {
        moduleKey: "volunteer_reimbursements", name: "Rimborsi Volontari",
        description: "Gestione rimborsi spese per volontari con tracciamento e reportistica",
        category: "modulo", icon: "dollar-sign", billingType: "recurring",
        priceMonthly: 1500, priceYearly: 15000, trialDays: 0,
        features: ["Tracciamento rimborsi", "Approvazione workflow", "Report rimborsi", "Esportazione dati"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 3,
      },
      {
        moduleKey: "registro_volontari_elettronico", name: "Registro Volontari Elettronico",
        description: "Registro volontari conforme Art. 17 CTS con firma digitale e integrità crittografica",
        category: "modulo", icon: "file-text", billingType: "recurring",
        priceMonthly: 2900, priceYearly: 29000, trialDays: 0,
        badgeText: "BEST SELLER", badgeColor: "#00A651",
        features: ["Registro conforme Art. 17 CTS", "Firma digitale via email", "Integrità HMAC-SHA256", "Esportazione PDF", "Numerazione progressiva"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 4,
      },
      {
        moduleKey: "inventario", name: "Inventario e Magazzino",
        description: "Gestione inventario con checklist, QR code e tracciamento scadenze",
        category: "modulo", icon: "box", billingType: "recurring",
        priceMonthly: 1900, priceYearly: 19000, trialDays: 0,
        features: ["Checklist template", "Scanner QR/Barcode", "Tracciamento scadenze", "Report inventario"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 5,
      },
      {
        moduleKey: "compliance_audit", name: "Compliance e Audit",
        description: "Audit trail crittografico ISO 27001 con catena hash tamper-evident",
        category: "modulo", icon: "shield", billingType: "recurring",
        priceMonthly: 2500, priceYearly: 25000, trialDays: 0,
        features: ["Audit trail SHA-256", "Catena hash tamper-evident", "Report ISO 27001", "Verifica integrità"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 6,
      },
      {
        moduleKey: "booking_hub", name: "Hub Prenotazioni",
        description: "Portale prenotazioni pubblico per cittadini e strutture sanitarie",
        category: "modulo", icon: "phone-call", billingType: "recurring",
        priceMonthly: 3900, priceYearly: 39000, trialDays: 14,
        badgeText: "POPOLARE", badgeColor: "#3b82f6",
        features: ["Portale pubblico prenotazioni", "Gestione clienti RSA/ambulatori", "Ciclo vita prenotazioni", "Notifiche real-time", "Missioni programmate app"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 7,
      },
      {
        moduleKey: "carbon_footprint", name: "Carbon Footprint",
        description: "Calcolo impronta carbonica per servizio con trend e visualizzazioni",
        category: "modulo", icon: "leaf", billingType: "recurring",
        priceMonthly: 900, priceYearly: 9000, trialDays: 0,
        features: ["Calcolo CO2 per servizio", "Trend visualizzazioni", "Report sostenibilità"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 8,
      },
      {
        moduleKey: "burnout_prevention", name: "Benessere Staff",
        description: "Monitoraggio benessere personale con soglie configurabili e alert",
        category: "modulo", icon: "heart", billingType: "recurring",
        priceMonthly: 1500, priceYearly: 15000, trialDays: 0,
        features: ["Monitoraggio benessere", "Soglie configurabili", "Alert automatici", "Report wellbeing"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 9,
      },
      {
        moduleKey: "photo_reporting", name: "Report Fotografici",
        description: "Sistema report fotografici bidirezionale per danni veicoli",
        category: "modulo", icon: "camera", billingType: "recurring",
        priceMonthly: 900, priceYearly: 9000, trialDays: 0,
        features: ["Report danni veicoli", "Messaggistica crew-admin", "Ricevute lettura", "Storico foto"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 10,
      },
      {
        moduleKey: "vehicle_documents", name: "Documenti Veicoli",
        description: "Gestione documenti veicoli con scadenze e upload foto",
        category: "modulo", icon: "folder", billingType: "recurring",
        priceMonthly: 900, priceYearly: 9000, trialDays: 0,
        features: ["Tracking documenti", "Alert scadenze", "Upload foto", "Storico documenti"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 11,
      },
      {
        moduleKey: "sanitization_logs", name: "Registro Sanificazioni",
        description: "Registro post-servizio pulizia e sanificazione con statistiche",
        category: "modulo", icon: "droplet", billingType: "recurring",
        priceMonthly: 500, priceYearly: 5000, trialDays: 0,
        features: ["Log sanificazioni", "Statistiche pulizia", "Report conformità"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 12,
      },
      {
        moduleKey: "formazione_online", name: "Formazione Online",
        description: "Piattaforma e-learning per formazione continua del personale",
        longDescription: "Accesso alla piattaforma di formazione online con corsi certificati per autisti soccorritori, equipaggi e personale amministrativo. Include certificati di completamento e tracciamento ore formative.",
        category: "servizio", icon: "book-open", billingType: "recurring",
        priceMonthly: 4900, priceYearly: 49000, trialDays: 14,
        badgeText: "NUOVO", badgeColor: "#8b5cf6",
        features: ["Corsi certificati online", "Tracciamento ore formative", "Certificati di completamento", "Quiz e valutazioni", "Libreria materiali didattici"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 13,
      },
      {
        moduleKey: "supporto_prioritario", name: "Supporto Prioritario",
        description: "Assistenza tecnica dedicata con tempi di risposta garantiti",
        longDescription: "Canale di supporto dedicato con tempi di risposta garantiti entro 4 ore lavorative. Include consulenza tecnica, assistenza alla configurazione e supporto telefonico diretto.",
        category: "servizio", icon: "headphones", billingType: "recurring",
        priceMonthly: 9900, priceYearly: 99000, trialDays: 0,
        features: ["Risposta entro 4 ore", "Supporto telefonico diretto", "Consulenza configurazione", "Account manager dedicato", "Report mensili"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 14,
      },
      {
        moduleKey: "migrazione_dati", name: "Migrazione Dati",
        description: "Servizio di migrazione dati da sistemi esistenti",
        longDescription: "Servizio professionale di migrazione completa dei dati dal vostro sistema attuale alla piattaforma SOCCORSO DIGITALE. Include analisi, mappatura, importazione e verifica.",
        category: "servizio", icon: "upload-cloud", billingType: "one_time",
        priceMonthly: 0, priceYearly: 0, priceOneTime: 49900, trialDays: 0,
        features: ["Analisi sistema esistente", "Mappatura dati", "Importazione completa", "Verifica e validazione", "Supporto post-migrazione 30gg"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 15,
      },
      {
        moduleKey: "licenza_sede_aggiuntiva", name: "Licenza Sede Aggiuntiva",
        description: "Aggiungi una sede operativa alla tua organizzazione",
        longDescription: "Espandi la tua organizzazione aggiungendo sedi operative aggiuntive. Ogni licenza include fino a 10 utenti e 5 veicoli per la nuova sede.",
        category: "licenza", icon: "map-pin", billingType: "recurring",
        priceMonthly: 1900, priceYearly: 19000, trialDays: 0,
        features: ["1 sede aggiuntiva", "Fino a 10 utenti", "Fino a 5 veicoli", "Dashboard dedicata", "Report per sede"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 16,
      },
      {
        moduleKey: "licenza_utenti_extra", name: "Pacchetto Utenti Extra",
        description: "Aggiungi 10 utenti alla tua organizzazione",
        longDescription: "Pacchetto aggiuntivo di 10 account utente per la tua organizzazione. Ideale per organizzazioni in crescita che necessitano di piu accessi simultanei.",
        category: "licenza", icon: "users", billingType: "recurring",
        priceMonthly: 990, priceYearly: 9900, trialDays: 0,
        features: ["10 utenti aggiuntivi", "Tutti i ruoli disponibili", "Accesso completo funzionalita", "Gestione permessi granulare"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 17,
      },
      {
        moduleKey: "api_access", name: "Accesso API",
        description: "Integra SOCCORSO DIGITALE con i tuoi sistemi",
        longDescription: "Accesso alle API REST per integrare la piattaforma con i vostri sistemi gestionali, software di contabilita o applicazioni personalizzate. Include documentazione completa e sandbox di test.",
        category: "addon", icon: "code", billingType: "recurring",
        priceMonthly: 4900, priceYearly: 49000, trialDays: 0,
        badgeText: "PRO", badgeColor: "#f59e0b",
        features: ["API REST completa", "Documentazione Swagger", "Sandbox di test", "Webhook personalizzati", "Rate limit elevato (10k/h)"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 18,
      },
      {
        moduleKey: "white_label", name: "White Label",
        description: "Personalizza la piattaforma con il tuo brand",
        longDescription: "Personalizzazione completa della piattaforma con il brand della tua organizzazione: logo, colori, dominio personalizzato e email personalizzate.",
        category: "addon", icon: "edit-3", billingType: "one_time",
        priceMonthly: 0, priceYearly: 0, priceOneTime: 9999000, trialDays: 0,
        badgeText: "ENTERPRISE", badgeColor: "#1f2937",
        features: ["Logo e colori personalizzati", "Dominio personalizzato", "Email con dominio proprio", "App mobile branded", "Materiali marketing"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 19,
      },
      {
        moduleKey: "gestione_ruoli", name: "Gestione Ruoli e Accessi",
        description: "Ruoli personalizzati con permessi granulari",
        longDescription: "Crea ruoli custom per la tua organizzazione con permessi granulari per ogni area operativa. Genera credenziali per nuovi utenti, assegna ruoli specifici e monitora gli accessi in tempo reale.",
        category: "modulo", icon: "shield", billingType: "recurring",
        priceMonthly: 1900, priceYearly: 19000, trialDays: 14,
        features: ["Ruoli custom illimitati", "33+ permessi granulari", "Generazione credenziali automatica", "Invio credenziali via email", "Log accessi in tempo reale", "Revoca accessi immediata"],
        isActive: true, isFeatured: false, isVisible: true, sortOrder: 13,
      },
      {
        moduleKey: "pacchetto_starter", name: "Pacchetto Starter",
        description: "Il kit essenziale per iniziare con SOCCORSO DIGITALE",
        longDescription: "Pacchetto completo per organizzazioni che iniziano: include i moduli piu richiesti a prezzo scontato. Turnistica, Registro Volontari e Report Fotografici in un unico pacchetto.",
        category: "pacchetto", icon: "zap", billingType: "recurring",
        priceMonthly: 5900, priceYearly: 59000, trialDays: 14,
        badgeText: "RISPARMIA 25%", badgeColor: "#00A651",
        features: ["Turnistica Mensile inclusa", "Registro Volontari incluso", "Report Fotografici incluso", "Supporto email dedicato", "Configurazione assistita"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 20,
      },
      {
        moduleKey: "pacchetto_professional", name: "Pacchetto Professional",
        description: "Tutto cio di cui hai bisogno per gestire la tua organizzazione",
        longDescription: "Pacchetto avanzato con tutti i moduli operativi principali. Include Booking Hub, Compliance, Inventario, GPS Tracking e molto altro.",
        category: "pacchetto", icon: "award", billingType: "recurring",
        priceMonthly: 14900, priceYearly: 149000, trialDays: 14,
        badgeText: "PIU VENDUTO", badgeColor: "#3b82f6",
        features: ["Tutti i moduli operativi", "Booking Hub incluso", "Compliance e Audit", "GPS Tracking", "Inventario e Magazzino", "Supporto prioritario"],
        isActive: true, isFeatured: true, isVisible: true, sortOrder: 21,
      },
    ]);
    console.log("Marketplace premium modules seeded (21 items)");
  } else {
    console.log(`Marketplace modules already exist (${moduleCount} items)`);
  }

  console.log("Database seeding completed!");

  geocodeMissingStructures().catch(e => console.error("Geocoding error:", e));
}

async function geocodeMissingStructures() {
  const result = await db.select({ id: structures.id, name: structures.name, address: structures.address })
    .from(structures)
    .where(sql`${structures.latitude} IS NULL AND ${structures.address} IS NOT NULL AND ${structures.address} != ''`);
  
  if (result.length === 0) {
    console.log("[Geocoding] All structures have coordinates");
    return;
  }
  
  console.log(`[Geocoding] Starting batch geocoding for ${result.length} structures...`);
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  let successCount = 0;
  let failCount = 0;
  
  for (const structure of result) {
    try {
      let lat: string | null = null;
      let lon: string | null = null;
      
      if (googleApiKey) {
        const searchAddr = structure.address + ", Italia";
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddr)}&region=it&language=it&key=${googleApiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "OK" && data.results?.length > 0) {
            lat = data.results[0].geometry.location.lat.toString();
            lon = data.results[0].geometry.location.lng.toString();
          }
        }
      }
      
      if (!lat) {
        await new Promise(r => setTimeout(r, 1100));
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(structure.address + ", Italia")}&format=json&limit=1`, {
          headers: { "User-Agent": "SoccorsoDigitale/1.0", "Accept-Language": "it" }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) { lat = data[0].lat; lon = data[0].lon; }
        }
      }
      
      if (lat && lon) {
        await db.update(structures).set({ latitude: lat, longitude: lon }).where(eq(structures.id, structure.id));
        successCount++;
      } else {
        failCount++;
        console.log(`[Geocoding] Failed: ${structure.name}`);
      }
    } catch (e) {
      failCount++;
    }
  }
  
  console.log(`[Geocoding] Complete: ${successCount} geocoded, ${failCount} failed out of ${result.length}`);
}
