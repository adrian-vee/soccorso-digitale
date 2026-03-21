import { useColorScheme as useRNColorScheme } from "react-native";
import { useState, useEffect } from "react";

function isNightTime(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 20 || hour < 6;
}

export function useColorScheme(): "light" | "dark" {
  const systemColorScheme = useRNColorScheme();
  const [isNight, setIsNight] = useState(isNightTime());

  useEffect(() => {
    const checkTime = () => {
      setIsNight(isNightTime());
    };

    checkTime();

    const interval = setInterval(checkTime, 60000);

    return () => clearInterval(interval);
  }, []);

  if (isNight) {
    return "dark";
  }

  return systemColorScheme ?? "light";
}
