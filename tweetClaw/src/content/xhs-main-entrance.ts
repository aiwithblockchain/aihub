import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';
import { performXhsAction } from '../platforms/xiaohongshu/xhs-api';

/**
 * 小红书 Content Script 入口
 *
 * 职责：
 * 1. 注入签名 inject script 到 Page Context
 * 2. 桥接 Background ↔ Page Context 的签名请求
 * 3. 接收来自 Background 的业务指令，通过签名后发送 API 请求
 *
 * 架构：
 *   Background  ──chrome.tabs.sendMessage──▶  Content Script (本文件)
 *   Content Script  ──window.postMessage──▶  Inject Script (Page Context)
 *   Inject Script  ──调用 window._webmsxyw──▶  签名结果
 *   Inject Script  ──window.postMessage──▶  Content Script
 *   Content Script  ──sendResponse──▶  Background
 */

const TAG = '[XhsClaw-CS]';

// ── 注入签名脚本到 Page Context ──────────────────────────────────────────────

function injectSignScript() {
  const scriptUrl = chrome.runtime.getURL('js/xhs-sign-inject.js');
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.dataset.extUrl = scriptUrl; // 传递扩展 URL 给 inject script，用于定位 xhs-rap-bundle.js
  script.onload = () => {
    console.log(`${TAG} Sign inject script loaded into page context`);
    // 不移除 script 标签，inject script 需要通过 data-ext-url 属性定位其他资源
  };
  script.onerror = (e) => {
    console.error(`${TAG} Failed to inject sign script`, e);
  };
  (document.head || document.documentElement).appendChild(script);
}

injectSignScript();

// ── 签名桥接：Content Script ↔ Page Context ──────────────────────────────────

interface PendingCallback {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingSigns    = new Map<string, PendingCallback>();
const pendingRap      = new Map<string, PendingCallback>();
const pendingXhr      = new Map<string, PendingCallback>();
const pendingHealth   = new Map<string, PendingCallback>();

// 统一监听来自 inject script 的所有响应
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'XHS_SIGN_RESPONSE') {
    const pending = pendingSigns.get(msg.msgId);
    if (!pending) return;
    pendingSigns.delete(msg.msgId);
    clearTimeout(pending.timer);
    if (msg.success && msg.result) {
      pending.resolve(msg.result);
    } else {
      console.error(`${TAG} Sign failed: ${msg.error}`);
      pending.reject(new Error(msg.error || 'Sign failed'));
    }
  }

  if (msg.type === 'XHS_RAP_RESPONSE') {
    const pending = pendingRap.get(msg.msgId);
    if (!pending) return;
    pendingRap.delete(msg.msgId);
    clearTimeout(pending.timer);
    if (msg.success) {
      pending.resolve(msg.rapParam || '');
    } else {
      console.error(`${TAG} RAP failed: ${msg.error}`);
      pending.reject(new Error(msg.error || 'RAP failed'));
    }
  }

  if (msg.type === 'XHS_XHR_RESPONSE') {
    const pending = pendingXhr.get(msg.msgId);
    if (!pending) return;
    pendingXhr.delete(msg.msgId);
    clearTimeout(pending.timer);
    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve({ status: msg.status, responseText: msg.responseText });
    }
  }

  if (msg.type === 'XHS_HEALTH_CHECK_RESPONSE') {
    const pending = pendingHealth.get(msg.msgId);
    if (!pending) return;
    pendingHealth.delete(msg.msgId);
    clearTimeout(pending.timer);
    if (!msg.ok) console.warn(`${TAG} Health check failed: ${msg.reason || 'unknown'}`);
    pending.resolve({
      ok: msg.ok,
      mnsv2_present: msg.mnsv2_present,
      sign_format_ok: msg.sign_format_ok,
      reason: msg.reason,
      sample: msg.sample,
    });
  }
});

/**
 * 请求页面签名（x-s / x-t / x-s-common）
 */
