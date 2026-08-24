import { env } from "cloudflare:workers";

export const PUBLIC_FRIDGE_ID = "neuro-home";
export const FRIDGE_SECTIONS = [
  "Drinks",
  "Dairy & Eggs",
  "Deli & Meat",
  "Produce",
  "Condiments",
  "Other",
] as const;

export const FRIDGE_FINISHES = ["steel", "black", "cream"] as const;

type JsonRecord = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers: HeadersInit = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function errorResponse(error: unknown, route: string, request: Request) {
  const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.message, requestId }, error.status, error.headers);
  }

  console.error("API request failed", {
    route,
    requestId,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  return jsonResponse({ error: "Request could not be completed", requestId }, 500);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin || origin !== expectedOrigin || fetchSite === "cross-site") {
    throw new ApiError(403, "Cross-site request blocked");
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonRecord> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim();
  if (contentType !== "application/json") {
    throw new ApiError(415, "Content-Type must be application/json");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "Request body is too large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new ApiError(413, "Request body is too large");
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Body is not an object");
    }
    return parsed as JsonRecord;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

export function cleanString(
  value: unknown,
  field: string,
  options: { required?: boolean; maxLength: number; fallback?: string },
) {
  if (typeof value !== "string") {
    if (options.required) throw new ApiError(400, `${field} is required`);
    return options.fallback || "";
  }

  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("").trim();
  if (options.required && !cleaned) throw new ApiError(400, `${field} is required`);
  if (cleaned.length > options.maxLength) {
    throw new ApiError(400, `${field} is too long`);
  }
  return cleaned || options.fallback || "";
}

export function cleanNumber(
  value: unknown,
  field: string,
  options: { min: number; max: number; integer?: boolean },
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(400, `${field} must be a number`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new ApiError(400, `${field} must be a whole number`);
  }
  if (value < options.min || value > options.max) {
    throw new ApiError(400, `${field} is outside the allowed range`);
  }
  return value;
}

export function cleanHttpsUrl(value: unknown, field: string, maxLength = 2048) {
  const cleaned = cleanString(value, field, { maxLength });
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    throw new ApiError(400, `${field} must be a valid HTTPS URL`);
  }
}

let lastCleanupBucket = -1;

async function hashIdentifier(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function ensureRateLimitSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits (
    rate_key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start)",
  ).run();
}

export async function enforceRateLimit(request: Request, scope: string, limit: number) {
  await ensureRateLimitSchema();
  const windowSeconds = 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSeconds / windowSeconds);
  const source =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown";
  const identifier = await hashIdentifier(`${scope}:${source}`);
  const key = `${scope}:${identifier}:${bucket}`;

  await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(key, bucket)
    .run();

  const row = await env.DB.prepare(
    "SELECT request_count FROM api_rate_limits WHERE rate_key = ?",
  )
    .bind(key)
    .first<{ request_count: number }>();
  const count = row?.request_count || 1;

  if (lastCleanupBucket !== bucket && bucket % 15 === 0) {
    lastCleanupBucket = bucket;
    await env.DB.prepare("DELETE FROM api_rate_limits WHERE window_start < ?")
      .bind(bucket - 1440)
      .run();
  }

  if (count > limit) {
    const retryAfter = windowSeconds - (nowSeconds % windowSeconds);
    throw new ApiError(429, "Too many requests. Try again shortly.", {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(nowSeconds + retryAfter),
    });
  }
}
