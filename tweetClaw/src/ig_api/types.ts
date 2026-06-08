/**
 * Instagram API 类型定义
 * 参考：instagram-private-api/src/types/
 */

// ============ 用户相关 ============

/**
 * Instagram 用户信息
 * 对应 REST API /api/v1/users/{id}/info/ 响应
 */
export interface IgUser {
  pk: string;                    // 用户 ID (API 返回 id，映射到 pk)
  username: string;              // 用户名
  full_name: string;             // 全名
  is_private: boolean;           // 是否私密账号
  is_verified: boolean;          // 是否认证
  profile_pic_id?: string;       // 头像 ID
  profile_pic_url?: string;      // 头像 URL
  biography?: string;            // 简介
  external_url?: string;         // 外部链接
  follower_count: number;        // 粉丝数
  following_count: number;       // 关注数
  media_count: number;           // 媒体数
  is_business: boolean;          // 是否商业账号
  business_category_name?: string;
  category_enum?: string;
}

/**
 * 当前用户完整信息
 */
export interface IgCurrentUser extends IgUser {
  has_anonymous_profile_picture: boolean;
  can_see_primary_country_in_settings: boolean;
  is_supervision_enabled: boolean;
  is_age_over_18: boolean;
  birthday: string;
  show_conversion_edit_entry: boolean;
  allowed_commenter_type: string;
  reel_auto_archive: string;
  is_memorialized: boolean;
  is_favorite: boolean;
}

// ============ 媒体相关 ============

/**
 * Instagram 媒体类型
 */
export type IgMediaType =
  | 'IMAGE'
  | 'VIDEO'
  | 'CAROUSEL'
  | 'REEL'
  | 'STORY';

/**
 * Instagram 媒体对象
 */