function requestSign(url: string, data: string): Promise<{ 'x-s': string; 'x-t': string; 'x-s-common'?: string }> {
  return new Promise((resolve, reject) => {
    const msgId = `sign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingSigns.delete(msgId);
      reject(new Error('Sign request timed out (8s). Is xiaohongshu.com page fully loaded?'));
    }, 8000);

    pendingSigns.set(msgId, { resolve, reject, timer });

    window.postMessage({ type: 'XHS_SIGN_REQUEST', msgId, url, data }, '*');
    console.log(`${TAG} Sign request sent: msgId=${msgId}, url=${url}`);
  });
}

/**
 * 请求 inject script 生成 x-rap-param（仅计算，不发请求）
 * inject script 通过 RAP iframe 沙盒计算 x-rap-param，返回字符串值
 */
function requestRapParam(apiPath: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const msgId = `rap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingRap.delete(msgId);
      reject(new Error('RAP request timed out (15s)'));
    }, 15000);

    pendingRap.set(msgId, { resolve, reject, timer });

    window.postMessage({ type: 'XHS_RAP_REQUEST', msgId, apiPath, body }, '*');
    console.log(`${TAG} RAP request sent: msgId=${msgId}, apiPath=${apiPath}`);
  });
}

/**
 * 向 inject script 请求 mnsv2 健康检查，返回结构化结果
 */
function requestSignHealth(): Promise<{
  ok: boolean;
  mnsv2_present: boolean;
  sign_format_ok: boolean;
  reason?: string;
  sample?: string;
}> {
  return new Promise((resolve, reject) => {
    const msgId = `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingHealth.delete(msgId);
      // 超时意味着 inject script 没有响应，本身就是异常状态
      resolve({ ok: false, mnsv2_present: false, sign_format_ok: false, reason: 'inject_timeout' });
    }, 8000);

    pendingHealth.set(msgId, { resolve, reject, timer });
    window.postMessage({ type: 'XHS_HEALTH_CHECK_REQUEST', msgId }, '*');
    console.log(`${TAG} Health check request sent: msgId=${msgId}`);
  });
}

/**
 * 通过 inject script（页面 context）发 XHR，让 creator 反垃圾 SDK 自动注入 XYS_ 格式签名
 */
function requestXhrProxy(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    const msgId = `xhr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingXhr.delete(msgId);
      reject(new Error('XHR proxy timed out (30s)'));
    }, 30000);

    pendingXhr.set(msgId, { resolve, reject, timer });

    window.postMessage({ type: 'XHS_XHR_REQUEST', msgId, url, method, headers, body }, '*');
    console.log(`${TAG} XHR proxy request sent: msgId=${msgId}, url=${url}`);
  });
}

// ── 带签名的 API 请求 ────────────────────────────────────────────────────────

const EDITH = 'https://edith.xiaohongshu.com';

async function signedFetch(apiPath: string, method: 'GET' | 'POST', body?: string): Promise<any> {
  const bodyStr = body || '';

  // 1. 请求签名（包含 x-s, x-t, x-s-common）
  const signHeaders = await requestSign(apiPath, bodyStr);
  console.log(`${TAG} Got sign headers for ${apiPath}: x-s=${signHeaders['x-s']?.slice(0, 20)}..., x-s-common=${signHeaders['x-s-common'] ? 'present' : 'MISSING'}`);

  // 2. 组装完整请求头
  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'referer': 'https://www.xiaohongshu.com/',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
  };

  // x-s-common 是必需的
  if (signHeaders['x-s-common']) {
    headers['x-s-common'] = signHeaders['x-s-common'];
  }

  // 只有 POST 请求才需要 content-type
  if (method === 'POST') {
    headers['content-type'] = 'application/json;charset=UTF-8';
  }

  // 3. 发起请求
  const url = `${EDITH}${apiPath}`;
  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  if (method === 'POST' && bodyStr) {
    fetchOptions.body = bodyStr;
  }

  console.log(`${TAG} Fetching: ${method} ${url}`);
  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

// ── Creator 端带签名的 API 请求（origin 为 creator.xiaohongshu.com）───────────

const CREATOR = 'https://creator.xiaohongshu.com';
const UPLOAD_URL = 'https://ros-upload.xiaohongshu.com';

async function signedCreatorFetch(apiPath: string, method: 'GET' | 'POST', body?: string): Promise<any> {
  const bodyStr = body || '';
  const signHeaders = await requestSign(apiPath, bodyStr);

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://creator.xiaohongshu.com',
    'referer': 'https://creator.xiaohongshu.com/',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
  };
  if (signHeaders['x-s-common']) headers['x-s-common'] = signHeaders['x-s-common'];
  if (method === 'POST') headers['content-type'] = 'application/json;charset=UTF-8';

  const fetchOptions: RequestInit = { method, headers, credentials: 'include' };
  if (method === 'POST' && bodyStr) fetchOptions.body = bodyStr;

  console.log(`${TAG} CreatorFetch: ${method} ${EDITH}${apiPath}`);
  const response = await fetch(`${EDITH}${apiPath}`, fetchOptions);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Creator API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

