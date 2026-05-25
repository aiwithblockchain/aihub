/**
 * XHS Sign Inject Script — 运行在小红书页面的 Page Context 中
 *
 * 职责：
 * 1. 监听来自 Content Script 的 window.postMessage 签名请求
 * 2. 调用页面原生的 window._webmsxyw(url, data, a1) 进行签名
 * 3. 本地计算 x-s-common（不依赖拦截，每次随 xs/xt 重新算）
 * 4. 触发页面 RAP SDK 生成 x-rap-param（发布笔记专用）
 * 5. 将结果通过 window.postMessage 返回给 Content Script
 *
 * 通信协议：
 * - 签名请求: { type: 'XHS_SIGN_REQUEST', msgId, url, data }
 * - 签名响应: { type: 'XHS_SIGN_RESPONSE', msgId, success, result?, error? }
 * - RAP 请求:  { type: 'XHS_RAP_REQUEST',  msgId, apiPath, body }
 * - RAP 响应:  { type: 'XHS_RAP_RESPONSE', msgId, success, rapParam?, error? }
 */

const TAG = '[XhsClaw-Sign-Inject]';

// ── x-s-common 计算（移植自 xhs_creator_260411.js，XsCommon 函数）─────────────
//
// x-s-common 不是固定值，也不应该从拦截的网络请求里复用。
// 它是基于本次请求的 xs + xt + a1 现场计算的，每次请求都必须重新生成。

/**
 * 来自 xhs_creator_260411.js line 400 的固定常量
 * 用于计算 x-s-common 里的 x8 字段和 MD5 输入
 */
const FFF = 'I38rHdgsjopgIvesdVwgIC+oIELmBZ5e3VwXLgFTIxS3bqwErFeexd0ekncAzMFYnqthIhJeSfMDKutRI3KsYorWHPtGrbV0P9WfIi/eWc6eYqtyQApPI37ekmR6QL+5Ii6sdneeSfqYHqwl2qt5B0DBIx+PGDi/sVtkIxdsxuwr4qtiIhuaIE3e3LV0I3VTIC7e0utl2ADmsLveDSKsSPw5IEvsiVtJOqw8BuwfPpdeTFWOIx4TIiu6ZPwrPut5IvlaLbgs3qtxIxes1VwHIkumIkIyejgsY/WTge7eSqte/D7sDcpipedeYrDtIC6eDVw2IENsSqtlnlSuNjVtIvoekqt3cZ7sVo4gIESyIhE2HBquIxhnqz8gIkIfoqwkICqWGg3sdlOeVPw3IvAe0fged0lGIi5s3Mkf2utAIiKsidvekZNeTPt4nAOeWPwEIvkazA6efuwApfosDqw+I3SrIxE5Luwwaqw+reibqrOeYjgskqtgIkdeYg0exWbxIhgsfMes6jclIkAe3PtTIirdQqwJ8ut9I36e3PtVIiNe1PtlIi5efVwAHutMGqwxI3QUICEeJaPAGl/siqtMIhVtIieeYuwoeWccpj6sDskuIkGyGuwbmPwvICdekVtUQpdeipJs1LELIhvs6ege1VwmrqttIi0sDqtXIENs1SptIi3sfWdeDPw5IxAsVPwx+/GYIEmgIvNs1Y0eV7vsWI==';

/**
 * 来自 xhs_creator_260411.js line 280 的自定义 Base64 字母表
 * 注意：不是标准 Base64，不能用 btoa()
 */
const B64_CHARS = 'ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5';

function xhsB64Encode(bytes: number[]): string {
  const len = bytes.length;
  const rem = len % 3;
  const chunks: string[] = [];
  const end = len - rem;
  for (let i = 0; i < end; i += 3) {
    const v = (bytes[i] << 16) + (bytes[i + 1] << 8) + bytes[i + 2];
    chunks.push(
      B64_CHARS[(v >> 18) & 63] +
      B64_CHARS[(v >> 12) & 63] +
      B64_CHARS[(v >>  6) & 63] +
      B64_CHARS[v & 63]
    );
  }
  if (rem === 1) {
    const v = bytes[len - 1];
    chunks.push(B64_CHARS[v >> 2] + B64_CHARS[(v << 4) & 63] + '==');
  } else if (rem === 2) {
    const v = (bytes[len - 2] << 8) + bytes[len - 1];
    chunks.push(B64_CHARS[v >> 10] + B64_CHARS[(v >> 4) & 63] + B64_CHARS[(v << 2) & 63] + '=');
  }
  return chunks.join('');
}

