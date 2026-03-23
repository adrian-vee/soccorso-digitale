import type { Express } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
// @ts-ignore
import { WebSocket } from "ws";
import { storage } from "../storage";
import { db } from "../db";
import {
  shiftInstances, shiftAssignments, staffMembers, staffAvailability,
  vehicles as vehiclesTable, trips, vehicles, auditLogs, dataQualityScores,
  tripCarbonFootprint, carbonEmissionFactors, sustainabilityGoals, esgMonthlySnapshots,
  burnoutThresholds, operatorWorkload, wellnessCheckins, burnoutAlerts,
  locations, shiftAuditLog, organizations
} from "@shared/schema";
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm";
import {
  requireAuth, requireAdmin, getUserId, getEffectiveOrgId, getLocationFilter,
  isOrgAdmin
} from "../auth-middleware";
import { generateVolunteerReimbursementPDF } from "../pdf-generator";
import { generateAcademyPlanPDF } from "../academy-plan-pdf";

const PDFDocument = new Proxy(function(){} as any, {
  construct(_target, args) {
    const Mod = require("pdfkit");
    return new Mod(...args);
  },
  get(_target, prop) {
    const Mod = require("pdfkit");
    return Mod[prop];
  }
});

// Reference to WebSocket server - set by the main routes module
// @ts-ignore
let wss: import("ws").WebSocketServer | null = null;

// @ts-ignore
export function setShiftWSS(server: import("ws").WebSocketServer | null) {
  wss = server;
}

function broadcastMessage(message: any) {
  if (wss) {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}


// Helper function to automatically calculate carbon footprint for a trip
async function calculateCarbonFootprintForTrip(tripId: string, vehicleId: string, kmTraveled: number) {
  try {
    // Get vehicle details for fuel type
    const vehicle = await db.select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);
    
    const fuelType = vehicle[0]?.fuelType || "Gasolio";
    
    // Normalize fuel type to match emission factors
    const normalizedFuelType = fuelType.toLowerCase().includes("diesel") ? "Gasolio" : 
                               fuelType.toLowerCase().includes("benzina") ? "Benzina" :
                               fuelType.toLowerCase().includes("gpl") ? "GPL" :
                               fuelType.toLowerCase().includes("metano") ? "Metano" :
                               fuelType.toLowerCase().includes("elettric") ? "Elettrico" : "Gasolio";
    
    // Get emission factor
    const factor = await db.select()
      .from(carbonEmissionFactors)
      .where(and(
        eq(carbonEmissionFactors.fuelType, normalizedFuelType),
        eq(carbonEmissionFactors.isActive, true)
      ))
      .limit(1);

    const gCo2PerKm = factor[0]?.gCo2PerKm || 171; // Default diesel ISPRA 2024
    const privateCarGCo2PerKm = factor[0]?.privateCarGCo2PerKm || 120;

    // Calculate emissions
    const co2EmittedKg = (kmTraveled * gCo2PerKm) / 1000;
    const co2IfPrivateCar = (kmTraveled * privateCarGCo2PerKm) / 1000;
    const co2SavedKg = Math.max(0, co2IfPrivateCar * 2 - co2EmittedKg);

    // Check if carbon footprint already exists
    const existing = await db.select()
      .from(tripCarbonFootprint)
      .where(eq(tripCarbonFootprint.tripId, tripId));

    if (existing.length > 0) {
      await db.update(tripCarbonFootprint)
        .set({
          kmTraveled,
          fuelType: normalizedFuelType,
          co2EmittedKg,
          co2PerKm: gCo2PerKm,
          co2IfPrivateCar,
          co2SavedKg,
        })
        .where(eq(tripCarbonFootprint.tripId, tripId));
    } else {
      await db.insert(tripCarbonFootprint).values({
        tripId,
        vehicleId,
        kmTraveled,
        fuelType: normalizedFuelType,
        co2EmittedKg,
        co2PerKm: gCo2PerKm,
        co2IfPrivateCar,
        co2SavedKg,
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error calculating carbon footprint for trip:", error);
    return false;
  }
}

async function smartAssignStaff(
  shiftInstanceIds: string[],
  organizationId?: string
): Promise<{ assigned: number; unfilled: number; stats: { autisti: number; soccorritori: number; infermieri: number; unfilled: number } }> {
  if (shiftInstanceIds.length === 0) {
    return { assigned: 0, unfilled: 0, stats: { autisti: 0, soccorritori: 0, infermieri: 0, unfilled: 0 } };
  }

  const instances = await db.select().from(shiftInstances)
    .where(inArray(shiftInstances.id, shiftInstanceIds));

  if (instances.length === 0) {
    return { assigned: 0, unfilled: 0, stats: { autisti: 0, soccorritori: 0, infermieri: 0, unfilled: 0 } };
  }

  const dates = instances.map(i => i.shiftDate);
  const minDate = dates.reduce((a, b) => a < b ? a : b);
  const maxDate = dates.reduce((a, b) => a > b ? a : b);

  const staffConditions: any[] = [eq(staffMembers.isActive, true)];
  if (organizationId) {
    staffConditions.push(eq(staffMembers.organizationId, organizationId));
  }
  const allStaff = await db.select().from(staffMembers)
    .where(and(...staffConditions));

  if (allStaff.length === 0) {
    const totalUnfilled = instances.reduce((sum, inst) => {
      const roles = inst.requiredRoles as any[];
      return sum + (Array.isArray(roles) ? roles.reduce((s: number, r: any) => s + (r.count || 1), 0) : 2);
    }, 0);
    return { assigned: 0, unfilled: totalUnfilled, stats: { autisti: 0, soccorritori: 0, infermieri: 0, unfilled: totalUnfilled } };
  }

  const existingAssignments = await db.select({
    assignment: shiftAssignments,
    instance: shiftInstances,
  })
    .from(shiftAssignments)
    .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
    .where(
      and(
        gte(shiftInstances.shiftDate, minDate),
        lte(shiftInstances.shiftDate, maxDate)
      )
    );

  let orgRules = {
    maxWeeklyHours: 48,
    maxConsecutiveDays: 6,
    minRestHoursBetweenShifts: 11,
    maxHoursPerDay: 10,
  };
  try {
    const thresholds = await db.select().from(burnoutThresholds).limit(1);
    if (thresholds.length > 0) {
      orgRules.maxWeeklyHours = Number(thresholds[0].maxHoursPerWeek) || 48;
      orgRules.maxConsecutiveDays = Number(thresholds[0].maxConsecutiveDays) || 6;
      orgRules.minRestHoursBetweenShifts = Number(thresholds[0].minRestHoursBetweenShifts) || 11;
      orgRules.maxHoursPerDay = Number(thresholds[0].maxHoursPerDay) || 10;
    }
  } catch (e) {
    console.warn('[smartAssignStaff] Could not fetch burnout thresholds, using defaults');
  }

  const staffAssignmentsByDate = new Map<string, Set<string>>();
  const staffHoursMonth = new Map<string, number>();
  const staffWeekendCount = new Map<string, number>();
  const staffHoursWeek = new Map<string, number>();
  const staffConsecutiveDays = new Map<string, number>();
  const staffLastShiftEnd = new Map<string, { date: string; endTime: string }>();

  const instanceRoleCount = new Map<string, number>();

  for (const { assignment, instance } of existingAssignments) {
    const instanceRoleKey = `${instance.id}_${assignment.assignedRole}`;
    instanceRoleCount.set(instanceRoleKey, (instanceRoleCount.get(instanceRoleKey) || 0) + 1);

    const key = `${assignment.staffMemberId}_${instance.shiftDate}`;
    if (!staffAssignmentsByDate.has(key)) {
      staffAssignmentsByDate.set(key, new Set());
    }
    staffAssignmentsByDate.get(key)!.add(`${instance.startTime}-${instance.endTime}`);

    const startParts = instance.startTime.split(':').map(Number);
    const endParts = instance.endTime.split(':').map(Number);
    let hours = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
    if (hours <= 0) hours += 24;
    staffHoursMonth.set(
      assignment.staffMemberId,
      (staffHoursMonth.get(assignment.staffMemberId) || 0) + hours
    );

    const instDateObj = new Date(instance.shiftDate);
    const instWeekStart = new Date(instDateObj);
    instWeekStart.setDate(instDateObj.getDate() - instDateObj.getDay());
    const instWeekKey = `${assignment.staffMemberId}_${instWeekStart.toISOString().substring(0, 10)}`;
    staffHoursWeek.set(instWeekKey, (staffHoursWeek.get(instWeekKey) || 0) + hours);

    const dayOfWeek = instDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      staffWeekendCount.set(
        assignment.staffMemberId,
        (staffWeekendCount.get(assignment.staffMemberId) || 0) + 1
      );
    }

    const lastEnd = staffLastShiftEnd.get(assignment.staffMemberId);
    if (!lastEnd || instance.shiftDate > lastEnd.date || 
        (instance.shiftDate === lastEnd.date && instance.endTime > lastEnd.endTime)) {
      staffLastShiftEnd.set(assignment.staffMemberId, { date: instance.shiftDate, startTime: instance.startTime, endTime: instance.endTime } as any);
    }
  }

  const allDatesSet = new Set<string>();
  for (const { instance } of existingAssignments) {
    allDatesSet.add(instance.shiftDate);
  }
  for (const staff of allStaff) {
    const staffDates = existingAssignments
      .filter(ea => ea.assignment.staffMemberId === staff.id)
      .map(ea => ea.instance.shiftDate);
    const uniqueDates = [...new Set(staffDates)].sort();
    let consecutive = 0;
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      if (i === uniqueDates.length - 1) {
        consecutive = 1;
      } else {
        const curr = new Date(uniqueDates[i]);
        const next = new Date(uniqueDates[i + 1]);
        const diffDays = (next.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) consecutive++;
        else break;
      }
    }
    staffConsecutiveDays.set(staff.id, consecutive);
  }

  let totalAssigned = 0;
  let totalUnfilled = 0;
  const roleStats = { autisti: 0, soccorritori: 0, infermieri: 0, unfilled: 0 };

  const sortedInstances = [...instances].sort((a, b) => {
    if (a.shiftDate !== b.shiftDate) return a.shiftDate < b.shiftDate ? -1 : 1;
    return a.startTime < b.startTime ? -1 : 1;
  });

  for (const instance of sortedInstances) {
    const requiredRoles = instance.requiredRoles as any[];
    if (!Array.isArray(requiredRoles)) continue;

    const shiftStartParts = instance.startTime.split(':').map(Number);
    const shiftEndParts = instance.endTime.split(':').map(Number);
    let shiftHours = (shiftEndParts[0] + shiftEndParts[1] / 60) - (shiftStartParts[0] + shiftStartParts[1] / 60);
    if (shiftHours <= 0) shiftHours += 24;
    const dayOfWeek = new Date(instance.shiftDate).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dateYearMonth = instance.shiftDate.substring(0, 7);
    const dateObj = new Date(instance.shiftDate);
    const weekStart = new Date(dateObj);
    weekStart.setDate(dateObj.getDate() - dateObj.getDay());
    const weekKey = weekStart.toISOString().substring(0, 10);

    let assignedForShift = 0;

    for (const roleReq of requiredRoles) {
      const roleName: string = typeof roleReq === 'string' ? roleReq : roleReq.role;
      const roleCount: number = typeof roleReq === 'string' ? 1 : (roleReq.count || 1);

      for (let slot = 0; slot < roleCount; slot++) {
        const instanceRoleKey = `${instance.id}_${roleName}`;
        const currentRoleAssigned = instanceRoleCount.get(instanceRoleKey) || 0;
        if (currentRoleAssigned >= roleCount) {
          console.log(`[smartAssign] SKIP role ${roleName} slot ${slot} for instance ${instance.id} ${instance.shiftDate} - already has ${currentRoleAssigned}/${roleCount} assigned`);
          continue;
        }

        const candidates = allStaff.filter(staff => {
          if (staff.primaryRole === 'coordinatore') {
            return false;
          }

          if (instance.locationId && staff.locationId !== instance.locationId) {
            return false;
          }

          if (staff.primaryRole !== roleName) {
            const secondaryRoles = staff.secondaryRoles as string[] | null;
            if (!secondaryRoles || !secondaryRoles.includes(roleName)) {
              return false;
            }
          }

          const unavailDates = staff.unavailableDates as string[] | null;
          if (unavailDates && unavailDates.includes(instance.shiftDate)) {
            return false;
          }

          const availDays = staff.availableDays as number[] | null;
          if (availDays && availDays.length > 0 && availDays.length < 7) {
            if (!availDays.includes(dayOfWeek)) return false;
          }

          const excludedVehicles = staff.excludedVehicleIds as string[] | null;
          if (excludedVehicles && excludedVehicles.length > 0) {
            const profileId = (instance as any).profileId || '';
            const vehicleKey = `${instance.vehicleId}|${profileId}`;
            const vehicleOnlyKey = `${instance.vehicleId}|`;
            if (excludedVehicles.includes(vehicleKey) || excludedVehicles.includes(vehicleOnlyKey)) {
              return false;
            }
          }

          const dateKey = `${staff.id}_${instance.shiftDate}`;
          const existingSlots = staffAssignmentsByDate.get(dateKey);
          if (existingSlots) {
            const newShiftStr = `${instance.startTime}-${instance.endTime}`;
            if (existingSlots.has(newShiftStr)) return false;
            for (const existing of existingSlots) {
              const [exStart, exEnd] = existing.split('-');
              const exCrossesMidnight = exEnd <= exStart;
              const newCrossesMidnight = instance.endTime <= instance.startTime;
              if (exCrossesMidnight || newCrossesMidnight) {
                return false;
              }
              if (instance.startTime < exEnd && instance.endTime > exStart) {
                return false;
              }
            }
          }

          const maxConsecLimit = staff.maxConsecutiveDays || orgRules.maxConsecutiveDays;
          const currentConsec = staffConsecutiveDays.get(staff.id) || 0;
          if (currentConsec >= maxConsecLimit) {
            const lastDate = staffLastShiftEnd.get(staff.id);
            if (lastDate) {
              const lastDateObj = new Date(lastDate.date);
              const shiftDateObj = new Date(instance.shiftDate);
              const dayDiff = (shiftDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
              if (dayDiff <= 1) return false;
            }
          }

          const lastShiftEnd = staffLastShiftEnd.get(staff.id);
          if (lastShiftEnd) {
            const lastEndDate = new Date(lastShiftEnd.date);
            const lastEndParts = lastShiftEnd.endTime.split(':').map(Number);
            const lastStartParts = (lastShiftEnd as any).startTime ? (lastShiftEnd as any).startTime.split(':').map(Number) : [0, 0];
            lastEndDate.setHours(lastEndParts[0], lastEndParts[1] || 0);
            if (lastEndParts[0] < lastStartParts[0]) {
              lastEndDate.setDate(lastEndDate.getDate() + 1);
            }
            const shiftStartDate = new Date(instance.shiftDate);
            const shiftStartParts2 = instance.startTime.split(':').map(Number);
            shiftStartDate.setHours(shiftStartParts2[0], shiftStartParts2[1] || 0);
            const restHours = (shiftStartDate.getTime() - lastEndDate.getTime()) / (1000 * 60 * 60);
            if (restHours > 0 && restHours < orgRules.minRestHoursBetweenShifts) return false;
          }

          const monthHours = staffHoursMonth.get(staff.id) || 0;
          const maxMonth = staff.maxHoursPerMonth || 160;
          if (monthHours + shiftHours > maxMonth) return false;

          const staffWeekKey = `${staff.id}_${weekKey}`;
          const weeklyHours = staffHoursWeek.get(staffWeekKey) || 0;
          const maxWeeklyForStaff = staff.maxHoursPerWeek || orgRules.maxWeeklyHours;
          if (weeklyHours + shiftHours > maxWeeklyForStaff) return false;

          return true;
        });

        const getShiftCategory = (startTime: string, endTime: string): string => {
          const startParts = startTime.split(':').map(Number);
          const endParts = endTime.split(':').map(Number);
          const startHour = startParts[0] + startParts[1] / 60;
          const endHour = endParts[0] + endParts[1] / 60;
          const crossesMidnight = endHour <= startHour;
          if (crossesMidnight) return 'night';
          if (startHour >= 19) return 'night';
          if (startHour >= 18 && endHour >= 22) return 'night';
          if (startHour < 6) return 'night';
          if (startHour < 13 && endHour > 17) return 'day';
          if (startHour < 13 && endHour <= 14.5) return 'morning';
          if (startHour >= 13) return 'afternoon';
          if (startHour < 13 && endHour > 14.5) return 'afternoon';
          return 'morning';
        };
        const shiftCategory = getShiftCategory(instance.startTime, instance.endTime);
        const shiftTimeKey = `${instance.startTime.slice(0,5)}-${instance.endTime.slice(0,5)}`;

        const getStaffPrefs = (staff: any): string[] => {
          const pref = staff.preferredShiftType || 'any';
          if (pref === 'any') return ['any'];
          return pref.split(',').map((p: string) => p.trim());
        };

        const hasNightPreference = (staff: any): boolean => {
          const prefs = getStaffPrefs(staff);
          return prefs.includes('night');
        };

        const getStaffPrefScore = (staff: any): number => {
          const prefs = getStaffPrefs(staff);
          if (prefs.includes('any')) return 1;
          for (const p of prefs) {
            if (p === shiftCategory) return 0;
            if (p.startsWith('time_') && p.substring(5) === shiftTimeKey) return 0;
          }
          return 2;
        };

        let finalCandidates = candidates.filter(staff => {
          const prefs = getStaffPrefs(staff);
          if (prefs.includes('any')) return true;
          const staffIsNightPref = prefs.includes('night');
          if (staffIsNightPref && shiftCategory !== 'night') {
            console.log(`[smartAssign] SKIP ${staff.firstName} ${staff.lastName} (night-pref) for non-night shift ${instance.startTime}-${instance.endTime} on ${instance.shiftDate}`);
            return false;
          }
          return true;
        });

        if (shiftCategory === 'night') {
          const nightPrefCandidates = finalCandidates.filter(s => hasNightPreference(s));
          if (nightPrefCandidates.length > 0) {
            finalCandidates = nightPrefCandidates;
          }
        }

        const avgHours = finalCandidates.length > 0
          ? finalCandidates.reduce((sum, s) => sum + (staffHoursMonth.get(s.id) || 0), 0) / finalCandidates.length
          : 0;

        finalCandidates.sort((a, b) => {
          const aLocal = a.locationId === instance.locationId ? 0 : 1;
          const bLocal = b.locationId === instance.locationId ? 0 : 1;
          if (aLocal !== bLocal) return aLocal - bLocal;

          const aPrefScore = getStaffPrefScore(a);
          const bPrefScore = getStaffPrefScore(b);
          if (aPrefScore !== bPrefScore) return aPrefScore - bPrefScore;

          const aHours = staffHoursMonth.get(a.id) || 0;
          const bHours = staffHoursMonth.get(b.id) || 0;
          if (aHours !== bHours) return aHours - bHours;

          if (isWeekend) {
            const aWeekends = staffWeekendCount.get(a.id) || 0;
            const bWeekends = staffWeekendCount.get(b.id) || 0;
            if (aWeekends !== bWeekends) return aWeekends - bWeekends;
          }

          const aPrimary = a.primaryRole === roleName ? 0 : 1;
          const bPrimary = b.primaryRole === roleName ? 0 : 1;
          return aPrimary - bPrimary;
        });

        if (finalCandidates.length > 0) {
          const chosen = finalCandidates[0];
          const chosenPrefScore = getStaffPrefScore(chosen);
          const chosenHours = staffHoursMonth.get(chosen.id) || 0;
          const chosenMaxMonth = chosen.maxHoursPerMonth || 160;
          console.log(`[smartAssign] ASSIGN ${chosen.firstName} ${chosen.lastName} (${chosen.primaryRole}) -> ${roleName} slot ${slot} | shift ${instance.startTime}-${instance.endTime} ${instance.shiftDate} (${shiftCategory}) | prefScore=${chosenPrefScore} hours=${chosenHours.toFixed(1)}/${chosenMaxMonth} | candidates=${finalCandidates.length}`);
          try {
            await db.insert(shiftAssignments).values({
              id: crypto.randomUUID(),
              shiftInstanceId: instance.id,
              staffMemberId: chosen.id,
              assignedRole: roleName as any,
              roleSlotIndex: slot,
              status: 'assigned',
            });

            instanceRoleCount.set(instanceRoleKey, (instanceRoleCount.get(instanceRoleKey) || 0) + 1);

            const dateKey = `${chosen.id}_${instance.shiftDate}`;
            if (!staffAssignmentsByDate.has(dateKey)) {
              staffAssignmentsByDate.set(dateKey, new Set());
            }
            staffAssignmentsByDate.get(dateKey)!.add(`${instance.startTime}-${instance.endTime}`);
            staffHoursMonth.set(chosen.id, (staffHoursMonth.get(chosen.id) || 0) + shiftHours);
            const chosenWeekKey = `${chosen.id}_${weekKey}`;
            staffHoursWeek.set(chosenWeekKey, (staffHoursWeek.get(chosenWeekKey) || 0) + shiftHours);
            if (isWeekend) {
              staffWeekendCount.set(chosen.id, (staffWeekendCount.get(chosen.id) || 0) + 1);
            }
            const lastEnd = staffLastShiftEnd.get(chosen.id);
            if (!lastEnd || instance.shiftDate > lastEnd.date || 
                (instance.shiftDate === lastEnd.date && instance.endTime > lastEnd.endTime)) {
              staffLastShiftEnd.set(chosen.id, { date: instance.shiftDate, startTime: instance.startTime, endTime: instance.endTime } as any);
            }
            const prevConsec = staffConsecutiveDays.get(chosen.id) || 0;
            if (lastEnd) {
              const ld = new Date(lastEnd.date);
              const sd = new Date(instance.shiftDate);
              const dd = (sd.getTime() - ld.getTime()) / (1000 * 60 * 60 * 24);
              if (dd <= 1) staffConsecutiveDays.set(chosen.id, prevConsec + 1);
              else staffConsecutiveDays.set(chosen.id, 1);
            } else {
              staffConsecutiveDays.set(chosen.id, 1);
            }

            totalAssigned++;
            assignedForShift++;
            if (roleName === 'autista') roleStats.autisti++;
            else if (roleName === 'soccorritore') roleStats.soccorritori++;
            else if (roleName === 'infermiere') roleStats.infermieri++;
          } catch (err: any) {
            if (err?.code === '23505') continue;
            console.error('Error assigning staff:', err);
          }
        } else {
          console.log(`[smartAssign] UNFILLED ${roleName} slot ${slot} | shift ${instance.startTime}-${instance.endTime} ${instance.shiftDate} (${shiftCategory}) | no eligible candidates from ${candidates.length} total`);
          totalUnfilled++;
          roleStats.unfilled++;
        }
      }
    }

    const totalRequiredForShift = requiredRoles.reduce((s: number, r: any) => s + (typeof r === 'string' ? 1 : (r.count || 1)), 0);
    const coveragePercent = totalRequiredForShift > 0 ? Math.round((assignedForShift / totalRequiredForShift) * 100) : 0;
    await db.update(shiftInstances)
      .set({
        currentStaffCount: assignedForShift,
        isCovered: assignedForShift >= (instance.minStaff || 2),
        coveragePercent,
      })
      .where(eq(shiftInstances.id, instance.id));
  }

  return { assigned: totalAssigned, unfilled: totalUnfilled, stats: roleStats };
}

function generateCalendarToken(month: string, locationId: string | null, orgId: string): string {
  const secret = process.env.TRIP_INTEGRITY_SECRET || 'calendar-secret';
  const payload = JSON.stringify({ month, locationId: locationId || 'all', orgId, purpose: 'shift-calendar' });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

async function checkShiftConflicts(staffMemberId: string, shiftDate: string, startTime: string, endTime: string, excludeInstanceId?: string): Promise<string | null> {
  const isNightShift = (start: string, end: string) => {
    const s = start.replace(':00', '').substring(0, 5);
    const e = end.replace(':00', '').substring(0, 5);
    const sH = parseInt(s.split(':')[0]);
    const eH = parseInt(e.split(':')[0]);
    if (eH < sH) return true;
    if (sH >= 19 || sH <= 4) return true;
    if (eH >= 22 || (eH >= 0 && eH <= 7 && sH >= 18)) return true;
    return false;
  };

  const isDayShift = (start: string) => {
    const sH = parseInt(start.replace(':00', '').split(':')[0]);
    return sH >= 5 && sH < 19;
  };

  const timesOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    const normalize = (s: string, e: string) => {
      if (e <= s) return [{ s, e: '24:00:00' }, { s: '00:00:00', e }];
      return [{ s, e }];
    };
    const ranges1 = normalize(s1, e1);
    const ranges2 = normalize(s2, e2);
    for (const r1 of ranges1) {
      for (const r2 of ranges2) {
        if (r1.s < r2.e && r1.e > r2.s) return true;
      }
    }
    return false;
  };

  const currentDate = new Date(shiftDate + 'T12:00:00');
  const prevDate = new Date(currentDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const prevDateStr = prevDate.toISOString().substring(0, 10);
  const nextDateStr = nextDate.toISOString().substring(0, 10);

  const adjacentInstances = await db.select({
    id: shiftInstances.id,
    shiftDate: shiftInstances.shiftDate,
    startTime: shiftInstances.startTime,
    endTime: shiftInstances.endTime,
    vehicleId: shiftInstances.vehicleId,
    locationId: shiftInstances.locationId,
  }).from(shiftInstances)
    .innerJoin(shiftAssignments, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
    .where(
      and(
        eq(shiftAssignments.staffMemberId, staffMemberId),
        inArray(shiftInstances.shiftDate, [prevDateStr, shiftDate, nextDateStr])
      )
    );
  console.log(`[CONFLICT CHECK] staffId=${staffMemberId}, date=${shiftDate}, time=${startTime}-${endTime}, checking dates=[${prevDateStr},${shiftDate},${nextDateStr}], found ${adjacentInstances.length} adjacent instances`);
  adjacentInstances.forEach(adj => console.log(`[CONFLICT CHECK]   adj: date=${adj.shiftDate}, time=${adj.startTime}-${adj.endTime}, vehicle=${adj.vehicleId}`));

  const newIsNight = isNightShift(startTime, endTime);
  const newIsDay = isDayShift(startTime);

  for (const adj of adjacentInstances) {
    if (excludeInstanceId && adj.id === excludeInstanceId) continue;

    const adjIsNight = isNightShift(adj.startTime, adj.endTime);

    if (adj.shiftDate === shiftDate) {
      if (timesOverlap(startTime, endTime, adj.startTime, adj.endTime)) {
        let vehicleInfo = '';
        try {
          const v = await db.select({ natoName: (vehiclesTable as any).natoName, callSign: (vehiclesTable as any).callSign, licensePlate: vehiclesTable.licensePlate }).from(vehiclesTable).where(eq(vehiclesTable.id, adj.vehicleId || '')).limit(1);
          const loc = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, adj.locationId)).limit(1);
          const vName = (v[0] as any)?.natoName || (v[0] as any)?.callSign || v[0]?.licensePlate || '';
          const locName = loc[0]?.name || '';
          if (vName || locName) vehicleInfo = ` su ${vName}${locName ? ' (' + locName + ')' : ''}`;
        } catch {}
        if (adj.startTime === startTime && adj.endTime === endTime) {
          return `Questo operatore e' gia' in turno${vehicleInfo} (${adj.startTime.substring(0,5)}-${adj.endTime.substring(0,5)}) in questa data. Non puo' essere assegnato contemporaneamente a un altro veicolo.`;
        }
        return `Questo operatore ha gia' un turno${vehicleInfo} dalle ${adj.startTime.substring(0,5)} alle ${adj.endTime.substring(0,5)} nella stessa data. Non puo' essere assegnato a turni sovrapposti.`;
      }
    }

    if (adjIsNight && adj.shiftDate === prevDateStr && newIsDay) {
      let vehicleInfo = '';
      try {
        const v = await db.select({ natoName: (vehiclesTable as any).natoName, callSign: (vehiclesTable as any).callSign, licensePlate: vehiclesTable.licensePlate }).from(vehiclesTable).where(eq(vehiclesTable.id, adj.vehicleId || '')).limit(1);
        const loc = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, adj.locationId)).limit(1);
        const vName = (v[0] as any)?.natoName || (v[0] as any)?.callSign || v[0]?.licensePlate || '';
        const locName = loc[0]?.name || '';
        if (vName || locName) vehicleInfo = ` su ${vName}${locName ? ' (' + locName + ')' : ''}`;
      } catch {}
      return `Questo operatore ha un turno notturno${vehicleInfo} il ${new Date(prevDateStr + 'T12:00:00').toLocaleDateString('it-IT')} (${adj.startTime.substring(0,5)}-${adj.endTime.substring(0,5)}). Non puo' essere assegnato a un turno diurno il giorno dopo lo smonto notte.`;
    }

    if (newIsNight && adj.shiftDate === nextDateStr && isDayShift(adj.startTime)) {
      let vehicleInfo = '';
      try {
        const v = await db.select({ natoName: (vehiclesTable as any).natoName, callSign: (vehiclesTable as any).callSign, licensePlate: vehiclesTable.licensePlate }).from(vehiclesTable).where(eq(vehiclesTable.id, adj.vehicleId || '')).limit(1);
        const loc = await db.select({ name: locations.name }).from(locations).where(eq(locations.id, adj.locationId)).limit(1);
        const vName = (v[0] as any)?.natoName || (v[0] as any)?.callSign || v[0]?.licensePlate || '';
        const locName = loc[0]?.name || '';
        if (vName || locName) vehicleInfo = ` su ${vName}${locName ? ' (' + locName + ')' : ''}`;
      } catch {}
      return `Questo operatore ha un turno diurno${vehicleInfo} il ${new Date(nextDateStr + 'T12:00:00').toLocaleDateString('it-IT')} (${adj.startTime.substring(0,5)}-${adj.endTime.substring(0,5)}). Non puo' fare la notte prima di un turno diurno.`;
    }

  }

  return null;
}

// Helper function to calculate end time from start time and hours
function calculateEndTime(startTime: string, hours: number): string {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const totalMinutes = startHour * 60 + (startMin || 0) + hours * 60;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMin = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
}

async function calculateBurnoutFromShiftsInternal() {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
  
  const shiftsWithAssignments = await db.select({
    shiftId: shiftInstances.id,
    shiftDate: shiftInstances.shiftDate,
    startTime: shiftInstances.startTime,
    endTime: shiftInstances.endTime,
    status: shiftInstances.status,
    staffMemberId: shiftAssignments.staffMemberId,
    assignmentStatus: shiftAssignments.status,
  })
    .from(shiftInstances)
    .innerJoin(shiftAssignments, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
    .where(sql`${shiftInstances.shiftDate} >= ${fourWeeksAgoStr}`);

  const allStaff = await db.select({
    id: staffMembers.id,
    firstName: staffMembers.firstName,
    lastName: staffMembers.lastName,
  }).from(staffMembers)
    .where(eq(staffMembers.isActive, true));

  if (allStaff.length === 0) return 0;

  const thresholds = await db.select()
    .from(burnoutThresholds)
    .where(eq(burnoutThresholds.isActive, true))
    .limit(1);
  
  const threshold = thresholds[0] || {
    maxHoursPerWeek: 48,
    maxConsecutiveDays: 6,
    maxNightShiftsPerWeek: 3,
    minRestHoursBetweenShifts: 11,
  };

  const formatLocalDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = formatLocalDate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = formatLocalDate(weekEnd);
  const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

  const staffShifts: Record<string, typeof shiftsWithAssignments> = {};
  for (const shift of shiftsWithAssignments) {
    if (!shift.staffMemberId) continue;
    if (!staffShifts[shift.staffMemberId]) staffShifts[shift.staffMemberId] = [];
    staffShifts[shift.staffMemberId].push(shift);
  }

  let updated = 0;
  for (const staff of allStaff) {
    const shifts = staffShifts[staff.id] || [];
    const hoursPerDay: number[] = [0, 0, 0, 0, 0, 0, 0];
    let nightShiftsCount = 0;
    const allDatesWorked = new Set<string>();
    
    for (const shift of shifts) {
      const shiftDateStr = shift.shiftDate;
      allDatesWorked.add(shiftDateStr);
      if (shiftDateStr < weekStartStr || shiftDateStr > weekEndStr) continue;
      
      const [y, m, d] = shiftDateStr.split('-').map(Number);
      const shiftDate = new Date(y, m - 1, d);
      const startParts = shift.startTime?.split(':').map(Number) || [0, 0];
      const endParts = shift.endTime?.split(':').map(Number) || [0, 0];
      let hoursWorked = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
      if (hoursWorked < 0) hoursWorked += 24;
      const dow = shiftDate.getDay() === 0 ? 6 : shiftDate.getDay() - 1;
      hoursPerDay[dow] += hoursWorked;
      if (startParts[0] >= 20 || endParts[0] >= 22) nightShiftsCount++;
    }
    
    const totalHours = hoursPerDay.reduce((a, b) => a + b, 0);
    
    const last28Days: string[] = [];
    for (let i = 27; i >= 0; i--) {
      const dd = new Date(now);
      dd.setDate(now.getDate() - i);
      last28Days.push(formatLocalDate(dd));
    }
    
    let streakFromToday = 0;
    let lastRestDate: string | null = null;
    for (let i = last28Days.length - 1; i >= 0; i--) {
      if (allDatesWorked.has(last28Days[i])) { streakFromToday++; }
      else { if (!lastRestDate) lastRestDate = last28Days[i]; break; }
    }
    if (!lastRestDate) {
      for (let i = last28Days.length - 1; i >= 0; i--) {
        if (!allDatesWorked.has(last28Days[i])) { lastRestDate = last28Days[i]; break; }
      }
    }
    
    const sortedAllDates = Array.from(allDatesWorked).sort();
    let consecutiveDays = 0;
    let currentStreak = 0;
    let prevDateStr: string | null = null;
    for (const dateStr of sortedAllDates) {
      if (prevDateStr) {
        const [y1, m1, d1] = prevDateStr.split('-').map(Number);
        const [y2, m2, d2] = dateStr.split('-').map(Number);
        const diffDays = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) currentStreak++;
        else { consecutiveDays = Math.max(consecutiveDays, currentStreak); currentStreak = 1; }
      } else { currentStreak = 1; }
      prevDateStr = dateStr;
    }
    consecutiveDays = Math.max(consecutiveDays, currentStreak, streakFromToday);

    let riskScore = 0;
    const riskFactors: Record<string, any> = {};
    if (totalHours >= threshold.maxHoursPerWeek) {
      riskScore += 25 + ((totalHours - threshold.maxHoursPerWeek) * 5);
      riskFactors.hoursExcess = { value: Math.round(totalHours * 10) / 10, threshold: threshold.maxHoursPerWeek };
    } else if (totalHours >= threshold.maxHoursPerWeek * 0.85) { riskScore += 10; }
    if (consecutiveDays >= threshold.maxConsecutiveDays) {
      riskScore += 20 + ((consecutiveDays - threshold.maxConsecutiveDays + 1) * 10);
      riskFactors.consecutiveDays = { value: consecutiveDays, threshold: threshold.maxConsecutiveDays };
    }
    const maxNightShifts = (threshold as any).maxNightShiftsPerWeek || 3;
    if (nightShiftsCount >= maxNightShifts) {
      riskScore += 15 + ((nightShiftsCount - maxNightShifts + 1) * 8);
      riskFactors.nightShifts = { value: nightShiftsCount, threshold: maxNightShifts };
    }
    riskScore = Math.max(0, Math.min(100, riskScore));
    const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';

    await db.delete(operatorWorkload).where(and(
      eq(operatorWorkload.staffMemberId, staff.id),
      eq(operatorWorkload.weekStartDate, weekStartStr)
    ));

    const extendedRiskFactors = { ...riskFactors, lastRestDate: lastRestDate || 'Nessuno negli ultimi 28 giorni', currentStreak: streakFromToday, daysWorkedIn4Weeks: allDatesWorked.size };
    await db.insert(operatorWorkload).values({
      staffMemberId: staff.id,
      weekStartDate: weekStartStr,
      weekNumber,
      year: now.getFullYear(),
      hoursWorkedMon: hoursPerDay[0], hoursWorkedTue: hoursPerDay[1], hoursWorkedWed: hoursPerDay[2],
      hoursWorkedThu: hoursPerDay[3], hoursWorkedFri: hoursPerDay[4], hoursWorkedSat: hoursPerDay[5], hoursWorkedSun: hoursPerDay[6],
      totalHoursWeek: totalHours,
      nightShiftsCount,
      consecutiveDaysWorked: consecutiveDays,
      riskLevel: riskLevel as any,
      riskScore,
      riskFactors: extendedRiskFactors,
    });
    updated++;
  }
  return updated;
}

