// OSS Node.js SDK初始化客户端示例
const path = require('path');

// 使用绝对路径加载 .env
require('dotenv').config();

const OSS = require('ali-oss');

async function main() {
  console.log('当前工作目录:', process.cwd());
  console.log('脚本所在目录:', __dirname);
  console.log('环境变量加载状态:');
  console.log('OSS_ACCESS_KEY_ID:', process.env.OSS_ACCESS_KEY_ID ? '✓ 已加载' : '✗ 未加载');
  console.log(
    'OSS_ACCESS_KEY_SECRET:',
    process.env.OSS_ACCESS_KEY_SECRET ? '✓ 已加载' : '✗ 未加载',
  );

  if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    console.error('❌ 环境变量未加载，请检查 .env 文件');
    return;
  }

  const client = new OSS({
    region: 'oss-cn-shanghai',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    authorizationV4: true,
  });

  try {
    const result = await client.listBuckets();
    console.log(`✓ 成功！共找到 ${result.buckets.length} 个Bucket:`);

    for (const bucket of result.buckets) {
      console.log(bucket.name);
    }
  } catch (err) {
    console.log('列举Bucket失败:');
    console.error(err);
  }
}

main().catch(console.error);
