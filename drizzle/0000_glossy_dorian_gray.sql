CREATE TABLE `playtest_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`city` text NOT NULL,
	`friends` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playtest_signups_email_unique` ON `playtest_signups` (`email`);