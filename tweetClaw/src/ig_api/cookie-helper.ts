/**
 * Instagram Cookie 管理模块
 * 从浏览器读取和管理 Instagram 认证 Cookie
 */

/**
 * Instagram 必需的 Cookie 列表
 */
export const REQUIRED_COOKIES = [
  'sessionid',      // 会话 ID（核心认证）
  'csrftoken',      // CSRF Token
  'ds_user_id',     // 用户 ID
  'mid',            // 设备 ID
  'ig_cb',          // Instagram Cookie Banner
  'shbid',          // 会话相关
  'shbts',          // 会话时间戳
] as const;

/**
 * Cookie 数据映射
 */
export type CookieMap = Map<string, string>;

/**
 * Cookie 对象接口
 */
export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

/**
 * 从页面 Cookie 中获取值
 * Content Script 可以访问 document.cookie
 * @param name Cookie 名称
 * @returns Cookie 值，不存在则返回 null
 */
function getCookieFromDocument(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

/**
 * 从浏览器获取所有 Instagram Cookie
 * @returns Cookie 映射表
 */
export async function getInstagramCookies(): Promise<CookieMap> {
  // Content Script 可以直接访问 document.cookie
  const cookieMap = new Map<string, string>();
  const cookies = document.cookie.split(';');

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookieMap.set(name, decodeURIComponent(value));
    }
  }

  console.log('[IG Cookie] All cookies from document.cookie:', Array.from(cookieMap.keys()).sort());

  return cookieMap;
}

/**
 * 获取单个 Cookie 值
 * Content Script 可以访问 document.cookie
 * @param name Cookie 名称
 * @returns Cookie 值，不存在则返回 null
 */
export async function getCookie(name: string): Promise<string | null> {
  const value = getCookieFromDocument(name);
  if (value) {
    console.log(`[IG Cookie] Found ${name} from document.cookie`);
  } else {
    console.warn(`[IG Cookie] Cookie ${name} not found`);
  }
  return value;
}

/**
 * 获取 CSRF Token
 * @returns CSRF Token
 */
export async function getCsrfToken(): Promise<string> {
  const csrfToken = await getCookie('csrftoken');
  if (!csrfToken) {
    throw new Error('CSRF Token not found. Please login to Instagram first.');
  }
  return csrfToken;
}

/**
 * 获取 Session ID
 * @returns Session ID
 */
export async function getSessionId(): Promise<string> {
  const sessionId = await getCookie('sessionid');
  if (!sessionId) {
    throw new Error('Session ID not found. Please login to Instagram first.');
  }
  return sessionId;
}

/**
 * 获取用户 ID
 * @returns 用户 ID
 */
export async function getUserId(): Promise<string> {
  const userId = await getCookie('ds_user_id');
  if (!userId) {
    throw new Error('User ID not found. Please login to Instagram first.');
  }
  return userId;
}

/**
 * 检查是否已登录 Instagram
 * @returns 是否已登录
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    // sessionid is HttpOnly and not readable via document.cookie.
    // ds_user_id is JS-readable and sufficient to confirm login state.
    const userId = await getCookie('ds_user_id');
    return !!userId;
  } catch (error) {
    return false;
  }
}

/**
 * 验证必需的 Cookie 是否存在
 * @returns 缺失的 Cookie 列表
 */
export async function validateCookies(): Promise<string[]> {
  const cookies = await getInstagramCookies();
  const missing: string[] = [];

  // sessionid is HttpOnly — not readable via document.cookie, skip validation
  const coreCookies = ['csrftoken', 'ds_user_id'];

  for (const name of coreCookies) {
    if (!cookies.has(name)) {
      missing.push(name);
    }
  }

  return missing;
}

/**
 * 获取所有必需 Cookie 的对象
 * @returns Cookie 对象
 */
export async function getRequiredCookies(): Promise<Record<string, string>> {
  const cookies = await getInstagramCookies();
  const result: Record<string, string> = {};

  for (const name of REQUIRED_COOKIES) {
    const value = cookies.get(name);
    if (value) {
      result[name] = value;
    }
  }

  return result;
}

/**
 * 构建 Cookie Header 字符串
 * @returns Cookie Header 字符串
 */
export async function buildCookieHeader(): Promise<string> {
  const cookies = await getRequiredCookies();
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * 获取认证状态信息
 * @returns 认证状态
 */
export async function getAuthStatus(): Promise<{
  isLoggedIn: boolean;
  userId?: string;
  missingCookies: string[];
}> {
  const isLoggedInFlag = await isLoggedIn();
  const missingCookies = await validateCookies();
  const userId = isLoggedInFlag ? await getUserId() : undefined;

  return {
    isLoggedIn: isLoggedInFlag,
    userId,
    missingCookies,
  };
}

/**
 * 监听 Cookie 变化
 * @param callback 变化回调函数
 */
export function onCookieChange(callback: (change: chrome.cookies.CookieChangeInfo) => void): void {
  chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('instagram.com')) {
      callback(changeInfo);
    }
  });
}

/**
 * 打印当前 Cookie 状态（调试用）
 */
export async function debugCookies(): Promise<void> {
  const cookies = await getInstagramCookies();
  console.log('[IG Cookie Debug] Current cookies:');
  for (const [name, value] of cookies.entries()) {
    // 只显示值的前 20 个字符
    const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`  ${name}: ${displayValue}`);
  }

  const authStatus = await getAuthStatus();
  console.log('[IG Cookie Debug] Auth status:', authStatus);
}