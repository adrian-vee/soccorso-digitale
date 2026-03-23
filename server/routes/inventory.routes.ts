import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin, getUserId, getLocationFilter } from "../auth-middleware";
import { generateEventPDF } from "../event-pdf-generator";

// GS1 DataMatrix parsing for medical products
// Application Identifiers: (01)=GTIN, (17)=Expiry, (30)=Qty, (10)=Lot, (21)=Serial, (91-99)=Internal
interface GS1ParsedData {
  gtin?: string;
  expiryDate?: string; // YYMMDD format
  quantity?: number;
  lotNumber?: string;
  serialNumber?: string;
  internalInfo?: string;
  rawData: string;
}

function parseGS1Barcode(data: string): GS1ParsedData | null {
  const result: GS1ParsedData = { rawData: data };

  // GS1 codes can use different formats:
  // 1. With parentheses: (01)12345678901234(17)251231(30)10
  // 2. With FNC1/GS separators (char 29): 01123456789012341725123130...
  // 3. Square brackets: [01]12345678901234[17]251231

  // Check if it looks like a GS1 code
  const hasParentheses = /\(\d{2}\)/.test(data);
  const hasBrackets = /\[\d{2}\]/.test(data);
  const startsWithAI = /^(01|10|17|21|30|91)/.test(data);

  if (!hasParentheses && !hasBrackets && !startsWithAI) {
    return null;
  }

  // Normalize to remove parentheses/brackets for easier parsing
  let normalized = data
    .replace(/\((\d{2})\)/g, "\x1D$1") // Replace (XX) with GS+XX
    .replace(/\[(\d{2})\]/g, "\x1D$1"); // Replace [XX] with GS+XX

  // If already starts with AI without delimiter, add one
  if (startsWithAI && !normalized.startsWith("\x1D")) {
    normalized = "\x1D" + normalized;
  }

  // Parse Application Identifiers
  // AI (01) - GTIN: 14 digits fixed
  const gtinMatch = normalized.match(/\x1D01(\d{14})/);
  if (gtinMatch) result.gtin = gtinMatch[1];

  // AI (17) - Expiry date: 6 digits YYMMDD
  const expiryMatch = normalized.match(/\x1D17(\d{6})/);
  if (expiryMatch) result.expiryDate = expiryMatch[1];

  // AI (30) - Quantity: variable digits (up to 8)
  const qtyMatch = normalized.match(/\x1D30(\d{1,8})/);
  if (qtyMatch) result.quantity = parseInt(qtyMatch[1]);

  // AI (10) - Lot/Batch number: variable alphanumeric (up to 20 chars)
  // Ends at next AI or end of string
  const lotMatch = normalized.match(/\x1D10([^\x1D]{1,20})/);
  if (lotMatch) result.lotNumber = lotMatch[1];

  // AI (21) - Serial number: variable alphanumeric (up to 20 chars)
  const serialMatch = normalized.match(/\x1D21([^\x1D]{1,20})/);
  if (serialMatch) result.serialNumber = serialMatch[1];

  // AI (91-99) - Internal info
  const internalMatch = normalized.match(/\x1D9[1-9]([^\x1D]{1,30})/);
  if (internalMatch) result.internalInfo = internalMatch[1];

  // Return null if no useful data was parsed
  if (!result.gtin && !result.expiryDate && !result.quantity && !result.lotNumber) {
    return null;
  }

  return result;
}

// Format GS1 expiry date (YYMMDD) to ISO date string
// GS1 standard for medical/pharma products: all years are 2000-2099
function formatGS1Date(yymmdd: string): string {
  if (yymmdd.length !== 6) return "";

  const yy = parseInt(yymmdd.substring(0, 2));
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  // GS1 medical products always use 21st century (2000-2099)
  const year = 2000 + yy;

  // Handle day 00 (GS1 convention: means last day of month)
  let day = dd;
  if (dd === "00") {
    const lastDay = new Date(year, parseInt(mm), 0).getDate();
    day = lastDay.toString().padStart(2, "0");
  }

  return `${year}-${mm}-${day}`;
}