/**
 * 纯 JS MD5 实现（不依赖任何外部库）
 * 移植自 blueimp-md5，标准 RFC 1321
 */
function xhsMd5(str: string): string {
  function safeAdd(x: number, y: number) { const lsw=(x&0xffff)+(y&0xffff); const msw=(x>>16)+(y>>16)+(lsw>>16); return (msw<<16)|(lsw&0xffff); }
  function bitRotateLeft(num: number, cnt: number) { return (num<<cnt)|(num>>>(32-cnt)); }
  function md5cmn(q:number,a:number,b:number,x:number,s:number,t:number){return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b);}
  function md5ff(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&c)|((~b)&d),a,b,x,s,t);}
  function md5gg(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t);}
  function md5hh(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(b^c^d,a,b,x,s,t);}
  function md5ii(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(c^(b|(~d)),a,b,x,s,t);}

  function md5cycle(x: number[], k: number[]) {
    let [a,b,c,d] = x;
    a=md5ff(a,b,c,d,k[0],7,-680876936);d=md5ff(d,a,b,c,k[1],12,-389564586);c=md5ff(c,d,a,b,k[2],17,606105819);b=md5ff(b,c,d,a,k[3],22,-1044525330);
    a=md5ff(a,b,c,d,k[4],7,-176418897);d=md5ff(d,a,b,c,k[5],12,1200080426);c=md5ff(c,d,a,b,k[6],17,-1473231341);b=md5ff(b,c,d,a,k[7],22,-45705983);
    a=md5ff(a,b,c,d,k[8],7,1770035416);d=md5ff(d,a,b,c,k[9],12,-1958414417);c=md5ff(c,d,a,b,k[10],17,-42063);b=md5ff(b,c,d,a,k[11],22,-1990404162);
    a=md5ff(a,b,c,d,k[12],7,1804603682);d=md5ff(d,a,b,c,k[13],12,-40341101);c=md5ff(c,d,a,b,k[14],17,-1502002290);b=md5ff(b,c,d,a,k[15],22,1236535329);
    a=md5gg(a,b,c,d,k[1],5,-165796510);d=md5gg(d,a,b,c,k[6],9,-1069501632);c=md5gg(c,d,a,b,k[11],14,643717713);b=md5gg(b,c,d,a,k[0],20,-373897302);
    a=md5gg(a,b,c,d,k[5],5,-701558691);d=md5gg(d,a,b,c,k[10],9,38016083);c=md5gg(c,d,a,b,k[15],14,-660478335);b=md5gg(b,c,d,a,k[4],20,-405537848);
    a=md5gg(a,b,c,d,k[9],5,568446438);d=md5gg(d,a,b,c,k[14],9,-1019803690);c=md5gg(c,d,a,b,k[3],14,-187363961);b=md5gg(b,c,d,a,k[8],20,1163531501);
    a=md5gg(a,b,c,d,k[13],5,-1444681467);d=md5gg(d,a,b,c,k[2],9,-51403784);c=md5gg(c,d,a,b,k[7],14,1735328473);b=md5gg(b,c,d,a,k[12],20,-1926607734);
    a=md5hh(a,b,c,d,k[5],4,-378558);d=md5hh(d,a,b,c,k[8],11,-2022574463);c=md5hh(c,d,a,b,k[11],16,1839030562);b=md5hh(b,c,d,a,k[14],23,-35309556);
    a=md5hh(a,b,c,d,k[1],4,-1530992060);d=md5hh(d,a,b,c,k[4],11,1272893353);c=md5hh(c,d,a,b,k[7],16,-155497632);b=md5hh(b,c,d,a,k[10],23,-1094730640);
    a=md5hh(a,b,c,d,k[13],4,681279174);d=md5hh(d,a,b,c,k[0],11,-358537222);c=md5hh(c,d,a,b,k[3],16,-722521979);b=md5hh(b,c,d,a,k[6],23,76029189);
    a=md5hh(a,b,c,d,k[9],4,-640364487);d=md5hh(d,a,b,c,k[12],11,-421815835);c=md5hh(c,d,a,b,k[15],16,530742520);b=md5hh(b,c,d,a,k[2],23,-995338651);
    a=md5ii(a,b,c,d,k[0],6,-198630844);d=md5ii(d,a,b,c,k[7],10,1126891415);c=md5ii(c,d,a,b,k[14],15,-1416354905);b=md5ii(b,c,d,a,k[5],21,-57434055);
    a=md5ii(a,b,c,d,k[12],6,1700485571);d=md5ii(d,a,b,c,k[3],10,-1894986606);c=md5ii(c,d,a,b,k[10],15,-1051523);b=md5ii(b,c,d,a,k[1],21,-2054922799);
    a=md5ii(a,b,c,d,k[8],6,1873313359);d=md5ii(d,a,b,c,k[15],10,-30611744);c=md5ii(c,d,a,b,k[6],15,-1560198380);b=md5ii(b,c,d,a,k[13],21,1309151649);
    a=md5ii(a,b,c,d,k[4],6,-145523070);d=md5ii(d,a,b,c,k[11],10,-1120210379);c=md5ii(c,d,a,b,k[2],15,718787259);b=md5ii(b,c,d,a,k[9],21,-343485551);
    x[0]=safeAdd(a,x[0]);x[1]=safeAdd(b,x[1]);x[2]=safeAdd(c,x[2]);x[3]=safeAdd(d,x[3]);
  }

  function md5blks(s: string) {
    const md5blk: number[] = [];
    const length32 = s.length;
    for (let i = 0; i < 64; i++) md5blk[i >> 2] = 0;
    for (let i = 0; i < length32; i++) md5blk[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
    return md5blk;
  }

  function rhex(n: number) {
    const hex = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) s += hex[(n >> (j*8+4))&0xf] + hex[(n >> (j*8))&0xf];
    return s;
  }

  // UTF-8 encode
  const utf8 = unescape(encodeURIComponent(str));
  let i: number;
  const length = utf8.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  for (i = 64; i <= length; i += 64) {
    md5cycle(state, md5blks(utf8.slice(i - 64, i)));
  }
  const tail = utf8.slice(i - 64);
  const tail2 = new Array(16).fill(0);
  for (let j = 0; j < tail.length; j++) tail2[j >> 2] |= tail.charCodeAt(j) << ((j % 4) * 8);
  tail2[tail.length >> 2] |= 0x80 << ((tail.length % 4) * 8);
  if (tail.length > 55) { md5cycle(state, tail2); tail2.fill(0); }
  tail2[14] = length * 8;
  md5cycle(state, tail2);
  return state.map(rhex).join('');
}