// ── 上传签名（Tencent COS HMAC-SHA1，与 xhs_creator_signature.js 逻辑一致）───

async function hmacSha1Hex(key: ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha1Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 计算 COS 上传签名（移植自 xhs_creator_signature.js）
 * message 格式: "{xt前10位};{expireTime前10位}"
 */
async function getUploadSignature(message: string, fileId: string, contentLength: number, host = 'ros-upload.xiaohongshu.com'): Promise<string> {
  // step1: key1 = HMAC-SHA1("null", message)  → 结果是 hex string（如 "fce354d2..."）
  const step1Key = await hmacSha1Hex(new TextEncoder().encode('null').buffer as ArrayBuffer, message);

  // step2: key2 = step1Key 作为 UTF-8/ASCII bytes（40字节，每字节是 hex 字符的 ASCII 码）
  // 注意：CryptoJS.HmacSHA1(message, key) 当 key 是字符串时，直接用其 UTF-8 字节作为 key 材料
  // 因此不能把 hex string 解码成 20 字节 binary，必须保留 40 字节 ASCII
  const step2KeyBuf = new TextEncoder().encode(step1Key).buffer as ArrayBuffer;

  // step3: canonical request hash
  const canonicalReq = `put\n/spectrum/${fileId}\n\ncontent-length=${contentLength}&host=${host}\n`;
  const canonicalHash = await sha1Hex(canonicalReq);

  // step4: final HMAC
  const signStr = `sha1\n${message}\n${canonicalHash}\n`;
  return hmacSha1Hex(step2KeyBuf, signStr);
}

// ── 图片上传流程（移植自 xhs_creator_apis.py: get_fileIds + upload_media）──────

interface UploadPermit {
  fileId: string;       // 不含 spectrum/ 前缀
  expireTime: string;   // 10 位秒级时间戳字符串
  token: string;
  uploadHost: string;
  xt: string;           // x-t header（10 位秒级）
}

interface ImageUploadResult {
  fileId: string;       // 不含 spectrum/ 前缀，发帖时拼 "spectrum/{fileId}"
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

async function getUploadPermit(scene: 'image' | 'video'): Promise<UploadPermit> {
  const apiPath = `/api/media/v1/upload/creator/permit?biz_name=spectrum&scene=${scene}&file_count=1&version=1&source=web`;
  const signHeaders = await requestSign(apiPath, '');

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://creator.xiaohongshu.com',
    'referer': 'https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=image',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
  };
  if (signHeaders['x-s-common']) headers['x-s-common'] = signHeaders['x-s-common'];

  console.log(`${TAG} getUploadPermit: GET ${CREATOR}${apiPath}`);
  const response = await fetch(`${CREATOR}${apiPath}`, { method: 'GET', headers, credentials: 'include' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getUploadPermit ${response.status}: ${text.slice(0, 200)}`);
  }
  const res = await response.json();
  if (!res.success) throw new Error(`getUploadPermit failed: ${res.msg}`);

  const permit = res.data.uploadTempPermits[0];
  const rawFileId: string = permit.fileIds[0]; // 格式: "spectrum/xxx" 或 "xxx"
  const fileId = rawFileId.split('/').pop()!;
  const uploadHost = permit.uploadAddr || 'ros-upload.xiaohongshu.com';
  const xt = String(signHeaders['x-t']).slice(0, 10);
  const expireTime = String(permit.expireTime).slice(0, 10);

  return { fileId, expireTime, token: permit.token, uploadHost, xt };
}

/**
 * 上传图片到 COS，返回 fileId、宽高、大小
 * imageBase64: 纯 base64 字符串（不含 data:xxx;base64, 前缀）
 */
async function uploadImage(imageBase64: string, mimeType = 'image/jpeg'): Promise<ImageUploadResult> {
  // 1. 获取 permit
  const permit = await getUploadPermit('image');
  const { fileId, expireTime, token, uploadHost, xt } = permit;
  const message = `${xt};${expireTime}`;

  // 2. 解码图片数据
  const binaryStr = atob(imageBase64);
  const fileBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) fileBytes[i] = binaryStr.charCodeAt(i);
  const fileSize = fileBytes.length;

  // 3. 获取图片尺寸（用 createImageBitmap）
  const blob = new Blob([fileBytes], { type: mimeType });
  let width = 0, height = 0;
  try {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
    // 宽是高的 2 倍以上时，按 Spider_XHS 逻辑调整 height
    if (width > 2 * height) height = Math.floor(width / 2);
  } catch (e) {
    console.warn(`${TAG} Could not get image dimensions, using 0x0`);
  }

  // 4. 计算 COS 签名
  const signature = await getUploadSignature(message, fileId, fileSize, uploadHost);
  const authHeader = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=&q-signature=${signature}`;

  const uploadHost_full = uploadHost.startsWith('http') ? uploadHost : `https://${uploadHost}`;
  const uploadApiUrl = `${uploadHost_full}/spectrum/${fileId}`;

  console.log(`${TAG} Uploading image to COS: ${uploadApiUrl}, size=${fileSize}, ${width}x${height}`);

  // 5. PUT 上传到 COS
  const putResponse = await fetch(uploadApiUrl, {
    method: 'PUT',
    headers: {
      'accept': '*/*',
      'authorization': authHeader,
      'origin': 'https://creator.xiaohongshu.com',
      'referer': 'https://creator.xiaohongshu.com/',
      'x-cos-security-token': token,
    },
    body: fileBytes,
    credentials: 'omit', // COS 不需要 cookie
  });

  // 409 = file already exists（上一次上传成功但后续步骤失败时重试会遇到），视为成功
  if (!putResponse.ok && putResponse.status !== 409) {
    const text = await putResponse.text();
    throw new Error(`COS upload ${putResponse.status}: ${text.slice(0, 200)}`);
  }
  if (putResponse.status === 409) {
    console.log(`${TAG} COS 409 file already exists, treating as success: fileId=${fileId}`);
  }

  console.log(`${TAG} Image uploaded OK: fileId=${fileId}`);
  return { fileId, width, height, fileSize, mimeType };
}

// ── 发布图文笔记（移植自 xhs_creator_apis.py: post_note）──────────────────────

export interface PublishImageNoteParams {
  title: string;
  desc: string;
  /** base64 编码的图片列表（不含 data: 前缀），最多 15 张 */
  images: Array<{ base64: string; mimeType?: string }>;
  /** 0=公开 1=仅自己可见，默认 0 */
  privacyType?: number;
  /** 话题列表（暂不处理，预留） */
  topics?: string[];
}

async function publishImageNote(params: PublishImageNoteParams): Promise<any> {
  const { title, desc, images, privacyType = 0 } = params;

  if (!images || images.length === 0) throw new Error('images array is empty');

  // 1. 逐张上传图片
  const fileInfos: ImageUploadResult[] = [];
  for (let i = 0; i < images.length; i++) {
    console.log(`${TAG} Uploading image ${i + 1}/${images.length}...`);
    const result = await uploadImage(images[i].base64, images[i].mimeType || 'image/jpeg');
    fileInfos.push(result);
  }

  // 2. 构建 business_binds（立即发布）
  const businessBinds = JSON.stringify({
    version: 1, noteId: 0, bizType: 0,
    noteOrderBind: {}, notePostTiming: {},
    noteCollectionBind: { id: '' },
    noteSketchCollectionBind: { id: '' },
    coProduceBind: { enable: true },
    noteCopyBind: { copyable: true },
    interactionPermissionBind: { commentPermission: 0 },
    optionRelationList: [],
  });

  const contextJson = JSON.stringify({
    recommend_title: { recommend_title_id: '', is_use: 3, used_index: -1 },
    recommendTitle: [],
    recommend_topics: { used: [] },
  });

  // 3. 构建图片列表
  const imagePayload = fileInfos.map(f => ({
    file_id: `spectrum/${f.fileId}`,
    width: f.width,
    height: f.height,
    metadata: { source: -1 },
    stickers: { version: 2, floating: [] },
    extra_info_json: JSON.stringify({
      mimeType: f.mimeType,
      image_metadata: { bg_color: '', origin_size: f.fileSize / 1024 },
    }),
  }));

  // 4. 组装发帖 body
  const postBody = {
    common: {
      type: 'normal',
      title,
      note_id: '',
      desc,
      source: '{"type":"web","ids":"","extraInfo":"{\\"subType\\":\\"official\\",\\"systemId\\":\\"web\\"}"}',
      business_binds: businessBinds,
      ats: [],
      hash_tag: [],
      post_loc: {},
      privacy_info: { op_type: 1, type: privacyType, user_ids: [] },
      goods_info: {},
      biz_relations: [],
      capa_trace_info: { contextJson },
    },
    image_info: { images: imagePayload },
    video_info: null,
  };

  const postApi = '/web_api/sns/v2/note';
  const bodyStr = JSON.stringify(postBody);

  // 5. 获取签名（inject script 优先用 window.mnsv2 生成 XYS_ 格式）
  const signHeaders = await requestSign(postApi, bodyStr);
  console.log(`${TAG} Got sign headers: x-s=${signHeaders['x-s']?.slice(0, 15)}...`);

  // 5.5 获取 x-rap-param（RAP SDK 行为签名，写操作必须携带）
  let xRapParam = '';
  try {
    xRapParam = await requestRapParam(postApi, bodyStr);
    console.log(`${TAG} Got x-rap-param (${xRapParam.length} chars): ${xRapParam.slice(0, 50)}...`);
  } catch (rapErr: any) {
    // RAP 目前非强制，失败时只打警告，不中止发布
    console.warn(`${TAG} x-rap-param request failed (non-fatal): ${rapErr.message}`);
  }

  // 6. 组装请求头
  const hexChars = 'abcdef0123456789';
  const xB3TraceId = Array.from({ length: 16 }, () => hexChars[Math.floor(Math.random() * 16)]).join('');
  const xXrayTraceId = Array.from({ length: 32 }, () => hexChars[Math.floor(Math.random() * 16)]).join('');

  const publishHeaders: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'authorization': '',
    'content-type': 'application/json',
    'x-b3-traceid': xB3TraceId,
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
    'x-xray-traceid': xXrayTraceId,
  };
  if (signHeaders['x-s-common']) publishHeaders['x-s-common'] = signHeaders['x-s-common'];
  if (xRapParam) publishHeaders['x-rap-param'] = xRapParam;
  console.log(`${TAG} Publish headers assembled: x-rap-param=${xRapParam ? 'present' : 'MISSING (RAP not ready)'}`);

  // 7. 发布请求
  const publishUrl = `${EDITH}${postApi}`;
  console.log(`${TAG} Publishing note: ${publishUrl}, body=${bodyStr.length} bytes`);

  const response = await fetch(publishUrl, {
    method: 'POST',
    headers: publishHeaders,
    body: bodyStr,
    credentials: 'include',
  });

  const respText = await response.text();
  console.log(`${TAG} Publish response: status=${response.status}, body=${respText.slice(0, 200)}`);

  let result: any;
  try { result = JSON.parse(respText); } catch { throw new Error(`Parse error: ${respText.slice(0, 200)}`); }

  if (!response.ok || !result.success) {
    throw new Error(`Publish failed: HTTP ${response.status}, ${result.msg || respText.slice(0, 200)}`);
  }

  console.log(`${TAG} Publish success!`, result);
  return result;
}

// ── 业务 API 函数 ─────────────────────────────────────────────────────────────

async function fetchCurrentUser(): Promise<any> {
  return signedFetch('/api/sns/web/v2/user/me', 'GET');
}

async function fetchZones(): Promise<any> {
  return signedFetch('/api/sns/web/v1/zones', 'GET');
}

async function fetchHomefeed(cursorScore: string = ''): Promise<any> {
  const isFirstPage = !cursorScore.trim();
  const body = {
    cursor_score: cursorScore,
    num: 35,
    refresh_type: isFirstPage ? 1 : 3,
    note_index: isFirstPage ? 0 : 35,
    unread_begin_note_id: '',
    unread_end_note_id: '',
    unread_note_count: 0,
    category: 'homefeed_recommend',
    search_key: '',
    need_num: 10,
    image_formats: ['jpg', 'webp', 'avif'],
    need_filter_image: false,
  };
  return signedFetch('/api/sns/web/v1/homefeed', 'POST', JSON.stringify(body));
}

async function fetchFeed(noteId: string): Promise<any> {
  const body = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: 1 },
  };
  return signedFetch('/api/sns/web/v1/feed', 'POST', JSON.stringify(body));
}

