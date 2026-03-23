-- 收藏已迁移至 document_user_star，删除冗余列
ALTER TABLE `documents_info` DROP COLUMN `is_starred`;