/** CRC32 实现，完全移植自 xhs_creator_260411.js 的 gens9 函数
 *  注意：返回值是有符号 32 位整数（与原版一致，不做 >>> 0 转换）
 */
function gens9(bytes: number[]): number {
  const POLY = 0xedb88320;
  const table: number[] = [];
  for (let d = 255; d >= 0; d--) {
    let r = d;
    for (let c = 8; c > 0; c--) r = (r & 1) ? (r >>> 1) ^ POLY : r >>> 1;
    table[d] = r >>> 0;  // table 项本身存无符号是对的
  }
  let crc = -1;
  for (const b of bytes) crc = table[(255 & crc) ^ b] ^ (crc >>> 8);
  // 原版: return -1 ^ c ^ a  ← 结果可能是负数，保持有符号
  return -1 ^ crc ^ POLY;
}

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/**
 * 计算 x-s-common
 * 完全移植自 xhs_creator_260411.js 的 XsCommon(a1, xs, xt)
 * 每次请求必须用本次的 xs/xt 重新计算，不能复用
 */
function calcXsCommon(a1: string, xs: string, xt: number | string): string {
  const xtStr = String(xt);
  const md5Val = xhsMd5(xtStr + xs + FFF);
  if (!md5Val) return '';

  const x9 = gens9(hexToBytes(md5Val));
  const d = {
    s0: 5, s1: '', x0: '1', x1: '4.3.2', x2: 'Windows',
    x3: 'ugc', x4: '4.84.1',
    x5: a1,
    x6: Number(xt),
    x7: xs,
    x8: FFF,
    x9,
    x10: 0,
    x11: 'normal',
  };
  const jsonStr = JSON.stringify(d);
  const utf8Bytes = Array.from(new TextEncoder().encode(jsonStr));
  return xhsB64Encode(utf8Bytes);
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getCookieValue(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// ── 等待 _webmsxyw 可用 ────────────────────────────────────────────────────────

let signReady = false;

function waitForSignFn(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof (window as any)._webmsxyw === 'function') {
      signReady = true;
      resolve();
      return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (typeof (window as any)._webmsxyw === 'function') {
        clearInterval(timer);
        signReady = true;
        console.log(`${TAG} _webmsxyw ready after ${attempts * 200}ms`);
        resolve();
      } else if (attempts >= 75) { // 最多等 15s
        clearInterval(timer);
        console.error(`${TAG} _webmsxyw not available after 15s`);
        resolve();
      }
    }, 200);
  });
}

