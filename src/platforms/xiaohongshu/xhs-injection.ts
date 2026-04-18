import { XHS_API_ENDPOINTS, XHS_MSG_TYPE } from './xhs-consts';

const TAG = '🛡️ [XhsClaw-Page]';

/**
 * 小红书页面注入脚本
 * 架构保留，暂不拦截任何数据
 * 未来可通过修改 isXhsApiUrl 和 postSignal 快速启用数据拦截
 */

function isXhsApiUrl(url: string): string | null {
  // 暂时不拦截任何 API
  // 未来需要时，取消注释以下代码：
  /*
  const endpoints = Object.values(XHS_API_ENDPOINTS);
  for (const endpoint of endpoints) {
    if (url.includes(endpoint)) {
      return endpoint;
    }
  }
  */
  return null;
}

function postSignal(
  endpoint: string,
  apiUrl: string,
  data: any,
  method: string = 'GET',
  requestBody?: any,
  headers?: Record<string, string>
) {
  // 数据拦截后的处理逻辑
  // 未来需要时在这里实现数据转发
  window.postMessage({
    source: 'xhsclaw-injection',
    type: XHS_MSG_TYPE.SIGNAL_CAPTURED,
    endpoint,
    apiUrl,
    pageUrl: window.location.href,
    method,
    requestBody,
    headers: {
      'x-s': headers?.['x-s'] || null,
      'x-t': headers?.['x-t'] || null,
    },
    data,
    timestamp: Date.now(),
  }, '*');
}

// Fetch 拦截架构
const originalFetch = window.fetch;
window.fetch = function(...args: any[]): Promise<Response> {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  const endpoint = isXhsApiUrl(url);

  if (endpoint) {
    const options = args[1] || {};
    const method = options.method || 'GET';
    const requestBody = options.body ? JSON.parse(options.body) : undefined;
    const headers = options.headers || {};

    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();
      clonedResponse.json().then(data => {
        postSignal(endpoint, url, data, method, requestBody, headers);
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
  if (name.toLowerCase() === 'x-s' || name.toLowerCase() === 'x-t') {
    if (!(this as any).__xhs_request_headers) {
      (this as any).__xhs_request_headers = {};
    }
    (this as any).__xhs_request_headers[name.toLowerCase()] = value;
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
