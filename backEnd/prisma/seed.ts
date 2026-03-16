import { config } from 'dotenv';
config();

import { PrismaClient } from '../generated/prisma/client';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建种子数据...');

  // 1. 创建测试用户（如果不存在）
  console.log('创建测试用户...');
  const userEmail = 'test@example.com';
  let user = await prisma.users.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    const userId = nanoid();
    const passwordHash = await argon2.hash('123456');
    user = await prisma.users.create({
      data: {
        user_id: userId,
        email: userEmail,
        name: '测试用户',
        password_hash: passwordHash,
        role: 'USER',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
        bio: '这是一个测试用户账号',
      },
    });
    console.log(`创建用户: ${user.name} (${user.email})`);
  } else {
    console.log(`用户已存在: ${user.name} (${user.email})`);
  }

  const userId = user.user_id;

  // 2. 创建示例文件夹
  console.log('创建示例文件夹...');
  const folderTitle = '示例文件夹';
  let folder = await prisma.documents_info.findFirst({
    where: { title: folderTitle, owner_id: userId, type: 'FOLDER' },
  });

  if (!folder) {
    const folderId = nanoid();
    folder = await prisma.documents_info.create({
      data: {
        document_id: folderId,
        title: folderTitle,
        type: 'FOLDER',
        owner_id: userId,
        parent_id: null,
        is_starred: false,
        sort_order: 0,
        is_deleted: false,
        share_token: nanoid(),
        link_permission: 'close',
      },
    });
    console.log(`创建文件夹: ${folder.title}`);
  } else {
    console.log(`文件夹已存在: ${folder.title}`);
  }

  // 3. 创建示例文档
  console.log('创建示例文档...');
  const docTitle = '欢迎使用 CoInk';
  let document = await prisma.documents_info.findFirst({
    where: { title: docTitle, owner_id: userId, type: 'FILE' },
  });

  if (!document) {
    const docId = nanoid();
    document = await prisma.documents_info.create({
      data: {
        document_id: docId,
        title: docTitle,
        type: 'FILE',
        owner_id: userId,
        parent_id: folder.document_id,
        is_starred: true,
        sort_order: 1,
        is_deleted: false,
        share_token: nanoid(),
        link_permission: 'view',
      },
    });
    console.log(`创建文档: ${document.title}`);

    // 4. 创建文档内容（TipTap JSON 格式）
    console.log('创建文档内容...');
    const sampleContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '欢迎使用 CoInk 文档编辑器' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'CoInk 是一个功能强大的协作文档编辑平台，支持实时协作、版本控制、评论等功能。',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '主要功能' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '实时协作编辑' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '版本历史管理' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '文档评论和讨论' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '权限管理和分享' }],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '开始创建您的第一个文档吧！',
            },
          ],
        },
      ],
    };

    await prisma.document_contents.create({
      data: {
        document_id: docId,
        content: sampleContent,
        updated_by: userId,
      },
    });
    console.log('文档内容已创建');

    // 5. 创建评论
    console.log('创建示例评论...');
    const commentId = nanoid();
    await prisma.document_comments.create({
      data: {
        comment_id: commentId,
        document_id: docId,
        user_id: userId,
        content: '这是一个示例评论，您可以在文档中添加评论进行讨论。',
        parent_id: null,
        position: { blockId: 'block-1', offset: 0 },
        is_resolved: false,
      },
    });
    console.log('评论已创建');
  } else {
    console.log(`文档已存在: ${document.title}`);
  }

  // 6. 创建模板
  console.log('创建示例模板...');
  const templateTitle = '会议纪要模板';
  const existingTemplate = await prisma.templates.findFirst({
    where: { title: templateTitle },
  });

  if (!existingTemplate) {
    const templateId = nanoid();
    await prisma.templates.create({
      data: {
        template_id: templateId,
        title: templateTitle,
        description: '标准的会议纪要格式模板',
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: '会议纪要' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '会议时间: ' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '会议地点: ' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '参会人员: ' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: '会议议题' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: '讨论内容' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: '行动计划' }],
            },
          ],
        },
        category: 'meeting',
        tags: ['会议', '纪要', '模板'],
        is_public: true,
        is_official: true,
        creator_id: userId,
        use_count: 0,
      },
    });
    console.log('模板已创建');
  } else {
    console.log('模板已存在');
  }

  // 7. 创建博客
  console.log('创建示例博客...');
  const blogTitle = 'CoInk 使用指南';
  const existingBlog = await prisma.blogs.findFirst({
    where: { title: blogTitle },
  });

  if (!existingBlog) {
    const blogId = nanoid();
    await prisma.blogs.create({
      data: {
        blog_id: blogId,
        title: blogTitle,
        summary: '了解如何使用 CoInk 进行高效的文档协作',
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'CoInk 使用指南' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'CoInk 是一款现代化的协作文档工具，本文将介绍其核心功能和使用方法。',
                },
              ],
            },
          ],
        },
        category: 'tutorial',
        tags: ['教程', '指南', '协作'],
        cover_image: 'https://picsum.photos/800/400',
        user_id: userId,
      },
    });
    console.log('博客已创建');
  } else {
    console.log('博客已存在');
  }

  // 8. 创建用户组
  console.log('创建示例用户组...');
  const groupName = '产品团队';
  let group = await prisma.groups.findFirst({
    where: { name: groupName, owner_id: userId },
  });

  if (!group) {
    const groupId = nanoid();
    group = await prisma.groups.create({
      data: {
        group_id: groupId,
        name: groupName,
        owner_id: userId,
      },
    });
    console.log('用户组已创建');

    // 9. 添加用户到组
    await prisma.group_members.create({
      data: {
        group_id: groupId,
        user_id: userId,
      },
    });
    console.log('用户组成员已添加');
  } else {
    console.log('用户组已存在');
  }

  console.log('\n✅ 种子数据创建完成！');
  console.log('\n测试账号信息:');
  console.log(`  邮箱: test@example.com`);
  console.log(`  密码: 123456`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
