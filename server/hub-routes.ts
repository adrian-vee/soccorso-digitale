import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import {
  organizations,
  hubClients,
  hubConventions,
  hubAvailabilitySlots,
  hubAvailabilityOverrides,
  hubServicePricing,
  hubBookings,
  hubNotifications,
  hubDiscountCodes,
  vehicles,
} from "@shared/schema";
import { eq, and, desc, sql, count, gte, lte } from "drizzle-orm";
import { requireAuth, getEffectiveOrgId } from "./auth-middleware";
import { getResendClient } from "./resend-client";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

async function sendHubEmail(to: string, subject: string, html: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({ from: fromEmail, to, subject, html });
  } catch (err) {
    console.error("Hub email send error:", err);
  }
}

declare module "express-session" {
  interface SessionData {
    hubClientId?: string;
    hubClientOrgId?: string;
  }
}

function generateBookingNumber(orgSlug: string): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = crypto.randomInt(1000, 9999);
  return `${orgSlug.toUpperCase().slice(0, 3)}-${y}${m}${d}-${rand}`;
}

export function registerHubRoutes(app: Express) {

  // =============================================
  // PUBLIC HUB ENDPOINTS (no auth required)
  // =============================================

  app.get("/api/hub/directory", async (_req: Request, res: Response) => {
    try {
      const orgs = await db.select({
        name: organizations.name,
        slug: organizations.slug,
      }).from(organizations)
        .where(sql`${organizations.enabledModules}::jsonb @> '["booking_hub"]'::jsonb`);
      res.json(orgs);
    } catch (error) {
      console.error("Hub directory error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/:slug/info", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [org] = await db.select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        city: organizations.city,
        province: organizations.province,
        phone: organizations.phone,
        email: organizations.email,
        website: organizations.website,
        enabledModules: organizations.enabledModules,
      }).from(organizations).where(eq(organizations.slug, slug));

      if (!org) {
        return res.status(404).json({ error: "Organizzazione non trovata" });
      }

      const modules = (org.enabledModules as string[] | null) || [];
      if (!modules.includes("booking_hub")) {
        return res.status(403).json({ error: "Servizio prenotazioni non attivo per questa organizzazione" });
      }

      res.json(org);
    } catch (error) {
      console.error("Hub info error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/:slug/pricing", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const pricing = await db.select().from(hubServicePricing)
        .where(and(eq(hubServicePricing.organizationId, org.id), eq(hubServicePricing.isActive, true)))
        .orderBy(hubServicePricing.sortOrder);

      res.json(pricing);
    } catch (error) {
      console.error("Hub pricing error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/autocomplete", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 3) {
        return res.json([]);
      }
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (googleApiKey) {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&components=country:it&language=it&key=${googleApiKey}`;
          const gRes = await fetch(url, { signal: AbortSignal.timeout(4000) });
          const gData = await gRes.json() as any;
          if (gData.status === "OK" && gData.predictions?.length > 0) {
            return res.json(gData.predictions.map((p: any) => ({
              display: p.description,
              placeId: p.place_id,
            })));
          }
        } catch {}
      }
      const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=it&addressdetails=1&limit=5`;
      const nRes = await fetch(nUrl, {
        headers: { "User-Agent": "SoccorsoDigitale/1.0" },
        signal: AbortSignal.timeout(4000),
      });
      const nData = await nRes.json() as any[];
      res.json(nData.map((r: any) => ({
        display: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
      })));
    } catch (error) {
      console.error("Autocomplete error:", error);
      res.json([]);
    }
  });

  app.post("/api/hub/calculate-route", async (req: Request, res: Response) => {
    try {
      const { originAddress, destinationAddress } = req.body;
      if (!originAddress || !destinationAddress) {
        return res.status(400).json({ error: "Indirizzi richiesti" });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

      async function geocodeAddr(address: string): Promise<{ lat: number; lon: number } | null> {
        if (googleApiKey) {
          try {
            const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=it&language=it&key=${googleApiKey}`;
            const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(5000) });
            const gData = await gRes.json() as any;
            if (gData.status === "OK" && gData.results?.[0]) {
              const loc = gData.results[0].geometry.location;
              return { lat: loc.lat, lon: loc.lng };
            }
          } catch {}
        }
        try {
          const nUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=it`;
          const nRes = await fetch(nUrl, { headers: { "User-Agent": "SoccorsoDigitale/1.0" }, signal: AbortSignal.timeout(5000) });
          const nData = await nRes.json() as any[];
          if (nData.length > 0) {
            return { lat: parseFloat(nData[0].lat), lon: parseFloat(nData[0].lon) };
          }
        } catch {}
        return null;
      }

      const origin = await geocodeAddr(originAddress);
      const dest = await geocodeAddr(destinationAddress);
      if (!origin || !dest) {
        return res.status(400).json({ error: "Impossibile trovare gli indirizzi indicati" });
      }

      let distanceKm = 0;
      let durationMin = 0;
      let geometry: any = null;

      if (googleApiKey) {
        try {
          const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lon}&destination=${dest.lat},${dest.lon}&mode=driving&language=it&region=it&key=${googleApiKey}`;
          const dirRes = await fetch(dirUrl, { signal: AbortSignal.timeout(10000) });
          const dirData = await dirRes.json() as any;
          if (dirData.status === "OK" && dirData.routes?.[0]?.legs?.[0]) {
            const leg = dirData.routes[0].legs[0];
            distanceKm = Math.round((leg.distance.value / 1000) * 10) / 10;
            durationMin = Math.round(leg.duration.value / 60);
            geometry = { polyline: dirData.routes[0].overview_polyline?.points || null };
          }
        } catch (e) {
          console.log("Google Directions fallback to OSRM:", (e as Error).message);
        }
      }

      if (distanceKm === 0) {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`;
          const routeRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
          const routeData = await routeRes.json() as any;
          if (routeData.code === "Ok" && routeData.routes?.[0]) {
            const route = routeData.routes[0];
            distanceKm = Math.round((route.distance / 1000) * 10) / 10;
            durationMin = Math.round(route.duration / 60);
            geometry = route.geometry;
          }
        } catch (e) {
          console.log("OSRM also failed:", (e as Error).message);
        }
      }

      if (distanceKm === 0) {
        const R = 6371;
        const dLat = (dest.lat - origin.lat) * Math.PI / 180;
        const dLon = (dest.lon - origin.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(straightLine * 1.35 * 10) / 10;
        durationMin = Math.round(distanceKm * 1.5);
      }

      res.json({
        distanceKm,
        durationMin,
        originCoords: origin,
        destCoords: dest,
        geometry,
      });
    } catch (error) {
      console.error("Route calculation error:", error);
      res.status(500).json({ error: "Errore nel calcolo del percorso" });
    }
  });

  app.post("/api/hub/:slug/register", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const { clientType, firstName, lastName, email, password, phone, fiscalCode,
        birthDate, gender,
        facilityName, facilityType, facilityVatNumber, facilityAddress,
        facilityCity, facilityProvince, facilityPostalCode, facilityContactPerson,
        facilityPhone, facilityEmail } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: "Nome, cognome, email e password sono obbligatori" });
      }

      const existing = await db.select().from(hubClients)
        .where(and(eq(hubClients.email, email), eq(hubClients.organizationId, org.id)));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Email già registrata" });
      }

      const hashedPassword = hashPassword(password);

      const [client] = await db.insert(hubClients).values({
        organizationId: org.id,
        clientType: clientType || "private",
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone: phone || null,
        birthDate: birthDate || null,
        gender: gender || null,
        fiscalCode: fiscalCode || null,
        facilityName: facilityName || null,
        facilityType: facilityType || null,
        facilityVatNumber: facilityVatNumber || null,
        facilityAddress: facilityAddress || null,
        facilityCity: facilityCity || null,
        facilityProvince: facilityProvince || null,
        facilityPostalCode: facilityPostalCode || null,
        facilityContactPerson: facilityContactPerson || null,
        facilityPhone: facilityPhone || null,
        facilityEmail: facilityEmail || null,
      }).returning();

      req.session.hubClientId = client.id;
      req.session.hubClientOrgId = org.id;

      const { password: _, ...clientWithoutPassword } = client;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Errore del server" });
        }
        res.status(201).json(clientWithoutPassword);
      });
    } catch (error) {
      console.error("Hub register error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/hub/:slug/login", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email e password sono obbligatori" });
      }

      const [client] = await db.select().from(hubClients)
        .where(and(eq(hubClients.email, email), eq(hubClients.organizationId, org.id)));

      if (!client) {
        return res.status(401).json({ error: "Credenziali non valide" });
      }

      if (!client.isActive) {
        return res.status(403).json({ error: "Account disabilitato" });
      }

      const validPassword = verifyPassword(password, client.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenziali non valide" });
      }

      req.session.hubClientId = client.id;
      req.session.hubClientOrgId = org.id;

      const { password: _, ...clientWithoutPassword } = client;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Errore del server" });
        }
        res.json(clientWithoutPassword);
      });
    } catch (error) {
      console.error("Hub login error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/hub/logout", (req: Request, res: Response) => {
    req.session.hubClientId = undefined;
    req.session.hubClientOrgId = undefined;
    res.json({ success: true });
  });

  app.get("/api/hub/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.hubClientId) {
        return res.status(401).json({ error: "Non autenticato" });
      }

      const [client] = await db.select().from(hubClients)
        .where(eq(hubClients.id, req.session.hubClientId));

      if (!client) {
        req.session.hubClientId = undefined;
        return res.status(401).json({ error: "Sessione non valida" });
      }

      const { password: _, ...clientWithoutPassword } = client;
      res.json(clientWithoutPassword);
    } catch (error) {
      console.error("Hub me error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // =============================================
  // HUB CLIENT ENDPOINTS (hub client auth)
  // =============================================

  function requireHubClient(req: Request, res: Response, next: Function) {
    if (!req.session.hubClientId || !req.session.hubClientOrgId) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    next();
  }

  app.get("/api/hub/availability", requireHubClient, async (req: Request, res: Response) => {
    try {
      const orgId = req.session.hubClientOrgId!;
      const { date, month } = req.query;

      const slots = await db.select().from(hubAvailabilitySlots)
        .where(and(eq(hubAvailabilitySlots.organizationId, orgId), eq(hubAvailabilitySlots.isActive, true)));

      let overrides: any[] = [];
      if (month) {
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;
        overrides = await db.select().from(hubAvailabilityOverrides)
          .where(and(
            eq(hubAvailabilityOverrides.organizationId, orgId),
            gte(hubAvailabilityOverrides.date, startDate),
            lte(hubAvailabilityOverrides.date, endDate)
          ));
      } else if (date) {
        overrides = await db.select().from(hubAvailabilityOverrides)
          .where(and(
            eq(hubAvailabilityOverrides.organizationId, orgId),
            eq(hubAvailabilityOverrides.date, date as string)
          ));
      }

      const existingBookings = date ? await db.select({ count: count() }).from(hubBookings)
        .where(and(
          eq(hubBookings.organizationId, orgId),
          eq(hubBookings.requestedDate, date as string),
          sql`${hubBookings.status} NOT IN ('cancelled', 'rejected', 'completed')`
        )) : [];

      res.json({
        slots,
        overrides,
        bookingCount: existingBookings[0]?.count || 0,
      });
    } catch (error) {
      console.error("Hub availability error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/hub/bookings", requireHubClient, async (req: Request, res: Response) => {
    try {
      const orgId = req.session.hubClientOrgId!;
      const clientId = req.session.hubClientId!;

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organizzazione non trovata" });

      const bookingNumber = generateBookingNumber(org.slug);

      const {
        requestedDate, requestedTimeStart, requestedTimeEnd, serviceType,
        patientFirstName, patientLastName, patientFiscalCode, patientPhone,
        patientGender, patientBirthYear, patientNotes, patientBirthDate,
        pickupAddress, pickupCity, pickupNotes,
        dropoffAddress, dropoffCity, dropoffNotes,
        needsWheelchair, needsStretcher, needsOxygen,
        roundTrip, returnTime, clientNotes, conventionId,
        invoiceRequested, invoiceData,
        transportReason, transportDetails,
        companionFirstName, companionLastName, companionPhone,
        floorAssistance, weightSupplement,
        estimatedKm, estimatedCost, estimatedDuration
      } = req.body;

      if (!requestedDate || !requestedTimeStart || !serviceType || !pickupAddress || !dropoffAddress) {
        return res.status(400).json({ error: "Campi obbligatori mancanti: data, orario, tipo servizio, indirizzo partenza e destinazione" });
      }

      const [booking] = await db.insert(hubBookings).values({
        organizationId: orgId,
        clientId,
        conventionId: conventionId || null,
        bookingNumber,
        requestedDate,
        requestedTimeStart,
        requestedTimeEnd: requestedTimeEnd || null,
        serviceType,
        patientFirstName: patientFirstName || null,
        patientLastName: patientLastName || null,
        patientFiscalCode: patientFiscalCode || null,
        patientPhone: patientPhone || null,
        patientGender: patientGender || null,
        patientBirthYear: patientBirthYear || null,
        patientNotes: patientNotes || null,
        pickupAddress,
        pickupCity: pickupCity || null,
        pickupNotes: pickupNotes || null,
        dropoffAddress,
        dropoffCity: dropoffCity || null,
        dropoffNotes: dropoffNotes || null,
        needsWheelchair: needsWheelchair || false,
        needsStretcher: needsStretcher || false,
        needsOxygen: needsOxygen || false,
        roundTrip: roundTrip || false,
        returnTime: returnTime || null,
        clientNotes: clientNotes || null,
        transportReason: transportReason || null,
        transportDetails: transportDetails || null,
        patientBirthDate: patientBirthDate || null,
        companionFirstName: companionFirstName || null,
        companionLastName: companionLastName || null,
        companionPhone: companionPhone || null,
        floorAssistance: floorAssistance || false,
        weightSupplement: weightSupplement || null,
        estimatedKm: estimatedKm || null,
        estimatedCost: estimatedCost || null,
        estimatedDuration: estimatedDuration || null,
        invoiceRequested: invoiceRequested || false,
        invoiceData: invoiceData ? JSON.stringify(invoiceData) : null,
      }).returning();

      try {
        const [client] = await db.select().from(hubClients).where(eq(hubClients.id, clientId));
        if (client?.email) {
          await sendHubEmail(
            client.email,
            `Prenotazione ${bookingNumber} - ${org.name}`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#0066CC,#004C99);padding:24px;text-align:center;border-radius:12px 12px 0 0">
                <h2 style="color:#fff;margin:0;font-size:1.3rem">${org.name}</h2>
                <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:.9rem">Prenotazione Trasporto Sanitario</p>
              </div>
              <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <p>Gentile ${client.firstName} ${client.lastName},</p>
                <p>La sua prenotazione di trasporto sanitario e stata ricevuta con successo.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Numero</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${bookingNumber}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Data</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${requestedDate}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Orario</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${requestedTimeStart}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Partenza</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${pickupAddress}</td></tr>
                  <tr><td style="padding:10px;font-weight:600">Destinazione</td><td style="padding:10px">${dropoffAddress}</td></tr>
                </table>
                <div style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;margin:16px 0">
                  <p style="font-size:1rem;font-weight:600;color:#0066CC;margin:0">In attesa di conferma</p>
                  <p style="font-size:.85rem;color:#64748b;margin:4px 0 0">Ricevera una notifica non appena la prenotazione sara approvata.</p>
                </div>
                <p>Cordiali saluti,<br><strong>${org.name}</strong></p>
              </div>
            </div>`,
          );
        }
      } catch (emailErr) {
        console.error("Hub booking email error:", emailErr);
      }

      res.status(201).json(booking);
    } catch (error) {
      console.error("Hub create booking error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/bookings", requireHubClient, async (req: Request, res: Response) => {
    try {
      const clientId = req.session.hubClientId!;
      const orgId = req.session.hubClientOrgId!;

      const bookings = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.clientId, clientId), eq(hubBookings.organizationId, orgId)))
        .orderBy(desc(hubBookings.createdAt));

      res.json(bookings);
    } catch (error) {
      console.error("Hub bookings list error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/bookings/:id", requireHubClient, async (req: Request, res: Response) => {
    try {
      const clientId = req.session.hubClientId!;
      const { id } = req.params;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.clientId, clientId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });
      res.json(booking);
    } catch (error) {
      console.error("Hub booking detail error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/hub/bookings/:id/cancel", requireHubClient, async (req: Request, res: Response) => {
    try {
      const clientId = req.session.hubClientId!;
      const { id } = req.params;
      const { reason } = req.body;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.clientId, clientId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });

      if (!["pending", "confirmed"].includes(booking.status)) {
        return res.status(400).json({ error: "Non è possibile annullare una prenotazione in questo stato" });
      }

      const [updated] = await db.update(hubBookings)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason || "Annullata dal cliente",
          updatedAt: new Date(),
        })
        .where(eq(hubBookings.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Hub cancel booking error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/hub/bookings/:id/invoice", requireHubClient, async (req: Request, res: Response) => {
    try {
      const clientId = req.session.hubClientId!;
      const { id } = req.params;
      const { invoiceData } = req.body;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.clientId, clientId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });

      const [updated] = await db.update(hubBookings)
        .set({
          invoiceRequested: true,
          invoiceData: JSON.stringify(invoiceData),
          updatedAt: new Date(),
        })
        .where(eq(hubBookings.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Hub invoice request error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/hub/notifications", requireHubClient, async (req: Request, res: Response) => {
    try {
      const clientId = req.session.hubClientId!;
      const notifications = await db.select().from(hubNotifications)
        .where(and(
          eq(hubNotifications.recipientId, clientId),
          eq(hubNotifications.recipientType, "client")
        ))
        .orderBy(desc(hubNotifications.createdAt));

      res.json(notifications);
    } catch (error) {
      console.error("Hub notifications error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/hub/notifications/:id/read", requireHubClient, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await db.update(hubNotifications).set({ isRead: true }).where(eq(hubNotifications.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Hub notification read error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // =============================================
  // ADMIN HUB ENDPOINTS (org admin auth)
  // =============================================

  app.get("/api/admin/hub/bookings", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgIdRaw = getEffectiveOrgId(req);
      if (!orgIdRaw) return res.status(403).json({ error: "Organizzazione non trovata" });
      const orgId = orgIdRaw as string;

      const { status, date } = req.query;
      let conditions = [eq(hubBookings.organizationId, orgId)];

      if (status && status !== "all") {
        conditions.push(eq(hubBookings.status, status as any));
      }
      if (date) {
        conditions.push(eq(hubBookings.requestedDate, date as string));
      }

      const bookings = await db.select().from(hubBookings)
        .where(and(...conditions))
        .orderBy(desc(hubBookings.createdAt));

      const clientIds = [...new Set(bookings.map(b => b.clientId))];
      let clients: any[] = [];
      if (clientIds.length > 0) {
        clients = await db.select({
          id: hubClients.id,
          firstName: hubClients.firstName,
          lastName: hubClients.lastName,
          email: hubClients.email,
          phone: hubClients.phone,
          clientType: hubClients.clientType,
          facilityName: hubClients.facilityName,
        }).from(hubClients)
          .where(sql`${hubClients.id} IN (${sql.raw(clientIds.map(id => `'${id}'`).join(","))})`);
      }

      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const enrichedBookings = bookings.map(b => ({
        ...b,
        client: clientMap[b.clientId] || null,
      }));

      res.json(enrichedBookings);
    } catch (error) {
      console.error("Admin hub bookings error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/bookings/:id/confirm", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { adminNotes, estimatedCost } = req.body;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.organizationId, orgId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });

      const [updated] = await db.update(hubBookings)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          adminNotes: adminNotes || booking.adminNotes,
          estimatedCost: estimatedCost || booking.estimatedCost,
          updatedAt: new Date(),
        })
        .where(eq(hubBookings.id, id))
        .returning();

      await db.insert(hubNotifications).values({
        organizationId: orgId!,
        recipientType: "client",
        recipientId: booking.clientId,
        bookingId: id,
        type: "booking_confirmed",
        title: "Prenotazione Confermata",
        message: `La prenotazione ${booking.bookingNumber} è stata confermata.`,
      });

      try {
        const [client] = await db.select().from(hubClients).where(eq(hubClients.id, booking.clientId));
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId!));
        if (client?.email && org) {
          await sendHubEmail(
            client.email,
            `Prenotazione ${booking.bookingNumber} Confermata - ${org.name}`,
            `<h2>Prenotazione Confermata</h2>
              <p>Gentile ${client.firstName} ${client.lastName},</p>
              <p>La sua prenotazione <strong>${booking.bookingNumber}</strong> è stata confermata.</p>
              <p><strong>Data:</strong> ${booking.requestedDate}<br>
              <strong>Orario:</strong> ${booking.requestedTimeStart}<br>
              <strong>Partenza:</strong> ${booking.pickupAddress}<br>
              <strong>Destinazione:</strong> ${booking.dropoffAddress}</p>
              <p>Cordiali saluti,<br>${org.name}</p>`,
          );
        }
      } catch (emailErr) {
        console.error("Hub confirm email error:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      console.error("Admin hub confirm error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/bookings/:id/reject", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { rejectReason } = req.body;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.organizationId, orgId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });

      const [updated] = await db.update(hubBookings)
        .set({
          status: "rejected",
          rejectReason: rejectReason || "Rifiutata dall'organizzazione",
          updatedAt: new Date(),
        })
        .where(eq(hubBookings.id, id))
        .returning();

      await db.insert(hubNotifications).values({
        organizationId: orgId!,
        recipientType: "client",
        recipientId: booking.clientId,
        bookingId: id,
        type: "booking_rejected",
        title: "Prenotazione Rifiutata",
        message: `La prenotazione ${booking.bookingNumber} è stata rifiutata. Motivo: ${rejectReason || "Non specificato"}`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Admin hub reject error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/bookings/:id/assign", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { vehicleId } = req.body;

      const [booking] = await db.select().from(hubBookings)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.organizationId, orgId)));

      if (!booking) return res.status(404).json({ error: "Prenotazione non trovata" });

      const userId = req.session?.userId || req.tokenUser?.id;

      const [updated] = await db.update(hubBookings)
        .set({
          status: "assigned",
          assignedVehicleId: vehicleId,
          assignedBy: userId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hubBookings.id, id))
        .returning();

      await db.insert(hubNotifications).values({
        organizationId: orgId!,
        recipientType: "client",
        recipientId: booking.clientId,
        bookingId: id,
        type: "booking_assigned",
        title: "Veicolo Assegnato",
        message: `Un veicolo è stato assegnato alla prenotazione ${booking.bookingNumber}. Il servizio è confermato.`,
      });

      try {
        const [client] = await db.select().from(hubClients).where(eq(hubClients.id, booking.clientId));
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        let vehicleCode = vehicleId;
        if (vehicleId) {
          const [veh] = await db.select({ code: vehicles.code, model: vehicles.model }).from(vehicles).where(eq(vehicles.id, vehicleId));
          if (veh) vehicleCode = `${veh.code}${veh.model ? ' - ' + veh.model : ''}`;
        }
        if (client?.email && org) {
          await sendHubEmail(
            client.email,
            `Veicolo Assegnato - ${booking.bookingNumber} - ${org.name}`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#0066CC,#004C99);padding:24px;text-align:center;border-radius:12px 12px 0 0">
                <h2 style="color:#fff;margin:0;font-size:1.3rem">${org.name}</h2>
                <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:.9rem">Veicolo Assegnato alla Prenotazione</p>
              </div>
              <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <p>Gentile ${client.firstName} ${client.lastName},</p>
                <p>Un veicolo e stato assegnato alla sua prenotazione <strong>${booking.bookingNumber}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Veicolo</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${vehicleCode}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Data</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${booking.requestedDate}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Orario</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${booking.requestedTimeStart}</td></tr>
                  <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Partenza</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${booking.pickupAddress}</td></tr>
                  <tr><td style="padding:10px;font-weight:600">Destinazione</td><td style="padding:10px">${booking.dropoffAddress}</td></tr>
                </table>
                <p>Il veicolo sara presso l'indirizzo di partenza all'orario indicato.</p>
                <p>Cordiali saluti,<br><strong>${org.name}</strong></p>
              </div>
            </div>`,
          );
        }
      } catch (emailErr) {
        console.error("Hub assign email error:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      console.error("Admin hub assign error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/bookings/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { status, finalCost } = req.body;

      const validStatuses = ["in_transit", "patient_aboard", "completed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Stato non valido" });
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (status === "in_transit") updateData.startedAt = new Date();
      if (status === "patient_aboard") updateData.patientAboardAt = new Date();
      if (status === "completed") {
        updateData.completedAt = new Date();
        if (finalCost) updateData.finalCost = finalCost;
      }

      const [updated] = await db.update(hubBookings)
        .set(updateData)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.organizationId, orgId)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Prenotazione non trovata" });

      const statusLabels: Record<string, string> = {
        in_transit: "In Viaggio",
        patient_aboard: "Paziente a Bordo",
        completed: "Completato",
      };

      await db.insert(hubNotifications).values({
        organizationId: orgId!,
        recipientType: "client",
        recipientId: updated.clientId,
        bookingId: id,
        type: `booking_${status}`,
        title: `Trasporto: ${statusLabels[status]}`,
        message: `La prenotazione ${updated.bookingNumber} è ora in stato: ${statusLabels[status]}`,
      });

      try {
        const [client] = await db.select().from(hubClients).where(eq(hubClients.id, updated.clientId));
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (client?.email && org) {
          const emailSubjects: Record<string, string> = {
            in_transit: "Veicolo in Arrivo",
            patient_aboard: "Paziente a Bordo",
            completed: "Trasporto Completato",
          };
          await sendHubEmail(
            client.email,
            `${emailSubjects[status] || 'Aggiornamento'} - ${updated.bookingNumber} - ${org.name}`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:linear-gradient(135deg,#0066CC,#004C99);padding:24px;text-align:center;border-radius:12px 12px 0 0">
                <h2 style="color:#fff;margin:0">${org.name}</h2>
              </div>
              <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <p>Gentile ${client.firstName} ${client.lastName},</p>
                <p>Aggiornamento per la prenotazione <strong>${updated.bookingNumber}</strong>:</p>
                <div style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;margin:16px 0">
                  <p style="font-size:1.1rem;font-weight:700;color:#0066CC;margin:0">${statusLabels[status]}</p>
                </div>
                ${status === 'completed' && updated.finalCost ? `<p>Costo finale del servizio: <strong>&euro;${updated.finalCost.toFixed(2)}</strong></p>` : ''}
                <p>Cordiali saluti,<br><strong>${org.name}</strong></p>
              </div>
            </div>`,
          );
        }
      } catch (emailErr) {
        console.error("Hub status email error:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      console.error("Admin hub status update error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Super Admin Hub Analytics - global view across all organizations
  app.get("/api/admin/hub/super-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session?.userRole || req.tokenUser?.role;
      if (userRole !== 'super_admin') {
        return res.status(403).json({ error: "Accesso negato" });
      }

      const allOrgs = await db.select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        enabledModules: organizations.enabledModules,
      }).from(organizations);

      const hubOrgs = allOrgs.filter(o => (o.enabledModules as string[] || []).includes('booking_hub'));

      const [totalBookingsAll] = await db.select({ count: count() }).from(hubBookings);
      const [pendingBookingsAll] = await db.select({ count: count() }).from(hubBookings)
        .where(eq(hubBookings.status, "pending"));
      const [completedBookingsAll] = await db.select({ count: count() }).from(hubBookings)
        .where(eq(hubBookings.status, "completed"));
      const [totalClientsAll] = await db.select({ count: count() }).from(hubClients);
      const [activeConventionsAll] = await db.select({ count: count() }).from(hubConventions)
        .where(eq(hubConventions.status, "active"));
      
      const today = new Date().toISOString().split("T")[0];
      const [todayBookingsAll] = await db.select({ count: count() }).from(hubBookings)
        .where(eq(hubBookings.requestedDate, today));

      const orgStats = [];
      for (const org of hubOrgs) {
        const [orgBookings] = await db.select({ count: count() }).from(hubBookings)
          .where(eq(hubBookings.organizationId, org.id));
        const [orgPending] = await db.select({ count: count() }).from(hubBookings)
          .where(and(eq(hubBookings.organizationId, org.id), eq(hubBookings.status, "pending")));
        const [orgCompleted] = await db.select({ count: count() }).from(hubBookings)
          .where(and(eq(hubBookings.organizationId, org.id), eq(hubBookings.status, "completed")));
        const [orgClients] = await db.select({ count: count() }).from(hubClients)
          .where(eq(hubClients.organizationId, org.id));
        const [orgConventions] = await db.select({ count: count() }).from(hubConventions)
          .where(and(eq(hubConventions.organizationId, org.id), eq(hubConventions.status, "active")));
        const [orgSlots] = await db.select({ count: count() }).from(hubAvailabilitySlots)
          .where(and(eq(hubAvailabilitySlots.organizationId, org.id), eq(hubAvailabilitySlots.isActive, true)));
        const [orgToday] = await db.select({ count: count() }).from(hubBookings)
          .where(and(eq(hubBookings.organizationId, org.id), eq(hubBookings.requestedDate, today)));

        orgStats.push({
          orgId: org.id,
          orgName: org.name,
          orgSlug: org.slug,
          totalBookings: orgBookings?.count || 0,
          pendingBookings: orgPending?.count || 0,
          completedBookings: orgCompleted?.count || 0,
          todayBookings: orgToday?.count || 0,
          totalClients: orgClients?.count || 0,
          activeConventions: orgConventions?.count || 0,
          activeSlots: orgSlots?.count || 0,
        });
      }

      const recentBookings = await db.select({
        id: hubBookings.id,
        bookingNumber: hubBookings.bookingNumber,
        organizationId: hubBookings.organizationId,
        status: hubBookings.status,
        serviceType: hubBookings.serviceType,
        requestedDate: hubBookings.requestedDate,
        requestedTimeStart: hubBookings.requestedTimeStart,
        pickupAddress: hubBookings.pickupAddress,
        dropoffAddress: hubBookings.dropoffAddress,
        createdAt: hubBookings.createdAt,
      }).from(hubBookings)
        .orderBy(desc(hubBookings.createdAt))
        .limit(20);

      const orgMap = Object.fromEntries(allOrgs.map(o => [o.id, o.name]));
      const enrichedBookings = recentBookings.map(b => ({
        ...b,
        orgName: orgMap[b.organizationId] || 'N/A',
      }));

      const allConventions = await db.select({
        id: hubConventions.id,
        organizationId: hubConventions.organizationId,
        name: hubConventions.name,
        status: hubConventions.status,
        hourlyRate: hubConventions.hourlyRate,
        perTripRate: hubConventions.perTripRate,
        monthlyFlatRate: hubConventions.monthlyFlatRate,
        validFrom: hubConventions.validFrom,
        validTo: hubConventions.validTo,
        createdAt: hubConventions.createdAt,
      }).from(hubConventions)
        .orderBy(desc(hubConventions.createdAt));

      const enrichedConventions = allConventions.map(c => ({
        ...c,
        orgName: orgMap[c.organizationId] || 'N/A',
      }));

      res.json({
        global: {
          hubOrgsCount: hubOrgs.length,
          totalOrgsCount: allOrgs.length,
          totalBookings: totalBookingsAll?.count || 0,
          pendingBookings: pendingBookingsAll?.count || 0,
          completedBookings: completedBookingsAll?.count || 0,
          todayBookings: todayBookingsAll?.count || 0,
          totalClients: totalClientsAll?.count || 0,
          activeConventions: activeConventionsAll?.count || 0,
        },
        orgStats,
        recentBookings: enrichedBookings,
        conventions: enrichedConventions,
      });
    } catch (error) {
      console.error("Super admin hub stats error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Availability management
  app.get("/api/admin/hub/availability", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const slots = await db.select().from(hubAvailabilitySlots)
        .where(eq(hubAvailabilitySlots.organizationId, orgId));

      res.json(slots);
    } catch (error) {
      console.error("Admin hub availability error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/availability", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const { dayOfWeek, startTime, endTime, maxBookings, notes } = req.body;

      const [slot] = await db.insert(hubAvailabilitySlots).values({
        organizationId: orgId,
        dayOfWeek,
        startTime,
        endTime,
        maxBookings: maxBookings || 3,
        notes: notes || null,
      }).returning();

      res.status(201).json(slot);
    } catch (error) {
      console.error("Admin hub create slot error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/availability/copy", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const { fromDay, toDays } = req.body;
      if (fromDay === undefined || !toDays || !Array.isArray(toDays) || toDays.length === 0) {
        return res.status(400).json({ error: "Specificare giorno sorgente e giorni destinazione" });
      }

      const sourceSlots = await db.select().from(hubAvailabilitySlots)
        .where(and(eq(hubAvailabilitySlots.organizationId, orgId), eq(hubAvailabilitySlots.dayOfWeek, fromDay)));

      if (sourceSlots.length === 0) {
        return res.status(400).json({ error: "Nessuno slot trovato per il giorno selezionato" });
      }

      const created: any[] = [];
      for (const day of toDays) {
        await db.delete(hubAvailabilitySlots)
          .where(and(eq(hubAvailabilitySlots.organizationId, orgId), eq(hubAvailabilitySlots.dayOfWeek, day)));
        for (const slot of sourceSlots) {
          const [newSlot] = await db.insert(hubAvailabilitySlots).values({
            organizationId: orgId,
            dayOfWeek: day,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxBookings: slot.maxBookings,
            notes: slot.notes,
          }).returning();
          created.push(newSlot);
        }
      }

      res.json({ success: true, copied: created.length, slots: created });
    } catch (error) {
      console.error("Admin hub copy slots error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/admin/hub/availability/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;

      await db.delete(hubAvailabilitySlots)
        .where(and(eq(hubAvailabilitySlots.id, id), eq(hubAvailabilitySlots.organizationId, orgId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Admin hub delete slot error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/availability/overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const { date, isBlocked, startTime, endTime, maxBookings, reason } = req.body;

      const [override] = await db.insert(hubAvailabilityOverrides).values({
        organizationId: orgId,
        date,
        isBlocked: isBlocked || false,
        startTime: startTime || null,
        endTime: endTime || null,
        maxBookings: maxBookings || null,
        reason: reason || null,
      }).returning();

      res.status(201).json(override);
    } catch (error) {
      console.error("Admin hub create override error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.get("/api/admin/hub/availability/overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const overrides = await db.select().from(hubAvailabilityOverrides)
        .where(eq(hubAvailabilityOverrides.organizationId, orgId))
        .orderBy(desc(hubAvailabilityOverrides.date));

      res.json(overrides);
    } catch (error) {
      console.error("Admin hub overrides list error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/admin/hub/availability/overrides/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;

      await db.delete(hubAvailabilityOverrides)
        .where(and(eq(hubAvailabilityOverrides.id, id), eq(hubAvailabilityOverrides.organizationId, orgId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Admin hub delete override error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Clients management
  app.get("/api/admin/hub/clients", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const clients = await db.select({
        id: hubClients.id,
        clientType: hubClients.clientType,
        firstName: hubClients.firstName,
        lastName: hubClients.lastName,
        email: hubClients.email,
        phone: hubClients.phone,
        fiscalCode: hubClients.fiscalCode,
        facilityName: hubClients.facilityName,
        facilityType: hubClients.facilityType,
        isActive: hubClients.isActive,
        isVerified: hubClients.isVerified,
        createdAt: hubClients.createdAt,
      }).from(hubClients)
        .where(eq(hubClients.organizationId, orgId))
        .orderBy(desc(hubClients.createdAt));

      res.json(clients);
    } catch (error) {
      console.error("Admin hub clients error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/clients/:id/toggle", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;

      const [client] = await db.select().from(hubClients)
        .where(and(eq(hubClients.id, id), eq(hubClients.organizationId, orgId)));

      if (!client) return res.status(404).json({ error: "Cliente non trovato" });

      const [updated] = await db.update(hubClients)
        .set({ isActive: !client.isActive, updatedAt: new Date() })
        .where(eq(hubClients.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Admin hub toggle client error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Conventions management
  app.get("/api/admin/hub/conventions", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const conventions = await db.select().from(hubConventions)
        .where(eq(hubConventions.organizationId, orgId))
        .orderBy(desc(hubConventions.createdAt));

      res.json(conventions);
    } catch (error) {
      console.error("Admin hub conventions error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/conventions", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const { clientId, name, description, hourlyRate, perTripRate, monthlyFlatRate,
        maxTripsPerMonth, validFrom, validTo, terms } = req.body;

      const [convention] = await db.insert(hubConventions).values({
        organizationId: orgId,
        clientId,
        name,
        description: description || null,
        hourlyRate: hourlyRate || null,
        perTripRate: perTripRate || null,
        monthlyFlatRate: monthlyFlatRate || null,
        maxTripsPerMonth: maxTripsPerMonth || null,
        validFrom,
        validTo: validTo || null,
        terms: terms || null,
      }).returning();

      res.status(201).json(convention);
    } catch (error) {
      console.error("Admin hub create convention error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/conventions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { status, ...updates } = req.body;

      const updateData: any = { ...updates, updatedAt: new Date() };
      if (status) {
        updateData.status = status;
        if (status === "active") {
          const userId = req.session?.userId || req.tokenUser?.id;
          updateData.approvedBy = userId;
          updateData.approvedAt = new Date();
        }
      }

      const [updated] = await db.update(hubConventions)
        .set(updateData)
        .where(and(eq(hubConventions.id, id), eq(hubConventions.organizationId, orgId)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Convenzione non trovata" });
      res.json(updated);
    } catch (error) {
      console.error("Admin hub update convention error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Service Pricing Management
  app.get("/api/admin/hub/pricing", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const pricing = await db.select().from(hubServicePricing)
        .where(eq(hubServicePricing.organizationId, orgId))
        .orderBy(hubServicePricing.sortOrder);
      res.json(pricing);
    } catch (error) {
      console.error("Admin hub pricing error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/pricing", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const { serviceType, serviceName, serviceDescription, baseFee, perKmRate,
        nightSupplement, holidaySupplement, waitingTimeRate, stretcherSupplement,
        wheelchairSupplement, oxygenSupplement, medicalStaffSupplement,
        roundTripDiscount, minimumCharge, sortOrder } = req.body;
      const [pricing] = await db.insert(hubServicePricing).values({
        organizationId: orgId,
        serviceType, serviceName, serviceDescription: serviceDescription || null,
        baseFee: baseFee || 25, perKmRate: perKmRate || 0.90,
        nightSupplement: nightSupplement || 0, holidaySupplement: holidaySupplement || 0,
        waitingTimeRate: waitingTimeRate || 0, stretcherSupplement: stretcherSupplement || 0,
        wheelchairSupplement: wheelchairSupplement || 0, oxygenSupplement: oxygenSupplement || 0,
        medicalStaffSupplement: medicalStaffSupplement || 0, roundTripDiscount: roundTripDiscount || 0,
        minimumCharge: minimumCharge || 50, sortOrder: sortOrder || 0,
      }).returning();
      res.status(201).json(pricing);
    } catch (error) {
      console.error("Admin hub create pricing error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/pricing/:id", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const [updated] = await db.update(hubServicePricing)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(hubServicePricing.id, id), eq(hubServicePricing.organizationId, orgId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "Tariffario non trovato" });
      res.json(updated);
    } catch (error) {
      console.error("Admin hub update pricing error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/admin/hub/pricing/:id", requireAuth, async (req, res) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      await db.delete(hubServicePricing)
        .where(and(eq(hubServicePricing.id, id), eq(hubServicePricing.organizationId, orgId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Admin hub delete pricing error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Dashboard stats
  app.get("/api/admin/hub/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const today = new Date().toISOString().split("T")[0];

      const [totalBookings] = await db.select({ count: count() }).from(hubBookings)
        .where(eq(hubBookings.organizationId, orgId));

      const [pendingBookings] = await db.select({ count: count() }).from(hubBookings)
        .where(and(eq(hubBookings.organizationId, orgId), eq(hubBookings.status, "pending")));

      const [todayBookings] = await db.select({ count: count() }).from(hubBookings)
        .where(and(eq(hubBookings.organizationId, orgId), eq(hubBookings.requestedDate, today)));

      const [totalClients] = await db.select({ count: count() }).from(hubClients)
        .where(eq(hubClients.organizationId, orgId));

      const [activeConventions] = await db.select({ count: count() }).from(hubConventions)
        .where(and(eq(hubConventions.organizationId, orgId), eq(hubConventions.status, "active")));

      res.json({
        totalBookings: totalBookings?.count || 0,
        pendingBookings: pendingBookings?.count || 0,
        todayBookings: todayBookings?.count || 0,
        totalClients: totalClients?.count || 0,
        activeConventions: activeConventions?.count || 0,
      });
    } catch (error) {
      console.error("Admin hub stats error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Mobile crew endpoints - get assigned bookings
  app.get("/api/hub/crew/missions", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });

      const today = new Date().toISOString().split("T")[0];

      const missions = await db.select().from(hubBookings)
        .where(and(
          eq(hubBookings.organizationId, orgId),
          sql`${hubBookings.status} IN ('assigned', 'in_transit', 'patient_aboard', 'completed')`,
          eq(hubBookings.requestedDate, today)
        ))
        .orderBy(hubBookings.requestedTimeStart);

      const clientIds = [...new Set(missions.map(m => m.clientId))];
      let clients: any[] = [];
      if (clientIds.length > 0) {
        clients = await db.select({
          id: hubClients.id,
          firstName: hubClients.firstName,
          lastName: hubClients.lastName,
          phone: hubClients.phone,
          clientType: hubClients.clientType,
          facilityName: hubClients.facilityName,
        }).from(hubClients)
          .where(sql`${hubClients.id} IN (${sql.raw(clientIds.map(id => `'${id}'`).join(","))})`);
      }

      const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
      const enrichedMissions = missions.map(m => ({
        ...m,
        client: clientMap[m.clientId] || null,
      }));

      res.json(enrichedMissions);
    } catch (error) {
      console.error("Hub crew missions error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/hub/crew/missions/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["in_transit", "patient_aboard", "completed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Stato non valido" });
      }

      const updateData: any = { status, updatedAt: new Date() };
      if (status === "in_transit") updateData.startedAt = new Date();
      if (status === "patient_aboard") updateData.patientAboardAt = new Date();
      if (status === "completed") updateData.completedAt = new Date();

      const [updated] = await db.update(hubBookings)
        .set(updateData)
        .where(and(eq(hubBookings.id, id), eq(hubBookings.organizationId, orgId)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Missione non trovata" });

      const statusLabels: Record<string, string> = {
        in_transit: "In Viaggio verso di te",
        patient_aboard: "Paziente a Bordo",
        completed: "Trasporto Completato",
      };

      await db.insert(hubNotifications).values({
        organizationId: orgId!,
        recipientType: "client",
        recipientId: updated.clientId,
        bookingId: id,
        type: `booking_${status}`,
        title: statusLabels[status],
        message: `La prenotazione ${updated.bookingNumber} - ${statusLabels[status]}`,
      });

      if (status === "in_transit") {
        try {
          const [client] = await db.select().from(hubClients).where(eq(hubClients.id, updated.clientId));
          const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
          if (client?.email && org) {
            await sendHubEmail(
              client.email,
              `Ambulanza in Arrivo - ${updated.bookingNumber} - ${org.name}`,
              `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <div style="background:linear-gradient(135deg,#00A651,#008C45);padding:24px;text-align:center;border-radius:12px 12px 0 0">
                  <h2 style="color:#fff;margin:0;font-size:1.3rem">${org.name}</h2>
                  <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:.9rem">L'ambulanza e in arrivo!</p>
                </div>
                <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                  <p>Gentile ${client.firstName} ${client.lastName},</p>
                  <p>L'ambulanza assegnata alla prenotazione <strong>${updated.bookingNumber}</strong> e <strong>partita</strong> e sta arrivando all'indirizzo di partenza indicato.</p>
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                    <p style="margin:0;font-size:1.1rem;font-weight:700;color:#166534">Ambulanza in viaggio</p>
                    <p style="margin:8px 0 0;color:#15803d;font-size:.9rem">Si prega di essere pronti all'indirizzo indicato</p>
                  </div>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600;width:40%">Prenotazione</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${updated.bookingNumber}</td></tr>
                    <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">Indirizzo ritiro</td><td style="padding:10px;border-bottom:1px solid #e2e8f0">${updated.pickupAddress}</td></tr>
                    <tr><td style="padding:10px;font-weight:600">Destinazione</td><td style="padding:10px">${updated.dropoffAddress}</td></tr>
                  </table>
                  <p>Cordiali saluti,<br><strong>${org.name}</strong></p>
                </div>
              </div>`,
            );
          }
        } catch (emailErr) {
          console.error("Hub in_transit email error:", emailErr);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Hub crew status update error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // ====== DISCOUNT CODES ======

  app.get("/api/admin/hub/discount-codes", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const codes = await db.select().from(hubDiscountCodes)
        .where(eq(hubDiscountCodes.organizationId, orgId))
        .orderBy(desc(hubDiscountCodes.createdAt));
      res.json(codes);
    } catch (error) {
      console.error("Admin hub discount codes error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.post("/api/admin/hub/discount-codes", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      if (!orgId) return res.status(403).json({ error: "Organizzazione non trovata" });
      const { code, description, discountType, discountValue, minKm, maxKm, maxUses, validFrom, validUntil } = req.body;
      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ error: "Codice, tipo e valore sconto sono obbligatori" });
      }
      const existing = await db.select().from(hubDiscountCodes)
        .where(and(eq(hubDiscountCodes.organizationId, orgId), eq(hubDiscountCodes.code, code.toUpperCase())));
      if (existing.length > 0) {
        return res.status(400).json({ error: "Codice sconto gia esistente" });
      }
      const [created] = await db.insert(hubDiscountCodes).values({
        organizationId: orgId,
        code: code.toUpperCase(),
        description: description || null,
        discountType,
        discountValue: String(discountValue),
        minKm: minKm ? String(minKm) : null,
        maxKm: maxKm ? String(maxKm) : null,
        maxUses: maxUses || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Admin hub create discount code error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.put("/api/admin/hub/discount-codes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      const { isActive } = req.body;
      const [updated] = await db.update(hubDiscountCodes)
        .set({ isActive })
        .where(and(eq(hubDiscountCodes.id, id), eq(hubDiscountCodes.organizationId, orgId)))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Admin hub toggle discount code error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  app.delete("/api/admin/hub/discount-codes/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = getEffectiveOrgId(req) as string;
      const { id } = req.params;
      await db.delete(hubDiscountCodes)
        .where(and(eq(hubDiscountCodes.id, id), eq(hubDiscountCodes.organizationId, orgId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Admin hub delete discount code error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });

  // Validate discount code (public - for booking form)
  app.post("/api/hub/validate-discount", requireHubClient, async (req: Request, res: Response) => {
    try {
      const orgId = (req.session as any).hubOrgId;
      const { code, distanceKm } = req.body;
      if (!code) return res.status(400).json({ error: "Codice sconto obbligatorio" });

      const [discount] = await db.select().from(hubDiscountCodes)
        .where(and(
          eq(hubDiscountCodes.organizationId, orgId),
          eq(hubDiscountCodes.code, code.toUpperCase()),
          eq(hubDiscountCodes.isActive, true)
        ));

      if (!discount) return res.status(404).json({ error: "Codice sconto non valido" });

      const now = new Date();
      if (discount.validFrom && now < new Date(discount.validFrom)) {
        return res.status(400).json({ error: "Codice sconto non ancora attivo" });
      }
      if (discount.validUntil && now > new Date(discount.validUntil)) {
        return res.status(400).json({ error: "Codice sconto scaduto" });
      }
      if (discount.maxUses && discount.currentUses >= discount.maxUses) {
        return res.status(400).json({ error: "Codice sconto esaurito" });
      }
      if (discount.minKm && distanceKm < parseFloat(discount.minKm)) {
        return res.status(400).json({ error: `Codice valido per percorsi di almeno ${discount.minKm} km` });
      }
      if (discount.maxKm && distanceKm > parseFloat(discount.maxKm)) {
        return res.status(400).json({ error: `Codice valido per percorsi fino a ${discount.maxKm} km` });
      }

      res.json({
        valid: true,
        code: discount.code,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        description: discount.description,
      });
    } catch (error) {
      console.error("Hub validate discount error:", error);
      res.status(500).json({ error: "Errore del server" });
    }
  });
}
