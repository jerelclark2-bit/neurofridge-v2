CREATE TABLE `api_rate_limits` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_rate_limits_window` ON `api_rate_limits` (`window_start`);