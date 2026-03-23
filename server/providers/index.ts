/**
 * Provider System — Central Entry Point
 *
 * All external API integrations are managed through providers.
 * Each category has a manager with: primary provider, fallback(s),
 * in-memory cache, circuit breaker, and per-tenant rate limiting.
 *
 * Usage:
 *   import { getGeoProvider, getWeatherProvider } from "./providers";
 *   const result = await getGeoProvider().geocode("Via Roma 1, Padova", orgId);
 */

// Base infrastructure
export { CACHE_TTL, type ProviderResult, type ProviderHealth } from "./_base";

// Geo (Nominatim → Google Maps fallback)
export { getGeoProvider, type GeocodingResult, type ReverseGeocodingResult } from "./geo";

// Weather (Open-Meteo)
export { getWeatherProvider, type WeatherForecast, type WeatherData } from "./weather";

// Data (Holidays, Protezione Civile)
export { getDataProvider, type Holiday, type EmergencyAlert } from "./data";

// Validation (CF locale, P.IVA VATComply, HIBP)
export { getValidationProvider, type CodiceFiscaleValidation, type VatValidationResult, type PasswordBreachResult } from "./validation";

// Notifications (Brevo SMS)
export { getNotificationsProvider, type SmsSendResult, type SmsCreditsResult } from "./notifications";
