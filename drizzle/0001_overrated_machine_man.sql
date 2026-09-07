CREATE TABLE `contribution_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionType` varchar(80) NOT NULL,
	`points` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contribution_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `contribution_rules_actionType_unique` UNIQUE(`actionType`)
);
--> statement-breakpoint
CREATE TABLE `institute_settings` (
	`id` int NOT NULL,
	`name` varchar(160) NOT NULL DEFAULT 'NSUT',
	`slug` varchar(160) NOT NULL DEFAULT 'nsut',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institute_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leaderboard_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`displayName` varchar(255) NOT NULL,
	`profileImageUrl` text,
	`reportsSubmitted` int NOT NULL DEFAULT 0,
	`verifiedContributions` int NOT NULL DEFAULT 0,
	`cleanupContributions` int NOT NULL DEFAULT 0,
	`otherPoints` int NOT NULL DEFAULT 0,
	`totalPoints` int NOT NULL DEFAULT 0,
	`isDemo` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaderboard_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `leaderboard_entries_userId_unique` UNIQUE(`userId`)
);
