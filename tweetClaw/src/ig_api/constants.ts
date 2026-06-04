/**
 * Instagram API 常量定义
 * 来源：instagram-private-api/src/core/constants.ts
 */

// ============ 签名相关 ============

/**
 * Instagram 请求签名密钥
 * 用于 HMAC-SHA256 签名
 */
export const SIGNATURE_KEY = '9193488027538fd3450b83b7d05286d4ca9599a0f7eeed90d8c85925698a05dc';

/**
 * 签名版本
 */
export const SIGNATURE_VERSION = '4';

/**
 * 用户行为追踪密钥（用于评论等操作的额外签名）
 */
export const BREADCRUMB_KEY = 'iN4$aGr0m';

// ============ 应用信息 ============

/**
 * Instagram App 版本
 */
export const APP_VERSION = '222.0.0.13.114';

/**
 * Instagram App 版本代码
 */
export const APP_VERSION_CODE = '350696709';

/**
 * Facebook Analytics Application ID
 * 用于 X-IG-App-ID Header
 */
export const X_IG_APP_ID = '567067343352427';

/**
 * Facebook Orca Application ID
 */
export const FACEBOOK_ORCA_APPLICATION_ID = '124024574287414';

/**
 * Facebook OTA Fields
 */
export const FACEBOOK_OTA_FIELDS = 'fb_ota_fields';

// ============ API 端点 ============

/**
 * Instagram API 基础 URL
 */
export const BASE_URL = 'https://i.instagram.com/';

/**
 * API 版本前缀
 */
export const API_VERSION = 'v1';

// ============ 设备和能力 ============

/**
 * 应用能力 Header
 */
export const CAPABILITIES_HEADER = '3brTv10=';

/**
 * 连接类型 Header
 */
export const CONNECTION_TYPE_HEADER = 'WIFI';

/**
 * Bloks 版本 ID
 */
export const BLOKS_VERSION_ID = 'e565e0c6a8b02e5e0e8d4e0e5e0e8d4e';

// ============ 实验和功能开关 ============

/**
 * 登录实验参数
 */
export const LOGIN_EXPERIMENTS = 'ig_android_direct_voice,ig_android_video_ssim_fix_pts_universe';

/**
 * 实验参数
 */
export const EXPERIMENTS = 'ig_android_direct_voice,ig_android_video_ssim_fix_pts_universe';

// ============ 其他常量 ============

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE = 'en_US';

/**
 * 默认时区偏移（秒）
 */
export const DEFAULT_TIMEZONE_OFFSET = '-28800'; // UTC-8

/**
 * 默认无线电类型
 */
export const DEFAULT_RADIO_TYPE = 'wifi-none';

/**
 * User Agent 格式
 * 注意：在浏览器环境中，我们使用浏览器的 User Agent
 */
export const APP_USER_AGENT_TEMPLATE = 'Instagram {app_version} Android ({device_string}; {language}; {app_version_code})';

// ============ 请求相关 ============

/**
 * 请求超时时间（毫秒）
 */
export const REQUEST_TIMEOUT = 30000;

/**
 * 重试次数
 */
export const MAX_RETRIES = 3;

/**
 * 重试延迟（毫秒）
 */
export const RETRY_DELAY = 1000;

// ============ 频率限制 ============

/**
 * 写操作最小延迟（毫秒）
 */
export const MIN_WRITE_DELAY = 5000;

/**
 * 写操作最大延迟（毫秒）
 */
export const MAX_WRITE_DELAY = 15000;

/**
 * 每小时点赞上限
 */
export const HOURLY_LIKE_LIMIT = 100;

/**
 * 每小时关注上限
 */
export const HOURLY_FOLLOW_LIMIT = 30;

/**
 * 每天发布上限
 */
export const DAILY_POST_LIMIT = 25;