import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { fridgeSettings } from "../../../db/schema";

async function ensureSettings() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS fridge_settings (
    fridge_id TEXT PRIMARY KEY,
    finish TEXT NOT NULL DEFAULT 'steel',
    stickers_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function GET(request: Request) {
  await ensureSettings();
  const fridgeId = new URL(request.url).searchParams.get("fridge") || "neuro-home";
  const [settings] = await getDb().select().from(fridgeSettings).where(eq(fridgeSettings.fridgeId, fridgeId));
  return Response.json({ settings: settings || { fridgeId, finish: "steel", stickersJson: "[]" } });
}

export async function PUT(request: Request) {
  await ensureSettings();
  const body = await request.json() as { fridgeId?: string; finish?: string; stickersJson?: string };
  const fridgeId = body.fridgeId || "neuro-home";
  await getDb().insert(fridgeSettings).values({ fridgeId, finish: body.finish || "steel", stickersJson: body.stickersJson || "[]" }).onConflictDoUpdate({ target: fridgeSettings.fridgeId, set: { finish: body.finish || "steel", stickersJson: body.stickersJson || "[]", updatedAt: sql`CURRENT_TIMESTAMP` } });
  const [settings] = await getDb().select().from(fridgeSettings).where(eq(fridgeSettings.fridgeId, fridgeId));
  return Response.json({ settings });
}