export interface IgMedia {
  id: string;                    // 媒体 ID
  pk: string;                    // 媒体 PK
  code?: string;                 // 短代码
  media_type: IgMediaType;       // 媒体类型
  image_versions?: {
    candidates: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  video_versions?: Array<{
    url: string;
    width: number;
    height: number;
    type: number;
  }>;
  carousel_media?: IgMedia[];    // 轮播媒体列表
  caption?: {
    pk: string;
    text: string;
    user: IgUser;
  };
  caption_is_edited: boolean;
  taken_at: number;              // 发布时间戳
  like_count: number;            // 点赞数
  comment_count: number;         // 评论数
  user: IgUser;                  // 发布者
  location?: {
    pk: string;
    name: string;
    address?: string;
    lat: number;
    lng: number;
  };
  has_liked: boolean;            // 是否已点赞
  has_saved: boolean;            // 是否已收藏
  has_more_comments: boolean;
  comments?: IgComment[];
}

/**
 * Instagram 评论
 */
export interface IgComment {
  pk: string;                      // 评论 ID
  user_id: string;                 // 用户 ID
  text: string;                    // 评论内容
  type: number;                    // 评论类型
  created_at: number;              // 创建时间戳
  user: IgUser;                    // 评论用户
  comment_like_count: number;      // 评论点赞数
  has_liked_comment: boolean;      // 是否已点赞评论
  has_disliked_comment?: boolean;  // 是否已点踩评论
  is_covered_by_ig_rules: boolean;
  child_comment_count?: number;    // 子评论数（回复）
  is_edited?: boolean;             // 是否已编辑
  status?: string;                 // 评论状态
}

/**
 * 获取评论参数
 */
export interface IgGetCommentsParams {
  mediaId: string;                 // 媒体 ID
  minId?: string;                  // 分页游标（JSON 编码）
  sortOrder?: 'popular' | 'chronological';  // 排序方式
  canSupportThreading?: boolean;   // 是否支持评论回复
  permalinkEnabled?: boolean;      // 是否启用永久链接
}

/**
 * 获取评论响应
 */
export interface IgGetCommentsResponse {
  caption?: {                      // 帖子原始文案
    pk: string;
    text: string;
    user: IgUser;
    created_at: number;
  };
  comment_count: number;           // 总评论数
  comments: IgComment[];           // 评论列表
  can_view_more_preview_comments: boolean;
  next_min_id?: string;            // 下一页游标
}

// ============ 请求参数 ============

/**
 * 点赞参数
 */
export interface IgLikeParams {
  mediaId: string;
  moduleName?: string;
  userId?: string;
  username?: string;
  d?: number;
}

/**
 * 关注参数
 */
export interface IgFollowParams {
  userId: string;
  moduleName?: string;
  username?: string;
}

/**
 * 评论参数
 */
export interface IgCommentParams {
  mediaId: string;
  text: string;
  repliedToCommentId?: string;  // 回复的评论 ID
}

/**
 * 删除评论参数
 */
export interface IgDeleteCommentParams {
  mediaId: string;
  commentId: string;
}

/**
 * 发布媒体参数
 */
export interface IgPostMediaParams {
  imageBase64?: string;          // 图片 base64（不含前缀）
  imageBytes?: Uint8Array;       // 图片二进制数据
  videoBytes?: Uint8Array;       // 视频二进制数据
  mimeType?: string;             // MIME 类型，默认 image/jpeg
  caption: string;               // 文案
  disableComments?: boolean;     // 是否禁用评论
  shareToThreads?: boolean;      // 是否分享到 Threads
  location?: {                   // 位置信息（可选）
    name: string;
    lat: number;
    lng: number;
    externalId?: string;         // Facebook 位置 ID
  };
  // 视频专用参数
  videoDuration?: number;        // 视频时长（毫秒）
  videoWidth?: number;           // 视频宽度
  videoHeight?: number;          // 视频高度
  // 视频封面图片（可选）
  thumbnailBase64?: string;      // 封面图片 base64（不含前缀）
  thumbnailBytes?: Uint8Array;   // 封面图片二进制数据
}

/**
 * 发布媒体响应
 */
export interface IgPostMediaResponse {
  media: {
    id: string;                  // 媒体 ID
    pk: string;                  // 媒体 PK
    media_type: number;          // 媒体类型：1=图片, 2=视频
    code: string;                // 短代码
    taken_at: number;            // 发布时间戳
    caption: {
      pk: string;
      text: string;
      user: IgUser;
    };
    image_versions2?: {
      candidates: Array<{
        url: string;
        width: number;
        height: number;
      }>;
    };
  };
}

/**
 * 上传图片结果
 */
export interface IgUploadImageResult {
  upload_id: string;             // 上传 ID（Instagram API 返回 snake_case）
  status: string;                // 状态
}

/**
 * 上传视频结果
 */
export interface IgUploadVideoResult {
  upload_id: string;             // 上传 ID
  status: string;                // 状态
  video_upload_urls?: string[];  // 视频上传 URLs
}

/**
 * 视频配置参数
 */
export interface IgConfigureVideoParams {
  uploadId: string;
  caption: string;
  duration: number;              // 视频时长（毫秒）
  width: number;
  height: number;
  disableComments?: boolean;
  shareToThreads?: boolean;
}

/**
 * 删除媒体参数
 */
export interface IgDeleteMediaParams {
  mediaId: string;               // 媒体 ID
}

/**
 * 删除媒体响应
 */
export interface IgDeleteMediaResponse {
  did_delete: boolean;           // 是否删除成功
  status: string;                // 状态
}

/**
 * 获取用户媒体参数
 */
export interface IgGetUserMediaParams {
  userId?: string;               // 用户 ID（可选，优先使用）
  username?: string;             // 用户名（可选）
  count?: number;                // 获取数量（默认 12）
  after?: string;                // 分页游标
}

/**
 * 用户媒体项
 */
export interface IgUserMediaItem {
  id: string;                    // 媒体 ID
  pk: string;                    // 媒体 PK
  code: string;                  // 短代码
  mediaType: number;             // 媒体类型（1=图片，2=视频，8=轮播）
  imageUrl: string;              // 图片 URL
  videoUrl?: string;             // 视频 URL（如果是视频）
  caption?: string;              // 文案
  takenAt: number;               // 发布时间戳
  likeCount: number;             // 点赞数
  commentCount: number;          // 评论数
  hasLiked: boolean;             // 是否已点赞
  user: {
    userId: string;
    username: string;
    fullName: string;
    isPrivate: boolean;
    isVerified: boolean;
  };
}

/**
 * 获取用户媒体响应
 */
export interface IgGetUserMediaResponse {
  items: IgUserMediaItem[];      // 媒体列表
  pageInfo: {
    hasNextPage: boolean;        // 是否有下一页
    endCursor: string | null;    // 下一页游标
  };
}

// ============ Feed 相关 ============

/**
 * Feed 媒体项（简化版）
 */
export interface IgFeedMedia {
  id: string;                    // 媒体 ID
  pk: string;                    // 媒体 PK
  code: string;                  // 短代码 (如 "DXNLA7nEYoz")
  media_type: IgMediaType;       // 媒体类型
  image_versions?: {
    candidates: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  video_versions?: Array<{
    url: string;
    width: number;
    height: number;
    type: number;
  }>;
  carousel_media?: IgFeedMedia[];
  caption?: {
    pk: string;
    text: string;
    user: IgUser;
  };
  taken_at: number;
  like_count: number;
  comment_count: number;
  user: IgUser;
  has_liked: boolean;
  has_saved: boolean;
}

/**
 * Feed 响应
 */
export interface IgFeedResponse {
  items: IgFeedMedia[];
  more_available: boolean;
  next_max_id?: string;          // 分页游标
}

/**
 * 发布媒体参数
 */
export interface IgPublishParams {
  caption: string;
  mediaType: IgMediaType;
  media: Array<{
    base64: string;
    mimeType: string;
  }>;
  location?: {
    name: string;
    lat: number;
    lng: number;
  };
  taggedUsers?: string[];
  hideLikeCount?: boolean;
  disableComments?: boolean;
}

// ============ 搜索相关 ============

/**
 * 搜索参数
 */
export interface IgSearchParams {
  query: string;                  // 搜索关键词
  searchSessionId?: string;       // 搜索会话 ID（可选，自动生成）
  serpSessionId?: string;         // 搜索结果页会话 ID（可选，自动生成）
  // 分页支持
  after?: string;                 // 分页游标（用于获取下一页）
  before?: string;                // 分页游标（用于获取上一页）
  first?: number;                 // 每页数量（默认由 Instagram 决定）
  last?: number;                  // 每页数量（反向分页）
}

/**
 * 搜索结果项
 */
export interface IgSearchResult {
  position: number;
  user?: IgUser;
  hashtag?: {
    id: string;
    name: string;
    media_count: number;
  };
  place?: {
    location: {
      pk: string;
      name: string;
      lat: number;
      lng: number;
    };
  };
  // 搜索结果中的媒体（最常见）
  media?: {
    pk: string;
    id: string;
    code: string;                    // 短代码，用于构建 URL
    media_type: number;              // 1=图片, 2=视频, 8=轮播
    image_versions: Array<{
      url: string;
      width: number;
      height: number;
    }>;
    original_width: number;
    original_height: number;
    taken_at: number;                // 发布时间戳
    like_count: number;
    comment_count: number;
    play_count?: number;             // 视频播放次数
    caption?: string;                // 文案
    user: {
      pk: string;
      username: string;
      full_name: string;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url: string;
    };
  };
}

/**
 * 搜索响应
 */
export interface IgSearchResponse {
  results: IgSearchResult[];      // 搜索结果列表
  hasMore: boolean;               // 是否有更多结果
  query: string;                  // 搜索关键词
  // 分页游标
  endCursor?: string | null;      // 下一页游标
  startCursor?: string | null;    // 上一页游标
}

// ============ Feed 相关 ============

/**
 * Feed 项
 */
export interface IgFeedItem {
  media: IgMedia;
  stories?: IgMedia[];
  suggests?: IgMedia[];
}

// ============ API 响应 ============

/**
 * 标准 API 响应
 */
export interface IgApiResponse<T = any> {
  status: 'ok' | 'fail';
  message?: string;
  error_type?: string;
  payload?: T;
}

/**
 * 分页响应
 */
export interface IgPaginatedResponse<T> {
  items: T[];
  more_available: boolean;
  next_max_id?: string;
  next_mid?: string;
  num_results: number;
}

/**
 * 当前用户响应
 */
export interface IgCurrentUserResponse {
  status: string;
  user: IgCurrentUser;
}

/**
 * 用户信息响应
 */
export interface IgUserInfoResponse {
  status: string;
  user: IgUser;
}

/**
 * 点赞响应
 */
export interface IgLikeResponse {
  status: string;
  like_count?: number; // GraphQL API 不返回 like_count，设为可选
}

/**
 * 关注响应
 */
export interface IgFollowResponse {
  status: string;
  following: boolean;
  friendship_status: {
    following: boolean;
    followed_by: boolean;
    blocking: boolean;
    muting: boolean;
    is_private: boolean;
    incoming_request: boolean;
    outgoing_request: boolean;
  };
}

/**
 * 评论响应
 */
export interface IgCommentResponse {
  status: string;
  comment: IgComment;
}

// ============ 错误类型 ============

/**
 * Instagram API 错误类型
 */
export enum IgErrorCode {
  RATE_LIMITED = 'rate_limited',
  AUTH_REQUIRED = 'auth_required',
  MEDIA_INVALID = 'media_invalid',
  CAPTION_TOO_LONG = 'caption_too_long',
  USER_NOT_FOUND = 'user_not_found',
  PRIVATE_ACCOUNT = 'private_account',
  LOGIN_REQUIRED = 'login_required',
  CHECKPOINT_REQUIRED = 'checkpoint_required',
  FEEDBACK_REQUIRED = 'feedback_required',
  NOT_AUTHORIZED = 'not_authorized',
}

/**
 * Instagram API 错误
 */
export interface IgApiError {
  status: 'fail';
  message: string;
  error_type: IgErrorCode;
  checkpoint_url?: string;
}

// ============ 消息类型 ============

/**
 * Instagram 消息类型（用于 Chrome 扩展通信）
 */
export type IgMessageType =
  | 'command.ig_get_self_info'
  | 'command.ig_get_user_info'
  | 'command.ig_search_user'
  | 'command.ig_get_feed'
  | 'command.ig_get_media'
  | 'command.ig_get_media_comments'
  | 'command.ig_get_user_media'
  | 'command.ig_search'
  | 'command.ig_like_media'
  | 'command.ig_unlike_media'
  | 'command.ig_follow_user'
  | 'command.ig_unfollow_user'
  | 'command.ig_post_comment'
  | 'command.ig_delete_comment'
  | 'command.ig_post_media'
  | 'command.ig_delete_media'
  | 'command.ig_check_login'
  | 'command.ig_test_connection';

/**
 * Instagram 请求消息
 */
export interface IgRequestMessage {
  type: IgMessageType;
  params: Record<string, any>;
}

/**
 * Instagram 响应消息
 */
export interface IgResponseMessage {
  type: IgMessageType;
  success: boolean;
  data?: any;
  error?: string;
}