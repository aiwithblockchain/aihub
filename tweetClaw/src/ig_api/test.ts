/**
 * Instagram API 测试示例
 * 演示如何使用 ig_api 模块
 */

import { igApi, getSelfInfo, getUserInfo, likeMedia, followUser, postComment } from './ig_api';
import { testSignature, sign } from './signature';
import { debugCookies, getAuthStatus } from './cookie-helper';

/**
 * 测试签名算法
 */
export async function testIgSignature(): Promise<void> {
  console.log('=== 测试签名算法 ===');

  await testSignature();

  // 测试签名对象
  const payload = { media_id: '123456', module_name: 'profile' };
  const signed = await sign(payload);
  console.log('签名对象:', signed);
}

/**
 * 测试 Cookie 状态
 */
export async function testIgCookies(): Promise<void> {
  console.log('=== 测试 Cookie 状态 ===');

  await debugCookies();

  const authStatus = await getAuthStatus();
  console.log('认证状态:', authStatus);

  if (!authStatus.isLoggedIn) {
    console.warn('⚠️ 未登录 Instagram，请先登录');
    console.log('缺失的 Cookie:', authStatus.missingCookies);
  } else {
    console.log('✅ 已登录，用户 ID:', authStatus.userId);
  }
}

/**
 * 测试获取当前用户信息
 */
export async function testGetSelfInfo(): Promise<void> {
  console.log('=== 测试获取当前用户信息 ===');

  try {
    const user = await getSelfInfo();
    console.log('✅ 获取成功:');
    console.log('  用户名:', user.username);
    console.log('  全名:', user.full_name);
    console.log('  粉丝数:', user.follower_count);
    console.log('  关注数:', user.following_count);
    console.log('  媒体数:', user.media_count);
    console.log('  是否认证:', user.is_verified);
    console.log('  是否私密账号:', user.is_private);
  } catch (error: any) {
    console.error('❌ 获取失败:', error.message);
  }
}

/**
 * 测试获取用户信息
 */
export async function testGetUserInfo(userId: string): Promise<void> {
  console.log('=== 测试获取用户信息 ===');
  console.log('用户 ID:', userId);

  try {
    const user = await getUserInfo(userId);
    console.log('✅ 获取成功:');
    console.log('  用户名:', user.username);
    console.log('  全名:', user.full_name);
    console.log('  粉丝数:', user.follower_count);
  } catch (error: any) {
    console.error('❌ 获取失败:', error.message);
  }
}

/**
 * 测试点赞
 */
export async function testLikeMedia(mediaId: string): Promise<void> {
  console.log('=== 测试点赞 ===');
  console.log('媒体 ID:', mediaId);

  try {
    const result = await likeMedia({
      mediaId,
      moduleName: 'profile',
      d: 0,
    });
    console.log('✅ 点赞成功:', result);
  } catch (error: any) {
    console.error('❌ 点赞失败:', error.message);
  }
}

/**
 * 测试关注
 */
export async function testFollowUser(userId: string): Promise<void> {
  console.log('=== 测试关注 ===');
  console.log('用户 ID:', userId);

  try {
    const result = await followUser({
      userId,
      moduleName: 'profile',
    });
    console.log('✅ 关注成功:', result);
  } catch (error: any) {
    console.error('❌ 关注失败:', error.message);
  }
}

/**
 * 测试评论
 */
export async function testPostComment(mediaId: string, text: string): Promise<void> {
  console.log('=== 测试评论 ===');
  console.log('媒体 ID:', mediaId);
  console.log('评论内容:', text);

  try {
    const result = await postComment({
      mediaId,
      text,
    });
    console.log('✅ 评论成功:', result);
  } catch (error: any) {
    console.error('❌ 评论失败:', error.message);
  }
}

/**
 * 测试 API 连接
 */
export async function testConnection(): Promise<void> {
  console.log('=== 测试 API 连接 ===');

  const result = await igApi.testConnection();

  if (result.success) {
    console.log('✅ 连接成功，用户 ID:', result.userId);
  } else {
    console.error('❌ 连接失败:', result.error);
  }
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  console.log('🧪 开始 Instagram API 测试\n');

  // 1. 测试签名
  await testIgSignature();
  console.log('');

  // 2. 测试 Cookie
  await testIgCookies();
  console.log('');

  // 3. 测试连接
  await testConnection();
  console.log('');

  // 4. 测试获取当前用户
  await testGetSelfInfo();
  console.log('');

  console.log('🎉 测试完成');
}

/**
 * 使用示例
 */
export async function example(): Promise<void> {
  // 检查登录状态
  const authStatus = await getAuthStatus();
  if (!authStatus.isLoggedIn) {
    console.error('请先登录 Instagram');
    return;
  }

  // 获取当前用户信息
  const me = await getSelfInfo();
  console.log('当前用户:', me.username);

  // 点赞一个媒体（示例 ID，需要替换为真实 ID）
  // await testLikeMedia('MEDIA_ID_HERE');

  // 关注一个用户（示例 ID，需要替换为真实 ID）
  // await testFollowUser('USER_ID_HERE');

  // 发布评论（示例，需要替换为真实 ID）
  // await testPostComment('MEDIA_ID_HERE', 'Great post!');
}

// 导出测试函数供控制台调用
(window as any).testIgSignature = testIgSignature;
(window as any).testIgCookies = testIgCookies;
(window as any).testGetSelfInfo = testGetSelfInfo;
(window as any).testConnection = testConnection;
(window as any).runAllIgTests = runAllTests;