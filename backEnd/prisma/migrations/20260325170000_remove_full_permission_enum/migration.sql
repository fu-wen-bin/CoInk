-- 统一最高权限：full -> manage
-- 1) 先清洗历史数据
UPDATE `document_principals`
SET `permission` = 'manage'
WHERE `permission` = 'full';

UPDATE `permission_requests`
SET `target_permission` = 'manage'
WHERE `target_permission` = 'full';

-- 历史通知 payload 中的 targetPermission 也归一化
UPDATE `notifications`
SET `payload` = JSON_SET(`payload`, '$.targetPermission', 'manage')
WHERE `payload` IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.targetPermission')) = 'full';

-- 2) 收缩枚举，移除 full
ALTER TABLE `document_principals`
MODIFY `permission` ENUM('view', 'comment', 'edit', 'manage') NOT NULL;

ALTER TABLE `permission_requests`
MODIFY `target_permission` ENUM('view', 'comment', 'edit', 'manage') NOT NULL;

