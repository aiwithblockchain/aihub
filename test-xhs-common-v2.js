// 在 xiaohongshu.com 的 DevTools Console 中运行
// 目的：找到生成 x-s-common 的函数

console.log('=== Searching for x-s-common generator ===');

// 1. 搜索所有可能的签名相关函数
const signFunctions = Object.keys(window).filter(k => {
  const val = window[k];
  return typeof val === 'function' && (
    k.includes('sign') ||
    k.includes('Sign') ||
    k.includes('common') ||
    k.includes('Common') ||
    k.includes('_web') ||
    k.startsWith('_')
  );
});
console.log('Potential sign functions:', signFunctions);

// 2. 检查每个函数的参数数量
signFunctions.forEach(fnName => {
  const fn = window[fnName];
  console.log(`${fnName}: length=${fn.length}, toString=${fn.toString().slice(0, 100)}`);
});

// 3. 尝试调用可能的候选函数
console.log('\n=== Testing candidate functions ===');
const a1 = document.cookie.match(/a1=([^;]+)/)?.[1];
if (a1) {
  // 测试 _webmsxyw 的不同调用方式
  try {
    const result1 = window._webmsxyw('/api/sns/web/v2/user/me', '', a1);
    console.log('_webmsxyw(url, "", a1) keys:', Object.keys(result1));
  } catch (e) {
    console.error('_webmsxyw test failed:', e.message);
  }
}

console.log('\nDone. Check if any function generates x-s-common.');
