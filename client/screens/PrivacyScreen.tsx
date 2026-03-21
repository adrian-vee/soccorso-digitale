import React from "react";
import { View, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface DataItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  color: string;
  delay: number;
}

function DataItem({ icon, title, description, color, delay }: DataItemProps) {
  return (
    <Animated.View entering={FadeInUp.duration(400).delay(delay)}>
      <View style={[styles.dataItem, { backgroundColor: "#FFFFFF", borderColor: "#E5E7EB" }]}>
        <View style={[styles.dataIcon, { backgroundColor: color + "15" }]}>
          <Feather name={icon} size={18} color={color} />
        </View>
        <View style={styles.dataContent}>
          <ThemedText style={[styles.dataTitle, { color: "#1F2937" }]}>{title}</ThemedText>
          <ThemedText style={[styles.dataDescription, { color: "#6B7280" }]}>
            {description}
          </ThemedText>
        </View>
      </View>
    </Animated.View>
  );
}

interface InfoBlockProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text: string;
  color: string;
  bgColor: string;
  delay: number;
}

function InfoBlock({ icon, title, text, color, bgColor, delay }: InfoBlockProps) {
  return (
    <Animated.View entering={FadeInUp.duration(400).delay(delay)}>
      <Card style={[styles.infoBlock, { backgroundColor: bgColor }]}>
        <View style={styles.infoBlockHeader}>
          <Feather name={icon} size={18} color={color} />
          <ThemedText style={[styles.infoBlockTitle, { color }]}>{title}</ThemedText>
        </View>
        <ThemedText style={[styles.infoBlockText, { color: "#6B7280" }]}>{text}</ThemedText>
      </Card>
    </Animated.View>
  );
}