const signFnReady = waitForSignFn();

// ── 签名请求处理 ─────────────────────────────────────────────────────────────

interface SignRequest {
  type: 'XHS_SIGN_REQUEST';
  msgId: string;
  url: string;
  data: string;
}

/**
 * 使用 window.mnsv2 生成 XYS_ 格式签名（creator 页面专用）
 * 完全移植自 Spider_XHS/static/xhs_creator_260411.js 的 seccore_signv2 函数
 */
function signWithMnsv2(url: string, data: string): string {
  const mnsv2 = (window as any).mnsv2;
  if (typeof mnsv2 !== 'function') throw new Error('window.mnsv2 not found');

  const dataStr = data || '';
  const fullStr = url + dataStr;
  const c = xhsMd5(fullStr);
  const d = xhsMd5(url);
  const s = mnsv2(fullStr, c, d);

  // x4 = typeof data（来自页面源码：f ? typeof f : ""）
  const x4 = dataStr ? typeof dataStr : '';
  const signObj = { x0: '4.3.2', x1: 'ugc', x2: 'Windows', x3: s, x4 };
  return 'XYS_' + xhsB64Encode(Array.from(new TextEncoder().encode(JSON.stringify(signObj))));
}

async function handleSignRequest(event: MessageEvent) {
  const msg = event.data as SignRequest;
  if (!msg || msg.type !== 'XHS_SIGN_REQUEST') return;
  if (event.source !== window) return;

  const { msgId, url, data } = msg;

  try {
    const a1 = getCookieValue('a1');
    if (!a1) throw new Error('a1 cookie not found. Please ensure you are logged in.');

    let xs: string;
    let xt: number;

    // 优先用 window.mnsv2 生成 XYS_ 格式签名（creator 页面）
    if (typeof (window as any).mnsv2 === 'function') {
      xs = signWithMnsv2(url, data || '');
      xt = Date.now();
    } else {
      // 回退到 _webmsxyw（www 页面）
      if (!signReady) await signFnReady;
      const signFn = (window as any)._webmsxyw;
      if (typeof signFn !== 'function') throw new Error('Neither mnsv2 nor _webmsxyw found on window.');
      const signResult = signFn(url, data, a1);
      xs = signResult['X-s'] || signResult['x-s'] || '';
      xt = signResult['X-t'] || signResult['x-t'] || Date.now();
    }

    const xsCommon = calcXsCommon(a1, xs, xt);

    window.postMessage({
      type: 'XHS_SIGN_RESPONSE',
      msgId,
      success: true,
      result: {
        'x-s': xs,
        'x-t': String(xt),
        'x-s-common': xsCommon,
      },
    }, '*');

  } catch (e: any) {
    console.error(`${TAG} Sign error: msgId=${msgId}`, e);
    window.postMessage({
      type: 'XHS_SIGN_RESPONSE',
      msgId,
      success: false,
      error: e.message || 'Unknown sign error',
    }, '*');
  }
}

// ── RAP XHR Hook：拦截页面内 RAP SDK 发出的 x-rap-param，无需逆向 webpack 模块 ──
//
// 原理：
//   - RAP SDK（Sanji）在 send() 里同步调用 setRequestHeader('x-rap-param', ...)
//   - 我们 hook XMLHttpRequest.prototype.setRequestHeader，抓住这个值
//   - 用 xhr.abort() 取消实际网络请求，只保留捕获的 x-rap-param
//   - 不依赖任何 webpack module 编号，页面更新后自动兼容
//
// 两阶段 hook：
//   Phase 1（立即执行）：hook 当前 XMLHttpRequest.prototype.setRequestHeader
//   Phase 2（defineProperty）：RAP SDK 可能替换 window.XMLHttpRequest 构造器，
//          用 Object.defineProperty 拦截赋值，对新构造器重新 hook

