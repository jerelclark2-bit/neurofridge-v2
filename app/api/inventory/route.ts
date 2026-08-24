import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { inventoryItems } from "../../../db/schema";
import {
  ApiError,
  FRIDGE_SECTIONS,
  PUBLIC_FRIDGE_ID,
  assertSameOrigin,
  cleanHttpsUrl,
  cleanNumber,
  cleanString,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../security";

const MAX_UNIQUE_ITEMS = 200;

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_id TEXT NOT NULL,
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Unknown brand',
    image_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Groceries',
    section TEXT NOT NULL DEFAULT 'Other',
    status TEXT NOT NULL DEFAULT 'in',
    estimated_price REAL NOT NULL DEFAULT 3.99,
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const columns = await env.DB.prepare("PRAGMA table_info(inventory_items)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("section")) {
    await env.DB.prepare(
      "ALTER TABLE inventory_items ADD COLUMN section TEXT NOT NULL DEFAULT 'Other'",
    ).run();
  }
  if (!names.has("status")) {
    await env.DB.prepare(
      "ALTER TABLE inventory_items ADD COLUMN status TEXT NOT NULL DEFAULT 'in'",
    ).run();
  }
  if (!names.has("estimated_price")) {
    await env.DB.prepare(
      "ALTER TABLE inventory_items ADD COLUMN estimated_price REAL NOT NULL DEFAULT 3.99",
    ).run();
  }
  await env.DB.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_fridge_barcode ON inventory_items(fridge_id, barcode)",
  ).run();
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const items = await getDb()
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.fridgeId, PUBLIC_FRIDGE_ID))
      .orderBy(desc(inventoryItems.updatedAt))
      .limit(MAX_UNIQUE_ITEMS);
    return jsonResponse({ items });
  } catch (error) {
    return errorResponse(error, "GET /api/inventory", request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "inventory:create", 30);
    await ensureSchema();
    const body = await readJsonBody(request, 8_192);
    const barcode = cleanString(body.barcode, "Barcode", {
      required: true,
      maxLength: 64,
    });
    if (!/^[-\p{L}\p{N} ._:+/()]+$/u.test(barcode)) {
      throw new ApiError(400, "Barcode contains unsupported characters");
    }

    const name = cleanString(body.name, "Product name", {
      required: true,
      maxLength: 120,
    });
    const brand = cleanString(body.brand, "Brand", {
      maxLength: 80,
      fallback: "Unknown brand",
    });
    const imageUrl = cleanHttpsUrl(body.imageUrl, "Image URL");
    const category = cleanString(body.category, "Category", {
      maxLength: 160,
      fallback: "Groceries",
    });
    const section = cleanString(body.section, "Section", {
      maxLength: 32,
      fallback: "Other",
    });
    if (!FRIDGE_SECTIONS.includes(section as (typeof FRIDGE_SECTIONS)[number])) {
      throw new ApiError(400, "Section is not allowed");
    }
    const estimatedPrice =
      body.estimatedPrice === undefined
        ? 3.99
        : cleanNumber(body.estimatedPrice, "Estimated price", { min: 0, max: 10_000 });

    const existing = await env.DB.prepare(
      "SELECT id FROM inventory_items WHERE fridge_id = ? AND barcode = ? LIMIT 1",
    )
      .bind(PUBLIC_FRIDGE_ID, barcode)
      .first<{ id: number }>();
    if (!existing) {
      const total = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM inventory_items WHERE fridge_id = ?",
      )
        .bind(PUBLIC_FRIDGE_ID)
        .first<{ count: number }>();
      if ((total?.count || 0) >= MAX_UNIQUE_ITEMS) {
        throw new ApiError(409, "This shared fridge has reached its item limit");
      }
    }

    const db = getDb();
    await db
      .insert(inventoryItems)
      .values({
        fridgeId: PUBLIC_FRIDGE_ID,
        barcode,
        name,
        brand,
        imageUrl,
        category,
        section,
        status: "in",
        estimatedPrice,
        quantity: 1,
      })
      .onConflictDoUpdate({
        target: [inventoryItems.fridgeId, inventoryItems.barcode],
        set: {
          quantity: sql`CASE WHEN ${inventoryItems.quantity} < 99 THEN ${inventoryItems.quantity} + 1 ELSE 99 END`,
          status: "in",
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.fridgeId, PUBLIC_FRIDGE_ID),
          eq(inventoryItems.barcode, barcode),
        ),
      );
    return jsonResponse({ item }, 201);
  } catch (error) {
    return errorResponse(error, "POST /api/inventory", request);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "inventory:update", 120);
    await ensureSchema();
    const rawId = new URL(request.url).searchParams.get("id");
    const id = Number(rawId);
    if (!rawId || !Number.isSafeInteger(id) || id <= 0) {
      throw new ApiError(400, "Valid item id required");
    }

    const body = await readJsonBody(request, 4_096);
    const updates: {
      quantity?: number;
      status?: string;
      estimatedPrice?: number;
      section?: string;
      updatedAt: string | SQL;
    } = { updatedAt: sql`CURRENT_TIMESTAMP` };
    let updateCount = 0;

    if (body.quantity !== undefined) {
      updates.quantity = cleanNumber(body.quantity, "Quantity", {
        min: 1,
        max: 99,
        integer: true,
      });
      updateCount += 1;
    }
    if (body.status !== undefined) {
      if (body.status !== "in" && body.status !== "out") {
        throw new ApiError(400, "Status is not allowed");
      }
      updates.status = body.status;
      updateCount += 1;
    }
    if (body.estimatedPrice !== undefined) {
      updates.estimatedPrice = cleanNumber(body.estimatedPrice, "Estimated price", {
        min: 0,
        max: 10_000,
      });
      updateCount += 1;
    }
    if (body.section !== undefined) {
      const section = cleanString(body.section, "Section", { required: true, maxLength: 32 });
      if (!FRIDGE_SECTIONS.includes(section as (typeof FRIDGE_SECTIONS)[number])) {
        throw new ApiError(400, "Section is not allowed");
      }
      updates.section = section;
      updateCount += 1;
    }
    if (!updateCount) throw new ApiError(400, "No supported updates supplied");

    const [item] = await getDb()
      .update(inventoryItems)
      .set(updates)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.fridgeId, PUBLIC_FRIDGE_ID),
        ),
      )
      .returning();
    if (!item) throw new ApiError(404, "Item not found");
    return jsonResponse({ item });
  } catch (error) {
    return errorResponse(error, "PATCH /api/inventory", request);
  }
}
