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
export async function getFbDtsg(silent: boolean = false): Promise<string | null> {
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

    // 静默模式（重试中）不打 warn，避免日志噪音
    if (!silent) {
      console.warn('[IG GraphQL] fb_dtsg not found on page');
    }
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
 * 获取 fb_dtsg token（带缓存 + 重试等待）
 *
 * 页面刚加载时含 DTSGInitialData 的 script 标签可能尚未解析，
 * 此时同步扫描会失败。这里加短重试（3 次 × 500ms）等待 DOM 就绪，
 * 避免初始 testConnection 阶段误报 "fb_dtsg not found"。
 */
export async function getFbDtsgWithCache(): Promise<string | null> {
  const now = Date.now();

  // 如果缓存有效，直接返回
  if (cachedFbDtsg && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedFbDtsg;
  }

  // 重试等待 script 标签就绪（页面初始加载时需要）
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;
  let token: string | null = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    // 静默重试：只在最后一次失败时才打 warn（由 getFbDtsg 内部处理）
    const isLastRetry = i === MAX_RETRIES - 1;
    token = await getFbDtsg(!isLastRetry);
    if (token) break;
    if (!isLastRetry) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

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
 * 构建 Home Feed GraphQL 变量
 */
export function buildHomeFeedVariables(maxId?: string): any {
  return {
    after: maxId || null,
    before: null,
    data: {
      device_id: generateDeviceId(),
      is_async_ads_double_request: "0",
      is_async_ads_in_headload_enabled: "0",
      is_async_ads_rti: "0",
      rti_delivery_backend: "0",
    },
    first: 12,
    last: null,
    variant: "home",
    __relay_internal__pv__PolarisImmersiveFeedChainingEnabledrelayprovider: true,
    __relay_internal__pv__PolarisMultiCaptionCarouselEnabledrelayprovider: false,
    __relay_internal__pv__PolarisAIGMAccountLabelEnabledrelayprovider: false,
    __relay_internal__pv__PolarisReelsRecoDebugOverlayEnabledrelayprovider: false,
  };
}

/**
 * 构建 Media Info GraphQL 变量
 */
export function buildMediaInfoVariables(shortcode: string): any {
  return {
    shortcode: shortcode,
    __relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider: true,
  };
}

/**
 * 构建 User Profile GraphQL 变量
 * 对应 PolarisProfilePageContentQuery，用用户 pk(id) 查询完整资料
 */
export function buildUserProfileVariables(userId: string): any {
  return {
    enable_integrity_filters: true,
    id: userId,
    render_surface: 'PROFILE',
    __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
    __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
    __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
    __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: false,
    __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: false,
    __relay_internal__pv__PolarisLongformEnabledrelayprovider: false,
  };
}

/**
 * 生成设备 ID
 */
function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
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
 * PolarisHomeFeedQuery - 首页 Feed
 */
export const GRAPHQL_QUERIES = {
  SEARCH_USERS: {
    docId: '26841114978842944',
    queryName: 'PolarisSearchBoxRefetchableQuery',
  },
  HOME_FEED: {
    docId: '27274534238909635',
    queryName: 'PolarisFeedRootPaginationCachedQuery_subscribe',
  },
  MEDIA_INFO: {
    docId: '26713194205046842',
    queryName: 'PolarisPostRootQuery',
  },
  ACTIVITY_FEED: {
    docId: '36796401869973287',
    queryName: 'PolarisActivityFeedStoriesViewQuery',
  },
  USER_PROFILE: {
    docId: '26672929172408668',
    queryName: 'PolarisProfilePageContentQuery',
  },
} as const;

/**
 * 动态获取 doc_id（方案核心，同步）
 *
 * 1. 读 sessionStorage.ig_doc_id_map（由 injection.ts 在 page world 写入，
 *    content script 同源共享），命中且 ts 新鲜 (< 6h) → 返回动态 doc_id
 * 2. 未命中 / 陈旧 / 读取异常 → 返回 fallbackDocId
 *
 * 同步签名：sessionStorage.getItem 同步返回，调用方无需 await，
 * buildGraphQLBody 调用方式零改动。
 *
 * @param friendlyName  GraphQL friendly_name（如 'PolarisSearchBoxRefetchableQuery'）
 * @param fallbackDocId GRAPHQL_QUERIES.X.docId 硬编码兜底值
 */
const IG_DOC_ID_STORAGE_KEY = 'ig_doc_id_map';
const IG_DOC_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export function getDocId(friendlyName: string, fallbackDocId: string): string {
  try {
    const raw = sessionStorage.getItem(IG_DOC_ID_STORAGE_KEY);
    if (!raw) return fallbackDocId;
    const map = JSON.parse(raw) as Record<string, { docId: string; ts: number }>;
    const entry = map[friendlyName];
    if (entry && entry.docId && (Date.now() - entry.ts) < IG_DOC_ID_TTL_MS) {
      return entry.docId;
    }
  } catch (e) {
    console.warn('[IG GraphQL] getDocId sessionStorage read failed', e);
  }
  return fallbackDocId;
}

/**
 * 清除指定 friendly_name 的动态 doc_id 缓存条目。
 *
 * 在检测到 field_exception（doc_id 过期）时调用，强制下次 getDocId 回退到
 * fallback 或等待重新捕获。
 */
export function invalidateDocId(friendlyName: string): void {
  try {
    const raw = sessionStorage.getItem(IG_DOC_ID_STORAGE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    if (!map[friendlyName]) return;
    delete map[friendlyName];
    sessionStorage.setItem(IG_DOC_ID_STORAGE_KEY, JSON.stringify(map));
    console.log(`[IG GraphQL] invalidated doc_id cache for ${friendlyName}`);
  } catch (e) {
    console.warn('[IG GraphQL] invalidateDocId failed', e);
  }
}

/**
 * 从页面提取 LSD token
 */
export function getLsdToken(): string | null {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const text = script.textContent || '';
    const match = text.match(/"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * 读取 Instagram cookie：优先 document.cookie（非 httpOnly），
 * 读不到时用 chrome.cookies API 读 httpOnly cookie。
 */
export async function getIgCookie(name: string): Promise<string | null> {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [n, v] = cookie.trim().split('=');
    if (n === name && v) return decodeURIComponent(v);
  }
  try {
    return await new Promise<string | null>((resolve) => {
      chrome.cookies.get({ url: 'https://www.instagram.com', name }, (cookie) => {
        resolve(cookie ? cookie.value : null);
      });
    });
  } catch {
    return null;
  }
}

/**
 * 从页面提取 __s (session ID)，用于 x-web-session-id header
 */
export async function getSessionId(): Promise<string> {
  // 1. 从 sessionStorage 读（injection.ts 从响应头捕获的 x-web-session-id，如果有）
  try {
    const cached = sessionStorage.getItem('ig_web_session_id');
    if (cached) return cached;
  } catch {}
  // 2. 从 storage 拼接：IG 的 x-web-session-id = 会话token:TabId:会话token2
  //    （形如 y78ol2:6gvvcr:4oti9q，第二段 = sessionStorage.TabId）
  try {
    const tabId = sessionStorage.getItem('TabId') || '';
    const session1 = (localStorage.getItem('Session') || '').split(':')[0];
    const session2 = (localStorage.getItem('IGSession') || '').split(':')[0];
    if (tabId && session1 && session2) {
      return `${session1}:${tabId}:${session2}`;
    }
  } catch {}
  // 3. 从 cookie 读（__s 是 httpOnly，需走 chrome.cookies API）
  const fromCookie = await getIgCookie('__s');
  if (fromCookie) return fromCookie;
  // 4. fallback：从 DOM script 提取
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const text = script.textContent || '';
    const match = text.match(/["']__s["']\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

// ── 已移除的 DOM 提取函数 ──────────────────────────────────────────
// 以下函数在 buildGraphQLBody 瘦身后不再被调用，已删除：
//   getSessionInstanceId()  — __hsi，DOM 提取失败 fallback '0'，空值比不发更可疑
//   getDynamicConfig()      — __dyn，DOM 提取失败 fallback ''
//   getCsrToken()           — __csr，DOM 提取失败 fallback ''
//   getHandshakeId()        — __hs，DOM 提取失败 fallback 硬编码值
//   getHsdpToken()          — __hsdp，DOM 提取失败 fallback ''
//   getHblpToken()          — __hblp，DOM 提取失败 fallback ''
//   getSjspToken()          — __sjsp，DOM 提取失败 fallback ''
// 这些字段在 instagrapi public_doc_id_graphql_request 中也不发送，
// 空值/硬编码值反而构成指纹差异（根因 #8/#10），因此直接从 body 中移除。
// ────────────────────────────────────────────────────────────────

/**
 * 从页面提取 __rev (revision)
 */
export function getRevision(): string {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const text = script.textContent || '';
    const match = text.match(/["']__spin_r["']\s*:\s*(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '1000000000'; // fallback
}

/**
 * 获取 x-bloks-version-id（根因 #14）
 *
 * 这是 Instagram Bloks 渲染引擎的版本哈希，绑定 Web 前端部署版本，
 * 不随用户会话变化。instagrapi 在 config.py 里同样按 app 版本硬编码
 * bloks_versioning_id，此处采用相同策略。
 *
 * 值来源：2026-07-23 抓包（ig_get_feed/ig_notifications/ig_get_user_media/
 * ig_get_user_info 的 /graphql/query 请求），所有请求一致。
 *
 * 注意：Instagram 前端发版后此值会变，需定期更新。提取方式见下方注释。
 */
const BLOKS_VERSION_ID = '8d3b63255809238950cdffa6dba61c104f40e6a600a2ca34bc7f8d3442f3632c';

/**
 * 获取 Bloks 渲染引擎版本哈希
 *
 * 当前采用硬编码（与 instagrapi config.py 策略一致）。
 * 该值绑定 Instagram Web 前端部署版本，不随会话变化，
 * 埋在 webpack chunk 里无法用简单 DOM regex 提取。
 */
export function getBloksVersionId(): string {
  return BLOKS_VERSION_ID;
}

/**
 * Follow/Unfollow 操作的 nav_chain（根因 #11）
 *
 * nav_chain 记录用户导航路径（RouteRoot:pageName:stepIndex:source，逗号分隔多段）。
 * 旧值 `PolarisProfilePostsTabRoot:profilePage:1:via_cold_start` 是单段冷启动路径，
 * 与真浏览器不符——真用户从 Feed 点进 Profile 再关注，导航链有两段。
 *
 * 值来源：2026-07-23 抓包 ig_follow.log 的 usePolarisFollowMutation 请求。
 * 与 instagrapi photo.py/video.py 策略一致：硬编码真实导航路径字符串。
 */
const FOLLOW_NAV_CHAIN = 'PolarisFeedRoot:feedPage:4:topnav-link,PolarisProfilePostsTabRoot:profilePage:5:unexpected';

/**
 * 获取 Follow/Unfollow 的 nav_chain
 */
export function getFollowNavChain(): string {
  return FOLLOW_NAV_CHAIN;
}

/**
 * 计算 jazoest 值
 * 算法：'2' + str(sum(ord(c) for c in input))
 *
 * 输入字符串取决于端点类型：
 * - GraphQL 端点（/api/graphql, /graphql/query）：传入 fb_dtsg（已用 7 条抓包验证）
 * - REST 端点（/api/v1/web/comments/, /api/v1/media/configure*）：传入 csrf token（已用 ig_comment.log 验证）
 */
export function computeJazoest(input: string): string {
  let charSum = 0;
  for (let i = 0; i < input.length; i++) {
    charSum += input.charCodeAt(i);
  }
  return '2' + charSum.toString();
}

/**
 * __req 递增计数器
 * 真浏览器的 __req 是页面会话内递增的请求序号（base-36 编码：0-9, a-z）
 * 硬编码 '2' 会让所有请求共用同一序号，是封号根因 #3
 */
let reqCounter = 0;

/**
 * 获取下一个 __req 值（base-36 递增编码）
 */
function nextReqId(): string {
  reqCounter++;
  return reqCounter.toString(36);
}

/**
 * 重置 __req 计数器（页面刷新时调用）
 */
export function resetReqCounter(): void {
  reqCounter = 0;
}

/**
 * 构建完整的 GraphQL 请求体（瘦身版）
 *
 * 参照 instagrapi `public_doc_id_graphql_request`（`mixins/public.py` 第 483–487 行），
 * 只保留 GraphQL 核心参数 + 已修复的指纹字段，砍掉 Facebook 兼容层参数。
 *
 * 砍掉的字段及原因：
 *   - `__s`/`__hsi`/`__dyn`/`__csr`/`__hsdp`/`__hblp`/`__sjsp`：DOM 提取失败导致空值，
 *     空值比不发更可疑（真浏览器总有值）→ 解决根因 #8（token stale）
 *   - `__ccg`：硬编码 `MODERATE` 与真浏览器不符（有时是 `POOR`）→ 解决根因 #10
 *   - `__hs`：DOM 提取 fallback 值与真浏览器不符
 *   - `av`/`__d`/`__user`/`__a`/`dpr`/`__comet_req`/`__spin_*`：
 *     常量字段，非 GraphQL doc_id 模式所必需
 *   - `lsd`：已通过 header `x-fb-lsd` 发送，body 不需要重复
 *   - `__rev`：已通过 header `x-instagram-ajax` 发送（= `getRevision()`），body 不需要重复
 *
 * 保留字段：
 *   - `__req`：递增请求序号（base-36，根因 #3 已修复）
 *   - `fb_dtsg` + `jazoest`：CSRF token + 校验值（根因 #4 已修复）
 *   - `__crn`：comet route name（根因 #13 已修复）
 *   - `fb_api_caller_class`：`RelayModern`，真实浏览器在所有 GraphQL 请求中都会发送
 *   - `fb_api_req_friendly_name`/`server_timestamps`/`doc_id`/`variables`：GraphQL 核心参数
 */
export function buildGraphQLBody(
  queryName: string,
  docId: string,
  variables: any,
  fbDtsg: string,
  crn?: string
): string {
  const params = new URLSearchParams();

  // __req — 递增请求序号（base-36），根因 #3
  params.append('__req', nextReqId());

  // fb_dtsg + jazoest — CSRF token + 校验值，根因 #4
  params.append('fb_dtsg', fbDtsg);
  params.append('jazoest', computeJazoest(fbDtsg));

  // __crn — comet route name，根因 #13
  if (crn) {
    params.append('__crn', crn);
  }

  // fb_api_caller_class — 真实浏览器在所有 GraphQL 请求中都会发送此字段
  params.append('fb_api_caller_class', 'RelayModern');

  // GraphQL 核心参数
  params.append('fb_api_req_friendly_name', queryName);
  params.append('server_timestamps', 'true');
  params.append('doc_id', docId);
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

/**
 * GraphQL Feed 响应
 */
export interface GraphQLFeedResponse {
  data: {
    xdt_api__v1__feed__timeline__connection: {
      edges: Array<{
        node: {
          media?: {
            id: string;
            pk: string;
            code: string;
            media_type: number;
            image_versions2?: {
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
            carousel_media?: any[];
            caption?: {
              pk: string;
              text: string;
              user: any;
            };
            taken_at: number;
            like_count: number;
            comment_count: number;
            user: any;
            has_liked: boolean;
            has_saved: boolean;
          };
          explore_story?: {
            media?: {
              id: string;
              pk: string;
              code: string;
              media_type: number;
              image_versions2?: {
                candidates: Array<{
                  url: string;
                  width: number;
                  height: number;
                }>;
              };
              caption?: {
                pk: string;
                text: string;
                user: any;
              };
              like_count: number;
              comment_count: number;
              user: any;
              has_liked: boolean;
            };
          };
          ad?: {
            media?: any;
          };
        };
      }>;
      page_info: {
        has_next_page: boolean;
        end_cursor: string | null;
      };
    };
  };
}

/**
 * 解析 GraphQL Feed 响应
 */
export function parseFeedResponse(response: GraphQLFeedResponse): {
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
} {
  const edges = response?.data?.xdt_api__v1__feed__timeline__connection?.edges || [];
  const pageInfo = response?.data?.xdt_api__v1__feed__timeline__connection?.page_info;

  const items = edges
    .map((edge) => {
      // Feed 可能包含多种类型：media, explore_story, ad 等
      // 优先级：media > explore_story.media > ad
      const node = edge?.node;
      let media = null;

      if (node?.media) {
        // 标准 Feed 媒体
        media = node.media;
      } else if (node?.explore_story?.media) {
        // Explore/推荐内容
        media = node.explore_story.media;
      } else if (node?.ad?.media) {
        // 广告（可选处理）
        media = node.ad.media;
      }

      if (!media) {
        return null; // 过滤掉无效项
      }

      const mediaTypeMap: Record<number, string> = {
        1: 'IMAGE',
        2: 'VIDEO',
        8: 'CAROUSEL',
      };

      return {
        id: media.id,
        pk: media.pk,
        code: media.code,
        mediaType: mediaTypeMap[media.media_type] || 'IMAGE',
        imageUrl: media.image_versions2?.candidates?.[0]?.url || '',
        caption: media.caption?.text || '',
        likeCount: media.like_count || 0,
        commentCount: media.comment_count || 0,
        hasLiked: media.has_liked || false,
        user: {
          userId: media.user?.pk || '',
          username: media.user?.username || '',
          fullName: media.user?.full_name || '',
        },
      };
    })
    .filter((item) => item !== null); // 移除 null 项

  return {
    items,
    nextMaxId: pageInfo?.end_cursor || null,
  };
}

/**
 * GraphQL User Profile 响应（PolarisProfilePageContentQuery）
 * 字段对齐 2.log 中实际抓到的响应
 */
export interface GraphQLUserProfileResponse {
  data: {
    user: {
      pk: string;
      username: string;
      full_name: string;
      is_private: boolean;
      is_verified: boolean;
      profile_pic_url?: string;
      hd_profile_pic_url_info?: { url: string };
      biography?: string;
      bio_links?: Array<{ url: string }>;
      external_url?: string;
      follower_count?: number;
      following_count?: number;
      media_count?: number;
      is_business?: boolean;
      category?: string | null;
      account_type?: number;
      id: string;
    } | null;
  };
}

/**
 * 解析 PolarisProfilePageContentQuery 响应为 IgUser
 * 字段名与 REST /api/v1/users/{id}/info/ 不同，需要做映射
 */
export function parseUserProfileResponse(response: GraphQLUserProfileResponse): {
  pk: string;
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url?: string;
  biography?: string;
  external_url?: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_business: boolean;
  category_enum?: string | null;
} {
  const u = response?.data?.user;
  if (!u) {
    throw new Error('Invalid user profile response: missing data.user');
  }

  const externalUrl = u.bio_links?.find((l) => l.url)?.url || u.external_url || '';

  return {
    pk: u.pk || u.id,
    username: u.username || '',
    full_name: u.full_name || '',
    is_private: u.is_private || false,
    is_verified: u.is_verified || false,
    profile_pic_url: u.profile_pic_url || u.hd_profile_pic_url_info?.url,
    biography: u.biography,
    external_url: externalUrl,
    follower_count: u.follower_count || 0,
    following_count: u.following_count || 0,
    media_count: u.media_count || 0,
    is_business: u.is_business || false,
    category_enum: u.category ?? undefined,
  };
}
