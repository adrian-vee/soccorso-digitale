/**
 * fix-demo-users.ts
 *
 * ONE-TIME script: trova gli utenti con role='admin' o 'director' che hanno
 * un organizationId (utenti org-scoped creati da start-trial) e verifica che
 * il loro setup sia corretto. NON cambia il ruolo — il fix reale è nel codice
 * (isFullAdmin ora controlla anche l'assenza di organizationId).
 *
 * Usage: npx tsx scripts/fix-demo-users.ts
 */

import { db } from "../server/db";
import { users, organizations } from "../shared/schema";
import { eq, and, isNotNull, inArray } from "drizzle-orm";

async function main() {
  console.log("=== Fix Demo Users — Audit ===\n");

  // Trova tutti gli utenti admin/director con organizationId
  const orgScopedAdmins = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      organizationId: users.organizationId,
    })
    .from(users)
    .where(
      and(
        inArray(users.role, ["admin", "director"]),
        isNotNull(users.organizationId)
      )
    );

  if (orgScopedAdmins.length === 0) {
    console.log("✅ Nessun utente admin/director con organizationId trovato.");
    return;
  }

  console.log(`Trovati ${orgScopedAdmins.length} utenti admin/director con organizationId:\n`);

  for (const u of orgScopedAdmins) {
    // Verifica che l'organizzazione esista
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, u.organizationId!));

    const orgStatus = org ? `org: "${org.name}" (${org.status})` : "⚠️  ORG NON TROVATA";
    console.log(`  - ${u.email} | role: ${u.role} | ${orgStatus}`);

    if (!org) {
      console.warn(`    ⚠️  L'utente ${u.email} ha un organizationId che non esiste. Potrebbe essere un problema di integrità.`);
    }
  }

  console.log("\n✅ Audit completato.");
  console.log("📝 Nota: il fix reale è nel codice — isFullAdmin ora esclude gli utenti con organizationId.");
  console.log("   Questi utenti vedranno correttamente la dashboard della loro organizzazione dopo il deploy.\n");

  process.exit(0);
}

main().catch(err => {
  console.error("Errore:", err);
  process.exit(1);
});