const C = {
  background: "#FFFFFF",
  text: "#1F2937",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  cardBg: "#F9FAFB",
  primary: "#0066CC",
  primaryLight: "#EBF5FF",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  purple: "#7C3AED",
  purpleLight: "#EDE9FE",
};

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const handleViewPolicy = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const policyUrl = new URL("/api/gdpr/privacy-policy", getApiUrl()).toString();
    Linking.openURL(policyUrl).catch(() => {});
  };

  const handleContactDPO = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL("mailto:privacy@soccorsodigitale.app?subject=Richiesta%20Privacy%20-%20GDPR");
  };

  const appOperatorData = [
    {
      icon: "user" as const,
      title: "Nome e Cognome",
      description: "Identificazione dell'operatore per la registrazione dei servizi, checklist e report",
      color: "#3B82F6",
    },
    {
      icon: "credit-card" as const,
      title: "Codice Fiscale",
      description: "Identificazione univoca del personale per documentazione ufficiale e normativa",
      color: "#8B5CF6",
    },
    {
      icon: "mail" as const,
      title: "Email e Telefono",
      description: "Contatti del personale per comunicazioni operative e organizzative",
      color: "#EC4899",
    },
    {
      icon: "navigation" as const,
      title: "Posizione GPS",
      description: "Tracciamento del percorso durante i servizi attivi, associato al veicolo e non all'operatore",
      color: "#10B981",
    },
    {
      icon: "clock" as const,
      title: "Orari di Servizio",
      description: "Registrazione turni, disponibilita e ore lavorate per gestione operativa",
      color: "#F59E0B",
    },
  ];

  const appPatientData = [
    {
      icon: "map-pin" as const,
      title: "Indirizzo di Trasporto",
      description: "Origine e destinazione del servizio per la registrazione del percorso",
      color: "#10B981",
    },
    {
      icon: "calendar" as const,
      title: "Anno di Nascita",
      description: "Dato anagrafico richiesto dalla normativa per il trasporto sanitario",
      color: "#F59E0B",
    },
    {
      icon: "users" as const,
      title: "Genere",
      description: "Dato anagrafico richiesto dalla normativa vigente",
      color: "#8B5CF6",
    },
  ];

  const hubBookingData = [
    {
      icon: "user" as const,
      title: "Nome e Cognome",
      description: "Identificazione del richiedente per la prenotazione del trasporto",
      color: "#3B82F6",
    },
    {
      icon: "phone" as const,
      title: "Telefono e Email",
      description: "Contatti per conferme, comunicazioni e aggiornamenti sullo stato della prenotazione",
      color: "#EC4899",
    },
    {
      icon: "map-pin" as const,
      title: "Indirizzo di Ritiro e Destinazione",
      description: "Luoghi del trasporto per la pianificazione e l'assegnazione del servizio",
      color: "#10B981",
    },
    {
      icon: "file-text" as const,
      title: "Note e Richieste Speciali",
      description: "Informazioni operative (es. sedia a rotelle, barella) per preparare il servizio adeguatamente",
      color: "#F59E0B",
    },
  ];

  const adminPanelData = [
    {
      icon: "bar-chart-2" as const,
      title: "Dati Statistici e Operativi",
      description: "Aggregazione di servizi, chilometri, costi e performance per reportistica gestionale",
      color: "#3B82F6",
    },
    {
      icon: "file-text" as const,
      title: "Documenti e Report",
      description: "Generazione report UTIF, ESG, carbon footprint e documentazione normativa",
      color: "#10B981",
    },
    {
      icon: "activity" as const,
      title: "Log di Audit",
      description: "Registro crittografico delle operazioni per trasparenza e conformita ISO 27001",
      color: "#8B5CF6",
    },
  ];

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View entering={FadeInUp.duration(400)}>
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: C.primaryLight }]}>
            <Feather name="shield" size={28} color={C.primary} />
          </View>
          <ThemedText style={[styles.headerTitle, { color: C.text }]}>Privacy e Protezione Dati</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: C.textSecondary }]}>
            Conformita al Regolamento UE 2016/679 (GDPR)
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(100)}>
        <Card style={[styles.controllerCard, { backgroundColor: C.cardBg }]}>
          <View style={styles.controllerRow}>
            <Feather name="briefcase" size={18} color={C.primary} />
            <View style={styles.controllerContent}>
              <ThemedText style={[styles.controllerLabel, { color: C.textSecondary }]}>
                TITOLARE DEL TRATTAMENTO
              </ThemedText>
              <ThemedText style={[styles.controllerName, { color: C.text }]}>
                Soccorso Digitale
              </ThemedText>
              <ThemedText style={[styles.controllerDetail, { color: C.textSecondary }]}>
                Piattaforma SaaS per la gestione dei trasporti sanitari
              </ThemedText>
              <ThemedText style={[styles.controllerDetail, { color: C.textSecondary }]}>
                soccorsodigitale.app
              </ThemedText>
            </View>
          </View>
          <View style={[styles.controllerDivider, { backgroundColor: C.border }]} />
          <ThemedText style={[styles.controllerNote, { color: C.textSecondary }]}>
            Soccorso Digitale fornisce la piattaforma tecnologica (app mobile, pannello di controllo 
            e portale prenotazioni) alle organizzazioni di trasporto sanitario. Le organizzazioni 
            che utilizzano la piattaforma agiscono come Responsabili del Trattamento per i dati 
            raccolti nell'ambito dei propri servizi.
          </ThemedText>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(200)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(250)}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: "#DBEAFE" }]}>
            <Feather name="smartphone" size={16} color="#3B82F6" />
          </View>
          <View>
            <ThemedText style={[styles.sectionLabel, { color: C.textSecondary }]}>
              APP MOBILE - DATI OPERATORE
            </ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: C.textSecondary }]}>
              Dati raccolti dal personale durante l'utilizzo dell'app
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.dataList}>
        {appOperatorData.map((item, index) => (
          <DataItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            color={item.color}
            delay={300 + index * 60}
          />
        ))}
      </View>

      <Animated.View entering={FadeInUp.duration(400).delay(600)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(650)}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: "#D1FAE5" }]}>
            <Feather name="heart" size={16} color="#10B981" />
          </View>
          <View>
            <ThemedText style={[styles.sectionLabel, { color: C.textSecondary }]}>
              APP MOBILE - DATI PAZIENTE/TRASPORTATO
            </ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: C.textSecondary }]}>
              Dati minimi raccolti durante la registrazione dei servizi
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.dataList}>
        {appPatientData.map((item, index) => (
          <DataItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            color={item.color}
            delay={700 + index * 60}
          />
        ))}
      </View>

      <InfoBlock
        icon="info"
        title="Nota Importante"
        text="Non vengono raccolti dati sanitari sensibili (diagnosi, patologie, terapie). I dati del paziente sono limitati al minimo necessario per la documentazione del trasporto e il rispetto della normativa vigente."
        color="#3B82F6"
        bgColor={C.primaryLight}
        delay={880}
      />

      <Animated.View entering={FadeInUp.duration(400).delay(950)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1000)}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: C.purpleLight }]}>
            <Feather name="globe" size={16} color={C.purple} />
          </View>
          <View>
            <ThemedText style={[styles.sectionLabel, { color: C.textSecondary }]}>
              PORTALE PRENOTAZIONI (HUB)
            </ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: C.textSecondary }]}>
              Dati raccolti dai cittadini e strutture che prenotano trasporti
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.dataList}>
        {hubBookingData.map((item, index) => (
          <DataItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            color={item.color}
            delay={1050 + index * 60}
          />
        ))}
      </View>

      <InfoBlock
        icon="layers"
        title="Responsabilita nel Hub Prenotazioni"
        text="Le organizzazioni di trasporto sanitario che utilizzano il portale di prenotazione sono Responsabili del Trattamento dei dati raccolti tramite il proprio link dedicato. Soccorso Digitale conserva i dati per conto dell'organizzazione e ne garantisce la sicurezza tecnica."
        color={C.purple}
        bgColor={C.purpleLight}
        delay={1300}
      />

      <Animated.View entering={FadeInUp.duration(400).delay(1350)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1400)}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: C.warningLight }]}>
            <Feather name="monitor" size={16} color={C.warning} />
          </View>
          <View>
            <ThemedText style={[styles.sectionLabel, { color: C.textSecondary }]}>
              PANNELLO DI CONTROLLO (ADMIN)
            </ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: C.textSecondary }]}>
              Dati gestiti dal personale amministrativo
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      <View style={styles.dataList}>
        {adminPanelData.map((item, index) => (
          <DataItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            color={item.color}
            delay={1450 + index * 60}
          />
        ))}
      </View>

      <Animated.View entering={FadeInUp.duration(400).delay(1650)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1700)}>
        <Card style={[styles.retentionCard, { backgroundColor: C.cardBg }]}>
          <View style={styles.retentionHeader}>
            <Feather name="clock" size={20} color={C.primary} />
            <ThemedText style={[styles.retentionTitle, { color: C.text }]}>
              Conservazione dei Dati
            </ThemedText>
          </View>
          <View style={styles.retentionList}>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#3B82F6" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Dati dei servizi di trasporto
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  10 anni dalla data del servizio, come previsto dalla normativa fiscale e sanitaria italiana
                </ThemedText>
              </View>
            </View>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#10B981" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Dati del personale
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  Per tutta la durata del rapporto lavorativo e fino a 10 anni dalla cessazione, per obblighi legali
                </ThemedText>
              </View>
            </View>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#8B5CF6" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Dati prenotazioni (Hub)
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  5 anni dalla data della prenotazione, per finalita amministrative e contrattuali
                </ThemedText>
              </View>
            </View>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#F59E0B" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Tracciamento GPS
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  90 giorni dalla registrazione, per finalita operative e di ottimizzazione dei percorsi
                </ThemedText>
              </View>
            </View>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#EC4899" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Log di audit
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  10 anni, con catena crittografica per garantire l'integrita e la non alterabilita
                </ThemedText>
              </View>
            </View>
            <View style={styles.retentionItem}>
              <View style={[styles.retentionDot, { backgroundColor: "#6B7280" }]} />
              <View style={styles.retentionContent}>
                <ThemedText style={[styles.retentionLabel, { color: C.text }]}>
                  Account demo
                </ThemedText>
                <ThemedText style={[styles.retentionValue, { color: C.textSecondary }]}>
                  24 ore dalla creazione, con cancellazione automatica di tutti i dati associati
                </ThemedText>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1800)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1850)}>
        <Card style={[styles.protectionCard, { backgroundColor: C.cardBg }]}>
          <View style={styles.protectionHeader}>
            <Feather name="lock" size={20} color={C.success} />
            <ThemedText style={[styles.protectionTitle, { color: C.text }]}>
              Misure di Sicurezza
            </ThemedText>
          </View>
          <View style={styles.protectionList}>
            {[
              "Crittografia TLS 1.3 per tutti i dati in transito",
              "Database crittografato con backup giornalieri automatici",
              "Autenticazione sicura con sessioni protette (HTTP-only, SameSite strict)",
              "Controllo accessi basato su ruoli (RBAC) con isolamento multi-tenant",
              "Firma crittografica HMAC-SHA256 dei servizi per rilevamento manomissioni",
              "Audit trail con catena hash SHA-256 per conformita ISO 27001",
              "Cancellazione sicura dei dati su richiesta (diritto all'oblio)",
              "Infrastruttura cloud conforme alle normative europee",
            ].map((text, i) => (
              <View key={i} style={styles.protectionItem}>
                <View style={[styles.checkCircle, { backgroundColor: C.successLight }]}>
                  <Feather name="check" size={12} color={C.success} />
                </View>
                <ThemedText style={[styles.protectionText, { color: C.textSecondary }]}>
                  {text}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(1950)}>
        <View style={[styles.divider, { backgroundColor: C.border }]} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(2000)}>
        <Card style={[styles.rightsCard, { backgroundColor: C.cardBg }]}>
          <View style={styles.rightsHeader}>
            <Feather name="user-check" size={20} color={C.primary} />
            <ThemedText style={[styles.rightsTitle, { color: C.text }]}>
              I Tuoi Diritti (Art. 15-22 GDPR)
            </ThemedText>
          </View>
          <ThemedText style={[styles.rightsIntro, { color: C.textSecondary }]}>
            In qualsiasi momento puoi esercitare i seguenti diritti contattando il nostro DPO:
          </ThemedText>
          <View style={styles.rightsList}>
            {[
              { icon: "eye" as const, label: "Accesso", desc: "Ottenere copia dei tuoi dati personali" },
              { icon: "edit-3" as const, label: "Rettifica", desc: "Correggere dati inesatti o incompleti" },
              { icon: "trash-2" as const, label: "Cancellazione", desc: "Richiedere la cancellazione dei tuoi dati" },
              { icon: "pause-circle" as const, label: "Limitazione", desc: "Limitare il trattamento dei tuoi dati" },
              { icon: "download" as const, label: "Portabilita", desc: "Ricevere i tuoi dati in formato strutturato" },
              { icon: "x-circle" as const, label: "Opposizione", desc: "Opporti al trattamento dei tuoi dati" },
            ].map((right, i) => (
              <View key={i} style={styles.rightItem}>
                <Feather name={right.icon} size={16} color={C.primary} />
                <View style={styles.rightContent}>
                  <ThemedText style={[styles.rightLabel, { color: C.text }]}>{right.label}</ThemedText>
                  <ThemedText style={[styles.rightDesc, { color: C.textSecondary }]}>{right.desc}</ThemedText>
                </View>
              </View>
            ))}
          </View>
          <ThemedText style={[styles.rightsNote, { color: C.textSecondary }]}>
            Hai inoltre il diritto di proporre reclamo al Garante per la Protezione dei Dati Personali 
            (www.garanteprivacy.it) qualora ritenga che il trattamento dei tuoi dati sia in violazione 
            del GDPR.
          </ThemedText>
        </Card>
      </Animated.View>

      <InfoBlock
        icon="navigation"
        title="Tracciamento GPS"
        text="Il GPS viene attivato esclusivamente durante i servizi di trasporto per calcolare automaticamente i chilometri percorsi. I dati di posizione sono associati al veicolo e non all'operatore. Il tracciamento avviene solo durante l'orario di servizio e non viene effettuato alcun monitoraggio al di fuori delle attivita operative."
        color="#3B82F6"
        bgColor={C.primaryLight}
        delay={2100}
      />

      <Animated.View entering={FadeInUp.duration(400).delay(2200)}>
        <Card style={[styles.legalCard, { borderColor: C.border, backgroundColor: C.background }]}>
          <Feather name="book-open" size={18} color={C.primary} />
          <View style={styles.legalContent}>
            <ThemedText style={[styles.legalTitle, { color: C.text }]}>Base Giuridica del Trattamento</ThemedText>
            <ThemedText style={[styles.legalText, { color: C.textSecondary }]}>
              I dati personali vengono trattati sulla base di: esecuzione di un contratto di servizio (Art. 6.1.b GDPR), 
              adempimento di obblighi legali in materia fiscale e sanitaria (Art. 6.1.c GDPR), e legittimo interesse 
              del Titolare per la sicurezza e il miglioramento del servizio (Art. 6.1.f GDPR). Per il portale di 
              prenotazione, la base giuridica e il consenso esplicito dell'interessato (Art. 6.1.a GDPR).
            </ThemedText>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(2300)} style={styles.actions}>
        <Pressable
          onPress={handleViewPolicy}
          style={({ pressed }) => [
            styles.actionButton,
            { 
              backgroundColor: C.primaryLight,
              borderColor: C.border,
              opacity: pressed ? 0.8 : 1,
            }
          ]}
        >
          <Feather name="file-text" size={18} color={C.primary} />
          <ThemedText style={[styles.actionButtonText, { color: C.primary }]}>
            Informativa Privacy Completa
          </ThemedText>
          <Feather name="external-link" size={16} color={C.primary} />
        </Pressable>

        <Pressable
          onPress={handleContactDPO}
          style={({ pressed }) => [
            styles.actionButton,
            { 
              backgroundColor: C.background,
              borderColor: C.border,
              opacity: pressed ? 0.8 : 1,
            }
          ]}
        >
          <Feather name="mail" size={18} color={C.textSecondary} />
          <ThemedText style={[styles.actionButtonText, { color: C.text }]}>
            Contatta il DPO
          </ThemedText>
          <Feather name="arrow-right" size={16} color={C.textSecondary} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(2400)}>
        <ThemedText style={[styles.footer, { color: C.textSecondary }]}>
          Ultimo aggiornamento: Febbraio 2026{"\n"}
          Soccorso Digitale - soccorsodigitale.app{"\n"}
          privacy@soccorsodigitale.app
        </ThemedText>
      </Animated.View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  controllerCard: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  controllerRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  controllerContent: {
    flex: 1,
  },
  controllerLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  controllerName: {
    fontSize: 18,
    fontWeight: "700",
  },
  controllerDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  controllerDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  controllerNote: {
    fontSize: 13,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionDescription: {
    fontSize: 13,
  },
  dataList: {
    gap: Spacing.sm,
  },
  dataItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  dataIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dataContent: {
    flex: 1,
  },
  dataTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  dataDescription: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  infoBlock: {
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  infoBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoBlockTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoBlockText: {
    fontSize: 13,
    lineHeight: 20,
  },
  retentionCard: {
    padding: Spacing.lg,
  },
  retentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  retentionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  retentionList: {
    gap: Spacing.md,
  },
  retentionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  retentionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  retentionContent: {
    flex: 1,
  },
  retentionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  retentionValue: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  protectionCard: {
    padding: Spacing.lg,
  },
  protectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  protectionList: {
    gap: Spacing.sm,
  },
  protectionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  protectionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  rightsCard: {
    padding: Spacing.lg,
  },
  rightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rightsTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  rightsIntro: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  rightsList: {
    gap: Spacing.sm,
  },
  rightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  rightContent: {
    flex: 1,
  },
  rightLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  rightDesc: {
    fontSize: 13,
    marginTop: 1,
  },
  rightsNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.md,
    fontStyle: "italic",
  },
  legalCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  legalContent: {
    flex: 1,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  legalText: {
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
