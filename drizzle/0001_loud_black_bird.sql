CREATE TABLE `fridge_settings` (
	`fridge_id` text PRIMARY KEY NOT NULL,
	`finish` text DEFAULT 'steel' NOT NULL,
	`stickers_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `section` text DEFAULT 'Other' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `status` text DEFAULT 'in' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `estimated_price` real DEFAULT 3.99 NOT NULL;