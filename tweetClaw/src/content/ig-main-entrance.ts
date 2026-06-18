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
  IgPostMediaParams,
} from '../ig_api/types';
import { X_IG_APP_ID } from '../ig_api/constants';

const TAG = '[IgClaw-CS]';

// Instagram API 客户端实例
const igApi = new IgApiClient();

// ── 暴露全局 API 到 window（供控制台测试和外部调用）─────────────────────────

interface IgGlobalApi {
  getSelfInfo: () => Promise<any>;
  getUserInfo: (userId: string) => Promise<any>;
  searchUser: (username: string) => Promise<any>;
  getFeed: (maxId?: string) => Promise<any>;
  getMediaInfo: (shortcode: string) => Promise<any>;
  getMediaComments: (params: { mediaId: string; minId?: string; sortOrder?: string; canSupportThreading?: boolean; permalinkEnabled?: boolean }) => Promise<any>;
  getNotifications: () => Promise<any>;
  getFollowers: (params: { userId: string; count?: number; maxId?: string; searchSurface?: string }) => Promise<any>;
  getFollowing: (params: { userId: string; count?: number; maxId?: string }) => Promise<any>;
  likeMedia: (params: { mediaId: string; moduleName?: string; userId?: string; username?: string; d?: number }) => Promise<any>;
  unlikeMedia: (mediaId: string) => Promise<any>;
  followUser: (params: { userId: string; moduleName?: string; username?: string }) => Promise<any>;
  unfollowUser: (userId: string) => Promise<any>;
  postComment: (params: { mediaId: string; text: string; repliedToCommentId?: string }) => Promise<any>;
  deleteComment: (params: { mediaId: string; commentId: string }) => Promise<any>;
  postMedia: (params: { imageBase64?: string; imageBytes?: Uint8Array | Uint8Array[]; mimeType?: string; caption: string; disableComments?: boolean; shareToThreads?: boolean; location?: any }) => Promise<any>;
  deleteMedia: (mediaId: string) => Promise<any>;
  getUserMedia: (params: { userId?: string; username?: string; count?: number; after?: string }) => Promise<any>;
  search: (params: { query: string; searchSessionId?: string; serpSessionId?: string }) => Promise<any>;
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
  getFeed: async (maxId?: string) => {
    return await handleGetFeed({ maxId });
  },
  getMediaInfo: async (shortcode: string) => {
    return await handleGetMedia({ shortcode });
  },
  getMediaComments: async (params) => {
    return await handleGetMediaComments(params);
  },
  getNotifications: async () => {
    return await handleGetNotifications({});
  },
  getFollowers: async (params) => {
    return await handleGetFollowers(params);
  },
  getFollowing: async (params) => {
    return await handleGetFollowing(params);
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
  deleteComment: async (params) => {
    return await handleDeleteComment(params);
  },
  postMedia: async (params) => {
    return await handlePostMedia(params);
  },
  deleteMedia: async (mediaId: string) => {
    return await handleDeleteMedia({ mediaId });
  },
  getUserMedia: async (params) => {
    return await handleGetUserMedia(params);
  },
  search: async (params) => {
    return await handleSearch(params);
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

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  // 处理分片视频上传任务（来自 background task coordinator）
  if (message.type === 'START_IG_PUBLISH_VIDEO_TASK') {
    console.log(`${TAG} Received START_IG_PUBLISH_VIDEO_TASK taskId=${message.taskId}`);
    handlePublishVideoTask(message).then(() => {
      sendResponse({ success: true });
    }).catch((e: any) => {
      console.error(`${TAG} START_IG_PUBLISH_VIDEO_TASK rejected:`, e?.message || String(e));
      sendResponse({ success: false, error: e?.message || String(e) });
    });
    return true;
  }

  // 只处理 Instagram command 消息
  if (!message.type || !message.type.startsWith('command.ig_')) {
    return false;
  }

  console.log(`${TAG} Received message:`, message.type, message.params);

  // 异步处理消息
  handleMessage(message as IgRequestMessage)
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

    case 'command.ig_get_notifications':
      return await handleGetNotifications(params);

    case 'command.ig_get_followers':
      return await handleGetFollowers(params);

    case 'command.ig_get_following':
      return await handleGetFollowing(params);

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

    case 'command.ig_get_user_media':
      return await handleGetUserMedia(params);

    case 'command.ig_get_media_comments':
      return await handleGetMediaComments(params);

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
  const { mediaId, minId, sortOrder, canSupportThreading, permalinkEnabled } = params;

  if (!mediaId) {
    throw new Error('mediaId is required');
  }

  const result = await igApi.getMediaComments({
    mediaId,
    minId,
    sortOrder: sortOrder || 'popular',
    canSupportThreading: canSupportThreading !== false,
    permalinkEnabled: permalinkEnabled !== false,
  });

  return {
    caption: result.caption,
    commentCount: result.comment_count,
    comments: result.comments.map(comment => ({
      id: comment.pk,
      text: comment.text,
      userId: comment.user_id,
      username: comment.user.username,
      fullName: comment.user.full_name,
      profilePicUrl: comment.user.profile_pic_url,
      createdAt: comment.created_at,
      likeCount: comment.comment_like_count,
      hasLiked: comment.has_liked_comment,
      childCommentCount: comment.child_comment_count || 0,
      isEdited: comment.is_edited || false,
      status: comment.status,
    })),
    canViewMore: result.can_view_more_preview_comments,
    nextMinId: result.next_min_id,
  };
}

async function handleSearch(params: Record<string, any>): Promise<any> {
  const { query, searchSessionId, serpSessionId, after, before, first, last } = params;

  if (!query) {
    throw new Error('query is required');
  }

  const result = await igApi.search({
    query,
    searchSessionId,
    serpSessionId,
    after,
    before,
    first,
    last,
  });

  return {
    success: true,
    results: result.results,
    hasMore: result.hasMore,
    query: result.query,
    endCursor: result.endCursor,
    startCursor: result.startCursor,
  };
}

async function handleGetNotifications(params: Record<string, any>): Promise<any> {
  const result = await igApi.getNotifications(params);

  return {
    success: true,
    notifications: result.notifications,
    newStories: result.newStories,
    oldStories: result.oldStories,
    hasMore: result.hasMore,
    partition: result.partition,
  };
}

async function handleGetFollowers(params: Record<string, any>): Promise<any> {
  const { userId, count, maxId, searchSurface } = params;

  if (!userId) {
    throw new Error('userId is required');
  }

  const result = await igApi.getFollowers({
    userId,
    count: count || 12,
    maxId,
    searchSurface,
  });

  return {
    success: true,
    users: result.users,
    hasMore: result.hasMore,
    nextMaxId: result.nextMaxId,
    pageSize: result.pageSize,
  };
}

async function handleGetFollowing(params: Record<string, any>): Promise<any> {
  const { userId, count, maxId } = params;

  if (!userId) {
    throw new Error('userId is required');
  }

  const result = await igApi.getFollowing({
    userId,
    count: count || 12,
    maxId,
  });

  return {
    success: true,
    users: result.users,
    hasMore: result.hasMore,
    nextMaxId: result.nextMaxId,
    pageSize: result.pageSize,
  };
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

  // Instagram API 直接返回评论对象，不包装在 comment 字段中
  // 响应格式: { "id": "xxx", "text": "xxx", "from": {...}, "status": "ok" }
  return {
    success: true,
    comment: {
      id: result.id,
      text: result.text,
      userId: result.from?.id,
      username: result.from?.username,
    },
  };
}

async function handleDeleteComment(params: Record<string, any>): Promise<any> {
  const { mediaId, commentId } = params;

  if (!mediaId || !commentId) {
    throw new Error('mediaId and commentId are required');
  }

  const result = await igApi.deleteComment({ mediaId, commentId });

  return {
    success: true,
    status: result.status,
  };
}

async function handlePostMedia(params: Record<string, any>): Promise<any> {
  const {
    imageBase64,
    imageBytes,
    imageBase64List,
    videoBytes,
    videoBase64,
    mimeType,
    caption,
    disableComments,
    shareToThreads,
    location,
    videoDuration,
    videoWidth,
    videoHeight,
    thumbnailBase64,
    thumbnailBytes,
  } = params;

  // 检查是否有图片或视频数据
  const hasImage = imageBase64 || imageBytes || imageBase64List;
  const hasVideo = videoBytes || videoBase64;

  if (!hasImage && !hasVideo) {
    throw new Error('Either imageBase64/imageBytes or videoBytes/videoBase64 is required');
  }

  if (!caption) {
    throw new Error('caption is required');
  }

  // 构建 postMedia 参数
  const postParams: IgPostMediaParams = {
    caption,
    disableComments: disableComments || false,
    shareToThreads: shareToThreads !== false, // 默认 true
    mimeType: mimeType || (hasVideo ? 'video/mp4' : 'image/jpeg'),
  };

  // 处理视频数据
  if (hasVideo) {
    if (videoBytes) {
      // 如果是数组，转换为 Uint8Array
      if (Array.isArray(videoBytes)) {
        postParams.videoBytes = new Uint8Array(videoBytes);
      } else {
        postParams.videoBytes = videoBytes;
      }
    } else if (videoBase64) {
      // 解码 base64
      const binaryStr = atob(videoBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      postParams.videoBytes = bytes;
    }

    // 添加视频参数
    postParams.videoDuration = videoDuration || 10000;
    postParams.videoWidth = videoWidth || 720;
    postParams.videoHeight = videoHeight || 1280;

    // 处理封面图片
    if (thumbnailBytes) {
      // 如果是数组，转换为 Uint8Array
      if (Array.isArray(thumbnailBytes)) {
        postParams.thumbnailBytes = new Uint8Array(thumbnailBytes);
      } else {
        postParams.thumbnailBytes = thumbnailBytes;
      }
    } else if (thumbnailBase64) {
      postParams.thumbnailBase64 = thumbnailBase64;
    }
  } else if (hasImage) {
    // 处理图片数据
    if (imageBase64List) {
      // 多图：base64 字符串列表 -> Uint8Array[]
      postParams.imageBytes = imageBase64List.map((b64: string) => {
        const binaryStr = atob(b64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
      });
    } else if (imageBytes) {
      if (Array.isArray(imageBytes)) {
        // 判断是单图数组还是多图数组
        if (imageBytes.length > 0 && Array.isArray(imageBytes[0])) {
          // 多图：number[][] -> Uint8Array[]
          postParams.imageBytes = (imageBytes as number[][]).map(
            (arr) => new Uint8Array(arr)
          );
        } else {
          // 单图：number[] -> Uint8Array
          postParams.imageBytes = new Uint8Array(imageBytes as number[]);
        }
      } else {
        postParams.imageBytes = imageBytes;
      }
    } else if (imageBase64) {
      postParams.imageBase64 = imageBase64;
    }
  }

  // 添加位置信息（如果有）
  if (location) {
    postParams.location = location;
  }

  const result = await igApi.postMedia(postParams);

  return {
    success: true,
    media: {
      id: result.media.id,
      pk: result.media.pk,
      code: result.media.code,
      caption: result.media.caption?.text,
      mediaType: result.media.media_type,
      takenAt: result.media.taken_at,
    },
  };
}

async function handleDeleteMedia(params: Record<string, any>): Promise<any> {
  const { mediaId } = params;

  if (!mediaId) {
    throw new Error('mediaId is required');
  }

  const result = await igApi.deleteMedia(mediaId);

  return {
    success: true,
    didDelete: result.did_delete,
    status: result.status,
  };
}

async function handleGetUserMedia(params: Record<string, any>): Promise<any> {
  const { userId, username, count, after } = params;

  if (!userId && !username) {
    throw new Error('Either userId or username is required');
  }

  const result = await igApi.getUserMedia({
    userId,
    username,
    count: count || 12,
    after,
  });

  return {
    success: true,
    items: result.items,
    pageInfo: result.pageInfo,
  };
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

// ============ IG 分片视频上传 Task Handler ============

export async function handlePublishVideoTask(message: any): Promise<void> {
  const { taskId, uploadSessionId, mimeType, totalBytes, transferChunkCount, params } = message;

  console.log(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] START taskId=${taskId} mimeType=${mimeType} totalBytes=${totalBytes} chunks=${transferChunkCount}`);

  // 立即发送初始进度，告知 background 任务已开始
  chrome.runtime.sendMessage({
    type: 'TASK_PROGRESS_FROM_CONTENT',
    taskId,
    phase: 'init_upload',
    progress: 0.05,
  });

  try {
    const uploadId = Date.now().toString();
    const duration = Number(params?.videoDuration || params?.upload_media_duration_ms || 10000);
    const width = Number(params?.videoWidth || params?.upload_media_width || 720);
    const height = Number(params?.videoHeight || params?.upload_media_height || 1280);

    console.log(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] upload_id=${uploadId} duration=${duration} ${width}x${height}`);

    // 每个 transfer chunk 是多少字节
    const transferChunkBytes = Math.ceil(totalBytes / transferChunkCount);

    // 累积缓冲区：用于按需拼装 IG 10MB 分片
    let buffer = new Uint8Array(0);
    let fetchedChunks = 0;

    // getChunk 回调：按 offset+size 从 bg session 拉取数据
    // IG 的每个 chunk 是 10MB，bg session 的每个 transfer chunk 约 5MB
    // 需要动态从 bg 拉取，累积够 10MB 再上传
    const getChunk = async (offset: number, size: number): Promise<Uint8Array> => {
      // 从缓冲区消耗 size 字节，不够时继续从 bg 拉取
      while (buffer.length < size && fetchedChunks < transferChunkCount) {
        const resp = await chrome.runtime.sendMessage({
          type: 'GET_UPLOAD_SESSION_CHUNK',
          uploadSessionId,
          chunkIndex: fetchedChunks,
        });

        if (!resp?.success || !resp.chunkData) {
          throw new Error(resp?.error || `Failed to get chunk ${fetchedChunks}`);
        }

        const chunkBytes = new Uint8Array(resp.chunkData);

        const merged = new Uint8Array(buffer.length + chunkBytes.length);
        merged.set(buffer, 0);
        merged.set(chunkBytes, buffer.length);
        buffer = merged;
        fetchedChunks++;

        console.log(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] fetched bg chunk ${fetchedChunks}/${transferChunkCount} chunkDataLength=${chunkBytes.length} bufferSize=${buffer.length}`);
      }

      const result = buffer.slice(0, size);
      buffer = buffer.slice(size);
      return result;
    };

    // 上传视频（分片）
    await igApi.uploadVideoChunked(
      getChunk,
      totalBytes,
      uploadId,
      duration,
      width,
      height,
      (progress) => {
        chrome.runtime.sendMessage({
          type: 'TASK_PROGRESS_FROM_CONTENT',
          taskId,
          phase: 'uploading',
          progress: 0.1 + progress * 0.6,
        });
      }
    );

    chrome.runtime.sendMessage({
      type: 'TASK_PROGRESS_FROM_CONTENT',
      taskId,
      phase: 'upload_thumbnail',
      progress: 0.72,
    });

    // 上传封面图（thumbnail）
    const thumbnailBase64: string | undefined = params?.thumbnailBase64;
    const thumbnailBytes: number[] | undefined = params?.thumbnailBytes;

    let thumbBytes: Uint8Array;
    if (thumbnailBytes) {
      thumbBytes = new Uint8Array(thumbnailBytes);
    } else if (thumbnailBase64) {
      const bin = atob(thumbnailBase64);
      thumbBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) thumbBytes[i] = bin.charCodeAt(i);
    } else {
      thumbBytes = igApi.generateDefaultThumbnailPublic(width, height);
    }

    await igApi.uploadVideoThumbnail(uploadId, thumbBytes, width, height);
    console.log(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] thumbnail uploaded`);

    chrome.runtime.sendMessage({
      type: 'TASK_PROGRESS_FROM_CONTENT',
      taskId,
      phase: 'configuring',
      progress: 0.85,
    });

    // configure_to_clips（轮询直到转码完成）
    const caption: string = params?.caption || '';
    const disableComments: boolean = params?.disableComments || params?.disable_comments || false;
    const shareToThreads: boolean = params?.shareToThreads ?? params?.share_to_threads ?? true;

    const result = await igApi.configureVideo({
      uploadId,
      caption,
      duration,
      width,
      height,
      disableComments,
      shareToThreads,
    });

    console.log(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] configured media id=${result.media?.id}`);

    // 上报完成
    await chrome.runtime.sendMessage({
      type: 'TASK_COMPLETED_FROM_CONTENT',
      taskId,
      contentType: 'application/json',
      resultBase64: btoa(unescape(encodeURIComponent(JSON.stringify(result)))),
    });
  } catch (e: any) {
    console.error(`${TAG} [START_IG_PUBLISH_VIDEO_TASK] error:`, e.message);
    await chrome.runtime.sendMessage({
      type: 'TASK_FAILED_FROM_CONTENT',
      taskId,
      phase: 'publish',
      errorCode: 'PUBLISH_FAILED',
      errorMessage: e?.message || String(e),
    });
  }
}