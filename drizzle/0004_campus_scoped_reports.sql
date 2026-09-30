ALTER TABLE `institute_settings`
	ADD COLUMN `studentEmailDomains` varchar(500) NOT NULL DEFAULT '';

ALTER TABLE `waste_reports`
	ADD COLUMN `instituteSlug` varchar(160) NOT NULL DEFAULT 'nsut';

CREATE INDEX `waste_reports_instituteSlug_idx` ON `waste_reports` (`instituteSlug`);
