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
import type {
  IgCurrentUser,
  IgCurrentUserResponse,
  IgUser,
  IgUserInfoResponse,
  IgMedia,
  IgLikeParams,
  IgLikeResponse,
  IgFollowParams,
  IgFollowResponse,
  IgCommentParams,
  IgCommentResponse,
  IgApiResponse,
} from './types';

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
      'User-Agent': navigator.userAgent,
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
   * API: POST /graphql/query
   */
  public async getSelfInfo(): Promise<IgUser> {
    const query = {
      fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'PolarisViewerInfoQuery',
      variables: JSON.stringify({}),
      server_timestamps: true,
      doc_id: '4608152745944498',
    };

    const response = await this.request<any>(
      '/graphql/query',
      'POST',
      query,
      true  // skipSignature - GraphQL 查询不需要签名
    );

    // 解析 GraphQL 响应
    const user = response.data?.viewer;
    if (!user) {
      throw new Error('Failed to get user info from GraphQL response');
    }

    return {
      pk: user.id || user.pk,
      username: user.username,
      full_name: user.full_name,
      biography: user.biography,
      follower_count: user.follower_count,
      following_count: user.following_count,
      media_count: user.media_count,
      is_private: user.is_private,
      is_verified: user.is_verified,
      profile_pic_url: user.profile_pic_url,
      is_business: user.is_business || false,
    };
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
    return response.user;
  }

  /**
   * 通过用户名获取用户 ID
   * API: GET /api/v1/users/search/?q={username}
   */
  public async searchUserId(username: string): Promise<string | null> {
    const response = await this.request<any>(
      `/api/v1/users/search/?q=${encodeURIComponent(username)}`,
      'GET'
    );

    if (response.users && response.users.length > 0) {
      const user = response.users.find((u: any) => u.username === username);
      return user?.pk || null;
    }

    return null;
  }

  // ============ 写操作 API ============

  /**
   * 点赞媒体
   * API: POST /api/v1/media/{media_id}/like/
   */
  public async likeMedia(params: IgLikeParams): Promise<IgLikeResponse> {
    // 写操作延迟
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    const body = {
      media_id: params.mediaId,
      module_name: params.moduleName || 'profile',
      user_id: params.userId || '',
      username: params.username || '',
      d: params.d || 0,
    };

    const response = await this.request<IgLikeResponse>(
      `/api/v1/media/${params.mediaId}/like/`,
      'POST',
      body
    );

    return response;
  }

  /**
   * 取消点赞
   * API: POST /api/v1/media/{media_id}/unlike/
   */
  public async unlikeMedia(mediaId: string): Promise<IgLikeResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    const response = await this.request<IgLikeResponse>(
      `/api/v1/media/${mediaId}/unlike/`,
      'POST',
      { media_id: mediaId }
    );

    return response;
  }

  /**
   * 关注用户
   * API: POST /api/v1/friendships/create/{user_id}/
   */
  public async followUser(params: IgFollowParams): Promise<IgFollowResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    const body = {
      user_id: params.userId,
      module_name: params.moduleName || 'profile',
      username: params.username || '',
    };

    const response = await this.request<IgFollowResponse>(
      `/api/v1/friendships/create/${params.userId}/`,
      'POST',
      body
    );

    return response;
  }

  /**
   * 取消关注
   * API: POST /api/v1/friendships/destroy/{user_id}/
   */
  public async unfollowUser(userId: string): Promise<IgFollowResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    const response = await this.request<IgFollowResponse>(
      `/api/v1/friendships/destroy/${userId}/`,
      'POST',
      { user_id: userId }
    );

    return response;
  }

  /**
   * 发布评论
   * API: POST /api/v1/media/{media_id}/comment/
   */
  public async postComment(params: IgCommentParams): Promise<IgCommentResponse> {
    await smartDelay(MIN_WRITE_DELAY, MAX_WRITE_DELAY);

    const body = {
      media_id: params.mediaId,
      text: params.text,
      replied_to_comment_id: params.repliedToCommentId || '',
    };

    const response = await this.request<IgCommentResponse>(
      `/api/v1/media/${params.mediaId}/comment/`,
      'POST',
      body
    );

    return response;
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
export const likeMedia = (params: IgLikeParams) => igApi.likeMedia(params);
export const unlikeMedia = (mediaId: string) => igApi.unlikeMedia(mediaId);
export const followUser = (params: IgFollowParams) => igApi.followUser(params);
export const unfollowUser = (userId: string) => igApi.unfollowUser(userId);
export const postComment = (params: IgCommentParams) => igApi.postComment(params);