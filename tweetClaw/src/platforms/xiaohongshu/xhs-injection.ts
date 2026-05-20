import { XHS_API_ENDPOINTS, XHS_MSG_TYPE } from './xhs-consts';

const TAG = '🛡️ [XhsClaw-Page]';

/**
 * 小红书页面注入脚本
 * 架构保留，暂不拦截任何数据
 * 未来可通过修改 isXhsApiUrl 和 postSignal 快速启用数据拦截
 */

// 监听来自 content script 的请求
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'xhsclaw-content') return;

  if (event.data.type === 'GET_ACCOUNT_INFO') {
    handleGetAccountInfo(event.data.requestId);
  }
});

async function handleGetAccountInfo(requestId: string) {
  try {
    const response = await fetch('https://edith.xiaohongshu.com/api/sns/web/v2/user/me', {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // 返回结果给 content script
    window.postMessage({
      source: 'xhsclaw-injection',
      type: 'ACCOUNT_INFO_RESPONSE',
      requestId,
      success: true,
      data,
    }, '*');
  } catch (error: any) {
    window.postMessage({
      source: 'xhsclaw-injection',
      type: 'ACCOUNT_INFO_RESPONSE',
      requestId,
      success: false,
      error: error.message,
    }, '*');
  }
}

function isXhsApiUrl(url: string): string | null {
  const endpoints = [XHS_API_ENDPOINTS.HOMEFEED, XHS_API_ENDPOINTS.FEED];
  for (const endpoint of endpoints) {
    if (url.includes(endpoint)) {
      return endpoint;
    }
  }
  return null;
}

function normalizeHeaders(headersLike: any): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headersLike) return normalized;

  try {
    if (typeof Headers !== 'undefined' && headersLike instanceof Headers) {
      headersLike.forEach((value, key) => {
        normalized[String(key).toLowerCase()] = String(value);
      });
      return normalized;
    }

    if (Array.isArray(headersLike)) {
      for (const entry of headersLike) {
        if (Array.isArray(entry) && entry.length >= 2) {
          normalized[String(entry[0]).toLowerCase()] = String(entry[1]);
        }
      }
      return normalized;
    }

    if (typeof headersLike.entries === 'function') {
      for (const [key, value] of headersLike.entries()) {
        normalized[String(key).toLowerCase()] = String(value);
      }
      return normalized;
    }

    for (const [key, value] of Object.entries(headersLike)) {
      normalized[String(key).toLowerCase()] = String(value as any);
    }
  } catch (error) {
    normalized.__normalize_error = error instanceof Error ? error.message : String(error);
  }

  return normalized;
}

function buildDebugHeaders(headers?: Record<string, string>) {
  return {
    'x-s': headers?.['x-s'] || null,
    'x-t': headers?.['x-t'] || null,
    'x-s-common': headers?.['x-s-common'] || null,
    'x-rap-param': headers?.['x-rap-param'] || null,
    'x-b3-traceid': headers?.['x-b3-traceid'] || null,
    'x-xray-traceid': headers?.['x-xray-traceid'] || null,
    'xy-direction': headers?.['xy-direction'] || null,
  };
}

function postSignal(
  endpoint: string,
  apiUrl: string,
  data: any,
  method: string = 'GET',
  requestBody?: any,
  headers?: Record<string, string>,
  debugMeta?: Record<string, any>
) {
  const payload = {
    source: 'xhsclaw-injection',
    type: XHS_MSG_TYPE.SIGNAL_CAPTURED,
    endpoint,
    apiUrl,
    pageUrl: window.location.href,
    method,
    requestBody,
    headers: buildDebugHeaders(headers),
    debugMeta: debugMeta || null,
    data,
    timestamp: Date.now(),
  };

  if ((window as any).__XHS_CLAW_DEBUG__) {
    console.log(`${TAG} HOMEFEED_CAPTURE ${JSON.stringify(payload)}`);
  }

  // 数据拦截后的处理逻辑
  // 未来需要时在这里实现数据转发
  window.postMessage(payload, '*');
}

// Fetch 拦截架构
const originalFetch = window.fetch;
window.fetch = function(...args: any[]): Promise<Response> {
  const requestInput = args[0];
  const requestInit = args[1];
  const url = typeof requestInput === 'string' ? requestInput : requestInput?.url;
  const endpoint = isXhsApiUrl(url);

  if (endpoint) {
    const requestHeaders = typeof Request !== 'undefined' && requestInput instanceof Request
      ? normalizeHeaders(requestInput.headers)
      : {};
    const initHeaders = normalizeHeaders(requestInit?.headers);
    const mergedHeaders = {
      ...requestHeaders,
      ...initHeaders,
    };

    let requestBody: any = undefined;
    try {
      if (requestInit?.body) {
        requestBody = JSON.parse(requestInit.body);
      }
    } catch (error) {
      requestBody = { __raw: String(requestInit?.body) };
    }

    const debugMeta = {
      requestInputType: requestInput?.constructor?.name || typeof requestInput,
      usedRequestObject: typeof Request !== 'undefined' && requestInput instanceof Request,
      requestObjectHeaders: buildDebugHeaders(requestHeaders),
      initHeaders: buildDebugHeaders(initHeaders),
      mergedHeaderKeys: Object.keys(mergedHeaders).sort(),
      hasRequestInit: Boolean(requestInit),
    };

    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();
      clonedResponse.json().then(data => {
        postSignal(endpoint, url, data, requestInit?.method || requestInput?.method || 'GET', requestBody, mergedHeaders, debugMeta);
      }).catch(() => {});
      return response;
    });
  }

  return originalFetch.apply(this, args);
};

// XMLHttpRequest 拦截架构
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.setRequestHeader = function(name: string, value: string) {
  const normalizedName = name.toLowerCase();
  if (
    normalizedName === 'x-s' ||
    normalizedName === 'x-t' ||
    normalizedName === 'x-s-common' ||
    normalizedName === 'x-rap-param' ||
    normalizedName === 'x-b3-traceid' ||
    normalizedName === 'x-xray-traceid' ||
    normalizedName === 'xy-direction'
  ) {
    if (!(this as any).__xhs_request_headers) {
      (this as any).__xhs_request_headers = {};
    }
    (this as any).__xhs_request_headers[normalizedName] = value;
  }
  return originalXHRSetRequestHeader.apply(this, [name, value]);
};

XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
  const urlString = url.toString();
  const endpoint = isXhsApiUrl(urlString);

  if (endpoint) {
    (this as any).__xhs_endpoint = endpoint;
    (this as any).__xhs_url = urlString;
    (this as any).__xhs_method = method;
  }

  return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function(body?: any) {
  const endpoint = (this as any).__xhs_endpoint;

  if (endpoint) {
    this.addEventListener('load', function() {
      try {
        const data = JSON.parse(this.responseText);
        const requestBody = body ? JSON.parse(body) : undefined;
        const headers = (this as any).__xhs_request_headers || {};

        postSignal(
          endpoint,
          (this as any).__xhs_url,
          data,
          (this as any).__xhs_method,
          requestBody,
          headers
        );
      } catch (e) {}
    });
  }

  return originalXHRSend.apply(this, [body]);
};

console.log(`${TAG} Injection architecture ready (data capture disabled).`);
