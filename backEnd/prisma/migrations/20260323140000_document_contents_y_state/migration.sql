-- 若库中已有 y_state（曾手动加列或部分执行失败），则跳过，避免 1060 Duplicate column
SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'document_contents'
    AND COLUMN_NAME = 'y_state'
);
SET @q := IF(
  @exists = 0,
  'ALTER TABLE `document_contents` ADD COLUMN `y_state` MEDIUMBLOB NULL',
  'SELECT 1'
);
PREPARE stmt FROM @q;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
