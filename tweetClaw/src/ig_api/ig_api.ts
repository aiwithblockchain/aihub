/**
 * Instagram API 核心调用模块
 * 实现 Instagram Web API 的调用逻辑
 */

import { sign, smartDelay } from './signature';
import { getCsrfToken, getRequiredCookies, isLoggedIn } from './cookie-helper';
import {
  BASE_URL,
  X_IG_APP_ID,
  REQUEST_TIMEOUT,
  MIN_WRITE_DELAY,
  MAX_WRITE_DELAY,
} from './constants';
import {
  getFbDtsgWithCache,
  buildUserSearchVariables,
  buildHomeFeedVariables,
  buildMediaInfoVariables,
  buildUserProfileVariables,
  buildGraphQLBody,
  parseSearchResponse,
  parseFeedResponse,
  parseUserProfileResponse,
  GRAPHQL_QUERIES,
} from './graphql-helper';
import type {
  IgCurrentUser,
  IgCurrentUserResponse,
  IgUser,
  IgUserInfoResponse,
  IgMedia,
  IgFeedMedia,
  IgFeedResponse,
  IgLikeParams,
  IgLikeResponse,
  IgFollowParams,
  IgFollowResponse,
  IgCommentParams,
  IgCommentResponse,
  IgDeleteCommentParams,
  IgGetCommentsParams,
  IgGetCommentsResponse,
  IgComment,
  IgPostMediaParams,
  IgPostMediaResponse,
  IgUploadImageResult,
  IgUploadVideoResult,
  IgConfigureVideoParams,
  IgDeleteMediaParams,
  IgDeleteMediaResponse,
  IgGetUserMediaParams,
  IgGetUserMediaResponse,
  IgApiResponse,
  IgSearchParams,
  IgSearchResponse,
  IgSearchResult,
  IgGetNotificationsParams,
  IgGetNotificationsResponse,
  IgNotification,
  IgNotificationType,
  IgGetFollowersParams,
  IgGetFollowersResponse,
  IgGetFollowingParams,
  IgGetFollowingResponse,
  IgFollowUser,
} from './types';

/**
 * Shortcode 和 Media ID 转换工具
 */
const SHORTCODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * 将 Instagram shortcode 转换为 media ID
 * @param shortcode - Instagram post shortcode (例如 "DWxxh4pJHjK")
 * @returns media ID (例如 "3879237864781848334")
 *
 * @example
 * shortcodeToMediaId('DWxxh4pJHjK') // => '3879237864781848334'
 */
export function shortcodeToMediaId(shortcode: string): string {
  let mediaId = 0n;
  for (let i = 0; i < shortcode.length; i++) {
    const c = shortcode[i];
    const index = SHORTCODE_ALPHABET.indexOf(c);
    if (index === -1) {
      throw new Error(`Invalid character in shortcode: ${c}`);
    }
    mediaId = mediaId * 64n + BigInt(index);
  }
  return mediaId.toString();
}

/**
 * 将 media ID 转换为 Instagram shortcode
 * @param mediaId - Instagram media ID (例如 "3879237864781848334")
 * @returns shortcode (例如 "DWxxh4pJHjK")
 *
 * @example
 * mediaIdToShortcode('3879237864781848334') // => 'DWxxh4pJHjK'
 */
export function mediaIdToShortcode(mediaId: string): string {
  let id = BigInt(mediaId);
  let shortcode = '';

  while (id > 0n) {
    const remainder = Number(id % 64n);
    shortcode = SHORTCODE_ALPHABET[remainder] + shortcode;
    id = id / 64n;
  }

  return shortcode || SHORTCODE_ALPHABET[0];
}

/**
 * 从 Instagram URL 提取 shortcode
 * @param url - Instagram post URL
 * @returns shortcode 或 null
 *
 * @example
 * extractShortcodeFromUrl('https://www.instagram.com/p/DWxxh4pJHjK/') // => 'DWxxh4pJHjK'
 * extractShortcodeFromUrl('https://www.instagram.com/reel/DWxxh4pJHjK/') // => 'DWxxh4pJHjK'
 */
