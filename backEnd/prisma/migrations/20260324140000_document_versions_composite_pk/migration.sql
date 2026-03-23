-- document_versions：复合主键 (document_id, version_id)
-- 修复 Prisma + MySQL 下单列 TIMESTAMP 主键在 create 后「required to return data, but found no record(s)」
-- 并避免「全局每秒仅一条版本」的设计问题

DELETE FROM `document_versions` WHERE `document_id` IS NULL OR `document_id` = '';

DROP INDEX `idx_doc_versions_doc_ver` ON `document_versions`;

ALTER TABLE `document_versions` DROP PRIMARY KEY;

ALTER TABLE `document_versions` MODIFY `document_id` VARCHAR(21) NOT NULL;

ALTER TABLE `document_versions` ADD PRIMARY KEY (`document_id`, `version_id`);