let _currentXHR: typeof XMLHttpRequest = window.XMLHttpRequest;
let rapSdkHooked = false;
let rapReadyResolve: (() => void) | null = null;
const rapReadyPromise = new Promise<void>(resolve => { rapReadyResolve = resolve; });

function applySetHeaderHook(proto: any) {
  if (!proto || proto.__tc_rap_hooked) return;
  const orig = proto.setRequestHeader;
  proto.setRequestHeader = function(name: string, value: string) {
    if (String(name).toLowerCase() === 'x-rap-param') {
      (window as any).__capturedRapParam = String(value);
    }
    return orig?.apply(this, arguments as any);
  };
  proto.__tc_rap_hooked = true;
}

// Phase 1: hook 当前原生 XHR prototype
applySetHeaderHook(XMLHttpRequest.prototype);

// Phase 2: 监听 RAP SDK 替换 window.XMLHttpRequest
try {
  Object.defineProperty(window, 'XMLHttpRequest', {
    get() { return _currentXHR; },
    set(newXHR: typeof XMLHttpRequest) {
      _currentXHR = newXHR;
      applySetHeaderHook(newXHR.prototype);
      if (!rapSdkHooked) {
        rapSdkHooked = true;
        console.log(`${TAG} [RAP-Hook] RAP SDK replaced XMLHttpRequest, Phase 2 active`);
        rapReadyResolve?.();
      }
    },
    configurable: true,
  });
} catch (e: any) {
  console.warn(`${TAG} [RAP-Hook] defineProperty failed:`, e.message);
  rapSdkHooked = true;
  rapReadyResolve?.();
}

// 3s 内 RAP SDK 未替换构造器 → Phase 1 足够，直接 ready
setTimeout(() => {
  if (!rapSdkHooked) {
    rapSdkHooked = true;
    rapReadyResolve?.();
  }
}, 3000);

/**
 * 生成 x-rap-param：触发 Sanji SDK 异步生成行为签名并等待结果。
 *
 * 关键发现（实测）：
 *   Sanji 用 setTimeout 异步调用 setRequestHeader('x-rap-param', ...)，
 *   同步读 __capturedRapParam 永远拿到 null。
 *   abort() 也无法取消 Sanji 内部已经分发的真实 XHR（会拿到 401，但无害）。
 *
 * 方案：
 *   - 对 window.__capturedRapParam 安装一次性 setter（Object.defineProperty）
 *   - applySetHeaderHook 写入该属性时，setter 立即 resolve
 *   - 3s 超时兜底（超时返回 null，不阻塞发布流程）
 */
async function generateRapParam(apiPath: string, body: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    let storedValue: string | null = null;
    const TIMEOUT_MS = 3000;

    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      // 还原为普通可写属性，供下次调用重新 define
      try {
        Object.defineProperty(window, '__capturedRapParam', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (_) {
        try { (window as any).__capturedRapParam = value; } catch (_2) {}
      }
      resolve(value);
    };

    // 安装一次性 setter：applySetHeaderHook 写 __capturedRapParam 时立即触发
    try {
      Object.defineProperty(window, '__capturedRapParam', {
        get() { return storedValue; },
        set(v: string | null) {
          storedValue = v || null;
          if (v) settle(v);
        },
        configurable: true,
        enumerable: true,
      });
    } catch (e: any) {
      // defineProperty 失败（极少数情况）：退化为超时轮询
      console.warn(`${TAG} [generateRapParam] defineProperty failed, relying on timeout:`, e.message);
      try { (window as any).__capturedRapParam = null; } catch (_) {}
    }

    const timeoutId = setTimeout(() => {
      if (!storedValue) console.warn(`${TAG} [generateRapParam] ${TIMEOUT_MS}ms timeout, x-rap-param not captured`);
      settle(storedValue);
    }, TIMEOUT_MS);

    // 触发 Sanji：send() 之后 Sanji 会在 setTimeout 里生成 x-rap-param
    // Sanji 内部会再发一次真实 XHR（无有效签名，拿到 401 — 完全无害）
    try {
      const url = /^https?:\/\//.test(apiPath)
        ? apiPath
        : 'https://edith.xiaohongshu.com' + apiPath;
      const xhr = new _currentXHR();
      xhr.open('POST', url, true);
      try { xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8'); } catch (_) {}
      xhr.send(body);
      // 不 abort：Sanji 的真实请求已在 setTimeout 队列里，abort 拦不住
    } catch (e: any) {
      console.error(`${TAG} [generateRapParam] XHR send error:`, e.message);
      clearTimeout(timeoutId);
      settle(null);
    }
  });
}

