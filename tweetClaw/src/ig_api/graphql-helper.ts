/**
 * Instagram GraphQL API 辅助函数
 *
 * Instagram Web 使用 GraphQL API 进行搜索等操作
 * 需要 fb_dtsg token（从页面提取）
 */

/**
 * 从页面提取 fb_dtsg token
 *
 * fb_dtsg token 是 Instagram/Facebook 的 CSRF token
 * 必须从页面 HTML 中提取，会定期过期
 */
export async function getFbDtsg(): Promise<string | null> {
  try {
    // 方法 1: 从 meta 标签提取
    const metaTag = document.querySelector('meta[name="fb_dtsg"]') as HTMLMetaElement;
    if (metaTag?.content) {
      console.log('[IG GraphQL] Found fb_dtsg in meta tag');
      return metaTag.content;
    }

    // 方法 2: 从 input 标签提取
    const inputTag = document.querySelector('input[name="fb_dtsg"]') as HTMLInputElement;
    if (inputTag?.value) {
      console.log('[IG GraphQL] Found fb_dtsg in input tag');
      return inputTag.value;
    }

    // 方法 3: 从页面脚本中提取（最可靠）
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const text = script.textContent || '';
      // 匹配 fb_dtsg token 格式
      const match = text.match(/"DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        console.log('[IG GraphQL] Found fb_dtsg in script tag');
        return match[1];
      }
    }

    console.warn('[IG GraphQL] fb_dtsg not found on page');
    return null;
  } catch (error) {
    console.error('[IG GraphQL] Error extracting fb_dtsg:', error);
    return null;
  }
}

/**
 * 缓存的 fb_dtsg token
 */
let cachedFbDtsg: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 获取 fb_dtsg token（带缓存）
 */
export async function getFbDtsgWithCache(): Promise<string | null> {
  const now = Date.now();

  // 如果缓存有效，直接返回
  if (cachedFbDtsg && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedFbDtsg;
  }

  // 重新提取
  const token = await getFbDtsg();
  if (token) {
    cachedFbDtsg = token;
    cacheTimestamp = now;
  }

  return token;
}

/**
 * GraphQL 查询参数
 */
export interface GraphQLVariables {
  data: {
    context: string;
    include_reel: string | boolean;  // Instagram API 需要字符串 "true"
    query: string;
    rank_token?: string;
    search_session_id?: string;
    search_surface: string;
  };
  hasQuery: boolean;
  [key: string]: any;
}

/**
 * 构建用户搜索 GraphQL 变量
 */
export function buildUserSearchVariables(username: string): GraphQLVariables {
  const sessionId = generateSessionId();
  const rankToken = `${Date.now()}|${generateRandomHash()}`;

  return {
    data: {
      context: 'blended',
      include_reel: 'true',  // 注意：必须是字符串，不是布尔值
      query: username,
      rank_token: rankToken,
      search_session_id: sessionId,
      search_surface: 'web_top_search',
    },
    hasQuery: true,
    __relay_internal__pv__PolarisAIGMAccountLabelEnabledrelayprovider: false,
  };
}

/**
 * 生成搜索会话 ID
 */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成随机哈希值
 */
function generateRandomHash(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * GraphQL 查询配置
 *
 * PolarisSearchBoxRefetchableQuery - 用户搜索查询
 * doc_id: 26841114978842944
 */
export const GRAPHQL_QUERIES = {
  SEARCH_USERS: {
    docId: '26841114978842944',
    queryName: 'PolarisSearchBoxRefetchableQuery',
  },
} as const;

/**
 * 构建完整的 GraphQL 请求体
 */
export function buildGraphQLBody(
  queryName: string,
  docId: string,
  variables: any,
  fbDtsg: string
): string {
  const params = new URLSearchParams();

  // 必需参数
  params.append('fb_dtsg', fbDtsg);
  params.append('fb_api_caller_class', 'RelayModern');
  params.append('fb_api_req_friendly_name', queryName);
  params.append('server_timestamps', 'true');
  params.append('doc_id', docId);

  // 变量参数
  params.append('variables', JSON.stringify(variables));

  return params.toString();
}

/**
 * GraphQL 用户搜索结果
 */
export interface GraphQLSearchResponse {
  data: {
    xdt_api__v1__fbsearch__topsearch_connection: {
      see_more: string | null;
      inform_module: string | null;
      hashtags: any[];
      places: any[];
      users: Array<{
        position: number;
        user: {
          username: string;
          is_verified: boolean;
          full_name: string;
          search_social_context: string | null;
          pk: string;
          profile_pic_url: string;
          id: string;
        };
      }>;
    };
  };
}

/**
 * 解析 GraphQL 搜索响应
 */
export function parseSearchResponse(response: GraphQLSearchResponse): Array<{
  userId: string;
  username: string;
  fullName: string;
  isVerified: boolean;
}> {
  const users = response?.data?.xdt_api__v1__fbsearch__topsearch_connection?.users || [];

  return users.map((item) => ({
    userId: item.user.pk,
    username: item.user.username,
    fullName: item.user.full_name,
    isVerified: item.user.is_verified,
  }));
}