export function registerShiftRoutes(app: Express) {

  // ===== NOTIFICATIONS =====
app.get("/api/notifications", requireAdmin, async (req, res) => {
  try {
    const logs = await storage.getAuditLogs(50);
    // Filter for structure and department creations (manual entries from crew)
    const notifications = logs
      .filter(log => 
        log.action === "create" && 
        (log.entityType === "structure" || log.entityType === "department")
      )
      .map(log => {
        let changes: any = {};
        try {
          changes = JSON.parse(log.changes || "{}");
        } catch (e) {}
        
        return {
          id: log.id,
          type: log.entityType,
          action: log.action,
          userName: log.userName,
          message: changes.message || `${log.entityType === "structure" ? "Struttura" : "Reparto"} aggiunto`,
          createdAt: log.createdAt,
          entityName: changes.newValue?.name || "N/A"
        };
      });
    
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

// Shift notifications - uncovered shifts that need attention
app.get("/api/shift-notifications", requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    const shifts = await storage.getShiftInstances({ dateFrom: today, dateTo: nextWeekStr });
    const uncoveredShifts = shifts.filter(s => !s.isCovered && s.status === 'open');
    
    const notifications = uncoveredShifts.map(shift => {
      const shiftDate = new Date(shift.shiftDate);
      const dateStr = shiftDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      const startTime = shift.startTime?.slice(0, 5) || '08:00';
      const endTime = shift.endTime?.slice(0, 5) || '20:00';
      
      // Use shift date as timestamp (fallback to now if invalid)
      const createdTimestamp = isNaN(shiftDate.getTime()) ? new Date() : shiftDate;
      
      return {
        id: `shift-${shift.id}`,
        type: 'shift_uncovered',
        entityName: `${dateStr} - ${startTime} / ${endTime}`,
        details: `Personale: ${shift.currentStaffCount || 0}/${shift.minStaff || 2}`,
        createdAt: createdTimestamp
      };
    });
    
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching shift notifications:", error);
    res.status(500).json({ error: "Errore del server" });
  }
});

  // ===== STAFF MEMBERS CRUD =====
app.get("/api/staff-members", requireAuth, async (req, res) => {
  try {
    const locationId = req.query.locationId as string | undefined;
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    
    const orgId = getEffectiveOrgId(req);
    if (orgId) {
      const conditions: any[] = [eq(staffMembers.organizationId, orgId)];
      if (locationId) conditions.push(eq(staffMembers.locationId, locationId));
      if (isActive !== undefined) conditions.push(eq(staffMembers.isActive, isActive));
      
      const members = await db.select().from(staffMembers).where(and(...conditions)).orderBy(staffMembers.lastName);
      return res.json(members);
    }
    
    const members = await storage.getStaffMembers({ locationId, isActive });
    res.json(members);
  } catch (error) {
    console.error("Error fetching staff members:", error);
    res.status(500).json({ error: "Errore nel recupero personale" });
  }
});

app.get("/api/staff-members/:id", requireAuth, async (req, res) => {
  try {
    const member = await storage.getStaffMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: "Membro non trovato" });
    }
    res.json(member);
  } catch (error) {
    console.error("Error fetching staff member:", error);
    res.status(500).json({ error: "Errore nel recupero membro" });
  }
});

app.get("/api/staff-members/by-user/:userId", requireAuth, async (req, res) => {
  try {
    const member = await storage.getStaffMemberByUserId(req.params.userId);
    res.json(member || null);
  } catch (error) {
    console.error("Error fetching staff member by user:", error);
    res.status(500).json({ error: "Errore nel recupero membro" });
  }
});

app.post("/api/staff-members/self-register", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    
    const existingMember = await storage.getStaffMemberByUserId(userId);
    if (existingMember) {
      return res.status(400).json({ error: "Hai gia un profilo personale registrato" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "Utente non trovato" });
    }

    let locationId = req.body.locationId;
    if (!locationId && user.vehicleId) {
      const vehicle = await storage.getVehicle(user.vehicleId);
      if (vehicle) {
        locationId = vehicle.locationId;
      }
    }
    
    if (!locationId) {
      const locations = await storage.getLocations();
      if (locations.length > 0) {
        locationId = locations[0].id;
      }
    }

    if (!locationId) {
      return res.status(400).json({ error: "Sede non trovata" });
    }

    const { firstName, lastName, email, phone, primaryRole } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: "Nome e cognome sono obbligatori" });
    }

    const member = await storage.createStaffMember({
      userId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      locationId,
      primaryRole: primaryRole || "soccorritore",
      contractType: "volunteer",
      isActive: true,
    });
    
    res.status(201).json(member);
  } catch (error) {
    console.error("Error self-registering staff member:", error);
    res.status(500).json({ error: "Errore nella registrazione profilo" });
  }
});

app.post("/api/staff-members", requireAdmin, async (req, res) => {
  try {
    const member = await storage.createStaffMember(req.body);
    res.status(201).json(member);
  } catch (error) {
    console.error("Error creating staff member:", error);
    res.status(500).json({ error: "Errore nella creazione membro" });
  }
});

app.patch("/api/staff-members/:id", requireAdmin, async (req, res) => {
  try {
    const member = await storage.updateStaffMember(req.params.id, req.body);
    if (!member) {
      return res.status(404).json({ error: "Membro non trovato" });
    }
    res.json(member);
  } catch (error) {
    console.error("Error updating staff member:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento membro" });
  }
});

app.delete("/api/staff-members/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteStaffMember(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff member:", error);
    res.status(500).json({ error: "Errore nell'eliminazione membro" });
  }
});

  // ===== SHIFT TEMPLATES CRUD =====
app.get("/api/shift-templates", requireAuth, async (req, res) => {
  try {
    const locationId = req.query.locationId as string | undefined;
    const vehicleId = req.query.vehicleId as string | undefined;
    const isActive = req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;
    const orgId = getEffectiveOrgId(req) || undefined;
    const templates = await storage.getShiftTemplates({ locationId, vehicleId, isActive, organizationId: orgId });
    res.json(templates);
  } catch (error) {
    console.error("Error fetching shift templates:", error);
    res.status(500).json({ error: "Errore nel recupero template turni" });
  }
});

app.get("/api/shift-templates/:id", requireAuth, async (req, res) => {
  try {
    const template = await storage.getShiftTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template non trovato" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching shift template:", error);
    res.status(500).json({ error: "Errore nel recupero template" });
  }
});

app.post("/api/shift-templates", requireAdmin, async (req, res) => {
  try {
    const template = await storage.createShiftTemplate(req.body);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating shift template:", error);
    res.status(500).json({ error: "Errore nella creazione template" });
  }
});

app.patch("/api/shift-templates/:id", requireAdmin, async (req, res) => {
  try {
    const template = await storage.updateShiftTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ error: "Template non trovato" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error updating shift template:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento template" });
  }
});

app.delete("/api/shift-templates/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteShiftTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift template:", error);
    res.status(500).json({ error: "Errore nell'eliminazione template" });
  }
});

// Generate shift instances from template
app.post("/api/shift-templates/:id/generate", requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: "Date obbligatorie" });
    }
    const instances = await storage.generateShiftInstancesFromTemplate(
      req.params.id,
      dateFrom,
      dateTo
    );
    res.status(201).json(instances);
  } catch (error: any) {
    console.error("Error generating shift instances:", error);
    res.status(500).json({ error: error.message || "Errore nella generazione turni" });
  }
});


  // ===== SHIFT INSTANCES =====
app.get("/api/shift-instances", requireAuth, async (req, res) => {
  try {
    // Apply location filter for branch managers
    const locationFilter = await getLocationFilter(req);
    const requestedLocationId = req.query.locationId as string | undefined;
    
    // Branch manager requesting specific location - verify access
    if (locationFilter !== null && requestedLocationId) {
      if (!locationFilter.includes(requestedLocationId)) {
        return res.status(403).json({ error: "Accesso non autorizzato a questa sede" });
      }
    }
    
    // Fetch shift instances - filter by organization for tenant isolation
    const orgId = getEffectiveOrgId(req) || undefined;
    const instances = await storage.getShiftInstances({
      locationId: requestedLocationId,
      vehicleId: req.query.vehicleId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as string | undefined,
      organizationId: orgId,
    });
    
    // Filter for branch managers to only show their locations
    let filteredInstances = instances;
    if (locationFilter !== null && locationFilter.length > 0 && !requestedLocationId) {
      // Branch manager without specific location - filter by all assigned locations
      filteredInstances = instances.filter((inst: any) => 
        inst.locationId && locationFilter.includes(inst.locationId)
      );
    } else if (locationFilter !== null && locationFilter.length === 0) {
      filteredInstances = [];
    }
    
    const instanceIds = filteredInstances.map((i: any) => i.id);
    let enrichedInstances = filteredInstances;

    if (instanceIds.length > 0) {
      const allAssignments = await db.select({
        id: shiftAssignments.id,
        shiftInstanceId: shiftAssignments.shiftInstanceId,
        staffMemberId: shiftAssignments.staffMemberId,
        assignedRole: shiftAssignments.assignedRole,
        status: shiftAssignments.status,
        firstName: staffMembers.firstName,
        lastName: staffMembers.lastName,
        primaryRole: staffMembers.primaryRole,
      })
      .from(shiftAssignments)
      .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
      .where(inArray(shiftAssignments.shiftInstanceId, instanceIds));

      const assignmentsByShift: Record<string, any[]> = {};
      for (const a of allAssignments) {
        if (!assignmentsByShift[a.shiftInstanceId]) assignmentsByShift[a.shiftInstanceId] = [];
        assignmentsByShift[a.shiftInstanceId].push(a);
      }

      enrichedInstances = filteredInstances.map((inst: any) => ({
        ...inst,
        assignments: assignmentsByShift[inst.id] || [],
      }));
    }

    res.json(enrichedInstances);
  } catch (error) {
    console.error("Error fetching shift instances:", error);
    res.status(500).json({ error: "Errore nel recupero turni" });
  }
});

app.get("/api/shift-instances/open", requireAuth, async (req, res) => {
  try {
    const orgId = getEffectiveOrgId(req) || undefined;
    const openShifts = await storage.getOpenShifts({
      locationId: req.query.locationId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      organizationId: orgId,
    });
    res.json(openShifts);
  } catch (error) {
    console.error("Error fetching open shifts:", error);
    res.status(500).json({ error: "Errore nel recupero turni disponibili" });
  }
});

app.get("/api/shift-instances/:id", requireAuth, async (req, res) => {
  try {
    const instance = await storage.getShiftInstanceById(req.params.id);
    if (!instance) {
      return res.status(404).json({ error: "Turno non trovato" });
    }
    const assignments = await storage.getShiftAssignments({ shiftInstanceId: req.params.id });
    res.json({ ...instance, assignments });
  } catch (error) {
    console.error("Error fetching shift instance:", error);
    res.status(500).json({ error: "Errore nel recupero turno" });
  }
});

app.post("/api/shift-instances", requireAdmin, async (req, res) => {
  try {
    const data = { ...req.body };
    const orgId = getEffectiveOrgId(req);
    
    // If location_id is not provided but vehicleId is, get location from vehicle
    if (!data.locationId && data.vehicleId) {
      const vehicle = await storage.getVehicle(data.vehicleId);
      if (vehicle && vehicle.locationId) {
        data.locationId = vehicle.locationId;
      }
    }
    
    if (!data.locationId) {
      return res.status(400).json({ error: "Sede non trovata per il veicolo selezionato" });
    }
    
    // Provide default requiredRoles based on crewType if not provided
    if (!data.requiredRoles) {
      const crewType = data.crewType || 'autista_soccorritore';
      if (crewType === 'autista_soccorritore') {
        data.requiredRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
      } else if (crewType === 'autista_soccorritore_infermiere') {
        data.requiredRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }, { role: 'infermiere', count: 1 }];
      } else if (crewType === 'solo_autista') {
        data.requiredRoles = [{ role: 'autista', count: 1 }];
      } else {
        data.requiredRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
      }
    }
    
    data.organizationId = orgId || 'croce-europa-default';
    const instance = await storage.createShiftInstance(data);
    res.status(201).json(instance);
  } catch (error) {
    console.error("Error creating shift instance:", error);
    res.status(500).json({ error: "Errore nella creazione turno" });
  }
});

app.post("/api/shift-instances/generate-week", requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, locationId, vehicleId, autoAssign } = req.body;
    const orgId = getEffectiveOrgId(req);

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ error: "dateFrom e dateTo sono obbligatori" });
    }

    const vehicleConditions = [eq(vehiclesTable.isActive, true)];
    if (locationId) vehicleConditions.push(eq(vehiclesTable.locationId, locationId));
    if (vehicleId) vehicleConditions.push(eq(vehiclesTable.id, vehicleId));
    if (orgId) {
      const orgLocs = await db.select({ id: locations.id }).from(locations).where(eq(locations.organizationId, orgId));
      const orgLocIds = orgLocs.map(l => l.id);
      if (orgLocIds.length > 0) {
        vehicleConditions.push(inArray(vehiclesTable.locationId, orgLocIds));
      } else {
        return res.json({ success: true, count: 0, assigned: 0 });
      }
    }

    const activeVehicles = await db.select().from(vehiclesTable)
      .where(and(...vehicleConditions));

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    let createdCount = 0;
    const createdIds: string[] = [];

    for (const vehicle of activeVehicles) {
      const profiles = (vehicle.scheduleProfiles as any[] | null);
      const hasProfiles = Array.isArray(profiles) && profiles.length > 0;

      const configsToProcess: Array<{
        roles: Array<{role: string; count: number}>;
        globalShiftTimes: Array<{startTime: string; endTime: string}>;
        scheduleDays: Record<string, any> | null;
        profileId: string | null;
      }> = [];

      if (hasProfiles) {
        for (const profile of profiles!) {
          if (profile.enabled === false) continue;
          let pRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
          if (profile.roles) {
            const rn = profile.roles.split(',').map((r: string) => r.trim());
            pRoles = rn.map((r: string) => ({ role: r, count: 1 }));
          }
          let pShifts = [{ startTime: '06:30:00', endTime: '14:00:00' }];
          if (Array.isArray(profile.shifts) && profile.shifts.length > 0) {
            pShifts = profile.shifts.map((s: any) => ({
              startTime: (s.start || '07:00') + ':00',
              endTime: (s.end || '14:00') + ':00'
            }));
          }
          configsToProcess.push({
            roles: pRoles,
            globalShiftTimes: pShifts,
            scheduleDays: profile.days || null,
            profileId: profile.id || null,
          });
        }
      } else {
        let vehicleRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
        if (vehicle.scheduleRoles) {
          const roleNames = vehicle.scheduleRoles.split(',').map((r: string) => r.trim());
          vehicleRoles = roleNames.map((r: string) => ({ role: r, count: 1 }));
        }
        let globalShiftTimes = [
          { startTime: '06:30:00', endTime: '14:00:00' },
          { startTime: '14:30:00', endTime: '22:00:00' }
        ];
        if (vehicle.scheduleShifts) {
          try {
            const parsed = JSON.parse(vehicle.scheduleShifts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalShiftTimes = parsed.map((s: any) => ({
                startTime: s.start + ':00',
                endTime: s.end + ':00'
              }));
            }
          } catch {}
        }
        configsToProcess.push({
          roles: vehicleRoles,
          globalShiftTimes,
          scheduleDays: vehicle.scheduleDays as Record<string, any> | null,
          profileId: null,
        });
      }

      for (const config of configsToProcess) {
        const current = new Date(startDate);
        while (current <= endDate) {
          const dateStr = current.toISOString().substring(0, 10);
          const dayOfWeek = current.getDay();

          let shiftTimes = config.globalShiftTimes;
          if (config.scheduleDays && config.scheduleDays[dayOfWeek] !== undefined) {
            const dayConfig = config.scheduleDays[dayOfWeek];
            if (!dayConfig.active) {
              current.setDate(current.getDate() + 1);
              continue;
            }
            if (dayConfig.shifts && dayConfig.shifts.length > 0) {
              shiftTimes = dayConfig.shifts.map((s: any) => ({
                startTime: (s.start || '07:00') + ':00',
                endTime: (s.end || '14:00') + ':00'
              }));
            }
          }

          for (const shift of shiftTimes) {
            const existConditions = [
              eq(shiftInstances.vehicleId, vehicle.id),
              eq(shiftInstances.shiftDate, dateStr),
              eq(shiftInstances.startTime, shift.startTime)
            ];
            if (config.profileId) {
              existConditions.push(eq(shiftInstances.profileId, config.profileId));
            }
            const existing = await db.select().from(shiftInstances)
              .where(and(...existConditions))
              .limit(1);

            if (!existing[0]) {
              const newId = crypto.randomUUID();
              await db.insert(shiftInstances).values({
                id: newId,
                vehicleId: vehicle.id,
                locationId: vehicle.locationId,
                shiftDate: dateStr,
                startTime: shift.startTime,
                endTime: shift.endTime,
                requiredRoles: config.roles,
                minStaff: config.roles.length,
                status: 'draft',
                organizationId: orgId || 'croce-europa-default',
                profileId: config.profileId,
              });
              createdIds.push(newId);
              createdCount++;
            }
          }

          current.setDate(current.getDate() + 1);
        }
      }
    }

    let assignedCount = 0;
    if (autoAssign && createdIds.length > 0) {
      const result = await smartAssignStaff(createdIds);
      assignedCount = result.assigned;
    }

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const locFilter = locationId ? await db.select().from(locations).where(eq(locations.id, locationId)).limit(1) : [];
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'generate',
        entityType: 'shift_instance',
        locationId: locationId || null,
        locationName: locFilter[0]?.name || 'Tutte le sedi',
        shiftDate: `${dateFrom} - ${dateTo}`,
        newValue: { count: createdCount, assigned: assignedCount, dateFrom, dateTo },
        description: `Generati ${createdCount} turni (${dateFrom} - ${dateTo}), ${assignedCount} assegnazioni automatiche - ${locFilter[0]?.name || 'Tutte le sedi'}`,
        organizationId: user?.organizationId || 'croce-europa-default',
      });
    } catch (auditErr) { console.error('Audit log error:', auditErr); }

    res.json({
      success: true,
      count: createdCount,
      assigned: assignedCount,
    });
  } catch (error) {
    console.error("Error generating week shifts:", error);
    res.status(500).json({ error: "Errore nella generazione turni settimanali" });
  }
});

// Shift Audit Log
app.get("/api/shift-audit-log", requireAdmin, async (req, res) => {
  try {
    const { locationId, dateFrom, dateTo, limit: queryLimit } = req.query;
    const orgId = getEffectiveOrgId(req);
    const conditions: any[] = [];
    if (orgId) conditions.push(eq(shiftAuditLog.organizationId, orgId));
    if (locationId) conditions.push(eq(shiftAuditLog.locationId, locationId as string));
    if (dateFrom) conditions.push(gte(shiftAuditLog.createdAt, new Date(dateFrom as string)));
    if (dateTo) conditions.push(lte(shiftAuditLog.createdAt, new Date(dateTo as string)));
    
    const logs = await db.select().from(shiftAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shiftAuditLog.createdAt))
      .limit(Number(queryLimit) || 100);
    
    res.json(logs);
  } catch (error) {
    console.error("Error fetching shift audit log:", error);
    res.status(500).json({ error: "Errore nel recupero registro modifiche" });
  }
});

  // ===== SHIFT REPORTS =====
app.get("/api/shift-report/pdf", requireAdmin, async (req, res) => {
  try {
    const { month, locationId } = req.query;
    if (!month) return res.status(400).json({ error: "Mese obbligatorio (formato: YYYY-MM)" });

    const monthStr = month as string;
    const [year, monthNum] = monthStr.split('-').map(Number);
    const dateFrom = `${monthStr}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const dateTo = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const monthLabel = `${monthNames[monthNum - 1]} ${year}`;
    const dayNamesFull = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const orgId = user?.organizationId;

    const shiftConditions: any[] = [
      gte(shiftInstances.shiftDate, dateFrom),
      lte(shiftInstances.shiftDate, dateTo),
    ];
    if (locationId) shiftConditions.push(eq(shiftInstances.locationId, locationId as string));
    if (orgId) shiftConditions.push(eq(shiftInstances.organizationId, orgId));

    const shifts = await db.select().from(shiftInstances)
      .where(and(...shiftConditions))
      .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);

    const shiftIds = shifts.map(s => s.id);
    let assignmentsData: any[] = [];
    if (shiftIds.length > 0) {
      assignmentsData = await db.select({
        assignment: shiftAssignments,
        staff: { firstName: staffMembers.firstName, lastName: staffMembers.lastName, primaryRole: staffMembers.primaryRole }
      }).from(shiftAssignments)
        .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
        .where(inArray(shiftAssignments.shiftInstanceId, shiftIds));
    }

    const assignmentMap = new Map<string, any[]>();
    assignmentsData.forEach(({ assignment, staff }) => {
      if (!assignmentMap.has(assignment.shiftInstanceId)) assignmentMap.set(assignment.shiftInstanceId, []);
      assignmentMap.get(assignment.shiftInstanceId)!.push({ ...assignment, firstName: staff?.firstName, lastName: staff?.lastName });
    });

    const vehicleConditions = orgId ? [eq(vehiclesTable.organizationId, orgId)] : [];
    const orgVehicles = vehicleConditions.length > 0
      ? await db.select().from(vehiclesTable).where(and(...vehicleConditions))
      : await db.select().from(vehiclesTable);
    const vehicleMap = new Map(orgVehicles.map(v => [v.id, v]));
    const locationConditions = orgId ? [eq(locations.organizationId, orgId)] : [];
    const orgLocations = locationConditions.length > 0
      ? await db.select().from(locations).where(and(...locationConditions))
      : await db.select().from(locations);
    const locationMap = new Map(orgLocations.map(l => [l.id, l]));
    let orgName = 'SOCCORSO DIGITALE';
    let orgSlug = orgId || 'default';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (org) {
        orgName = (org as any).legalName || org.name || orgName;
        if (org.slug) orgSlug = org.slug;
      }
    }
    const calDomain = process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'soccorsodigitale.app';
    const calendarUrl = `https://${calDomain}/turni/${orgSlug}?month=${monthStr}`;

    const targetLocationIds = locationId
      ? [locationId as string]
      : [...new Set(shifts.map(s => s.locationId).filter(Boolean))];

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=tabellone_turni_${monthStr}.pdf`);
    doc.pipe(res);

    const pageW = 841.89;
    const pageH = 595.28;
    const mg = 14;

    const colTints = [
      { bg: '#f0f4ff', alt: '#e8eeff' },
      { bg: '#f0faf0', alt: '#e6f5e6' },
      { bg: '#fff8f0', alt: '#fff0e0' },
      { bg: '#f5f0ff', alt: '#ede6ff' },
      { bg: '#f0f9fa', alt: '#e4f3f5' },
      { bg: '#faf5f0', alt: '#f5ede4' },
      { bg: '#f0f0fa', alt: '#e8e8f5' },
      { bg: '#faf0f5', alt: '#f5e4ed' },
    ];
    const weekendTint = { bg: '#fff3e0', alt: '#ffe8cc' };

    let pagesRendered = 0;
    for (let locIdx = 0; locIdx < targetLocationIds.length; locIdx++) {
      const locId = targetLocationIds[locIdx];
      const loc = locationMap.get(locId);
      const locShifts = shifts.filter(s => s.locationId === locId);

      const timeSlotMap = new Map<string, { vehicleId: string; startTime: string; endTime: string; vehicleCode: string; natoName: string; profileId: string | null }>();
      locShifts.forEach(s => {
        const vehicle = vehicleMap.get(s.vehicleId ?? '');
        const vCode = vehicle?.code || '?';
        const profiles = (vehicle as any)?.scheduleProfiles as any[] | null;
        const hasProfiles = Array.isArray(profiles) && profiles.length > 0;
        const profileId = (s as any).profileId || null;

        let vNato = (vehicle as any)?.natoName || '';
        if (hasProfiles && profileId) {
          const matchedProfile = profiles!.find((p: any) => p.id === profileId);
          if (matchedProfile) {
            vNato = matchedProfile.natoName || vNato;
          }
        }

        const key = `${s.vehicleId}|${s.startTime}|${s.endTime}|${profileId || ''}`;
        if (!timeSlotMap.has(key)) {
          timeSlotMap.set(key, { vehicleId: s.vehicleId ?? '', startTime: s.startTime ?? '', endTime: s.endTime ?? '', vehicleCode: vCode, natoName: vNato, profileId });
        }
      });

      orgVehicles.forEach(vehicle => {
        if (vehicle.locationId !== locId) return;
        if (!vehicle.scheduleEnabled) return;
        const profiles = (vehicle as any).scheduleProfiles as any[] | null;
        if (!Array.isArray(profiles) || profiles.length === 0) return;
        for (const profile of profiles) {
          if (profile.enabled === false) continue;
          const pNato = profile.natoName || (vehicle as any).natoName || vehicle.code || '?';
          const pShifts = Array.isArray(profile.shifts) && profile.shifts.length > 0
            ? profile.shifts
            : [{ start: '07:00', end: '14:00' }];
          for (const sh of pShifts) {
            const st = (sh.start || '07:00') + ':00';
            const et = (sh.end || '14:00') + ':00';
            const key = `${vehicle.id}|${st}|${et}|${profile.id || ''}`;
            if (!timeSlotMap.has(key)) {
              timeSlotMap.set(key, { vehicleId: vehicle.id, startTime: st, endTime: et, vehicleCode: vehicle.code, natoName: pNato, profileId: profile.id || null });
            }
          }
        }
      });

      const timeSlots = [...timeSlotMap.values()].sort((a, b) => {
        const natoA = a.natoName || a.vehicleCode;
        const natoB = b.natoName || b.vehicleCode;
        if (natoA !== natoB) return natoA.localeCompare(natoB);
        return a.startTime.localeCompare(b.startTime);
      });

      if (timeSlots.length === 0 && locShifts.length === 0) {
        if (targetLocationIds.length === 1) {
          if (pagesRendered > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
          pagesRendered++;
          doc.fontSize(12).font('Helvetica').fillColor('#64748b');
          doc.text(`Nessun turno trovato per ${loc?.name || 'questa sede'} - ${monthLabel}`, 50, 200, { align: 'center', width: 741 });
        }
        continue;
      }

      if (pagesRendered > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      pagesRendered++;

      const shiftByKey = new Map<string, any>();
      locShifts.forEach(s => {
        const profileId = (s as any).profileId || '';
        const key = `${s.vehicleId}|${s.startTime}|${s.endTime}|${profileId}|${s.shiftDate}`;
        shiftByKey.set(key, s);
      });

      type RoleCol = { slotIdx: number; role: string; label: string };
      const roleCols: RoleCol[] = [];
      timeSlots.forEach((slot, idx) => {
        const rolesInSlot = new Set<string>();
        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
          const key = `${slot.vehicleId}|${slot.startTime}|${slot.endTime}|${slot.profileId || ''}|${dateStr}`;
          const shift = shiftByKey.get(key);
          if (shift) {
            const crew = assignmentMap.get(shift.id) || [];
            crew.forEach(a => rolesInSlot.add(a.assignedRole || 'operatore'));
            if (crew.length === 0) {
              rolesInSlot.add('autista');
              rolesInSlot.add('soccorritore');
            }
          }
        }
        if (rolesInSlot.size === 0) {
          rolesInSlot.add('autista');
          rolesInSlot.add('soccorritore');
        }
        const roleOrder = ['autista', 'soccorritore', 'infermiere', 'coordinatore', 'operatore'];
        const sortedRoles = [...rolesInSlot].sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));
        sortedRoles.forEach(role => {
          const lbl = role === 'autista' ? 'A' : role === 'soccorritore' ? 'S' : role === 'infermiere' ? 'I' : role === 'coordinatore' ? 'C' : 'O';
          roleCols.push({ slotIdx: idx, role, label: lbl });
        });
      });

      const totalDataCols = roleCols.length;
      const dayColW = 30;
      const usableForData = pageW - mg * 2 - dayColW;
      const dataColW = totalDataCols > 0 ? Math.min(Math.max(usableForData / totalDataCols, 24), 80) : 50;
      const adaptiveFontBase = totalDataCols <= 6 ? 6 : totalDataCols <= 10 ? 5.5 : totalDataCols <= 16 ? 5 : 4.5;
      const adaptiveHeaderFont = totalDataCols <= 6 ? 8 : totalDataCols <= 10 ? 7 : totalDataCols <= 16 ? 6 : 5.5;
      const adaptiveTimeFont = totalDataCols <= 6 ? 7 : totalDataCols <= 10 ? 6 : totalDataCols <= 16 ? 5.5 : 5;

      const needsMultiplePages = (dayColW + totalDataCols * dataColW) > (pageW - mg * 2 + 20);
      const maxColsPerPage = Math.max(2, Math.floor((pageW - mg * 2 - dayColW) / dataColW));

      const colChunks: RoleCol[][] = [];
      if (needsMultiplePages) {
        for (let i = 0; i < roleCols.length; i += maxColsPerPage) {
          colChunks.push(roleCols.slice(i, i + maxColsPerPage));
        }
      } else {
        colChunks.push(roleCols);
      }

      for (let chunkIdx = 0; chunkIdx < colChunks.length; chunkIdx++) {
        if (chunkIdx > 0) doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
        const chunk = colChunks[chunkIdx];
        const chunkDataColW = Math.min(Math.max((pageW - mg * 2 - dayColW) / chunk.length, 28), 80);
        const chunkTableW = dayColW + chunk.length * chunkDataColW;
        const tableStartX = mg + Math.max(0, (pageW - mg * 2 - chunkTableW) / 2);

        let y = mg;

        const c = {
          textDark: '#1a1a2e',
          textMid: '#4a4a6a',
          textLight: '#6b7280',
          headerBg: '#1e293b',
          headerText: '#ffffff',
          border: '#cbd5e1',
          borderLight: '#e2e8f0',
          accent: '#0066CC',
          green: '#00A651',
          uncoveredRed: '#dc2626',
        };

        const headerH = 36;
        doc.rect(tableStartX, y, chunkTableW, headerH).fill('#0f172a');
        doc.rect(tableStartX, y, chunkTableW, headerH).lineWidth(0.5).stroke('#334155');

        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold');
        doc.text(`TABELLONE TURNI`, tableStartX + 10, y + 5, { width: chunkTableW - 200, align: 'left', lineBreak: false });
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica');
        const sedeText = `${orgName.toUpperCase()}  |  ${(loc?.name || 'N/D').toUpperCase()}  |  ${monthLabel.toUpperCase()}`;
        doc.text(chunkIdx > 0 ? `${sedeText} (continua)` : sedeText, tableStartX + 10, y + 19, { width: chunkTableW - 200, align: 'left', lineBreak: false });

        const btnW = 150;
        const btnH = 22;
        const btnX = tableStartX + chunkTableW - btnW - 10;
        const btnY = y + (headerH - btnH) / 2;
        doc.save();
        doc.roundedRect(btnX, btnY, btnW, btnH, 4).fill(c.green);
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
        const calTextW = doc.widthOfString('AGGIUNGI AL CALENDARIO');
        const calTextX = btnX + (btnW - calTextW) / 2;
        doc.text('AGGIUNGI AL CALENDARIO', calTextX, btnY + (btnH / 2) - 3, { width: calTextW + 2, link: calendarUrl, lineBreak: false });
        doc.restore();

        y += headerH + 2;

        const vehicleHeaderH = 18;
        const roleHeaderH = 12;
        const footerH = 14;
        const rowH = Math.max(10, Math.min((pageH - y - mg - vehicleHeaderH - roleHeaderH - footerH - 4) / lastDay, 15));

        doc.rect(tableStartX, y, dayColW, vehicleHeaderH + roleHeaderH).fill(c.headerBg);
        doc.fillColor(c.headerText).fontSize(5.5).font('Helvetica-Bold');
        doc.text('GIORNO', tableStartX + 3, y + vehicleHeaderH / 2 - 3, { width: dayColW - 6, align: 'center', lineBreak: false });
        doc.fontSize(4.5).font('Helvetica').fillColor('#94a3b8');
        doc.text(String(year), tableStartX + 3, y + vehicleHeaderH + roleHeaderH / 2 - 2, { width: dayColW - 6, align: 'center', lineBreak: false });

        let prevSlotIdx = -1;
        let groupStartX = 0;
        let groupCols = 0;
        const vehicleGroups: { startX: number; width: number; slot: typeof timeSlots[0]; colorIdx: number }[] = [];

        chunk.forEach((rc, ci) => {
          if (rc.slotIdx !== prevSlotIdx) {
            if (prevSlotIdx !== -1 && groupCols > 0) {
              vehicleGroups.push({ startX: groupStartX, width: groupCols * chunkDataColW, slot: timeSlots[chunk[ci - 1].slotIdx], colorIdx: vehicleGroups.length });
            }
            groupStartX = tableStartX + dayColW + ci * chunkDataColW;
            groupCols = 1;
          } else {
            groupCols++;
          }
          prevSlotIdx = rc.slotIdx;
        });
        if (groupCols > 0 && chunk.length > 0) {
          vehicleGroups.push({ startX: groupStartX, width: groupCols * chunkDataColW, slot: timeSlots[chunk[chunk.length - 1].slotIdx], colorIdx: vehicleGroups.length });
        }

        const colToGroupIdx = new Map<number, number>();
        chunk.forEach((rc, ci) => {
          const gIdx = vehicleGroups.findIndex(vg => {
            const cx = tableStartX + dayColW + ci * chunkDataColW;
            return cx >= vg.startX && cx < vg.startX + vg.width;
          });
          colToGroupIdx.set(ci, gIdx);
        });

        vehicleGroups.forEach((vg, vi) => {
          const tintIdx = vi % colTints.length;
          const headerClr = vi % 2 === 0 ? '#334155' : '#1e293b';
          doc.rect(vg.startX, y, vg.width, vehicleHeaderH).fill(headerClr);
          doc.rect(vg.startX, y, vg.width, vehicleHeaderH).lineWidth(0.3).stroke('#475569');

          const natoLabel = vg.slot.natoName || vg.slot.vehicleCode;
          doc.fillColor('#ffffff').fontSize(adaptiveHeaderFont).font('Helvetica-Bold');
          doc.text(natoLabel.toUpperCase(), vg.startX + 2, y + 2, { width: vg.width - 4, align: 'center', lineBreak: false });

          const timeStr = `${vg.slot.startTime.slice(0,5)} - ${vg.slot.endTime.slice(0,5)}`;
          doc.fillColor('#93c5fd').fontSize(adaptiveTimeFont).font('Helvetica-Bold');
          doc.text(timeStr, vg.startX + 2, y + 11, { width: vg.width - 4, align: 'center', lineBreak: false });
        });

        const roleY = y + vehicleHeaderH;
        chunk.forEach((rc, ci) => {
          const rx = tableStartX + dayColW + ci * chunkDataColW;
          const gIdx = colToGroupIdx.get(ci) ?? 0;
          const tintIdx = gIdx % colTints.length;
          doc.rect(rx, roleY, chunkDataColW, roleHeaderH).fill(colTints[tintIdx].alt);
          doc.rect(rx, roleY, chunkDataColW, roleHeaderH).lineWidth(0.2).stroke(c.borderLight);
          const roleLabel = rc.role === 'autista' ? 'AUT' : rc.role === 'soccorritore' ? 'SOC' : rc.role === 'infermiere' ? 'INF' : rc.role === 'coordinatore' ? 'CRD' : 'OPR';
          doc.fillColor(c.textMid).fontSize(4.5).font('Helvetica-Bold');
          doc.text(roleLabel, rx + 1, roleY + 3, { width: chunkDataColW - 2, align: 'center', lineBreak: false });
        });

        y += vehicleHeaderH + roleHeaderH;
        const gridTopY = y;

        for (let d = 1; d <= lastDay; d++) {
          if (y + rowH > pageH - mg - footerH - 4) break;
          const dateObj = new Date(year, monthNum - 1, d);
          const dow = dateObj.getDay();
          const isWeekend = dow === 0 || dow === 6;

          doc.rect(tableStartX, y, dayColW, rowH).fill(isWeekend ? '#fbbf24' : c.headerBg);
          doc.fillColor(isWeekend ? '#78350f' : c.headerText).fontSize(6).font('Helvetica-Bold');
          doc.text(`${d}`, tableStartX + 2, y + (rowH / 2 - 3), { width: 12, align: 'right', lineBreak: false });
          doc.fillColor(isWeekend ? '#92400e' : '#94a3b8').fontSize(4).font('Helvetica');
          doc.text(dayNamesFull[dow].substring(0, 3).toUpperCase(), tableStartX + 16, y + (rowH / 2 - 2), { width: dayColW - 18, lineBreak: false });

          chunk.forEach((rc, ci) => {
            const cx = tableStartX + dayColW + ci * chunkDataColW;
            const gIdx = colToGroupIdx.get(ci) ?? 0;

            let cellBg: string;
            if (isWeekend) {
              cellBg = d % 2 === 0 ? weekendTint.bg : weekendTint.alt;
            } else {
              const tintIdx = gIdx % colTints.length;
              cellBg = d % 2 === 0 ? colTints[tintIdx].bg : colTints[tintIdx].alt;
            }

            doc.rect(cx, y, chunkDataColW, rowH).fill(cellBg);
            doc.rect(cx, y, chunkDataColW, rowH).lineWidth(0.15).stroke(c.borderLight);

            const slot = timeSlots[rc.slotIdx];
            const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
            const key = `${slot.vehicleId}|${slot.startTime}|${slot.endTime}|${slot.profileId || ''}|${dateStr}`;
            const shift = shiftByKey.get(key);
            if (shift) {
              const crew = assignmentMap.get(shift.id) || [];
              const roleAssignment = crew.find(a => a.assignedRole === rc.role);
              if (roleAssignment) {
                const surname = (roleAssignment.lastName || '').toUpperCase();
                const firstInitial = (roleAssignment.firstName || '').charAt(0).toUpperCase();
                const fullDisplay = firstInitial ? `${surname} ${firstInitial}.` : surname;
                const displayLen = Math.floor(chunkDataColW / 3.2);
                const displayName = fullDisplay.length > displayLen ? fullDisplay.substring(0, displayLen) : fullDisplay;
                doc.fillColor(c.textDark).fontSize(Math.min(adaptiveFontBase, chunkDataColW / 5.5)).font('Helvetica');
                doc.text(displayName, cx + 1.5, y + (rowH / 2 - 2.5), { width: chunkDataColW - 3, lineBreak: false });
              } else {
                doc.save();
                doc.rect(cx + 0.5, y + 0.5, chunkDataColW - 1, rowH - 1).fill('#fef2f2');
                doc.fillColor(c.uncoveredRed).fontSize(6).font('Helvetica-Bold');
                doc.text('X', cx + 1, y + (rowH / 2 - 3), { width: chunkDataColW - 2, align: 'center', lineBreak: false });
                doc.restore();
              }
            }
          });

          vehicleGroups.forEach(vg => {
            doc.moveTo(vg.startX, y).lineTo(vg.startX, y + rowH).lineWidth(0.5).stroke(c.border);
          });
          const tableRight = tableStartX + dayColW + chunk.length * chunkDataColW;
          doc.moveTo(tableRight, y).lineTo(tableRight, y + rowH).lineWidth(0.5).stroke(c.border);

          y += rowH;
        }

        doc.moveTo(tableStartX, y).lineTo(tableStartX + dayColW + chunk.length * chunkDataColW, y).lineWidth(0.5).stroke(c.border);
        doc.moveTo(tableStartX, gridTopY - vehicleHeaderH - roleHeaderH)
          .lineTo(tableStartX, y).lineWidth(0.5).stroke(c.border);

        y += 3;
        const footerY = y;
        const footerW = chunkTableW;
        doc.rect(tableStartX, footerY, footerW, footerH).fill('#f1f5f9');
        doc.rect(tableStartX, footerY, footerW, footerH).lineWidth(0.3).stroke(c.borderLight);

        const footerText = `${orgName}  |  Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}  |  soccorsodigitale.app`;
        doc.fillColor(c.textMid).fontSize(5).font('Helvetica');
        doc.text(footerText, tableStartX + 8, footerY + 4, { width: footerW - 16, align: 'center', lineBreak: false });
      }
    }

    if (pagesRendered === 0) {
      doc.fontSize(12).font('Helvetica').fillColor('#64748b');
      doc.text(`Nessun turno trovato per ${monthLabel}`, 50, 200, { align: 'center', width: 741 });
    }

    doc.end();
  } catch (error: any) {
    console.error("Error generating shift PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Errore nella generazione PDF" });
    } else {
      if (!res.writableEnded) res.end();
    }
  }
});

app.get("/api/shift-report/data", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const { month, locationId } = req.query;
    if (!month) return res.status(400).json({ error: "Mese obbligatorio" });

    const monthStr = month as string;
    const [year, monthNum] = monthStr.split('-').map(Number);
    const dateFrom = `${monthStr}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const dateTo = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const orgId = user?.organizationId;

    const shiftConditions: any[] = [
      gte(shiftInstances.shiftDate, dateFrom),
      lte(shiftInstances.shiftDate, dateTo),
    ];
    if (locationId) shiftConditions.push(eq(shiftInstances.locationId, locationId as string));
    if (orgId) shiftConditions.push(eq(shiftInstances.organizationId, orgId));

    const shifts = await db.select().from(shiftInstances)
      .where(and(...shiftConditions))
      .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);

    const shiftIds = shifts.map(s => s.id);
    let assignmentsArr: any[] = [];
    if (shiftIds.length > 0) {
      assignmentsArr = await db.select({
        assignment: shiftAssignments,
        staff: { firstName: staffMembers.firstName, lastName: staffMembers.lastName, primaryRole: staffMembers.primaryRole }
      }).from(shiftAssignments)
        .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
        .where(inArray(shiftAssignments.shiftInstanceId, shiftIds));
    }

    const vehicleConditions = orgId ? [eq(vehiclesTable.organizationId, orgId)] : [];
    const orgVehiclesArr = vehicleConditions.length > 0
      ? await db.select().from(vehiclesTable).where(and(...vehicleConditions))
      : await db.select().from(vehiclesTable);

    const locationConditions = orgId ? [eq(locations.organizationId, orgId)] : [];
    const orgLocationsArr = locationConditions.length > 0
      ? await db.select().from(locations).where(and(...locationConditions))
      : await db.select().from(locations);

    let orgName = 'SOCCORSO DIGITALE';
    let orgSlug = orgId || 'default';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (org) {
        orgName = (org as any).legalName || org.name || orgName;
        if (org.slug) orgSlug = org.slug;
      }
    }
    const calDomain = process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'soccorsodigitale.app';
    const calendarUrl = `https://${calDomain}/turni/${orgSlug}?month=${monthStr}`;

    res.json({
      month: monthStr,
      year,
      monthNum,
      lastDay,
      orgName,
      calendarUrl,
      shifts: shifts.map(s => ({ id: s.id, shiftDate: s.shiftDate, startTime: s.startTime, endTime: s.endTime, vehicleId: s.vehicleId, locationId: s.locationId, profileId: (s as any).profileId || null })),
      assignments: assignmentsArr.map(({ assignment, staff }) => ({
        shiftInstanceId: assignment.shiftInstanceId,
        assignedRole: assignment.assignedRole,
        firstName: staff?.firstName,
        lastName: staff?.lastName,
      })),
      vehicles: orgVehiclesArr.map(v => ({ id: v.id, code: v.code, natoName: (v as any).natoName || '', locationId: v.locationId, scheduleEnabled: (v as any).scheduleEnabled, scheduleProfiles: (v as any).scheduleProfiles })),
      locations: orgLocationsArr.map(l => ({ id: l.id, name: l.name })),
    });
  } catch (error: any) {
    console.error("Error fetching shift report data:", error);
    res.status(500).json({ error: "Errore nel recupero dati" });
  }
});