// ── RAP 参数请求处理 ─────────────────────────────────────────────────────────
//
// content script 请求生成 x-rap-param，inject script 计算后返回值。
// 必须等 rapReadyPromise 完成后（RAP SDK 已 hook XHR）才能触发生成。

interface RapRequest {
  type: 'XHS_RAP_REQUEST';
  msgId: string;
  apiPath: string;  // 如 '/web_api/sns/v2/note'
  body: string;
}

async function handleRapRequest(event: MessageEvent) {
  const msg = event.data as RapRequest;
  if (!msg || msg.type !== 'XHS_RAP_REQUEST') return;
  if (event.source !== window) return;

  const { msgId, apiPath, body } = msg;

  try {
    await rapReadyPromise;
    const rapParam = await generateRapParam(apiPath, body);
    if (!rapParam) console.warn(`${TAG} x-rap-param is null for ${apiPath}`);
    window.postMessage({ type: 'XHS_RAP_RESPONSE', msgId, success: true, rapParam: rapParam || '' }, '*');
  } catch (e: any) {
    console.error(`${TAG} RAP error:`, e);
    window.postMessage({ type: 'XHS_RAP_RESPONSE', msgId, success: false, error: e.message }, '*');
  }
}

// ── window.__xhsRap：Console 测试接口 ────────────────────────────────────────
//
// 在 creator.xiaohongshu.com 页面的 DevTools Console 里可以直接调用：
//
//   window.__xhsRap.status()     → 查看 RAP hook 状态
//   window.__xhsRap.test()       → 用默认参数触发一次 RAP 生成，返回 x-rap-param
//   window.__xhsRap.testNote()   → 用真实发帖 API 路径触发生成

(window as any).__xhsRap = {
  /** 查看当前 RAP hook 状态 */
  status() {
    return {
      rapSdkHooked,
      xhrConstructorName: _currentXHR?.name || 'unknown',
      xhrProtoHooked: !!(_currentXHR?.prototype as any)?.__tc_rap_hooked,
      lastCaptured: (window as any).__capturedRapParam
        ? ((window as any).__capturedRapParam as string).slice(0, 80) + '...'
        : null,
    };
  },

  /** 触发一次 RAP 生成，返回 Promise<string|null> */
  async test(apiPath = '/web_api/sns/v2/note', body = '{"test":1}') {
    await rapReadyPromise;
    const result = await generateRapParam(apiPath, body);
    console.log('[__xhsRap.test] x-rap-param:', result ? result.slice(0, 100) + '...' : 'null');
    return result;
  },

  /** 用真实发帖 API 触发生成（更接近实际发布场景） */
  async testNote(title = 'test', desc = 'hello') {
    const apiPath = '/web_api/sns/v2/note';
    const body = JSON.stringify({
      common: { type: 'normal', title, desc, note_id: '', source: '{"type":"web"}', ats: [], hash_tag: [], post_loc: {}, privacy_info: { op_type: 1, type: 0, user_ids: [] }, goods_info: {}, biz_relations: [], capa_trace_info: {} },
      image_info: { images: [] },
      video_info: null,
    });
    return (window as any).__xhsRap.test(apiPath, body);
  },
};

// ── XHR 代理请求（让页面反垃圾 SDK 自动注入 XYS_ 格式签名）───────────────────
//
// creator.xiaohongshu.com 的反垃圾 SDK（643f48...js）hook 了原生 XMLHttpRequest，
// 会自动给所有从页面 context 发出的 XHR 注入正确的 x-s（XYS_ 格式）。
// content script 通过 postMessage 委托 inject script 发 XHR，SDK 自动签名。

