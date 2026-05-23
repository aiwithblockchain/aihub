/**
 * XHS Signer Page — 在 Offscreen Document 内执行签名 JS
 *
 * 监听来自 Service Worker 的 XHS_SIGN_REQUEST 消息，
 * 调用已加载的签名 JS 函数，返回签名结果。
 *
 * 签名 JS 文件通过 <script> 标签加载（xhs_main.js / xhs_rap.js），
 * 它们会在 window 上暴露签名函数。
 */

// 签名 JS 加载状态
let signJsLoaded = false;
let signJsLoadPromise: Promise<void> | null = null;

/**
 * 动态加载签名 JS 文件
 */
function loadSignJs(): Promise<void> {
  if (signJsLoaded) return Promise.resolve();
  if (signJsLoadPromise) return signJsLoadPromise;

  signJsLoadPromise = new Promise<void>((resolve, reject) => {
    const files = ['js/xhs_main.js'];
    let loaded = 0;

    for (const src of files) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = () => {
        loaded++;
        if (loaded === files.length) {
          signJsLoaded = true;
          console.log('[XHS-Signer] All sign JS files loaded');
          resolve();
        }
      };
      script.onerror = (e) => {
        reject(new Error(`Failed to load ${src}: ${e}`));
      };
      document.head.appendChild(script);
    }
  });

  return signJsLoadPromise;
}

/**
 * 生成随机 x-b3-traceid
 */
function generateTraceId(len = 16): string {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * 调用签名 JS 生成签名头
 */
function computeSign(a1: string, apiPath: string, body: string, method: string): {
  'x-s': string;
  'x-t': string;
  'x-s-common': string;
  'x-b3-traceid': string;
} {
  // Spider_XHS 的 xhs_main.js 暴露 get_request_headers_params(api, data, a1, method)
  // 返回 { xs, xt, xs_common }
  const w = window as any;

  if (typeof w.get_request_headers_params !== 'function') {
    throw new Error('get_request_headers_params not found. Sign JS may not be loaded correctly.');
  }

  const ret = w.get_request_headers_params(apiPath, body || '', a1, method || 'POST');

  return {
    'x-s': ret.xs || ret['X-s'] || '',
    'x-t': String(ret.xt || ret['X-t'] || ''),
    'x-s-common': ret.xs_common || ret['X-s-common'] || '',
    'x-b3-traceid': generateTraceId(),
  };
}

// 监听来自 Service Worker 的签名请求
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'XHS_SIGN_REQUEST') return false;

  const { msgId, a1, apiPath, body, method } = message;

  (async () => {
    try {
      await loadSignJs();
      const result = computeSign(a1, apiPath, body, method);

      // 通过 sendMessage 回传结果给 Service Worker
      chrome.runtime.sendMessage({
        type: 'XHS_SIGN_RESULT',
        msgId,
        result,
      });
    } catch (e: any) {
      chrome.runtime.sendMessage({
        type: 'XHS_SIGN_RESULT',
        msgId,
        error: e.message || 'Unknown sign error',
      });
    }
  })();

  // 返回 true 表示异步处理
  return true;
});

console.log('[XHS-Signer] Offscreen page ready, waiting for sign requests.');
