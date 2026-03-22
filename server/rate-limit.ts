import rateLimit from "express-rate-limit";

// Rate limit globale: 1000 req per IP ogni 15 minuti
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppe richieste, riprova più tardi" },
});

// Rate limit per login: anti brute-force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Troppi tentativi di accesso, riprova tra 15 minuti" },
});

// Rate limit per API pubbliche
export const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit superato" },
});