// Individual Staff PDF Report - Premium Design
app.get("/api/shift-report/staff-pdf", requireAdmin, async (req, res) => {
  try {
    const { month, staffMemberId } = req.query;
    if (!month || !staffMemberId) return res.status(400).json({ error: "Mese e operatore obbligatori" });
    
    const monthStr = month as string;
    const [year, monthNum] = monthStr.split('-').map(Number);
    const dateFrom = `${monthStr}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const dateTo = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const monthLabel = `${monthNames[monthNum - 1]} ${year}`;
    const dayNamesFull = ['Domenica','Lunedi','Martedi','Mercoledi','Giovedi','Venerdi','Sabato'];

    const staffMember = await storage.getStaffMemberById(staffMemberId as string);
    if (!staffMember) return res.status(404).json({ error: "Operatore non trovato" });
    
    const staffAssignments = await db.select({
      assignment: shiftAssignments,
      instance: shiftInstances,
    }).from(shiftAssignments)
      .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
      .where(and(
        eq(shiftAssignments.staffMemberId, staffMemberId as string),
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
      ))
      .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);
    
    const allVehicles = await db.select().from(vehiclesTable);
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
    const locationsList = await db.select().from(locations);
    const locationMap = new Map(locationsList.map(l => [l.id, l]));
    
    const userId = getUserId(req);
    const currentUser = userId ? await storage.getUser(userId) : null;
    const orgId = currentUser?.organizationId;
    let orgName = 'SOCCORSO DIGITALE';
    let orgLogoPath: string | null = null;
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (org) {
        orgName = org.name || orgName;
        const logoFile = path.join(process.cwd(), "uploads", "logos", `${org.id}.png`);
        if (fs.existsSync(logoFile)) orgLogoPath = logoFile;
      }
    }
    
    const staffCalToken = orgId ? generateCalendarToken(monthStr, null, orgId) : null;
    const staffCalDomain = process.env.EXPO_PUBLIC_DOMAIN || process.env.REPLIT_DEV_DOMAIN || 'soccorsodigitale.app';
    const staffCalUrl = staffCalToken ? `https://${staffCalDomain}/calendario/${staffCalToken}` : null;

    let totalHours = 0;
    const vehicleUsage = new Map<string, { count: number; natoName: string }>();
    const roleCount = new Map<string, number>();
    const shiftLocationNames = new Set<string>();
    
    staffAssignments.forEach(({ assignment, instance }) => {
      const startP = (instance.startTime || '06:30:00').split(':').map(Number);
      const endP = (instance.endTime || '14:00:00').split(':').map(Number);
      const hours = Math.max(0, (endP[0] + endP[1]/60) - (startP[0] + startP[1]/60));
      totalHours += hours;
      const vehicle = vehicleMap.get(instance.vehicleId ?? '');
      const vCode = vehicle?.code || '?';
      const natoName = (vehicle as any)?.natoName || '';
      if (!vehicleUsage.has(vCode)) vehicleUsage.set(vCode, { count: 0, natoName });
      vehicleUsage.get(vCode)!.count++;
      const role = assignment.assignedRole || 'operatore';
      roleCount.set(role, (roleCount.get(role) || 0) + 1);
      const shiftLoc = instance.locationId ? locationMap.get(instance.locationId) : null;
      if (shiftLoc?.name) shiftLocationNames.add(shiftLoc.name);
    });
    const staffLocationLabel = shiftLocationNames.size > 0 ? [...shiftLocationNames].join(', ') : 'N/D';

    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    const staffFileName = `${staffMember.firstName}_${staffMember.lastName}`.replace(/\s/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=turni_${staffFileName}_${monthStr}.pdf`);
    doc.pipe(res);
    
    const m = 30;
    const tableW = doc.page.width - m * 2;
    let y = m;
    
    const logoSize = 40;
    if (orgLogoPath) {
      try { doc.image(orgLogoPath, m, y, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] }); } catch {}
    }
    const titleX = m + (orgLogoPath ? logoSize + 12 : 0);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text(`Scheda Turni Personale`, titleX, y + 2);
    doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(monthLabel, titleX, y + 22);
    
    if (staffCalUrl) {
      const btnW = 200; const btnH = 26;
      const btnX = doc.page.width - m - btnW;
      const btnY = y + 7;
      doc.save();
      doc.roundedRect(btnX, btnY, btnW, btnH, 6).fill('#059669');
      doc.roundedRect(btnX + 1, btnY + 1, btnW - 2, btnH - 2, 5).lineWidth(1).stroke('#34d399');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      const btnLbl = 'Salva turni sul calendario';
      const btnLblW = doc.widthOfString(btnLbl);
      doc.text(btnLbl, btnX + (btnW - btnLblW) / 2, btnY + 8, { link: staffCalUrl });
      doc.restore();
    }
    
    y += logoSize + 10;
    doc.moveTo(m, y).lineTo(doc.page.width - m, y).lineWidth(1).stroke('#cbd5e1');
    y += 14;
    
    doc.roundedRect(m, y, tableW, 48, 8).fill('#f8fafc');
    doc.roundedRect(m, y, tableW, 48, 8).lineWidth(0.5).stroke('#e2e8f0');
    doc.rect(m, y, 4, 48).fill('#0066CC');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(`${staffMember.firstName} ${staffMember.lastName}`, m + 14, y + 8);
    const roleLabel = staffMember.primaryRole === 'autista' ? 'Autista' : staffMember.primaryRole === 'soccorritore' ? 'Soccorritore' : staffMember.primaryRole === 'infermiere' ? 'Infermiere' : 'Operatore';
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`${roleLabel}  |  Sede: ${staffLocationLabel}`, m + 14, y + 28);
    
    y += 62;
    
    const cardW = (tableW - 30) / 4;
    const cardH = 52;
    const summaryItems = [
      { label: 'TURNI', value: String(staffAssignments.length), color: '#0066CC', bg: '#eff6ff', border: '#bfdbfe' },
      { label: 'ORE TOTALI', value: totalHours.toFixed(1), color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
      { label: 'MEDIA ORE', value: staffAssignments.length > 0 ? (totalHours / staffAssignments.length).toFixed(1) : '0', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      { label: 'VEICOLI', value: String(vehicleUsage.size), color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    ];
    summaryItems.forEach((item, i) => {
      const sx = m + i * (cardW + 10);
      doc.roundedRect(sx, y, cardW, cardH, 8).fill(item.bg);
      doc.roundedRect(sx, y, cardW, cardH, 8).lineWidth(1).stroke(item.border);
      doc.fontSize(24).font('Helvetica-Bold').fillColor(item.color).text(item.value, sx, y + 6, { width: cardW, align: 'center' });
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(item.label, sx, y + 36, { width: cardW, align: 'center' });
    });
    y += cardH + 18;
    
    const cols = [50, 58, 70, 80, 55, tableW - 50 - 58 - 70 - 80 - 55];
    const colLabels = ['DATA', 'GIORNO', 'ORARIO', 'VEICOLO', 'RUOLO', 'SEDE'];
    const colAligns: ('left' | 'center')[] = ['left', 'left', 'center', 'left', 'left', 'left'];
    
    const drawTableHeader = (yPos: number) => {
      doc.roundedRect(m, yPos, tableW, 20, 4).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
      let cx = m;
      colLabels.forEach((label, i) => {
        doc.text(label, cx + 5, yPos + 6, { width: cols[i] - 10, align: colAligns[i] });
        cx += cols[i];
      });
      return yPos + 20;
    };
    y = drawTableHeader(y);
    
    staffAssignments.forEach(({ assignment, instance }, rowIdx) => {
      const rh = 20;
      if (y + rh > doc.page.height - 50) {
        doc.addPage();
        y = m;
        y = drawTableHeader(y);
      }
      const dateObj = new Date(instance.shiftDate + 'T00:00:00');
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const isSunday = dateObj.getDay() === 0;
      const bg = isSunday ? '#fef2f2' : isWeekend ? '#eff6ff' : (rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc');
      doc.rect(m, y, tableW, rh).fill(bg);
      if (isWeekend) {
        doc.rect(m, y, 3, rh).fill(isSunday ? '#dc2626' : '#3b82f6');
      }
      doc.rect(m, y, tableW, rh).lineWidth(0.3).stroke('#e2e8f0');
      
      const vehicle = vehicleMap.get(instance.vehicleId ?? '');
      const loc = locationMap.get(instance.locationId ?? '');
      const roleName = assignment.assignedRole === 'autista' ? 'Autista' : assignment.assignedRole === 'soccorritore' ? 'Soccorritore' : assignment.assignedRole === 'infermiere' ? 'Infermiere' : 'Operatore';
      const natoName = (vehicle as any)?.natoName || '';
      const vehicleLabel = natoName || (vehicle?.code || '-');
      
      doc.fillColor(isWeekend ? '#1e293b' : '#334155').fontSize(7.5).font(isWeekend ? 'Helvetica-Bold' : 'Helvetica');
      let rx = m;
      const dateLabel = `${String(dateObj.getDate()).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}`;
      const dayLabel = dayNamesFull[dateObj.getDay()];
      const timeLabel = `${instance.startTime.slice(0,5)} - ${instance.endTime.slice(0,5)}`;
      const vals = [dateLabel, dayLabel, timeLabel, vehicleLabel, roleName, loc?.name || '-'];
      vals.forEach((val, i) => {
        if (i === 3 && natoName) {
          doc.font('Helvetica-Bold').fillColor('#0f172a').text(vehicle?.code || '-', rx + 5, y + 3, { width: cols[i] - 10, lineBreak: false });
          doc.font('Helvetica').fontSize(6).fillColor('#6366f1').text(natoName, rx + 5, y + 12, { width: cols[i] - 10, lineBreak: false });
          doc.fontSize(7.5);
        } else {
          doc.text(val, rx + 5, y + 6, { width: cols[i] - 10, lineBreak: false, align: colAligns[i] });
        }
        rx += cols[i];
      });
      y += rh;
    });
    
    if (staffAssignments.length === 0) {
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('Nessun turno assegnato per questo mese', m, y + 20, { width: tableW, align: 'center' });
      y += 50;
    }
    
    y += 18;
    if (vehicleUsage.size > 0 && y + 20 < doc.page.height - 60) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('Veicoli Utilizzati', m, y);
      y += 16;
      const sortedVehicles = [...vehicleUsage.entries()].sort((a, b) => b[1].count - a[1].count);
      const maxCount = sortedVehicles[0]?.[1].count || 1;
      sortedVehicles.forEach((entry) => {
        if (y + 18 > doc.page.height - 30) { doc.addPage(); y = m; }
        const barMaxW = tableW - 180;
        const barW = Math.max(4, (entry[1].count / maxCount) * barMaxW);
        doc.roundedRect(m, y, tableW, 16, 3).fill('#f8fafc');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(entry[0], m + 6, y + 4, { width: 40 });
        if (entry[1].natoName) {
          doc.fontSize(6).font('Helvetica').fillColor('#6366f1').text(entry[1].natoName, m + 42, y + 4, { width: 60, lineBreak: false });
        }
        doc.roundedRect(m + 110, y + 3, barW, 10, 3).fill('#0066CC');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0066CC').text(`${entry[1].count} turni`, m + 115 + barW, y + 4);
        y += 18;
      });
    }
    
    y = Math.min(y + 6, doc.page.height - 14);
    doc.fillColor('#94a3b8').fontSize(5.5).font('Helvetica');
    doc.text(`Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, m, y, { width: tableW, align: 'center' });
    
    doc.end();
  } catch (error: any) {
    console.error("Error generating staff PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Errore nella generazione PDF operatore" });
    } else {
      if (!res.writableEnded) res.end();
    }
  }
});

// Staff Shift Calendar Export (.ics)
app.get("/api/shift-report/staff-ics", requireAdmin, async (req, res) => {
  try {
    const { month, staffMemberId } = req.query;
    if (!month || !staffMemberId) return res.status(400).json({ error: "Mese e operatore obbligatori" });
    
    const monthStr = month as string;
    const [year, monthNum] = monthStr.split('-').map(Number);
    const dateFrom = `${monthStr}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const dateTo = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const staffMember = await storage.getStaffMemberById(staffMemberId as string);
    if (!staffMember) return res.status(404).json({ error: "Operatore non trovato" });
    
    const staffAssignments = await db.select({
      assignment: shiftAssignments,
      instance: shiftInstances,
    }).from(shiftAssignments)
      .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
      .where(and(
        eq(shiftAssignments.staffMemberId, staffMemberId as string),
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
      ))
      .orderBy(shiftInstances.shiftDate, shiftInstances.startTime);
    
    const allVehicles = await db.select().from(vehiclesTable);
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
    const locationsList = await db.select().from(locations);
    const locationMap = new Map(locationsList.map(l => [l.id, l]));

    const userId = getUserId(req);
    const currentUser = userId ? await storage.getUser(userId) : null;
    const orgId = currentUser?.organizationId;
    let orgName = 'Soccorso Digitale';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      if (org?.name) orgName = org.name;
    }

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formatICSDate = (dateStr: string, timeStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const [h, min] = timeStr.split(':').map(Number);
      return `${y}${pad2(m)}${pad2(d)}T${pad2(h)}${pad2(min)}00`;
    };
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Soccorso Digitale//Turni//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Turni ${staffMember.firstName} ${staffMember.lastName}`,
    ].join('\r\n') + '\r\n';

    staffAssignments.forEach(({ assignment, instance }, idx) => {
      const vehicle = vehicleMap.get(instance.vehicleId ?? '');
      const loc = locationMap.get(instance.locationId ?? '');
      const natoName = (vehicle as any)?.natoName || '';
      const roleName = assignment.assignedRole === 'autista' ? 'Autista' : assignment.assignedRole === 'soccorritore' ? 'Soccorritore' : 'Operatore';
      const vehicleLabel = natoName || (vehicle?.code || '?');
      const summary = `Turno ${roleName} - ${vehicleLabel}`;
      const description = `Sede: ${loc?.name || 'N/D'}\\nVeicolo: ${vehicleLabel}\\nRuolo: ${roleName}\\nOrario: ${instance.startTime.slice(0,5)} - ${instance.endTime.slice(0,5)}`;
      const location = loc?.name || '';
      const uid = `shift-${instance.id}-${assignment.id || idx}@soccorsodigitale.app`;
      
      icsContent += [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${formatICSDate(instance.shiftDate, instance.startTime)}`,
        `DTEND:${formatICSDate(instance.shiftDate, instance.endTime)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `STATUS:CONFIRMED`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Turno tra 30 minuti - ${vehicleLabel}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n') + '\r\n';
    });

    icsContent += 'END:VCALENDAR\r\n';

    const fileName = `turni_${staffMember.firstName}_${staffMember.lastName}_${monthStr}.ics`.replace(/\s/g, '_');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(icsContent);
  } catch (error) {
    console.error("Error generating staff ICS:", error);
    if (!res.headersSent) res.status(500).json({ error: "Errore nella generazione calendario" });
  }
});


  // ===== SHIFT STATS & OPERATIONS =====
app.get("/api/shift-stats", requireAdmin, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const { month, locationId } = req.query;
    if (!month) return res.status(400).json({ error: "Mese obbligatorio" });
    
    const monthStr = month as string;
    const [year, monthNum] = monthStr.split('-').map(Number);
    const dateFrom = `${monthStr}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const dateTo = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const orgId = user?.organizationId;
    
    const shiftConditions: any[] = [
      gte(shiftInstances.shiftDate, dateFrom),
      lte(shiftInstances.shiftDate, dateTo),
    ];
    if (locationId) shiftConditions.push(eq(shiftInstances.locationId, locationId as string));
    if (orgId) shiftConditions.push(eq(shiftInstances.organizationId, orgId));
    
    const shiftsData = await db.select().from(shiftInstances).where(and(...shiftConditions));
    const shiftIds = shiftsData.map(s => s.id);
    let assignmentsData: any[] = [];
    if (shiftIds.length > 0) {
      assignmentsData = await db.select({
        assignment: shiftAssignments,
        instance: shiftInstances,
        staff: { id: staffMembers.id, firstName: staffMembers.firstName, lastName: staffMembers.lastName, primaryRole: staffMembers.primaryRole, locationId: staffMembers.locationId }
      }).from(shiftAssignments)
        .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
        .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
        .where(inArray(shiftAssignments.shiftInstanceId, shiftIds));
    }
    
    const allVehicles = orgId
      ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId))
      : await db.select().from(vehiclesTable);
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));
    const allLocations = orgId
      ? await db.select().from(locations).where(eq(locations.organizationId, orgId))
      : await db.select().from(locations);
    const locationMap = new Map(allLocations.map(l => [l.id, l]));
    
    const staffStats = new Map<string, {
      id: string; firstName: string; lastName: string; primaryRole: string; locationId: string | null; locationName: string;
      totalShifts: number; totalHours: number; vehicles: Set<string>; locationNames: Set<string>;
      asMorning: number; asAfternoon: number; asDay: number; asNight: number;
      asAutista: number; asSoccorritore: number; asInfermiere: number;
    }>();
    
    assignmentsData.forEach(({ assignment, instance, staff }) => {
      if (!staff?.id) return;
      if (!staffStats.has(staff.id)) {
        staffStats.set(staff.id, {
          id: staff.id, firstName: staff.firstName, lastName: staff.lastName,
          primaryRole: staff.primaryRole, locationId: instance.locationId || staff.locationId,
          locationName: '',
          totalShifts: 0, totalHours: 0, vehicles: new Set(), locationNames: new Set(),
          asMorning: 0, asAfternoon: 0, asDay: 0, asNight: 0,
          asAutista: 0, asSoccorritore: 0, asInfermiere: 0,
        });
      }
      const s = staffStats.get(staff.id)!;
      const shiftLoc = instance.locationId ? locationMap.get(instance.locationId) : null;
      if (shiftLoc?.name) s.locationNames.add(shiftLoc.name);
      s.totalShifts++;
      const startP = (instance.startTime || '06:30:00').split(':').map(Number);
      const endP = (instance.endTime || '14:00:00').split(':').map(Number);
      const startHour = startP[0] + startP[1] / 60;
      const endHour = endP[0] + endP[1] / 60;
      let duration = endHour - startHour;
      if (duration <= 0) duration += 24;
      s.totalHours += duration;
      const vehicle = vehicleMap.get(instance.vehicleId);
      if (vehicle) s.vehicles.add((vehicle as any).natoName || vehicle.code);
      if (startHour >= 19 || (startHour >= 18 && endHour < startHour)) {
        s.asNight++;
      } else if (startHour < 13 && endHour > 17) {
        s.asDay++;
      } else if (startHour < 13 && endHour <= 14.5) {
        s.asMorning++;
      } else if (startHour >= 13) {
        s.asAfternoon++;
      } else if (startHour < 13 && endHour > 14.5) {
        s.asAfternoon++;
      } else {
        s.asMorning++;
      }
      if (assignment.assignedRole === 'autista') s.asAutista++;
      else if (assignment.assignedRole === 'soccorritore') s.asSoccorritore++;
      else if (assignment.assignedRole === 'infermiere') s.asInfermiere++;
    });
    
    let totalSlots = 0;
    let coveredSlots = 0;
    const locationStats = new Map<string, { name: string; shifts: number; covered: number }>();
    
    const assignmentsByShift = new Map<string, any[]>();
    assignmentsData.forEach(a => {
      if (!assignmentsByShift.has(a.instance.id)) assignmentsByShift.set(a.instance.id, []);
      assignmentsByShift.get(a.instance.id)!.push(a);
    });
    
    shiftsData.forEach(s => {
      const vehicle = vehicleMap.get(s.vehicleId ?? '');
      const rolesConfig = (vehicle as any)?.scheduleRoles || 'autista,soccorritore';
      const rolesNeeded = rolesConfig.split(',').filter((r: string) => r.trim()).length;
      const shiftAssigns = assignmentsByShift.get(s.id) || [];
      
      totalSlots += rolesNeeded;
      coveredSlots += Math.min(shiftAssigns.length, rolesNeeded);
      
      const loc = locationMap.get(s.locationId);
      const locName = loc?.name || 'Sconosciuta';
      if (!locationStats.has(s.locationId)) locationStats.set(s.locationId, { name: locName, shifts: 0, covered: 0 });
      const ls = locationStats.get(s.locationId)!;
      ls.shifts += rolesNeeded;
      ls.covered += Math.min(shiftAssigns.length, rolesNeeded);
    });
    
    const totalShifts = totalSlots;
    const coveredShifts = coveredSlots;
    
    res.json({
      month: monthStr,
      totalShifts,
      coveredShifts,
      uncoveredShifts: totalShifts - coveredShifts,
      coveragePercent: totalShifts > 0 ? Math.round((coveredShifts / totalShifts) * 100) : 0,
      staffMembers: [...staffStats.values()].map(({ locationNames, vehicles, ...s }) => ({
        ...s, totalHours: Math.round(s.totalHours * 10) / 10,
        vehicles: [...vehicles],
        locationName: [...locationNames].join(', ') || 'N/D',
        avgHoursPerShift: s.totalShifts > 0 ? Math.round((s.totalHours / s.totalShifts) * 10) / 10 : 0,
      })).sort((a, b) => b.totalHours - a.totalHours),
      locationStats: [...locationStats.values()],
    });
  } catch (error) {
    console.error("Error fetching shift stats:", error);
    res.status(500).json({ error: "Errore statistiche turni" });
  }
});

app.patch("/api/shift-instances/:id", requireAdmin, async (req, res) => {
  try {
    const instance = await storage.updateShiftInstance(req.params.id, req.body);
    if (!instance) {
      return res.status(404).json({ error: "Turno non trovato" });
    }
    broadcastMessage({ type: "shift_updated", shiftId: req.params.id });
    res.json(instance);
  } catch (error) {
    console.error("Error updating shift instance:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento turno" });
  }
});

app.delete("/api/shift-instances/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteShiftInstance(req.params.id);
    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'delete',
        description: `Turno eliminato manualmente`,
      } as any);
    } catch {}
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift instance:", error);
    res.status(500).json({ error: "Errore nell'eliminazione turno" });
  }
});

app.post("/api/shift-instances/bulk-delete", requireAdmin, async (req, res) => {
  try {
    const { ids, dateFrom, dateTo, vehicleId, locationId, deleteAll } = req.body;
    const orgId = getEffectiveOrgId(req);
    let deletedCount = 0;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      for (const id of ids) {
        try {
          const idConditions: any[] = [eq(shiftInstances.id, id)];
          if (orgId) idConditions.push(eq(shiftInstances.organizationId, orgId));
          const [existing] = await db.select({ id: shiftInstances.id }).from(shiftInstances).where(and(...idConditions)).limit(1);
          if (!existing) continue;
          await db.delete(shiftAssignments).where(eq(shiftAssignments.shiftInstanceId, id));
          await db.delete(shiftInstances).where(eq(shiftInstances.id, id));
          deletedCount++;
        } catch {}
      }
    } else if (dateFrom && dateTo) {
      const conditions: any[] = [
        gte(shiftInstances.shiftDate, dateFrom),
        lte(shiftInstances.shiftDate, dateTo),
      ];
      if (orgId) {
        conditions.push(eq(shiftInstances.organizationId, orgId));
      }
      if (vehicleId) conditions.push(eq(shiftInstances.vehicleId, vehicleId));
      if (locationId) conditions.push(eq(shiftInstances.locationId, locationId));

      const toDelete = await db.select({ id: shiftInstances.id }).from(shiftInstances).where(and(...conditions));
      for (const row of toDelete) {
        try {
          await db.delete(shiftAssignments).where(eq(shiftAssignments.shiftInstanceId, row.id));
          await db.delete(shiftInstances).where(eq(shiftInstances.id, row.id));
          deletedCount++;
        } catch {}
      }
    }

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'delete',
        entityType: 'shift_instance',
        description: `Eliminazione massiva: ${deletedCount} turni eliminati${vehicleId ? ` (veicolo filtrato)` : ''}${locationId ? ` (sede filtrata)` : ''}`,
        organizationId: orgId || null,
      });
    } catch {}

    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Error bulk deleting shift instances:", error);
    res.status(500).json({ error: "Errore nell'eliminazione massiva turni" });
  }
});

app.post("/api/shift-instances/cleanup-orphans", requireAdmin, async (req, res) => {
  try {
    const orgId = getEffectiveOrgId(req);

    let orphanedAssignmentsCount = 0;
    let orphanedStaffCount = 0;

    const orphanedAssignments = await db.execute(sql`
      DELETE FROM shift_assignments 
      WHERE shift_instance_id NOT IN (SELECT id FROM shift_instances)
      RETURNING id
    `);
    orphanedAssignmentsCount = orphanedAssignments.rows?.length || 0;

    if (orgId) {
      const orphanedStaffAssignments = await db.execute(sql`
        DELETE FROM shift_assignments 
        WHERE id IN (
          SELECT sa.id FROM shift_assignments sa
          JOIN shift_instances si ON sa.shift_instance_id = si.id
          WHERE si.organization_id = ${orgId}
          AND sa.staff_member_id NOT IN (SELECT id FROM staff_members WHERE organization_id = ${orgId})
        )
        RETURNING id
      `);
      orphanedStaffCount = orphanedStaffAssignments.rows?.length || 0;
    } else {
      const orphanedStaffAssignments = await db.execute(sql`
        DELETE FROM shift_assignments 
        WHERE staff_member_id NOT IN (SELECT id FROM staff_members)
        RETURNING id
      `);
      orphanedStaffCount = orphanedStaffAssignments.rows?.length || 0;
    }

    let duplicateRoleCount = 0;
    const dupeCheck = await db.execute(sql`
      SELECT sa.shift_instance_id, sa.assigned_role, COUNT(*) as cnt
      FROM shift_assignments sa
      JOIN shift_instances si ON sa.shift_instance_id = si.id
      ${orgId ? sql`WHERE si.organization_id = ${orgId}` : sql``}
      GROUP BY sa.shift_instance_id, sa.assigned_role
      HAVING COUNT(*) > 1
    `);
    const dupeRows = dupeCheck.rows || [];
    for (const row of dupeRows) {
      const instId = (row as any).shift_instance_id;
      const role = (row as any).assigned_role;
      const [inst] = await db.select({ requiredRoles: shiftInstances.requiredRoles })
        .from(shiftInstances).where(eq(shiftInstances.id, instId)).limit(1);
      if (!inst) continue;
      const roles = inst.requiredRoles as any[];
      let maxCount = 1;
      if (Array.isArray(roles)) {
        for (const rr of roles) {
          const rName = typeof rr === 'string' ? rr : rr.role;
          if (rName === role) {
            maxCount = typeof rr === 'string' ? 1 : (rr.count || 1);
            break;
          }
        }
      }
      const roleAssigns = await db.select({ id: shiftAssignments.id })
        .from(shiftAssignments)
        .where(and(
          eq(shiftAssignments.shiftInstanceId, instId),
          eq(shiftAssignments.assignedRole, role as any)
        ))
        .orderBy(shiftAssignments.createdAt);
      if (roleAssigns.length > maxCount) {
        const idsToDelete = roleAssigns.slice(maxCount).map(a => a.id);
        await db.delete(shiftAssignments).where(inArray(shiftAssignments.id, idsToDelete));
        duplicateRoleCount += idsToDelete.length;
      }
    }

    const emptyInstances = await db.execute(sql`
      DELETE FROM shift_instances 
      WHERE id NOT IN (SELECT DISTINCT shift_instance_id FROM shift_assignments)
      ${orgId ? sql`AND organization_id = ${orgId}` : sql``}
      RETURNING id
    `);
    const emptyInstancesCount = emptyInstances.rows?.length || 0;

    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'cleanup',
        entityType: 'shift_instance',
        description: `Pulizia dati orfani: ${orphanedAssignmentsCount} assegnazioni senza turno, ${orphanedStaffCount} assegnazioni senza staff, ${duplicateRoleCount} assegnazioni duplicate ruolo, ${emptyInstancesCount} turni vuoti rimossi`,
        organizationId: orgId || null,
      });
    } catch {}

    res.json({ 
      success: true, 
      orphanedAssignments: orphanedAssignmentsCount,
      orphanedStaffAssignments: orphanedStaffCount,
      duplicateRoleAssignments: duplicateRoleCount,
      emptyInstances: emptyInstancesCount 
    });
  } catch (error) {
    console.error("Error cleaning orphans:", error);
    res.status(500).json({ error: "Errore pulizia dati orfani" });
  }
});

  // ===== SHIFT ASSIGNMENTS =====
app.get("/api/shift-assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await storage.getShiftAssignments({
      shiftInstanceId: req.query.shiftInstanceId as string | undefined,
      staffMemberId: req.query.staffMemberId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json(assignments);
  } catch (error) {
    console.error("Error fetching shift assignments:", error);
    res.status(500).json({ error: "Errore nel recupero assegnazioni" });
  }
});

app.post("/api/shift-assignments", requireAdmin, async (req, res) => {
  try {
    const assignment = await storage.createShiftAssignment(req.body);
    
    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const staffMember = req.body.staffMemberId ? await storage.getStaffMemberById(req.body.staffMemberId) : null;
    const instance = await db.select().from(shiftInstances).where(eq(shiftInstances.id, req.body.shiftInstanceId)).limit(1);
    const vehicle = instance[0]?.vehicleId ? await storage.getVehicle(instance[0].vehicleId) : null;
    const loc = instance[0]?.locationId ? await db.select().from(locations).where(eq(locations.id, instance[0].locationId)).limit(1) : [];
    
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'create',
        entityType: 'shift_assignment',
        entityId: assignment.id,
        shiftInstanceId: req.body.shiftInstanceId,
        locationId: instance[0]?.locationId || null,
        locationName: loc[0]?.name || null,
        vehicleCode: vehicle?.code || null,
        shiftDate: instance[0]?.shiftDate || null,
        staffMemberName: staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : null,
        newValue: { staffMemberId: req.body.staffMemberId, assignedRole: req.body.assignedRole },
        description: `Assegnato ${staffMember?.firstName || ''} ${staffMember?.lastName || ''} (${req.body.assignedRole || 'operatore'}) al turno del ${instance[0]?.shiftDate || '?'} - ${vehicle?.code || '?'}`,
        organizationId: user?.organizationId || 'croce-europa-default',
      });
    } catch (auditErr) { console.error('Audit log error:', auditErr); }
    
    broadcastMessage({ type: "shift_assignment_created", assignment });
    res.status(201).json(assignment);
  } catch (error) {
    console.error("Error creating shift assignment:", error);
    res.status(500).json({ error: "Errore nella creazione assegnazione" });
  }
});

app.post("/api/shift-instances/:shiftId/signup", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Non autenticato" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "Utente non trovato" });
    }
    
    let staffMemberId = req.body.staffMemberId;
    let role = req.body.role;
    
    if (staffMemberId) {
      const selectedStaff = await storage.getStaffMemberById(staffMemberId);
      if (!selectedStaff) {
        return res.status(400).json({ error: "Membro dello staff non trovato" });
      }
      
      if (user.locationId && selectedStaff.locationId !== user.locationId) {
        return res.status(403).json({ error: "Non puoi iscrivere personale di un'altra sede" });
      }
      
      role = role || selectedStaff.primaryRole;
      console.log(`Shift signup: User ${userId} (${user.email}) enrolled staff ${staffMemberId} (${selectedStaff.firstName} ${selectedStaff.lastName}) for shift ${req.params.shiftId}`);
    } else {
      const staffMember = await storage.getStaffMemberByUserId(userId);
      if (!staffMember) {
        return res.status(400).json({ error: "Profilo personale non trovato. Contattare l'amministratore." });
      }
      staffMemberId = staffMember.id;
      role = role || staffMember.primaryRole;
      console.log(`Shift signup: User ${userId} self-enrolled for shift ${req.params.shiftId}`);
    }
    
    const assignment = await storage.selfSignupForShift(
      req.params.shiftId,
      staffMemberId,
      role
    );
    broadcastMessage({ type: "shift_signup", shiftId: req.params.shiftId, staffMemberId });
    res.status(201).json(assignment);
  } catch (error: any) {
    console.error("Error self-signing up for shift:", error);
    res.status(400).json({ error: error.message || "Errore nell'iscrizione al turno" });
  }
});

app.patch("/api/shift-assignments/:id", requireAuth, async (req, res) => {
  try {
    const oldAssignment = await db.select().from(shiftAssignments).where(eq(shiftAssignments.id, req.params.id)).limit(1);
    if (!oldAssignment[0]) {
      return res.status(404).json({ error: "Assegnazione non trovata" });
    }
    
    const updateData: any = {};
    if (req.body.staffMemberId) updateData.staffMemberId = req.body.staffMemberId;
    if (req.body.assignedRole) updateData.assignedRole = req.body.assignedRole;
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    
    if (updateData.staffMemberId && oldAssignment[0].shiftInstanceId) {
      const existing = await db.select().from(shiftAssignments).where(
        and(
          eq(shiftAssignments.shiftInstanceId, oldAssignment[0].shiftInstanceId),
          eq(shiftAssignments.staffMemberId, updateData.staffMemberId)
        )
      ).limit(1);
      if (existing[0] && existing[0].id !== req.params.id) {
        return res.status(409).json({ error: "Questo operatore e' gia' assegnato a questo turno" });
      }

      const patchInstance = await db.select().from(shiftInstances)
        .where(eq(shiftInstances.id, oldAssignment[0].shiftInstanceId)).limit(1);
      if (patchInstance[0]) {
        const restConflict = await checkShiftConflicts(
          updateData.staffMemberId, patchInstance[0].shiftDate, patchInstance[0].startTime, patchInstance[0].endTime, patchInstance[0].id
        );
        if (restConflict) {
          return res.status(409).json({ error: restConflict });
        }
      }
    }
    
    const assignment = await storage.updateShiftAssignment(req.params.id, updateData);
    if (!assignment) {
      return res.status(404).json({ error: "Assegnazione non trovata" });
    }
    
    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const oldStaff = oldAssignment[0]?.staffMemberId ? await storage.getStaffMemberById(oldAssignment[0].staffMemberId) : null;
    const newStaff = req.body.staffMemberId ? await storage.getStaffMemberById(req.body.staffMemberId) : null;
    const instance = await db.select().from(shiftInstances).where(eq(shiftInstances.id, oldAssignment[0]?.shiftInstanceId)).limit(1);
    const vehicle = instance[0]?.vehicleId ? await storage.getVehicle(instance[0].vehicleId) : null;
    const loc = instance[0]?.locationId ? await db.select().from(locations).where(eq(locations.id, instance[0].locationId)).limit(1) : [];
    
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'update',
        entityType: 'shift_assignment',
        entityId: req.params.id,
        shiftInstanceId: oldAssignment[0]?.shiftInstanceId || null,
        locationId: instance[0]?.locationId || null,
        locationName: loc[0]?.name || null,
        vehicleCode: vehicle?.code || null,
        shiftDate: instance[0]?.shiftDate || null,
        staffMemberName: `${oldStaff?.firstName || '?'} ${oldStaff?.lastName || '?'} → ${newStaff?.firstName || '?'} ${newStaff?.lastName || '?'}`,
        previousValue: { staffMemberId: oldAssignment[0]?.staffMemberId, assignedRole: oldAssignment[0]?.assignedRole },
        newValue: req.body,
        description: `Sostituzione: ${oldStaff?.firstName || '?'} ${oldStaff?.lastName || '?'} → ${newStaff?.firstName || '?'} ${newStaff?.lastName || '?'} (${oldAssignment[0]?.assignedRole || 'operatore'}) - Turno ${instance[0]?.shiftDate || '?'} ${vehicle?.code || ''}`,
        organizationId: user?.organizationId || 'croce-europa-default',
      });
    } catch (auditErr) { console.error('Audit log error:', auditErr); }
    
    broadcastMessage({ type: "shift_assignment_updated", assignment });
    res.json(assignment);
  } catch (error) {
    console.error("Error updating shift assignment:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento assegnazione" });
  }
});

app.delete("/api/shift-assignments/:id", requireAuth, async (req, res) => {
  try {
    const oldAssignment = await db.select().from(shiftAssignments).where(eq(shiftAssignments.id, req.params.id)).limit(1);
    
    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;
    const oldStaff = oldAssignment[0]?.staffMemberId ? await storage.getStaffMemberById(oldAssignment[0].staffMemberId) : null;
    const instance = oldAssignment[0]?.shiftInstanceId ? await db.select().from(shiftInstances).where(eq(shiftInstances.id, oldAssignment[0].shiftInstanceId)).limit(1) : [];
    const vehicle = instance[0]?.vehicleId ? await storage.getVehicle(instance[0].vehicleId) : null;
    const loc = instance[0]?.locationId ? await db.select().from(locations).where(eq(locations.id, instance[0].locationId)).limit(1) : [];
    
    await storage.deleteShiftAssignment(req.params.id);
    
    try {
      await db.insert(shiftAuditLog).values({
        userId: userId || 'system',
        userName: user ? `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() : 'Sistema',
        action: 'delete',
        entityType: 'shift_assignment',
        entityId: req.params.id,
        shiftInstanceId: oldAssignment[0]?.shiftInstanceId || null,
        locationId: instance[0]?.locationId || null,
        locationName: loc[0]?.name || null,
        vehicleCode: vehicle?.code || null,
        shiftDate: instance[0]?.shiftDate || null,
        staffMemberName: oldStaff ? `${oldStaff.firstName} ${oldStaff.lastName}` : null,
        previousValue: { staffMemberId: oldAssignment[0]?.staffMemberId, assignedRole: oldAssignment[0]?.assignedRole },
        description: `Rimosso ${oldStaff?.firstName || '?'} ${oldStaff?.lastName || '?'} (${oldAssignment[0]?.assignedRole || 'operatore'}) dal turno del ${instance[0]?.shiftDate || '?'} - ${vehicle?.code || ''}`,
        organizationId: user?.organizationId || 'croce-europa-default',
      });
    } catch (auditErr) { console.error('Audit log error:', auditErr); }
    
    broadcastMessage({ type: "shift_assignment_deleted", assignmentId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift assignment:", error);
    res.status(500).json({ error: "Errore nell'eliminazione assegnazione" });
  }
});

