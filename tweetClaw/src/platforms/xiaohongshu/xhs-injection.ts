import { XHS_API_ENDPOINTS, XHS_MSG_TYPE } from './xhs-consts';

const TAG = '🛡️ [XhsClaw-Page]';

function isXhsApiUrl(url: string): string | null {
  const endpoints = Object.values(XHS_API_ENDPOINTS);
  for (const endpoint of endpoints) {
    if (url.includes(endpoint)) {
      return endpoint;
    }
  }
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
  try {
    const dataSize = new TextEncoder().encode(JSON.stringify(data)).length;
    console.log(
      `%c${TAG} 📡 Intercepted: %c${endpoint}%c (${dataSize} bytes)`,
      'color: #718096',
      'color: #FF2442; font-weight: bold',
      'color: #718096'
    );
  } catch (e) {}

  const xsSign = headers?.['x-s'] || null;
  const xt = headers?.['x-t'] || null;

  window.postMessage({
    source: 'xhsclaw-injection',
    type: XHS_MSG_TYPE.SIGNAL_CAPTURED,
    endpoint,
    apiUrl,
    pageUrl: window.location.href,
    method,
    requestBody,
    headers: {
      'x-s': xsSign,
      'x-t': xt,
    },
    data,
    timestamp: Date.now(),
  }, '*');
}

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

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

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
        const headers: Record<string, string> = {};

        const xsSign = this.getResponseHeader('x-s');
        const xt = this.getResponseHeader('x-t');
        if (xsSign) headers['x-s'] = xsSign;
        if (xt) headers['x-t'] = xt;

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

console.log(`${TAG} System initialized.`);
