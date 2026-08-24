import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { fridgeSettings } from "../../../db/schema";
import {
  ApiError,
  FRIDGE_FINISHES,
  PUBLIC_FRIDGE_ID,
  STICKER_IMAGE_HOSTS,
  assertSameOrigin,
  cleanHttpsUrl,
  cleanString,
  enforceRateLimit,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "../security";

type Sticker = { id: string; url: string; label: string };

async function ensureSettings() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS fridge_settings (
    fridge_id TEXT PRIMARY KEY,
    finish TEXT NOT NULL DEFAULT 'steel',
    stickers_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function parseStickers(value: unknown): Sticker[] {
  if (typeof value !== "string") throw new ApiError(400, "Stickers must be valid JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ApiError(400, "Stickers must be valid JSON");
  }
  if (!Array.isArray(parsed)) throw new ApiError(400, "Stickers must be a list");
  if (parsed.length > 8) throw new ApiError(400, "A maximum of 8 stickers is allowed");

  return parsed.map((entry, index) => {
    if (!entry || Array.isArray(entry) || typeof entry !== "object") {
      throw new ApiError(400, `Sticker ${index + 1} is invalid`);
    }
    const sticker = entry as Record<string, unknown>;
    return {
      id: cleanString(sticker.id, "Sticker id", {
        maxLength: 64,
        fallback: crypto.randomUUID(),
      }),
      url: cleanHttpsUrl(sticker.url, "Sticker URL", { allowedHosts: STICKER_IMAGE_HOSTS }),
      label: cleanString(sticker.label, "Sticker label", {
        maxLength: 40,
        fallback: "My sticker",
      }),
    };
  });
}

export async function GET(request: Request) {
  try {
    await ensureSettings();
    const [settings] = await getDb()
      .select()
      .from(fridgeSettings)
      .where(eq(fridgeSettings.fridgeId, PUBLIC_FRIDGE_ID));
    return jsonResponse({
      settings: settings || {
        fridgeId: PUBLIC_FRIDGE_ID,
        finish: "steel",
        stickersJson: "[]",
      },
    });
  } catch (error) {
    return errorResponse(error, "GET /api/settings", request);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "settings:update", 12);
    await ensureSettings();
    const body = await readJsonBody(request, 20_480);
    const finish = cleanString(body.finish, "Finish", {
      maxLength: 16,
      fallback: "steel",
    });
    if (!FRIDGE_FINISHES.includes(finish as (typeof FRIDGE_FINISHES)[number])) {
      throw new ApiError(400, "Finish is not allowed");
    }
    const stickers = parseStickers(body.stickersJson ?? "[]");
    const stickersJson = JSON.stringify(stickers);

    await getDb()
      .insert(fridgeSettings)
      .values({ fridgeId: PUBLIC_FRIDGE_ID, finish, stickersJson })
      .onConflictDoUpdate({
        target: fridgeSettings.fridgeId,
        set: { finish, stickersJson, updatedAt: sql`CURRENT_TIMESTAMP` },
      });
    const [settings] = await getDb()
      .select()
      .from(fridgeSettings)
      .where(eq(fridgeSettings.fridgeId, PUBLIC_FRIDGE_ID));
    return jsonResponse({ settings });
  } catch (error) {
    return errorResponse(error, "PUT /api/settings", request);
  }
}
