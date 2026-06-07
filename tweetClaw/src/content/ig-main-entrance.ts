/**
 * Instagram Content Script 入口
 *
 * 职责：
 * 1. 监听来自 Background 的 Instagram 相关消息
 * 2. 调用 ig_api 模块执行 API 请求
 * 3. 返回结果给 Background
 *
 * 架构：
 *   Background  ──chrome.runtime.sendMessage──▶  Content Script (本文件)
 *   Content Script  ──调用 ig_api──▶  Instagram API
 *   Content Script  ──sendResponse──▶  Background
 *
 * 注意：
 * - Instagram 不需要注入签名脚本（签名算法在 ig_api/signature.ts 中实现）
 * - Cookie 由浏览器自动管理（用户已登录）
 */

import { IgApiClient, shortcodeToMediaId, mediaIdToShortcode, extractShortcodeFromUrl } from '../ig_api/ig_api';
import type {
  IgMessageType,
  IgRequestMessage,
  IgResponseMessage,
  IgLikeParams,
  IgFollowParams,
  IgCommentParams,
} from '../ig_api/types';

const TAG = '[IgClaw-CS]';

// Instagram API 客户端实例
const igApi = new IgApiClient();

// ── 暴露全局 API 到 window（供控制台测试和外部调用）─────────────────────────

// 定义全局 API 接口
interface IgGlobalApi {
  getSelfInfo: () => Promise<any>;
  getUserInfo: (userId: string) => Promise<any>;
  searchUser: (username: string) => Promise<any>;
  likeMedia: (params: { mediaId: string; moduleName?: string; userId?: string; username?: string; d?: number }) => Promise<any>;
  unlikeMedia: (mediaId: string) => Promise<any>;
  followUser: (params: { userId: string; moduleName?: string; username?: string }) => Promise<any>;
  unfollowUser: (userId: string) => Promise<any>;
  postComment: (params: { mediaId: string; text: string; repliedToCommentId?: string }) => Promise<any>;
  checkLogin: () => Promise<boolean>;
  testConnection: () => Promise<{ success: boolean; userId?: string; error?: string }>;
  // 工具函数
  shortcodeToMediaId: (shortcode: string) => string;
  mediaIdToShortcode: (mediaId: string) => string;
  extractShortcodeFromUrl: (url: string) => string | null;
}

// 实现全局 API
const igGlobalApi: IgGlobalApi = {
  getSelfInfo: async () => {
    return await handleGetSelfInfo({});
  },
  getUserInfo: async (userId: string) => {
    return await handleGetUserInfo({ userId });
  },
  searchUser: async (username: string) => {
    return await handleSearchUser({ username });
  },
  likeMedia: async (params) => {
    return await handleLikeMedia(params);
  },
  unlikeMedia: async (mediaId: string) => {
    return await handleUnlikeMedia({ mediaId });
  },
  followUser: async (params) => {
    return await handleFollowUser(params);
  },
  unfollowUser: async (userId: string) => {
    return await handleUnfollowUser({ userId });
  },
  postComment: async (params) => {
    return await handlePostComment(params);
  },
  checkLogin: async () => {
    return await handleCheckLogin({});
  },
  testConnection: async () => {
    return await handleTestConnection({});
  },
  // 工具函数（同步）
  shortcodeToMediaId: (shortcode: string) => {
    return shortcodeToMediaId(shortcode);
  },
  mediaIdToShortcode: (mediaId: string) => {
    return mediaIdToShortcode(mediaId);
  },
  extractShortcodeFromUrl: (url: string) => {
    return extractShortcodeFromUrl(url);
  },
};

// 暴露到 window 对象
(window as any).igApi = igGlobalApi;

console.log(`${TAG} Instagram API exposed to window.igApi`);
console.log(`${TAG} Usage: await window.igApi.getSelfInfo()`);

// ── 消息监听器 ─────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: IgRequestMessage, sender, sendResponse) => {
  // 只处理 Instagram 相关消息
  if (!message.type || !message.type.startsWith('command.ig_')) {
    return false;
  }

  console.log(`${TAG} Received message:`, message.type, message.params);

  // 异步处理消息
  handleMessage(message)
    .then((result) => {
      console.log(`${TAG} Success:`, message.type, result);
      sendResponse({
        type: message.type,
        success: true,
        data: result,
      } as IgResponseMessage);
    })
    .catch((error: Error) => {
      console.error(`${TAG} Error:`, message.type, error.message);
      sendResponse({
        type: message.type,
        success: false,
        error: error.message,
      } as IgResponseMessage);
    });

  // 返回 true 表示异步响应
  return true;
});

