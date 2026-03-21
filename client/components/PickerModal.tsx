import React, { useState, useMemo } from "react";
import { 
  View, 
  Modal, 
  StyleSheet, 
  Pressable, 
  FlatList,
  TextInput as RNTextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface PickerModalProps<T> {
  visible: boolean;
  onClose: () => void;
  title: string;
  data: T[];
  selectedValue: string;
  onSelect: (value: string) => void;
  labelKey: keyof T;
  valueKey: keyof T;
  searchable?: boolean;
  allowAdd?: boolean;
  addType?: "structure" | "department";
  structureType?: "ospedale" | "casa_di_riposo";
  onItemAdded?: () => void;
}

export function PickerModal<T extends Record<string, any>>({
  visible,
  onClose,
  title,
  data,
  selectedValue,
  onSelect,
  labelKey,
  valueKey,
  searchable = false,
  allowAdd = false,
  addType,
  structureType,
  onItemAdded,
}: PickerModalProps<T>) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newProvince, setNewProvince] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      String(item[labelKey]).toLowerCase().includes(query)
    );
  }, [data, searchQuery, searchable, labelKey]);

  const handleClose = () => {
    setSearchQuery("");
    setShowAddForm(false);
    resetAddForm();
    onClose();
  };

  const resetAddForm = () => {
    setNewName("");
    setNewStreet("");
    setNewCity("");
    setNewProvince("");
  };

  const handleAddNew = async () => {
    if (!newName.trim()) {
      Alert.alert("Errore", "Il nome è obbligatorio");
      return;
    }

    if (addType === "structure") {
      if (!newStreet.trim()) {
        Alert.alert("Errore", "L'indirizzo (via/piazza) è obbligatorio");
        return;
      }
      if (!newCity.trim()) {
        Alert.alert("Errore", "La città è obbligatoria");
        return;
      }
      if (!newProvince.trim() || newProvince.length !== 2) {
        Alert.alert("Errore", "Inserisci la sigla della provincia (2 lettere, es. VR)");
        return;
      }

      const address = `${newStreet.trim()}, ${newCity.trim()} (${newProvince.toUpperCase()})`;

      setIsSubmitting(true);
      try {
        const response = await apiRequest("POST", "/api/structures", {
          name: newName.trim(),
          address: address,
          type: structureType || "ospedale"
        });
        
        if (response.status === 401 || response.status === 403) {
          throw new Error("Non sei autorizzato a eseguire questa azione. Effettua il login.");
        }
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Errore durante il salvataggio");
        }
        
        resetAddForm();
        setShowAddForm(false);
        if (onItemAdded) onItemAdded();
        onSelect(result.id);
      } catch (error: any) {
        Alert.alert("Errore", error.message || "Errore durante il salvataggio");
      } finally {
        setIsSubmitting(false);
      }
    } else if (addType === "department") {
      setIsSubmitting(true);
      try {
        const response = await apiRequest("POST", "/api/departments", {
          name: newName.trim()
        });
        
        if (response.status === 401 || response.status === 403) {
          throw new Error("Non sei autorizzato a eseguire questa azione. Effettua il login.");
        }
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Errore durante il salvataggio");
        }
        
        resetAddForm();
        setShowAddForm(false);
        if (onItemAdded) onItemAdded();
        onSelect(result.id);
      } catch (error: any) {
        Alert.alert("Errore", error.message || "Errore durante il salvataggio");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getAddButtonLabel = () => {
    if (addType === "department") return "Aggiungi nuovo reparto";
    if (structureType === "ospedale") return "Aggiungi nuovo ospedale";
    if (structureType === "casa_di_riposo") return "Aggiungi nuova casa di riposo";
    return "Aggiungi nuovo";
  };

  const getFormTitle = () => {
    if (addType === "department") return "Nuovo Reparto";
    if (structureType === "ospedale") return "Nuovo Ospedale";
    if (structureType === "casa_di_riposo") return "Nuova Casa di Riposo";
    return "Nuovo Elemento";
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <View style={styles.headerRow}>
              <ThemedText type="h3">{showAddForm ? getFormTitle() : title}</ThemedText>
              <Pressable onPress={handleClose}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            {searchable && !showAddForm ? (
              <View style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="search" size={18} color={theme.textSecondary} />
                <RNTextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Cerca..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Feather name="x-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {showAddForm ? (
            <View style={styles.addFormContainer}>
              <TextInput
                label={addType === "department" ? "Nome Reparto" : "Nome Struttura"}
                placeholder={addType === "department" 
                  ? "es. Pronto Soccorso" 
                  : structureType === "ospedale" 
                    ? "es. Ospedale Borgo Trento" 
                    : "es. Casa di Riposo Villa Serena"}
                value={newName}
                onChangeText={setNewName}
              />
              
              {addType === "structure" ? (
                <>
                  <TextInput
                    label="Via/Piazza (senza numero civico)"
                    placeholder="es. Piazzale Aristide Stefani"
                    value={newStreet}
                    onChangeText={setNewStreet}
                  />
                  <View style={styles.cityRow}>
                    <View style={styles.cityInput}>
                      <TextInput
                        label="Città"
                        placeholder="es. Verona"
                        value={newCity}
                        onChangeText={setNewCity}
                      />
                    </View>
                    <View style={styles.provinceInput}>
                      <TextInput
                        label="Provincia"
                        placeholder="VR"
                        value={newProvince}
                        onChangeText={(text) => setNewProvince(text.toUpperCase().slice(0, 2))}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  
                  <View style={[styles.formatHint, { backgroundColor: theme.primaryLight }]}>
                    <Feather name="info" size={16} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.sm, flex: 1 }}>
                      L'indirizzo verrà salvato nel formato:{"\n"}
                      "{newStreet || "Via/Piazza"}, {newCity || "Città"} ({newProvince || "XX"})"
                    </ThemedText>
                  </View>
                </>
              ) : null}
              
              <View style={styles.formButtons}>
                <Pressable 
                  style={[styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    setShowAddForm(false);
                    resetAddForm();
                  }}
                >
                  <ThemedText type="body" style={{ color: theme.text }}>Annulla</ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleAddNew}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                      Salva
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <FlatList
                data={filteredData}
                keyExtractor={(item) => String(item[valueKey])}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: allowAdd ? 80 : insets.bottom + Spacing.xl }
                ]}
                renderItem={({ item }) => {
                  const isSelected = String(item[valueKey]) === selectedValue;
                  return (
                    <Pressable
                      style={({ pressed }) => [
                        styles.listItem,
                        { 
                          backgroundColor: isSelected ? theme.primaryLight : "transparent",
                          opacity: pressed ? 0.7 : 1
                        }
                      ]}
                      onPress={() => onSelect(String(item[valueKey]))}
                    >
                      <View style={styles.listItemContent}>
                        <ThemedText 
                          type="body" 
                          style={{ color: isSelected ? theme.primary : theme.text }}
                        >
                          {String(item[labelKey])}
                        </ThemedText>
                        {item.address ? (
                          <ThemedText 
                            type="small" 
                            style={{ color: theme.textSecondary, marginTop: 2 }}
                            numberOfLines={1}
                          >
                            {String(item.address)}
                          </ThemedText>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <Feather name="check" size={20} color={theme.primary} />
                      ) : null}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Feather name="inbox" size={48} color={theme.textSecondary} />
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                      Nessun risultato trovato
                    </ThemedText>
                    {allowAdd ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                        Puoi aggiungere un nuovo elemento con il pulsante in basso
                      </ThemedText>
                    ) : null}
                  </View>
                )}
              />
              
              {allowAdd ? (
                <View style={[styles.addButtonContainer, { 
                  backgroundColor: theme.backgroundRoot,
                  paddingBottom: insets.bottom + Spacing.md,
                  borderTopColor: theme.border
                }]}>
                  <Pressable 
                    style={[styles.addButton, { backgroundColor: theme.primary }]}
                    onPress={() => setShowAddForm(true)}
                  >
                    <Feather name="plus" size={20} color="#FFFFFF" />
                    <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                      {getAddButtonLabel()}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 15,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  listItemContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  emptyContainer: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  addButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  addFormContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  cityRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cityInput: {
    flex: 2,
  },
  provinceInput: {
    flex: 1,
  },
  formatHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  formButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  saveButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
