/**
 * Codice Fiscale Validator (local, no API call)
 *
 * Validates Italian fiscal codes using check digit algorithm.
 * No external dependency, pure TypeScript implementation.
 * Use case: patient/staff registration validation.
 */

const EVEN_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6, "H": 7, "I": 8, "J": 9,
  "K": 10, "L": 11, "M": 12, "N": 13, "O": 14, "P": 15, "Q": 16, "R": 17, "S": 18,
  "T": 19, "U": 20, "V": 21, "W": 22, "X": 23, "Y": 24, "Z": 25,
};

const ODD_MAP: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  "A": 1, "B": 0, "C": 5, "D": 7, "E": 9, "F": 13, "G": 15, "H": 17, "I": 19, "J": 21,
  "K": 2, "L": 4, "M": 18, "N": 20, "O": 11, "P": 3, "Q": 6, "R": 8, "S": 12,
  "T": 14, "U": 16, "V": 10, "W": 22, "X": 25, "Y": 24, "Z": 23,
};

const REMAINDER_LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface CodiceFiscaleValidation {
  readonly valid: boolean;
  readonly formatted: string;
  readonly errors: readonly string[];
}

/** Validate an Italian Codice Fiscale */
export function validateCodiceFiscale(cf: string): CodiceFiscaleValidation {
  const errors: string[] = [];
  const formatted = cf.toUpperCase().trim();

  if (formatted.length !== 16) {
    errors.push("Il codice fiscale deve essere di 16 caratteri");
    return { valid: false, formatted, errors };
  }

  // Check format: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
  const pattern = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
  if (!pattern.test(formatted)) {
    errors.push("Formato codice fiscale non valido");
    return { valid: false, formatted, errors };
  }

  // Validate check digit (last character)
  const first15 = formatted.substring(0, 15);
  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const char = first15[i];
    if (i % 2 === 0) {
      // Odd position (1-indexed)
      sum += ODD_MAP[char] ?? 0;
    } else {
      // Even position (1-indexed)
      sum += EVEN_MAP[char] ?? 0;
    }
  }

  const expectedCheck = REMAINDER_LETTER[sum % 26];
  const actualCheck = formatted[15];

  if (expectedCheck !== actualCheck) {
    errors.push("Carattere di controllo non valido");
    return { valid: false, formatted, errors };
  }

  return { valid: true, formatted, errors: [] };
}

/** Extract birth date from Codice Fiscale (approximate, month + year) */
export function extractBirthInfo(cf: string): {
  year: number | null;
  month: number | null;
  gender: "M" | "F" | null;
} {
  const formatted = cf.toUpperCase().trim();
  if (formatted.length !== 16) return { year: null, month: null, gender: null };

  const yearDigits = parseInt(formatted.substring(6, 8));
  const monthLetter = formatted[8];
  const dayDigits = parseInt(formatted.substring(9, 11));

  // Month mapping
  const months: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
    L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
  };

  const month = months[monthLetter] ?? null;

  // Gender: day > 40 means female (day + 40)
  const gender: "M" | "F" | null = dayDigits > 40 ? "F" : "M";

  // Year: assume 1900s or 2000s
  const currentYear = new Date().getFullYear() % 100;
  const year = yearDigits > currentYear ? 1900 + yearDigits : 2000 + yearDigits;

  return { year, month, gender };
}
