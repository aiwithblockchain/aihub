/**
 * XHS Signer Host — 在 Service Worker 侧管理 Offscreen Document 生命周期
 *
 * 提供 signXhsRequest() 给 xhs-api.ts 调用，
 * 内部通过 chrome.runtime.sendMessage 与 Offscreen Document 中的 xhs-signer-page.ts 通信。
 */

const OFFSCREEN_URL = 'xhs-signer.html';
let offscreenCreating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  // chrome.offscreen 在 MV3 Service Worker 中可用
  const existingContexts = await (chrome as any).offscreen.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });

  if (existingContexts.length > 0) {
    return; // 已经存在
  }

  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = (chrome as any).offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['DOM_PARSER'],  // 签名 JS 需要 DOM 上下文
    justification: 'Execute XHS signature JavaScript that requires window/document objects',
  });

  try {
    await offscreenCreating;
  } finally {
    offscreenCreating = null;
  }
}

/**
 * 获取 a1 cookie（小红书设备指纹，生命周期数月）
 */
export async function getA1Cookie(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.cookies.get({ url: 'https://www.xiaohongshu.com', name: 'a1' }, (cookie) => {
      if (cookie?.value) {
        resolve(cookie.value);
      } else {
        reject(new Error('a1 cookie not found. Please log in to xiaohongshu.com first.'));
      }
    });
  });
}

export interface XhsSignResult {
  'x-s': string;
  'x-t': string;
  'x-s-common': string;
  'x-b3-traceid': string;
}

/**
 * 为小红书 PC 端请求生成签名头
 *
 * @param apiPath  接口路径，如 '/api/sns/web/v1/homefeed'
 * @param body     请求体字符串（GET 请求传空字符串）
 * @param method   'GET' | 'POST'
 */
export async function signXhsRequest(
  apiPath: string,
  body: string,
  method: 'GET' | 'POST' = 'POST'
): Promise<XhsSignResult> {
  await ensureOffscreenDocument();
  const a1 = await getA1Cookie();

  return new Promise((resolve, reject) => {
    const msgId = `xhs-sign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const listener = (message: any) => {
      if (message?.type === 'XHS_SIGN_RESULT' && message?.msgId === msgId) {
        chrome.runtime.onMessage.removeListener(listener);
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.result as XhsSignResult);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // 发消息到 Offscreen Document
    chrome.runtime.sendMessage({
      type: 'XHS_SIGN_REQUEST',
      msgId,
      a1,
      apiPath,
      body,
      method,
    });

    // 超时保护
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('XHS sign request timed out (5s)'));
    }, 5000);
  });
}

/**
 * 生成随机 x-b3-traceid（16位十六进制）
 */
export function generateTraceId(len = 16): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}