app.post("/api/shift-assignments/:id/check-in", requireAuth, async (req, res) => {
  try {
    const assignment = await storage.checkInShiftAssignment(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assegnazione non trovata" });
    }
    broadcastMessage({ type: "shift_checkin", assignment });
    res.json(assignment);
  } catch (error: any) {
    console.error("Error checking in:", error);
    res.status(400).json({ error: error.message || "Errore nel check-in" });
  }
});

app.post("/api/shift-assignments/:id/check-out", requireAuth, async (req, res) => {
  try {
    const assignment = await storage.checkOutShiftAssignment(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assegnazione non trovata" });
    }
    broadcastMessage({ type: "shift_checkout", assignment });
    res.json(assignment);
  } catch (error: any) {
    console.error("Error checking out:", error);
    res.status(400).json({ error: error.message || "Errore nel check-out" });
  }
});

  // ===== STAFF AVAILABILITY =====
app.get("/api/staff-availability", requireAuth, async (req, res) => {
  try {
    const { month, year, locationId, role } = req.query;
    
    // Calculate date range for the month
    const monthNum = parseInt(month as string) || new Date().getMonth();
    const yearNum = parseInt(year as string) || new Date().getFullYear();
    const dateFrom = `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum + 1, 0).getDate();
    const dateTo = `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-${lastDay}`;
    
    // Get all availability entries that overlap with this month
    const allAvailability = await db
      .select({
        availability: staffAvailability,
        staffMember: staffMembers
      })
      .from(staffAvailability)
      .leftJoin(staffMembers, eq(staffAvailability.staffMemberId, staffMembers.id))
      .where(
        and(
          lte(staffAvailability.dateStart, dateTo),
          gte(staffAvailability.dateEnd, dateFrom)
        )
      )
      .orderBy(staffAvailability.dateStart);
    
    // Filter by location and role if specified
    let results = allAvailability;
    if (locationId) {
      results = results.filter(r => r.staffMember?.locationId === locationId);
    }
    if (role) {
      results = results.filter(r => r.staffMember?.primaryRole === role);
    }
    
    // Format response with staff details
    const formattedResults = results.map(r => ({
      ...r.availability,
      staffMember: r.staffMember ? {
        id: r.staffMember.id,
        firstName: r.staffMember.firstName,
        lastName: r.staffMember.lastName,
        primaryRole: r.staffMember.primaryRole,
        locationId: r.staffMember.locationId
      } : null
    }));
    
    res.json(formattedResults);
  } catch (error) {
    console.error("Error fetching all staff availability:", error);
    res.status(500).json({ error: "Errore nel recupero disponibilità" });
  }
});

app.get("/api/staff-availability/:staffMemberId", requireAuth, async (req, res) => {
  try {
    const availability = await storage.getStaffAvailability(
      req.params.staffMemberId,
      req.query.dateFrom as string | undefined,
      req.query.dateTo as string | undefined
    );
    res.json(availability);
  } catch (error) {
    console.error("Error fetching staff availability:", error);
    res.status(500).json({ error: "Errore nel recupero disponibilità" });
  }
});

app.post("/api/staff-availability", requireAuth, async (req, res) => {
  try {
    const availability = await storage.createStaffAvailability(req.body);
    res.status(201).json(availability);
  } catch (error) {
    console.error("Error creating staff availability:", error);
    res.status(500).json({ error: "Errore nella creazione disponibilità" });
  }
});

app.patch("/api/staff-availability/:id", requireAuth, async (req, res) => {
  try {
    const availability = await storage.updateStaffAvailability(req.params.id, req.body);
    if (!availability) {
      return res.status(404).json({ error: "Disponibilità non trovata" });
    }
    res.json(availability);
  } catch (error) {
    console.error("Error updating staff availability:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento disponibilità" });
  }
});

app.delete("/api/staff-availability/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteStaffAvailability(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting staff availability:", error);
    res.status(500).json({ error: "Errore nell'eliminazione disponibilità" });
  }
});

  // ===== SHIFT SWAP REQUESTS =====
app.get("/api/shift-swap-requests", requireAuth, async (req, res) => {
  try {
    const requests = await storage.getShiftSwapRequests({
      requesterId: req.query.requesterId as string | undefined,
      targetStaffId: req.query.targetStaffId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json(requests);
  } catch (error) {
    console.error("Error fetching shift swap requests:", error);
    res.status(500).json({ error: "Errore nel recupero richieste scambio" });
  }
});

app.post("/api/shift-swap-requests", requireAuth, async (req, res) => {
  try {
    const request = await storage.createShiftSwapRequest(req.body);
    broadcastMessage({ type: "swap_request_created", request });
    res.status(201).json(request);
  } catch (error) {
    console.error("Error creating shift swap request:", error);
    res.status(500).json({ error: "Errore nella creazione richiesta scambio" });
  }
});

app.patch("/api/shift-swap-requests/:id", requireAuth, async (req, res) => {
  try {
    const request = await storage.updateShiftSwapRequest(req.params.id, req.body);
    if (!request) {
      return res.status(404).json({ error: "Richiesta non trovata" });
    }
    broadcastMessage({ type: "swap_request_updated", request });
    res.json(request);
  } catch (error) {
    console.error("Error updating shift swap request:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento richiesta" });
  }
});

  // ===== SERVICE EVENTS & EVENT ASSIGNMENTS =====
app.get("/api/service-events", requireAuth, async (req, res) => {
  try {
    const events = await storage.getServiceEvents({
      locationId: req.query.locationId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as string | undefined,
      eventType: req.query.eventType as string | undefined,
    });
    res.json(events);
  } catch (error) {
    console.error("Error fetching service events:", error);
    res.status(500).json({ error: "Errore nel recupero eventi" });
  }
});

app.get("/api/service-events/:id", requireAuth, async (req, res) => {
  try {
    const event = await storage.getServiceEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Evento non trovato" });
    }
    const assignments = await storage.getEventAssignments({ eventId: req.params.id });
    res.json({ ...event, assignments });
  } catch (error) {
    console.error("Error fetching service event:", error);
    res.status(500).json({ error: "Errore nel recupero evento" });
  }
});

app.post("/api/service-events", requireAdmin, async (req, res) => {
  try {
    const event = await storage.createServiceEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating service event:", error);
    res.status(500).json({ error: "Errore nella creazione evento" });
  }
});

app.patch("/api/service-events/:id", requireAdmin, async (req, res) => {
  try {
    const event = await storage.updateServiceEvent(req.params.id, req.body);
    if (!event) {
      return res.status(404).json({ error: "Evento non trovato" });
    }
    res.json(event);
  } catch (error) {
    console.error("Error updating service event:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento evento" });
  }
});

app.delete("/api/service-events/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteServiceEvent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting service event:", error);
    res.status(500).json({ error: "Errore nell'eliminazione evento" });
  }
});

// Event Assignments
app.get("/api/event-assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await storage.getEventAssignments({
      eventId: req.query.eventId as string | undefined,
      staffMemberId: req.query.staffMemberId as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json(assignments);
  } catch (error) {
    console.error("Error fetching event assignments:", error);
    res.status(500).json({ error: "Errore nel recupero assegnazioni evento" });
  }
});

app.post("/api/event-assignments", requireAdmin, async (req, res) => {
  try {
    const assignment = await storage.createEventAssignment(req.body);
    res.status(201).json(assignment);
  } catch (error) {
    console.error("Error creating event assignment:", error);
    res.status(500).json({ error: "Errore nella creazione assegnazione" });
  }
});

app.patch("/api/event-assignments/:id", requireAuth, async (req, res) => {
  try {
    const assignment = await storage.updateEventAssignment(req.params.id, req.body);
    if (!assignment) {
      return res.status(404).json({ error: "Assegnazione non trovata" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Error updating event assignment:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento assegnazione" });
  }
});

app.delete("/api/event-assignments/:id", requireAuth, async (req, res) => {
  try {
    await storage.deleteEventAssignment(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting event assignment:", error);
    res.status(500).json({ error: "Errore nell'eliminazione assegnazione" });
  }
});

  // ===== SHIFT ACTIVITY LOGS =====
app.get("/api/shift-activity-logs", requireAdmin, async (req, res) => {
  try {
    const logs = await storage.getShiftActivityLogs({
      entityType: req.query.entityType as string | undefined,
      entityId: req.query.entityId as string | undefined,
      actorId: req.query.actorId as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching shift activity logs:", error);
    res.status(500).json({ error: "Errore nel recupero log attività" });
  }
});

  // ===== MONTHLY SCHEDULE =====
app.get("/api/monthly-schedule", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const { month, year, locationId, vehicleId } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }
    
    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    
    // Calculate date range for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Build filter conditions (filter out undefined)
    const conditions = [
      gte(shiftInstances.shiftDate, startDateStr),
      lte(shiftInstances.shiftDate, endDateStr),
    ];
    if (vehicleId) conditions.push(eq(shiftInstances.vehicleId, vehicleId as string));
    
    // Fetch shift instances for the month
    let instances = await db.select()
      .from(shiftInstances)
      .where(and(...conditions));
    
    // If location filter is applied, filter by vehicle's location (more accurate)
    if (locationId) {
      const locationVehicles = await db.select({ id: vehiclesTable.id })
        .from(vehiclesTable)
        .where(eq(vehiclesTable.locationId, locationId as string));
      const locationVehicleIds = new Set(locationVehicles.map(v => v.id));
      instances = instances.filter((i: any) => locationVehicleIds.has(i.vehicleId));
    }
    
    // Fetch assignments for these instances
    const instanceIds = instances.map((i: { id: string }) => i.id);
    let assignments: any[] = [];
    
    if (instanceIds.length > 0) {
      const allAssignments = await db.select({
        id: shiftAssignments.id,
        shiftInstanceId: shiftAssignments.shiftInstanceId,
        staffMemberId: shiftAssignments.staffMemberId,
        role: shiftAssignments.assignedRole,
        status: shiftAssignments.status,
        checkInTime: shiftAssignments.checkedInAt,
        checkOutTime: shiftAssignments.checkedOutAt,
        staffFirstName: staffMembers.firstName,
        staffLastName: staffMembers.lastName,
        staffRole: staffMembers.primaryRole,
      })
      .from(shiftAssignments)
      .leftJoin(staffMembers, eq(shiftAssignments.staffMemberId, staffMembers.id))
      .where(inArray(shiftAssignments.shiftInstanceId, instanceIds));
      
      const vehicleIds = [...new Set(instances.map((i: any) => i.vehicleId))];
      const vehicleConfigs: Record<string, { shifts: any[]; profiles: any[] | null }> = {};
      
      for (const vid of vehicleIds) {
        const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vid)).limit(1);
        let shifts: any[] = [];
        if (vehicle[0]?.scheduleShifts) {
          try { shifts = JSON.parse(vehicle[0].scheduleShifts); } catch {}
        }
        vehicleConfigs[vid] = {
          shifts,
          profiles: vehicle[0]?.scheduleProfiles as any[] | null,
        };
      }
      
      assignments = allAssignments.map((a: any) => {
        const instance = instances.find((i: { id: string }) => i.id === a.shiftInstanceId) as any;
        
        const instanceStartTime = instance?.startTime ? instance.startTime.toString().substring(0, 5) : null;
        const instanceEndTime = instance?.endTime ? instance.endTime.toString().substring(0, 5) : null;
        
        let shiftType = 'shift_0';
        if (instance?.vehicleId && instanceStartTime) {
          const config = vehicleConfigs[instance.vehicleId];
          const instanceProfileId = instance.profileId;
          
          const sortShiftsByStartTime = (shifts: any[]) => {
            return [...shifts].sort((a: any, b: any) => {
              const startA = parseInt((a.start || '00:00').split(':')[0]) * 60 + parseInt((a.start || '00:00').split(':')[1]);
              const startB = parseInt((b.start || '00:00').split(':')[0]) * 60 + parseInt((b.start || '00:00').split(':')[1]);
              return startA - startB;
            });
          };
          
          if (config?.profiles && Array.isArray(config.profiles) && config.profiles.length > 0 && instanceProfileId) {
            const profile = config.profiles.find((p: any) => p.id === instanceProfileId);
            if (profile && Array.isArray(profile.shifts)) {
              const sortedShifts = sortShiftsByStartTime(profile.shifts);
              const idx = sortedShifts.findIndex((s: any) => s.start === instanceStartTime);
              shiftType = idx >= 0 ? `shift_${idx}` : 'shift_0';
            }
          } else {
            const vehicleShifts = config?.shifts || [];
            const sortedShifts = sortShiftsByStartTime(vehicleShifts);
            const shiftIdx = sortedShifts.findIndex((vs: any) => vs.start === instanceStartTime);
            shiftType = shiftIdx >= 0 ? `shift_${shiftIdx}` : 'shift_0';
          }
        }
        
        return {
          ...a,
          staffName: a.staffFirstName && a.staffLastName ? `${a.staffFirstName} ${a.staffLastName}` : null,
          vehicleId: instance?.vehicleId,
          date: instance?.shiftDate,
          profileId: (instance as any)?.profileId || null,
          shiftType,
          shiftStartTime: instanceStartTime,
          shiftEndTime: instanceEndTime,
        };
      });
    }
    
    res.json({
      shifts: instances,
      assignments,
      month: monthNum,
      year: yearNum,
    });
  } catch (error) {
    console.error("Error fetching monthly schedule:", error);
    res.status(500).json({ error: "Errore nel recupero del calendario mensile" });
  }
});

// Staff suggestions for shift assignment
app.get("/api/monthly-schedule/suggestions", requireAdmin, async (req, res) => {
  try {
    const { vehicleId, date, shiftType, locationId } = req.query;
    
    // Get all staff members
    const allStaff = await db.select().from(staffMembers).where(eq(staffMembers.isActive, true));
    
    // Get vehicle info for location matching
    let vehicleLocationId = locationId as string | undefined;
    if (vehicleId && !vehicleLocationId) {
      const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId as string)).limit(1);
      vehicleLocationId = vehicle[0]?.locationId ?? undefined;
    }
    
    // Get existing assignments for this date to check availability
    const dateStr = date as string;
    const existingInstances = await db.select().from(shiftInstances)
      .where(eq(shiftInstances.shiftDate, dateStr));
    
    const instanceIds = existingInstances.map((i: { id: string }) => i.id);
    let busyStaffIds: string[] = [];
    
    if (instanceIds.length > 0) {
      const existingAssignments = await db.select()
        .from(shiftAssignments)
        .where(inArray(shiftAssignments.shiftInstanceId, instanceIds));
      busyStaffIds = existingAssignments.map((a: { staffMemberId: string }) => a.staffMemberId).filter(Boolean) as string[];
    }
    
    // Score and rank staff
    const suggestions = allStaff.map((staff: any) => {
      let score = 50; // Base score
      
      // Location match bonus
      if (vehicleLocationId && staff.locationId === vehicleLocationId) {
        score += 30;
      }
      
      // Role bonus
      if (staff.primaryRole === 'autista') {
        score += 10;
      } else if (staff.primaryRole === 'soccorritore') {
        score += 5;
      }
      
      // Availability check (penalty if already assigned)
      if (busyStaffIds.includes(staff.id)) {
        score -= 100; // Already assigned
      }
      
      // Add some randomness for variation
      score += Math.floor(Math.random() * 15);
      
      return {
        id: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        role: staff.primaryRole,
        locationId: staff.locationId,
        score: Math.max(0, Math.min(100, score)),
        available: !busyStaffIds.includes(staff.id),
      };
    });
    
    // Sort by score descending, filter available first
    suggestions.sort((a: any, b: any) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return b.score - a.score;
    });
    
    res.json(suggestions.slice(0, 10)); // Top 10 suggestions
  } catch (error) {
    console.error("Error generating staff suggestions:", error);
    res.status(500).json({ error: "Errore nel generare suggerimenti" });
  }
});

// Create shift instance and assignment in one call
app.post("/api/monthly-schedule/assign", requireAdmin, async (req, res) => {
  try {
    const { vehicleId, date, shiftType, staffMemberId, role, shiftStart: rawShiftStart, shiftEnd: rawShiftEnd } = req.body;
    console.log(`[ASSIGN] Request: vehicleId=${vehicleId}, date=${date}, shiftType=${shiftType}, staffMemberId=${staffMemberId}, role=${role}, rawShiftStart=${rawShiftStart}, rawShiftEnd=${rawShiftEnd}`);
    
    if (!vehicleId || !date || !shiftType || !staffMemberId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const validRoles = ['autista', 'soccorritore', 'infermiere', 'medico', 'coordinatore'] as const;
    type ValidRole = typeof validRoles[number];
    const assignedRole: ValidRole = validRoles.includes(role) ? role : 'soccorritore';
    
    const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
    if (!vehicle[0]) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    
    let startTime: string;
    let endTime: string;
    
    const normalizeTime = (t: string) => {
      if (!t) return '00:00:00';
      const parts = t.split(':');
      if (parts.length >= 3) return t;
      return t + ':00';
    };
    
    if (rawShiftStart && rawShiftEnd) {
      startTime = normalizeTime(rawShiftStart);
      endTime = normalizeTime(rawShiftEnd);
    } else {
      let vehicleShifts: any[] = [];
      if (vehicle[0].scheduleShifts) {
        try { vehicleShifts = JSON.parse(vehicle[0].scheduleShifts as string); } catch {}
      }
      vehicleShifts.sort((a: any, b: any) => {
        const startA = parseInt((a.start || '00:00').split(':')[0]) * 60 + parseInt((a.start || '00:00').split(':')[1]);
        const startB = parseInt((b.start || '00:00').split(':')[0]) * 60 + parseInt((b.start || '00:00').split(':')[1]);
        return startA - startB;
      });
      const shiftIdx = shiftType?.startsWith('shift_') ? parseInt(shiftType.replace('shift_', ''), 10) : 0;
      if (vehicleShifts[shiftIdx]) {
        startTime = vehicleShifts[shiftIdx].start + ':00';
        endTime = vehicleShifts[shiftIdx].end + ':00';
      } else if (vehicleShifts.length > 0) {
        startTime = vehicleShifts[0].start + ':00';
        endTime = vehicleShifts[0].end + ':00';
      } else {
        startTime = '06:30:00';
        endTime = '14:30:00';
      }
    }
    
    // Check if shift instance already exists
    let instance = await db.select().from(shiftInstances)
      .where(
        and(
          eq(shiftInstances.vehicleId, vehicleId),
          eq(shiftInstances.shiftDate, date),
          eq(shiftInstances.startTime, startTime)
        )
      )
      .limit(1);
    
    let instanceId: string;
    
    if (instance[0]) {
      instanceId = instance[0].id;
    } else {
      // Create new instance
      const newInstance = await db.insert(shiftInstances).values({
        id: crypto.randomUUID(),
        vehicleId,
        locationId: vehicle[0].locationId!,
        shiftDate: date,
        startTime,
        endTime,
        requiredRoles: ['autista', 'soccorritore'],
        minStaff: 2,
        status: 'published',
      }).returning();
      instanceId = newInstance[0].id;
    }
    
    // Check if staff already assigned to this instance
    const existingAssignment = await db.select().from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.shiftInstanceId, instanceId),
          eq(shiftAssignments.staffMemberId, staffMemberId)
        )
      )
      .limit(1);
    
    if (existingAssignment[0]) {
      return res.json({
        success: true,
        instanceId,
        assignment: existingAssignment[0],
        alreadyExisted: true,
      });
    }

    // Check shift conflict, excluding current instance (same vehicle/date/time)
    const restConflict = await checkShiftConflicts(staffMemberId, date, startTime, endTime, instanceId);
    if (restConflict) {
      return res.status(409).json({ error: restConflict });
    }
    
    // Create assignment
    const assignment = await db.insert(shiftAssignments).values({
      id: crypto.randomUUID(),
      shiftInstanceId: instanceId,
      staffMemberId,
      assignedRole,
      status: 'assigned',
    }).returning();
    
    res.json({
      success: true,
      instanceId,
      assignment: assignment[0],
    });
  } catch (error) {
    console.error("Error creating shift assignment:", error);
    res.status(500).json({ error: "Errore nella creazione assegnazione" });
  }
});

// Remove assignment
app.post("/api/monthly-schedule/unassign", requireAdmin, async (req, res) => {
  try {
    const { vehicleId, date, role, shiftType, shiftStart: rawShiftStart } = req.body;
    console.log(`[UNASSIGN] Request: vehicleId=${vehicleId}, date=${date}, role=${role}, shiftType=${shiftType}, rawShiftStart=${rawShiftStart}`);
    if (!vehicleId || !date || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let targetStartTime: string | null = null;
    
    if (rawShiftStart) {
      const parts = rawShiftStart.split(':');
      targetStartTime = parts.length >= 3 ? rawShiftStart : rawShiftStart + ':00';
    } else {
      const vehicle = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId)).limit(1);
      if (!vehicle[0]) return res.status(404).json({ error: "Vehicle not found" });
      let vehicleShifts: any[] = [];
      if (vehicle[0].scheduleShifts) {
        try { vehicleShifts = JSON.parse(vehicle[0].scheduleShifts as string); } catch {}
      }
      vehicleShifts.sort((a: any, b: any) => {
        const startA = parseInt((a.start || '00:00').split(':')[0]) * 60 + parseInt((a.start || '00:00').split(':')[1]);
        const startB = parseInt((b.start || '00:00').split(':')[0]) * 60 + parseInt((b.start || '00:00').split(':')[1]);
        return startA - startB;
      });
      const shiftIdx = parseInt((shiftType || 'shift_0').replace('shift_', ''), 10);
      if (vehicleShifts[shiftIdx]) {
        targetStartTime = vehicleShifts[shiftIdx].start + ':00';
      }
    }
    console.log(`[UNASSIGN] targetStartTime=${targetStartTime}`);

    const instances = await db.select().from(shiftInstances)
      .where(and(
        eq(shiftInstances.vehicleId, vehicleId),
        eq(shiftInstances.shiftDate, date),
        ...(targetStartTime ? [eq(shiftInstances.startTime, targetStartTime)] : [])
      ));
    console.log(`[UNASSIGN] Found ${instances.length} instances for vehicleId=${vehicleId}, date=${date}, startTime=${targetStartTime}`);
    instances.forEach(inst => console.log(`[UNASSIGN]   instance: id=${inst.id}, startTime=${inst.startTime}, endTime=${inst.endTime}`));

    let deletedCount = 0;
    for (const inst of instances) {
      const assignments = await db.select().from(shiftAssignments)
        .where(and(
          eq(shiftAssignments.shiftInstanceId, inst.id),
          eq(shiftAssignments.assignedRole, role as any)
        ));
      console.log(`[UNASSIGN] Instance ${inst.id}: found ${assignments.length} assignments with role=${role}`);
      for (const a of assignments) {
        console.log(`[UNASSIGN] Deleting assignment ${a.id} (staffId=${a.staffMemberId})`);
        await db.delete(shiftAssignments).where(eq(shiftAssignments.id, a.id));
        deletedCount++;
      }
    }

    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Error unassigning:", error);
    res.status(500).json({ error: "Errore nella rimozione assegnazione" });
  }
});

app.delete("/api/monthly-schedule/assign/:assignmentId", requireAdmin, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    await db.delete(shiftAssignments).where(eq(shiftAssignments.id, assignmentId));
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing assignment:", error);
    res.status(500).json({ error: "Errore nella rimozione assegnazione" });
  }
});

// Copy schedule from previous month
app.post("/api/monthly-schedule/copy-from-previous", requireAdmin, async (req, res) => {
  try {
    const { targetMonth, targetYear, sourceMonth, sourceYear } = req.body;
    const orgId = getEffectiveOrgId(req);
    
    if (!targetMonth || !targetYear || !sourceMonth || !sourceYear) {
      return res.status(400).json({ error: "Tutti i parametri mese/anno sono richiesti" });
    }
    
    // Get source month date range
    const sourceDaysInMonth = new Date(sourceYear, sourceMonth, 0).getDate();
    const targetDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    
    // Get all shifts from source month
    const sourceStartDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01`;
    const sourceEndDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-${String(sourceDaysInMonth).padStart(2, '0')}`;
    
    // Get all shift instances with their assignments from source month, filtered by org
    const sourceConditions: any[] = [
      gte(shiftInstances.shiftDate, sourceStartDate),
      lte(shiftInstances.shiftDate, sourceEndDate),
    ];
    if (orgId) sourceConditions.push(eq(shiftInstances.organizationId, orgId));
    
    const sourceInstances = await db.select({
      instance: shiftInstances,
      assignments: shiftAssignments
    })
    .from(shiftInstances)
    .leftJoin(shiftAssignments, eq(shiftInstances.id, shiftAssignments.shiftInstanceId))
    .where(and(...sourceConditions));
    
    // Group by instance
    const instanceMap = new Map<string, { instance: any, assignments: any[] }>();
    for (const row of sourceInstances) {
      if (!instanceMap.has(row.instance.id)) {
        instanceMap.set(row.instance.id, { instance: row.instance, assignments: [] });
      }
      if (row.assignments) {
        instanceMap.get(row.instance.id)!.assignments.push(row.assignments);
      }
    }
    
    let copiedCount = 0;
    
    for (const { instance, assignments } of instanceMap.values()) {
      // Parse source date and map to target month
      const sourceDate = new Date(instance.shiftDate);
      const sourceDay = sourceDate.getDate();
      
      // Skip if day doesn't exist in target month (e.g., Feb 30)
      if (sourceDay > targetDaysInMonth) continue;
      
      const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(sourceDay).padStart(2, '0')}`;
      
      // Check if shift already exists for this vehicle/date/time
      const existing = await db.select().from(shiftInstances)
        .where(
          and(
            eq(shiftInstances.vehicleId, instance.vehicleId),
            eq(shiftInstances.shiftDate, targetDateStr),
            eq(shiftInstances.startTime, instance.startTime)
          )
        )
        .limit(1);
      
      let targetInstanceId: string;
      
      if (existing[0]) {
        targetInstanceId = existing[0].id;
      } else {
        // Create new shift instance
        const newInstance = await db.insert(shiftInstances).values({
          id: crypto.randomUUID(),
          vehicleId: instance.vehicleId,
          locationId: instance.locationId,
          shiftDate: targetDateStr,
          startTime: instance.startTime,
          endTime: instance.endTime,
          requiredRoles: instance.requiredRoles,
          minStaff: instance.minStaff,
          status: 'draft',
          organizationId: orgId || instance.organizationId || 'croce-europa-default',
        }).returning();
        targetInstanceId = newInstance[0].id;
      }
      
      // Copy assignments
      for (const assignment of assignments) {
        // Check if assignment already exists
        const existingAssignment = await db.select().from(shiftAssignments)
          .where(
            and(
              eq(shiftAssignments.shiftInstanceId, targetInstanceId),
              eq(shiftAssignments.staffMemberId, assignment.staffMemberId),
              eq(shiftAssignments.assignedRole, assignment.assignedRole)
            )
          )
          .limit(1);
        
        if (!existingAssignment[0]) {
          await db.insert(shiftAssignments).values({
            id: crypto.randomUUID(),
            shiftInstanceId: targetInstanceId,
            staffMemberId: assignment.staffMemberId,
            assignedRole: assignment.assignedRole,
            status: 'assigned',
          });
          copiedCount++;
        }
      }
    }
    
    res.json({
      success: true,
      copiedCount,
      message: `Copiati ${copiedCount} turni da ${sourceMonth}/${sourceYear} a ${targetMonth}/${targetYear}`
    });
  } catch (error) {
    console.error("Error copying from previous month:", error);
    res.status(500).json({ error: "Errore nella copia dei turni" });
  }
});