async function searchNotes(keyword: string, cursor: string = '', pageSize: number = 20): Promise<any> {
  const body: any = {
    keyword,
    page: 1,
    page_size: pageSize,
    search_id: '',
    sort: 'general',
    note_type: 0,
  };
  if (cursor) body.cursor = cursor;
  return signedFetch('/api/sns/web/v1/search/notes', 'POST', JSON.stringify(body));
}

async function fetchUserNotes(userId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    user_id: userId,
    cursor,
    num: '30',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v1/user_posted?${params}`, 'GET');
}

async function fetchComments(noteId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    note_id: noteId,
    cursor,
    top_comment_id: '',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v2/comment/page?${params}`, 'GET');
}

// ── 消息处理 ──────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── 基础 ──────────────────────────────────────────────────────────────────

  if (message.type === 'XHS_PING') {
    sendResponse({ ok: true, url: window.location.href, context: 'XHS_CONTENT_SCRIPT' });
    return true;
  }

  if (message.type === 'XHS_SCROLL_PAGE') {
    window.scrollBy(0, message.pixels || 800);
    sendResponse({ ok: true });
    return true;
  }

  // ── 签名测试（用于验证签名链路是否通畅）────────────────────────────────────

  if (message.type === 'XHS_SIGN_TEST') {
    (async () => {
      try {
        const result = await requestSign(
          message.url || '/api/sns/web/v1/homefeed',
          message.data || '',
        );
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 读取操作 ──────────────────────────────────────────────────────────────

  if (message.type === XHS_MSG_TYPE.FETCH_CURRENT_USER) {
    (async () => {
      try {
        const data = await fetchCurrentUser();
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_HOMEFEED) {
    (async () => {
      try {
        const data = await fetchHomefeed(String(message.cursor_score || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_FEED) {
    (async () => {
      try {
        const data = await fetchFeed(String(message.note_id || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.SEARCH_NOTES) {
    (async () => {
      try {
        const data = await searchNotes(
          String(message.keyword || ''),
          String(message.cursor || ''),
          Number(message.page_size || 20),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_USER_NOTES) {
    (async () => {
      try {
        const data = await fetchUserNotes(
          String(message.user_id || ''),
          String(message.cursor || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_COMMENTS) {
    (async () => {
      try {
        const data = await fetchComments(
          String(message.note_id || ''),
          String(message.cursor || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_NOTE) {
    (async () => {
      try {
        const data = await fetchFeed(String(message.note_id || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── x-rap-param 跨 tab 计算（由 background 转发过来）───────────────────────

  if (message.type === 'XHS_CALC_RAP_PARAM') {
    (async () => {
      try {
        const rapParam = await requestRapParam(message.apiPath, message.body || '');
        sendResponse({ success: true, rapParam });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── x-s/x-t/x-s-common 跨 tab 计算（由 background 转发过来，只有 www tab 有正确的签名函数）

  if (message.type === 'XHS_CALC_SIGN') {
    (async () => {
      try {
        const signResult = await requestSign(message.apiPath, message.body || '');
        sendResponse({ success: true, signResult });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 发图文笔记 ───────────────────────────────────────────────────────────────

  if (message.type === XHS_MSG_TYPE.PUBLISH_IMAGE_NOTE) {
    (async () => {
      try {
        const data = await publishImageNote({
          title: String(message.title || ''),
          desc: String(message.desc || ''),
          images: message.images || [],
          privacyType: Number(message.privacy_type ?? 0),
          topics: message.topics || [],
        });
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 互动操作（暂保留直接 fetch，后续接入签名） ──────────────────────────────

  if (message.type === XHS_MSG_TYPE.EXECUTE_ACTION) {
    (async () => {
      try {
        const result = await performXhsAction(message.action, {
          note_id: message.note_id,
          user_id: message.user_id,
          content: message.content,
          at_users: message.at_users,
        });
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── mnsv2 签名健康检查 ───────────────────────────────────────────────────────

  if (message.type === XHS_MSG_TYPE.CHECK_SIGN_HEALTH) {
    (async () => {
      try {
        console.log(`${TAG} CHECK_SIGN_HEALTH received, forwarding to inject script...`);
        const result = await requestSignHealth();
        console.log(`${TAG} CHECK_SIGN_HEALTH result: ok=${result.ok}, reason=${result.reason || 'none'}, sample=${result.sample || 'n/a'}`);
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        console.error(`${TAG} CHECK_SIGN_HEALTH error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  return false;
});

console.log(`${TAG} Active. Sign inject script injected into page context.`);