// ── 消息处理函数 ───────────────────────────────────────────────────────────

async function handleMessage(message: IgRequestMessage): Promise<any> {
  const { type, params } = message;

  switch (type) {
    // ============ 读取 API ============

    case 'command.ig_get_self_info':
      return await handleGetSelfInfo(params);

    case 'command.ig_get_user_info':
      return await handleGetUserInfo(params);

    case 'command.ig_search_user':
      return await handleSearchUser(params);

    case 'command.ig_get_feed':
      return await handleGetFeed(params);

    case 'command.ig_get_media':
      return await handleGetMedia(params);

    case 'command.ig_get_media_comments':
      return await handleGetMediaComments(params);

    case 'command.ig_search':
      return await handleSearch(params);

    // ============ 写操作 API ============

    case 'command.ig_like_media':
      return await handleLikeMedia(params);

    case 'command.ig_unlike_media':
      return await handleUnlikeMedia(params);

    case 'command.ig_follow_user':
      return await handleFollowUser(params);

    case 'command.ig_unfollow_user':
      return await handleUnfollowUser(params);

    case 'command.ig_post_comment':
      return await handlePostComment(params);

    case 'command.ig_delete_comment':
      return await handleDeleteComment(params);

    case 'command.ig_post_media':
      return await handlePostMedia(params);

    case 'command.ig_delete_media':
      return await handleDeleteMedia(params);

    // ============ 工具方法 ============

    case 'command.ig_check_login':
      return await handleCheckLogin(params);

    case 'command.ig_test_connection':
      return await handleTestConnection(params);

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// ============ 读取 API 实现 ============

async function handleGetSelfInfo(params: Record<string, any>): Promise<any> {
  const user = await igApi.getSelfInfo();
  return {
    userId: user.pk,
    username: user.username,
    fullName: user.full_name,
    biography: user.biography,
    followerCount: user.follower_count,
    followingCount: user.following_count,
    mediaCount: user.media_count,
    isPrivate: user.is_private,
    isVerified: user.is_verified,
    profilePicUrl: user.profile_pic_url,
  };
}

async function handleGetUserInfo(params: Record<string, any>): Promise<any> {
  const { userId } = params;
  if (!userId) {
    throw new Error('userId is required');
  }

  const user = await igApi.getUserInfo(userId);
  return {
    userId: user.pk,
    username: user.username,
    fullName: user.full_name,
    biography: user.biography,
    followerCount: user.follower_count,
    followingCount: user.following_count,
    mediaCount: user.media_count,
    isPrivate: user.is_private,
    isVerified: user.is_verified,
    profilePicUrl: user.profile_pic_url,
  };
}

async function handleSearchUser(params: Record<string, any>): Promise<any> {
  const { username } = params;
  if (!username) {
    throw new Error('username is required');
  }

  const userId = await igApi.searchUserId(username);
  if (!userId) {
    throw new Error(`User not found: ${username}`);
  }

  return { userId, username };
}

async function handleGetFeed(params: Record<string, any>): Promise<any> {
  const { maxId } = params;
  try {
    const result = await igApi.getHomeFeed(maxId);
    return {
      items: result.items,
      nextMaxId: result.nextMaxId,
      _debug: { itemCount: result.items.length, hasNextMaxId: !!result.nextMaxId },
    };
  } catch (error: any) {
    return {
      items: [],
      nextMaxId: null,
      _error: error?.message || String(error),
    };
  }
}

async function handleGetMedia(params: Record<string, any>): Promise<any> {
  const { shortcode } = params;

  if (!shortcode) {
    throw new Error('shortcode is required');
  }

  const result = await igApi.getMediaInfo(shortcode);

  return {
    id: result.id,
    pk: result.pk,
    shortcode: result.shortcode,
    mediaType: result.mediaType,
    likeCount: result.likeCount,
    commentCount: result.commentCount,
    hasLiked: result.hasLiked,
    caption: result.caption,
    takenAt: result.takenAt,
    user: result.user,
  };
}

async function handleGetMediaComments(params: Record<string, any>): Promise<any> {
  // TODO: 实现获取评论列表
  throw new Error('Not implemented yet: ig_get_media_comments');
}

async function handleSearch(params: Record<string, any>): Promise<any> {
  // TODO: 实现搜索
  throw new Error('Not implemented yet: ig_search');
}

// ============ 写操作 API 实现 ============

async function handleLikeMedia(params: Record<string, any>): Promise<any> {
  const { mediaId, moduleName, userId, username, d } = params;

  if (!mediaId) {
    throw new Error('mediaId is required');
  }

  const likeParams: IgLikeParams = {
    mediaId,
    moduleName: moduleName || 'profile',
    userId: userId || '',
    username: username || '',
    d: d || 0,
  };

  const result = await igApi.likeMedia(likeParams);
  return {
    success: true,
    likeCount: result.like_count,
  };
}

async function handleUnlikeMedia(params: Record<string, any>): Promise<any> {
  const { mediaId } = params;

  if (!mediaId) {
    throw new Error('mediaId is required');
  }

  const result = await igApi.unlikeMedia(mediaId);
  return {
    success: true,
    likeCount: result.like_count,
  };
}

async function handleFollowUser(params: Record<string, any>): Promise<any> {
  const { userId, moduleName, username } = params;

  if (!userId) {
    throw new Error('userId is required');
  }

  const followParams: IgFollowParams = {
    userId,
    moduleName: moduleName || 'profile',
    username: username || '',
  };

  const result = await igApi.followUser(followParams);
  return {
    success: true,
    following: result.following,
    friendshipStatus: result.friendship_status,
  };
}

async function handleUnfollowUser(params: Record<string, any>): Promise<any> {
  const { userId } = params;

  if (!userId) {
    throw new Error('userId is required');
  }

  const result = await igApi.unfollowUser(userId);
  return {
    success: true,
    following: result.following,
    friendshipStatus: result.friendship_status,
  };
}

async function handlePostComment(params: Record<string, any>): Promise<any> {
  const { mediaId, text, repliedToCommentId } = params;

  if (!mediaId || !text) {
    throw new Error('mediaId and text are required');
  }

  const commentParams: IgCommentParams = {
    mediaId,
    text,
    repliedToCommentId: repliedToCommentId || undefined,
  };

  const result = await igApi.postComment(commentParams);
  return {
    success: true,
    comment: {
      id: result.comment.pk,
      text: result.comment.text,
      userId: result.comment.user.pk,
      username: result.comment.user.username,
    },
  };
}

async function handleDeleteComment(params: Record<string, any>): Promise<any> {
  // TODO: 实现删除评论
  throw new Error('Not implemented yet: ig_delete_comment');
}

async function handlePostMedia(params: Record<string, any>): Promise<any> {
  // TODO: 实现发布媒体
  throw new Error('Not implemented yet: ig_post_media');
}

async function handleDeleteMedia(params: Record<string, any>): Promise<any> {
  // TODO: 实现删除媒体
  throw new Error('Not implemented yet: ig_delete_media');
}

// ============ 工具方法实现 ============

async function handleCheckLogin(params: Record<string, any>): Promise<any> {
  const isLoggedIn = await igApi.checkLogin();
  return { isLoggedIn };
}

async function handleTestConnection(params: Record<string, any>): Promise<any> {
  const result = await igApi.testConnection();
  return result;
}

// ============ 初始化检查 ============

(async () => {
  console.log(`${TAG} Instagram Content Script loaded`);

  // 检查是否在 Instagram 页面
  if (!window.location.hostname.includes('instagram.com')) {
    console.warn(`${TAG} Not on Instagram page, skipping initialization`);
    return;
  }

  // 检查登录状态
  try {
    const isLoggedIn = await igApi.checkLogin();
    if (isLoggedIn) {
      console.log(`${TAG} ✅ User is logged in to Instagram`);

      // 测试连接（可选）
      const testResult = await igApi.testConnection();
      if (testResult.success) {
        console.log(`${TAG} ✅ API connection successful, userId: ${testResult.userId}`);
      } else {
        console.warn(`${TAG} ⚠️ API connection test failed: ${testResult.error}`);
      }
    } else {
      console.warn(`${TAG} ⚠️ User is not logged in to Instagram`);
    }
  } catch (error: any) {
    console.error(`${TAG} ❌ Initialization error:`, error.message);
  }
})();