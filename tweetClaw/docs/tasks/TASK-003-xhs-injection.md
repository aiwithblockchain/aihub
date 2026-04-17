# TASK-003: 小红书注入脚本实现

**优先级:** P1  
**预计时间:** 1.5天  
**依赖:** TASK-002

## 目标

实现小红书页面注入脚本,拦截 API 请求并捕获数据。

## 实现内容

### 1. 创建注入脚本

**文件:** `src/platforms/xiaohongshu/xhs-injection.ts`

```typescript
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

  // 提取认证信息
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

// 拦截 fetch 请求
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

// 拦截 XMLHttpRequest
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
        
        // 提取请求头
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
```

### 2. 创建小红书内容脚本入口

**文件:** `src/content/xhs-main-entrance.ts`

```typescript
import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';

/**
 * 小红书内容脚本入口
 * 职责:
 * 1. 注入 xhs-injection.js 到页面上下文
 * 2. 中继 injection → background 的消息
 * 3. 执行写操作(如点赞、收藏等)
 */

// 注入脚本
(function inject() {
  if (document.getElementById('xhs_injection')) return;
  const script = document.createElement('script');
  script.id = 'xhs_injection';
  script.src = chrome.runtime.getURL('js/xhs-injection.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
})();

// 监听来自注入脚本的消息
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'xhsclaw-injection') return;

  if (event.data.type === XHS_MSG_TYPE.SIGNAL_CAPTURED) {
    // 缓存认证信息
    const headers = event.data.headers;
    if (headers?.['x-s']) {
      chrome.storage.local.set({
        xhs_xs_sign: headers['x-s'],
        xhs_xt: headers['x-t'],
      }).catch(() => {});
    }

    // 转发到 background
    chrome.runtime.sendMessage({
      type: 'XHS_CAPTURED_DATA',
      endpoint: event.data.endpoint,
      apiUrl: event.data.apiUrl,
      pageUrl: event.data.pageUrl,
      method: event.data.method,
      requestBody: event.data.requestBody,
      headers: event.data.headers,
      data: event.data.data,
      timestamp: event.data.timestamp,
    });
  }
});

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'XHS_PING') {
    sendResponse({ ok: true, url: window.location.href, context: 'XHS_CONTENT_SCRIPT' });
    return true;
  }

  // TODO: 处理其他消息类型(如执行操作)

  return false;
});

console.log('[XhsClaw-CS] Active.');
```

### 3. 更新 webpack 配置

**文件:** `webpack.config.js` (修改)

在 entry 中添加:

```javascript
entry: {
  // ... 现有配置
  'xhs-injection': './src/platforms/xiaohongshu/xhs-injection.ts',
  'content-xhs': './src/content/xhs-main-entrance.ts',
},
```

### 4. 更新 manifest 配置

需要在后续任务中更新 `public/manifest.json`

## 验收标准

- [ ] `xhs-injection.ts` 实现完成
- [ ] `xhs-main-entrance.ts` 实现完成
- [ ] webpack 配置更新完成
- [ ] 编译成功,生成 `js/xhs-injection.js` 和 `js/content-xhs.js`
- [ ] 在小红书页面打开控制台,能看到初始化日志
- [ ] 浏览小红书页面时,能在控制台看到 API 拦截日志

## 测试方法

```bash
# 编译扩展
npm run build:d

# 手动测试步骤:
# 1. 在 Chrome 加载未打包的扩展(需要先完成 manifest 配置)
# 2. 打开 https://www.xiaohongshu.com/
# 3. 打开开发者工具控制台
# 4. 应该看到 "[XhsClaw-Page] System initialized." 日志
# 5. 滚动页面或点击笔记
# 6. 应该看到 "📡 Intercepted" 日志
```

## 注意事项

- 注入脚本运行在页面上下文,可以访问页面的 fetch/XHR
- 内容脚本运行在隔离环境,通过 postMessage 与注入脚本通信
- 需要正确提取和缓存 x-s 签名等认证信息
- 错误处理要健壮,避免影响页面正常功能