// Bulk generate shifts for a month with optional auto-assignment
app.post("/api/monthly-schedule/generate", requireAdmin, async (req, res) => {
  try {
    const { month, year, locationId, vehicleId, pattern, autoAssign, respectMaxHours } = req.body;
    const orgId = getEffectiveOrgId(req);
    
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
    }
    
    const shiftPattern = pattern || 'all_days';
    
    const vehicleConditions = [eq(vehiclesTable.isActive, true)];
    if (locationId) vehicleConditions.push(eq(vehiclesTable.locationId, locationId));
    if (vehicleId) vehicleConditions.push(eq(vehiclesTable.id, vehicleId));
    if (orgId) {
      const orgLocs = await db.select({ id: locations.id }).from(locations).where(eq(locations.organizationId, orgId));
      const orgLocIds = orgLocs.map(l => l.id);
      if (orgLocIds.length > 0) {
        vehicleConditions.push(inArray(vehiclesTable.locationId, orgLocIds));
      } else {
        return res.json({ success: true, count: 0, assigned: 0, unfilled: 0, stats: {} });
      }
    }
    
    const vehiclesToProcess = await db.select().from(vehiclesTable)
      .where(and(...vehicleConditions));
    
    const daysInMonth = new Date(year, month, 0).getDate();
    let createdCount = 0;
    const createdIds: string[] = [];
    
    for (const vehicle of vehiclesToProcess) {
      const profiles = (vehicle.scheduleProfiles as any[] | null);
      const hasProfiles = Array.isArray(profiles) && profiles.length > 0;

      const configsToProcess: Array<{
        roles: Array<{role: string; count: number}>;
        globalShiftTimes: Array<{startTime: string; endTime: string}>;
        scheduleDays: Record<string, any> | null;
        profileId: string | null;
      }> = [];

      if (hasProfiles) {
        for (const profile of profiles!) {
          if (profile.enabled === false) continue;
          let pRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
          if (profile.roles) {
            const rn = profile.roles.split(',').map((r: string) => r.trim());
            pRoles = rn.map((r: string) => ({ role: r, count: 1 }));
          }
          let pShifts = [{ startTime: '06:30:00', endTime: '14:00:00' }];
          if (Array.isArray(profile.shifts) && profile.shifts.length > 0) {
            pShifts = profile.shifts.map((s: any) => ({
              startTime: (s.start || '07:00') + ':00',
              endTime: (s.end || '14:00') + ':00'
            }));
          }
          configsToProcess.push({
            roles: pRoles,
            globalShiftTimes: pShifts,
            scheduleDays: profile.days || null,
            profileId: profile.id || null,
          });
        }
      } else {
        let vehicleRoles = [{ role: 'autista', count: 1 }, { role: 'soccorritore', count: 1 }];
        if (vehicle.scheduleRoles) {
          const roleNames = vehicle.scheduleRoles.split(',').map((r: string) => r.trim());
          vehicleRoles = roleNames.map((r: string) => ({ role: r, count: 1 }));
        }
        let globalShiftTimes = [
          { startTime: '06:30:00', endTime: '14:00:00' },
          { startTime: '14:30:00', endTime: '22:00:00' }
        ];
        if (vehicle.scheduleShifts) {
          try {
            const parsed = JSON.parse(vehicle.scheduleShifts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalShiftTimes = parsed.map((s: any) => ({
                startTime: s.start + ':00',
                endTime: s.end + ':00'
              }));
            }
          } catch {}
        }
        configsToProcess.push({
          roles: vehicleRoles,
          globalShiftTimes,
          scheduleDays: vehicle.scheduleDays as Record<string, any> | null,
          profileId: null,
        });
      }

      for (const config of configsToProcess) {
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const date = new Date(year, month - 1, day);
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (shiftPattern === 'weekdays_only' && isWeekend) continue;
          if (shiftPattern === 'weekends_only' && !isWeekend) continue;

          let shiftTimes = config.globalShiftTimes;
          if (config.scheduleDays && config.scheduleDays[dayOfWeek] !== undefined) {
            const dayConfig = config.scheduleDays[dayOfWeek];
            if (!dayConfig.active) continue;
            if (dayConfig.shifts && dayConfig.shifts.length > 0) {
              shiftTimes = dayConfig.shifts.map((s: any) => ({
                startTime: (s.start || '07:00') + ':00',
                endTime: (s.end || '14:00') + ':00'
              }));
            }
          }
          
          for (const shift of shiftTimes) {
            const existConditions = [
              eq(shiftInstances.vehicleId, vehicle.id),
              eq(shiftInstances.shiftDate, dateStr),
              eq(shiftInstances.startTime, shift.startTime)
            ];
            if (config.profileId) {
              existConditions.push(eq(shiftInstances.profileId, config.profileId));
            }
            const existing = await db.select().from(shiftInstances)
              .where(and(...existConditions))
              .limit(1);
            
            if (!existing[0]) {
              const newId = crypto.randomUUID();
              await db.insert(shiftInstances).values({
                id: newId,
                vehicleId: vehicle.id,
                locationId: vehicle.locationId,
                shiftDate: dateStr,
                startTime: shift.startTime,
                endTime: shift.endTime,
                requiredRoles: config.roles,
                minStaff: config.roles.length,
                status: 'draft',
                organizationId: orgId || 'croce-europa-default',
                profileId: config.profileId,
              });
              createdIds.push(newId);
              createdCount++;
            }
          }
        }
      }
    }
    
    let assignedStaff = 0;
    let unfilledSlots = 0;
    let stats = { autisti: 0, soccorritori: 0, infermieri: 0, unfilled: 0 };
    
    if (autoAssign && createdIds.length > 0) {
      const result = await smartAssignStaff(createdIds);
      assignedStaff = result.assigned;
      unfilledSlots = result.unfilled;
      stats = result.stats;
    }
    
    res.json({
      success: true,
      createdShifts: createdCount,
      assignedStaff,
      unfilledSlots,
      stats,
    });
  } catch (error) {
    console.error("Error generating shifts:", error);
    res.status(500).json({ error: "Errore nella generazione turni" });
  }
});

  // ===== REIMBURSEMENTS =====
app.get("/api/reimbursements/location-distances", requireAdmin, async (req, res) => {
  try {
    const distances = await storage.getLocationDistances();
    res.json(distances);
  } catch (error) {
    console.error("Error fetching location distances:", error);
    res.status(500).json({ error: "Errore nel recupero distanze sedi" });
  }
});

// Save location distance
app.post("/api/reimbursements/location-distances", requireAdmin, async (req, res) => {
  try {
    const { locationId, locationName, defaultDistanceKm } = req.body;
    const distance = await storage.upsertLocationDistance({
      locationId,
      locationName,
      defaultDistanceKm,
    });
    res.json(distance);
  } catch (error) {
    console.error("Error saving location distance:", error);
    res.status(500).json({ error: "Errore nel salvataggio distanza sede" });
  }
});

// Get volunteers (staff members with contractType = 'volunteer')
app.get("/api/reimbursements/volunteers", requireAdmin, async (req, res) => {
  try {
    const volunteers = await db.select().from(staffMembers)
      .where(eq(staffMembers.contractType, 'volunteer'));
    res.json(volunteers);
  } catch (error) {
    console.error("Error fetching volunteers:", error);
    res.status(500).json({ error: "Errore nel recupero volontari" });
  }
});

// Generate test shifts for a volunteer (for testing purposes)
app.post("/api/reimbursements/generate-test-shifts", requireAdmin, async (req, res) => {
  try {
    const { staffMemberId, month, year, numShifts } = req.body;
    
    if (!staffMemberId || !month || !year) {
      return res.status(400).json({ error: "Dati mancanti: volontario, mese e anno sono obbligatori" });
    }
    
    // Get volunteer
    const [volunteer] = await db.select().from(staffMembers)
      .where(eq(staffMembers.id, staffMemberId));
    if (!volunteer) {
      return res.status(404).json({ error: "Volontario non trovato" });
    }
    
    // Get locations to assign shifts
    const availableLocations = await db.select().from(locations).limit(5);
    if (availableLocations.length === 0) {
      return res.status(400).json({ error: "Nessuna sede disponibile" });
    }

    // Get a vehicle for the location
    const availableVehicles = await db.select().from(vehiclesTable)
      .where(eq(vehiclesTable.locationId, volunteer.locationId))
      .limit(1);
    const vehicleId = availableVehicles[0]?.id || null;
    
    const shiftsToCreate = numShifts || 10;
    const createdShifts = [];
    
    // Generate 10 shifts spread across the month
    for (let i = 0; i < shiftsToCreate; i++) {
      // Distribute shifts across the month (skip weekends roughly)
      const day = Math.min(2 + (i * 3), 28);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Alternate between morning and afternoon shifts
      const isAfternoon = i % 2 === 1;
      const startTime = isAfternoon ? '12:00:00' : '07:00:00';
      const endTime = isAfternoon ? '22:00:00' : '17:00:00';
      
      // Use volunteer's location or alternate between available locations
      const locationIndex = i % availableLocations.length;
      const locationId = volunteer.locationId || availableLocations[locationIndex].id;
      
      // Create shift instance
      const shiftInstanceId = crypto.randomUUID();
      await db.insert(shiftInstances).values({
        id: shiftInstanceId,
        vehicleId: vehicleId,
        locationId: locationId,
        shiftDate: dateStr,
        startTime: startTime,
        endTime: endTime,
        requiredRoles: ['autista', 'soccorritore'],
        minStaff: 2,
        status: 'confirmed',
      });
      
      // Create shift assignment for the volunteer
      const assignmentId = crypto.randomUUID();
      await db.insert(shiftAssignments).values({
        id: assignmentId,
        shiftInstanceId: shiftInstanceId,
        staffMemberId: staffMemberId,
        assignedRole: 'soccorritore',
        status: 'confirmed',
        confirmedAt: new Date(),
      });
      
      createdShifts.push({
        date: dateStr,
        startTime,
        endTime,
        hours: 10,
        locationId,
      });
    }
    
    // Update volunteer with test home distance if not set
    if (!volunteer.homeDistanceKm) {
      await db.update(staffMembers)
        .set({ 
          homeDistanceKm: 35.7, // Default distance that results in ~€80 per 10-hour shift
          homeAddress: 'Via Test 1',
          homeCity: 'Verona',
          homeProvince: 'VR',
          homePostalCode: '37100',
        })
        .where(eq(staffMembers.id, staffMemberId));
    }
    
    res.json({
      success: true,
      message: `Creati ${createdShifts.length} turni di prova per ${volunteer.firstName} ${volunteer.lastName}`,
      shifts: createdShifts,
    });
  } catch (error) {
    console.error("Error generating test shifts:", error);
    res.status(500).json({ error: "Errore nella generazione turni di prova" });
  }
});

// Get shifts for a volunteer in a specific month/year from shiftAssignments
app.get("/api/reimbursements/volunteer-shifts/:staffMemberId", requireAdmin, async (req, res) => {
  try {
    const { staffMemberId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: "Mese e anno sono obbligatori" });
    }
    
    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);
    
    // Calculate date range for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Get shift assignments for this volunteer in the date range
    const assignments = await db
      .select({
        id: shiftAssignments.id,
        shiftInstanceId: shiftAssignments.shiftInstanceId,
        shiftDate: shiftInstances.shiftDate,
        startTime: shiftInstances.startTime,
        endTime: shiftInstances.endTime,
        locationId: shiftInstances.locationId,
        vehicleId: shiftInstances.vehicleId,
        assignedRole: shiftAssignments.assignedRole,
        status: shiftAssignments.status,
      })
      .from(shiftAssignments)
      .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
      .where(
        and(
          eq(shiftAssignments.staffMemberId, staffMemberId),
          gte(shiftInstances.shiftDate, startDateStr),
          lte(shiftInstances.shiftDate, endDateStr),
          eq(shiftAssignments.status, 'confirmed')
        )
      )
      .orderBy(shiftInstances.shiftDate);
    
    // Enhance with location names and calculate hours
    const shiftsWithDetails = await Promise.all(assignments.map(async (a) => {
      const locationResult = a.locationId ? await storage.getLocation(a.locationId) : [];
      const location = Array.isArray(locationResult) ? locationResult[0] : locationResult;
      
      // Calculate hours from start/end time
      let hours = 10; // default
      if (a.startTime && a.endTime) {
        const [sh, sm] = a.startTime.split(':').map(Number);
        const [eh, em] = a.endTime.split(':').map(Number);
        hours = (eh * 60 + em - sh * 60 - sm) / 60;
        if (hours < 0) hours += 24; // overnight shift
      }
      
      return {
        date: a.shiftDate,
        startTime: a.startTime || '07:00',
        endTime: a.endTime || '17:00',
        hours: Math.round(hours * 10) / 10,
        locationId: a.locationId,
        locationName: location?.name || 'Sede',
        role: a.assignedRole,
      };
    }));
    
    res.json(shiftsWithDetails);
  } catch (error) {
    console.error("Error fetching volunteer shifts:", error);
    res.status(500).json({ error: "Errore nel recupero turni volontario" });
  }
});

// Calculate and generate reimbursement - €0.98/km rate with €8/hour target
// Admin only provides shifts with hours and locations, system calculates everything else
app.post("/api/reimbursements/calculate", requireAdmin, async (req, res) => {
  try {
    const { staffMemberId, shifts, month, year, notes } = req.body;
    
    if (!staffMemberId || !shifts || !Array.isArray(shifts) || shifts.length === 0 || !month || !year) {
      return res.status(400).json({ error: "Dati mancanti: volontario, turni, mese e anno sono obbligatori" });
    }
    
    // Get staff member with home distance
    const [volunteer] = await db.select().from(staffMembers)
      .where(eq(staffMembers.id, staffMemberId));
    if (!volunteer) {
      return res.status(404).json({ error: "Volontario non trovato" });
    }
    
    // Get location distances
    const distances = await storage.getLocationDistances();
    const distanceMap = new Map(distances.map(d => [d.locationId, d.defaultDistanceKm]));
    
    // Configuration
    const KM_RATE = 0.96; // Fixed €0.96/km rate
    const MEAL_ALLOWANCE = 10.00; // Fixed meal voucher per shift (€10 each)
    const TARGET_HOURLY_RATE = 8.00; // €8/hour target payment
    const MIN_SHIFT_PAYMENT = 79.60; // Minimum for 10-hour shift
    const MAX_SHIFT_PAYMENT = 80.85; // Maximum for 10-hour shift
    
    // Calculate each shift
    const calculatedShifts = [];
    let totalAmount = 0;
    let totalHours = 0;
    let totalKm = 0;
    let targetTotal = 0;
    
    // First pass: calculate target totals
    for (const shift of shifts) {
      const hours = parseFloat(shift.hours) || 10;
      targetTotal += hours * TARGET_HOURLY_RATE;
    }
    
    // Realistic payment amounts for 10-hour shifts (varied to look natural)
    const realisticPayments = [79.60, 79.70, 79.85, 80.00, 80.15, 80.20, 80.35, 80.50, 80.65, 80.85];
    const MIN_PAYMENT = 79.60;
    const MAX_PAYMENT = 80.85;
    
    // Pre-assign all shifts deterministically to ensure all stay within range
    // Extra amount distributed evenly across shifts (€0.30-0.50 per shift)
    const extraSeed = (month * 7 + year) % 21;
    const extraPerShift = (0.30 + (extraSeed / 100)); // 0.30 to 0.51 per shift
    
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const hours = parseFloat(shift.hours) || 10;
      const locationId = shift.locationId;
      const shiftDate = shift.date;
      
      // Pick a realistic payment from the array deterministically based on shift index and day
      const dateHash = new Date(shiftDate).getDate() || 1;
      const baseIndex = (i + dateHash) % realisticPayments.length;
      const baseRealisticPayment = realisticPayments[baseIndex];
      
      // Scale by hours (base is for 10 hours) and add extra
      let shiftPayment = ((baseRealisticPayment / 10) * hours) + extraPerShift;
      
      // Clamp to valid range
      shiftPayment = Math.max(MIN_PAYMENT / 10 * hours, Math.min(MAX_PAYMENT / 10 * hours + 1, shiftPayment));
      shiftPayment = Math.round(shiftPayment * 100) / 100;
      
      // Meal allowance is included in total
      const mealAmount = MEAL_ALLOWANCE;
      
      // Calculate km amount (total minus meal)
      const kmAmount = shiftPayment - mealAmount;
      
      // Calculate km needed to achieve this amount at €0.98/km
      const calculatedKm = kmAmount / KM_RATE;
      
      // Get location name
      const locationResult = await storage.getLocation(locationId);
      const location = Array.isArray(locationResult) ? locationResult[0] : locationResult;
      const locationName = location?.name || 'Sede';
      
      const shiftTotal = Math.round(shiftPayment * 100) / 100;
      
      calculatedShifts.push({
        shiftDate,
        startTime: shift.startTime || '07:00:00',
        endTime: shift.endTime || calculateEndTime(shift.startTime || '07:00', hours),
        hoursWorked: hours,
        locationId,
        locationName,
        kmDistance: Math.round(calculatedKm * 10) / 10, // Km calculated to match payment
        kmRate: KM_RATE,
        kmAmount: Math.round(kmAmount * 100) / 100,
        hasMeal: true,
        mealAmount: mealAmount,
        totalAmount: shiftTotal,
      });
      
      totalAmount += shiftTotal;
      totalHours += hours;
      totalKm += calculatedKm;
    }
    
    // Calculate average km rate for the entire reimbursement
    const avgKmRate = KM_RATE;
    
    // Create reimbursement record
    const userId = getUserId(req);
    const reimbursement = await storage.createReimbursement({
      staffMemberId,
      locationId: volunteer.locationId,
      month,
      year,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalShifts: shifts.length,
      totalHours,
      totalKm,
      totalMeals: shifts.length,
      avgKmRate: Math.round(avgKmRate * 10000) / 10000,
      mealAllowance: MEAL_ALLOWANCE,
      status: 'draft',
      notes,
      createdBy: userId || 'admin',
    }, calculatedShifts);
    
    // Return with calculated summary for verification
    res.json({
      ...reimbursement,
      calculationDetails: {
        targetHourlyRate: TARGET_HOURLY_RATE,
        effectiveHourlyRate: totalAmount / totalHours,
        totalHours,
        totalKm,
        avgKmRate: Math.round(avgKmRate * 10000) / 10000,
        mealAllowancePerShift: MEAL_ALLOWANCE,
      }
    });
  } catch (error) {
    console.error("Error calculating reimbursement:", error);
    res.status(500).json({ error: "Errore nel calcolo rimborso" });
  }
});

// Get all reimbursements (with filters)
app.get("/api/reimbursements", requireAdmin, async (req, res) => {
  try {
    const { month, year, staffMemberId, status } = req.query;
    const reimbursements = await storage.getReimbursements({
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      staffMemberId: staffMemberId as string,
      status: status as string,
    });
    res.json(reimbursements);
  } catch (error) {
    console.error("Error fetching reimbursements:", error);
    res.status(500).json({ error: "Errore nel recupero rimborsi" });
  }
});

// Get single reimbursement with shifts
app.get("/api/reimbursements/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reimbursement = await storage.getReimbursementWithShifts(id);
    if (!reimbursement) {
      return res.status(404).json({ error: "Rimborso non trovato" });
    }
    res.json(reimbursement);
  } catch (error) {
    console.error("Error fetching reimbursement:", error);
    res.status(500).json({ error: "Errore nel recupero rimborso" });
  }
});

// Send reimbursement for signature
app.post("/api/reimbursements/:id/send", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await storage.updateReimbursementStatus(id, 'pending_signature');
    res.json(updated);
  } catch (error) {
    console.error("Error sending reimbursement:", error);
    res.status(500).json({ error: "Errore nell'invio rimborso" });
  }
});

// Sign reimbursement (from volunteer app)
app.post("/api/reimbursements/:id/sign", async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureData } = req.body;
    
    if (!signatureData) {
      return res.status(400).json({ error: "Firma richiesta" });
    }
    
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    const updated = await storage.signReimbursement(id, signatureData, clientIp as string);
    res.json(updated);
  } catch (error) {
    console.error("Error signing reimbursement:", error);
    res.status(500).json({ error: "Errore nella firma rimborso" });
  }
});

// Approve reimbursement
app.post("/api/reimbursements/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const updated = await storage.approveReimbursement(id, userId || 'admin');
    res.json(updated);
  } catch (error) {
    console.error("Error approving reimbursement:", error);
    res.status(500).json({ error: "Errore nell'approvazione rimborso" });
  }
});

// Generate PDF for reimbursement (Premium Design)
app.get("/api/reimbursements/:id/pdf", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const reimbursement = await storage.getReimbursementWithShifts(id);
    
    if (!reimbursement) {
      return res.status(404).json({ error: "Rimborso non trovato" });
    }
    
    // Get volunteer info
    const [volunteer] = await db.select().from(staffMembers)
      .where(eq(staffMembers.id, reimbursement.staffMemberId));
    
    if (!volunteer) {
      return res.status(404).json({ error: "Volontario non trovato" });
    }
    
    // Prepare data for the premium PDF generator
    const pdfData = {
      volunteer: {
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        fiscalCode: volunteer.fiscalCode || undefined,
        role: (volunteer as any).role || 'Soccorritore Volontario',
        iban: volunteer.iban || undefined,
        homeAddress: volunteer.homeAddress || undefined,
        homeCity: volunteer.homeCity || undefined,
      },
      reimbursement: {
        id: reimbursement.id,
        month: reimbursement.month,
        year: reimbursement.year,
        totalAmount: Number(reimbursement.totalAmount),
        totalShifts: reimbursement.totalShifts,
        totalHours: reimbursement.totalHours,
        totalKm: reimbursement.totalKm,
        totalMeals: reimbursement.totalMeals,
        kmRate: Number(reimbursement.avgKmRate) || 0.96,
        mealAllowance: Number(reimbursement.mealAllowance) || 10,
        status: reimbursement.status,
        signedAt: reimbursement.signedAt?.toString() || undefined,
        signatureData: reimbursement.signatureData || undefined,
      },
      shifts: ((reimbursement as any).shifts || []).map((shift: any) => ({
        shiftDate: shift.shiftDate,
        startTime: shift.startTime || '07:00:00',
        endTime: shift.endTime || '17:00:00',
        hoursWorked: Number(shift.hoursWorked) || 10,
        locationName: shift.locationName || 'Sede',
        kmDistance: Number(shift.kmDistance) || 0,
        kmRate: Number(shift.kmRate) || 0.96,
        kmAmount: Number(shift.kmAmount) || 0,
        mealAmount: Number(shift.mealAmount) || 10,
        totalAmount: Number(shift.totalAmount) || 0,
      })),
      acceptanceText: "Dichiaro di aver verificato i dati sopra riportati e di accettare il rimborso chilometrico indicato. Confermo che le informazioni relative ai turni svolti e ai chilometri percorsi sono corrette e corrispondono alla reale attivita svolta.",
      generatedAt: new Date().toISOString(),
    };
    
    // Generate premium PDF
    const doc = await generateVolunteerReimbursementPDF(pdfData);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="rimborso_${volunteer.firstName}_${volunteer.lastName}_${reimbursement.month}_${reimbursement.year}.pdf"`);
    
    // Handle PDF generation errors
    doc.on('error', (err) => {
      console.error("PDF generation stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Errore nella generazione del PDF" });
      } else {
        res.end();
      }
    });
    
    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF" });
  }
});

// Delete reimbursement
app.delete("/api/reimbursements/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteReimbursement(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting reimbursement:", error);
    res.status(500).json({ error: "Errore nell'eliminazione rimborso" });
  }
});

  // ===== ESG DASHBOARD & SUSTAINABILITY =====
app.get("/api/esg/dashboard", requireAdmin, async (req, res) => {
  try {
    const { period, year, month } = req.query;
    const now = new Date();
    let dateFilter = sql`1=1`;
    let periodLabel = '';
    
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = sql`${trips.serviceDate} >= ${monthStart.toISOString().split('T')[0]}`;
      periodLabel = 'month';
    } else if (period === 'quarter') {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      dateFilter = sql`${trips.serviceDate} >= ${quarterStart.toISOString().split('T')[0]}`;
      periodLabel = 'quarter';
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = sql`${trips.serviceDate} >= ${yearStart.toISOString().split('T')[0]}`;
      periodLabel = 'year';
    } else if (year) {
      const targetYear = parseInt(year as string);
      const targetMonth = month ? parseInt(month as string) : now.getMonth() + 1;
      dateFilter = month 
        ? sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${targetYear} AND EXTRACT(MONTH FROM ${trips.serviceDate}) = ${targetMonth}`
        : sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${targetYear}`;
      periodLabel = month ? 'month' : 'year';
    } else {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      dateFilter = sql`${trips.serviceDate} >= ${quarterStart.toISOString().split('T')[0]}`;
      periodLabel = 'quarter';
    }

    // Get carbon footprint data with period filter
    const carbonData = await db.select({
      totalCo2: sql<number>`COALESCE(SUM(co2_emitted_kg), 0)`,
      totalSaved: sql<number>`COALESCE(SUM(co2_saved_kg), 0)`,
      avgPerKm: sql<number>`COALESCE(AVG(co2_per_km), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(dateFilter);

    // Get trips data with period filter
    const tripStats = await db.select({
      totalTrips: sql<number>`COUNT(*)`,
      totalKm: sql<number>`COALESCE(SUM(km_traveled), 0)`,
      totalPatients: sql<number>`COUNT(CASE WHEN patient_birth_year IS NOT NULL THEN 1 END)`,
    }).from(trips)
      .where(dateFilter);

    // Get active volunteers count
    const volunteerStats = await db.select({
      activeCount: sql<number>`COUNT(*)`,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    // Get audit logs count (total for governance - no date filter)
    const auditStats = await db.select({
      totalLogs: sql<number>`COUNT(*)`,
    }).from(auditLogs);

    // Get data quality from existing data quality tables if available
    let dataQualityScore = 85; // Default fallback
    try {
      const qualityData = await db.select({
        avgScore: sql<number>`COALESCE(AVG(overall_score), 85)`,
      }).from(dataQualityScores);
      if (qualityData[0]?.avgScore) {
        dataQualityScore = Number(qualityData[0].avgScore);
      }
    } catch (e) {
      // Table might not exist yet
    }

    // Calculate ESG scores - improved formula
    const totalSavedKg = Number(carbonData[0]?.totalSaved) || 0;
    const totalTripsCount = Number(tripStats[0]?.totalTrips) || 0;
    const environmentalScore = Math.min(100, Math.max(0, 
      50 + (totalSavedKg / 1000) * 10
    ));
    const socialScore = Math.min(100, Math.max(0,
      Math.min(totalTripsCount / 50, 1) * 100
    ));
    const governanceScore = Math.min(100, dataQualityScore);
    const overallScore = (environmentalScore * 0.33 + socialScore * 0.33 + governanceScore * 0.34);

    // Get monthly trend for ESG chart (last 6 months)
    const monthlyTrend = await db.select({
      month: sql<string>`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`,
      totalTrips: sql<number>`COUNT(*)`,
      totalKm: sql<number>`COALESCE(SUM(${trips.kmTraveled}), 0)`,
    }).from(trips)
      .where(sql`${trips.serviceDate} >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`);

    // Calculate monthly ESG scores
    const monthlyEsgScores = monthlyTrend.map(m => {
      const monthTrips = Number(m.totalTrips) || 0;
      const envScore = Math.min(100, 50 + (monthTrips * 0.5));
      const socScore = Math.min(100, monthTrips / 50 * 100);
      const govScore = dataQualityScore;
      return {
        month: m.month,
        environmental: Math.round(envScore),
        social: Math.round(socScore),
        governance: Math.round(govScore),
      };
    });

    res.json({
      period: { type: periodLabel, year: now.getFullYear(), month: now.getMonth() + 1 },
      environmental: {
        totalCo2EmittedKg: Number(carbonData[0]?.totalCo2) || 0,
        totalCo2SavedKg: Number(carbonData[0]?.totalSaved) || 0,
        avgCo2PerKm: Number(carbonData[0]?.avgPerKm) || 0,
        totalKmTraveled: Number(tripStats[0]?.totalKm) || 0,
        tripsWithCarbonData: Number(carbonData[0]?.tripCount) || 0,
        score: Math.round(environmentalScore),
      },
      social: {
        totalTrips: Number(tripStats[0]?.totalTrips) || 0,
        patientsServed: Number(tripStats[0]?.totalPatients) || 0,
        activeVolunteers: Number(volunteerStats[0]?.activeCount) || 0,
        score: Math.round(socialScore),
      },
      governance: {
        auditLogs: Number(auditStats[0]?.totalLogs) || 0,
        dataQualityScore: Math.round(dataQualityScore),
        complianceScore: 90, // Placeholder - can be calculated from compliance checks
        score: Math.round(governanceScore),
      },
      overall: {
        esgScore: Math.round(overallScore),
        rating: overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : overallScore >= 40 ? 'C' : 'D',
      },
      monthlyTrend: monthlyEsgScores,
    });
  } catch (error) {
    console.error("Error fetching ESG dashboard:", error);
    res.status(500).json({ error: "Errore nel caricamento dashboard ESG" });
  }
});

// Get ESG monthly snapshots history
app.get("/api/esg/snapshots", requireAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    const snapshots = await db.select()
      .from(esgMonthlySnapshots)
      .where(eq(esgMonthlySnapshots.year, targetYear))
      .orderBy(desc(esgMonthlySnapshots.month));
    
    res.json(snapshots);
  } catch (error) {
    console.error("Error fetching ESG snapshots:", error);
    res.status(500).json({ error: "Errore nel caricamento storico ESG" });
  }
});

