import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fridgeId: text("fridge_id").notNull(),
  barcode: text("barcode").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("Unknown brand"),
  imageUrl: text("image_url").notNull().default(""),
  category: text("category").notNull().default("Groceries"),
  section: text("section").notNull().default("Other"),
  status: text("status").notNull().default("in"),
  estimatedPrice: real("estimated_price").notNull().default(3.99),
  quantity: integer("quantity").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_inventory_fridge_barcode").on(table.fridgeId, table.barcode)]);

export const fridgeSettings = sqliteTable("fridge_settings", {
  fridgeId: text("fridge_id").primaryKey(),
  finish: text("finish").notNull().default("steel"),
  stickersJson: text("stickers_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const apiRateLimits = sqliteTable("api_rate_limits", {
  rateKey: text("rate_key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  requestCount: integer("request_count").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_api_rate_limits_window").on(table.windowStart)]);
