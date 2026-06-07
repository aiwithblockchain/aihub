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
  buildGraphQLBody,
  parseSearchResponse,
  parseFeedResponse,
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
  IgApiResponse,
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
   * 使用 REST API: GET /api/v1/users/{user_id}/info/
   */
  public async getSelfInfo(): Promise<IgUser> {
    // 从 cookie 获取当前用户 ID
    const cookies = await getRequiredCookies();
    const userId = cookies.ds_user_id;
    if (!userId) {
      throw new Error('Not logged in: ds_user_id not found');
    }

    const response = await this.request<IgUserInfoResponse>(
      `/api/v1/users/${userId}/info/`,
      'GET'
    );

    return this.parseUser(response.user);
  }

  /**
   * 获取用户信息
   * API: GET /api/v1/users/{user_id}/info/
   */
  public async getUserInfo(userId: string): Promise<IgUser> {
    const response = await this.request<IgUserInfoResponse>(
      `/api/v1/users/${userId}/info/`,
      'GET'
    );
    return this.parseUser(response.user);
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