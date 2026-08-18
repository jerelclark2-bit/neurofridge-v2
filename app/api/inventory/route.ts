import { and, desc, eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { inventoryItems } from "../../../db/schema";

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fridge_id TEXT NOT NULL,
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Unknown brand',
    image_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Groceries',
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_fridge_barcode ON inventory_items(fridge_id, barcode)").run();
}

export async function GET(request: Request) {
  await ensureSchema();
  const fridgeId = new URL(request.url).searchParams.get("fridge") || "neuro-home";
  const items = await getDb().select().from(inventoryItems).where(eq(inventoryItems.fridgeId, fridgeId)).orderBy(desc(inventoryItems.updatedAt));
  return Response.json({ items });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as { fridgeId?: string; barcode?: string; name?: string; brand?: string; imageUrl?: string; category?: string };
  if (!body.barcode || !body.name) return Response.json({ error: "Barcode and product name are required" }, { status: 400 });
  const db = getDb();
  await db.insert(inventoryItems).values({ fridgeId: body.fridgeId || "neuro-home", barcode: body.barcode, name: body.name, brand: body.brand || "Unknown brand", imageUrl: body.imageUrl || "", category: body.category || "Groceries", quantity: 1 }).onConflictDoUpdate({
    target: [inventoryItems.fridgeId, inventoryItems.barcode],
    set: { quantity: sql`${inventoryItems.quantity} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` },
  });
  const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.fridgeId, body.fridgeId || "neuro-home"), eq(inventoryItems.barcode, body.barcode)));
  return Response.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = await request.json() as { quantity?: number };
  if (!id || !body.quantity) return Response.json({ error: "Valid id and quantity required" }, { status: 400 });
  const [item] = await getDb().update(inventoryItems).set({ quantity: body.quantity, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(inventoryItems.id, id)).returning();
  return Response.json({ item });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Valid id required" }, { status: 400 });
  await getDb().delete(inventoryItems).where(eq(inventoryItems.id, id));
  return new Response(null, { status: 204 });
}
