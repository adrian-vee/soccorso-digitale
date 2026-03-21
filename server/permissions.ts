import { db } from "./db";
import { orgCustomRoles } from "../shared/schema";
import { eq } from "drizzle-orm";

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
}

export const PERMISSION_CATEGORIES: Record<string, string> = {
  dashboard: "Dashboard",
  trips: "Servizi / Viaggi",
  vehicles: "Veicoli e Flotta",
  staff: "Personale",
  shifts: "Pianificazione Turni",
  checklists: "Checklist e Inventario",
  gps: "GPS e Tracking",
  reports: "Report e Statistiche",
  finance: "Finanza e Contratti",
  volunteers: "Registro Volontari",
  bookings: "Hub Prenotazioni",
  settings: "Impostazioni",
  users: "Gestione Utenti",
};

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  { key: "dashboard.view", label: "Visualizza Dashboard", description: "Accesso alla dashboard principale", category: "dashboard" },
  
  { key: "trips.view", label: "Visualizza Servizi", description: "Vedere la lista dei servizi/viaggi", category: "trips" },
  { key: "trips.create", label: "Crea Servizi", description: "Inserire nuovi servizi", category: "trips" },
  { key: "trips.edit", label: "Modifica Servizi", description: "Modificare servizi esistenti", category: "trips" },
  { key: "trips.delete", label: "Elimina Servizi", description: "Eliminare servizi", category: "trips" },
  { key: "trips.export", label: "Esporta Servizi", description: "Esportare dati servizi in CSV/PDF", category: "trips" },

  { key: "vehicles.view", label: "Visualizza Veicoli", description: "Vedere la lista dei veicoli", category: "vehicles" },
  { key: "vehicles.create", label: "Aggiungi Veicoli", description: "Aggiungere nuovi veicoli", category: "vehicles" },
  { key: "vehicles.edit", label: "Modifica Veicoli", description: "Modificare dati veicoli", category: "vehicles" },
  { key: "vehicles.delete", label: "Elimina Veicoli", description: "Rimuovere veicoli", category: "vehicles" },

  { key: "staff.view", label: "Visualizza Personale", description: "Vedere la lista del personale", category: "staff" },
  { key: "staff.create", label: "Aggiungi Personale", description: "Aggiungere nuovo personale", category: "staff" },
  { key: "staff.edit", label: "Modifica Personale", description: "Modificare dati personale", category: "staff" },
  { key: "staff.delete", label: "Rimuovi Personale", description: "Rimuovere personale", category: "staff" },

  { key: "shifts.view", label: "Visualizza Turni", description: "Vedere la pianificazione turni", category: "shifts" },
  { key: "shifts.create", label: "Crea Turni", description: "Creare nuovi turni", category: "shifts" },
  { key: "shifts.edit", label: "Modifica Turni", description: "Modificare turni esistenti", category: "shifts" },

  { key: "checklists.view", label: "Visualizza Checklist", description: "Vedere le checklist", category: "checklists" },
  { key: "checklists.manage", label: "Gestisci Checklist", description: "Creare e modificare template checklist", category: "checklists" },

  { key: "gps.view", label: "Visualizza GPS", description: "Vedere il tracking GPS dei veicoli", category: "gps" },

  { key: "reports.view", label: "Visualizza Report", description: "Accesso ai report e statistiche", category: "reports" },
  { key: "reports.export", label: "Esporta Report", description: "Esportare report in PDF/CSV", category: "reports" },

  { key: "finance.view", label: "Visualizza Finanza", description: "Vedere contratti e costi", category: "finance" },
  { key: "finance.manage", label: "Gestisci Finanza", description: "Modificare contratti e costi", category: "finance" },

  { key: "volunteers.view", label: "Visualizza Volontari", description: "Vedere il registro volontari", category: "volunteers" },
  { key: "volunteers.manage", label: "Gestisci Volontari", description: "Aggiungere e modificare volontari", category: "volunteers" },

  { key: "bookings.view", label: "Visualizza Prenotazioni", description: "Vedere le prenotazioni hub", category: "bookings" },
  { key: "bookings.manage", label: "Gestisci Prenotazioni", description: "Gestire prenotazioni e clienti", category: "bookings" },

  { key: "settings.view", label: "Visualizza Impostazioni", description: "Vedere le impostazioni organizzazione", category: "settings" },
  { key: "settings.manage", label: "Gestisci Impostazioni", description: "Modificare impostazioni organizzazione", category: "settings" },

  { key: "users.view", label: "Visualizza Utenti", description: "Vedere la lista utenti", category: "users" },
  { key: "users.create", label: "Crea Utenti", description: "Creare nuovi utenti", category: "users" },
  { key: "users.manage", label: "Gestisci Utenti", description: "Modificare e disattivare utenti", category: "users" },
];

const STANDARD_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS.map(p => p.key),
  admin: ALL_PERMISSIONS.map(p => p.key),
  director: ALL_PERMISSIONS.map(p => p.key),
  org_admin: ALL_PERMISSIONS.map(p => p.key),
  branch_manager: [
    "dashboard.view",
    "trips.view", "trips.create", "trips.edit", "trips.export",
    "vehicles.view", "vehicles.edit",
    "staff.view",
    "shifts.view", "shifts.create", "shifts.edit",
    "checklists.view", "checklists.manage",
    "gps.view",
    "reports.view",
  ],
  crew: [
    "dashboard.view",
    "trips.view", "trips.create",
    "checklists.view",
  ],
};

export async function getUserPermissions(role: string, customRoleId?: string | null): Promise<string[]> {
  if (customRoleId) {
    try {
      const customRole = await db.select().from(orgCustomRoles).where(eq(orgCustomRoles.id, customRoleId)).limit(1);
      if (customRole.length > 0 && customRole[0].isActive) {
        return (customRole[0].permissions as string[]) || [];
      }
    } catch {}
  }
  return STANDARD_ROLE_PERMISSIONS[role] || [];
}

export function getStandardRolePermissions(role: string): string[] {
  return STANDARD_ROLE_PERMISSIONS[role] || [];
}

export function getPermissionsByCategory(): Record<string, PermissionDefinition[]> {
  const grouped: Record<string, PermissionDefinition[]> = {};
  for (const perm of ALL_PERMISSIONS) {
    if (!grouped[perm.category]) {
      grouped[perm.category] = [];
    }
    grouped[perm.category].push(perm);
  }
  return grouped;
}

export function generateSecurePassword(length: number = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}
