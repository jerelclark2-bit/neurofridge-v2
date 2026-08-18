CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fridge_id` text NOT NULL,
	`barcode` text NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT 'Unknown brand' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Groceries' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_inventory_fridge_barcode` ON `inventory_items` (`fridge_id`,`barcode`);