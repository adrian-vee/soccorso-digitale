import { db } from "./db";
import { organizations, users } from "@shared/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { getResendClient } from "./resend-client";
import { templateCredenzialiDemo } from "./utils/email-templates";
import crypto from "node:crypto";
import bcrypt from "bcrypt";

const ALL_MODULES = [
  'report_accise',
  'carbon_footprint',
  'esg_dashboard',
  'analisi_economica',
  'gps_tracking',
  'checklist',
  'consegne_digitali',
  'registro_sanificazioni',
  'pianificazione_turni',
  'rimborsi_volontari',
  'benessere_staff',
  'governance_compliance',
  'partner_program',
  'registro_volontari_elettronico',
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function createDemoAccount(requestEmail: string, requestName: string, companyName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db.select().from(organizations)
      .where(and(
        eq(organizations.isDemo, true),
        eq(organizations.demoEmail, requestEmail)
      ));

    if (existing.length > 0) {
      const activeDemo = existing.find(org => org.demoExpiresAt && new Date(org.demoExpiresAt) > new Date());
      if (activeDemo) {
        return { success: false, error: 'Hai già una demo attiva. Controlla la tua email per le credenziali.' };
      }
    }

    const demoId = `demo-${Date.now()}`;
    const demoSuffix = demoId.slice(-6);
    const baseOrgName = companyName || `Demo ${requestName}`;
    const orgName = `${baseOrgName} (Demo ${demoSuffix})`;
    const slug = generateSlug(baseOrgName) + '-' + demoSuffix;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const password = generatePassword();
    const hashedPassword = await bcrypt.hash(password, 10);
    const loginEmail = `d${Date.now().toString(36)}@sd.demo`;

    const [org] = await db.insert(organizations).values({
      name: orgName,
      slug: slug,
      status: 'trial',
      isDemo: true,
      demoExpiresAt: expiresAt,
      demoEmail: requestEmail,
      enabledModules: ALL_MODULES,
      maxVehicles: 3,
      maxUsers: 5,
      notes: `Demo automatica richiesta da ${requestName} (${requestEmail})`,
    }).returning();

    await db.insert(users).values({
      email: loginEmail,
      password: hashedPassword,
      name: requestName,
      role: 'org_admin',
      organizationId: org.id,
      accountType: 'person',
    });

    const displayOrgName = baseOrgName;
    const emailSent = await sendDemoCredentialsEmail({
      recipientEmail: requestEmail,
      recipientName: requestName,
      loginEmail: loginEmail,
      password: password,
      expiresAt: expiresAt,
      orgName: displayOrgName,
    });

    if (!emailSent) {
      console.error('[DEMO] Email send failed, but account was created');
      return {
        success: true,
        emailFailed: true,
        credentials: { loginEmail, password, orgName: displayOrgName, expiresAt: expiresAt.toISOString() }
      } as any;
    }

    console.log(`[DEMO] Demo account created for ${requestEmail}: org=${org.id}, login=${loginEmail}, expires=${expiresAt.toISOString()}`);

    return { success: true };
  } catch (error: any) {
    console.error('[DEMO] Error creating demo account:', error);
    return { success: false, error: 'Errore durante la creazione della demo. Riprova più tardi.' };
  }
}

export async function isDemoExpired(organizationId: string): Promise<boolean> {
  const [org] = await db.select().from(organizations)
    .where(and(
      eq(organizations.id, organizationId),
      eq(organizations.isDemo, true)
    ));

  if (!org) return false;
  if (!org.demoExpiresAt) return false;
  return new Date(org.demoExpiresAt) < new Date();
}

export async function cleanupExpiredDemos(): Promise<number> {
  try {
    const expiredOrgs = await db.select().from(organizations)
      .where(and(
        eq(organizations.isDemo, true),
        lt(organizations.demoExpiresAt!, new Date(Date.now() - 48 * 60 * 60 * 1000))
      ));

    let cleaned = 0;
    for (const org of expiredOrgs) {
      await db.delete(users).where(eq(users.organizationId, org.id));
      await db.delete(organizations).where(eq(organizations.id, org.id));
      cleaned++;
      console.log(`[DEMO] Cleaned up expired demo org: ${org.id} (${org.name})`);
    }

    return cleaned;
  } catch (error) {
    console.error('[DEMO] Error cleaning up expired demos:', error);
    return 0;
  }
}

interface DemoEmailData {
  recipientEmail: string;
  recipientName: string; // kept for compatibility but not used in new template
  loginEmail: string;
  password: string;
  expiresAt: Date;
  orgName: string;
}

async function sendDemoCredentialsEmail(data: DemoEmailData): Promise<boolean> {
  try {
    const { client, fromEmail } = await getResendClient();

    const htmlContent = templateCredenzialiDemo({
      orgName: data.orgName,
      loginEmail: data.loginEmail,
      password: data.password,
      expiresAt: data.expiresAt,
    });

    const result = await client.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: `Le tue credenziali demo - SOCCORSO DIGITALE`,
      html: htmlContent,
    });

    if (result.error) {
      console.error(`[DEMO] Resend error sending to ${data.recipientEmail}:`, result.error);
      return false;
    }

    console.log('[DEMO] Credentials email sent to:', data.recipientEmail);
    return true;
  } catch (error) {
    console.error('[DEMO] Error sending demo email:', error);
    return false;
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startDemoCleanupScheduler() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(async () => {
    const cleaned = await cleanupExpiredDemos();
    if (cleaned > 0) {
      console.log(`[DEMO] Scheduled cleanup removed ${cleaned} expired demo(s)`);
    }
  }, 60 * 60 * 1000);
  console.log('[DEMO] Cleanup scheduler started (every hour)');
}
