CREATE TABLE `waste_reports` (
	`id` varchar(40) NOT NULL,
	`userId` int NOT NULL,
	`reporterName` varchar(255) NOT NULL,
	`issue` varchar(160) NOT NULL,
	`location` varchar(160) NOT NULL,
	`priority` enum('Normal','Important','Urgent') NOT NULL,
	`description` text,
	`photoName` varchar(255),
	`status` enum('Reported','Assigned','In Progress','Resolved') NOT NULL DEFAULT 'Reported',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waste_reports_id` PRIMARY KEY(`id`)
);
