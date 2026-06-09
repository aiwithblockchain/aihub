import { XHS_API_ENDPOINTS, XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';
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
    console.log(`${TAG} [RAP_RESPONSE] msgId=${msg.msgId} success=${msg.success} rapParamLen=${msg.rapParam?.length || 0} first60=${msg.rapParam?.slice(0, 60) || 'EMPTY'}`);
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
    if (msg.error || (msg.status && msg.status >= 400)) {
      pending.reject(new Error(msg.error || `XHR ${msg.status}`));
    } else {
      pending.resolve(msg.responseText || '');
    }
  }

  if (msg.type === 'XHS_SIGNED_FETCH_RESPONSE') {
    const pending = pendingXhr.get(msg.msgId);
    if (!pending) return;
    pendingXhr.delete(msg.msgId);
    clearTimeout(pending.timer);
    if (msg.error || (msg.status && msg.status >= 400)) {
      pending.reject(new Error(msg.error || `SignedFetch ${msg.status}`));
    } else {
      pending.resolve(msg.responseText || '');
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
  });
}

/**
 * 请求 inject script 生成 x-rap-param（仅计算，不发请求）
 * inject script 通过 RAP iframe 沙盒计算 x-rap-param，返回字符串值
 */
function requestRapParam(apiPath: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const msgId = `rap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(`${TAG} [requestRapParam] sending RAP request msgId=${msgId} apiPath=${apiPath} bodyLen=${body?.length}`);

    const timer = setTimeout(() => {
      pendingRap.delete(msgId);
      console.error(`${TAG} [requestRapParam] TIMEOUT 15s msgId=${msgId}`);
      reject(new Error('RAP request timed out (15s)'));
    }, 15000);

    pendingRap.set(msgId, { resolve, reject, timer });

    window.postMessage({ type: 'XHS_RAP_REQUEST', msgId, apiPath, body }, '*');
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
  });
}


// ── 带签名的 API 请求 ────────────────────────────────────────────────────────

const EDITH = 'https://edith.xiaohongshu.com';

/** 生成 x-b3-traceid：16 位随机十六进制（与 Spider_XHS generate_x_b3_traceid 一致） */
function genB3TraceId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(16 * Math.random())];
  return id;
}

/** 生成 x-xray-traceid：32 位随机十六进制 */
function genXrayTraceId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) id += chars[Math.floor(16 * Math.random())];
  return id;
}

async function signedFetch(apiPath: string, method: 'GET' | 'POST', body?: string, extraHeaders?: Record<string, string>): Promise<any> {
  const bodyStr = body || '';

  // 签名只用路径部分（不含 scheme+host）
  const signPath = /^https?:\/\//.test(apiPath)
    ? new URL(apiPath).pathname + new URL(apiPath).search
    : apiPath;

  // 1. 请求签名（包含 x-s, x-t, x-s-common）
  const signHeaders = await requestSign(signPath, bodyStr);

  // 2. 组装完整请求头
  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'referer': 'https://www.xiaohongshu.com/',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
    'x-b3-traceid': genB3TraceId(),
    'x-xray-traceid': genXrayTraceId(),
  };

  // x-s-common 是必需的
  if (signHeaders['x-s-common']) {
    headers['x-s-common'] = signHeaders['x-s-common'];
  }

  // 只有 POST 请求才需要 content-type
  if (method === 'POST') {
    headers['content-type'] = 'application/json;charset=UTF-8';
  }

  // 合并额外请求头
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  // 3. 发起请求（支持传入完整 URL 或相对路径）
  const url = /^https?:\/\//.test(apiPath) ? apiPath : `${EDITH}${apiPath}`;
  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  if (method === 'POST' && bodyStr) {
    fetchOptions.body = bodyStr;
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * 带签名的请求（用于需要 x-rap-param 的 API）
 *
 * 委托 inject script（page context）一体化完成：签名 + x-rap-param + fetch。
 * 和 console 测试 9 在同一个 world（page context）里执行。
 *
 * 适用场景：
 * - /api/sns/web/v1/search/notes (搜索笔记)
 * - /api/sns/web/v1/feed (获取笔记详情)
 */
async function signedXhrFetch(apiPath: string, method: 'GET' | 'POST', body?: string): Promise<any> {
  const bodyStr = body || '';

  console.log(`${TAG} [signedXhrFetch] START apiPath=${apiPath} method=${method} bodyLen=${bodyStr.length}`);

  const responseText = await new Promise<string>((resolve, reject) => {
    const msgId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingXhr.delete(msgId);
      reject(new Error('SignedFetch timed out (20s)'));
    }, 20000);

    pendingXhr.set(msgId, { resolve, reject, timer });

    window.postMessage({ type: 'XHS_SIGNED_FETCH', msgId, apiPath, method, body: bodyStr }, '*');
  });

  const json = JSON.parse(responseText);
  console.log(`${TAG} [signedXhrFetch] RESPONSE code=${json.code} success=${json.success} hasItems=${!!(json.data?.items?.length || json.data?.notes?.length)} hasMore=${json.data?.has_more}`);
  return json;
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

  const response = await fetch(`${CREATOR}${apiPath}`, fetchOptions);
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
 * 计算 COS 上传签名（通用版，移植自 xhs_creator_signature.js）
 * message 格式: "{xt前10位};{expireTime前10位}"
 * urlParams: 已排序的小写 key=value 串，如 "partnumber=1&uploadid=xxx" 或 ""
 */
async function calcCosSignature(
  message: string,
  method: string,
  path: string,
  urlParams: string,
  contentLength: number,
  host: string,
): Promise<string> {
  const step1Key = await hmacSha1Hex(new TextEncoder().encode('null').buffer as ArrayBuffer, message);
  const step2KeyBuf = new TextEncoder().encode(step1Key).buffer as ArrayBuffer;
  const canonicalReq = `${method}\n${path}\n${urlParams}\ncontent-length=${contentLength}&host=${host}\n`;
  const canonicalHash = await sha1Hex(canonicalReq);
  const signStr = `sha1\n${message}\n${canonicalHash}\n`;
  return hmacSha1Hex(step2KeyBuf, signStr);
}

async function getUploadSignature(message: string, fileId: string, contentLength: number, host = 'ros-upload.xiaohongshu.com'): Promise<string> {
  return calcCosSignature(message, 'put', `/spectrum/${fileId}`, '', contentLength, host);
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

async function getUploadPermit(scene: 'image' | 'video', source: 'creator' | 'web' = 'creator'): Promise<UploadPermit> {
  const baseUrl = source === 'web' ? EDITH : CREATOR;
  const permitPath = source === 'web'
    ? `/api/media/v1/upload/web/permit`
    : `/api/media/v1/upload/creator/permit`;
  const apiPath = `${permitPath}?biz_name=spectrum&scene=${scene}&file_count=1&version=1&source=web`;
  const signHeaders = await requestSign(apiPath, '');

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'origin': 'https://creator.xiaohongshu.com',
    'referer': 'https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=image',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
  };
  if (signHeaders['x-s-common']) headers['x-s-common'] = signHeaders['x-s-common'];

  const response = await fetch(`${baseUrl}${apiPath}`, { method: 'GET', headers, credentials: 'include' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`getUploadPermit ${response.status}: ${text.slice(0, 200)}`);
  }
  const res = await response.json();
  if (!res.success) throw new Error(`getUploadPermit failed: ${res.msg}`);

  const permits: any[] = res.data.uploadTempPermits;
  console.log(`${TAG} [getUploadPermit] scene=${scene} source=${source} permits count=${permits.length}`, permits.map((p: any) => p.uploadAddr));

  // video 优先选 CDN 节点（ros-upload-d4.xhscdn.com），image 用主节点
  const permit = scene === 'video'
    ? (permits.find((p: any) => String(p.uploadAddr || '').includes('d4')) || permits[0])
    : permits[0];

  const rawFileId: string = permit.fileIds[0]; // 格式: "spectrum/xxx" 或 "xxx"
  const fileId = rawFileId.startsWith('spectrum/') ? rawFileId.slice('spectrum/'.length) : rawFileId;

  // uploadAddr 可能含 scheme（"https://ros-upload-d4.xhscdn.com"），提取 hostname 用于签名
  const rawUploadAddr: string = permit.uploadAddr || 'ros-upload.xiaohongshu.com';
  const uploadHost = rawUploadAddr.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const xt = String(signHeaders['x-t']).slice(0, 10);
  const expireTime = String(permit.expireTime).slice(0, 10);

  console.log(`${TAG} [getUploadPermit] scene=${scene} fileId=${fileId} uploadHost=${uploadHost} expireTime=${expireTime}`);
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
    console.warn(`${TAG} COS 409 file already exists, treating as success: fileId=${fileId}`);
  }

  return { fileId, width, height, fileSize, mimeType };
}

// ── 视频上传流程（COS 分片上传）────────────────────────────────────────────────

interface VideoUploadResult {
  fileId: string;
  fileSize: number;
  mimeType: string;
}

async function uploadVideoFromBytes(fileBytes: Uint8Array, mimeType = 'video/mp4'): Promise<VideoUploadResult> {
  const permit = await getUploadPermit('video');
  const { fileId, expireTime, token, uploadHost, xt } = permit;
  const message = `${xt};${expireTime}`;
  const fileSize = fileBytes.length;

  // uploadHost 已在 getUploadPermit 中剥除 scheme，这里直接补全
  const uploadHostFull = `https://${uploadHost}`;
  const path = `/spectrum/${fileId}`;

  console.log(`${TAG} [uploadVideoFromBytes] fileId=${fileId} fileSize=${fileSize} host=${uploadHost}`);

  // ── Step 1: Init multipart upload ────────────────────────────────────────
  // canonical urlParams: "uploads=" （key=uploads, value 为空）
  const initSig = await calcCosSignature(message, 'post', path, 'uploads=', 0, uploadHost);
  const initAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=uploads&q-signature=${initSig}`;

  console.log(`${TAG} [uploadVideoFromBytes] init POST ${uploadHostFull}${path}?uploads`);
  const initResp = await fetch(`${uploadHostFull}${path}?uploads`, {
    method: 'POST',
    headers: {
      'authorization': initAuth,
      'content-length': '0',
      'origin': 'https://creator.xiaohongshu.com',
      'referer': 'https://creator.xiaohongshu.com/',
      'x-cos-security-token': token,
    },
    credentials: 'omit',
  });
  if (!initResp.ok) {
    const text = await initResp.text();
    throw new Error(`COS init multipart ${initResp.status}: ${text.slice(0, 300)}`);
  }
  const initXml = await initResp.text();
  const uploadIdMatch = initXml.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!uploadIdMatch) throw new Error(`COS init: no UploadId in response: ${initXml.slice(0, 200)}`);
  const uploadId = uploadIdMatch[1];
  console.log(`${TAG} [uploadVideoFromBytes] init OK uploadId=${uploadId}`);

  // ── Step 2: Upload parts (5 MB each) ──────────────────────────────────────
  const PART_SIZE = 5 * 1024 * 1024;
  const totalParts = Math.ceil(fileSize / PART_SIZE);
  const etags: string[] = [];

  console.log(`${TAG} [uploadVideoFromBytes] uploading ${totalParts} parts, partSize=${PART_SIZE}`);

  for (let i = 0; i < totalParts; i++) {
    const partNumber = i + 1;
    const start = i * PART_SIZE;
    const partData = fileBytes.slice(start, Math.min(start + PART_SIZE, fileSize));
    const partSize = partData.length;

    // q-url-param-list: sorted lowercase keys "partnumber;uploadid"
    // canonical urlParams: "partnumber=N&uploadid=xxx" (sorted by key)
    const urlParams = `partnumber=${partNumber}&uploadid=${uploadId}`;
    const partSig = await calcCosSignature(message, 'put', path, urlParams, partSize, uploadHost);
    const partAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=partnumber;uploadid&q-signature=${partSig}`;

    const partResp = await fetch(`${uploadHostFull}${path}?partNumber=${partNumber}&uploadId=${uploadId}`, {
      method: 'PUT',
      headers: {
        'authorization': partAuth,
        'content-length': String(partSize),
        'origin': 'https://creator.xiaohongshu.com',
        'referer': 'https://creator.xiaohongshu.com/',
        'x-cos-security-token': token,
      },
      body: partData,
      credentials: 'omit',
    });
    if (!partResp.ok) {
      const text = await partResp.text();
      throw new Error(`COS upload part ${partNumber}/${totalParts} ${partResp.status}: ${text.slice(0, 300)}`);
    }
    // ETag 在响应头中，可能带引号，保留原值
    const etag = partResp.headers.get('etag') || partResp.headers.get('ETag') || '';
    if (!etag) console.warn(`${TAG} [uploadVideoFromBytes] part ${partNumber} got empty ETag`);
    etags.push(etag);
    console.log(`${TAG} [uploadVideoFromBytes] part ${partNumber}/${totalParts} OK etag=${etag}`);
  }

  // ── Step 3: Complete multipart upload ─────────────────────────────────────
  const completeXml = `<CompleteMultipartUpload>${etags.map((etag, i) =>
    `<Part><PartNumber>${i + 1}</PartNumber><ETag>${etag}</ETag></Part>`
  ).join('')}</CompleteMultipartUpload>`;
  const completeBytes = new TextEncoder().encode(completeXml);

  const completeSig = await calcCosSignature(message, 'post', path, `uploadid=${uploadId}`, completeBytes.length, uploadHost);
  const completeAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=uploadid&q-signature=${completeSig}`;

  console.log(`${TAG} [uploadVideoFromBytes] completing multipart uploadId=${uploadId}`);
  const completeResp = await fetch(`${uploadHostFull}${path}?uploadId=${uploadId}`, {
    method: 'POST',
    headers: {
      'authorization': completeAuth,
      'content-length': String(completeBytes.length),
      'content-type': 'application/xml',
      'origin': 'https://creator.xiaohongshu.com',
      'referer': 'https://creator.xiaohongshu.com/',
      'x-cos-security-token': token,
    },
    body: completeBytes,
    credentials: 'omit',
  });
  if (!completeResp.ok) {
    const text = await completeResp.text();
    throw new Error(`COS complete multipart ${completeResp.status}: ${text.slice(0, 300)}`);
  }
  const completeXmlResp = await completeResp.text();
  console.log(`${TAG} [uploadVideoFromBytes] complete OK fileId=${fileId} resp=${completeXmlResp.slice(0, 100)}`);

  return { fileId, fileSize, mimeType };
}

async function uploadVideo(videoBase64: string, mimeType = 'video/mp4'): Promise<VideoUploadResult> {
  // 用 Uint8Array.from 替代 charCodeAt 循环，大文件性能更好
  const binaryStr = atob(videoBase64);
  const fileBytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  return uploadVideoFromBytes(fileBytes, mimeType);
}

// ── 发布图文笔记（移植自 xhs_creator_apis.py: post_note）──────────────────────

export interface PublishImageNoteParams {
  title: string;
  desc: string;
  /** base64 编码的图片列表（不含 data: 前缀），最多 15 张 */
  images: Array<{ base64: string; mimeType?: string }>;
  /** 0=公开 1=仅自己可见 3=指定人可见 4=好友可见，默认 0 */
  privacyType?: number;
  /** type=3 时指定可见的用户 ID 列表 */
  privacyUserIds?: string[];
  /** 话题列表，每项含 id 和 name */
  topics?: Array<{ id: string; name: string }>;
  /** 定时发布时间（Unix 秒级时间戳），不传则立即发布 */
  scheduledPublishTime?: number;
}

async function publishImageNote(params: PublishImageNoteParams): Promise<any> {
  const { title, desc, images, privacyType = 0, privacyUserIds = [], topics = [], scheduledPublishTime } = params;
  const topicSuffix = topics.length > 0 ? ' ' + topics.map(t => `#${t.name}[话题]#`).join(' ') : '';
  const fullDesc = desc + topicSuffix;

  if (!images || images.length === 0) throw new Error('images array is empty');

  // 1. 逐张上传图片
  const fileInfos: ImageUploadResult[] = [];
  for (let i = 0; i < images.length; i++) {
    const result = await uploadImage(images[i].base64, images[i].mimeType || 'image/jpeg');
    fileInfos.push(result);
  }

  // 2. 构建 business_binds
  const notePostTiming = scheduledPublishTime
    ? { postTime: scheduledPublishTime * 1000 }
    : {};
  const bizType = scheduledPublishTime ? 13 : 0;
  const businessBinds = JSON.stringify({
    version: 1, noteId: 0, bizType,
    noteOrderBind: {}, notePostTiming,
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
      desc: fullDesc,
      source: '{"type":"web","ids":"","extraInfo":"{\\"subType\\":\\"official\\",\\"systemId\\":\\"web\\"}"}',
      business_binds: businessBinds,
      ats: [],
      hash_tag: topics.map(t => ({ id: t.id, name: t.name, type: 'topic' })),
      post_loc: {},
      privacy_info: { op_type: 1, type: privacyType, user_ids: privacyUserIds },
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

  // 5.5 获取 x-rap-param（RAP SDK 行为签名，写操作必须携带）
  let xRapParam = '';
  try {
    xRapParam = await requestRapParam(postApi, bodyStr);
  } catch (rapErr: any) {
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

  // 7. 发布请求
  const publishUrl = `${EDITH}${postApi}`;

  const response = await fetch(publishUrl, {
    method: 'POST',
    headers: publishHeaders,
    body: bodyStr,
    credentials: 'include',
  });

  const respText = await response.text();

  let result: any;
  try { result = JSON.parse(respText); } catch { throw new Error(`Parse error: ${respText.slice(0, 200)}`); }

  if (!response.ok || !result.success) {
    throw new Error(`Publish failed: HTTP ${response.status}, ${result.msg || respText.slice(0, 200)}`);
  }

  return result;
}

// ── 发布视频笔记 ──────────────────────────────────────────────────────────────

export interface PublishVideoNoteParams {
  title: string;
  desc: string;
  /** base64 编码的视频（不含 data: 前缀） */
  video?: { base64: string; mimeType?: string };
  /** 视频字节数据（优先使用，避免 base64 转换） */
  videoBytes?: { data: Uint8Array; mimeType?: string };
  /** 已上传的视频信息（优先使用，跳过上传步骤） */
  videoUpload?: VideoUploadResult;
  /** 0=公开 1=仅自己可见 3=指定人可见 4=好友可见，默认 0 */
  privacyType?: number;
  /** type=3 时指定可见的用户 ID 列表 */
  privacyUserIds?: string[];
  /** 话题列表，每项含 id 和 name */
  topics?: Array<{ id: string; name: string }>;
  /** 定时发布时间（Unix 秒级时间戳），不传则立即发布 */
  scheduledPublishTime?: number;
  /** 自定义封面（base64，不含 data: 前缀），不传则自动截取第一帧 */
  cover?: { base64: string; mimeType?: string };
  /** 视频元数据（由 Python 端提取，避免浏览器处理大文件） */
  videoMetadata?: {
    width: number;
    height: number;
    durationMs: number;
  };
}

async function publishVideoNote(params: PublishVideoNoteParams): Promise<any> {
  const { title, desc, video, videoBytes, videoUpload: existingVideoUpload, privacyType = 0, privacyUserIds = [], topics = [], scheduledPublishTime, cover, videoMetadata } = params;
  const topicSuffix = topics.length > 0 ? ' ' + topics.map(t => `#${t.name}[话题]#`).join(' ') : '';
  const fullDesc = desc + topicSuffix;
  const mimeType = videoBytes?.mimeType || video?.mimeType || 'video/mp4';

  console.log(`${TAG} [publishVideoNote] start title="${title}" privacyType=${privacyType}`);

  // 1. 验证视频元数据（必须由 Python 端提供）
  if (!videoMetadata) {
    throw new Error('videoMetadata is required. Please ensure ffprobe is installed on the Python side.');
  }

  console.log(`${TAG} [publishVideoNote] using pre-extracted metadata: ${videoMetadata.width}x${videoMetadata.height} duration=${videoMetadata.durationMs}ms`);

  // 2. 上传视频（如果还没有上传）
  let videoUpload: VideoUploadResult;

  if (existingVideoUpload) {
    // 已经上传过，直接使用
    console.log(`${TAG} [publishVideoNote] using existing videoUpload fileId=${existingVideoUpload.fileId}`);
    videoUpload = existingVideoUpload;
  } else if (videoBytes?.data) {
    // 直接使用字节数据，避免 base64 转换
    console.log(`${TAG} [publishVideoNote] using videoBytes directly, size=${videoBytes.data.length}`);
    videoUpload = await uploadVideoFromBytes(videoBytes.data, mimeType);
  } else if (video?.base64) {
    // 兼容旧的 base64 方式
    console.log(`${TAG} [publishVideoNote] using video.base64, length=${video.base64.length}`);
    videoUpload = await uploadVideo(video.base64, mimeType);
  } else {
    throw new Error('Either videoUpload, videoBytes, or video must be provided');
  }

  console.log(`${TAG} [publishVideoNote] video uploaded fileId=${videoUpload.fileId}`);

  // 3. 上传封面（如果有）
  let coverUpload: Awaited<ReturnType<typeof uploadImage>> | null = null;
  let isCustomCover = false;

  if (cover) {
    console.log(`${TAG} [publishVideoNote] uploading custom cover...`);
    coverUpload = await uploadImage(cover.base64, cover.mimeType || 'image/jpeg');
    isCustomCover = true;
    console.log(`${TAG} [publishVideoNote] cover uploaded fileId=${coverUpload.fileId} size=${coverUpload.width}x${coverUpload.height}`);
  } else {
    console.log(`${TAG} [publishVideoNote] no custom cover provided, XHS will auto-generate`);
  }

  // 4. 构建 video_info（与抓包结构完全一致）
  const spectrumVideoId = `spectrum/${videoUpload.fileId}`;
  const spectrumCoverId = coverUpload ? `spectrum/${coverUpload.fileId}` : '';
  const durationSec = videoMetadata.durationMs / 1000;

  const videoInfo = {
    fileid: spectrumVideoId,
    file_id: spectrumVideoId,
    format_width: videoMetadata.width,
    format_height: videoMetadata.height,
    video_preview_type: '',
    composite_metadata: {
      video: {
        bitrate: 0,
        colour_primaries: 'BT.709',
        duration: videoMetadata.durationMs,
        format: 'AVC',
        frame_rate: 30,
        height: videoMetadata.height,
        matrix_coefficients: 'BT.709',
        rotation: 0,
        transfer_characteristics: 'BT.709',
        width: videoMetadata.width,
      },
      audio: {},
    },
    timelines: [],
    cover: coverUpload ? {
      fileid: spectrumCoverId,
      file_id: spectrumCoverId,
      height: coverUpload.height,
      width: coverUpload.width,
      frame: { ts: 0, is_user_select: false, is_upload: true },
      stickers: { version: 2, neptune: [] },
      fonts: [],
      extra_info_json: '{"cover_effect":"{\\"crop\\":true,\\"canvas\\":true,\\"template\\":false,\\"filter\\":false,\\"text\\":false,\\"sticker\\":false}"}',
    } : {
      fileid: '',
      file_id: '',
      height: videoMetadata.height,
      width: videoMetadata.width,
      frame: { ts: 0, is_user_select: false, is_upload: false },
      stickers: { version: 2, neptune: [] },
      fonts: [],
      extra_info_json: '{}',
    },
    chapters: [],
    chapter_sync_text: false,
    segments: {
      count: 1,
      need_slice: false,
      items: [{
        mute: 0,
        speed: 1,
        start: 0,
        duration: durationSec,
        transcoded: 0,
        media_source: 1,
        original_metadata: {
          video: {
            bitrate: 0,
            colour_primaries: 'BT.709',
            duration: videoMetadata.durationMs,
            format: 'AVC',
            frame_rate: 30,
            height: videoMetadata.height,
            matrix_coefficients: 'BT.709',
            rotation: 0,
            transfer_characteristics: 'BT.709',
            width: videoMetadata.width,
          },
          audio: {},
        },
      }],
    },
    entrance: 'web',
    pk_cover_biz_relations: [],
  };

  // 4. 构建 business_binds
  const notePostTiming = scheduledPublishTime
    ? { postTime: scheduledPublishTime * 1000 }
    : {};
  const bizType = scheduledPublishTime ? 13 : 0;
  const businessBinds = JSON.stringify({
    version: 1, noteId: 0, bizType,
    noteOrderBind: { brandAccountId: '', orderId: '' },
    notePostTiming,
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

  // 5. 组装发帖 body
  const postBody = {
    common: {
      type: 'video',
      note_id: '',
      source: '{"type":"web","ids":"","extraInfo":"{\\"subType\\":\\"official\\",\\"systemId\\":\\"web\\"}"}',
      title,
      desc: fullDesc,
      ats: [],
      hash_tag: topics.map(t => ({ id: t.id, name: t.name, type: 'topic' })),
      business_binds: businessBinds,
      privacy_info: { op_type: 1, type: privacyType, user_ids: privacyUserIds },
      goods_info: {},
      biz_relations: [],
      capa_trace_info: { contextJson },
    },
    image_info: null,
    video_info: videoInfo,
  };

  const postApi = '/web_api/sns/v2/note';
  const bodyStr = JSON.stringify(postBody);

  // 6. 签名 + x-rap-param
  console.log(`${TAG} [publishVideoNote] requesting sign...`);
  const signHeaders = await requestSign(postApi, bodyStr);

  let xRapParam = '';
  try {
    xRapParam = await requestRapParam(postApi, bodyStr);
    console.log(`${TAG} [publishVideoNote] rap param ok len=${xRapParam.length}`);
  } catch (rapErr: any) {
    console.warn(`${TAG} [publishVideoNote] x-rap-param failed (non-fatal): ${rapErr.message}`);
  }

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

  // 7. 发布
  console.log(`${TAG} [publishVideoNote] posting to ${postApi}...`);
  const response = await fetch(`${EDITH}${postApi}`, {
    method: 'POST',
    headers: publishHeaders,
    body: bodyStr,
    credentials: 'include',
  });

  const respText = await response.text();
  let result: any;
  try { result = JSON.parse(respText); } catch { throw new Error(`Parse error: ${respText.slice(0, 200)}`); }

  console.log(`${TAG} [publishVideoNote] HTTP ${response.status} success=${result?.success} msg=${result?.msg}`);

  if (!response.ok || !result.success) {
    throw new Error(`Publish video failed: HTTP ${response.status}, ${result.msg || respText.slice(0, 200)}`);
  }

  console.log(`${TAG} [publishVideoNote] done noteId=${result.data?.id}`);
  return result;
}

// ── 业务 API 函数 ─────────────────────────────────────────────────────────────

async function fetchCurrentUser(): Promise<any> {
  return signedFetch('/api/sns/web/v2/user/me', 'GET');
}

async function fetchZones(): Promise<any> {
  return signedFetch('/api/sns/web/v1/zones', 'GET');
}

async function fetchHomefeed(options: {
  cursor_score?: string;
  category?: string;
  refresh_type?: number;
  num?: number;
  note_index?: number;
  unread_begin_note_id?: string;
  unread_end_note_id?: string;
  unread_note_count?: number;
  search_key?: string;
  need_num?: number;
  image_formats?: string[];
  need_filter_image?: boolean;
} = {}): Promise<any> {
  const isFirstPage = !options.cursor_score?.trim();
  const body = {
    cursor_score: options.cursor_score || '',
    num: options.num ?? 20,
    refresh_type: options.refresh_type ?? (isFirstPage ? 1 : 3),
    note_index: options.note_index ?? (isFirstPage ? 0 : 20),
    unread_begin_note_id: options.unread_begin_note_id || '',
    unread_end_note_id: options.unread_end_note_id || '',
    unread_note_count: options.unread_note_count ?? 0,
    category: options.category || 'homefeed_recommend',
    search_key: options.search_key || '',
    need_num: options.need_num ?? 10,
    image_formats: options.image_formats || ['jpg', 'webp', 'avif'],
    need_filter_image: options.need_filter_image ?? false,
  };
  return signedFetch('/api/sns/web/v1/homefeed', 'POST', JSON.stringify(body), { 'xy-direction': '98' });
}

async function fetchFeed(noteId: string, xsecToken: string = '', xsecSource: string = 'pc_search'): Promise<any> {
  const body = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: '1' },
    xsec_source: xsecSource,
    xsec_token: xsecToken,
  };
  // feed API 需要 x-rap-param，走 XHR proxy 让 Sanji SDK 自动注入
  return signedXhrFetch('/api/sns/web/v1/feed', 'POST', JSON.stringify(body));
}

async function searchNotes(keyword: string, cursor: string = '', pageSize: number): Promise<any> {
  // 与 Spider_XHS generate_search_id 完全一致：
  // _int_to_base36((timestamp_ms << 64) + random_part)
  // JS 用 BigInt 实现真正的 64 位左移
  const timestampMs = BigInt(Date.now());
  const randomPart = BigInt(Math.ceil(0x7ffffffe * Math.random()));
  const searchIdInt = (timestampMs << 64n) + randomPart;
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let searchId = '';
  let n = searchIdInt;
  while (n > 0n) {
    searchId = chars[Number(n % 36n)] + searchId;
    n = n / 36n;
  }

  const body: any = {
    keyword,
    page: 1,
    page_size: pageSize,
    search_id: searchId,
    sort: 'general',
    note_type: 0,
    ext_flags: [],
    // Spider_XHS 的真实抓包验证：不传 filters 会导致服务端偶发返回空结果
    filters: [
      { tags: ['general'], type: 'sort_type' },
      { tags: ['不限'], type: 'filter_note_type' },
      { tags: ['不限'], type: 'filter_note_time' },
      { tags: ['不限'], type: 'filter_note_range' },
      { tags: ['不限'], type: 'filter_pos_distance' },
    ],
    geo: '',
    image_formats: ['jpg', 'webp', 'avif'],
    message_id: 'sending',
  };
  if (cursor) body.cursor = cursor;

  // 真实搜索走 so.xiaohongshu.com v2，不需要 x-rap-param，从 page context 发请求保证 Origin 正确
  // page_size 最小 20，与真实浏览器请求一致
  const actualPageSize = Math.max(pageSize, 20);
  body.page_size = actualPageSize;
  return signedXhrFetch('https://so.xiaohongshu.com/api/sns/web/v2/search/notes', 'POST', JSON.stringify(body));
}

async function fetchSearchFilter(keyword: string, searchId: string): Promise<any> {
  const params = new URLSearchParams({ keyword, search_id: searchId });
  return signedFetch(`/api/sns/web/v1/search/filter?${params}`, 'GET');
}

async function fetchUserNotes(userId: string, cursor: string = '', xsecToken: string = '', xsecSource: string = 'pc_note'): Promise<any> {
  const query = [
    `user_id=${encodeURIComponent(userId)}`,
    `cursor=${encodeURIComponent(cursor)}`,
    `num=30`,
    `image_formats=jpg,webp,avif`,
    `xsec_token=${encodeURIComponent(xsecToken)}`,
    `xsec_source=${encodeURIComponent(xsecSource)}`,
  ].join('&');
  return signedFetch(`/api/sns/web/v1/user_posted?${query}`, 'GET');
}

async function fetchComments(noteId: string, cursor: string = '', xsecToken: string = ''): Promise<any> {
  // 不用 URLSearchParams，避免逗号被编码成 %2C（XHS 服务端要求原始逗号）
  const query = [
    `note_id=${encodeURIComponent(noteId)}`,
    `cursor=${encodeURIComponent(cursor)}`,
    `top_comment_id=`,
    `image_formats=jpg,webp,avif`,
    `xsec_token=${encodeURIComponent(xsecToken)}`,
  ].join('&');
  return signedFetch(`/api/sns/web/v2/comment/page?${query}`, 'GET');
}

async function fetchUserInfo(userId: string): Promise<any> {
  const params = new URLSearchParams({
    target_user_id: userId,
  });
  return signedFetch(`/api/sns/web/v1/user/otherinfo?${params}`, 'GET');
}

async function searchTopics(keyword: string): Promise<any> {
  const body = JSON.stringify({ title: keyword, desc: '', file_ids: [], topic_round_start_time: 0 });
  return signedCreatorFetch('/api/galaxy/v2/creator/recommend/suggest/topics', 'POST', body);
}

async function fetchNotifications(type: 'mentions' | 'likes', cursor: string = ''): Promise<any> {
  const endpoint = type === 'mentions'
    ? '/api/sns/web/v1/you/mentions'
    : '/api/sns/web/v1/you/likes';
  const params = new URLSearchParams({
    cursor,
    num: '20',
  });
  return signedFetch(`${endpoint}?${params}`, 'GET');
}

async function fetchPublishedNotes(page: string = '0'): Promise<any> {
  return signedCreatorFetch(`/api/galaxy/v2/creator/note/user/posted?tab=0&page=${encodeURIComponent(page)}`, 'GET');
}

/**
 * 获取笔记详细数据统计（7天/30天）
 * API: GET /api/galaxy/creator/data/note_detail_new?noteId={noteId}
 */
async function fetchNoteDetailStats(noteId: string): Promise<any> {
  console.log(`${TAG} [fetchNoteDetailStats] noteId=${noteId}`);
  const params = new URLSearchParams({ noteId });
  const result = await signedCreatorFetch(`/api/galaxy/creator/data/note_detail_new?${params}`, 'GET');
  console.log(`${TAG} [fetchNoteDetailStats] result success=${result?.success} hasSeven=${!!result?.data?.seven} hasThirty=${!!result?.data?.thirty}`);
  return result;
}

async function postComment(noteId: string, content: string, targetCommentId?: string, atUsers: any[] = []): Promise<any> {
  console.log(`${TAG} [postComment] noteId=${noteId} contentLen=${content.length} targetCommentId=${targetCommentId || 'N/A'}`);
  const body: Record<string, any> = {
    note_id: noteId,
    content,
    at_users: atUsers,
  };
  if (targetCommentId) {
    body.target_comment_id = targetCommentId;
  }
  console.log(`${TAG} [postComment] body=${JSON.stringify(body)}`);
  const result = await signedFetch('/api/sns/web/v1/comment/post', 'POST', JSON.stringify(body));
  console.log(`${TAG} [postComment] result code=${result?.code} success=${result?.success}`);
  return result;
}

async function searchUsers(keyword: string, page: number = 1, rows: number = 30): Promise<any> {
  console.log(`${TAG} [searchUsers] keyword=${keyword} page=${page} rows=${rows}`);
  const apiPath = `/api/sns/web/v1/intimacy/intimacy_list/search?keyword=${encodeURIComponent(keyword)}&page=${page}&rows=${rows}`;
  const result = await signedFetch(apiPath, 'GET');
  console.log(`${TAG} [searchUsers] result code=${result?.code} success=${result?.success} items=${result?.data?.items?.length || 0}`);
  return result;
}

async function getIntimacyList(): Promise<any> {
  console.log(`${TAG} [getIntimacyList] fetching full intimacy list`);
  const apiPath = XHS_API_ENDPOINTS.INTIMACY_LIST;
  const result = await signedFetch(apiPath, 'GET');
  console.log(`${TAG} [getIntimacyList] result code=${result?.code} success=${result?.success} items=${result?.data?.items?.length || 0}`);
  return result;
}

async function likeNote(noteId: string): Promise<any> {
  console.log(`${TAG} [likeNote] noteId=${noteId}`);
  const body = JSON.stringify({ note_oid: noteId });
  console.log(`${TAG} [likeNote] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.LIKE, 'POST', body);
  console.log(`${TAG} [likeNote] result code=${result?.code} success=${result?.success} new_like=${result?.data?.new_like}`);
  return result;
}

async function unlikeNote(noteId: string): Promise<any> {
  console.log(`${TAG} [unlikeNote] noteId=${noteId}`);
  const body = JSON.stringify({ note_oid: noteId });
  console.log(`${TAG} [unlikeNote] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.DISLIKE, 'POST', body);
  console.log(`${TAG} [unlikeNote] result code=${result?.code} success=${result?.success} like_count=${result?.data?.like_count}`);
  return result;
}

async function followUser(targetUserId: string): Promise<any> {
  console.log(`${TAG} [followUser] targetUserId=${targetUserId}`);
  const body = JSON.stringify({ target_user_id: targetUserId });
  console.log(`${TAG} [followUser] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.FOLLOW, 'POST', body);
  console.log(`${TAG} [followUser] result code=${result?.code} success=${result?.success} fstatus=${result?.data?.fstatus}`);
  return result;
}

async function unfollowUser(targetUserId: string): Promise<any> {
  console.log(`${TAG} [unfollowUser] targetUserId=${targetUserId}`);
  const body = JSON.stringify({ target_user_id: targetUserId });
  console.log(`${TAG} [unfollowUser] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.UNFOLLOW, 'POST', body);
  console.log(`${TAG} [unfollowUser] result code=${result?.code} success=${result?.success} fstatus=${result?.data?.fstatus}`);
  return result;
}

async function collectNote(noteId: string): Promise<any> {
  console.log(`${TAG} [collectNote] noteId=${noteId}`);
  const body = JSON.stringify({ note_id: noteId });
  console.log(`${TAG} [collectNote] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.COLLECT, 'POST', body);
  console.log(`${TAG} [collectNote] result code=${result?.code} success=${result?.success}`);
  return result;
}

async function deleteNote(noteId: string): Promise<any> {
  console.log(`${TAG} [deleteNote] noteId=${noteId}`);
  const body = JSON.stringify({ note_id: noteId });
  console.log(`${TAG} [deleteNote] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.NOTE_DELETE, 'POST', body, {
    'referer': 'https://creator.xiaohongshu.com/',
    'content-type': 'application/json',
  });
  console.log(`${TAG} [deleteNote] result code=${result?.code} success=${result?.success}`);
  return result;
}

async function getFriendFans(cursor: string = '', size: number = 20): Promise<any> {
  const params = new URLSearchParams({ cursor, size: String(size) });
  return signedFetch(`/api/sns/capa/servicegw/note_privacy/user/friend_fans?${params}`, 'GET', undefined, {
    'referer': 'https://creator.xiaohongshu.com/',
  });
}

// ── 合集管理 ──────────────────────────────────────────────────────────────────

async function uploadCollectionCover(imageBase64: string, mimeType = 'image/jpeg'): Promise<{ fieldId: string; width: number; height: number }> {
  const permit = await getUploadPermit('image', 'web');
  const { fileId, expireTime, token, uploadHost, xt } = permit;
  const message = `${xt};${expireTime}`;

  const binaryStr = atob(imageBase64);
  const fileBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) fileBytes[i] = binaryStr.charCodeAt(i);
  const fileSize = fileBytes.length;

  const blob = new Blob([fileBytes], { type: mimeType });
  let width = 0, height = 0;
  try {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch (e) {
    console.warn(`${TAG} [uploadCollectionCover] Could not get image dimensions`);
  }

  const signature = await getUploadSignature(message, fileId, fileSize, uploadHost);
  const authHeader = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=&q-signature=${signature}`;
  const uploadHostFull = uploadHost.startsWith('http') ? uploadHost : `https://${uploadHost}`;

  const putResponse = await fetch(`${uploadHostFull}/spectrum/${fileId}`, {
    method: 'PUT',
    headers: {
      'accept': '*/*',
      'authorization': authHeader,
      'origin': 'https://creator.xiaohongshu.com',
      'referer': 'https://creator.xiaohongshu.com/',
      'x-cos-security-token': token,
    },
    body: fileBytes,
    credentials: 'omit',
  });
  if (!putResponse.ok && putResponse.status !== 409) {
    const text = await putResponse.text();
    throw new Error(`COS upload collection cover ${putResponse.status}: ${text.slice(0, 200)}`);
  }

  return { fieldId: `spectrum/${fileId}`, width, height };
}

async function createCollection(name: string, desc: string, coverBase64?: string, coverMime = 'image/jpeg'): Promise<any> {
  let image = { field_id: '', file_name: '', width: '0', height: '0' };
  if (coverBase64) {
    const cover = await uploadCollectionCover(coverBase64, coverMime);
    image = { field_id: cover.fieldId, file_name: '', width: String(cover.width), height: String(cover.height) };
  }
  const body = JSON.stringify({ name, desc, type: 2, image });
  return signedFetch('/api/sns/v1/note/collection/pc/create', 'POST', body, { 'referer': 'https://creator.xiaohongshu.com/' });
}

async function listCollections(cursor: string = ''): Promise<any> {
  const body = JSON.stringify({ cursor, need_type_list: [2], target_uid: '' });
  return signedFetch('/api/sns/v1/note/collection/pc/list_v2', 'POST', body, { 'referer': 'https://creator.xiaohongshu.com/' });
}

async function listCollectionNotes(collectionId: string): Promise<any> {
  return signedFetch(`/api/sns/v1/note/collection/pc/list_note_v2?collection_id=${encodeURIComponent(collectionId)}`, 'GET', undefined, { 'referer': 'https://creator.xiaohongshu.com/' });
}

async function updateCollection(collectionId: string, name: string, desc: string, coverBase64?: string, coverMime = 'image/jpeg'): Promise<any> {
  let image = { field_id: '', width: 0, height: 0 };
  if (coverBase64) {
    const cover = await uploadCollectionCover(coverBase64, coverMime);
    image = { field_id: cover.fieldId, width: cover.width, height: cover.height };
  }
  const body = JSON.stringify({ collection_id: collectionId, name, desc, image });
  return signedFetch('/api/sns/v1/note/collection/pc/update', 'POST', body, { 'referer': 'https://creator.xiaohongshu.com/' });
}

async function deleteComment(noteId: string, commentId: string): Promise<any> {
  console.log(`${TAG} [deleteComment] noteId=${noteId} commentId=${commentId}`);
  const body = JSON.stringify({ note_id: noteId, comment_id: commentId });
  console.log(`${TAG} [deleteComment] body=${body}`);
  const result = await signedFetch(XHS_API_ENDPOINTS.COMMENT_DELETE, 'POST', body);
  console.log(`${TAG} [deleteComment] result code=${result?.code} success=${result?.success}`);
  return result;
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
        const data = await fetchHomefeed({
          cursor_score: message.cursor_score,
          category: message.category,
          refresh_type: message.refresh_type,
          num: message.num,
          note_index: message.note_index,
          unread_begin_note_id: message.unread_begin_note_id,
          unread_end_note_id: message.unread_end_note_id,
          unread_note_count: message.unread_note_count,
          search_key: message.search_key,
          need_num: message.need_num,
          image_formats: message.image_formats,
          need_filter_image: message.need_filter_image,
        });
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
        if (!message.note_id) { sendResponse({ success: false, error: 'note_id is required' }); return; }
        const data = await fetchFeed(
          String(message.note_id),
          String(message.xsec_token || ''),
          String(message.xsec_source || 'pc_search'),
        );
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
        if (!message.keyword) { sendResponse({ success: false, error: 'keyword is required' }); return; }
        if (!message.page_size) { sendResponse({ success: false, error: 'page_size is required' }); return; }
        const data = await searchNotes(
          String(message.keyword),
          String(message.cursor || ''),
          Number(message.page_size),
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
        if (!message.user_id) { sendResponse({ success: false, error: 'user_id is required' }); return; }
        const data = await fetchUserNotes(
          String(message.user_id),
          String(message.cursor || ''),
          String(message.xsec_token || ''),
          String(message.xsec_source || 'pc_user'),
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
        if (!message.note_id) { sendResponse({ success: false, error: 'note_id is required' }); return; }
        const data = await fetchComments(
          String(message.note_id),
          String(message.cursor || ''),
          String(message.xsec_token || ''),
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
        if (!message.note_id) { sendResponse({ success: false, error: 'note_id is required' }); return; }
        const data = await fetchFeed(
          String(message.note_id),
          String(message.xsec_token || ''),
          String(message.xsec_source || 'pc_search'),
        );
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
          privacyUserIds: message.privacy_user_ids || [],
          topics: message.topics || [],
          scheduledPublishTime: message.scheduled_publish_time ? Number(message.scheduled_publish_time) : undefined,
        });
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.PUBLISH_VIDEO_NOTE) {
    (async () => {
      try {
        if (!message.video) { sendResponse({ success: false, error: 'video is required' }); return; }
        const data = await publishVideoNote({
          title: String(message.title || ''),
          desc: String(message.desc || ''),
          video: message.video,
          privacyType: Number(message.privacy_type ?? 0),
          privacyUserIds: message.privacy_user_ids || [],
          topics: message.topics || [],
          scheduledPublishTime: message.scheduled_publish_time ? Number(message.scheduled_publish_time) : undefined,
          cover: message.cover || undefined,
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
        const result = await requestSignHealth();
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        console.error(`${TAG} CHECK_SIGN_HEALTH error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 新增 API 端点 ─────────────────────────────────────────────────────────────

  if (message.type === XHS_MSG_TYPE.FETCH_NOTE_COMMENTS) {
    (async () => {
      try {
        if (!message.note_id) { sendResponse({ success: false, error: 'note_id is required' }); return; }
        const data = await fetchComments(
          String(message.note_id),
          String(message.cursor || ''),
          String(message.xsec_token || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_USER_INFO) {
    (async () => {
      try {
        if (!message.user_id) { sendResponse({ success: false, error: 'user_id is required' }); return; }
        const data = await fetchUserInfo(String(message.user_id));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.SEARCH_TOPICS) {
    (async () => {
      try {
        if (!message.keyword) { sendResponse({ success: false, error: 'keyword is required' }); return; }
        const data = await searchTopics(String(message.keyword));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_NOTIFICATIONS) {
    (async () => {
      try {
        const notifType = message.notification_type;
        if (notifType !== 'mentions' && notifType !== 'likes') {
          sendResponse({ success: false, error: 'notification_type must be mentions or likes' });
          return;
        }
        const data = await fetchNotifications(notifType, String(message.cursor || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.SEARCH_FILTER) {
    (async () => {
      try {
        if (!message.keyword) { sendResponse({ success: false, error: 'keyword is required' }); return; }
        const data = await fetchSearchFilter(
          String(message.keyword),
          String(message.search_id || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_PUBLISHED_NOTES) {
    (async () => {
      try {
        const data = await fetchPublishedNotes(String(message.page || '0'));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_NOTE_DETAIL_STATS) {
    (async () => {
      try {
        if (!message.note_id) {
          sendResponse({ success: false, error: 'note_id is required' });
          return;
        }
        const data = await fetchNoteDetailStats(String(message.note_id));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.POST_COMMENT) {
    console.log(`${TAG} [POST_COMMENT] received message:`, JSON.stringify(message));
    (async () => {
      try {
        if (!message.note_id) {
          console.log(`${TAG} [POST_COMMENT] validation failed: note_id is required`);
          sendResponse({ success: false, error: 'note_id is required' });
          return;
        }
        if (!message.content) {
          console.log(`${TAG} [POST_COMMENT] validation failed: content is required`);
          sendResponse({ success: false, error: 'content is required' });
          return;
        }
        console.log(`${TAG} [POST_COMMENT] calling postComment...`);
        const data = await postComment(
          String(message.note_id),
          String(message.content),
          message.target_comment_id ? String(message.target_comment_id) : undefined,
          message.at_users || [],
        );
        console.log(`${TAG} [POST_COMMENT] success, data:`, JSON.stringify(data).slice(0, 200));
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [POST_COMMENT] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.SEARCH_USERS) {
    console.log(`${TAG} [SEARCH_USERS] received message:`, JSON.stringify(message));
    (async () => {
      try {
        if (!message.keyword) {
          console.log(`${TAG} [SEARCH_USERS] validation failed: keyword is required`);
          sendResponse({ success: false, error: 'keyword is required' });
          return;
        }
        console.log(`${TAG} [SEARCH_USERS] calling searchUsers...`);
        const data = await searchUsers(
          String(message.keyword),
          message.page ? Number(message.page) : 1,
          message.rows ? Number(message.rows) : 30,
        );
        console.log(`${TAG} [SEARCH_USERS] success, items:`, data?.data?.items?.length || 0);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [SEARCH_USERS] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.GET_INTIMACY_LIST) {
    console.log(`${TAG} [GET_INTIMACY_LIST] received message:`, JSON.stringify(message));
    (async () => {
      try {
        console.log(`${TAG} [GET_INTIMACY_LIST] calling getIntimacyList...`);
        const data = await getIntimacyList();
        console.log(`${TAG} [GET_INTIMACY_LIST] success, items:`, data?.data?.items?.length || 0);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [GET_INTIMACY_LIST] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.LIKE_NOTE) {
    (async () => {
      try {
        console.log(`${TAG} [LIKE_NOTE] received note_oid=${message.note_oid}`);
        const data = await likeNote(String(message.note_oid));
        console.log(`${TAG} [LIKE_NOTE] success code=${data?.code} new_like=${data?.data?.new_like}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [LIKE_NOTE] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.UNLIKE_NOTE) {
    (async () => {
      try {
        console.log(`${TAG} [UNLIKE_NOTE] received note_oid=${message.note_oid}`);
        const data = await unlikeNote(String(message.note_oid));
        console.log(`${TAG} [UNLIKE_NOTE] success code=${data?.code} like_count=${data?.data?.like_count}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [UNLIKE_NOTE] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FOLLOW_USER) {
    (async () => {
      try {
        console.log(`${TAG} [FOLLOW_USER] received target_user_id=${message.target_user_id}`);
        const data = await followUser(String(message.target_user_id));
        console.log(`${TAG} [FOLLOW_USER] success code=${data?.code} fstatus=${data?.data?.fstatus}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [FOLLOW_USER] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.UNFOLLOW_USER) {
    (async () => {
      try {
        console.log(`${TAG} [UNFOLLOW_USER] received target_user_id=${message.target_user_id}`);
        const data = await unfollowUser(String(message.target_user_id));
        console.log(`${TAG} [UNFOLLOW_USER] success code=${data?.code} fstatus=${data?.data?.fstatus}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [UNFOLLOW_USER] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.COLLECT_NOTE) {
    (async () => {
      try {
        console.log(`${TAG} [COLLECT_NOTE] received note_id=${message.note_id}`);
        const data = await collectNote(String(message.note_id));
        console.log(`${TAG} [COLLECT_NOTE] success code=${data?.code}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [COLLECT_NOTE] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.DELETE_NOTE) {
    (async () => {
      try {
        console.log(`${TAG} [DELETE_NOTE] received note_id=${message.note_id}`);
        const data = await deleteNote(String(message.note_id));
        console.log(`${TAG} [DELETE_NOTE] success code=${data?.code}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [DELETE_NOTE] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.DELETE_COMMENT) {
    (async () => {
      try {
        console.log(`${TAG} [DELETE_COMMENT] received note_id=${message.note_id} comment_id=${message.comment_id}`);
        const data = await deleteComment(String(message.note_id), String(message.comment_id));
        console.log(`${TAG} [DELETE_COMMENT] success code=${data?.code}`);
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [DELETE_COMMENT] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.GET_FRIEND_FANS) {
    (async () => {
      try {
        const data = await getFriendFans(
          String(message.cursor || ''),
          message.size ? Number(message.size) : 20,
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [GET_FRIEND_FANS] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.CREATE_COLLECTION) {
    (async () => {
      try {
        if (!message.name) { sendResponse({ success: false, error: 'name is required' }); return; }
        const data = await createCollection(
          String(message.name),
          String(message.desc || ''),
          message.cover?.base64,
          message.cover?.mimeType,
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [CREATE_COLLECTION] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.LIST_COLLECTIONS) {
    (async () => {
      try {
        const data = await listCollections(String(message.cursor || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [LIST_COLLECTIONS] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.LIST_COLLECTION_NOTES) {
    (async () => {
      try {
        if (!message.collection_id) { sendResponse({ success: false, error: 'collection_id is required' }); return; }
        const data = await listCollectionNotes(String(message.collection_id));
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [LIST_COLLECTION_NOTES] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.UPDATE_COLLECTION) {
    (async () => {
      try {
        if (!message.collection_id) { sendResponse({ success: false, error: 'collection_id is required' }); return; }
        if (!message.name) { sendResponse({ success: false, error: 'name is required' }); return; }
        const data = await updateCollection(
          String(message.collection_id),
          String(message.name),
          String(message.desc || ''),
          message.cover?.base64,
          message.cover?.mimeType,
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        console.error(`${TAG} [UPDATE_COLLECTION] error:`, e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'START_XHS_PUBLISH_VIDEO_TASK') {
    const { taskId, uploadSessionId, mimeType, totalBytes, transferChunkCount, params } = message;
    console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] START taskId=${taskId} mimeType=${mimeType} totalBytes=${totalBytes} chunks=${transferChunkCount}`);
    console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] params title="${params?.title}" desc="${params?.desc?.slice(0,30)}" privacy=${params?.privacy_type}`);

    // 立即发送响应，避免消息通道超时关闭
    sendResponse({ success: true });

    // 异步执行任务，通过 TASK_PROGRESS_FROM_CONTENT / TASK_COMPLETED_FROM_CONTENT / TASK_FAILED_FROM_CONTENT 报告状态
    (async () => {
      try {
        // 1. 获取上传许可
        const permit = await getUploadPermit('video');
        const { fileId, expireTime, token, uploadHost, xt } = permit;
        const message = `${xt};${expireTime}`;
        const uploadHostFull = `https://${uploadHost}`;
        const path = `/spectrum/${fileId}`;

        console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Got upload permit fileId=${fileId} host=${uploadHost}`);

        // 2. Init multipart upload
        const initSig = await calcCosSignature(message, 'post', path, 'uploads=', 0, uploadHost);
        const initAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=uploads&q-signature=${initSig}`;

        const initResp = await fetch(`${uploadHostFull}${path}?uploads`, {
          method: 'POST',
          headers: {
            'authorization': initAuth,
            'content-length': '0',
            'origin': 'https://creator.xiaohongshu.com',
            'referer': 'https://creator.xiaohongshu.com/',
            'x-cos-security-token': token,
          },
          credentials: 'omit',
        });
        if (!initResp.ok) {
          const text = await initResp.text();
          throw new Error(`COS init multipart ${initResp.status}: ${text.slice(0, 300)}`);
        }
        const initXml = await initResp.text();
        const uploadIdMatch = initXml.match(/<UploadId>([^<]+)<\/UploadId>/);
        if (!uploadIdMatch) throw new Error(`COS init: no UploadId in response: ${initXml.slice(0, 200)}`);
        const uploadId = uploadIdMatch[1];
        console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Init OK uploadId=${uploadId}`);

        chrome.runtime.sendMessage({
          type: 'TASK_PROGRESS_FROM_CONTENT',
          taskId,
          phase: 'init_upload',
          progress: 0.15,
        });

        // 3. 流式上传：边接收边上传（对齐 Twitter 的做法）
        const PART_SIZE = 5 * 1024 * 1024;  // 5MB per part
        const totalParts = Math.ceil(totalBytes / PART_SIZE);
        const etags: string[] = [];
        let currentPartNumber = 1;
        let currentPartData = new Uint8Array(0);

        console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Starting streaming upload totalParts=${totalParts} partSize=${PART_SIZE}`);

        for (let chunkIndex = 0; chunkIndex < transferChunkCount; chunkIndex++) {
          // 从 bg session 拉取一个 chunk
          console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Fetching chunk ${chunkIndex}/${transferChunkCount}`);
          const resp = await chrome.runtime.sendMessage({
            type: 'GET_UPLOAD_SESSION_CHUNK',
            uploadSessionId,
            chunkIndex: chunkIndex,
          });
          if (!resp?.success || !resp.chunkBase64) {
            throw new Error(resp?.error || `Failed to get chunk ${chunkIndex}`);
          }

          // 解码 chunk
          const binary = atob(resp.chunkBase64);
          const chunkBytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) chunkBytes[j] = binary.charCodeAt(j);
          console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Chunk ${chunkIndex} fetched, size=${chunkBytes.length}`);

          // 合并到当前 part buffer
          const newBuffer = new Uint8Array(currentPartData.length + chunkBytes.length);
          newBuffer.set(currentPartData, 0);
          newBuffer.set(chunkBytes, currentPartData.length);
          currentPartData = newBuffer;

          // 当累积的数据足够一个 part 时，上传
          while (currentPartData.length >= PART_SIZE || (chunkIndex === transferChunkCount - 1 && currentPartData.length > 0)) {
            const partData = currentPartData.length >= PART_SIZE
              ? currentPartData.slice(0, PART_SIZE)
              : currentPartData;
            const partSize = partData.length;

            // 上传这个 part
            const urlParams = `partnumber=${currentPartNumber}&uploadid=${uploadId}`;
            const partSig = await calcCosSignature(message, 'put', path, urlParams, partSize, uploadHost);
            const partAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=partnumber;uploadid&q-signature=${partSig}`;

            const partResp = await fetch(`${uploadHostFull}${path}?partNumber=${currentPartNumber}&uploadId=${uploadId}`, {
              method: 'PUT',
              headers: {
                'authorization': partAuth,
                'content-length': String(partSize),
                'origin': 'https://creator.xiaohongshu.com',
                'referer': 'https://creator.xiaohongshu.com/',
                'x-cos-security-token': token,
              },
              body: partData,
              credentials: 'omit',
            });
            if (!partResp.ok) {
              const text = await partResp.text();
              throw new Error(`COS upload part ${currentPartNumber}/${totalParts} ${partResp.status}: ${text.slice(0, 300)}`);
            }

            const etag = partResp.headers.get('etag') || partResp.headers.get('ETag') || '';
            if (!etag) console.warn(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] part ${currentPartNumber} got empty ETag`);
            etags.push(etag);
            console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Part ${currentPartNumber}/${totalParts} uploaded, etag=${etag}, size=${partSize}`);

            // 更新进度
            const progress = 0.15 + 0.75 * (currentPartNumber / totalParts);
            chrome.runtime.sendMessage({
              type: 'TASK_PROGRESS_FROM_CONTENT',
              taskId,
              phase: 'uploading',
              progress,
            });

            // 从 buffer 中移除已上传的数据
            currentPartData = currentPartData.slice(partSize);
            currentPartNumber++;
          }

          // ✅ chunk 已处理完毕，可以释放（对齐 Twitter 的 onChunkUploaded）
          console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK} Chunk ${chunkIndex} processed and released`);
        }

        // 4. Complete multipart upload
        const completeXml = `<CompleteMultipartUpload>${etags.map((etag, i) =>
          `<Part><PartNumber>${i + 1}</PartNumber><ETag>${etag}</ETag></Part>`
        ).join('')}</CompleteMultipartUpload>`;
        const completeBytes = new TextEncoder().encode(completeXml);

        const completeSig = await calcCosSignature(message, 'post', path, `uploadid=${uploadId}`, completeBytes.length, uploadHost);
        const completeAuth = `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${message}&q-key-time=${message}&q-header-list=content-length;host&q-url-param-list=uploadid&q-signature=${completeSig}`;

        console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Completing multipart uploadId=${uploadId}`);
        const completeResp = await fetch(`${uploadHostFull}${path}?uploadId=${uploadId}`, {
          method: 'POST',
          headers: {
            'authorization': completeAuth,
            'content-length': String(completeBytes.length),
            'content-type': 'application/xml',
            'origin': 'https://creator.xiaohongshu.com',
            'referer': 'https://creator.xiaohongshu.com/',
            'x-cos-security-token': token,
          },
          body: completeBytes,
          credentials: 'omit',
        });
        if (!completeResp.ok) {
          const text = await completeResp.text();
          throw new Error(`COS complete multipart ${completeResp.status}: ${text.slice(0, 300)}`);
        }
        console.log(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] Upload complete fileId=${fileId}`);

        const videoUpload = { fileId, fileSize: totalBytes, mimeType };

        chrome.runtime.sendMessage({
          type: 'TASK_PROGRESS_FROM_CONTENT',
          taskId,
          phase: 'publishing',
          progress: 0.9,
        });

        // 5. 发布笔记
        const result = await publishVideoNote({
          title: params?.title || '',
          desc: params?.desc || '',
          videoUpload,  // 传递已上传的视频信息
          cover: params?.cover,
          privacyType: params?.privacy_type ?? 0,
          privacyUserIds: params?.privacy_user_ids,
          scheduledPublishTime: params?.scheduled_publish_time,
          topics: params?.topics,
          videoMetadata: params?.videoMetadata,
        });

        // 6. 上报完成
        await chrome.runtime.sendMessage({
          type: 'TASK_COMPLETED_FROM_CONTENT',
          taskId,
          contentType: 'application/json',
          resultBase64: btoa(JSON.stringify(result)),
        });
      } catch (e: any) {
        console.error(`${TAG} [START_XHS_PUBLISH_VIDEO_TASK] error:`, e.message);
        await chrome.runtime.sendMessage({
          type: 'TASK_FAILED_FROM_CONTENT',
          taskId,
          phase: 'publish',
          errorCode: 'PUBLISH_FAILED',
          errorMessage: e?.message || String(e),
        });
      }
    })();
    return true;
  }

  return false;
});

console.log(`${TAG} Active. Sign inject script injected into page context.`);
