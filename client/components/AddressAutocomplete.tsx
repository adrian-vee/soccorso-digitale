import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { TextInput } from "@/components/TextInput";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface AddressSuggestion {
  displayName: string;
  address: {
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
  placeId?: string;
  lat?: string;
  lon?: string;
}

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  allowCivicNumber?: boolean;
}

function removeCivicNumbers(text: string): string {
  return text
    .replace(/,?\s*\d+[a-zA-Z]?(?:\s*[-/]\s*\d+[a-zA-Z]?)?(?=\s*,|\s*$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAddress(suggestion: AddressSuggestion, allowCivicNumber: boolean): string {
  const { address } = suggestion;
  const parts: string[] = [];
  
  if (address.road) {
    parts.push(address.road);
  }
  
  const city = address.city || address.town || address.village || address.municipality;
  if (city) {
    parts.push(city);
  }
  
  if (address.county && address.county !== city) {
    parts.push(address.county);
  }
  
  let result = parts.join(", ");
  
  if (!allowCivicNumber) {
    result = removeCivicNumbers(result);
  }
  
  return result.toUpperCase();
}

export function AddressAutocomplete({
  label,
  placeholder = "Inizia a scrivere...",
  value,
  onChangeText,
  allowCivicNumber = false,
}: AddressAutocompleteProps) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const requestIdRef = useRef(0);

  // Get user location on mount for location-biased results
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getLastKnownPositionAsync({});
          if (location) {
            setUserLocation({
              lat: location.coords.latitude,
              lon: location.coords.longitude,
            });
          }
        }
      } catch (e) {
        // Location not available, will use default biasing
      }
    })();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    
    try {
      const apiUrl = getApiUrl();
      const url = new URL("/api/address-autocomplete", apiUrl);
      url.searchParams.set("q", query);
      
      if (userLocation) {
        url.searchParams.set("lat", userLocation.lat.toString());
        url.searchParams.set("lon", userLocation.lon.toString());
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error: any) {
      if (currentRequestId === requestIdRef.current) {
        if (error?.name !== "AbortError") {
          console.log("Address search unavailable");
        }
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [userLocation]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputValue && inputValue.length >= 3) {
        searchAddresses(inputValue);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 120); // Ultra-fast debounce for instant response

    return () => clearTimeout(timeoutId);
  }, [inputValue, searchAddresses]);

  const handleTextChange = (text: string) => {
    let processedText = text.toUpperCase();
    
    if (!allowCivicNumber) {
      processedText = processedText.replace(/\d/g, "");
    }
    
    setSuggestions([]);
    setInputValue(processedText);
    onChangeText(processedText);
    
    if (processedText.length >= 3) {
      setIsLoading(true);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setIsLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const formatted = formatAddress(suggestion, allowCivicNumber);
    setInputValue(formatted);
    onChangeText(formatted);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        label={label}
        placeholder={placeholder}
        value={inputValue}
        onChangeText={handleTextChange}
        autoCapitalize="characters"
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.cardBackground }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
            Cercando...
          </ThemedText>
        </View>
      ) : null}
      
      {showSuggestions && suggestions.length > 0 ? (
        <View style={[styles.suggestionsContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.displayName}-${index}`}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <ThemedText type="body" numberOfLines={2}>
                  {formatAddress(item, allowCivicNumber)}
                </ThemedText>
              </Pressable>
            )}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 1000,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxHeight: 200,
    zIndex: 1001,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
});