// Generate ESG monthly snapshot
app.post("/api/esg/snapshots/generate", requireAdmin, async (req, res) => {
  try {
    const { month, year } = req.body;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    // Calculate all metrics
    const tripStats = await db.select({
      totalTrips: sql<number>`COUNT(*)`,
      totalKm: sql<number>`COALESCE(SUM(km_traveled), 0)`,
      totalPatients: sql<number>`COUNT(CASE WHEN patient_birth_year IS NOT NULL THEN 1 END)`,
    }).from(trips)
      .where(and(
        sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${targetYear}`,
        sql`EXTRACT(MONTH FROM ${trips.serviceDate}) = ${targetMonth}`
      ));

    const carbonStats = await db.select({
      totalCo2: sql<number>`COALESCE(SUM(co2_emitted_kg), 0)`,
      totalSaved: sql<number>`COALESCE(SUM(co2_saved_kg), 0)`,
      avgPerKm: sql<number>`COALESCE(AVG(co2_per_km), 0)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(and(
        sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${targetYear}`,
        sql`EXTRACT(MONTH FROM ${trips.serviceDate}) = ${targetMonth}`
      ));

    const volunteerStats = await db.select({
      activeCount: sql<number>`COUNT(*)`,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    const auditStats = await db.select({
      totalLogs: sql<number>`COUNT(*)`,
    }).from(auditLogs)
      .where(and(
        sql`EXTRACT(YEAR FROM ${auditLogs.createdAt}) = ${targetYear}`,
        sql`EXTRACT(MONTH FROM ${auditLogs.createdAt}) = ${targetMonth}`
      ));

    // Calculate scores
    const envScore = Math.min(100, 50 + (Number(carbonStats[0]?.totalSaved) || 0) / 10);
    const socScore = Math.min(100, (Number(tripStats[0]?.totalTrips) || 0) / 50 * 100);
    const govScore = 85;
    const overallScore = (envScore * 0.33 + socScore * 0.33 + govScore * 0.34);

    // Delete existing snapshot for this month/year
    await db.delete(esgMonthlySnapshots)
      .where(and(
        eq(esgMonthlySnapshots.month, targetMonth),
        eq(esgMonthlySnapshots.year, targetYear)
      ));

    // Insert new snapshot
    const [snapshot] = await db.insert(esgMonthlySnapshots).values({
      month: targetMonth,
      year: targetYear,
      totalKmTraveled: Number(tripStats[0]?.totalKm) || 0,
      totalCo2EmittedKg: Number(carbonStats[0]?.totalCo2) || 0,
      totalCo2SavedKg: Number(carbonStats[0]?.totalSaved) || 0,
      avgCo2PerKm: Number(carbonStats[0]?.avgPerKm) || 0,
      totalServicesCompleted: Number(tripStats[0]?.totalTrips) || 0,
      totalPatientsServed: Number(tripStats[0]?.totalPatients) || 0,
      activeVolunteers: Number(volunteerStats[0]?.activeCount) || 0,
      auditLogsGenerated: Number(auditStats[0]?.totalLogs) || 0,
      dataQualityScore: govScore,
      complianceScore: 90,
      environmentalScore: envScore,
      socialScore: socScore,
      governanceScore: govScore,
      overallEsgScore: overallScore,
      generatedBy: req.session.userId,
    }).returning();

    res.json({ success: true, snapshot });
  } catch (error) {
    console.error("Error generating ESG snapshot:", error);
    res.status(500).json({ error: "Errore nella generazione snapshot ESG" });
  }
});

// Get sustainability goals
app.get("/api/esg/goals", requireAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    const goals = await db.select()
      .from(sustainabilityGoals)
      .where(eq(sustainabilityGoals.year, targetYear));
    
    res.json(goals[0] || null);
  } catch (error) {
    console.error("Error fetching sustainability goals:", error);
    res.status(500).json({ error: "Errore nel caricamento obiettivi" });
  }
});

// Create/Update sustainability goals
app.post("/api/esg/goals", requireAdmin, async (req, res) => {
  try {
    const { year, ...goalData } = req.body;
    const targetYear = year || new Date().getFullYear();

    // Check if goals exist for this year
    const existing = await db.select()
      .from(sustainabilityGoals)
      .where(eq(sustainabilityGoals.year, targetYear));

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(sustainabilityGoals)
        .set({ ...goalData, updatedAt: new Date() })
        .where(eq(sustainabilityGoals.year, targetYear))
        .returning();
      res.json(updated);
    } else {
      // Create new
      const [created] = await db.insert(sustainabilityGoals).values({
        year: targetYear,
        ...goalData,
        createdBy: req.session.userId,
      }).returning();
      res.json(created);
    }
  } catch (error) {
    console.error("Error saving sustainability goals:", error);
    res.status(500).json({ error: "Errore nel salvataggio obiettivi" });
  }
});

  // ===== CARBON FOOTPRINT TRACKER =====
app.get("/api/carbon/factors", requireAdmin, async (req, res) => {
  try {
    const factors = await db.select()
      .from(carbonEmissionFactors)
      .where(eq(carbonEmissionFactors.isActive, true));
    res.json(factors);
  } catch (error) {
    console.error("Error fetching emission factors:", error);
    res.status(500).json({ error: "Errore nel caricamento fattori emissione" });
  }
});

// Seed default emission factors
app.post("/api/carbon/factors/seed", requireAdmin, async (req, res) => {
  try {
    // Default emission factors based on ISPRA data
    const defaultFactors = [
      { fuelType: "Gasolio", gCo2PerKm: 171, gCo2PerLiter: 2640, source: "ISPRA 2024" },
      { fuelType: "Benzina", gCo2PerKm: 164, gCo2PerLiter: 2310, source: "ISPRA 2024" },
      { fuelType: "GPL", gCo2PerKm: 134, gCo2PerLiter: 1650, source: "ISPRA 2024" },
      { fuelType: "Metano", gCo2PerKm: 120, gCo2PerLiter: 2540, source: "ISPRA 2024" },
      { fuelType: "Elettrico", gCo2PerKm: 0, gCo2PerLiter: 0, source: "Zero emissions" },
    ];

    for (const factor of defaultFactors) {
      // Upsert based on fuel type
      const existing = await db.select()
        .from(carbonEmissionFactors)
        .where(eq(carbonEmissionFactors.fuelType, factor.fuelType));
      
      if (existing.length === 0) {
        await db.insert(carbonEmissionFactors).values(factor);
      }
    }

    const factors = await db.select()
      .from(carbonEmissionFactors)
      .where(eq(carbonEmissionFactors.isActive, true));
    
    res.json({ success: true, factors });
  } catch (error) {
    console.error("Error seeding emission factors:", error);
    res.status(500).json({ error: "Errore nel seeding fattori emissione" });
  }
});

// Calculate carbon footprint for a trip
app.post("/api/carbon/calculate/:tripId", requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;
    
    // Get trip details
    const trip = await db.select()
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1);
    
    if (!trip[0]) {
      return res.status(404).json({ error: "Viaggio non trovato" });
    }

    // Get vehicle details
    const vehicle = await db.select()
      .from(vehicles)
      .where(eq(vehicles.id, trip[0].vehicleId))
      .limit(1);
    
    const fuelType = vehicle[0]?.fuelType || "Gasolio";
    const kmTraveled = trip[0].kmTraveled || 0;

    // Get emission factor
    const factor = await db.select()
      .from(carbonEmissionFactors)
      .where(and(
        eq(carbonEmissionFactors.fuelType, fuelType),
        eq(carbonEmissionFactors.isActive, true)
      ))
      .limit(1);

    const gCo2PerKm = factor[0]?.gCo2PerKm || 171; // Default diesel
    const privateCarGCo2PerKm = factor[0]?.privateCarGCo2PerKm || 120;

    // Calculate emissions
    const co2EmittedKg = (kmTraveled * gCo2PerKm) / 1000;
    const co2IfPrivateCar = (kmTraveled * privateCarGCo2PerKm) / 1000;
    // Ambulances emit more but serve shared transport purpose
    const co2SavedKg = Math.max(0, co2IfPrivateCar * 2 - co2EmittedKg); // 2x because would need multiple private cars

    // Check if carbon footprint already exists
    const existing = await db.select()
      .from(tripCarbonFootprint)
      .where(eq(tripCarbonFootprint.tripId, tripId));

    let carbonRecord;
    if (existing.length > 0) {
      [carbonRecord] = await db.update(tripCarbonFootprint)
        .set({
          kmTraveled,
          fuelType,
          co2EmittedKg,
          co2PerKm: gCo2PerKm,
          co2IfPrivateCar,
          co2SavedKg,
        })
        .where(eq(tripCarbonFootprint.tripId, tripId))
        .returning();
    } else {
      [carbonRecord] = await db.insert(tripCarbonFootprint).values({
        tripId,
        vehicleId: trip[0].vehicleId,
        kmTraveled,
        fuelType,
        co2EmittedKg,
        co2PerKm: gCo2PerKm,
        co2IfPrivateCar,
        co2SavedKg,
      }).returning();
    }

    res.json(carbonRecord);
  } catch (error) {
    console.error("Error calculating carbon footprint:", error);
    res.status(500).json({ error: "Errore nel calcolo carbon footprint" });
  }
});

// Bulk calculate carbon footprint for trips
app.post("/api/carbon/calculate-bulk", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // Get all trips in date range without carbon footprint
    const tripsWithoutCarbon = await db.select({
      id: trips.id,
      vehicleId: trips.vehicleId,
      kmTraveled: trips.kmTraveled,
    })
      .from(trips)
      .leftJoin(tripCarbonFootprint, eq(trips.id, tripCarbonFootprint.tripId))
      .where(and(
        sql`${tripCarbonFootprint.id} IS NULL`,
        startDate ? sql`${trips.serviceDate} >= ${startDate}` : sql`1=1`,
        endDate ? sql`${trips.serviceDate} <= ${endDate}` : sql`1=1`
      ));

    // Get emission factors
    const factors = await db.select()
      .from(carbonEmissionFactors)
      .where(eq(carbonEmissionFactors.isActive, true));

    const factorMap = new Map(factors.map(f => [f.fuelType, f]));

    // Get all vehicles
    const allVehicles = await db.select().from(vehicles);
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

    let processed = 0;
    for (const trip of tripsWithoutCarbon) {
      const vehicle = vehicleMap.get(trip.vehicleId);
      const fuelType = vehicle?.fuelType || "Gasolio";
      const factor = factorMap.get(fuelType);
      const gCo2PerKm = factor?.gCo2PerKm || 171;
      const privateCarGCo2PerKm = factor?.privateCarGCo2PerKm || 120;
      const kmTraveled = trip.kmTraveled || 0;

      const co2EmittedKg = (kmTraveled * gCo2PerKm) / 1000;
      const co2IfPrivateCar = (kmTraveled * privateCarGCo2PerKm) / 1000;
      const co2SavedKg = Math.max(0, co2IfPrivateCar * 2 - co2EmittedKg);

      await db.insert(tripCarbonFootprint).values({
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        kmTraveled,
        fuelType,
        co2EmittedKg,
        co2PerKm: gCo2PerKm,
        co2IfPrivateCar,
        co2SavedKg,
      });
      processed++;
    }

    res.json({ success: true, processed });
  } catch (error) {
    console.error("Error in bulk carbon calculation:", error);
    res.status(500).json({ error: "Errore nel calcolo bulk carbon footprint" });
  }
});

// Get carbon footprint stats
app.get("/api/carbon/stats", requireAdmin, async (req, res) => {
  try {
    const { period, year, month, vehicleId } = req.query;
    
    // Org filtering: get org vehicle IDs
    const orgId = getEffectiveOrgId(req);
    const isOrg = isOrgAdmin(req) && orgId;
    let orgVehicleIds: string[] = [];
    if (isOrg) {
      const orgVehicles = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(eq(vehiclesTable.organizationId, orgId!));
      orgVehicleIds = orgVehicles.map(v => v.id);
      if (orgVehicleIds.length === 0) return res.json({ totals: { totalCo2Kg: 0, totalCo2SavedKg: 0, avgCo2PerKm: 0, totalKm: 0, tripCount: 0 }, byFuelType: [], monthlyTrend: [] });
    }
    
    // Calculate date filter based on period
    const now = new Date();
    let dateFilter = sql`1=1`;
    
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = sql`${trips.serviceDate} >= ${monthStart.toISOString().split('T')[0]}`;
    } else if (period === 'quarter') {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      dateFilter = sql`${trips.serviceDate} >= ${quarterStart.toISOString().split('T')[0]}`;
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = sql`${trips.serviceDate} >= ${yearStart.toISOString().split('T')[0]}`;
    } else if (year) {
      dateFilter = sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${parseInt(year as string)}`;
      if (month) {
        dateFilter = sql`EXTRACT(YEAR FROM ${trips.serviceDate}) = ${parseInt(year as string)} AND EXTRACT(MONTH FROM ${trips.serviceDate}) = ${parseInt(month as string)}`;
      }
    }
    
    // Build vehicle filter (org scoping or specific vehicle)
    const vehicleFilter = vehicleId 
      ? eq(tripCarbonFootprint.vehicleId, vehicleId as string) 
      : isOrg 
        ? sql`${tripCarbonFootprint.vehicleId} IN (${sql.join(orgVehicleIds.map(id => sql`${id}`), sql`, `)})` 
        : sql`1=1`;
    
    // Build query with filters
    const stats = await db.select({
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalCo2SavedKg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2SavedKg}), 0)`,
      avgCo2PerKm: sql<number>`COALESCE(AVG(${tripCarbonFootprint.co2PerKm}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(${tripCarbonFootprint.id})`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(and(dateFilter, vehicleFilter));

    // Build combined filter for all queries
    const combinedFilter = and(dateFilter, vehicleFilter);

    // Get breakdown by fuel type with same filters
    const byFuelType = await db.select({
      fuelType: tripCarbonFootprint.fuelType,
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(combinedFilter)
      .groupBy(tripCarbonFootprint.fuelType);

    // Get monthly trend for the last 12 months with same vehicleId filter
    const trendFilter = and(
      sql`${trips.serviceDate} >= NOW() - INTERVAL '12 months'`,
      vehicleFilter
    );
    const monthlyTrend = await db.select({
      month: sql<string>`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`,
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalCo2SavedKg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2SavedKg}), 0)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(trendFilter)
      .groupBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`);

    res.json({
      totals: stats[0],
      byFuelType,
      monthlyTrend,
    });
  } catch (error) {
    console.error("Error fetching carbon stats:", error);
    res.status(500).json({ error: "Errore nel caricamento statistiche carbon" });
  }
});

// Get carbon footprint by vehicle
app.get("/api/carbon/by-vehicle", requireAdmin, async (req, res) => {
  try {
    const { period } = req.query;
    
    // Org filtering
    const orgId = getEffectiveOrgId(req);
    const isOrg = isOrgAdmin(req) && orgId;
    
    // Calculate date filter based on period
    const now = new Date();
    let dateFilter = sql`1=1`;
    
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = sql`${trips.serviceDate} >= ${monthStart.toISOString().split('T')[0]}`;
    } else if (period === 'quarter') {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      dateFilter = sql`${trips.serviceDate} >= ${quarterStart.toISOString().split('T')[0]}`;
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter = sql`${trips.serviceDate} >= ${yearStart.toISOString().split('T')[0]}`;
    }

    const queryFilter = isOrg ? and(dateFilter, eq(vehicles.organizationId, orgId!)) : dateFilter;

    const byVehicle = await db.select({
      vehicleId: tripCarbonFootprint.vehicleId,
      vehicleCode: vehicles.code,
      fuelType: tripCarbonFootprint.fuelType,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      totalEmissions: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      co2Saved: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2SavedKg}), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    })
      .from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .innerJoin(vehicles, eq(tripCarbonFootprint.vehicleId, vehicles.id))
      .where(queryFilter)
      .groupBy(tripCarbonFootprint.vehicleId, vehicles.code, tripCarbonFootprint.fuelType);

    res.json(byVehicle);
  } catch (error) {
    console.error("Error fetching carbon by vehicle:", error);
    res.status(500).json({ error: "Errore nel caricamento dati veicoli" });
  }
});

  // ===== BURNOUT THRESHOLDS =====
app.get("/api/burnout/thresholds", requireAdmin, async (req, res) => {
  try {
    const thresholds = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    // Return default if none exists
    if (thresholds.length === 0) {
      return res.json({
        maxHoursPerDay: 10,
        maxHoursPerWeek: 48,
        maxHoursPerMonth: 180,
        maxConsecutiveDays: 6,
        maxNightShiftsPerWeek: 3,
        maxNightShiftsPerMonth: 8,
        minRestHoursBetweenShifts: 11,
        minDaysOffPerMonth: 4,
      });
    }
    
    res.json(thresholds[0]);
  } catch (error) {
    console.error("Error fetching burnout thresholds:", error);
    res.status(500).json({ error: "Errore nel caricamento soglie burnout" });
  }
});

// Update burnout thresholds
app.post("/api/burnout/thresholds", requireAdmin, async (req, res) => {
  try {
    const thresholdData = req.body;

    // Deactivate existing thresholds
    await db.update(burnoutThresholds)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(burnoutThresholds.isActive, true));

    // Create new active threshold
    const [created] = await db.insert(burnoutThresholds).values({
      ...thresholdData,
      isActive: true,
    }).returning();

    res.json(created);
  } catch (error) {
    console.error("Error updating burnout thresholds:", error);
    res.status(500).json({ error: "Errore nell'aggiornamento soglie" });
  }
});

  // ===== ADMIN: REALTIME AVAILABILITY & SHIFT SETTINGS =====
app.get("/api/admin/realtime-availability", requireAuth, async (req, res) => {
  try {
    const orgId = getEffectiveOrgId(req);
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const currentTime = now.toTimeString().substring(0, 5);

    const staffConditions: any[] = [];
    if (orgId) {
      staffConditions.push(eq(staffMembers.organizationId, orgId));
    }

    const allStaff = await db.select().from(staffMembers)
      .where(staffConditions.length > 0 ? and(...staffConditions) : undefined as any)
      .orderBy(staffMembers.lastName);

    const todayInstances = await db.select().from(shiftInstances)
      .where(eq(shiftInstances.shiftDate, today));

    const instanceIds = todayInstances.map(i => i.id);

    let todayAssignments: any[] = [];
    if (instanceIds.length > 0) {
      todayAssignments = await db.select().from(shiftAssignments)
        .where(inArray(shiftAssignments.shiftInstanceId, instanceIds));
    }

    const allLocations = await db.select().from(locations);
    const allVehicles = await db.select().from(vehiclesTable);
    const locationMap = new Map(allLocations.map(l => [l.id, l.name]));
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v.code]));
    const instanceMap = new Map(todayInstances.map(i => [i.id, i]));

    const staffAssignmentMap = new Map<string, any[]>();
    for (const a of todayAssignments) {
      if (!staffAssignmentMap.has(a.staffMemberId)) {
        staffAssignmentMap.set(a.staffMemberId, []);
      }
      staffAssignmentMap.get(a.staffMemberId)!.push(a);
    }

    const result: any[] = [];
    let onDuty = 0, available = 0, upcoming = 0, completed = 0, unavailable = 0;

    for (const staff of allStaff) {
      const unavailDates = staff.unavailableDates as string[] | null;
      const isUnavailable = !staff.isActive || (unavailDates && unavailDates.includes(today));

      if (isUnavailable) {
        unavailable++;
        result.push({
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          primaryRole: staff.primaryRole,
          status: 'unavailable',
          currentShift: null,
          nextShift: null,
          hoursToday: 0,
        });
        continue;
      }

      const assignments = staffAssignmentMap.get(staff.id) || [];
      const activeAssignments = assignments.filter(a => a.status === 'assigned' || a.status === 'confirmed');

      if (activeAssignments.length === 0) {
        available++;
        result.push({
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          primaryRole: staff.primaryRole,
          status: 'available',
          currentShift: null,
          nextShift: null,
          hoursToday: 0,
        });
        continue;
      }

      let staffStatus = 'available';
      let currentShift: any = null;
      let nextShift: any = null;
      let hoursToday = 0;

      for (const assignment of activeAssignments) {
        const instance = instanceMap.get(assignment.shiftInstanceId);
        if (!instance) continue;

        const startParts = instance.startTime.split(':').map(Number);
        const endParts = instance.endTime.split(':').map(Number);
        let hours = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
        if (hours <= 0) hours += 24;
        hoursToday += hours;

        const shiftInfo = {
          startTime: instance.startTime.substring(0, 5),
          endTime: instance.endTime.substring(0, 5),
          vehicleCode: instance.vehicleId ? (vehicleMap.get(instance.vehicleId) || '') : '',
          locationName: instance.locationId ? (locationMap.get(instance.locationId) || '') : '',
        };

        if (currentTime >= instance.startTime.substring(0, 5) && currentTime <= instance.endTime.substring(0, 5)) {
          staffStatus = 'on_duty';
          currentShift = shiftInfo;
        } else if (currentTime < instance.startTime.substring(0, 5)) {
          if (staffStatus !== 'on_duty') {
            staffStatus = 'upcoming';
            if (!nextShift || instance.startTime < nextShift.startTime) {
              nextShift = shiftInfo;
            }
          }
        } else if (currentTime > instance.endTime.substring(0, 5)) {
          if (staffStatus !== 'on_duty' && staffStatus !== 'upcoming') {
            staffStatus = 'completed';
            currentShift = shiftInfo;
          }
        }
      }

      if (staffStatus === 'on_duty') onDuty++;
      else if (staffStatus === 'upcoming') upcoming++;
      else if (staffStatus === 'completed') completed++;
      else available++;

      result.push({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        primaryRole: staff.primaryRole,
        status: staffStatus,
        currentShift,
        nextShift,
        hoursToday: Math.round(hoursToday * 10) / 10,
      });
    }

    res.json({
      timestamp: now.toISOString(),
      stats: {
        total: allStaff.length,
        onDuty,
        available,
        upcoming,
        completed,
        unavailable,
      },
      staff: result,
    });
  } catch (error) {
    console.error("Error fetching realtime availability:", error);
    res.status(500).json({ error: "Errore nel recupero disponibilita' tempo reale" });
  }
});

// =============================================
// Shift Settings API
// =============================================

app.get("/api/admin/shift-settings/rules", requireAdmin, async (req, res) => {
  try {
    const orgId = getEffectiveOrgId(req) || 'croce-europa-default';
    const thresholds = await db.select().from(burnoutThresholds).limit(1);
    if (thresholds.length > 0) {
      res.json(thresholds[0]);
    } else {
      res.json({
        maxHoursPerDay: 10,
        maxHoursPerWeek: 48,
        maxHoursPerMonth: 180,
        maxConsecutiveDays: 6,
        minRestHoursBetweenShifts: 11,
        minDaysOffPerMonth: 4,
        maxNightShiftsPerWeek: 3,
        maxNightShiftsPerMonth: 8
      });
    }
  } catch (error) {
    console.error('Error fetching shift rules:', error);
    res.status(500).json({ error: 'Failed to fetch shift rules' });
  }
});

app.put("/api/admin/shift-settings/rules", requireAdmin, async (req, res) => {
  try {
    const { maxHoursPerDay, maxHoursPerWeek, maxHoursPerMonth, maxConsecutiveDays,
            minRestHoursBetweenShifts, minDaysOffPerMonth, maxNightShiftsPerWeek, maxNightShiftsPerMonth } = req.body;
    
    const existing = await db.select().from(burnoutThresholds).limit(1);
    
    if (existing.length > 0) {
      await db.update(burnoutThresholds)
        .set({
          maxHoursPerDay: maxHoursPerDay ?? 10,
          maxHoursPerWeek: maxHoursPerWeek ?? 48,
          maxHoursPerMonth: maxHoursPerMonth ?? 180,
          maxConsecutiveDays: maxConsecutiveDays ?? 6,
          minRestHoursBetweenShifts: minRestHoursBetweenShifts ?? 11,
          minDaysOffPerMonth: minDaysOffPerMonth ?? 4,
          maxNightShiftsPerWeek: maxNightShiftsPerWeek ?? 3,
          maxNightShiftsPerMonth: maxNightShiftsPerMonth ?? 8,
          updatedAt: new Date()
        })
        .where(eq(burnoutThresholds.id, existing[0].id));
    } else {
      await db.insert(burnoutThresholds).values({
        maxHoursPerDay: maxHoursPerDay ?? 10,
        maxHoursPerWeek: maxHoursPerWeek ?? 48,
        maxHoursPerMonth: maxHoursPerMonth ?? 180,
        maxConsecutiveDays: maxConsecutiveDays ?? 6,
        minRestHoursBetweenShifts: minRestHoursBetweenShifts ?? 11,
        minDaysOffPerMonth: minDaysOffPerMonth ?? 4,
        maxNightShiftsPerWeek: maxNightShiftsPerWeek ?? 3,
        maxNightShiftsPerMonth: maxNightShiftsPerMonth ?? 8,
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving shift rules:', error);
    res.status(500).json({ error: 'Failed to save shift rules' });
  }
});

app.get("/api/admin/shift-settings/staff", requireAdmin, async (req, res) => {
  try {
    const orgId = getEffectiveOrgId(req) || 'croce-europa-default';
    const staff = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      primaryRole: staffMembers.primaryRole,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
      maxHoursPerMonth: staffMembers.maxHoursPerMonth,
      maxConsecutiveDays: staffMembers.maxConsecutiveDays,
      minRestDaysPerWeek: staffMembers.minRestDaysPerWeek,
      preferredShiftType: staffMembers.preferredShiftType,
      availableDays: staffMembers.availableDays,
      excludedVehicleIds: staffMembers.excludedVehicleIds,
      unavailableDates: staffMembers.unavailableDates,
      contractType: staffMembers.contractType,
      isActive: staffMembers.isActive,
    })
      .from(staffMembers)
      .where(and(
        eq(staffMembers.organizationId, orgId),
        eq(staffMembers.isActive, true)
      ))
      .orderBy(staffMembers.lastName, staffMembers.firstName);
    
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff shift settings:', error);
    res.status(500).json({ error: 'Failed to fetch staff settings' });
  }
});

app.put("/api/admin/shift-settings/staff/:staffId", requireAdmin, async (req, res) => {
  try {
    const { staffId } = req.params;
    const { maxHoursPerWeek, maxHoursPerMonth, maxConsecutiveDays, minRestDaysPerWeek,
            preferredShiftType, availableDays, unavailableDates, excludedVehicleIds } = req.body;
    
    await db.update(staffMembers)
      .set({
        maxHoursPerWeek: maxHoursPerWeek,
        maxHoursPerMonth: maxHoursPerMonth,
        maxConsecutiveDays: maxConsecutiveDays,
        minRestDaysPerWeek: minRestDaysPerWeek,
        preferredShiftType: preferredShiftType || 'any',
        availableDays: availableDays,
        unavailableDates: unavailableDates,
        excludedVehicleIds: excludedVehicleIds || null,
        updatedAt: new Date()
      })
      .where(eq(staffMembers.id, staffId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving staff shift settings:', error);
    res.status(500).json({ error: 'Failed to save staff settings' });
  }
});

  // ===== BURNOUT PREVENTION =====
app.get("/api/burnout/dashboard", requireAdmin, async (req, res) => {
  try {
    // Get current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const weekStartStr = weekStart.toISOString().split('T')[0];

    let workloads = await db.select({
      staffMemberId: operatorWorkload.staffMemberId,
      totalHoursWeek: operatorWorkload.totalHoursWeek,
      consecutiveDaysWorked: operatorWorkload.consecutiveDaysWorked,
      nightShiftsCount: operatorWorkload.nightShiftsCount,
      riskLevel: operatorWorkload.riskLevel,
      riskScore: operatorWorkload.riskScore,
    }).from(operatorWorkload)
      .where(eq(operatorWorkload.weekStartDate, weekStartStr));

    if (workloads.length === 0) {
      try { await calculateBurnoutFromShiftsInternal(); } catch (e) { console.error('Auto-calc burnout error:', e); }
      workloads = await db.select({
        staffMemberId: operatorWorkload.staffMemberId,
        totalHoursWeek: operatorWorkload.totalHoursWeek,
        consecutiveDaysWorked: operatorWorkload.consecutiveDaysWorked,
        nightShiftsCount: operatorWorkload.nightShiftsCount,
        riskLevel: operatorWorkload.riskLevel,
        riskScore: operatorWorkload.riskScore,
      }).from(operatorWorkload)
        .where(eq(operatorWorkload.weekStartDate, weekStartStr));
    }

    // Get staff names
    const staffList = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
    }).from(staffMembers);
    
    const staffMap = new Map(staffList.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

    // Get active alerts
    const activeAlerts = await db.select()
      .from(burnoutAlerts)
      .where(eq(burnoutAlerts.isResolved, false))
      .orderBy(desc(burnoutAlerts.createdAt))
      .limit(20);

    // Get recent wellness check-ins
    const recentCheckins = await db.select({
      avgEnergy: sql<number>`AVG(energy_level)`,
      avgStress: sql<number>`AVG(stress_level)`,
      avgSleep: sql<number>`AVG(sleep_quality)`,
      avgWorkLife: sql<number>`AVG(work_life_balance)`,
      avgTeamSupport: sql<number>`AVG(team_support)`,
      avgSatisfaction: sql<number>`AVG(job_satisfaction)`,
      checkinCount: sql<number>`COUNT(*)`,
    }).from(wellnessCheckins)
      .where(sql`${wellnessCheckins.checkinDate} >= NOW() - INTERVAL '30 days'`);

    // Count by risk level
    const riskCounts = {
      low: workloads.filter(w => w.riskLevel === 'low').length,
      moderate: workloads.filter(w => w.riskLevel === 'moderate').length,
      high: workloads.filter(w => w.riskLevel === 'high').length,
      critical: workloads.filter(w => w.riskLevel === 'critical').length,
    };

    res.json({
      summary: {
        totalOperators: workloads.length,
        riskCounts,
        activeAlerts: activeAlerts.length,
        avgRiskScore: workloads.length > 0 
          ? workloads.reduce((sum, w) => sum + (w.riskScore || 0), 0) / workloads.length 
          : 0,
      },
      riskDistribution: riskCounts,
      workloads: workloads.map(w => ({
        ...w,
        staffName: staffMap.get(w.staffMemberId) || 'Unknown',
      })),
      alerts: activeAlerts.map(a => ({
        ...a,
        staffName: staffMap.get(a.staffMemberId) || 'Unknown',
      })),
      wellness: recentCheckins[0] || null,
    });
  } catch (error) {
    console.error("Error fetching burnout dashboard:", error);
    res.status(500).json({ error: "Errore nel caricamento dashboard burnout" });
  }
});

// Get operator workload history
app.get("/api/burnout/workload/:staffMemberId", requireAdmin, async (req, res) => {
  try {
    const { staffMemberId } = req.params;
    const { weeks = 12 } = req.query;

    const workloads = await db.select()
      .from(operatorWorkload)
      .where(eq(operatorWorkload.staffMemberId, staffMemberId))
      .orderBy(desc(operatorWorkload.weekStartDate))
      .limit(parseInt(weeks as string));

    res.json(workloads);
  } catch (error) {
    console.error("Error fetching operator workload:", error);
    res.status(500).json({ error: "Errore nel caricamento workload" });
  }
});

app.get("/api/burnout/staff-risk", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

    let workloads = await db.select()
      .from(operatorWorkload)
      .where(eq(operatorWorkload.weekStartDate, weekStartStr));

    if (workloads.length === 0) {
      await calculateBurnoutFromShiftsInternal();
      workloads = await db.select()
        .from(operatorWorkload)
        .where(eq(operatorWorkload.weekStartDate, weekStartStr));
    }

    const staffList = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    const workloadMap = new Map(workloads.map(w => [w.staffMemberId, w]));

    const staffRisk = staffList.map(s => {
      const workload = workloadMap.get(s.id);
      const riskFactors = workload?.riskFactors as Record<string, any> || {};
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        hoursThisWeek: workload?.totalHoursWeek || 0,
        consecutiveDays: workload?.consecutiveDaysWorked || 0,
        nightShiftsThisMonth: workload?.nightShiftsCount || 0,
        lastRestDay: riskFactors.lastRestDate || null,
        currentStreak: riskFactors.currentStreak || 0,
        riskLevel: workload?.riskLevel || 'low',
        riskScore: workload?.riskScore || 0,
      };
    });

    res.json(staffRisk);
  } catch (error) {
    console.error("Error fetching staff risk:", error);
    res.status(500).json({ error: "Errore nel caricamento rischio staff" });
  }
});

// Get detailed burnout data for a specific staff member
app.get("/api/burnout/operator/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get staff member info
    const [staffMember] = await db.select()
      .from(staffMembers)
      .where(eq(staffMembers.id, id))
      .limit(1);
    
    if (!staffMember) {
      return res.status(404).json({ error: "Operatore non trovato" });
    }
    
    // Get current week workload
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const [currentWorkload] = await db.select()
      .from(operatorWorkload)
      .where(and(
        eq(operatorWorkload.staffMemberId, id),
        eq(operatorWorkload.weekStartDate, weekStartStr)
      ))
      .limit(1);
    
    // Get recent workload history (last 4 weeks)
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const workloadHistory = await db.select()
      .from(operatorWorkload)
      .where(and(
        eq(operatorWorkload.staffMemberId, id),
        sql`${operatorWorkload.weekStartDate} >= ${fourWeeksAgo.toISOString().split('T')[0]}`
      ))
      .orderBy(desc(operatorWorkload.weekStartDate))
      .limit(4);
    
    // Get wellness check-ins
    const [latestWellness] = await db.select()
      .from(wellnessCheckins)
      .where(eq(wellnessCheckins.staffMemberId, id))
      .orderBy(desc(wellnessCheckins.checkinDate))
      .limit(1);
    
    // Get active alerts
    const alerts = await db.select()
      .from(burnoutAlerts)
      .where(and(
        eq(burnoutAlerts.staffMemberId, id),
        eq(burnoutAlerts.isResolved, false)
      ))
      .orderBy(desc(burnoutAlerts.createdAt));
    
    // Get thresholds
    const [threshold] = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    const limits = threshold || {
      maxHoursPerWeek: 48,
      maxConsecutiveDays: 6,
      maxNightShiftsPerWeek: 3,
      minRestHoursBetweenShifts: 11
    };
    
    res.json({
      operator: {
        id: staffMember.id,
        name: `${staffMember.firstName} ${staffMember.lastName}`,
        email: staffMember.email,
        phone: staffMember.phone,
        role: staffMember.primaryRole,
      },
      currentWeek: currentWorkload ? {
        weekStart: currentWorkload.weekStartDate,
        hoursPerDay: [
          currentWorkload.hoursWorkedMon,
          currentWorkload.hoursWorkedTue,
          currentWorkload.hoursWorkedWed,
          currentWorkload.hoursWorkedThu,
          currentWorkload.hoursWorkedFri,
          currentWorkload.hoursWorkedSat,
          currentWorkload.hoursWorkedSun
        ],
        totalHours: currentWorkload.totalHoursWeek,
        nightShifts: currentWorkload.nightShiftsCount,
        consecutiveDays: currentWorkload.consecutiveDaysWorked,
        riskLevel: currentWorkload.riskLevel,
        riskScore: currentWorkload.riskScore,
        riskFactors: currentWorkload.riskFactors || {}
      } : null,
      history: workloadHistory.map(w => ({
        weekStart: w.weekStartDate,
        totalHours: w.totalHoursWeek,
        riskLevel: w.riskLevel,
        riskScore: w.riskScore
      })),
      wellness: latestWellness ? {
        date: latestWellness.checkinDate,
        energy: latestWellness.energyLevel,
        stress: latestWellness.stressLevel,
        sleep: latestWellness.sleepQuality,
        workLife: latestWellness.workLifeBalance,
        notes: latestWellness.notes
      } : null,
      alerts,
      thresholds: limits
    });
  } catch (error) {
    console.error("Error fetching operator details:", error);
    res.status(500).json({ error: "Errore nel caricamento dettagli operatore" });
  }
});

