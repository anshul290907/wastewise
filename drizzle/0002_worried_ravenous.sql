CREATE TABLE `campus_map_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instituteSlug` varchar(160) NOT NULL,
	`centerLat` double NOT NULL,
	`centerLng` double NOT NULL,
	`zoom` int NOT NULL DEFAULT 16,
	`locationsJson` text NOT NULL,
	`sourceUrl` text,
	`isVerified` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campus_map_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `campus_map_configs_instituteSlug_unique` UNIQUE(`instituteSlug`)
);
