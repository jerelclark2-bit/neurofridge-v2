import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public mutations enforce origin, limits, validation, and safe errors", async () => {
  const [inventory, settings, security] = await Promise.all([
    readProjectFile("app/api/inventory/route.ts"),
    readProjectFile("app/api/settings/route.ts"),
    readProjectFile("app/api/security.ts"),
  ]);

  for (const route of [inventory, settings]) {
    assert.match(route, /assertSameOrigin\(request\)/);
    assert.match(route, /enforceRateLimit\(request/);
    assert.match(route, /readJsonBody\(request/);
    assert.match(route, /errorResponse\(error/);
    assert.match(route, /PUBLIC_FRIDGE_ID/);
  }
  assert.doesNotMatch(inventory, /export async function DELETE/);
  assert.match(inventory, /MAX_UNIQUE_ITEMS = 200/);
  assert.match(inventory, /max: 99/);
  assert.match(settings, /maximum of 8 stickers/i);
  assert.match(security, /PRODUCT_IMAGE_HOSTS/);
  assert.match(security, /STICKER_IMAGE_HOSTS/);
  assert.match(security, /Host is not allowed/);
  assert.match(security, /SHA-256/);
  assert.match(security, /Too many requests/);
});

test("worker sends defense-in-depth browser headers", async () => {
  const worker = await readProjectFile("worker/index.ts");
  for (const header of [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    assert.match(worker, new RegExp(header));
  }
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /camera=\(self\)/);
  assert.doesNotMatch(worker, /img-src[^\n]*https:\s*["']/);
});
