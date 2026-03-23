-- 移除误加的独立快照表（与 document_versions 合并）
DROP TABLE IF EXISTS `document_snapshots`;

-- 版本 = 快照：支持说明与可选 Yjs 状态
ALTER TABLE `document_versions`
  ADD COLUMN `description` TEXT NULL AFTER `title`,
  ADD COLUMN `y_state` MEDIUMBLOB NULL AFTER `content`;
