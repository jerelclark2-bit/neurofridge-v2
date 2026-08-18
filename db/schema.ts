import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fridgeId: text("fridge_id").notNull(),
  barcode: text("barcode").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("Unknown brand"),
  imageUrl: text("image_url").notNull().default(""),
  category: text("category").notNull().default("Groceries"),
  quantity: integer("quantity").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_inventory_fridge_barcode").on(table.fridgeId, table.barcode)]);
