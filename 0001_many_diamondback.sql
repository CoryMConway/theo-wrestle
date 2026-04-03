CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`title` varchar(500),
	`aiSummary` text,
	`aiTags` text,
	`aiStatus` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAtMs` bigint NOT NULL,
	`updatedAtMs` bigint NOT NULL,
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progression_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`summary` text NOT NULL,
	`entriesAnalyzed` int NOT NULL,
	`keyThemes` text,
	`createdAtMs` bigint NOT NULL,
	CONSTRAINT `progression_summaries_id` PRIMARY KEY(`id`)
);