export function registerInventoryRoutes(app: Express) {

  // ============================================================================
  // INVENTORY ITEMS API
  // ============================================================================

  app.get("/api/inventory/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getInventoryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ error: "Errore nel recupero articoli inventario" });
    }
  });

  // Get single inventory item
  app.get("/api/inventory/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getInventoryItemById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Articolo non trovato" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching inventory item:", error);
      res.status(500).json({ error: "Errore nel recupero articolo" });
    }
  });

  // Get inventory item by barcode (for scanner) - Enhanced with external API lookup
  // Supports GS1 DataMatrix, FDA GUDID (medical devices), UPCitemdb, OpenFoodFacts
  app.get("/api/inventory/barcode/:barcode", requireAuth, async (req, res) => {
    try {
      const rawBarcode = req.params.barcode;

      // STEP 0: Normalize - Parse GS1 first to extract GTIN for consistent lookups
      const gs1Data = parseGS1Barcode(rawBarcode);
      const normalizedBarcode = gs1Data?.gtin || rawBarcode;
      const isGS1 = !!(gs1Data?.gtin || gs1Data?.expiryDate || gs1Data?.lotNumber);

      // 1. First check internal inventory catalog (by normalized barcode)
      let internalItem = await storage.getInventoryItemByBarcode(normalizedBarcode);
      // Also try raw barcode if different
      if (!internalItem && normalizedBarcode !== rawBarcode) {
        internalItem = await storage.getInventoryItemByBarcode(rawBarcode);
      }

      if (internalItem) {
        const expiryDate = gs1Data?.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;
        return res.json({
          source: "internal",
          found: true,
          inventoryItem: internalItem,
          product: {
            barcode: normalizedBarcode,
            gtin: gs1Data?.gtin,
            name: internalItem.name,
            description: internalItem.description,
            category: internalItem.category,
            unit: internalItem.unit,
            hasExpiry: internalItem.hasExpiry,
            expiryAlertDays: internalItem.expiryAlertDays,
            expiryDate,
            batchNumber: gs1Data?.lotNumber,
            serialNumber: gs1Data?.serialNumber,
            gs1Parsed: isGS1 ? gs1Data : undefined
          }
        });
      }

      // 2. Check barcode product cache (by normalized barcode)
      let cachedProduct = await storage.getBarcodeProductCache(normalizedBarcode);
      // Also try raw barcode if different
      if (!cachedProduct && normalizedBarcode !== rawBarcode) {
        cachedProduct = await storage.getBarcodeProductCache(rawBarcode);
      }

      if (cachedProduct) {
        await storage.incrementBarcodeLookupCount(normalizedBarcode);
        const expiryDate = gs1Data?.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;
        return res.json({
          source: isGS1 ? "gs1_datamatrix_cached" : cachedProduct.source,
          found: true,
          cached: true,
          product: {
            barcode: normalizedBarcode,
            gtin: gs1Data?.gtin,
            name: cachedProduct.productName,
            description: cachedProduct.description || (gs1Data?.lotNumber ? `Lotto: ${gs1Data.lotNumber}` : ""),
            brand: cachedProduct.brand,
            manufacturer: cachedProduct.manufacturer,
            quantityPerPackage: gs1Data?.quantity || cachedProduct.quantityPerPackage,
            packageSize: cachedProduct.packageSize,
            unit: cachedProduct.defaultUnit || "pz",
            category: cachedProduct.category || "presidi",
            imageUrl: cachedProduct.imageUrl,
            hasExpiry: !!gs1Data?.expiryDate || cachedProduct.hasExpiry,
            expiryDate,
            batchNumber: gs1Data?.lotNumber,
            serialNumber: gs1Data?.serialNumber,
            gs1Parsed: isGS1 ? gs1Data : undefined
          }
        });
      }

      // 3. For GS1/medical products, try FDA GUDID API (free, no key required)
      if (gs1Data?.gtin) {
        try {
          // FDA GUDID lookup by Device Identifier (DI)
          const gudidUrl = `https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json?di=${gs1Data.gtin}`;
          const gudidResponse = await fetch(gudidUrl, {
            headers: { "User-Agent": "CroceEuropa-InventoryApp/1.0" }
          });

          if (gudidResponse.ok) {
            const gudidData = await gudidResponse.json();
            if (gudidData?.gudid?.device) {
              const device = gudidData.gudid.device;
              const expiryDate = gs1Data.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;

              // Get product codes for category mapping
              let category = "presidi";
              const productCode = device.productCodes?.[0]?.productCode;
              if (productCode) {
                if (/syringe|needle/i.test(device.deviceDescription || "")) category = "siringhe";
                else if (/bandage|gauze|dressing/i.test(device.deviceDescription || "")) category = "medicazione";
                else if (/glove|mask|gown/i.test(device.deviceDescription || "")) category = "protezione";
              }

              const cacheData = {
                barcode: gs1Data.gtin,
                source: "fda_gudid",
                productName: device.brandName || device.versionModelNumber || "",
                description: device.deviceDescription,
                brand: device.brandName,
                manufacturer: device.companyName,
                category,
                defaultUnit: "pz",
                hasExpiry: true,
                isVerified: true // FDA data is authoritative
              };

              // Cache the result for future lookups
              await storage.upsertBarcodeProductCache(cacheData);

              return res.json({
                source: "fda_gudid",
                found: true,
                product: {
                  barcode: gs1Data.gtin,
                  gtin: gs1Data.gtin,
                  name: cacheData.productName,
                  description: cacheData.description,
                  brand: cacheData.brand,
                  manufacturer: cacheData.manufacturer,
                  category: cacheData.category,
                  unit: "pz",
                  hasExpiry: true,
                  expiryDate,
                  batchNumber: gs1Data.lotNumber,
                  serialNumber: gs1Data.serialNumber,
                  gs1Parsed: gs1Data,
                  fdaDeviceClass: device.productCodes?.[0]?.deviceClass,
                  fdaMriSafety: device.mriSafety?.mrSafetyStatus
                }
              });
            }
          }
        } catch (gudidError) {
          console.error("FDA GUDID API error:", gudidError);
        }
      }

      // 4. Try UPCitemdb API (100 free lookups/day, no key for trial)
      try {
        const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${normalizedBarcode}`;
        const upcResponse = await fetch(upcUrl, {
          headers: {
            "User-Agent": "CroceEuropa-InventoryApp/1.0",
            "Accept": "application/json"
          }
        });

        if (upcResponse.ok) {
          const upcData = await upcResponse.json();
          if (upcData.items && upcData.items.length > 0) {
            const item = upcData.items[0];
            const expiryDate = gs1Data?.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;

            const cacheData = {
              barcode: normalizedBarcode,
              source: "upcitemdb",
              productName: item.title,
              description: item.description,
              brand: item.brand,
              manufacturer: item.manufacturer,
              category: "altro",
              defaultUnit: "pz",
              hasExpiry: false,
              imageUrl: item.images?.[0],
              isVerified: false
            };

            // Cache the result
            await storage.upsertBarcodeProductCache(cacheData);

            return res.json({
              source: "upcitemdb",
              found: true,
              product: {
                barcode: normalizedBarcode,
                gtin: gs1Data?.gtin,
                name: cacheData.productName,
                description: cacheData.description,
                brand: cacheData.brand,
                manufacturer: cacheData.manufacturer,
                category: cacheData.category,
                unit: "pz",
                imageUrl: cacheData.imageUrl,
                hasExpiry: cacheData.hasExpiry,
                expiryDate,
                batchNumber: gs1Data?.lotNumber,
                serialNumber: gs1Data?.serialNumber,
                gs1Parsed: isGS1 ? gs1Data : undefined
              }
            });
          }
        }
      } catch (upcError) {
        console.error("UPCitemdb API error:", upcError);
      }

      // 5. Try OpenFoodFacts API lookup
      try {
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${normalizedBarcode}.json`, {
          headers: { "User-Agent": "CroceEuropa-InventoryApp/1.0" }
        });

        if (offResponse.ok) {
          const offData = await offResponse.json();

          if (offData.status === 1 && offData.product) {
            const p = offData.product;

            // Parse quantity per package from quantity field (e.g., "10 x 5g" or "100ml")
            let quantityPerPackage: number | undefined;
            let packageSize: string | undefined;
            if (p.quantity) {
              packageSize = p.quantity;
              const match = p.quantity.match(/(\d+)\s*x/i);
              if (match) {
                quantityPerPackage = parseInt(match[1]);
              }
            }

            // Determine unit from quantity or category
            let defaultUnit = "pz";
            if (p.quantity) {
              if (/ml|l|lt/i.test(p.quantity)) defaultUnit = "ml";
              else if (/g|kg/i.test(p.quantity)) defaultUnit = "pz";
              else if (/conf|pack/i.test(p.quantity)) defaultUnit = "conf";
            }

            // Map category
            let category = "altro";
            const cats = p.categories_tags || [];
            if (cats.some((c: string) => /medical|pharma|medicine/i.test(c))) category = "farmaci";
            else if (cats.some((c: string) => /bandage|wound|first-aid/i.test(c))) category = "medicazione";
            else if (cats.some((c: string) => /gloves|mask|protection/i.test(c))) category = "protezione";
            else if (cats.some((c: string) => /beverage|drink|water/i.test(c))) category = "fluidi";

            // Determine if product typically has expiry
            const hasExpiry = !!(p.expiration_date || cats.some((c: string) => /food|beverage|pharma/i.test(c)));

            const expiryDate = gs1Data?.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;
            const cacheData = {
              barcode: normalizedBarcode,
              source: "openfoodfacts",
              productName: p.product_name || p.product_name_it || p.product_name_en,
              description: p.generic_name || p.generic_name_it,
              brand: p.brands,
              manufacturer: p.manufacturing_places,
              quantityPerPackage,
              packageSize,
              defaultUnit,
              category,
              imageUrl: p.image_url || p.image_front_url,
              hasExpiry,
              ingredients: p.ingredients_text,
              rawPayload: offData.product
            };

            // Cache the result
            await storage.upsertBarcodeProductCache(cacheData);

            return res.json({
              source: "openfoodfacts",
              found: true,
              cached: false,
              product: {
                barcode: normalizedBarcode,
                gtin: gs1Data?.gtin,
                name: cacheData.productName,
                description: cacheData.description,
                brand: cacheData.brand,
                manufacturer: cacheData.manufacturer,
                quantityPerPackage: cacheData.quantityPerPackage,
                packageSize: cacheData.packageSize,
                unit: cacheData.defaultUnit,
                category: cacheData.category,
                imageUrl: cacheData.imageUrl,
                hasExpiry: cacheData.hasExpiry,
                expiryDate,
                batchNumber: gs1Data?.lotNumber,
                ingredients: cacheData.ingredients,
                gs1Parsed: isGS1 ? gs1Data : undefined
              }
            });
          }
        }
      } catch (offError) {
        console.error("OpenFoodFacts API error:", offError);
      }

      // 6. Try parsing QR code as JSON (for internal custom QR codes)
      try {
        const qrData = JSON.parse(rawBarcode);
        if (qrData.name || qrData.sku) {
          return res.json({
            source: "qr_embedded",
            found: true,
            product: {
              barcode: qrData.sku || rawBarcode,
              name: qrData.name,
              description: qrData.description,
              quantityPerPackage: qrData.quantityPerPackage || qrData.qty,
              unit: qrData.unit || "pz",
              category: qrData.category || "altro",
              hasExpiry: qrData.hasExpiry || !!qrData.expiryDate,
              expiryDate: qrData.expiryDate,
              batchNumber: qrData.batch || qrData.lotto
            }
          });
        }
      } catch {
        // Not JSON, continue
      }

      // 7. If GS1 code but no name found, return partial data for manual entry
      if (isGS1) {
        const expiryDate = gs1Data?.expiryDate ? formatGS1Date(gs1Data.expiryDate) : undefined;
        return res.json({
          source: "gs1_datamatrix",
          found: true,
          needsName: true,
          product: {
            barcode: normalizedBarcode,
            gtin: gs1Data?.gtin,
            name: "", // User needs to enter this
            description: gs1Data?.lotNumber ? `Lotto: ${gs1Data.lotNumber}` : "",
            category: "presidi",
            unit: "pz",
            hasExpiry: !!gs1Data?.expiryDate,
            expiryDate,
            quantityPerPackage: gs1Data?.quantity,
            batchNumber: gs1Data?.lotNumber,
            serialNumber: gs1Data?.serialNumber,
            gs1Parsed: gs1Data
          },
          message: "Codice GS1 riconosciuto. Inserire il nome del prodotto per salvarlo nel catalogo."
        });
      }

      // 8. Not found anywhere
      return res.status(404).json({
        source: "none",
        found: false,
        barcode: normalizedBarcode,
        rawBarcode,
        message: "Prodotto non trovato. Inserire i dati manualmente."
      });
    } catch (error) {
      console.error("Error fetching inventory by barcode:", error);
      res.status(500).json({ error: "Errore nella ricerca per barcode" });
    }
  });

  // Save manual barcode-product mapping for future lookups (admin verified)
  app.post("/api/inventory/barcode/override", requireAdmin, async (req, res) => {
    try {
      const data = {
        ...req.body,
        source: "manual",
        isVerified: true
      };
      const cached = await storage.upsertBarcodeProductCache(data);
      res.status(201).json(cached);
    } catch (error) {
      console.error("Error saving barcode override:", error);
      res.status(500).json({ error: "Errore nel salvataggio mappatura barcode" });
    }
  });

  // Save barcode-product mapping (any authenticated user - for learning from scans)
  app.post("/api/inventory/barcode/learn", requireAuth, async (req, res) => {
    try {
      const { barcode, productName, description, category, unit, hasExpiry } = req.body;

      if (!barcode || !productName) {
        return res.status(400).json({ error: "Barcode e nome prodotto richiesti" });
      }

      // For GS1 DataMatrix barcodes, extract GTIN and use that as the cache key
      // This ensures future scans with the same GTIN (but different lot/expiry) find the cached name
      let cacheKey = barcode;
      const gs1Data = parseGS1Barcode(barcode);
      if (gs1Data?.gtin) {
        cacheKey = gs1Data.gtin;
      }

      // Check if already exists
      const existing = await storage.getBarcodeProductCache(cacheKey);
      if (existing?.isVerified) {
        // Don't overwrite verified entries
        return res.json({
          success: true,
          message: "Prodotto già presente nel catalogo",
          cached: existing
        });
      }

      const cached = await storage.upsertBarcodeProductCache({
        barcode: cacheKey,
        source: "crew_scan",
        productName,
        description,
        category: category || "altro",
        defaultUnit: unit || "pz",
        hasExpiry: hasExpiry || false,
        isVerified: false // Crew scans are not verified
      });

      res.status(201).json({ success: true, cached });
    } catch (error) {
      console.error("Error learning barcode:", error);
      res.status(500).json({ error: "Errore nel salvataggio prodotto" });
    }
  });

  // Create inventory item (admin only)
  app.post("/api/inventory/items", requireAdmin, async (req, res) => {
    try {
      const item = await storage.createInventoryItem(req.body);

      // Auto-save to barcode product cache for future lookups
      if (item.barcode && item.name) {
        try {
          // For GS1 DataMatrix barcodes, extract GTIN and use that as the cache key
          let cacheKey = item.barcode;
          const gs1Data = parseGS1Barcode(item.barcode);
          if (gs1Data?.gtin) {
            cacheKey = gs1Data.gtin;
          }

          await storage.upsertBarcodeProductCache({
            barcode: cacheKey,
            source: "internal",
            productName: item.name,
            description: item.description || undefined,
            category: item.category,
            defaultUnit: item.unit,
            hasExpiry: item.hasExpiry || false,
            isVerified: true
          });
        } catch (cacheError) {
          console.error("Error caching barcode product:", cacheError);
          // Don't fail the main request if cache fails
        }
      }

      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ error: "Errore nella creazione articolo" });
    }
  });

  // Update inventory item (admin only)
  app.patch("/api/inventory/items/:id", requireAdmin, async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento articolo" });
    }
  });

  // Delete inventory item (admin only) - soft delete
  app.delete("/api/inventory/items/:id", requireAdmin, async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, { isActive: false });
      res.json({ success: true, message: "Articolo eliminato" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ error: "Errore nell'eliminazione articolo" });
    }
  });

  // Get vehicle inventory
  app.get("/api/vehicles/:vehicleId/inventory", requireAuth, async (req, res) => {
    try {
      const inventory = await storage.getVehicleInventory(req.params.vehicleId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching vehicle inventory:", error);
      res.status(500).json({ error: "Errore nel recupero inventario veicolo" });
    }
  });

  // Get pending replenishments for vehicle
  app.get("/api/vehicles/:vehicleId/inventory/pending", requireAuth, async (req, res) => {
    try {
      const pending = await storage.getPendingReplenishments(req.params.vehicleId);
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending replenishments:", error);
      res.status(500).json({ error: "Errore nel recupero materiale mancante" });
    }
  });

  // Update/set vehicle inventory item
  app.put("/api/vehicles/:vehicleId/inventory", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, vehicleId: req.params.vehicleId };
      const result = await storage.upsertVehicleInventory(data);
      res.json(result);
    } catch (error) {
      console.error("Error updating vehicle inventory:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento inventario veicolo" });
    }
  });

  // Log inventory usage (crew during shift)
  app.post("/api/vehicles/:vehicleId/inventory/usage", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = {
        ...req.body,
        vehicleId: req.params.vehicleId,
        userId: userId || req.body.userId
      };
      const log = await storage.logInventoryUsage(data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error logging inventory usage:", error);
      res.status(500).json({ error: "Errore nella segnalazione utilizzo" });
    }
  });

  // Get usage history for vehicle
  app.get("/api/vehicles/:vehicleId/inventory/usage", requireAuth, async (req, res) => {
    try {
      const usage = await storage.getInventoryUsageForVehicle(req.params.vehicleId);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching usage history:", error);
      res.status(500).json({ error: "Errore nel recupero storico utilizzi" });
    }
  });

  // Replenish inventory from warehouse (scan)
  app.post("/api/vehicles/:vehicleId/inventory/replenish", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = {
        ...req.body,
        vehicleId: req.params.vehicleId,
        userId: userId || req.body.userId
      };
      const log = await storage.logInventoryReplenish(data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error logging replenishment:", error);
      res.status(500).json({ error: "Errore nel ripristino materiale" });
    }
  });

  // Get replenishment history for vehicle
  app.get("/api/vehicles/:vehicleId/inventory/replenish-history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getReplenishmentHistory(req.params.vehicleId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching replenishment history:", error);
      res.status(500).json({ error: "Errore nel recupero storico ripristini" });
    }
  });

  // Get warehouse stock for location
  app.get("/api/locations/:locationId/warehouse", requireAuth, async (req, res) => {
    try {
      const stock = await storage.getWarehouseStock(req.params.locationId);
      res.json(stock);
    } catch (error) {
      console.error("Error fetching warehouse stock:", error);
      res.status(500).json({ error: "Errore nel recupero giacenze magazzino" });
    }
  });

  // Update warehouse stock
  app.put("/api/locations/:locationId/warehouse", requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body, locationId: req.params.locationId };
      const result = await storage.upsertWarehouseStock(data);
      res.json(result);
    } catch (error) {
      console.error("Error updating warehouse stock:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento magazzino" });
    }
  });

  // Get low stock alerts
  app.get("/api/inventory/alerts/low-stock", requireAuth, async (req, res) => {
    try {
      const locationId = req.query.locationId as string | undefined;
      const alerts = await storage.getLowStockAlerts(locationId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching low stock alerts:", error);
      res.status(500).json({ error: "Errore nel recupero alert scorte" });
    }
  });

  // Get expiring items (within X days)
  app.get("/api/inventory/alerts/expiring", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const locationId = req.query.locationId as string | undefined;
      const expiringItems = await storage.getExpiringItems(days, locationId);
      res.json(expiringItems);
    } catch (error) {
      console.error("Error fetching expiring items:", error);
      res.status(500).json({ error: "Errore nel recupero articoli in scadenza" });
    }
  });

  // Get inventory dashboard metrics
  app.get("/api/inventory/dashboard", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.getInventoryDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching inventory dashboard metrics:", error);
      res.status(500).json({ error: "Errore nel recupero metriche inventario" });
    }
  });

  // ============================================================================
  // VEHICLE FLEET COMPLIANCE API (Innovative Inventory Compliance Tracking)
  // ============================================================================

  // Get comprehensive fleet compliance data
  app.get("/api/inventory/fleet-compliance", requireAuth, async (req, res) => {
    try {
      const locationId = req.query.locationId as string | undefined;

      // Get all vehicles (optionally filtered by location)
      let allVehicles = await storage.getVehicles();
      if (locationId) {
        allVehicles = allVehicles.filter(v => v.locationId === locationId);
      }

      // Get all templates for reference
      const templates = await storage.getInventoryTemplates();
      const templateMap = new Map(templates.map(t => [t.id, t]));

      // Get template assignments for all vehicles
      const complianceData = await Promise.all(allVehicles.map(async (vehicle) => {
        const assignment = await storage.getVehicleTemplateAssignment(vehicle.id);
        const template = assignment ? templateMap.get(assignment.templateId) : null;

        // Get last checklist submission for this vehicle
        const checklists = await storage.getVehicleChecklists(vehicle.id);
        const lastChecklist = checklists && checklists.length > 0 ? checklists[0] : null;
        const lastChecklistDate = lastChecklist?.completedAt || lastChecklist?.createdAt || null;
        const hoursSinceCheck = lastChecklistDate
          ? Math.floor((Date.now() - new Date(lastChecklistDate).getTime()) / (1000 * 60 * 60))
          : null;

        // Calculate compliance status
        let status: 'compliant' | 'warning' | 'critical' | 'unconfigured' = 'unconfigured';
        let statusMessage = 'Da configurare';
        let complianceScore = 0;

        if (template) {
          const templateItems = await storage.getTemplateItems(template.id);
          const requiredItems = templateItems.filter(ti => ti.isEssential);

          if (hoursSinceCheck !== null && hoursSinceCheck < 24) {
            status = 'compliant';
            statusMessage = 'Conforme';
            complianceScore = 100;
          } else if (hoursSinceCheck !== null && hoursSinceCheck < 48) {
            status = 'warning';
            statusMessage = 'Controllo scaduto';
            complianceScore = 60;
          } else if (assignment) {
            status = 'critical';
            statusMessage = 'Non verificato';
            complianceScore = 30;
          }
        }

        // Get location info
        const location = await storage.getLocation(vehicle.locationId);

        return {
          vehicleId: vehicle.id,
          vehicleCode: vehicle.code,
          licensePlate: vehicle.licensePlate,
          locationId: vehicle.locationId,
          locationName: location?.name || 'N/D',
          templateId: template?.id || null,
          templateName: template?.name || null,
          templateType: template?.templateType || null,
          status,
          statusMessage,
          complianceScore,
          lastCheckDate: lastChecklistDate,
          hoursSinceCheck,
          hasTemplate: !!template,
          isActive: vehicle.isActive
        };
      }));

      // Calculate fleet-wide stats
      const totalVehicles = complianceData.length;
      const compliantCount = complianceData.filter(v => v.status === 'compliant').length;
      const warningCount = complianceData.filter(v => v.status === 'warning').length;
      const criticalCount = complianceData.filter(v => v.status === 'critical').length;
      const unconfiguredCount = complianceData.filter(v => v.status === 'unconfigured').length;
      const avgComplianceScore = totalVehicles > 0
        ? Math.round(complianceData.reduce((sum, v) => sum + v.complianceScore, 0) / totalVehicles)
        : 0;

      res.json({
        summary: {
          totalVehicles,
          compliantCount,
          warningCount,
          criticalCount,
          unconfiguredCount,
          avgComplianceScore,
          lastUpdated: new Date().toISOString()
        },
        vehicles: complianceData.sort((a, b) => a.vehicleCode.localeCompare(b.vehicleCode))
      });
    } catch (error) {
      console.error("Error fetching fleet compliance:", error);
      res.status(500).json({ error: "Errore nel recupero conformità flotta" });
    }
  });

  // Get single vehicle compliance details
  app.get("/api/inventory/vehicle-compliance/:vehicleId", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.vehicleId;
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Veicolo non trovato" });
      }

      const assignment = await storage.getVehicleTemplateAssignment(vehicleId);
      let template = null;
      let templateItems: any[] = [];

      if (assignment) {
        template = await storage.getInventoryTemplateById(assignment.templateId);
        templateItems = await storage.getTemplateItems(assignment.templateId);
      }

      // Get checklist history (last 30 days)
      const checklistHistory = await storage.getVehicleChecklists(vehicleId);

      // Get location
      const location = await storage.getLocation(vehicle.locationId);

      res.json({
        vehicle: {
          id: vehicle.id,
          code: vehicle.code,
          licensePlate: vehicle.licensePlate,
          currentKm: vehicle.currentKm,
          isActive: vehicle.isActive
        },
        location: location ? { id: location.id, name: location.name } : null,
        template: template ? {
          id: template.id,
          name: template.name,
          templateType: template.templateType,
          itemCount: templateItems.length,
          requiredItemCount: templateItems.filter((ti: any) => ti.isRequired).length
        } : null,
        templateItems: templateItems.map((ti: any) => ({
          id: ti.id,
          itemName: ti.item?.name || 'Sconosciuto',
          category: ti.item?.category || 'Generale',
          requiredQuantity: ti.requiredQuantity,
          isRequired: ti.isRequired
        })),
        checklistHistory: checklistHistory || [],
        assignedAt: assignment?.assignedAt || null
      });
    } catch (error) {
      console.error("Error fetching vehicle compliance details:", error);
      res.status(500).json({ error: "Errore nel recupero dettagli conformità" });
    }
  });

  // ============================================================================
  // INVENTORY TEMPLATES (MSB/MSI/EVENT) API
  // ============================================================================

  // Get all inventory templates
  app.get("/api/inventory/templates", requireAuth, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const templates = type
        ? await storage.getInventoryTemplatesByType(type)
        : await storage.getInventoryTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching inventory templates:", error);
      res.status(500).json({ error: "Errore nel recupero template inventario" });
    }
  });

  // Get single template with items
  app.get("/api/inventory/templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getInventoryTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      const items = await storage.getTemplateItems(req.params.id);
      res.json({ template, items });
    } catch (error) {
      console.error("Error fetching inventory template:", error);
      res.status(500).json({ error: "Errore nel recupero template" });
    }
  });

  // Create new template (admin only)
  app.post("/api/inventory/templates", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.createInventoryTemplate({
        ...req.body,
        createdBy: userId
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating inventory template:", error);
      res.status(500).json({ error: "Errore nella creazione template" });
    }
  });

  // Update template (admin only)
  app.patch("/api/inventory/templates/:id", requireAdmin, async (req, res) => {
    try {
      const template = await storage.updateInventoryTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating inventory template:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento template" });
    }
  });

  // Delete template (admin only)
  app.delete("/api/inventory/templates/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteInventoryTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory template:", error);
      res.status(500).json({ error: "Errore nell'eliminazione template" });
    }
  });

  // Get items for a template
  app.get("/api/inventory/templates/:templateId/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getTemplateItems(req.params.templateId);
      res.json(items.map(item => ({
        id: item.id,
        templateId: item.templateId,
        itemId: item.itemId,
        itemName: item.item?.name || 'N/A',
        itemCode: item.item?.code || '',
        requiredQuantity: item.requiredQuantity,
        minQuantity: item.minQuantity,
        isRequired: item.isEssential,
        sortOrder: item.sortOrder,
        notes: item.notes
      })));
    } catch (error) {
      console.error("Error fetching template items:", error);
      res.status(500).json({ error: "Errore nel recupero articoli template" });
    }
  });

  // Add item to template (admin only)
  app.post("/api/inventory/templates/:templateId/items", requireAdmin, async (req, res) => {
    try {
      const item = await storage.addTemplateItem({
        ...req.body,
        templateId: req.params.templateId
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding template item:", error);
      res.status(500).json({ error: "Errore nell'aggiunta articolo a template" });
    }
  });

  // Update template item (admin only)
  app.patch("/api/inventory/templates/:templateId/items/:itemId", requireAdmin, async (req, res) => {
    try {
      const item = await storage.updateTemplateItem(req.params.itemId, req.body);
      if (!item) {
        return res.status(404).json({ error: "Articolo non trovato" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating template item:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento articolo" });
    }
  });

  // Remove item from template (admin only)
  app.delete("/api/inventory/templates/:templateId/items/:itemId", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.removeTemplateItem(req.params.itemId);
      if (!deleted) {
        return res.status(404).json({ error: "Articolo non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing template item:", error);
      res.status(500).json({ error: "Errore nella rimozione articolo" });
    }
  });

  // Get vehicles with their assigned templates
  app.get("/api/inventory/vehicles-templates", requireAuth, async (req, res) => {
    try {
      const vehiclesWithTemplates = await storage.getVehiclesWithTemplates();
      res.json(vehiclesWithTemplates);
    } catch (error) {
      console.error("Error fetching vehicles with templates:", error);
      res.status(500).json({ error: "Errore nel recupero veicoli con template" });
    }
  });

  // Assign template to vehicle (admin only)
  app.post("/api/vehicles/:vehicleId/template", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await storage.assignTemplateToVehicle({
        vehicleId: req.params.vehicleId,
        templateId: req.body.templateId,
        assignedBy: userId || "system",
        notes: req.body.notes
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning template to vehicle:", error);
      res.status(500).json({ error: "Errore nell'assegnazione template" });
    }
  });

  // Get vehicle's assigned template
  app.get("/api/vehicles/:vehicleId/template", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getVehicleTemplateAssignment(req.params.vehicleId);
      if (!assignment) {
        return res.json({ template: null, items: [] });
      }
      const template = await storage.getInventoryTemplateById(assignment.templateId);
      const items = await storage.getTemplateItems(assignment.templateId);
      res.json({ assignment, template, items });
    } catch (error) {
      console.error("Error fetching vehicle template:", error);
      res.status(500).json({ error: "Errore nel recupero template veicolo" });
    }
  });

  // Get checklist items for a vehicle
  // Always returns global checklist template items with expiry tracking
  app.get("/api/vehicles/:vehicleId/checklist-items", requireAuth, async (req, res) => {
    try {
      // Always return global active checklist template items (includes expiry data)
      const globalItems = await storage.getActiveChecklistTemplateItems();
      res.json({
        source: "global",
        templateId: null,
        templateName: "Checklist Standard",
        templateType: "MSB",
        items: globalItems
      });
    } catch (error) {
      console.error("Error fetching vehicle checklist items:", error);
      res.status(500).json({ error: "Errore nel recupero checklist veicolo" });
    }
  });

  // Get vehicle's active/upcoming sporting event (for mobile app)
  app.get("/api/vehicles/:vehicleId/active-event", requireAuth, async (req, res) => {
    try {
      const vehicleId = req.params.vehicleId;
      const activeEvent = await storage.getVehicleActiveEvent(vehicleId);
      if (!activeEvent) {
        return res.json({ event: null });
      }
      // Also get inventory logs for this event
      const inventory = await storage.getEventInventory(activeEvent.id);
      res.json({ event: activeEvent, inventory });
    } catch (error) {
      console.error("Error fetching vehicle active event:", error);
      res.status(500).json({ error: "Errore nel recupero evento veicolo" });
    }
  });

  // ============================================================================
  // SPORTING EVENTS API
  // ============================================================================

  // Get all sporting events
  app.get("/api/sporting-events", requireAuth, async (req, res) => {
    try {
      const upcoming = req.query.upcoming === "true";
      let events = upcoming
        ? await storage.getUpcomingSportingEvents()
        : await storage.getSportingEvents();

      // Apply location filter for branch managers
      const locationFilter = await getLocationFilter(req);
      if (locationFilter !== null && locationFilter.length > 0) {
        events = events.filter((e: any) => e.locationId && locationFilter.includes(e.locationId));
      } else if (locationFilter !== null && locationFilter.length === 0) {
        events = [];
      }

      res.json(events);
    } catch (error) {
      console.error("Error fetching sporting events:", error);
      res.status(500).json({ error: "Errore nel recupero eventi sportivi" });
    }
  });

  // Get single sporting event with inventory
  app.get("/api/sporting-events/:id", requireAuth, async (req, res) => {
    try {
      const event = await storage.getSportingEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Evento non trovato" });
      }
      const inventory = await storage.getEventInventory(req.params.id);
      res.json({ event, inventory });
    } catch (error) {
      console.error("Error fetching sporting event:", error);
      res.status(500).json({ error: "Errore nel recupero evento" });
    }
  });

  // Create sporting event (admin only)
  app.post("/api/sporting-events", requireAdmin, async (req, res) => {
    try {
      const event = await storage.createSportingEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating sporting event:", error);
      res.status(500).json({ error: "Errore nella creazione evento" });
    }
  });

  // Update sporting event (admin only)
  app.patch("/api/sporting-events/:id", requireAdmin, async (req, res) => {
    try {
      const event = await storage.updateSportingEvent(req.params.id, req.body);
      if (!event) {
        return res.status(404).json({ error: "Evento non trovato" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error updating sporting event:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento evento" });
    }
  });

  // Delete sporting event (admin only)
  app.delete("/api/sporting-events/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSportingEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Evento non trovato" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sporting event:", error);
      res.status(500).json({ error: "Errore nell'eliminazione evento" });
    }
  });

  // Checkout inventory for event (take items from warehouse)
  app.post("/api/sporting-events/:eventId/checkout", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const log = await storage.checkoutEventInventory({
        eventId: req.params.eventId,
        itemId: req.body.itemId,
        quantityOut: req.body.quantityOut,
        checkedOutBy: userId || req.body.checkedOutBy,
        expiryDate: req.body.expiryDate,
        lotNumber: req.body.lotNumber,
        barcodeScanData: req.body.barcodeScanData,
        notes: req.body.notes
      });
      res.status(201).json(log);
    } catch (error) {
      console.error("Error checking out event inventory:", error);
      res.status(500).json({ error: "Errore nel checkout materiale evento" });
    }
  });

  // Checkin inventory from event (return items to warehouse)
  app.post("/api/sporting-events/:eventId/checkin/:logId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const log = await storage.checkinEventInventory(req.params.logId, {
        quantityReturned: req.body.quantityReturned,
        quantityUsed: req.body.quantityUsed,
        varianceReason: req.body.varianceReason,
        checkedInBy: userId || req.body.checkedInBy
      });
      if (!log) {
        return res.status(404).json({ error: "Record non trovato" });
      }
      res.json(log);
    } catch (error) {
      console.error("Error checking in event inventory:", error);
      res.status(500).json({ error: "Errore nel checkin materiale evento" });
    }
  });

  // Get event inventory statistics
  app.get("/api/sporting-events/stats/inventory", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getEventInventoryStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching event inventory stats:", error);
      res.status(500).json({ error: "Errore nel recupero statistiche eventi" });
    }
  });

  // Event staff assignments
  app.post("/api/sporting-events/:eventId/assignments", requireAdmin, async (req, res) => {
    try {
      const assignment = await storage.createEventAssignment({
        eventId: req.params.eventId,
        staffMemberId: req.body.staffMemberId,
        vehicleId: req.body.vehicleId,
        assignedRole: req.body.assignedRole || req.body.role || 'soccorritore',
        status: 'assigned'
      });
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating event assignment:", error);
      res.status(500).json({ error: "Errore nell'assegnazione personale" });
    }
  });

  app.delete("/api/sporting-events/:eventId/assignments/:assignmentId", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEventAssignment(req.params.assignmentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting event assignment:", error);
      res.status(500).json({ error: "Errore nella rimozione assegnazione" });
    }
  });

  // Generate Event PDF with crew and details
  app.get("/api/sporting-events/:id/pdf", requireAuth, async (req, res) => {
    try {
      const event = await storage.getSportingEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Evento non trovato" });
      }

      // Get vehicle info
      let vehicle = null;
      if (event.vehicleId) {
        const v = await storage.getVehicle(event.vehicleId);
        if (v) {
          vehicle = { code: v.code, licensePlate: v.licensePlate };
        }
      }

      // Get crew assignments
      const assignments = await storage.getEventAssignments(event.id);
      const crew = [];
      for (const a of assignments) {
        const staff = await storage.getStaffMemberById(a.staffMemberId);
        if (staff) {
          crew.push({
            name: `${staff.firstName} ${staff.lastName}`,
            role: a.assignedRole || staff.primaryRole || 'soccorritore',
            phone: staff.phone
          });
        }
      }

      // Get coordinator info
      let coordinator = null;
      if (event.coordinatorId) {
        const coord = await storage.getStaffMemberById(event.coordinatorId);
        if (coord) {
          coordinator = {
            name: `${coord.firstName} ${coord.lastName}`,
            phone: coord.phone
          };
        }
      }

      generateEventPDF(res, {
        id: event.id,
        name: event.name,
        eventType: event.eventType || 'altro',
        location: event.location || '',
        address: event.address,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime || '',
        endTime: event.endTime,
        expectedAttendees: event.expectedAttendees,
        status: event.status || 'planned',
        notes: event.notes,
        vehicle,
        crew,
        coordinator
      });
    } catch (error) {
      console.error("Error generating event PDF:", error);
      res.status(500).json({ error: "Errore nella generazione PDF evento" });
    }
  });
}
