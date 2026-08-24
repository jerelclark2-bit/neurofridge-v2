import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = new URL("../app/NeuroFridge.tsx", import.meta.url);
const rulesFile = new URL("../public/pricing-rules.json", import.meta.url);

test("includes the complete interactive fridge experience", async () => {
  const source = await readFile(appSource, "utf8");

  for (const requiredText of [
    "Scan barcode",
    "Out of fridge",
    "Make it yours.",
    "PRIVACY POLICY",
    "Estimated replacement cost",
  ]) {
    assert.match(source, new RegExp(requiredText, "i"));
  }

  assert.doesNotMatch(source, /\b(ai|chatgpt)\b/i);
});

test("ships pricing rules for every fridge section", async () => {
  const pricing = JSON.parse(await readFile(rulesFile, "utf8"));
  const sections = pricing.rules.map((rule) => rule.section);

  assert.deepEqual(sections, [
    "Drinks",
    "Dairy & Eggs",
    "Deli & Meat",
    "Produce",
    "Condiments",
    "Other",
  ]);
});
