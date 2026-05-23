/**
 * XHS Sign Inject Script — 运行在小红书页面的 Page Context 中
 *
 * 职责：
 * 1. 监听来自 Content Script 的 window.postMessage 签名请求
 * 2. 调用页面原生的 window._webmsxyw(url, data, a1) 进行签名
 * 3. 将签名结果通过 window.postMessage 返回给 Content Script
 *
 * 通信协议：
 * - 请求: { type: 'XHS_SIGN_REQUEST', msgId, url, data }
 * - 响应: { type: 'XHS_SIGN_RESPONSE', msgId, success, result?, error? }
 */

const TAG = '[XhsClaw-Sign-Inject]';

interface SignRequest {
  type: 'XHS_SIGN_REQUEST';
  msgId: string;
  url: string;   // API 路径，如 '/api/sns/web/v1/homefeed'
  data: string;  // 请求体（GET 传空字符串）
}

interface SignResponse {
  type: 'XHS_SIGN_RESPONSE';
  msgId: string;
  success: boolean;
  result?: {
    'x-s': string;
    'x-t': string;
    'x-s-common'?: string;
  };
  error?: string;
}

function getCookieValue(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * 尝试从页面中提取 x-s-common
 * 策略：拦截 XHR 请求，捕获实际使用的 x-s-common 值
 */
let cachedXsCommon: string | null = null;

function extractXsCommon(): string | null {
  if (cachedXsCommon) {
    return cachedXsCommon;
  }

  // 尝试从 localStorage 获取
  try {
    const stored = localStorage.getItem('x-s-common') || sessionStorage.getItem('x-s-common');
    if (stored && stored.length > 1000) {
      cachedXsCommon = stored;
      console.log(`${TAG} Found x-s-common in storage: ${stored.slice(0, 50)}...`);
      return stored;
    }
  } catch (e) {
    // ignore
  }

  // 拦截 XHR 来捕获 x-s-common
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header: string, value: string) {
    if (header.toLowerCase() === 'x-s-common' && value.length > 1000) {
      cachedXsCommon = value;
      console.log(`${TAG} Captured x-s-common from XHR: ${value.slice(0, 50)}...`);
    }
    return originalSetRequestHeader.apply(this, arguments as any);
  };

  return null;
}

// ── 等待 _webmsxyw 可用 + 安装 XHR 拦截器 ────────────────────────────────────

let signReady = false;

// 立即安装 XHR 拦截器以捕获 x-s-common
extractXsCommon();

function waitForSignFn(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof (window as any)._webmsxyw === 'function') {
      signReady = true;
      resolve();
      return;
    }

    let attempts = 0;
    const maxAttempts = 50; // 50 * 200ms = 10s 最多等 10 秒
    const timer = setInterval(() => {
      attempts++;
      if (typeof (window as any)._webmsxyw === 'function') {
        clearInterval(timer);
        signReady = true;
        console.log(`${TAG} _webmsxyw ready after ${attempts * 200}ms`);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
        console.error(`${TAG} _webmsxyw not available after ${maxAttempts * 200}ms`);
        resolve(); // 不 reject，让后续请求报具体错误
      }
    }, 200);
  });
}

const signFnReady = waitForSignFn();

// ── 签名请求处理 ─────────────────────────────────────────────────────────────

async function handleSignRequest(event: MessageEvent) {
  const msg = event.data as SignRequest;

  // 只处理我们自己的消息
  if (!msg || msg.type !== 'XHS_SIGN_REQUEST') return;
  // 安全校验：只接受同源消息
  if (event.source !== window) return;

  const { msgId, url, data } = msg;

  console.log(`${TAG} Received sign request: msgId=${msgId}, url=${url}, dataLen=${data?.length || 0}`);

  // 等待签名函数就绪
  if (!signReady) {
    console.log(`${TAG} Waiting for _webmsxyw to be ready...`);
    await signFnReady;
  }

  try {
    const signFn = (window as any)._webmsxyw;

    if (typeof signFn !== 'function') {
      const errorMsg = '_webmsxyw not found on window. Page may not be fully loaded.';
      console.error(`${TAG} ${errorMsg}`);
      postResponse({ type: 'XHS_SIGN_RESPONSE', msgId, success: false, error: errorMsg });
      return;
    }

    // 获取 a1 cookie（设备指纹）
    const a1 = getCookieValue('a1');
    if (!a1) {
      const errorMsg = 'a1 cookie not found. Please ensure you are logged in.';
      console.error(`${TAG} ${errorMsg}`);
      postResponse({ type: 'XHS_SIGN_RESPONSE', msgId, success: false, error: errorMsg });
      return;
    }

    // 调用签名函数：_webmsxyw(url, data, a1)
    // 返回值格式: { "X-s": "...", "X-t": "...", "X-s-common": "..." }
    const signResult = signFn(url, data, a1);

    console.log(`${TAG} Sign success: msgId=${msgId}, keys=${Object.keys(signResult || {}).join(',')}`);

    const result: any = {
      'x-s': signResult['X-s'] || signResult['x-s'] || '',
      'x-t': String(signResult['X-t'] || signResult['x-t'] || ''),
    };

    // x-s-common 不由 _webmsxyw 生成，需要从页面中提取
    const xsCommon = extractXsCommon();
    if (xsCommon) {
      result['x-s-common'] = xsCommon;
      console.log(`${TAG} Added x-s-common: ${xsCommon.slice(0, 50)}...`);
    } else {
      console.warn(`${TAG} x-s-common not available yet (will be captured from first XHR request)`);
    }

    postResponse({
      type: 'XHS_SIGN_RESPONSE',
      msgId,
      success: true,
      result,
    });
  } catch (e: any) {
    console.error(`${TAG} Sign error: msgId=${msgId}`, e);
    postResponse({
      type: 'XHS_SIGN_RESPONSE',
      msgId,
      success: false,
      error: e.message || 'Unknown sign error',
    });
  }
}

function postResponse(resp: SignResponse) {
  window.postMessage(resp, '*');
}

// 注册监听
window.addEventListener('message', (event) => handleSignRequest(event));

// ── Self-test：等 _webmsxyw 就绪后自动测试一次 ──────────────────────────────────

signFnReady.then(() => {
  const signFn = (window as any)._webmsxyw;
  const a1 = getCookieValue('a1');
  console.log(`${TAG} Self-test: _webmsxyw=${typeof signFn}, a1=${a1 ? a1.slice(0, 8) + '...' : 'NOT_FOUND'}`);

  if (typeof signFn === 'function' && a1) {
    try {
      const result = signFn('/api/sns/web/v2/user/me', '', a1);
      console.log(`${TAG} Self-test _webmsxyw result keys:`, Object.keys(result).join(','));
      console.log(`${TAG} Self-test x-s:`, result['X-s']?.slice(0, 30) + '...');
      console.log(`${TAG} Self-test x-t:`, result['X-t']);

      const xsCommon = extractXsCommon();
      if (xsCommon) {
        console.log(`${TAG} Self-test x-s-common (extracted):`, xsCommon.slice(0, 50) + '...');
      } else {
        console.log(`${TAG} Self-test: x-s-common not yet captured (will be available after first XHR request)`);
      }
    } catch (e: any) {
      console.error(`${TAG} Self-test sign error:`, e.message);
    }
  }
});

console.log(`${TAG} Inject script loaded, waiting for _webmsxyw...`);
