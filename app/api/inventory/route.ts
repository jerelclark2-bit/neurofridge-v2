import { and, desc, eq, sql, type SQL } from "drizzle-orm";
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
    section TEXT NOT NULL DEFAULT 'Other',
    status TEXT NOT NULL DEFAULT 'in',
    estimated_price REAL NOT NULL DEFAULT 3.99,
    quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const columns = await env.DB.prepare("PRAGMA table_info(inventory_items)").all<{ name: string }>();
  const names = new Set(columns.results.map((column: { name: string }) => column.name));
  if (!names.has("section")) await env.DB.prepare("ALTER TABLE inventory_items ADD COLUMN section TEXT NOT NULL DEFAULT 'Other'").run();
  if (!names.has("status")) await env.DB.prepare("ALTER TABLE inventory_items ADD COLUMN status TEXT NOT NULL DEFAULT 'in'").run();
  if (!names.has("estimated_price")) await env.DB.prepare("ALTER TABLE inventory_items ADD COLUMN estimated_price REAL NOT NULL DEFAULT 3.99").run();
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
  const body = await request.json() as { fridgeId?: string; barcode?: string; name?: string; brand?: string; imageUrl?: string; category?: string; section?: string; status?: string; estimatedPrice?: number };
  if (!body.barcode || !body.name) return Response.json({ error: "Barcode and product name are required" }, { status: 400 });
  const db = getDb();
  await db.insert(inventoryItems).values({ fridgeId: body.fridgeId || "neuro-home", barcode: body.barcode, name: body.name, brand: body.brand || "Unknown brand", imageUrl: body.imageUrl || "", category: body.category || "Groceries", section: body.section || "Other", status: "in", estimatedPrice: body.estimatedPrice ?? 3.99, quantity: 1 }).onConflictDoUpdate({
    target: [inventoryItems.fridgeId, inventoryItems.barcode],
    set: { quantity: sql`${inventoryItems.quantity} + 1`, status: "in", updatedAt: sql`CURRENT_TIMESTAMP` },
  });
  const [item] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.fridgeId, body.fridgeId || "neuro-home"), eq(inventoryItems.barcode, body.barcode)));
  return Response.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSchema();
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = await request.json() as { quantity?: number; status?: string; estimatedPrice?: number; section?: string };
  if (!id) return Response.json({ error: "Valid id required" }, { status: 400 });
  const updates: { quantity?: number; status?: string; estimatedPrice?: number; section?: string; updatedAt: string | SQL } = { updatedAt: sql`CURRENT_TIMESTAMP` };
  if (typeof body.quantity === "number") updates.quantity = body.quantity;
  if (body.status === "in" || body.status === "out") updates.status = body.status;
  if (typeof body.estimatedPrice === "number") updates.estimatedPrice = body.estimatedPrice;
  if (body.section) updates.section = body.section;
  const [item] = await getDb().update(inventoryItems).set(updates).where(eq(inventoryItems.id, id)).returning();
  return Response.json({ item });
}

export async function DELETE(request: Request) {
  await ensureSchema();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Valid id required" }, { status: 400 });
  await getDb().delete(inventoryItems).where(eq(inventoryItems.id, id));
  return new Response(null, { status: 204 });
}