function handleXhrRequest(event: MessageEvent) {
  const { msgId, url, method, headers, body } = event.data;
  // 使用页面原生 XHR（已被 SDK hook）
  const xhr = new (window as any).XMLHttpRequest();
  xhr.open(method || 'POST', url, true);
  xhr.withCredentials = true;

  // 只设置非签名 headers，x-s/x-t/x-s-common 由 SDK 自动注入
  if (headers && typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      const lk = key.toLowerCase();
      if (lk !== 'x-s' && lk !== 'x-t' && lk !== 'x-s-common') {
        try { xhr.setRequestHeader(key, (headers as any)[key]); } catch (_) {}
      }
    }
  }

  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return;
    window.postMessage({
      type: 'XHS_XHR_RESPONSE',
      msgId,
      status: xhr.status,
      responseText: xhr.responseText,
    }, '*');
  };

  xhr.onerror = function () {
    window.postMessage({
      type: 'XHS_XHR_RESPONSE',
      msgId,
      status: 0,
      responseText: '',
      error: 'XHR network error',
    }, '*');
  };

  xhr.send(body || null);
}

// ── 注册所有消息监听 ─────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
  if (!event.data || event.source !== window) return;
  const type = event.data?.type;
  if (type === 'XHS_SIGN_REQUEST') handleSignRequest(event);
  else if (type === 'XHS_RAP_REQUEST') handleRapRequest(event);
  else if (type === 'XHS_XHR_REQUEST') handleXhrRequest(event);
  else if (type === 'XHS_HEALTH_CHECK_REQUEST') handleHealthCheckRequest(event);
});

// ── mnsv2 健康检查：供 tweetpilot 通过 REST API 主动查询 ─────────────────────

function handleHealthCheckRequest(event: MessageEvent) {
  const { msgId } = event.data;
  const result = checkMnsv2Status();
  if (!result.ok) console.warn(`${TAG} Health check: ok=false, reason=${result.reason || 'none'}`);
  window.postMessage({ type: 'XHS_HEALTH_CHECK_RESPONSE', msgId, ...result }, '*');
}

/**
 * 检查 window.mnsv2 是否存在并生成正确格式的 XYS_ 签名
 * 返回结构化结果，供 content script 回传给 background
 */
function checkMnsv2Status(): {
  ok: boolean;
  mnsv2_present: boolean;
  sign_format_ok: boolean;
  reason?: string;
  sample?: string;
} {
  const mnsv2 = (window as any).mnsv2;

  if (typeof mnsv2 !== 'function') {
    return { ok: false, mnsv2_present: false, sign_format_ok: false, reason: 'mnsv2_missing' };
  }

  try {
    const testUrl = '/api/health';
    const fullStr = testUrl;
    const c = xhsMd5(fullStr);
    const d = xhsMd5(testUrl);
    const s = mnsv2(fullStr, c, d);
    const signObj = { x0: '4.3.2', x1: 'ugc', x2: 'Windows', x3: s, x4: '' };
    const xs = 'XYS_' + xhsB64Encode(Array.from(new TextEncoder().encode(JSON.stringify(signObj))));

    if (!xs.startsWith('XYS_')) {
      return { ok: false, mnsv2_present: true, sign_format_ok: false, reason: 'format_changed', sample: xs.slice(0, 20) };
    }

    return { ok: true, mnsv2_present: true, sign_format_ok: true, sample: xs.slice(0, 15) };
  } catch (e: any) {
    return { ok: false, mnsv2_present: true, sign_format_ok: false, reason: 'mnsv2_error', sample: e.message };
  }
}

// Self-test：仅在 _webmsxyw 路径下验证 x-s-common 是否正常
signFnReady.then(() => {
  const signFn = (window as any)._webmsxyw;
  const a1 = getCookieValue('a1');
  if (typeof signFn === 'function' && a1) {
    try {
      const result = signFn('/api/sns/web/v2/user/me', '', a1);
      const xs = result['X-s'] || result['x-s'] || '';
      const xt = result['X-t'] || result['x-t'] || '';
      const xsCommon = calcXsCommon(a1, xs, xt);
      if (!xsCommon) console.warn(`${TAG} Self-test: x-s-common is empty (CryptoJS missing?)`);
    } catch (e: any) {
      console.error(`${TAG} Self-test error:`, e.message);
    }
  }
});
