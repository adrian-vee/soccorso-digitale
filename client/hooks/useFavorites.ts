import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "@soccorso_digitale_favorites";

export interface FavoriteLocation {
  id: string;
  type: "structure" | "address";
  structureId?: string;
  structureName?: string;
  departmentId?: string;
  departmentName?: string;
  locationType: string;
  address?: string;
  displayName: string;
  createdAt: number;
}

interface FavoritesState {
  favorites: FavoriteLocation[];
  isLoading: boolean;
}

export function useFavorites() {
  const [state, setState] = useState<FavoritesState>({
    favorites: [],
    isLoading: true,
  });

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FavoriteLocation[];
        parsed.sort((a, b) => b.createdAt - a.createdAt);
        setState({ favorites: parsed, isLoading: false });
      } else {
        setState({ favorites: [], isLoading: false });
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
      setState({ favorites: [], isLoading: false });
    }
  }, []);

  const addFavorite = useCallback(async (favorite: Omit<FavoriteLocation, "id" | "createdAt">) => {
    try {
      const newFavorite: FavoriteLocation = {
        ...favorite,
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };

      const exists = state.favorites.some(f => 
        f.type === favorite.type &&
        f.locationType === favorite.locationType &&
        (favorite.type === "structure" 
          ? f.structureId === favorite.structureId && f.departmentId === favorite.departmentId
          : f.address === favorite.address)
      );

      if (exists) {
        return false;
      }

      const updated = [newFavorite, ...state.favorites];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      setState({ ...state, favorites: updated });
      return true;
    } catch (error) {
      console.error("Error adding favorite:", error);
      return false;
    }
  }, [state]);

  const removeFavorite = useCallback(async (favoriteId: string) => {
    try {
      const updated = state.favorites.filter(f => f.id !== favoriteId);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      setState({ ...state, favorites: updated });
      return true;
    } catch (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
  }, [state]);

  const isFavorite = useCallback((params: {
    type: "structure" | "address";
    locationType: string;
    structureId?: string;
    departmentId?: string;
    address?: string;
  }) => {
    return state.favorites.some(f => 
      f.type === params.type &&
      f.locationType === params.locationType &&
      (params.type === "structure" 
        ? f.structureId === params.structureId && f.departmentId === params.departmentId
        : f.address === params.address)
    );
  }, [state.favorites]);

  const getFavoriteId = useCallback((params: {
    type: "structure" | "address";
    locationType: string;
    structureId?: string;
    departmentId?: string;
    address?: string;
  }) => {
    const found = state.favorites.find(f => 
      f.type === params.type &&
      f.locationType === params.locationType &&
      (params.type === "structure" 
        ? f.structureId === params.structureId && f.departmentId === params.departmentId
        : f.address === params.address)
    );
    return found?.id || null;
  }, [state.favorites]);

  const toggleFavorite = useCallback(async (favorite: Omit<FavoriteLocation, "id" | "createdAt">) => {
    const existingId = getFavoriteId({
      type: favorite.type,
      locationType: favorite.locationType,
      structureId: favorite.structureId,
      departmentId: favorite.departmentId,
      address: favorite.address,
    });

    if (existingId) {
      return removeFavorite(existingId);
    } else {
      return addFavorite(favorite);
    }
  }, [addFavorite, removeFavorite, getFavoriteId]);

  const getFavoritesByType = useCallback((locationType?: string) => {
    if (!locationType) return state.favorites;
    return state.favorites.filter(f => f.locationType === locationType);
  }, [state.favorites]);

  return {
    favorites: state.favorites,
    isLoading: state.isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoriteId,
    toggleFavorite,
    getFavoritesByType,
    reload: loadFavorites,
  };
}