export function extractShortcodeFromUrl(url: string): string | null {
  const match = url.match(/(?:\/p\/|\/reel\/|\/tv\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * 从 Instagram URL 提取 media ID
 * @param url - Instagram post URL
 * @returns media ID 或 null
 *
 * @example
 * extractMediaIdFromUrl('https://www.instagram.com/p/DWxxh4pJHjK/') // => '3879237864781848334'
 */
export function extractMediaIdFromUrl(url: string): string | null {
  const shortcode = extractShortcodeFromUrl(url);
  if (!shortcode) return null;

  try {
    return shortcodeToMediaId(shortcode);
  } catch {
    return null;
  }
}

/**
 * Instagram API 客户端
 */
export class IgApiClient {
  private baseUrl: string = BASE_URL;

  /**
   * 构建默认请求 Headers
   */
  private async buildHeaders(method: 'GET' | 'POST' = 'GET'): Promise<Headers> {
    const csrfToken = await getCsrfToken();

    const headers = new Headers({
      'X-CSRFToken': csrfToken,
      'X-IG-App-ID': X_IG_APP_ID,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.instagram.com/',
      'X-Instagram-AJAX': '1',
      // 注意：在浏览器中不要手动设置 User-Agent，浏览器会自动发送
    });

    if (method === 'POST') {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }

    return headers;
  }

  /**
   * 发送 API 请求
   * @param endpoint API 端点
   * @param method HTTP 方法
   * @param body 请求体
   * @returns 响应数据
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, any>,
    skipSignature: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.buildHeaders(method);

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (body && method === 'POST') {
      if (skipSignature) {
        // GraphQL 等查询不需要签名，直接发送表单数据
        options.body = new URLSearchParams(body).toString();
      } else {
        // 对请求体进行签名
        const signedBody = await sign(body);
        options.body = new URLSearchParams({
          ...signedBody,
          ...body,
        }).toString();
      }
    }

    console.log(`[IG API] ${method} ${endpoint}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 检查 API 状态
    if (data.status !== 'ok') {
      throw new Error(`API Error: ${data.message || data.error_type || 'Unknown error'}`);
    }

    return data;
  }

  
  // ============ 读取 API ============

  /**
   * 获取当前用户信息
   * 优先走 GraphQL (PolarisProfilePageContentQuery)，REST /info/ 作为降级
   * REST 端点容易被 feedback_required 限流，GraphQL 在浏览器页面上下文里更稳
   */
  public async getSelfInfo(): Promise<IgUser> {
    // 从 cookie 获取当前用户 ID
    const cookies = await getRequiredCookies();
    const userId = cookies.ds_user_id;
    if (!userId) {
      throw new Error('Not logged in: ds_user_id not found');
    }

    return this.getUserInfo(userId);
  }

  /**
   * 获取用户信息
   * 优先 GraphQL: POST /api/graphql (PolarisProfilePageContentQuery)
   * 降级 REST: GET /api/v1/users/{user_id}/info/
   */
  public async getUserInfo(userId: string): Promise<IgUser> {
    // 1. 先试 GraphQL
    try {
      return await this.getUserInfoViaGraphQL(userId);
    } catch (graphqlErr) {
      console.warn(`[IG API] GraphQL getUserInfo failed, falling back to REST:`, graphqlErr);
    }

    // 2. 降级 REST
    const response = await this.request<IgUserInfoResponse>(
      `/api/v1/users/${userId}/info/`,
      'GET'
    );
    return this.parseUser(response.user);
  }

  /**
   * 通过 GraphQL 获取用户信息
   * 查询: PolarisProfilePageContentQuery
   * 需要 fb_dtsg token（从页面提取）
   */
  private async getUserInfoViaGraphQL(userId: string): Promise<IgUser> {
    const fbDtsg = await getFbDtsgWithCache();
    if (!fbDtsg) {
      throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
    }

    const variables = buildUserProfileVariables(userId);
    const body = buildGraphQLBody(
      GRAPHQL_QUERIES.USER_PROFILE.queryName,
      GRAPHQL_QUERIES.USER_PROFILE.docId,
      variables,
      fbDtsg
    );

    const headers = await this.buildHeaders('POST');
    headers.set('x-fb-friendly-name', GRAPHQL_QUERIES.USER_PROFILE.queryName);

    console.log(`[IG API] getUserInfo via GraphQL: userId=${userId}`);

    const response = await fetch(`${this.baseUrl}/api/graphql`, {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 检查 feedback_required / spam 限流
    if (data?.status === 'fail' || data?.message === 'feedback_required') {
      throw new Error(`GraphQL feedback_required: ${data?.feedback_message || 'rate limited'}`);
    }

    const parsed = parseUserProfileResponse(data);
    return this.parseUser(parsed);
  }

  /**
   * 解析 REST API 用户数据为 IgUser 格式
   * REST API 返回的字段名和 TypeScript 类型不完全匹配
   */
  private parseUser(apiUser: any): IgUser {
    return {
      pk: apiUser.pk || apiUser.id || apiUser.instagram_pk,
      username: apiUser.username || '',
      full_name: apiUser.full_name || '',
      is_private: apiUser.is_private || false,
      is_verified: apiUser.is_verified || false,
      profile_pic_id: apiUser.profile_pic_id,
      profile_pic_url: apiUser.profile_pic_url || apiUser.hd_profile_pic_url_info?.url,
      biography: apiUser.biography,
      external_url: apiUser.external_url,
      follower_count: apiUser.follower_count || 0,
      following_count: apiUser.following_count || 0,
      media_count: apiUser.media_count || 0,
      is_business: apiUser.is_business || false,
      business_category_name: apiUser.business_category_name,
      category_enum: apiUser.category_enum,
    };
  }

  /**
   * 通过用户名搜索用户
   * 使用 GraphQL API: POST /api/graphql
   * 查询: PolarisSearchBoxRefetchableQuery
   */
  public async searchUserId(username: string): Promise<string | null> {
    try {
      // 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 构建 GraphQL 查询参数
      const variables = buildUserSearchVariables(username);
      const body = buildGraphQLBody(
        GRAPHQL_QUERIES.SEARCH_USERS.queryName,
        GRAPHQL_QUERIES.SEARCH_USERS.docId,
        variables,
        fbDtsg
      );

      // 发送 GraphQL 请求
      const headers = await this.buildHeaders('POST');
      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析搜索结果
      const users = parseSearchResponse(data);

      // 查找精确匹配的用户
      const exactMatch = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

      if (exactMatch) {
        console.log(`[IG API] Found user: ${exactMatch.username} (ID: ${exactMatch.userId})`);
        return exactMatch.userId;
      }

      // 如果没有精确匹配，返回第一个结果
      if (users.length > 0) {
        console.log(`[IG API] No exact match, returning first result: ${users[0].username}`);
        return users[0].userId;
      }

      console.log(`[IG API] User not found: ${username}`);
      return null;
    } catch (error) {
      console.error('[IG API] Search user error:', error);
      throw error;
    }
  }

  /**
   * 获取首页 Feed
   * 使用 GraphQL API: POST /api/graphql
   * 查询: PolarisHomeFeedQuery
   */
  public async getHomeFeed(maxId?: string): Promise<{
    items: Array<{
      id: string;
      pk: string;
      code: string;
      mediaType: string;
      imageUrl: string;
      caption: string;
      likeCount: number;
      commentCount: number;
      hasLiked: boolean;
      user: {
        userId: string;
        username: string;
        fullName: string;
      };
    }>;
    nextMaxId: string | null;
  }> {
    try {
      // 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 构建 GraphQL 查询参数
      const variables = buildHomeFeedVariables(maxId);
      const body = buildGraphQLBody(
        GRAPHQL_QUERIES.HOME_FEED.queryName,
        GRAPHQL_QUERIES.HOME_FEED.docId,
        variables,
        fbDtsg
      );

      // 发送 GraphQL 请求
      const headers = await this.buildHeaders('POST');
      const response = await fetch(`${this.baseUrl}/graphql/query`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Debug: log raw response structure
      console.log('[IG API] Feed raw response keys:', Object.keys(data));
      const conn = data?.data?.xdt_api__v1__feed__timeline__connection;
      console.log('[IG API] Feed connection:', conn ? `edges: ${conn.edges?.length}, hasNext: ${conn.page_info?.has_next_page}` : 'NOT FOUND');
      if (data?.errors) {
        console.error('[IG API] Feed errors:', JSON.stringify(data.errors));
      }

      // 解析 Feed 结果
      const result = parseFeedResponse(data);

      console.log(`[IG API] Got ${result.items.length} feed items`);
      return result;
    } catch (error) {
      console.error('[IG API] Get home feed error:', error);
      throw error;
    }
  }

  /**
   * 获取媒体详情 (通过 shortcode) - 使用 GraphQL API
   * API: POST /graphql/query
   * Query: PolarisPostRootQuery
   *
   * @param shortcode - Instagram post shortcode (从 URL 或 code 字段获取)
   * @returns 包含 like_count, comment_count, has_liked 等详细信息
   *
   * @example
   * const info = await igApi.getMediaInfo('DWxxh4pJHjK');
   * console.log(info.likeCount, info.hasLiked);
   */
  public async getMediaInfo(shortcode: string): Promise<{
    id: string;
    pk: string;
    shortcode: string;
    mediaType: string;
    likeCount: number;
    commentCount: number;
    hasLiked: boolean;
    caption: string;
    takenAt: number;
    user: {
      userId: string;
      username: string;
      fullName: string;
    };
  }> {
    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      const variables = buildMediaInfoVariables(shortcode);
      const body = buildGraphQLBody(
        GRAPHQL_QUERIES.MEDIA_INFO.queryName,
        GRAPHQL_QUERIES.MEDIA_INFO.docId,
        variables,
        fbDtsg
      );

      const headers = await this.buildHeaders('POST');
      headers.set('content-type', 'application/x-www-form-urlencoded');

      const response = await fetch(`${this.baseUrl}/graphql/query`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析 GraphQL 响应
      const items = data?.data?.xdt_api__v1__media__shortcode__web_info?.items;

      if (!items || items.length === 0) {
        console.error('[IG API] Media not found, response keys:', Object.keys(data?.data || {}));
        throw new Error('Media not found or invalid response structure');
      }

      const media = items[0];

      const mediaTypeMap: Record<number, string> = {
        1: 'IMAGE',
        2: 'VIDEO',
        8: 'CAROUSEL',
      };

      return {
        id: media.id,
        pk: media.pk,
        shortcode: media.code,
        mediaType: mediaTypeMap[media.media_type] || 'IMAGE',
        likeCount: media.like_count || 0,
        commentCount: media.comment_count || 0,
        hasLiked: media.has_liked || false,
        caption: media.caption?.text || '',
        takenAt: media.taken_at || 0,
        user: {
          userId: media.user?.id || '',
          username: media.user?.username || '',
          fullName: media.user?.full_name || '',
        },
      };
    } catch (error) {
      console.error('[IG API] Get media info error:', error);
      throw error;
    }
  }

  /**
   * 获取媒体评论列表 (使用 REST API)
   * API: GET /api/v1/media/{media_id}/comments/
   *
   * @param params - mediaId 必需，其他参数可选
   * @returns 评论列表和分页信息
   */
  public async getMediaComments(params: IgGetCommentsParams): Promise<IgGetCommentsResponse> {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();

      if (params.canSupportThreading !== false) {
        queryParams.append('can_support_threading', 'true');
      }

      if (params.permalinkEnabled !== false) {
        queryParams.append('permalink_enabled', 'false');
      }

      if (params.minId) {
        queryParams.append('min_id', params.minId);
      }

      if (params.sortOrder) {
        queryParams.append('sort_order', params.sortOrder);
      }

      // 发送 GET 请求
      const headers = await this.buildHeaders('GET');
      const url = `${this.baseUrl}/api/v1/media/${params.mediaId}/comments/?${queryParams.toString()}`;

      console.log(`[IG API] GET /api/v1/media/${params.mediaId}/comments/`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析响应
      const comments: IgComment[] = (data.comments || []).map((comment: any) => ({
        pk: comment.pk,
        user_id: comment.user_id,
        text: comment.text,
        type: comment.type,
        created_at: comment.created_at,
        user: this.parseUser(comment.user),
        comment_like_count: comment.comment_like_count || 0,
        has_liked_comment: comment.has_liked_comment || false,
        has_disliked_comment: comment.has_disliked_comment || false,
        is_covered_by_ig_rules: comment.is_covered_by_ig_rules || false,
        child_comment_count: comment.child_comment_count || 0,
        is_edited: comment.is_edited || false,
        status: comment.status,
      }));

      console.log(`[IG API] Got ${comments.length} comments, total: ${data.comment_count}`);

      return {
        caption: data.caption ? {
          pk: data.caption.pk,
          text: data.caption.text,
          user: this.parseUser(data.caption.user),
          created_at: data.caption.created_at,
        } : undefined,
        comment_count: data.comment_count || 0,
        comments,
        can_view_more_preview_comments: data.can_view_more_preview_comments || false,
        next_min_id: data.next_min_id,  // 如果存在分页游标
      };
    } catch (error) {
      console.error('[IG API] Get media comments error:', error);
      throw error;
    }
  }

  // ============ 写操作 API ============

  /**
   * 获取 actor_id (user's Facebook ID)
   */
  private async getActorId(): Promise<string> {
    // 从页面脚本中提取 actor_id
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const text = script.textContent || '';
      const match = text.match(/"actorID"\s*:\s*"(\d+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }
    throw new Error('Actor ID not found. Please refresh the page.');
  }

  /**
   * 点赞媒体 (使用 GraphQL API)
   * API: POST /api/graphql
   * Mutation: PolarisAPILikePostMutation
   */
  public async likeMedia(params: IgLikeParams): Promise<IgLikeResponse> {
    // 写操作延迟
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      const actorId = await this.getActorId();

      const variables = {
        input: {
          media_id: params.mediaId,
          actor_id: actorId,
          client_mutation_id: '1',
        },
      };

      const body = buildGraphQLBody(
        'PolarisAPILikePostMutation',
        '27232073366423857',
        variables,
        fbDtsg
      );

      const headers = await this.buildHeaders('POST');
      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析 GraphQL 响应
      const hasLiked = data?.data?.xig_media_like?.media?.has_liked;

      return {
        status: hasLiked ? 'ok' : 'fail',
        // GraphQL 响应不包含 like_count，如需获取请单独调用 media 详情接口
      };
    } catch (error) {
      console.error('[IG API] Like media error:', error);
      throw error;
    }
  }

  /**
   * 取消点赞 (使用 GraphQL API)
   * API: POST /api/graphql
   * Mutation: usePolarisLikeMediaXIGUnlikeMutation
   *
   * @param mediaId - Instagram media ID (例如 "3869091387729541322")
   * @returns 操作结果
   */
  public async unlikeMedia(mediaId: string): Promise<IgLikeResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      const actorId = await this.getActorId();

      const variables = {
        input: {
          actor_id: actorId,
          client_mutation_id: '1',
          media_id: mediaId,
          tracking_token: '',
        },
      };

      const body = buildGraphQLBody(
        'usePolarisLikeMediaXIGUnlikeMutation',
        '26662414810082851',
        variables,
        fbDtsg
      );

      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', 'usePolarisLikeMediaXIGUnlikeMutation');

      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析 GraphQL 响应
      const hasLiked = data?.data?.xig_media_unlike?.media?.has_liked;

      return {
        status: !hasLiked ? 'ok' : 'fail',
      };
    } catch (error) {
      console.error('[IG API] Unlike media error:', error);
      throw error;
    }
  }

  /**
   * 关注用户 (使用 GraphQL API)
   * API: POST /api/graphql
   * Mutation: usePolarisFollowMutation
   *
   * @param params - userId 必需，其他参数可选
   * @returns 关注状态
   */
  public async followUser(params: IgFollowParams): Promise<IgFollowResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      const variables = {
        target_user_id: params.userId,
        container_module: params.moduleName || 'profile',
        nav_chain: 'PolarisProfilePostsTabRoot:profilePage:1:via_cold_start',
      };

      const body = buildGraphQLBody(
        'usePolarisFollowMutation',
        '26508036048874888',
        variables,
        fbDtsg
      );

      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', 'usePolarisFollowMutation');

      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析 GraphQL 响应
      const friendshipStatus = data?.data?.xdt_create_friendship?.friendship_status;

      return {
        status: 'ok',
        following: friendshipStatus?.following || false,
        friendship_status: friendshipStatus,
      };
    } catch (error) {
      console.error('[IG API] Follow user error:', error);
      throw error;
    }
  }

  /**
   * 取消关注 (使用 GraphQL API)
   * API: POST /api/graphql
   * Mutation: usePolarisUnfollowMutation
   *
   * @param userId - Instagram user ID
   * @returns 关注状态
   */
  public async unfollowUser(userId: string): Promise<IgFollowResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      const variables = {
        target_user_id: userId,
        container_module: 'profile',
        nav_chain: 'PolarisProfilePostsTabRoot:profilePage:1:via_cold_start',
      };

      const body = buildGraphQLBody(
        'usePolarisUnfollowMutation',
        '27789106940691111',
        variables,
        fbDtsg
      );

      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', 'usePolarisUnfollowMutation');

      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 解析 GraphQL 响应
      const friendshipStatus = data?.data?.xdt_destroy_friendship?.friendship_status;

      return {
        status: 'ok',
        following: friendshipStatus?.following || false,
        friendship_status: friendshipStatus,
      };
    } catch (error) {
      console.error('[IG API] Unfollow user error:', error);
      throw error;
    }
  }

  /**
   * 发布评论 (使用 REST API)
   * API: POST /api/v1/web/comments/{media_id}/add/
   *
   * @param params - mediaId 和 text 必需
   * @returns 评论对象
   */
  public async postComment(params: IgCommentParams): Promise<any> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 构建表单数据
      const formData = new URLSearchParams();
      formData.append('comment_text', params.text);
      formData.append('fb_dtsg', fbDtsg);
      formData.append('jazoest', '22673');

      const headers = await this.buildHeaders('POST');
      headers.set('x-ig-www-claim', 'hmac.AR0WfvuQCL7DQedh15YwL5r8w1EnVqMNDPpLTaXT-bsO97RD');
      headers.set('x-instagram-ajax', '1040987894');
      headers.set('x-requested-with', 'XMLHttpRequest');

      const response = await fetch(
        `${this.baseUrl}/api/v1/web/comments/${params.mediaId}/add/`,
        {
          method: 'POST',
          headers,
          body: formData.toString(),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[IG API] Post comment error:', error);
      throw error;
    }
  }

  /**
   * 删除评论 (使用 REST API)
   * API: POST /api/v1/web/comments/{media_id}/delete/{comment_id}/
   *
   * @param params - mediaId 和 commentId 必需
   * @returns 操作结果
   */
  public async deleteComment(params: IgDeleteCommentParams): Promise<any> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const headers = await this.buildHeaders('POST');

      console.log(`[IG API] POST /api/v1/web/comments/${params.mediaId}/delete/${params.commentId}/`);

      const response = await fetch(
        `${this.baseUrl}/api/v1/web/comments/${params.mediaId}/delete/${params.commentId}/`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error('Failed to delete comment');
      }

      console.log(`[IG API] Comment deleted: ${params.commentId}`);
      return data;
    } catch (error) {
      console.error('[IG API] Delete comment error:', error);
      throw error;
    }
  }

  // ============ 媒体上传 API ============

  /**
   * 上传图片到 Instagram 服务器
   * API: POST https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}
   *
   * @param imageBytes - 图片二进制数据
   * @param mimeType - MIME 类型，默认 image/jpeg
   * @param uploadId - 上传 ID（可选，默认自动生成）
   * @returns 上传结果
   */
  public async uploadImage(
    imageBytes: Uint8Array,
    mimeType: string = 'image/jpeg',
    uploadId?: string
  ): Promise<IgUploadImageResult> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      // 生成上传 ID（时间戳）
      const finalUploadId = uploadId || Date.now().toString();

      // 获取图片尺寸
      // 创建 Blob 用于获取尺寸（使用 any 绕过 TypeScript 类型检查）
      const blob = new Blob([imageBytes as any], { type: mimeType });
      let width = 0, height = 0;

      try {
        const bitmap = await createImageBitmap(blob);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch (e) {
        console.warn('[IG API] Could not get image dimensions, using 0x0');
      }

      // 上传图片不需要 CSRF token，使用简化的 headers
      const uploadHeaders: Record<string, string> = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': mimeType,
        'offset': '0',
        'x-asbd-id': '359341',
        'x-entity-length': imageBytes.length.toString(),
        'x-entity-name': `fb_uploader_${finalUploadId}`,
        'x-entity-type': mimeType,
        'x-ig-app-id': X_IG_APP_ID,
        'x-instagram-rupload-params': JSON.stringify({
          media_type: 1, // 1=图片, 2=视频
          upload_id: finalUploadId,
          upload_media_height: height,
          upload_media_width: width,
        }),
      };

      console.log(`[IG API] POST https://i.instagram.com/rupload_igphoto/fb_uploader_${finalUploadId}`);
      console.log(`[IG API] Image size: ${width}x${height}, bytes: ${imageBytes.length}`);

      const response = await fetch(
        `https://i.instagram.com/rupload_igphoto/fb_uploader_${finalUploadId}`,
        {
          method: 'POST',
          headers: uploadHeaders,
          body: imageBytes.buffer as ArrayBuffer,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error('Failed to upload image');
      }

      console.log(`[IG API] Image uploaded: upload_id=${data.upload_id}`);
      return data;
    } catch (error) {
      console.error('[IG API] Upload image error:', error);
      throw error;
    }
  }

  /**
   * 上传视频（一次性，小文件用，内部供 postMedia 调用）
   * 对于大文件请使用 uploadVideoChunked
   */
  public async uploadVideo(
    videoBytes: Uint8Array,
    mimeType: string = 'video/mp4',
    uploadId: string,
    duration: number,
    width: number,
    height: number
  ): Promise<IgUploadVideoResult> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      console.log(`[IG API] Uploading video: upload_id=${uploadId}, size=${videoBytes.length}, duration=${duration}ms`);

      const ruploadParams = this.buildRuploadParams(uploadId, duration, width, height);

      // GET 查询当前进度
      const offset = await this.queryUploadOffset(uploadId);
      console.log(`[IG API] Video pre-check offset=${offset}`);

      // POST 上传（一次性）
      const arrayBuffer = videoBytes.buffer.slice(
        videoBytes.byteOffset,
        videoBytes.byteOffset + videoBytes.byteLength
      ) as ArrayBuffer;

      const uploadHeaders: Record<string, string> = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'offset': String(offset),
        'x-asbd-id': '359341',
        'x-entity-length': videoBytes.length.toString(),
        'x-entity-name': `fb_uploader_${uploadId}`,
        'x-ig-app-id': X_IG_APP_ID,
        'x-ig-max-touch-points': '0',
        'x-instagram-ajax': '1041354847',
        'x-instagram-rupload-params': ruploadParams,
      };

      const response = await fetch(
        `https://i.instagram.com/rupload_igvideo/fb_uploader_${uploadId}`,
        { method: 'POST', headers: uploadHeaders, body: arrayBuffer, credentials: 'include' }
      );

      const data = await response.json();

      if (!data.media_id && data.debug_info?.type === 'PartialRequestError') {
        throw new Error('Video upload incomplete (PartialRequestError). Use uploadVideoChunked for large files.');
      }

      console.log(`[IG API] Video uploaded: upload_id=${uploadId}`);
      return { upload_id: uploadId, status: 'ok' };
    } catch (error) {
      console.error('[IG API] Upload video error:', error);
      throw error;
    }
  }

  /**
   * 分片上传视频（大文件，抓包验证的真实流程）
   *
   * 流程：GET offset → POST chunk → 循环直到 response 含 media_id
   *
   * @param getChunk - 回调函数，按 offset 和 size 返回该段的 Uint8Array
   * @param totalBytes - 视频总大小
   * @param uploadId - 上传 ID
   * @param duration - 视频时长（毫秒）
   * @param width - 视频宽度
   * @param height - 视频高度
   * @param onProgress - 进度回调（0~1）
   * @returns upload_id
   */
  public async uploadVideoChunked(
    getChunk: (offset: number, size: number) => Promise<Uint8Array>,
    totalBytes: number,
    uploadId: string,
    duration: number,
    width: number,
    height: number,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB，与抓包一致
    const ruploadParams = this.buildRuploadParams(uploadId, duration, width, height);

    console.log(`[IG API] uploadVideoChunked start upload_id=${uploadId} totalBytes=${totalBytes}`);

    let offset = await this.queryUploadOffset(uploadId);
    console.log(`[IG API] Starting from offset=${offset}`);

    while (offset < totalBytes) {
      const chunkSize = Math.min(CHUNK_SIZE, totalBytes - offset);
      const chunk = await getChunk(offset, chunkSize);

      const uploadHeaders: Record<string, string> = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'offset': String(offset),
        'x-asbd-id': '359341',
        'x-entity-length': String(totalBytes),
        'x-entity-name': `fb_uploader_${uploadId}`,
        'x-ig-app-id': X_IG_APP_ID,
        'x-ig-max-touch-points': '0',
        'x-instagram-ajax': '1041354847',
        'x-instagram-rupload-params': ruploadParams,
      };

      console.log(`[IG API] POST chunk offset=${offset} size=${chunk.length}`);

      const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;
      const response = await fetch(
        `https://i.instagram.com/rupload_igvideo/fb_uploader_${uploadId}`,
        { method: 'POST', headers: uploadHeaders, body: arrayBuffer, credentials: 'include' }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.media_id) {
        // 最后一片上传完成
        console.log(`[IG API] Video upload complete media_id=${data.media_id}`);
        onProgress?.(1);
        return uploadId;
      }

      if (data.debug_info?.type !== 'PartialRequestError') {
        throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
      }

      // 上传成功但还有更多分片，查询服务端确认 offset
      offset = await this.queryUploadOffset(uploadId);
      console.log(`[IG API] Next offset=${offset}`);
      onProgress?.(offset / totalBytes);
    }

    console.log(`[IG API] uploadVideoChunked loop ended upload_id=${uploadId}`);
    return uploadId;
  }

  private buildRuploadParams(uploadId: string, duration: number, width: number, height: number): string {
    return JSON.stringify({
      'client-passthrough': '1',
      'is_clips_video': '1',
      'is_sidecar': '0',
      'media_type': 2,
      'for_album': false,
      'video_format': '',
      'upload_id': uploadId,
      'upload_media_duration_ms': duration,
      'upload_media_height': height,
      'upload_media_width': width,
      'video_transform': null,
      'video_edit_params': {
        'crop_height': height,
        'crop_width': width,
        'crop_x1': 0,
        'crop_y1': 0,
        'mute': false,
        'trim_end': duration / 1000,
        'trim_start': 0,
      },
    });
  }

  private async queryUploadOffset(uploadId: string): Promise<number> {
    const response = await fetch(
      `https://i.instagram.com/rupload_igvideo/fb_uploader_${uploadId}`,
      {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'x-asbd-id': '359341',
          'x-ig-app-id': X_IG_APP_ID,
          'x-ig-max-touch-points': '0',
        },
        credentials: 'include',
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`queryUploadOffset failed: HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    return Number(data.offset ?? 0);
  }

  /**
   * 上传视频封面图片
   * API: POST https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}
   *
   * @param uploadId - 上传 ID（与视频相同）
   * @param thumbnailBytes - 封面图片二进制数据
   * @param width - 视频宽度
   * @param height - 视频高度
   * @returns 上传结果
   */
  public async uploadVideoThumbnail(
    uploadId: string,
    thumbnailBytes: Uint8Array,
    width: number,
    height: number
  ): Promise<{ status: string }> {
    try {
      console.log(`[IG API] Uploading video thumbnail: upload_id=${uploadId}, size=${thumbnailBytes.length}`);

      const uploadHeaders: Record<string, string> = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'image/jpeg',
        'offset': '0',
        'x-asbd-id': '359341',
        'x-entity-length': thumbnailBytes.length.toString(),
        'x-entity-name': `fb_uploader_${uploadId}`,
        'x-entity-type': 'image/jpeg',
        'x-ig-app-id': X_IG_APP_ID,
        'x-ig-max-touch-points': '0',
        'x-instagram-ajax': '1041007766',
        'x-instagram-rupload-params': JSON.stringify({
          'media_type': 2,  // 注意：仍然是视频类型
          'upload_id': uploadId,
          'upload_media_height': height,
          'upload_media_width': width,
        }),
      };

      console.log(`[IG API] POST https://i.instagram.com/rupload_igphoto/fb_uploader_${uploadId}`);

      // 将 Uint8Array 转换为 ArrayBuffer
      const arrayBuffer = thumbnailBytes.buffer.slice(
        thumbnailBytes.byteOffset,
        thumbnailBytes.byteOffset + thumbnailBytes.byteLength
      ) as ArrayBuffer;

      const response = await fetch(
        `https://i.instagram.com/rupload_igphoto/fb_uploader_${uploadId}`,
        {
          method: 'POST',
          headers: uploadHeaders,
          body: arrayBuffer,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error('Failed to upload video thumbnail');
      }

      console.log(`[IG API] Video thumbnail uploaded: status=${data.status}`);
      return data;
    } catch (error) {
      console.error('[IG API] Upload video thumbnail error:', error);
      throw error;
    }
  }

  /**
   * 生成默认视频封面图片
   * 创建一个纯色的 JPEG 图片
   *
   * @param width - 图片宽度
   * @param height - 图片高度
   * @returns JPEG 图片的二进制数据
   */
  private generateDefaultThumbnail(width: number, height: number): Uint8Array {
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // 填充渐变背景
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 添加播放图标
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    const centerX = width / 2;
    const centerY = height / 2;
    const playSize = Math.min(width, height) / 6;

    // 绘制三角形播放图标
    ctx.moveTo(centerX - playSize / 2, centerY - playSize);
    ctx.lineTo(centerX + playSize, centerY);
    ctx.lineTo(centerX - playSize / 2, centerY + playSize);
    ctx.closePath();
    ctx.fill();

    // 转换为 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1];

    // 解码 base64
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    console.log(`[IG API] Generated default thumbnail: ${width}x${height}, size=${bytes.length}`);
    return bytes;
  }

  /**
   * 生成默认视频封面图片（公开方法，供 content script 使用）
   */
  public generateDefaultThumbnailPublic(width: number, height: number): Uint8Array {
    return this.generateDefaultThumbnail(width, height);
  }

  /**
   * 配置视频（发布）
   * API: POST /api/v1/media/configure_to_clips/
   *
   * @param params - 视频配置参数
   * @returns 媒体对象
   */
  public async configureVideo(params: IgConfigureVideoParams): Promise<IgPostMediaResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      // 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 获取 CSRF token
      const csrfToken = await getCsrfToken();

      // 构建表单数据
      const formData = new URLSearchParams();
      formData.append('archive_only', 'false');
      formData.append('caption', params.caption);
      formData.append('clips_share_preview_to_feed', '1');
      formData.append('disable_comments', params.disableComments ? '1' : '0');
      formData.append('disable_oa_reuse', 'false');
      formData.append('fb_dtsg', fbDtsg);
      formData.append('igtv_share_preview_to_feed', '1');
      formData.append('is_meta_only_post', '0');
      formData.append('is_unified_video', '1');
      formData.append('jazoest', '22673');
      formData.append('like_and_view_counts_disabled', '0');
      formData.append('media_share_flow', 'creation_flow');
      formData.append('share_to_facebook', '');
      formData.append('share_to_fb_destination_type', 'USER');
      formData.append('source_type', 'library');
      formData.append('upload_id', params.uploadId);
      formData.append('video_subtitles_enabled', '0');

      console.log(`[IG API] POST /api/v1/media/configure_to_clips/ upload_id=${params.uploadId}`);

      const headers: Record<string, string> = {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrfToken,
        'X-IG-App-ID': X_IG_APP_ID,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/',
        'x-asbd-id': '359341',
        'x-ig-max-touch-points': '0',
        'x-ig-www-claim': 'hmac.AR0WfvuQCL7DQedh15YwL5r8w1EnVqMNDPpLTaXT-bsO97RD',
        'x-instagram-ajax': '1041007766',
      };

      const response = await fetch(
        `${this.baseUrl}/api/v1/media/configure_to_clips/`,
        {
          method: 'POST',
          headers,
          body: formData.toString(),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 检查转码状态
      if (data.status === 'fail' && data.message === 'Transcode not finished yet.') {
        console.log('[IG API] Video transcode not finished, waiting...');
        // 等待 3 秒后重试
        await new Promise(resolve => setTimeout(resolve, 3000));
        return this.configureVideo(params); // 递归重试
      }

      if (!data.media) {
        throw new Error('Failed to configure video');
      }

      console.log(`[IG API] Video configured: id=${data.media.id}`);
      return data;
    } catch (error) {
      console.error('[IG API] Configure video error:', error);
      throw error;
    }
  }

  /**
   * 配置媒体（发布）
   * API: POST /api/v1/media/configure/
   *
   * @param uploadId - 上传 ID
   * @param caption - 文案
   * @param options - 其他选项
   * @returns 媒体对象
   */
  public async configureMedia(
    uploadId: string,
    caption: string,
    options: {
      disableComments?: boolean;
      shareToThreads?: boolean;
      location?: IgPostMediaParams['location'];
    } = {}
  ): Promise<IgPostMediaResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      // 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 获取 CSRF token
      const csrfToken = await getCsrfToken();

      // 构建表单数据
      const formData = new URLSearchParams();
      formData.append('archive_only', 'false');
      formData.append('caption', caption);
      formData.append('clips_share_preview_to_feed', '1');
      formData.append('disable_comments', options.disableComments ? '1' : '0');
      formData.append('disable_oa_reuse', 'false');
      formData.append('fb_dtsg', fbDtsg);
      formData.append('igtv_share_preview_to_feed', '1');
      formData.append('is_meta_only_post', '0');
      formData.append('is_unified_video', '1');
      formData.append('jazoest', '22673');
      formData.append('like_and_view_counts_disabled', '0');
      formData.append('media_share_flow', 'creation_flow');
      formData.append('share_to_facebook', '');
      formData.append('share_to_fb_destination_type', 'USER');

      // Threads 分享参数
      if (options.shareToThreads !== false) {
        formData.append('share_to_threads', 'true');
        formData.append('share_to_threads_destination_id', '17841427211664125');
        formData.append('share_to_threads_validation_bypass', '["AUTO_CROSSPOST_SETTING"]');
      } else {
        formData.append('share_to_threads', 'false');
      }

      formData.append('source_type', 'library');
      formData.append('upload_id', uploadId);
      formData.append('video_subtitles_enabled', '0');

      // 添加位置信息（如果有）
      if (options.location) {
        formData.append('location', JSON.stringify({
          name: options.location.name,
          lat: options.location.lat,
          lng: options.location.lng,
          external_source: options.location.externalId ? 'facebook_places' : '',
          external_id: options.location.externalId || '',
        }));
      }

      console.log(`[IG API] POST /api/v1/media/configure/ upload_id=${uploadId}`);

      const response = await fetch(
        `${this.baseUrl}/api/v1/media/configure/`,
        {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrfToken,
            'X-IG-App-ID': X_IG_APP_ID,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.instagram.com/',
          },
          body: formData.toString(),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.media) {
        throw new Error('Failed to configure media');
      }

      console.log(`[IG API] Media configured: id=${data.media.id}`);
      return data;
    } catch (error) {
      console.error('[IG API] Configure media error:', error);
      throw error;
    }
  }

  /**
   * 配置轮播图（多图发布）
   * API: POST /api/v1/media/configure_sidecar/
   *
   * @param uploadIds - 上传 ID 列表
   * @param caption - 文案
   * @param options - 其他选项
   * @returns 媒体对象
   */
  public async configureSidecar(
    uploadIds: string[],
    caption: string,
    options: {
      disableComments?: boolean;
      shareToThreads?: boolean;
      location?: IgPostMediaParams['location'];
    } = {}
  ): Promise<IgPostMediaResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      // 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 获取 CSRF token
      const csrfToken = await getCsrfToken();

      // 生成 client_sidecar_id
      const clientSidecarId = Date.now().toString();

      // 构建 JSON body（与单图不同，轮播图使用 JSON）
      const body: Record<string, any> = {
        archive_only: false,
        caption,
        children_metadata: uploadIds.map((id) => ({ upload_id: id })),
        client_sidecar_id: clientSidecarId,
        disable_comments: options.disableComments ? '1' : '0',
        is_meta_only_post: false,
        is_open_to_public_submission: false,
        like_and_view_counts_disabled: 0,
        media_share_flow: 'creation_flow',
        share_to_facebook: '',
        share_to_fb_destination_type: 'USER',
        source_type: 'library',
        jazoest: '22673',
        fb_dtsg: fbDtsg,
      };

      // Threads 分享参数
      if (options.shareToThreads !== false) {
        body.share_to_threads = 'true';
        body.share_to_threads_destination_id = '17841427211664125';
        body.share_to_threads_validation_bypass = '["AUTO_CROSSPOST_SETTING"]';
      } else {
        body.share_to_threads = 'false';
      }

      // 添加位置信息（如果有）
      if (options.location) {
        body.location = JSON.stringify({
          name: options.location.name,
          lat: options.location.lat,
          lng: options.location.lng,
          external_source: options.location.externalId ? 'facebook_places' : '',
          external_id: options.location.externalId || '',
        });
      }

      console.log(`[IG API] POST /api/v1/media/configure_sidecar/ upload_ids=[${uploadIds.join(', ')}]`);

      const response = await fetch(
        `${this.baseUrl}/api/v1/media/configure_sidecar/`,
        {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            'X-IG-App-ID': X_IG_APP_ID,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.instagram.com/',
          },
          body: JSON.stringify(body),
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.media) {
        throw new Error('Failed to configure sidecar');
      }

      console.log(`[IG API] Sidecar configured: id=${data.media.id}, carousel_media_count=${data.media.carousel_media_count || uploadIds.length}`);
      return data;
    } catch (error) {
      console.error('[IG API] Configure sidecar error:', error);
      throw error;
    }
  }

  /**
   * 发布媒体（组合上传 + 配置）
   * 支持图片和视频
   *
   * @param params - 发布参数
   * @returns 媒体对象
   */
  public async postMedia(params: IgPostMediaParams): Promise<IgPostMediaResponse> {
    try {
      console.log('[IG API] postMedia called', {
        hasImageBase64: !!params.imageBase64,
        hasImageBytes: !!params.imageBytes,
        hasVideoBytes: !!params.videoBytes,
        caption: params.caption,
      });

      // 判断是视频还是图片
      const isVideo = !!params.videoBytes;

      if (isVideo) {
        // === 视频发布流程 ===
        const videoBytes = params.videoBytes!;
        const mimeType = params.mimeType || 'video/mp4';
        const uploadId = Date.now().toString();

        // 获取视频参数
        const duration = params.videoDuration || 10000; // 默认 10 秒
        const width = params.videoWidth || 720;
        const height = params.videoHeight || 1280;

        // 1. 上传视频
        console.log('[IG API] Step 1: Uploading video...');
        const uploadResult = await this.uploadVideo(
          videoBytes,
          mimeType,
          uploadId,
          duration,
          width,
          height
        );

        if (uploadResult.status !== 'ok') {
          throw new Error('Video upload failed');
        }

        console.log(`[IG API] Video uploaded: upload_id=${uploadResult.upload_id}`);

        // 2. 上传视频封面图片
        console.log('[IG API] Step 2: Uploading video thumbnail...');

        let thumbnailBytes: Uint8Array;

        if (params.thumbnailBytes) {
          // 使用自定义封面图片
          thumbnailBytes = params.thumbnailBytes;
          console.log(`[IG API] Using custom thumbnail: size=${thumbnailBytes.length}`);
        } else if (params.thumbnailBase64) {
          // 解码 base64 封面图片
          const binaryStr = atob(params.thumbnailBase64);
          thumbnailBytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            thumbnailBytes[i] = binaryStr.charCodeAt(i);
          }
          console.log(`[IG API] Using custom thumbnail from base64: size=${thumbnailBytes.length}`);
        } else {
          // 生成默认封面图片
          thumbnailBytes = this.generateDefaultThumbnail(width, height);
          console.log(`[IG API] Using default thumbnail: size=${thumbnailBytes.length}`);
        }

        await this.uploadVideoThumbnail(uploadResult.upload_id, thumbnailBytes, width, height);

        console.log('[IG API] Video thumbnail uploaded');

        // 3. 配置视频（发布）
        console.log('[IG API] Step 3: Configuring video...');
        const mediaResult = await this.configureVideo({
          uploadId: uploadResult.upload_id,
          caption: params.caption,
          duration,
          width,
          height,
          disableComments: params.disableComments,
          shareToThreads: params.shareToThreads,
        });

        console.log(`[IG API] Video posted: id=${mediaResult.media.id}`);
        return mediaResult;

      } else {
        // === 图片发布流程 ===
        // 判断是单图还是多图
        const isMultiImage = Array.isArray(params.imageBytes) && params.imageBytes.length > 1;

        if (isMultiImage) {
          // === 多图（轮播图）发布流程 ===
          const imageList = params.imageBytes as Uint8Array[];
          const mimeType = params.mimeType || 'image/jpeg';

          console.log(`[IG API] Step 1: Uploading ${imageList.length} images...`);

          const uploadIds: string[] = [];
          for (let i = 0; i < imageList.length; i++) {
            console.log(`[IG API] Uploading image ${i + 1}/${imageList.length}...`);
            const uploadResult = await this.uploadImage(imageList[i], mimeType);
            if (uploadResult.status !== 'ok') {
              throw new Error(`Image ${i + 1} upload failed`);
            }
            uploadIds.push(uploadResult.upload_id);
            console.log(`[IG API] Image ${i + 1} uploaded: upload_id=${uploadResult.upload_id}`);
          }

          console.log(`[IG API] All ${uploadIds.length} images uploaded`);

          // 2. 配置轮播图
          console.log('[IG API] Step 2: Configuring sidecar...');
          const mediaResult = await this.configureSidecar(
            uploadIds,
            params.caption,
            {
              disableComments: params.disableComments,
              shareToThreads: params.shareToThreads,
              location: params.location,
            }
          );

          console.log(`[IG API] Carousel posted: id=${mediaResult.media.id}`);
          return mediaResult;

        } else {
          // === 单图发布流程 ===
          let imageBytes: Uint8Array;

          if (params.imageBytes) {
            imageBytes = Array.isArray(params.imageBytes) ? params.imageBytes[0] : params.imageBytes;
          } else if (params.imageBase64) {
            // 解码 base64
            const binaryStr = atob(params.imageBase64);
            imageBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              imageBytes[i] = binaryStr.charCodeAt(i);
            }
          } else {
            throw new Error('Either imageBase64/imageBytes or videoBytes is required');
          }

          const mimeType = params.mimeType || 'image/jpeg';

          // 1. 上传图片
          console.log('[IG API] Step 1: Uploading image...');
          const uploadResult = await this.uploadImage(imageBytes, mimeType);

          if (uploadResult.status !== 'ok') {
            throw new Error('Image upload failed');
          }

          console.log(`[IG API] Image uploaded: upload_id=${uploadResult.upload_id}`);

          // 2. 配置媒体（发布）
          console.log('[IG API] Step 2: Configuring media...');
          const mediaResult = await this.configureMedia(
            uploadResult.upload_id,
            params.caption,
            {
              disableComments: params.disableComments,
              shareToThreads: params.shareToThreads,
              location: params.location,
            }
          );

          console.log(`[IG API] Media posted: id=${mediaResult.media.id}`);

          return mediaResult;
        }
      }
    } catch (error) {
      console.error('[IG API] Post media error:', error);
      throw error;
    }
  }

  /**
   * 删除媒体
   * API: POST /api/v1/web/create/{media_id}/delete/
   *
   * @param mediaId - 媒体 ID
   * @returns 删除结果
   */
  public async deleteMedia(mediaId: string): Promise<IgDeleteMediaResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    try {
      const headers = await this.buildHeaders('POST');
      headers.set('x-asbd-id', '359341');
      headers.set('x-ig-www-claim', 'hmac.AR0WfvuQCL7DQedh15YwL5r8w1EnVqMNDPpLTaXT-bsO97RD');
      headers.set('x-instagram-ajax', '1041007766');
      headers.set('x-ig-max-touch-points', '0');
      headers.set('x-requested-with', 'XMLHttpRequest');

      console.log(`[IG API] POST /api/v1/web/create/${mediaId}/delete/`);

      const response = await fetch(
        `${this.baseUrl}/api/v1/web/create/${mediaId}/delete/`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.did_delete) {
        throw new Error('Failed to delete media');
      }

      console.log(`[IG API] Media deleted: ${mediaId}`);
      return data;
    } catch (error) {
      console.error('[IG API] Delete media error:', error);
      throw error;
    }
  }

  /**
   * 获取用户媒体列表
   * 使用 GraphQL API: POST /graphql/query
   * 查询: PolarisProfilePostsQuery
   *
   * @param params - userId/username, count, after
   * @returns 媒体列表和分页信息
   */
  public async getUserMedia(params: IgGetUserMediaParams): Promise<IgGetUserMediaResponse> {
    try {
      // 1. 确定用户名
      let username = params.username;

      if (!username && params.userId) {
        // 如果只有 userId，需要先获取用户信息来得到 username
        const userInfo = await this.getUserInfo(params.userId);
        username = userInfo.username;
      }

      if (!username) {
        throw new Error('Either userId or username is required');
      }

      // 2. 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 3. 构建 GraphQL 查询参数
      // 翻页时 Instagram 会切换到不同的 query：
      // - 第 1 页（无 after）: PolarisProfilePostsQuery, doc_id=27378030181834840
      // - 第 2 页+（有 after）: PolarisProfilePostsTabContentQuery_connection, doc_id=27839684308962379
      //   此时 `after` 必须放在 variables 顶层（与 first/last/before 同级），
      //   `data` 对象保留 count 等参数。
      // 参考：5.log 浏览器真实翻页请求
      const hasAfter = !!params.after;
      const queryName = hasAfter
        ? 'PolarisProfilePostsTabContentQuery_connection'
        : 'PolarisProfilePostsQuery';
      const docId = hasAfter
        ? '27839684308962379'
        : '27378030181834840';

      let variables: any;
      if (hasAfter) {
        // 第 2 页+: after 在顶层，含 first/last/before
        // 必须包含 PolarisReelsRecoDebugOverlayEnabledrelayprovider，否则 Instagram
        // 返回 "execution error, CRITICAL"（5.log 真实请求验证）
        variables = {
          after: params.after,
          before: null,
          data: {
            count: params.count || 12,
            include_reel_media_seen_timestamp: true,
            include_relationship_info: true,
            latest_besties_reel_media: true,
            latest_reel_media: true,
          },
          first: params.count || 12,
          last: null,
          username: username,
          __relay_internal__pv__PolarisImmersiveFeedChainingEnabledrelayprovider: true,
          __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: true,
          __relay_internal__pv__PolarisAIGMAccountLabelEnabledrelayprovider: false,
          __relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false,
        };
      } else {
        // 第 1 页: 无 after
        variables = {
          data: {
            count: params.count || 12,
            include_reel_media_seen_timestamp: true,
            include_relationship_info: true,
            latest_besties_reel_media: true,
            latest_reel_media: true,
          },
          username: username,
          __relay_internal__pv__PolarisImmersiveFeedChainingEnabledrelayprovider: true,
          __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: true,
          __relay_internal__pv__PolarisAIGMAccountLabelEnabledrelayprovider: false,
          __relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false,
        };
      }

      const body = buildGraphQLBody(
        queryName,
        docId,
        variables,
        fbDtsg
      );

      console.log(`[IG API] Getting user media: username=${username}, count=${params.count || 12}${hasAfter ? ', after=' + params.after : ''}`);

      // 4. 发送 GraphQL 请求（浏览器实际用 /graphql/query，不是 /api/graphql）
      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', queryName);
      headers.set('x-root-field-name', 'xdt_api__v1__feed__user_timeline_graphql_connection');

      const response = await fetch(`${this.baseUrl}/graphql/query`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 5. 解析响应
      const connection = data?.data?.xdt_api__v1__feed__user_timeline_graphql_connection;

      if (!connection) {
        console.error('[IG API] Invalid response structure:', JSON.stringify(data, null, 2));
        throw new Error('Invalid response structure');
      }

      const items: IgGetUserMediaResponse['items'] = connection.edges.map((edge: any) => {
        const node = edge.node;

        // 提取图片 URL
        const imageCandidates = node.image_versions2?.candidates || [];
        const imageUrl = imageCandidates[0]?.url || '';

        // 提取视频 URL（如果有）
        const videoCandidates = node.video_versions || [];
        const videoUrl = videoCandidates[0]?.url || undefined;

        return {
          id: node.id,
          pk: node.pk,
          code: node.code,
          mediaType: node.media_type,
          imageUrl,
          videoUrl,
          caption: node.caption?.text,
          takenAt: node.taken_at,
          likeCount: node.like_count || 0,
          commentCount: node.comment_count || 0,
          hasLiked: node.has_liked || false,
          user: {
            userId: node.user.pk,
            username: node.user.username,
            fullName: node.user.full_name,
            isPrivate: node.user.is_private,
            isVerified: node.user.is_verified,
          },
        };
      });

      const result: IgGetUserMediaResponse = {
        items,
        pageInfo: {
          hasNextPage: connection.page_info?.has_next_page || false,
          endCursor: connection.page_info?.end_cursor || null,
        },
      };

      console.log(`[IG API] Got ${items.length} media items, hasNext=${result.pageInfo.hasNextPage}`);
      return result;
    } catch (error) {
      console.error('[IG API] Get user media error:', error);
      throw error;
    }
  }

  // ============ 搜索 API ============

  /**
   * 搜索 Instagram 内容（用户、标签、地点等）
   * API: POST /api/graphql
   * Query: PolarisKeywordSearchExplorePageRelayQuery
   *
   * @param params - 搜索关键词和会话 ID
   * @returns 搜索结果
   */
  public async search(params: IgSearchParams): Promise<IgSearchResponse> {
    try {
      // 1. 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 2. 生成会话 ID（如果没有提供）
      const searchSessionId = params.searchSessionId || this.generateUUID();
      const serpSessionId = params.serpSessionId || this.generateUUID();

      // 3. 构建 GraphQL 查询参数（支持分页）
      const variables: any = {
        query: params.query,
        search_session_id: searchSessionId,
        serp_session_id: serpSessionId,
      };

      // 添加分页参数
      if (params.after) {
        variables.after = params.after;
      }
      if (params.before) {
        variables.before = params.before;
      }
      if (params.first) {
        variables.first = params.first;
      }
      if (params.last) {
        variables.last = params.last;
      }

      const body = buildGraphQLBody(
        'PolarisKeywordSearchExplorePageRelayQuery',
        '27436028659365449',
        variables,
        fbDtsg
      );

      console.log(`[IG API] Searching: query="${params.query}"${params.after ? ', after=' + params.after : ''}`);

      // 4. 发送 GraphQL 请求
      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', 'PolarisKeywordSearchExplorePageRelayQuery');

      const response = await fetch(`${this.baseUrl}/api/graphql`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 5. 解析响应（包含分页信息）
      const { results, pageInfo } = this.parseSearchResultsWithPagination(data);

      console.log(`[IG API] Search completed: ${results.length} results, hasMore=${pageInfo.hasNextPage}`);
      return {
        results,
        hasMore: pageInfo.hasNextPage,
        query: params.query,
        endCursor: pageInfo.endCursor,
        startCursor: pageInfo.startCursor,
      };
    } catch (error) {
      console.error('[IG API] Search error:', error);
      throw error;
    }
  }

  /**
   * 解析搜索结果（包含分页信息）
   */
  private parseSearchResultsWithPagination(data: any): { results: IgSearchResult[]; pageInfo: any } {
    const results: IgSearchResult[] = [];
    const pageInfo = {
      hasNextPage: false,
      endCursor: null as string | null,
      startCursor: null as string | null,
    };

    try {
      // 实际响应路径：xdt_fbsearch__top_serp_graphql
      const connection = data?.data?.xdt_fbsearch__top_serp_graphql;
      const edges = connection?.edges || [];

      // 提取分页信息
      if (connection?.page_info) {
        console.log('[IG API] Raw page_info:', JSON.stringify(connection.page_info, null, 2));
        pageInfo.hasNextPage = connection.page_info.has_next_page || false;
        pageInfo.endCursor = connection.page_info.end_cursor || null;
        pageInfo.startCursor = connection.page_info.start_cursor || null;
        console.log('[IG API] Extracted pagination:', { hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor, startCursor: pageInfo.startCursor });
      } else {
        console.log('[IG API] No page_info found in connection');
      }

      edges.forEach((edge: any, index: number) => {
        const node = edge.node;
        const typename = node.__typename;

        // 处理媒体网格单元（最常见）
        if (typename === 'XDTTopSerpMediaGridUnit') {
          const items = node.items || [];
          items.forEach((item: any, itemIndex: number) => {
            if (item.__typename === 'XDTMediaDict') {
              // 这是一个媒体帖子
              const media = item;
              const user = media.user || {};

              results.push({
                position: index * 100 + itemIndex, // 保持唯一性
                media: {
                  pk: media.pk,
                  id: media.id,
                  code: media.code,
                  media_type: media.media_type,
                  image_versions: media.image_versions2?.candidates || [],
                  original_width: media.original_width,
                  original_height: media.original_height,
                  taken_at: media.taken_at,
                  like_count: media.like_count || 0,
                  comment_count: media.comment_count || 0,
                  play_count: media.play_count,
                  caption: media.caption?.text,
                  user: {
                    pk: user.pk,
                    username: user.username,
                    full_name: user.full_name,
                    is_private: user.is_private,
                    is_verified: user.is_verified,
                    profile_pic_url: user.profile_pic_url,
                  },
                },
              });
            }
          });
        }

        // 用户结果（如果存在）
        if (node.user) {
          results.push({
            position: index,
            user: {
              pk: node.user.pk || node.user.id,
              username: node.user.username,
              full_name: node.user.full_name,
              is_private: node.user.is_private,
              is_verified: node.user.is_verified,
              profile_pic_url: node.user.profile_pic_url,
              follower_count: node.user.follower_count || 0,
              following_count: node.user.following_count || 0,
              media_count: node.user.media_count || 0,
              biography: node.user.biography,
              is_business: node.user.is_business || false,
            },
          });
        }

        // 标签结果（如果存在）
        if (node.hashtag) {
          results.push({
            position: index,
            hashtag: {
              id: node.hashtag.id,
              name: node.hashtag.name,
              media_count: node.hashtag.media_count || 0,
            },
          });
        }

        // 地点结果（如果存在）
        if (node.place) {
          results.push({
            position: index,
            place: {
              location: {
                pk: node.place.location.pk,
                name: node.place.location.name,
                lat: node.place.location.lat,
                lng: node.place.location.lng,
              },
            },
          });
        }
      });
    } catch (error) {
      console.error('[IG API] Parse search results error:', error);
    }

    return { results, pageInfo };
  }

  /**
   * 解析搜索结果（旧方法，保留向后兼容）
   */
  private parseSearchResults(data: any): IgSearchResult[] {
    return this.parseSearchResultsWithPagination(data).results;
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============ 通知 API ============

  /**
   * 获取通知列表
   * API: POST /graphql/query
   * Query: PolarisActivityFeedStoriesViewQuery
   *
   * @param params - 分页参数（可选）
   * @returns 通知列表
   */
  public async getNotifications(params?: IgGetNotificationsParams): Promise<IgGetNotificationsResponse> {
    try {
      // 1. 获取 fb_dtsg token
      const fbDtsg = await getFbDtsgWithCache();
      if (!fbDtsg) {
        throw new Error('fb_dtsg token not found. Please refresh Instagram page.');
      }

      // 2. 构建 GraphQL 查询参数
      const variables = {
        inbox_request_data: {},
        pending_request_data: {},
      };

      const body = buildGraphQLBody(
        GRAPHQL_QUERIES.ACTIVITY_FEED.queryName,
        GRAPHQL_QUERIES.ACTIVITY_FEED.docId,
        variables,
        fbDtsg
      );

      console.log('[IG API] Getting notifications...');

      // 3. 构建 Headers
      const headers = await this.buildHeaders('POST');
      headers.set('x-fb-friendly-name', GRAPHQL_QUERIES.ACTIVITY_FEED.queryName);
      headers.set('x-root-field-name', 'xdt_activity_inbox');

      // 4. 发送请求
      const response = await fetch(`${this.baseUrl}/graphql/query`, {
        method: 'POST',
        headers,
        body,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // 5. 解析响应
      const activityInbox = data.data?.xdt_activity_inbox;
      if (!activityInbox) {
        throw new Error('Invalid response: missing xdt_activity_inbox');
      }

      // 解析旧通知
      const oldStories = (activityInbox.old_stories || []).map((story: any) => this.parseNotificationStory(story));

      // 解析新通知
      const newStories = (activityInbox.new_stories || []).map((story: any) => this.parseNotificationStory(story));

      // 合并所有通知
      const notifications = [...newStories, ...oldStories];

      const result: IgGetNotificationsResponse = {
        notifications,
        newStories,
        oldStories,
        hasMore: false, // Instagram 通知 API 不支持分页
        partition: activityInbox.partition,
      };

      console.log(`[IG API] Got ${notifications.length} notifications (${newStories.length} new, ${oldStories.length} old)`);
      return result;
    } catch (error) {
      console.error('[IG API] Get notifications error:', error);
      throw error;
    }
  }

  /**
   * 解析通知项
   */
  private parseNotificationStory(story: any): IgNotification {
    const args = story.args || {};

    // 解析用户信息
    let user: IgNotification['user'];
    if (args.profile_id && args.profile_name) {
      user = {
        id: args.profile_id,
        username: args.profile_name,
        fullName: args.profile_name,
        profilePicUrl: args.profile_image || '',
      };
    }

    // 解析媒体信息
    let media: IgNotification['media'];
    if (args.media) {
      media = {
        id: args.media.id,
        shortcode: args.media.shortcode,
        imageUrl: args.media.image?.url || '',
      };
    }

    // 解析通知类型
    const typeCode = story.type || 0;
    const notificationType = this.getNotificationType(typeCode);

    return {
      id: story.pk,
      type: notificationType,
      typeCode,
      timestamp: args.timestamp ? Math.floor(args.timestamp) : 0,
      text: args.text || '',
      user,
      media,
      links: args.links,
      destination: args.destination,
      isNew: false, // 由 newStories/oldStories 区分
    };
  }

  /**
   * 根据 type code 获取通知类型
   *
   * Instagram 通知类型代码：
   * - 3: 关注通知 (started following you)
   * - 20: Threads 回复
   * - 18: 系统通知
   * - 13: 登录确认
   * - 101: 关注请求
   * - 其他: 待确认
   */
  private getNotificationType(typeCode: number): IgNotificationType {
    switch (typeCode) {
      case 3:
        return 'follow';
      case 20:
        return 'reply';
      case 18:
        return 'other';
      case 13:
        return 'other';
      case 101:
        return 'request';
      default:
        return 'other';
    }
  }

  // ============ 关注/粉丝 API ============

  /**
   * 获取粉丝列表
   * API: GET /api/v1/friendships/{user_id}/followers/
   *
   * @param params - userId 必需，count 和 maxId 可选
   * @returns 粉丝列表和分页信息
   */
  public async getFollowers(params: IgGetFollowersParams): Promise<IgGetFollowersResponse> {
    try {
      const { userId, count = 12, maxId, searchSurface = 'follow_list_page' } = params;

      // 构建查询参数
      const queryParams = new URLSearchParams({
        count: count.toString(),
        search_surface: searchSurface,
      });

      if (maxId) {
        queryParams.set('max_id', maxId);
      }

      const response = await this.request<any>(
        `/api/v1/friendships/${userId}/followers/?${queryParams.toString()}`,
        'GET'
      );

      // 解析用户列表
      const users = (response.users || []).map((u: any) => this.parseFollowUser(u));

      return {
        users,
        hasMore: response.has_more || false,
        nextMaxId: response.next_max_id,
        pageSize: response.page_size || count,
      };
    } catch (error) {
      console.error('[IG API] Get followers error:', error);
      throw error;
    }
  }

  /**
   * 获取关注列表
   * API: GET /api/v1/friendships/{user_id}/following/
   *
   * @param params - userId 必需，count 和 maxId 可选
   * @returns 关注列表和分页信息
   */
  public async getFollowing(params: IgGetFollowingParams): Promise<IgGetFollowingResponse> {
    try {
      const { userId, count = 12, maxId } = params;

      // 构建查询参数
      const queryParams = new URLSearchParams({
        count: count.toString(),
      });

      if (maxId) {
        queryParams.set('max_id', maxId);
      }

      const response = await this.request<any>(
        `/api/v1/friendships/${userId}/following/?${queryParams.toString()}`,
        'GET'
      );

      // 解析用户列表
      const users = (response.users || []).map((u: any) => this.parseFollowUser(u));

      return {
        users,
        hasMore: response.has_more || false,
        nextMaxId: response.next_max_id,
        pageSize: response.page_size || count,
      };
    } catch (error) {
      console.error('[IG API] Get following error:', error);
      throw error;
    }
  }

  /**
   * 解析 REST API 用户数据为 IgFollowUser 格式
   * 用于 followers/following API 返回的用户数据
   */
  private parseFollowUser(apiUser: any): IgFollowUser {
    return {
      pk: apiUser.pk || apiUser.id || '',
      username: apiUser.username || '',
      fullName: apiUser.full_name || '',
      isPrivate: apiUser.is_private || false,
      isVerified: apiUser.is_verified || false,
      profilePicUrl: apiUser.profile_pic_url,
      profilePicId: apiUser.profile_pic_id,
      isFavorite: apiUser.is_favorite || false,
      hasAnonymousProfilePicture: apiUser.has_anonymous_profile_picture || false,
      latestReelMedia: apiUser.latest_reel_media,
      accountBadges: apiUser.account_badges || [],
    };
  }

  // ============ 工具方法 ============

  /**
   * 检查登录状态
   */
  public async checkLogin(): Promise<boolean> {
    return await isLoggedIn();
  }

  /**
   * 测试 API 连接
   */
  public async testConnection(): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const user = await this.getSelfInfo();
      return {
        success: true,
        userId: user.pk,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 导出单例
export const igApi = new IgApiClient();

// 导出便捷函数
export const getSelfInfo = () => igApi.getSelfInfo();
export const getUserInfo = (userId: string) => igApi.getUserInfo(userId);
export const getMediaInfo = (shortcode: string) => igApi.getMediaInfo(shortcode);
export const likeMedia = (params: IgLikeParams) => igApi.likeMedia(params);
export const unlikeMedia = (mediaId: string) => igApi.unlikeMedia(mediaId);
export const followUser = (params: IgFollowParams) => igApi.followUser(params);
export const unfollowUser = (userId: string) => igApi.unfollowUser(userId);
export const postComment = (params: IgCommentParams) => igApi.postComment(params);