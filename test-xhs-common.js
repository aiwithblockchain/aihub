// 在 xiaohongshu.com 的 DevTools Console 中运行此脚本
// 目的：找到 x-s-common 的来源

console.log('=== Searching for x-s-common ===');

// 1. 检查 window 对象中是否有相关函数
const windowKeys = Object.keys(window).filter(k =>
  k.toLowerCase().includes('common') ||
  k.toLowerCase().includes('sign') ||
  k.toLowerCase().includes('xscommon')
);
console.log('Window keys with "common/sign":', windowKeys);

// 2. 检查是否有生成 x-s-common 的函数
if (typeof window._webmsxyw === 'function') {
  const testResult = window._webmsxyw('/api/sns/web/v2/user/me', '', document.cookie.match(/a1=([^;]+)/)?.[1] || '');
  console.log('_webmsxyw result keys:', Object.keys(testResult));
  console.log('Full result:', testResult);
}

// 3. 拦截 fetch 看实际发送的头部
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const [url, options] = args;
  if (url.includes('edith.xiaohongshu.com')) {
    console.log('Intercepted fetch to:', url);
    console.log('Headers:', options?.headers);
  }
  return originalFetch.apply(this, args);
};

console.log('Fetch interceptor installed. Now trigger an API request and check logs.');