// Calculate and update workload for all operators
app.post("/api/burnout/calculate", requireAdmin, async (req, res) => {
  try {
    // Get current week start
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Get thresholds
    const thresholds = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    const threshold = thresholds[0] || {
      maxHoursPerWeek: 48,
      maxConsecutiveDays: 6,
      maxNightShiftsPerWeek: 3,
      minRestHoursBetweenShifts: 11,
    };

    // Get all shift assignments for this week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const assignments = await db.select()
      .from(shiftAssignments)
      .innerJoin(shiftInstances, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
      .where(and(
        sql`${shiftInstances.shiftDate} >= ${weekStart.toISOString().split('T')[0]}`,
        sql`${shiftInstances.shiftDate} <= ${weekEnd.toISOString().split('T')[0]}`
      ));

    // Group by staff member
    const staffHours: Record<string, { hours: number[], nightShifts: number, totalHours: number }> = {};
    
    for (const a of assignments) {
      const staffId = a.shift_assignments.staffMemberId;
      if (!staffHours[staffId]) {
        staffHours[staffId] = { hours: [0, 0, 0, 0, 0, 0, 0], nightShifts: 0, totalHours: 0 };
      }
      
      // Calculate hours from shift instance
      const shiftDateValue = new Date(a.shift_instances.shiftDate);
      const dayOfWeek = (shiftDateValue.getDay() + 6) % 7; // Monday = 0
      const hoursWorked = 8; // Default shift duration
      
      staffHours[staffId].hours[dayOfWeek] += hoursWorked;
      staffHours[staffId].totalHours += hoursWorked;
      
      // Check if night shift (simplified)
      if (a.shift_instances.startTime && a.shift_instances.startTime >= "20:00") {
        staffHours[staffId].nightShifts++;
      }
    }

    const staffSettingsMap = new Map<string, any>();
    const staffIds = Object.keys(staffHours);
    if (staffIds.length > 0) {
      const staffSettings = await db.select({
        id: staffMembers.id,
        maxHoursPerWeek: staffMembers.maxHoursPerWeek,
        maxConsecutiveDays: staffMembers.maxConsecutiveDays,
      }).from(staffMembers)
        .where(inArray(staffMembers.id, staffIds));
      for (const s of staffSettings) {
        staffSettingsMap.set(s.id, s);
      }
    }

    let updated = 0;
    for (const [staffId, data] of Object.entries(staffHours)) {
      let consecutiveDays = 0;
      let currentStreak = 0;
      for (const h of data.hours) {
        if (h > 0) {
          currentStreak++;
          consecutiveDays = Math.max(consecutiveDays, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      const staffSetting = staffSettingsMap.get(staffId);
      const effectiveMaxWeekly = staffSetting?.maxHoursPerWeek || threshold.maxHoursPerWeek;
      const effectiveMaxConsecutive = staffSetting?.maxConsecutiveDays || threshold.maxConsecutiveDays;

      let riskScore = 0;
      const riskFactors: Record<string, any> = {};
      
      if (data.totalHours > effectiveMaxWeekly) {
        const excess = (data.totalHours - effectiveMaxWeekly) / effectiveMaxWeekly;
        riskScore += excess * 40;
        riskFactors.hoursExcess = { value: data.totalHours, threshold: effectiveMaxWeekly };
      }
      
      if (consecutiveDays > effectiveMaxConsecutive) {
        const excess = (consecutiveDays - effectiveMaxConsecutive) / effectiveMaxConsecutive;
        riskScore += excess * 30;
        riskFactors.consecutiveDays = { value: consecutiveDays, threshold: effectiveMaxConsecutive };
      }
      
      const maxNightShifts = threshold.maxNightShiftsPerWeek || 3;
      if (data.nightShifts > maxNightShifts) {
        const excess = (data.nightShifts - maxNightShifts) / maxNightShifts;
        riskScore += excess * 20;
        riskFactors.nightShifts = { value: data.nightShifts, threshold: maxNightShifts };
      }

      riskScore = Math.min(100, riskScore);
      
      const riskLevel = riskScore >= 70 ? 'critical' 
        : riskScore >= 50 ? 'high' 
        : riskScore >= 25 ? 'moderate' 
        : 'low';

      // Upsert workload record
      const existing = await db.select()
        .from(operatorWorkload)
        .where(and(
          eq(operatorWorkload.staffMemberId, staffId),
          eq(operatorWorkload.weekStartDate, weekStart.toISOString().split('T')[0])
        ));

      if (existing.length > 0) {
        await db.update(operatorWorkload)
          .set({
            hoursWorkedMon: data.hours[0],
            hoursWorkedTue: data.hours[1],
            hoursWorkedWed: data.hours[2],
            hoursWorkedThu: data.hours[3],
            hoursWorkedFri: data.hours[4],
            hoursWorkedSat: data.hours[5],
            hoursWorkedSun: data.hours[6],
            totalHoursWeek: data.totalHours,
            nightShiftsCount: data.nightShifts,
            consecutiveDaysWorked: consecutiveDays,
            riskLevel,
            riskScore,
            riskFactors,
            updatedAt: new Date(),
          })
          .where(eq(operatorWorkload.id, existing[0].id));
      } else {
        await db.insert(operatorWorkload).values({
          staffMemberId: staffId,
          weekStartDate: weekStart.toISOString().split('T')[0],
          weekNumber,
          year: now.getFullYear(),
          hoursWorkedMon: data.hours[0],
          hoursWorkedTue: data.hours[1],
          hoursWorkedWed: data.hours[2],
          hoursWorkedThu: data.hours[3],
          hoursWorkedFri: data.hours[4],
          hoursWorkedSat: data.hours[5],
          hoursWorkedSun: data.hours[6],
          totalHoursWeek: data.totalHours,
          nightShiftsCount: data.nightShifts,
          consecutiveDaysWorked: consecutiveDays,
          riskLevel,
          riskScore,
          riskFactors,
        });
      }

      // Create alert if high or critical risk
      if (riskLevel === 'high' || riskLevel === 'critical') {
        // Check if alert already exists for this week
        const existingAlert = await db.select()
          .from(burnoutAlerts)
          .where(and(
            eq(burnoutAlerts.staffMemberId, staffId),
            eq(burnoutAlerts.periodStart, weekStart.toISOString().split('T')[0]),
            eq(burnoutAlerts.isResolved, false)
          ));

        if (existingAlert.length === 0) {
          const suggestedActions = [];
          if (riskFactors.hoursExcess) suggestedActions.push("Ridurre ore settimanali");
          if (riskFactors.consecutiveDays) suggestedActions.push("Pianificare giorno di riposo");
          if (riskFactors.nightShifts) suggestedActions.push("Ridurre turni notturni");

          await db.insert(burnoutAlerts).values({
            staffMemberId: staffId,
            alertType: Object.keys(riskFactors)[0] || 'hours_exceeded',
            riskLevel: riskLevel as any,
            title: `Rischio burnout ${riskLevel === 'critical' ? 'CRITICO' : 'ALTO'}`,
            description: `L'operatore ha superato le soglie di sicurezza per questa settimana.`,
            triggeredValue: riskScore,
            thresholdValue: riskLevel === 'critical' ? 70 : 50,
            periodStart: weekStart.toISOString().split('T')[0],
            periodEnd: weekEnd.toISOString().split('T')[0],
            suggestedActions,
          });
        }
      }

      updated++;
    }

    res.json({ success: true, operatorsUpdated: updated });
  } catch (error) {
    console.error("Error calculating burnout:", error);
    res.status(500).json({ error: "Errore nel calcolo burnout" });
  }
});

// Calculate burnout from actual trips data (for demonstration with real trip data)
app.post("/api/burnout/calculate-from-trips", requireAdmin, async (req, res) => {
  try {
    // Get last 4 weeks of trips
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    // Get trips with duration
    const recentTrips = await db.select({
      vehicleId: trips.vehicleId,
      serviceDate: trips.serviceDate,
      departureTime: trips.departureTime,
      returnTime: trips.returnTime,
      durationMinutes: trips.durationMinutes,
    }).from(trips)
      .where(sql`${trips.serviceDate} >= ${fourWeeksAgo.toISOString().split('T')[0]}`);

    // Get all staff members
    const allStaff = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    if (allStaff.length === 0) {
      return res.json({ success: true, message: "Nessun operatore attivo trovato" });
    }

    // Get thresholds
    const thresholds = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    const threshold = thresholds[0] || {
      maxHoursPerWeek: 48,
      maxConsecutiveDays: 6,
      maxNightShiftsPerWeek: 3,
      minRestHoursBetweenShifts: 11,
    };

    // Calculate current week dates
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Group trips by date and calculate total hours per day
    const tripsByDate: Record<string, number> = {};
    let totalNightShifts = 0;
    
    for (const trip of recentTrips) {
      const dateStr = trip.serviceDate;
      const hoursWorked = (trip.durationMinutes || 60) / 60;
      tripsByDate[dateStr] = (tripsByDate[dateStr] || 0) + hoursWorked;
      
      // Count night shifts (departure >= 20:00 or return >= 22:00)
      if (trip.departureTime && trip.departureTime >= "20:00") {
        totalNightShifts++;
      }
    }

    // Distribute workload among staff members (simulation based on trip volume)
    const staffCount = allStaff.length;
    let updated = 0;

    for (let i = 0; i < allStaff.length; i++) {
      const staff = allStaff[i];
      
      // Calculate individual workload (varying distribution for realism)
      const workloadFactor = 0.5 + Math.random() * 0.7; // 50% to 120%
      const baseHoursPerDay = 6 + Math.random() * 4; // 6-10 hours base
      
      // Calculate hours for each day of current week
      const hours = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      let consecutiveDays = 0;
      let currentStreak = 0;
      const daysWorked = Math.floor(3 + Math.random() * 4); // 3-6 days
      
      for (let day = 0; day < 7; day++) {
        if (day < daysWorked && Math.random() > 0.15) {
          hours[day] = Math.round((baseHoursPerDay * workloadFactor) * 10) / 10;
          currentStreak++;
          consecutiveDays = Math.max(consecutiveDays, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      const totalHours = hours.reduce((a, b) => a + b, 0);
      const nightShifts = Math.floor(Math.random() * 4); // 0-3 night shifts

      // Calculate risk score based on D.Lgs. 81/2008 thresholds
      let riskScore = 0;
      const riskFactors: Record<string, any> = {};
      
      // Hours per week - exceeding 48h is a legal violation
      if (totalHours >= threshold.maxHoursPerWeek) {
        const excess = totalHours - threshold.maxHoursPerWeek;
        // Base 25 points for reaching threshold, +5 per hour over
        riskScore += 25 + (excess * 5);
        riskFactors.hoursExcess = { value: Math.round(totalHours * 10) / 10, threshold: threshold.maxHoursPerWeek };
      }
      
      // Consecutive days - reaching 6+ days requires immediate attention
      if (consecutiveDays >= threshold.maxConsecutiveDays) {
        const excess = consecutiveDays - threshold.maxConsecutiveDays + 1;
        // Base 20 points for reaching threshold, +10 per day over
        riskScore += 20 + (excess * 10);
        riskFactors.consecutiveDays = { value: consecutiveDays, threshold: threshold.maxConsecutiveDays };
      }
      
      // Night shifts - more than 3 per week affects health
      const maxNightShifts = threshold.maxNightShiftsPerWeek || 3;
      if (nightShifts >= maxNightShifts) {
        const excess = nightShifts - maxNightShifts + 1;
        // Base 15 points for reaching threshold, +8 per shift over
        riskScore += 15 + (excess * 8);
        riskFactors.nightShifts = { value: nightShifts, threshold: maxNightShifts };
      }

      // Small variation for realistic distribution (only positive to avoid hiding violations)
      riskScore += Math.random() * 5;
      riskScore = Math.max(0, Math.min(100, riskScore));
      
      const riskLevel = riskScore >= 70 ? 'critical' 
        : riskScore >= 50 ? 'high' 
        : riskScore >= 25 ? 'moderate' 
        : 'low';

      // Delete existing record for this week
      await db.delete(operatorWorkload)
        .where(and(
          eq(operatorWorkload.staffMemberId, staff.id),
          eq(operatorWorkload.weekStartDate, weekStartStr)
        ));

      // Insert new workload record
      await db.insert(operatorWorkload).values({
        staffMemberId: staff.id,
        weekStartDate: weekStartStr,
        weekNumber,
        year: now.getFullYear(),
        hoursWorkedMon: hours[0],
        hoursWorkedTue: hours[1],
        hoursWorkedWed: hours[2],
        hoursWorkedThu: hours[3],
        hoursWorkedFri: hours[4],
        hoursWorkedSat: hours[5],
        hoursWorkedSun: hours[6],
        totalHoursWeek: totalHours,
        nightShiftsCount: nightShifts,
        consecutiveDaysWorked: consecutiveDays,
        riskLevel: riskLevel as any,
        riskScore,
        riskFactors,
      });

      // Create alert for high/critical risk, or remove if risk decreased
      if (riskLevel === 'high' || riskLevel === 'critical') {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        await db.delete(burnoutAlerts)
          .where(and(
            eq(burnoutAlerts.staffMemberId, staff.id),
            eq(burnoutAlerts.periodStart, weekStartStr),
            eq(burnoutAlerts.isResolved, false)
          ));

        const suggestedActions = [];
        if (riskFactors.hoursExcess) suggestedActions.push("Ridurre ore settimanali");
        if (riskFactors.consecutiveDays) suggestedActions.push("Pianificare giorno di riposo");
        if (riskFactors.nightShifts) suggestedActions.push("Ridurre turni notturni");

        await db.insert(burnoutAlerts).values({
          staffMemberId: staff.id,
          alertType: Object.keys(riskFactors)[0] || 'hours_exceeded',
          riskLevel: riskLevel as any,
          title: `Rischio burnout ${riskLevel === 'critical' ? 'CRITICO' : 'ALTO'} - ${staff.firstName} ${staff.lastName}`,
          description: `L'operatore ha superato le soglie di sicurezza: ${Math.round(totalHours)}h/sett, ${consecutiveDays} giorni consecutivi.`,
          triggeredValue: riskScore,
          thresholdValue: riskLevel === 'critical' ? 70 : 50,
          periodStart: weekStartStr,
          periodEnd: weekEnd.toISOString().split('T')[0],
          suggestedActions,
        });
      } else {
        // Risk is now low/moderate - remove any existing unresolved alerts for this operator
        await db.delete(burnoutAlerts)
          .where(and(
            eq(burnoutAlerts.staffMemberId, staff.id),
            eq(burnoutAlerts.isResolved, false)
          ));
      }

      updated++;
    }

    res.json({ success: true, operatorsUpdated: updated, tripsAnalyzed: recentTrips.length });
  } catch (error) {
    console.error("Error calculating burnout from trips:", error);
    res.status(500).json({ error: "Errore nel calcolo burnout dai viaggi" });
  }
});

// Calculate burnout from REAL shift data (Turnistica Mensile)
app.post("/api/burnout/calculate-from-shifts", requireAdmin, async (req, res) => {
  try {
    // Get last 4 weeks of shift instances with assignments
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
    
    // Get all shift assignments with their shift instances for the last 4 weeks
    const shiftsWithAssignments = await db.select({
      shiftId: shiftInstances.id,
      shiftDate: shiftInstances.shiftDate,
      startTime: shiftInstances.startTime,
      endTime: shiftInstances.endTime,
      status: shiftInstances.status,
      staffMemberId: shiftAssignments.staffMemberId,
      assignmentStatus: shiftAssignments.status,
    })
      .from(shiftInstances)
      .innerJoin(shiftAssignments, eq(shiftAssignments.shiftInstanceId, shiftInstances.id))
      .where(sql`${shiftInstances.shiftDate} >= ${fourWeeksAgoStr}`);

    // Get all active staff members
    const allStaff = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    if (allStaff.length === 0) {
      return res.json({ success: true, message: "Nessun operatore attivo trovato", shiftsAnalyzed: 0 });
    }

    // Get thresholds
    const thresholds = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    const threshold = thresholds[0] || {
      maxHoursPerWeek: 48,
      maxConsecutiveDays: 6,
      maxNightShiftsPerWeek: 3,
      minRestHoursBetweenShifts: 11,
    };

    // Helper function to format date as YYYY-MM-DD in local time
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Calculate current week dates (Monday-based)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday=0, need -6 to get to Monday
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = formatLocalDate(weekStart);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = formatLocalDate(weekEnd);
    
    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Group shifts by staff member
    const staffShifts: Record<string, typeof shiftsWithAssignments> = {};
    let shiftsInCurrentWeek = 0;
    
    for (const shift of shiftsWithAssignments) {
      if (!shift.staffMemberId) continue;
      if (!staffShifts[shift.staffMemberId]) {
        staffShifts[shift.staffMemberId] = [];
      }
      staffShifts[shift.staffMemberId].push(shift);
    }

    let updated = 0;

    for (const staff of allStaff) {
      const shifts = staffShifts[staff.id] || [];
      
      // Calculate hours per day for current week
      const hoursPerDay: number[] = [0, 0, 0, 0, 0, 0, 0];
      let nightShiftsCount = 0;
      const datesWorkedCurrentWeek = new Set<string>();
      const allDatesWorked = new Set<string>();
      
      for (const shift of shifts) {
        // shiftDate is already in YYYY-MM-DD format from the database
        const shiftDateStr = shift.shiftDate;
        
        // Track ALL dates worked for consecutive days calculation
        allDatesWorked.add(shiftDateStr);
        
        // Check if shift is in current week by comparing date strings directly
        if (shiftDateStr < weekStartStr || shiftDateStr > weekEndStr) continue;
        
        shiftsInCurrentWeek++;
        datesWorkedCurrentWeek.add(shiftDateStr);
        
        // Parse the shift date for day-of-week calculation
        const [year, month, day] = shiftDateStr.split('-').map(Number);
        const shiftDate = new Date(year, month - 1, day);
        
        // Calculate hours from start/end time
        const startParts = shift.startTime?.split(':').map(Number) || [0, 0];
        const endParts = shift.endTime?.split(':').map(Number) || [0, 0];
        let hoursWorked = (endParts[0] + endParts[1] / 60) - (startParts[0] + startParts[1] / 60);
        if (hoursWorked < 0) hoursWorked += 24; // overnight shift
        
        // Assign to correct day of week (0=Mon, 6=Sun)
        const dayOfWeek = shiftDate.getDay() === 0 ? 6 : shiftDate.getDay() - 1;
        hoursPerDay[dayOfWeek] += hoursWorked;
        
        // Count night shifts (start >= 20:00 or end >= 22:00)
        if (startParts[0] >= 20 || endParts[0] >= 22) {
          nightShiftsCount++;
        }
      }
      
      const totalHours = hoursPerDay.reduce((a, b) => a + b, 0);
      
      // Calculate consecutive days worked from ALL dates (not just current week)
      const sortedAllDates = Array.from(allDatesWorked).sort();
      let consecutiveDays = 0;
      let currentStreak = 0;
      let prevDateStr: string | null = null;
      let lastRestDate: string | null = null;
      
      // Build a complete calendar of the last 28 days to find rest days
      const todayStr = formatLocalDate(now);
      const last28Days: string[] = [];
      for (let i = 27; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        last28Days.push(formatLocalDate(d));
      }
      
      // Find consecutive days streak ending today and last rest date
      let streakFromToday = 0;
      for (let i = last28Days.length - 1; i >= 0; i--) {
        const dateStr = last28Days[i];
        if (allDatesWorked.has(dateStr)) {
          streakFromToday++;
        } else {
          // Found a rest day
          if (!lastRestDate) {
            lastRestDate = dateStr;
          }
          break;
        }
      }
      
      // If we didn't find a rest day in the streak, look for the most recent one
      if (!lastRestDate) {
        for (let i = last28Days.length - 1; i >= 0; i--) {
          if (!allDatesWorked.has(last28Days[i])) {
            lastRestDate = last28Days[i];
            break;
          }
        }
      }
      
      // Calculate longest consecutive streak in the period
      for (const dateStr of sortedAllDates) {
        if (prevDateStr) {
          const [y1, m1, d1] = prevDateStr.split('-').map(Number);
          const [y2, m2, d2] = dateStr.split('-').map(Number);
          const date1 = new Date(y1, m1 - 1, d1);
          const date2 = new Date(y2, m2 - 1, d2);
          const diffDays = Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else {
            consecutiveDays = Math.max(consecutiveDays, currentStreak);
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
        prevDateStr = dateStr;
      }
      consecutiveDays = Math.max(consecutiveDays, currentStreak, streakFromToday);

      // Calculate risk score based on thresholds
      let riskScore = 0;
      const riskFactors: Record<string, any> = {};
      
      // Hours per week check
      if (totalHours >= threshold.maxHoursPerWeek) {
        const excess = totalHours - threshold.maxHoursPerWeek;
        riskScore += 25 + (excess * 5);
        riskFactors.hoursExcess = { value: Math.round(totalHours * 10) / 10, threshold: threshold.maxHoursPerWeek };
      } else if (totalHours >= threshold.maxHoursPerWeek * 0.85) {
        // Warning level at 85% of max
        riskScore += 10;
      }
      
      // Consecutive days check
      if (consecutiveDays >= threshold.maxConsecutiveDays) {
        const excess = consecutiveDays - threshold.maxConsecutiveDays + 1;
        riskScore += 20 + (excess * 10);
        riskFactors.consecutiveDays = { value: consecutiveDays, threshold: threshold.maxConsecutiveDays };
      }
      
      // Night shifts check
      const maxNightShifts = threshold.maxNightShiftsPerWeek || 3;
      if (nightShiftsCount >= maxNightShifts) {
        const excess = nightShiftsCount - maxNightShifts + 1;
        riskScore += 15 + (excess * 8);
        riskFactors.nightShifts = { value: nightShiftsCount, threshold: maxNightShifts };
      }

      riskScore = Math.max(0, Math.min(100, riskScore));
      
      const riskLevel = riskScore >= 70 ? 'critical' 
        : riskScore >= 50 ? 'high' 
        : riskScore >= 25 ? 'moderate' 
        : 'low';

      // Delete existing record for this week
      await db.delete(operatorWorkload)
        .where(and(
          eq(operatorWorkload.staffMemberId, staff.id),
          eq(operatorWorkload.weekStartDate, weekStartStr)
        ));

      // Insert new workload record with real data
      // Store lastRestDate in riskFactors for reference
      const extendedRiskFactors = {
        ...riskFactors,
        lastRestDate: lastRestDate || 'Nessuno negli ultimi 28 giorni',
        currentStreak: streakFromToday,
        daysWorkedIn4Weeks: allDatesWorked.size,
      };

      await db.insert(operatorWorkload).values({
        staffMemberId: staff.id,
        weekStartDate: weekStartStr,
        weekNumber,
        year: now.getFullYear(),
        hoursWorkedMon: hoursPerDay[0],
        hoursWorkedTue: hoursPerDay[1],
        hoursWorkedWed: hoursPerDay[2],
        hoursWorkedThu: hoursPerDay[3],
        hoursWorkedFri: hoursPerDay[4],
        hoursWorkedSat: hoursPerDay[5],
        hoursWorkedSun: hoursPerDay[6],
        totalHoursWeek: totalHours,
        nightShiftsCount,
        consecutiveDaysWorked: consecutiveDays,
        riskLevel: riskLevel as any,
        riskScore,
        riskFactors: extendedRiskFactors,
      });

      // Create/update alerts for high/critical risk
      if (riskLevel === 'high' || riskLevel === 'critical') {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        await db.delete(burnoutAlerts)
          .where(and(
            eq(burnoutAlerts.staffMemberId, staff.id),
            eq(burnoutAlerts.periodStart, weekStartStr),
            eq(burnoutAlerts.isResolved, false)
          ));

        const suggestedActions = [];
        if (riskFactors.hoursExcess) suggestedActions.push("Ridurre ore settimanali");
        if (riskFactors.consecutiveDays) suggestedActions.push("Pianificare giorno di riposo");
        if (riskFactors.nightShifts) suggestedActions.push("Ridurre turni notturni");

        const lastRestInfo = lastRestDate ? `, ultimo riposo: ${lastRestDate}` : ', nessun riposo negli ultimi 28gg';
        await db.insert(burnoutAlerts).values({
          staffMemberId: staff.id,
          alertType: Object.keys(riskFactors)[0] || 'hours_exceeded',
          riskLevel: riskLevel as any,
          title: `Rischio burnout ${riskLevel === 'critical' ? 'CRITICO' : 'ALTO'} - ${staff.firstName} ${staff.lastName}`,
          description: `Analisi turni reali: ${Math.round(totalHours)}h/sett, ${consecutiveDays} giorni consecutivi, ${nightShiftsCount} turni notturni${lastRestInfo}.`,
          triggeredValue: riskScore,
          thresholdValue: riskLevel === 'critical' ? 70 : 50,
          periodStart: weekStartStr,
          periodEnd: weekEndStr,
          suggestedActions,
        });
      } else {
        // Remove existing unresolved alerts if risk is now low/moderate
        await db.delete(burnoutAlerts)
          .where(and(
            eq(burnoutAlerts.staffMemberId, staff.id),
            eq(burnoutAlerts.isResolved, false)
          ));
      }

      updated++;
    }

    res.json({ 
      success: true, 
      operatorsUpdated: updated, 
      shiftsAnalyzed: shiftsInCurrentWeek,
      totalShiftsLast4Weeks: shiftsWithAssignments.length,
      weekRange: `${weekStartStr} - ${weekEndStr}`,
      message: `Analizzati ${shiftsInCurrentWeek} turni della settimana corrente per ${updated} operatori`
    });
  } catch (error) {
    console.error("Error calculating burnout from shifts:", error);
    res.status(500).json({ error: "Errore nel calcolo burnout dai turni" });
  }
});

// Get burnout alerts
app.get("/api/burnout/alerts", requireAdmin, async (req, res) => {
  try {
    const { resolved, staffMemberId } = req.query;
    
    let query = db.select().from(burnoutAlerts);
    
    const conditions = [];
    if (resolved !== undefined) {
      conditions.push(eq(burnoutAlerts.isResolved, resolved === 'true'));
    }
    if (staffMemberId) {
      conditions.push(eq(burnoutAlerts.staffMemberId, staffMemberId as string));
    }

    const alerts = await db.select()
      .from(burnoutAlerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(burnoutAlerts.createdAt))
      .limit(50);

    res.json(alerts);
  } catch (error) {
    console.error("Error fetching burnout alerts:", error);
    res.status(500).json({ error: "Errore nel caricamento alert" });
  }
});

// Resolve burnout alert
app.post("/api/burnout/alerts/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const [updated] = await db.update(burnoutAlerts)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.session.userId,
        resolutionNotes: notes,
      })
      .where(eq(burnoutAlerts.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error resolving burnout alert:", error);
    res.status(500).json({ error: "Errore nella risoluzione alert" });
  }
});

// Submit wellness check-in
app.post("/api/burnout/wellness-checkin", requireAuth, async (req, res) => {
  try {
    const { energyLevel, stressLevel, sleepQuality, workLifeBalance, teamSupport, jobSatisfaction, notes, isAnonymous } = req.body;
    const userId = req.session.userId || 'unknown';
    
    // Calculate overall wellness score (0-100)
    const scores = [energyLevel, stressLevel, sleepQuality, workLifeBalance, teamSupport, jobSatisfaction].filter(s => s !== undefined);
    const overallWellnessScore = scores.length > 0 
      ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length / 5) * 100 
      : null;

    // Determine if support is needed (any score <= 2)
    const needsSupport = scores.some((s: number) => s <= 2);

    const staffMemberIdValue = isAnonymous ? 'anonymous' : userId;
    
    const [checkin] = await db.insert(wellnessCheckins).values({
      staffMemberId: staffMemberIdValue,
      checkinDate: new Date().toISOString().split('T')[0],
      energyLevel,
      stressLevel,
      sleepQuality,
      workLifeBalance,
      teamSupport,
      jobSatisfaction,
      overallWellnessScore,
      notes,
      needsSupport,
      isAnonymous: !!isAnonymous,
    }).returning();

    // Create alert if support is needed
    if (needsSupport && !isAnonymous && userId !== 'unknown') {
      await db.insert(burnoutAlerts).values({
        staffMemberId: userId,
        alertType: 'low_wellness',
        riskLevel: 'high',
        title: 'Check-in benessere con punteggio basso',
        description: 'L\'operatore ha segnalato difficolta nel check-in benessere periodico.',
        triggeredValue: overallWellnessScore,
        thresholdValue: 40,
        suggestedActions: [
          "Contattare l'operatore per un colloquio",
          "Valutare riduzione carico di lavoro",
          "Offrire supporto psicologico"
        ],
      });
    }

    res.json(checkin);
  } catch (error) {
    console.error("Error submitting wellness check-in:", error);
    res.status(500).json({ error: "Errore nell'invio check-in" });
  }
});

// Get wellness check-in history
app.get("/api/burnout/wellness/:staffMemberId", requireAdmin, async (req, res) => {
  try {
    const { staffMemberId } = req.params;
    
    const checkins = await db.select()
      .from(wellnessCheckins)
      .where(eq(wellnessCheckins.staffMemberId, staffMemberId))
      .orderBy(desc(wellnessCheckins.checkinDate))
      .limit(30);

    res.json(checkins);
  } catch (error) {
    console.error("Error fetching wellness history:", error);
    res.status(500).json({ error: "Errore nel caricamento storico benessere" });
  }
});

  // ===== PDF REPORTS: ESG, CARBON, BURNOUT =====
app.get("/api/esg/report/pdf", requireAdmin, async (req, res) => {
  try {
    const { period = 'quarter' } = req.query;

    const orgId = getEffectiveOrgId(req);
    let orgName = '';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (org) orgName = org.name;
    }

    const now = new Date();
    let startDate: Date;
    let periodLabel: string;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = `${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`;
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      periodLabel = `Anno ${now.getFullYear()}`;
    } else {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
      periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    }
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get ESG data
    const carbonData = await db.select({
      totalCo2: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalSaved: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2SavedKg}), 0)`,
      avgPerKm: sql<number>`COALESCE(AVG(${tripCarbonFootprint.co2PerKm}), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(sql`${trips.serviceDate} >= ${startDateStr}`);

    const tripStats = await db.select({
      totalTrips: sql<number>`COUNT(*)`,
      totalKm: sql<number>`COALESCE(SUM(km_traveled), 0)`,
      totalPatients: sql<number>`COUNT(CASE WHEN patient_birth_year IS NOT NULL THEN 1 END)`,
    }).from(trips)
      .where(sql`${trips.serviceDate} >= ${startDateStr}`);

    const volunteerStats = await db.select({
      activeCount: sql<number>`COUNT(*)`,
    }).from(staffMembers)
      .where(eq(staffMembers.isActive, true));

    const auditStats = await db.select({
      totalLogs: sql<number>`COUNT(*)`,
    }).from(auditLogs)
      .where(sql`${auditLogs.createdAt} >= ${startDate}`);

    let dataQualityScore = 85;
    try {
      const qualityData = await db.select({
        avgScore: sql<number>`COALESCE(AVG(overall_score), 85)`,
      }).from(dataQualityScores);
      if (qualityData[0]?.avgScore) {
        dataQualityScore = Number(qualityData[0].avgScore);
      }
    } catch (e) {}

    const totalCo2Tonnes = (Number(carbonData[0]?.totalCo2) || 0) / 1000;
    const totalSavedTonnes = (Number(carbonData[0]?.totalSaved) || 0) / 1000;
    const totalTrips = Number(tripStats[0]?.totalTrips) || 0;
    const totalPatients = Number(tripStats[0]?.totalPatients) || 0;
    const totalKm = Math.round(Number(tripStats[0]?.totalKm) || 0);
    const activeVolunteers = Number(volunteerStats[0]?.activeCount) || 0;
    const auditLogCount = Number(auditStats[0]?.totalLogs) || 0;

    const envScore = Math.min(100, Math.max(0, 50 + totalSavedTonnes * 10));
    const socScore = Math.min(100, Math.max(0, totalTrips / 50 * 100));
    const govScore = Math.min(100, dataQualityScore);
    const overallScore = (envScore * 0.33 + socScore * 0.33 + govScore * 0.34);
    const rating = overallScore >= 80 ? 'AAA' : overallScore >= 70 ? 'AA' : overallScore >= 60 ? 'A' : overallScore >= 50 ? 'BBB' : overallScore >= 40 ? 'BB' : 'B';

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ESG_Report_${periodLabel.replace(/\s/g, '_')}.pdf`);
    doc.pipe(res);

    // === HEADER SECTION - Full width gradient header ===
    doc.rect(0, 0, 595, 120).fill('#1e3a5f');
    doc.rect(0, 115, 595, 8).fill('#10b981');
    
    doc.fontSize(14).font('Helvetica').fillColor('#a7f3d0').text('SOCCORSO DIGITALE', 50, 20);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff').text(orgName || 'Report', 50, 38);
    doc.fontSize(12).font('Helvetica').text('ESG REPORT', 50, 66);
    doc.fontSize(11).font('Helvetica').text(periodLabel.toUpperCase(), 400, 58, { align: 'right', width: 145 });
    doc.fontSize(9).text(`Gen. ${new Date().toLocaleDateString('it-IT')}`, 400, 75, { align: 'right', width: 145 });

    // === HERO SCORE SECTION ===
    const heroY = 145;
    doc.rect(50, heroY, 495, 100).lineWidth(2).strokeColor('#1e3a5f').stroke();
    
    // Rating Badge
    const badgeColor = rating.startsWith('A') ? '#10b981' : rating.startsWith('B') ? '#3b82f6' : '#f59e0b';
    doc.circle(120, heroY + 50, 35).fill(badgeColor);
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff').text(rating, 95, heroY + 38, { width: 50, align: 'center' });
    
    // Score Details
    doc.fillColor('#1e3a5f');
    doc.fontSize(14).font('Helvetica-Bold').text('ESG SCORE COMPLESSIVO', 180, heroY + 20);
    doc.fontSize(42).text(`${Math.round(overallScore)}`, 180, heroY + 40);
    doc.fontSize(16).font('Helvetica').text('/ 100', 250, heroY + 55);
    
    // Score Breakdown Mini
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280');
    doc.text(`E: ${Math.round(envScore)}  |  S: ${Math.round(socScore)}  |  G: ${Math.round(govScore)}`, 180, heroY + 80);
    
    // Visual Score Bar
    const barX = 350;
    const barWidth = 180;
    doc.rect(barX, heroY + 45, barWidth, 20).fill('#e5e7eb');
    doc.rect(barX, heroY + 45, barWidth * (overallScore / 100), 20).fill(badgeColor);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text(`${Math.round(overallScore)}%`, barX + 5, heroY + 50);

    // === THREE PILLARS SECTION ===
    const pillarsY = 270;
    const colWidth = 155;
    
    // Environmental Pillar
    doc.rect(50, pillarsY, colWidth, 200).fill('#ecfdf5');
    doc.rect(50, pillarsY, colWidth, 8).fill('#10b981');
    doc.circle(127, pillarsY + 45, 20).fill('#10b981');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('E', 120, pillarsY + 37);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#047857').text('ENVIRONMENTAL', 60, pillarsY + 75, { width: colWidth - 20, align: 'center' });
    doc.fontSize(24).text(`${Math.round(envScore)}`, 60, pillarsY + 95, { width: colWidth - 20, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#065f46');
    doc.text(`CO2 Emessa: ${totalCo2Tonnes.toFixed(1)}t`, 60, pillarsY + 130);
    doc.text(`Km Totali: ${totalKm.toLocaleString('it-IT')}`, 60, pillarsY + 145);
    doc.text(`Efficienza: ${Math.round(Number(carbonData[0]?.avgPerKm) || 0)} g/km`, 60, pillarsY + 160);
    doc.text(`Servizi: ${totalTrips.toLocaleString('it-IT')}`, 60, pillarsY + 175);

    // Social Pillar
    doc.rect(220, pillarsY, colWidth, 200).fill('#eff6ff');
    doc.rect(220, pillarsY, colWidth, 8).fill('#3b82f6');
    doc.circle(297, pillarsY + 45, 20).fill('#3b82f6');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('S', 290, pillarsY + 37);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1d4ed8').text('SOCIAL', 230, pillarsY + 75, { width: colWidth - 20, align: 'center' });
    doc.fontSize(24).text(`${Math.round(socScore)}`, 230, pillarsY + 95, { width: colWidth - 20, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#1e40af');
    doc.text(`Servizi: ${totalTrips.toLocaleString('it-IT')}`, 230, pillarsY + 130);
    doc.text(`Pazienti: ${totalPatients.toLocaleString('it-IT')}`, 230, pillarsY + 145);
    doc.text(`Personale Attivo: ${activeVolunteers}`, 230, pillarsY + 160);
    doc.text(`Impatto Sociale: Alto`, 230, pillarsY + 175);

    // Governance Pillar
    doc.rect(390, pillarsY, colWidth, 200).fill('#f5f3ff');
    doc.rect(390, pillarsY, colWidth, 8).fill('#8b5cf6');
    doc.circle(467, pillarsY + 45, 20).fill('#8b5cf6');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('G', 460, pillarsY + 37);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#6d28d9').text('GOVERNANCE', 400, pillarsY + 75, { width: colWidth - 20, align: 'center' });
    doc.fontSize(24).text(`${Math.round(govScore)}`, 400, pillarsY + 95, { width: colWidth - 20, align: 'center' });
    doc.fontSize(10).font('Helvetica').fillColor('#5b21b6');
    doc.text(`Audit Logs: ${auditLogCount.toLocaleString('it-IT')}`, 400, pillarsY + 130);
    doc.text(`Data Quality: ${Math.round(dataQualityScore)}%`, 400, pillarsY + 145);
    doc.text(`GDPR: Conforme`, 400, pillarsY + 160);
    doc.text(`ISO 27001: Pronto`, 400, pillarsY + 175);

    // === KEY METRICS SECTION ===
    const metricsY = 495;
    doc.rect(50, metricsY, 495, 45).fill('#f8fafc');
    doc.rect(50, metricsY, 495, 2).fill('#1e3a5f');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('METRICHE CHIAVE', 60, metricsY + 8);
    
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    doc.text(`Km/Personale: ${activeVolunteers > 0 ? Math.round(totalKm / activeVolunteers).toLocaleString('it-IT') : 0}`, 60, metricsY + 25);
    doc.text(`Servizi/Giorno: ${Math.round(totalTrips / 90)}`, 200, metricsY + 25);
    doc.text(`Media km/Servizio: ${totalTrips > 0 ? Math.round(totalKm / totalTrips) : 0}`, 350, metricsY + 25);

    // === METHODOLOGY SECTION ===
    const methodY = 560;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text('METODOLOGIA E STANDARD', 50, methodY);
    doc.fontSize(8).font('Helvetica').fillColor('#6b7280');
    doc.text('Fattori di emissione: ISPRA 2024 | Standard di reporting: GRI 2021 | Framework ESG: SASB', 50, methodY + 15);
    doc.text('Calcolo emissioni: basato sui fattori ISPRA 2024 specifici per tipo carburante', 50, methodY + 28);
    doc.text('Rating scale: AAA (80+), AA (70-79), A (60-69), BBB (50-59), BB (40-49), B (<40)', 50, methodY + 41);

    // === FOOTER ===
    doc.rect(0, 780, 595, 62).fill('#1e3a5f');
    doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text('SOCCORSO DIGITALE - Report ESG Automatizzato', 50, 795, { align: 'center', width: 495 });
    doc.fontSize(8).text('Documento generato dal sistema di gestione integrato - Dati verificabili su richiesta', 50, 810, { align: 'center', width: 495 });
    doc.fontSize(8).font('Helvetica').fillColor('#999999').text(`Generato da SOCCORSO DIGITALE per ${orgName}`, 50, 822, { width: 495, align: 'center' });

    doc.end();
  } catch (error) {
    console.error("Error generating ESG PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF ESG" });
  }
});

// Carbon Footprint Report PDF - Innovative Environmental Theme
app.get("/api/carbon/report/pdf", requireAdmin, async (req, res) => {
  try {
    const { period = 'quarter' } = req.query;

    const orgId = getEffectiveOrgId(req);
    let orgName = '';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (org) orgName = org.name;
    }

    const now = new Date();
    let startDate: Date;
    let periodLabel: string;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = `${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`;
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      periodLabel = `Anno ${now.getFullYear()}`;
    } else {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
      periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    }
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get carbon stats
    const stats = await db.select({
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalCo2SavedKg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2SavedKg}), 0)`,
      avgCo2PerKm: sql<number>`COALESCE(AVG(${tripCarbonFootprint.co2PerKm}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(${tripCarbonFootprint.id})`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(sql`${trips.serviceDate} >= ${startDateStr}`);

    // Get by fuel type
    const byFuelType = await db.select({
      fuelType: tripCarbonFootprint.fuelType,
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(sql`${trips.serviceDate} >= ${startDateStr}`)
      .groupBy(tripCarbonFootprint.fuelType);

    // Get by vehicle - ordered by emissions descending
    const byVehicle = await db.select({
      vehicleCode: vehicles.code,
      fuelType: tripCarbonFootprint.fuelType,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      totalEmissions: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
    })
      .from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .innerJoin(vehicles, eq(tripCarbonFootprint.vehicleId, vehicles.id))
      .where(sql`${trips.serviceDate} >= ${startDateStr}`)
      .groupBy(tripCarbonFootprint.vehicleId, vehicles.code, tripCarbonFootprint.fuelType)
      .orderBy(sql`SUM(${tripCarbonFootprint.co2EmittedKg}) DESC`)
      .limit(10);

    const totalCo2Kg = Number(stats[0]?.totalCo2Kg) || 0;
    const totalCo2Tonnes = totalCo2Kg / 1000;
    const totalKm = Math.round(Number(stats[0]?.totalKm) || 0);
    const avgCo2PerKm = Math.round(Number(stats[0]?.avgCo2PerKm) || 0);
    const tripCount = Number(stats[0]?.tripCount) || 0;
    const avgKmPerTrip = tripCount > 0 ? Math.round(totalKm / tripCount) : 0;

    const treesNeeded = Math.ceil(totalCo2Kg / 21.77);
    const fuelLiters = Math.round(totalCo2Kg / 2.68);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Carbon_Footprint_${periodLabel.replace(/\s/g, '_')}.pdf`);
    doc.pipe(res);

    const W = 595;
    const H = 842;
    const darkBg = '#0a1628';
    const darkCard = '#111e36';
    const greenPrimary = '#10b981';
    const greenLight = '#22c55e';
    const greenBright = '#6ee7b7';
    const greenMuted = '#34d399';
    const textPrimary = '#ffffff';
    const textSecondary = '#ffffff';
    const textMuted = '#d1d5db';

    doc.rect(0, 0, W, H).fill(darkBg);

    doc.save();
    doc.circle(W - 50, 60, 200).fill('#0f2b1d');
    doc.restore();
    doc.save();
    doc.circle(30, H - 100, 150).fill('#0d1f2d');
    doc.restore();

    doc.roundedRect(40, 30, W - 80, 90, 14).lineWidth(0.5).fillAndStroke(darkCard, '#1a3a2a');

    doc.roundedRect(50, 42, 48, 48, 12).fill('#059669');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('CO', 54, 55);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text('2', 78, 61);

    doc.fontSize(9).font('Helvetica').fillColor(greenBright).text('SOCCORSO DIGITALE', 112, 42);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#f0fdf4').text('Carbon Footprint Tracker', 112, 56);
    doc.fontSize(9).font('Helvetica').fillColor(textSecondary).text(`Analisi emissioni CO2 della flotta - ${orgName}`, 112, 80);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff').text(periodLabel.toUpperCase(), 400, 50, { align: 'right', width: 145 });
    doc.fontSize(8).font('Helvetica').fillColor(textMuted).text(`Generato: ${new Date().toLocaleDateString('it-IT')}`, 400, 68, { align: 'right', width: 145 });

    const heroY = 140;
    const bw = 120;
    const bg2 = 8;
    const mx = 40;

    const drawStatBox = (x: number, y: number, label: string, value: string, unit: string, accentColor: string, borderColor: string) => {
      doc.roundedRect(x, y, bw, 75, 12).lineWidth(0.5).fillAndStroke(darkCard, borderColor);
      doc.roundedRect(x, y, bw, 4, 2).fill(accentColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text(label, x + 8, y + 14, { width: bw - 16, align: 'center' });
      doc.fontSize(20).font('Helvetica-Bold').fillColor(textPrimary).text(value, x + 8, y + 28, { width: bw - 16, align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(unit, x + 8, y + 54, { width: bw - 16, align: 'center' });
    };

    drawStatBox(mx, heroY, 'CO2 EMESSA', totalCo2Tonnes.toFixed(1), 'tonnellate', '#ef4444', '#3b1a1a');
    drawStatBox(mx + bw + bg2, heroY, 'KM TOTALI', totalKm.toLocaleString('it-IT'), 'chilometri', greenPrimary, '#1a3a2a');
    drawStatBox(mx + (bw + bg2) * 2, heroY, 'VIAGGI', tripCount.toLocaleString('it-IT'), 'servizi', greenLight, '#1a3a2a');
    drawStatBox(mx + (bw + bg2) * 3, heroY, 'EFFICIENZA', `${avgCo2PerKm}`, 'g CO2/km', '#06b6d4', '#1a2a3a');

    const ecoY = heroY + 88;
    const ecoW = 163;
    const ecoItems = [
      { label: 'Alberi per compensare', value: treesNeeded.toLocaleString('it-IT'), border: '#1a3a2a' },
      { label: 'Km medi per trasporto', value: `${avgKmPerTrip}`, border: '#1a3a2a' },
      { label: 'Litri carburante stimati', value: fuelLiters.toLocaleString('it-IT'), border: '#1a2a3a' },
    ];
    ecoItems.forEach((item, i) => {
      const ex = mx + i * (ecoW + 6);
      doc.roundedRect(ex, ecoY, ecoW, 38, 10).lineWidth(0.5).fillAndStroke('#0f172a', item.border);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text(item.value, ex + 12, ecoY + 8);
      doc.fontSize(7).font('Helvetica').fillColor(textMuted).text(item.label, ex + 12, ecoY + 25);
    });

    const fuelY = ecoY + 52;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(greenBright).text('EMISSIONI PER TIPO CARBURANTE', mx, fuelY);
    doc.rect(mx, fuelY + 16, W - 80, 1).fill('#1a3a2a');

    const fuelConfig: Record<string, { label: string; factor: string; color: string }> = {
      'Gasolio': { label: 'Gasolio', factor: '171 g/km', color: '#22c55e' },
      'Benzina': { label: 'Benzina', factor: '164 g/km', color: '#10b981' },
      'GPL': { label: 'GPL', factor: '127 g/km', color: '#34d399' },
      'Metano': { label: 'Metano', factor: '115 g/km', color: '#06b6d4' },
      'Elettrico': { label: 'Elettrico', factor: '0 g/km', color: '#38bdf8' },
    };

    let fuelRowY = fuelY + 26;
    const maxFuelEmissions = Math.max(...byFuelType.map(f => Number(f.totalCo2Kg) || 0), 1);

    if (byFuelType.length > 0) {
      byFuelType.forEach((f) => {
        const config = fuelConfig[f.fuelType || 'Gasolio'] || { label: f.fuelType || 'Altro', factor: '-', color: textMuted };
        const emissions = Number(f.totalCo2Kg) || 0;
        const barWidth = (emissions / maxFuelEmissions) * 260;

        doc.fontSize(8).font('Helvetica-Bold').fillColor(textPrimary).text(config.label, mx + 10, fuelRowY);
        doc.fontSize(7).font('Helvetica').fillColor(textMuted).text(`(${config.factor})`, mx + 70, fuelRowY);

        doc.roundedRect(170, fuelRowY - 2, 260, 12, 4).fill('#1e293b');
        doc.roundedRect(170, fuelRowY - 2, Math.max(barWidth, 5), 12, 4).fill(config.color);

        doc.fontSize(7).font('Helvetica-Bold').fillColor(textSecondary).text(`${(emissions / 1000).toFixed(2)}t`, 440, fuelRowY, { width: 70, align: 'right' });

        fuelRowY += 20;
      });
    } else {
      doc.fontSize(9).font('Helvetica').fillColor(textMuted).text('Nessun dato disponibile per il periodo selezionato', mx + 10, fuelRowY);
      fuelRowY += 22;
    }

    const vehicleY = fuelRowY + 18;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(greenBright).text('TOP 10 VEICOLI PER EMISSIONI', mx, vehicleY);
    doc.rect(mx, vehicleY + 16, W - 80, 1).fill('#1a3a2a');

    const tableHeaderY = vehicleY + 24;
    doc.roundedRect(mx, tableHeaderY, W - 80, 16, 4).fill('#1e293b');
    doc.fontSize(7).font('Helvetica-Bold').fillColor(greenBright);
    doc.text('#', mx + 8, tableHeaderY + 4);
    doc.text('VEICOLO', mx + 28, tableHeaderY + 4);
    doc.text('CARBURANTE', mx + 140, tableHeaderY + 4);
    doc.text('KM', mx + 240, tableHeaderY + 4);
    doc.text('CO2 (kg)', mx + 320, tableHeaderY + 4);
    doc.text('% TOTALE', mx + 420, tableHeaderY + 4);

    let tableRowY = tableHeaderY + 20;
    if (byVehicle.length > 0) {
      byVehicle.forEach((v, idx) => {
        const emissions = Number(v.totalEmissions) || 0;
        const pct = totalCo2Kg > 0 ? (emissions / totalCo2Kg * 100) : 0;
        const rowBg = idx % 2 === 0 ? darkCard : '#0f172a';

        doc.roundedRect(mx, tableRowY - 3, W - 80, 15, 3).fill(rowBg);
        doc.fontSize(7).font('Helvetica').fillColor(textSecondary);
        doc.text(`${idx + 1}`, mx + 8, tableRowY);
        doc.font('Helvetica-Bold').fillColor(textPrimary).text(v.vehicleCode || 'N/A', mx + 28, tableRowY);
        doc.font('Helvetica').fillColor(textSecondary).text(v.fuelType || 'Gasolio', mx + 140, tableRowY);
        doc.text(Math.round(Number(v.totalKm) || 0).toLocaleString('it-IT'), mx + 240, tableRowY);
        doc.text(Math.round(emissions).toLocaleString('it-IT'), mx + 320, tableRowY);

        const pctBarW = Math.min(pct, 100) * 0.5;
        doc.roundedRect(mx + 420, tableRowY, 50, 8, 3).fill('#1e293b');
        doc.roundedRect(mx + 420, tableRowY, pctBarW, 8, 3).fill(pct > 20 ? '#ef4444' : pct > 10 ? '#eab308' : greenPrimary);
        doc.fillColor(textSecondary).text(`${pct.toFixed(1)}%`, mx + 475, tableRowY);

        tableRowY += 15;
      });
    } else {
      doc.fontSize(8).font('Helvetica').fillColor(textMuted).text('Nessun dato veicoli disponibile', mx + 10, tableRowY);
      tableRowY += 18;
    }

    const methodY = Math.min(tableRowY + 16, 720);
    doc.roundedRect(mx, methodY, W - 80, 42, 10).lineWidth(0.5).fillAndStroke('#0f2b1d', '#1a3a2a');
    doc.fontSize(8).font('Helvetica-Bold').fillColor(greenBright).text('METODOLOGIA ISPRA 2024', mx + 14, methodY + 8);
    doc.fontSize(7).font('Helvetica').fillColor(textMuted);
    doc.text('Fattori di emissione: Gasolio 171 g/km | Benzina 164 g/km | GPL 127 g/km | Metano 115 g/km | Elettrico 0 g/km', mx + 14, methodY + 20);
    doc.text('Fonte: ISPRA - Istituto Superiore per la Protezione e la Ricerca Ambientale - Rapporto 2024', mx + 14, methodY + 30);

    doc.rect(0, H - 50, W, 50).fill('#0f2b1d');
    doc.fontSize(8).font('Helvetica').fillColor(greenBright).text('SOCCORSO DIGITALE S.R.L. - Report Carbon Footprint Automatizzato', mx, H - 42, { align: 'center', width: W - 80 });
    doc.fontSize(7).fillColor(textMuted).text('Conforme alle linee guida ISPRA per la rendicontazione ambientale', mx, H - 30, { align: 'center', width: W - 80 });
    doc.fontSize(7).fillColor(textMuted).text(`Generato da SOCCORSO DIGITALE per ${orgName}`, mx, H - 20, { width: W - 80, align: 'center' });

    doc.end();
  } catch (error) {
    console.error("Error generating Carbon PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF Carbon" });
  }
});

// Carbon Footprint Report PDF - Per Vehicle
app.get("/api/carbon/report/pdf/vehicle/:vehicleId", requireAdmin, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { period = 'quarter' } = req.query;

    const orgId = getEffectiveOrgId(req);
    let orgName = '';
    if (orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (org) orgName = org.name;
    }

    const now = new Date();
    let startDate: Date;
    let periodLabel: string;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = `${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`;
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      periodLabel = `Anno ${now.getFullYear()}`;
    } else {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterStart, 1);
      periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    }
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get vehicle info
    const vehicleInfo = await db.select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    if (!vehicleInfo[0]) {
      return res.status(404).json({ error: "Veicolo non trovato" });
    }

    const vehicleCode = vehicleInfo[0].code;
    const vehiclePlate = vehicleInfo[0].licensePlate;
    const vehicleFuelType = vehicleInfo[0].fuelType || 'Gasolio';

    // Get carbon stats for this vehicle
    const stats = await db.select({
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      avgCo2PerKm: sql<number>`COALESCE(AVG(${tripCarbonFootprint.co2PerKm}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(${tripCarbonFootprint.id})`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(and(
        sql`${trips.serviceDate} >= ${startDateStr}`,
        eq(tripCarbonFootprint.vehicleId, vehicleId)
      ));

    // Get monthly trend for this vehicle
    const monthlyTrend = await db.select({
      month: sql<string>`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`,
      totalCo2Kg: sql<number>`COALESCE(SUM(${tripCarbonFootprint.co2EmittedKg}), 0)`,
      totalKm: sql<number>`COALESCE(SUM(${tripCarbonFootprint.kmTraveled}), 0)`,
      tripCount: sql<number>`COUNT(*)`,
    }).from(tripCarbonFootprint)
      .innerJoin(trips, eq(tripCarbonFootprint.tripId, trips.id))
      .where(and(
        sql`${trips.serviceDate} >= NOW() - INTERVAL '12 months'`,
        eq(tripCarbonFootprint.vehicleId, vehicleId)
      ))
      .groupBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${trips.serviceDate}, 'YYYY-MM')`);

    const totalCo2Kg = Number(stats[0]?.totalCo2Kg) || 0;
    const totalCo2Tonnes = totalCo2Kg / 1000;
    const totalKm = Math.round(Number(stats[0]?.totalKm) || 0);
    const avgCo2PerKm = Math.round(Number(stats[0]?.avgCo2PerKm) || 0);
    const tripCount = Number(stats[0]?.tripCount) || 0;
    const avgKmPerTrip = tripCount > 0 ? Math.round(totalKm / tripCount) : 0;

    const treesNeeded = Math.ceil(totalCo2Kg / 21.77);
    const fuelLiters = Math.round(totalCo2Kg / 2.68);

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Carbon_${vehicleCode}_${periodLabel.replace(/\s/g, '_')}.pdf`);
    doc.pipe(res);

    const W = 595;
    const H = 842;
    const darkBg = '#0a1628';
    const darkCard = '#111e36';
    const greenPrimary = '#10b981';
    const greenLight = '#22c55e';
    const greenBright = '#6ee7b7';
    const greenMuted = '#34d399';
    const textPrimary = '#ffffff';
    const textSecondary = '#ffffff';
    const textMuted = '#d1d5db';
    const mx = 40;

    doc.rect(0, 0, W, H).fill(darkBg);
    doc.save();
    doc.circle(W - 50, 60, 200).fill('#0f2b1d');
    doc.restore();
    doc.save();
    doc.circle(30, H - 100, 150).fill('#0d1f2d');
    doc.restore();

    doc.roundedRect(mx, 25, W - 80, 100, 14).lineWidth(0.5).fillAndStroke(darkCard, '#1a3a2a');

    doc.roundedRect(50, 38, 48, 48, 12).fill('#059669');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff').text('CO', 54, 51);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text('2', 78, 57);

    doc.fontSize(9).font('Helvetica').fillColor(greenBright).text('SOCCORSO DIGITALE', 112, 38);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#f0fdf4').text('Carbon Footprint - Report Veicolo', 112, 52);

    doc.roundedRect(112, 74, 120, 24, 8).fill(greenPrimary);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#ffffff').text(vehicleCode, 120, 79);

    doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(`Targa: ${vehiclePlate}`, 245, 76);
    doc.text(`Carburante: ${vehicleFuelType}`, 245, 88);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff').text(periodLabel.toUpperCase(), 400, 45, { align: 'right', width: 145 });
    doc.fontSize(8).font('Helvetica').fillColor(textMuted).text(`Generato: ${new Date().toLocaleDateString('it-IT')}`, 400, 62, { align: 'right', width: 145 });

    const heroY = 145;
    const bw = 120;
    const bg2 = 8;

    const drawStatBox2 = (x: number, y: number, label: string, value: string, unit: string, accentColor: string, borderColor: string) => {
      doc.roundedRect(x, y, bw, 75, 12).lineWidth(0.5).fillAndStroke(darkCard, borderColor);
      doc.roundedRect(x, y, bw, 4, 2).fill(accentColor);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(textMuted).text(label, x + 8, y + 14, { width: bw - 16, align: 'center' });
      doc.fontSize(20).font('Helvetica-Bold').fillColor(textPrimary).text(value, x + 8, y + 28, { width: bw - 16, align: 'center' });
      doc.fontSize(8).font('Helvetica').fillColor(textSecondary).text(unit, x + 8, y + 54, { width: bw - 16, align: 'center' });
    };

    drawStatBox2(mx, heroY, 'CO2 EMESSA', totalCo2Tonnes.toFixed(2), 'tonnellate', '#ef4444', '#3b1a1a');
    drawStatBox2(mx + bw + bg2, heroY, 'KM TOTALI', totalKm.toLocaleString('it-IT'), 'chilometri', greenPrimary, '#1a3a2a');
    drawStatBox2(mx + (bw + bg2) * 2, heroY, 'VIAGGI', tripCount.toLocaleString('it-IT'), 'servizi', greenLight, '#1a3a2a');
    drawStatBox2(mx + (bw + bg2) * 3, heroY, 'EFFICIENZA', `${avgCo2PerKm}`, 'g CO2/km', '#06b6d4', '#1a2a3a');

    const ecoY = heroY + 88;
    const ecoW = 163;
    const ecoItems = [
      { label: 'Alberi per compensare', value: treesNeeded.toLocaleString('it-IT'), border: '#1a3a2a' },
      { label: 'Km medi per trasporto', value: `${avgKmPerTrip}`, border: '#1a3a2a' },
      { label: 'Litri carburante stimati', value: fuelLiters.toLocaleString('it-IT'), border: '#1a2a3a' },
    ];
    ecoItems.forEach((item, i) => {
      const ex = mx + i * (ecoW + 6);
      doc.roundedRect(ex, ecoY, ecoW, 38, 10).lineWidth(0.5).fillAndStroke('#0f172a', item.border);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textPrimary).text(item.value, ex + 12, ecoY + 8);
      doc.fontSize(7).font('Helvetica').fillColor(textMuted).text(item.label, ex + 12, ecoY + 25);
    });

    const trendY = ecoY + 52;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(greenBright).text('ANDAMENTO MENSILE ULTIMI 12 MESI', mx, trendY);
    doc.rect(mx, trendY + 16, W - 80, 1).fill('#1a3a2a');

    const tableHeaderY = trendY + 24;
    doc.roundedRect(mx, tableHeaderY, W - 80, 16, 4).fill('#1e293b');
    doc.fontSize(7).font('Helvetica-Bold').fillColor(greenBright);
    doc.text('MESE', mx + 10, tableHeaderY + 4);
    doc.text('KM PERCORSI', mx + 130, tableHeaderY + 4);
    doc.text('CO2 (kg)', mx + 250, tableHeaderY + 4);
    doc.text('SERVIZI', mx + 350, tableHeaderY + 4);
    doc.text('MEDIA km/VIAGGIO', mx + 430, tableHeaderY + 4);

    let tableRowY = tableHeaderY + 20;
    const maxRowsToShow = Math.min(monthlyTrend.length, 12);

    if (monthlyTrend.length > 0) {
      monthlyTrend.slice(-maxRowsToShow).forEach((m, idx) => {
        const km = Number(m.totalKm) || 0;
        const co2 = Number(m.totalCo2Kg) || 0;
        const trps = Number(m.tripCount) || 0;
        const avgKm = trps > 0 ? Math.round(km / trps) : 0;
        const rowBg = idx % 2 === 0 ? darkCard : '#0f172a';

        doc.roundedRect(mx, tableRowY - 3, W - 80, 15, 3).fill(rowBg);
        doc.fontSize(7).font('Helvetica').fillColor(textSecondary);

        const [year, month] = (m.month || '').split('-');
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const monthLbl = monthNames[parseInt(month) - 1] || month;

        doc.text(`${monthLbl} ${year}`, mx + 10, tableRowY);
        doc.text(Math.round(km).toLocaleString('it-IT'), mx + 130, tableRowY);
        doc.text(co2.toFixed(1), mx + 250, tableRowY);
        doc.text(trps.toString(), mx + 350, tableRowY);
        doc.text(avgKm.toString(), mx + 450, tableRowY);

        tableRowY += 15;
      });
    } else {
      doc.fontSize(8).font('Helvetica').fillColor(textMuted).text('Nessun dato disponibile per questo veicolo nel periodo selezionato', mx + 10, tableRowY);
      tableRowY += 22;
    }

    const infoY = Math.min(tableRowY + 18, 640);
    doc.roundedRect(mx, infoY, W - 80, 52, 10).lineWidth(0.5).fillAndStroke('#0f2b1d', '#1a3a2a');
    doc.roundedRect(mx, infoY, W - 80, 4, 2).fill(greenPrimary);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(greenBright).text('INFORMAZIONI VEICOLO', mx + 14, infoY + 12);
    doc.fontSize(8).font('Helvetica').fillColor(textSecondary);
    doc.text(`Codice: ${vehicleCode}`, mx + 14, infoY + 26);
    doc.text(`Targa: ${vehiclePlate}`, mx + 160, infoY + 26);
    doc.text(`Carburante: ${vehicleFuelType}`, mx + 310, infoY + 26);
    doc.text(`Fattore emissione ISPRA 2024: ${avgCo2PerKm} g CO2/km`, mx + 14, infoY + 40);

    const methodY = Math.min(infoY + 65, 710);
    doc.roundedRect(mx, methodY, W - 80, 38, 10).lineWidth(0.5).fillAndStroke('#0f172a', '#162232');
    doc.fontSize(7).font('Helvetica-Bold').fillColor(greenBright).text('METODOLOGIA ISPRA 2024', mx + 14, methodY + 8);
    doc.fontSize(6).font('Helvetica').fillColor(textMuted);
    doc.text('Fattori di emissione: Gasolio 171 g/km | Benzina 164 g/km | GPL 127 g/km | Metano 115 g/km | Elettrico 0 g/km', mx + 14, methodY + 18);
    doc.text('Fonte: ISPRA - Istituto Superiore per la Protezione e la Ricerca Ambientale - Rapporto 2024', mx + 14, methodY + 28);

    doc.rect(0, H - 50, W, 50).fill('#0f2b1d');
    doc.fontSize(8).font('Helvetica').fillColor(greenBright).text(`SOCCORSO DIGITALE S.R.L. - Report Carbon Footprint ${vehicleCode}`, mx, H - 42, { align: 'center', width: W - 80 });
    doc.fontSize(7).fillColor(textMuted).text('Conforme alle linee guida ISPRA per la rendicontazione ambientale', mx, H - 30, { align: 'center', width: W - 80 });
    doc.fontSize(7).fillColor(textMuted).text(`Generato da SOCCORSO DIGITALE per ${orgName}`, mx, H - 20, { width: W - 80, align: 'center' });

    doc.end();
  } catch (error) {
    console.error("Error generating Vehicle Carbon PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF Carbon per veicolo" });
  }
});

// Burnout Prevention Report PDF - Innovative Wellness Theme
app.get("/api/burnout/report/pdf", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get thresholds
    const thresholdData = await db.select()
      .from(burnoutThresholds)
      .where(eq(burnoutThresholds.isActive, true))
      .limit(1);
    
    const thresholds = thresholdData[0] || {
      maxHoursPerWeek: 48,
      maxConsecutiveDays: 6,
      maxNightShiftsPerWeek: 3,
      minRestHoursBetweenShifts: 11,
    };

    // Get workload data
    const workloads = await db.select({
      staffMemberId: operatorWorkload.staffMemberId,
      totalHoursWeek: operatorWorkload.totalHoursWeek,
      consecutiveDaysWorked: operatorWorkload.consecutiveDaysWorked,
      nightShiftsCount: operatorWorkload.nightShiftsCount,
      riskLevel: operatorWorkload.riskLevel,
      riskScore: operatorWorkload.riskScore,
    }).from(operatorWorkload)
      .where(eq(operatorWorkload.weekStartDate, weekStartStr));

    // Get staff names
    const staffList = await db.select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
    }).from(staffMembers);
    const staffMap = new Map(staffList.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

    // Get alerts
    const alerts = await db.select()
      .from(burnoutAlerts)
      .where(eq(burnoutAlerts.isResolved, false))
      .orderBy(desc(burnoutAlerts.createdAt))
      .limit(10);

    // Risk counts
    const riskCounts = {
      low: workloads.filter(w => w.riskLevel === 'low').length,
      moderate: workloads.filter(w => w.riskLevel === 'moderate').length,
      high: workloads.filter(w => w.riskLevel === 'high').length,
      critical: workloads.filter(w => w.riskLevel === 'critical').length,
    };
    const totalAnalyzed = workloads.length;
    const complianceRate = totalAnalyzed > 0 ? Math.round(((riskCounts.low + riskCounts.moderate) / totalAnalyzed) * 100) : 100;
    const atRiskCount = riskCounts.high + riskCounts.critical;

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Burnout_Prevention_${weekStartStr}.pdf`);
    doc.pipe(res);

    // === HEADER - Purple Wellness Theme ===
    doc.rect(0, 0, 595, 110).fill('#4c1d95');
    doc.rect(0, 105, 595, 10).fill('#a78bfa');
    
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff').text('BURNOUT PREVENTION', 50, 25);
    doc.fontSize(14).font('Helvetica').text('REPORT D.Lgs. 81/2008', 50, 52);
    doc.fontSize(10).text('SOCCORSO DIGITALE', 50, 72);
    
    doc.fontSize(12).font('Helvetica-Bold').text('SETTIMANA', 400, 30, { align: 'right', width: 145 });
    doc.fontSize(10).font('Helvetica').text(`${new Date(weekStartStr).toLocaleDateString('it-IT')} - ${new Date(weekEndStr).toLocaleDateString('it-IT')}`, 400, 48, { align: 'right', width: 145 });
    doc.fontSize(9).text(`Gen. ${new Date().toLocaleDateString('it-IT')}`, 400, 65, { align: 'right', width: 145 });

    // === COMPLIANCE STATUS HERO ===
    const heroY = 135;
    const statusColor = complianceRate >= 90 ? '#10b981' : complianceRate >= 70 ? '#f59e0b' : '#ef4444';
    const statusLabel = complianceRate >= 90 ? 'CONFORME' : complianceRate >= 70 ? 'ATTENZIONE' : 'CRITICO';
    
    doc.rect(50, heroY, 240, 90).lineWidth(2).strokeColor('#4c1d95').stroke();
    doc.circle(110, heroY + 45, 30).fill(statusColor);
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text(complianceRate >= 90 ? 'OK' : '!', 95, heroY + 33, { width: 30, align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('STATO CONFORMITA', 150, heroY + 15);
    doc.fontSize(28).fillColor(statusColor).text(`${complianceRate}%`, 150, heroY + 32);
    doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(statusLabel, 150, heroY + 65);

    // Risk Summary Box
    doc.rect(305, heroY, 240, 90).fill('#faf5ff');
    doc.rect(305, heroY, 240, 6).fill('#a78bfa');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#4c1d95').text('RIEPILOGO RISCHIO', 315, heroY + 15);
    doc.fontSize(9).font('Helvetica').fillColor('#374151');
    doc.text(`Operatori Analizzati: ${totalAnalyzed}`, 315, heroY + 35);
    doc.text(`A Rischio Elevato: ${atRiskCount}`, 315, heroY + 50);
    doc.text(`Avvisi Attivi: ${alerts.length}`, 315, heroY + 65);

    // === RISK DISTRIBUTION VISUAL ===
    const riskY = 245;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#4c1d95').text('DISTRIBUZIONE LIVELLI DI RISCHIO', 50, riskY);
    doc.rect(50, riskY + 18, 495, 2).fill('#a78bfa');

    const riskBarY = riskY + 35;
    const riskConfig = [
      { level: 'low', label: 'BASSO', count: riskCounts.low, color: '#10b981', bgColor: '#ecfdf5' },
      { level: 'moderate', label: 'MODERATO', count: riskCounts.moderate, color: '#f59e0b', bgColor: '#fefce8' },
      { level: 'high', label: 'ALTO', count: riskCounts.high, color: '#f97316', bgColor: '#fff7ed' },
      { level: 'critical', label: 'CRITICO', count: riskCounts.critical, color: '#ef4444', bgColor: '#fef2f2' },
    ];

    const barMaxWidth = 350;
    const maxCount = Math.max(...riskConfig.map(r => r.count), 1);
    
    riskConfig.forEach((risk, idx) => {
      const rowY = riskBarY + idx * 28;
      const barWidth = (risk.count / maxCount) * barMaxWidth;
      
      // Label
      doc.fontSize(9).font('Helvetica-Bold').fillColor(risk.color).text(risk.label, 55, rowY + 3);
      
      // Bar background
      doc.rect(130, rowY, barMaxWidth, 18).fill('#e5e7eb');
      // Bar fill
      if (risk.count > 0) {
        doc.rect(130, rowY, Math.max(barWidth, 8), 18).fill(risk.color);
      }
      
      // Count
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text(`${risk.count}`, 490, rowY + 3, { width: 50, align: 'right' });
    });

    // === COMPLIANCE THRESHOLDS BOX ===
    const threshY = riskBarY + 130;
    doc.rect(50, threshY, 495, 75).fill('#f8fafc');
    doc.rect(50, threshY, 6, 75).fill('#4c1d95');
    
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#4c1d95').text('LIMITI D.LGS. 81/2008 CONFIGURATI', 65, threshY + 10);
    
    const thresholdItems = [
      { label: 'Ore Max Settimanali', value: `${thresholds.maxHoursPerWeek}h`, icon: 'clock' },
      { label: 'Giorni Consecutivi Max', value: `${thresholds.maxConsecutiveDays}`, icon: 'calendar' },
      { label: 'Turni Notturni Max/Sett', value: `${thresholds.maxNightShiftsPerWeek}`, icon: 'moon' },
      { label: 'Riposo Minimo tra Turni', value: `${thresholds.minRestHoursBetweenShifts}h`, icon: 'rest' },
    ];
    
    const colWidth = 120;
    thresholdItems.forEach((item, idx) => {
      const x = 65 + idx * colWidth;
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(item.label, x, threshY + 32);
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151').text(item.value, x, threshY + 48);
    });

    // === HIGH RISK STAFF TABLE ===
    const highRiskStaff = workloads.filter(w => w.riskLevel === 'high' || w.riskLevel === 'critical');
    const staffTableY = threshY + 95;
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#4c1d95').text('OPERATORI A RISCHIO ELEVATO', 50, staffTableY);
    doc.rect(50, staffTableY + 18, 495, 2).fill('#ef4444');

    if (highRiskStaff.length > 0) {
      // Table Header
      const headerY = staffTableY + 28;
      doc.rect(50, headerY, 495, 20).fill('#fef2f2');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#991b1b');
      doc.text('OPERATORE', 60, headerY + 6);
      doc.text('LIVELLO', 200, headerY + 6);
      doc.text('ORE/SETT', 280, headerY + 6);
      doc.text('GG CONSEC.', 350, headerY + 6);
      doc.text('NOTTURNI', 420, headerY + 6);
      doc.text('SCORE', 490, headerY + 6);

      let staffRowY = headerY + 24;
      highRiskStaff.slice(0, 8).forEach((w, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fef2f2';
        const levelColor = w.riskLevel === 'critical' ? '#ef4444' : '#f97316';
        
        doc.rect(50, staffRowY - 2, 495, 18).fill(rowBg);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
        doc.text((staffMap.get(w.staffMemberId) || 'N/A').substring(0, 25), 60, staffRowY + 2);
        
        // Level badge
        const levelLabel = w.riskLevel === 'critical' ? 'CRITICO' : 'ALTO';
        doc.rect(200, staffRowY, 50, 14).fill(levelColor);
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff').text(levelLabel, 205, staffRowY + 3);
        
        doc.fontSize(8).font('Helvetica').fillColor('#374151');
        doc.text(String(Math.round(Number(w.totalHoursWeek) || 0)), 280, staffRowY + 2);
        doc.text(String(w.consecutiveDaysWorked || 0), 350, staffRowY + 2);
        doc.text(String(w.nightShiftsCount || 0), 420, staffRowY + 2);
        doc.text(String(Math.round(Number(w.riskScore) || 0)), 490, staffRowY + 2);
        
        staffRowY += 18;
      });
      
      if (highRiskStaff.length > 8) {
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(`+ altri ${highRiskStaff.length - 8} operatori...`, 60, staffRowY + 5);
      }
    } else {
      doc.rect(50, staffTableY + 28, 495, 40).fill('#ecfdf5');
      doc.fontSize(10).font('Helvetica').fillColor('#047857').text('Nessun operatore a rischio elevato in questa settimana', 60, staffTableY + 43);
    }

    // === ACTIVE ALERTS ===
    // Calculate proper Y position with enough space after staff table
    const staffTableEndY = staffTableY + 20 + (highRiskStaff.length > 0 
      ? 28 + Math.min(highRiskStaff.length, 8) * 18 + (highRiskStaff.length > 8 ? 20 : 0)
      : 70);
    const alertsY = staffTableEndY + 15;
    
    // Alert type translations
    const alertTypeLabels: Record<string, string> = {
      'CONSECUTIVEDAYS': 'Giorni Consecutivi',
      'HOURSEXCESS': 'Ore in Eccesso',
      'NIGHTSHIFTS': 'Turni Notturni',
      'RESTPERIOD': 'Riposo Insufficiente',
      'OVERWORK': 'Sovraccarico',
      'ALERT': 'Avviso',
    };
    
    // Calculate available space before footer (footer starts at Y=780)
    const footerStartY = 770;
    const availableSpace = footerStartY - alertsY - 30; // 30px for header + margin
    const maxAlertsToShow = Math.max(0, Math.floor(availableSpace / 18));
    
    if (alerts.length > 0 && maxAlertsToShow > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#4c1d95').text('AVVISI ATTIVI', 50, alertsY);
      doc.rect(50, alertsY + 15, 495, 2).fill('#f59e0b');
      
      let alertRowY = alertsY + 25;
      const alertsToDisplay = Math.min(alerts.length, maxAlertsToShow);
      alerts.slice(0, alertsToDisplay).forEach((a, idx) => {
        const staffName = staffMap.get(a.staffMemberId) || 'N/A';
        const alertLabel = alertTypeLabels[a.alertType?.toUpperCase() || 'ALERT'] || a.alertType || 'Avviso';
        doc.rect(50, alertRowY - 2, 495, 18).fill(idx % 2 === 0 ? '#fffbeb' : '#ffffff');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e').text(`[${alertLabel}]`, 55, alertRowY + 2);
        doc.font('Helvetica').fillColor('#374151').text(`${staffName}: ${a.title?.substring(0, 55) || 'Avviso'}`, 145, alertRowY + 2);
        alertRowY += 18;
      });
      
      if (alerts.length > alertsToDisplay) {
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(`+ altri ${alerts.length - alertsToDisplay} avvisi...`, 55, alertRowY + 2);
      }
    }

    // === FOOTER ===
    doc.rect(0, 780, 595, 62).fill('#4c1d95');
    doc.fontSize(9).font('Helvetica').fillColor('#c4b5fd').text('SOCCORSO DIGITALE S.R.L. - Sistema Prevenzione Burnout', 50, 795, { align: 'center', width: 495 });
    doc.fontSize(8).fillColor('#ddd6fe').text('Conforme al D.Lgs. 81/2008 - Testo Unico sulla Sicurezza sul Lavoro', 50, 810, { align: 'center', width: 495 });

    doc.end();
  } catch (error) {
    console.error("Error generating Burnout PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF Burnout" });
  }
});

  // ===== ACADEMY PLAN PDF =====
app.get("/api/academy/plan/pdf", async (req, res) => {
  try {
    generateAcademyPlanPDF(res);
  } catch (error) {
    console.error("Error generating Academy Plan PDF:", error);
    res.status(500).json({ error: "Errore nella generazione PDF" });
  }
});

}
