CREATE TABLE `funnel_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`session_id` text NOT NULL,
	`cta_location` text NOT NULL,
	`created_at` integer NOT NULL,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`utm_content` text,
	`utm_term` text,
	`referrer_host` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funnel_event_once` ON `funnel_events` (`session_id`,`name`,`cta_location`);--> statement-breakpoint
CREATE INDEX `funnel_events_created` ON `funnel_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `funnel_events_campaign` ON `funnel_events` (`utm_campaign`,`name`);--> statement-breakpoint
CREATE TABLE `funnel_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `funnel_rate_expiry` ON `funnel_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `launch_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text COLLATE NOCASE NOT NULL,
	`created_at` integer NOT NULL,
	`consent_version` text NOT NULL,
	`status` text DEFAULT 'subscribed' NOT NULL,
	`session_id` text NOT NULL,
	`cta_location` text NOT NULL,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`utm_content` text,
	`utm_term` text,
	`referrer_host` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `launch_subscribers_email_unique` ON `launch_subscribers` (`email`);