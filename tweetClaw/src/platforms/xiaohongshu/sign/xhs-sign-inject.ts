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
const RAP_BUNDLE_URL = (() => {
  const script = document.currentScript as HTMLScriptElement | null;
  const injectedUrl = script?.dataset?.extUrl || script?.src || '';
  return injectedUrl
    ? injectedUrl.replace(/\/?xhs-sign-inject\.js(?:\?.*)?$/, '/xhs-rap-bundle.js')
    : '';
})();

// ── x-s-common 计算（移植自 xhs_creator_260411.js，XsCommon 函数）─────────────
//
// x-s-common 不是固定值，也不应该从拦截的网络请求里复用。
// 它是基于本次请求的 xs + xt + a1 现场计算的，每次请求都必须重新生成。

/**
 * 来自 xhs_creator_260411.js line 400 的固定常量
 * 用于 creator (ugc) 接口计算 x-s-common 里的 x8 字段和 MD5 输入
 */
const FFF_CREATOR = 'I38rHdgsjopgIvesdVwgIC+oIELmBZ5e3VwXLgFTIxS3bqwErFeexd0ekncAzMFYnqthIhJeSfMDKutRI3KsYorWHPtGrbV0P9WfIi/eWc6eYqtyQApPI37ekmR6QL+5Ii6sdneeSfqYHqwl2qt5B0DBIx+PGDi/sVtkIxdsxuwr4qtiIhuaIE3e3LV0I3VTIC7e0utl2ADmsLveDSKsSPw5IEvsiVtJOqw8BuwfPpdeTFWOIx4TIiu6ZPwrPut5IvlaLbgs3qtxIxes1VwHIkumIkIyejgsY/WTge7eSqte/D7sDcpipedeYrDtIC6eDVw2IENsSqtlnlSuNjVtIvoekqt3cZ7sVo4gIESyIhE2HBquIxhnqz8gIkIfoqwkICqWGg3sdlOeVPw3IvAe0fged0lGIi5s3Mkf2utAIiKsidvekZNeTPt4nAOeWPwEIvkazA6efuwApfosDqw+I3SrIxE5Luwwaqw+reibqrOeYjgskqtgIkdeYg0exWbxIhgsfMes6jclIkAe3PtTIirdQqwJ8ut9I36e3PtVIiNe1PtlIi5efVwAHutMGqwxI3QUICEeJaPAGl/siqtMIhVtIieeYuwoeWccpj6sDskuIkGyGuwbmPwvICdekVtUQpdeipJs1LELIhvs6ege1VwmrqttIi0sDqtXIENs1SptIi3sfWdeDPw5IxAsVPwx+/GYIEmgIvNs1Y0eV7vsWI==';

/**
 * 消费端 (www.xiaohongshu.com) 的 FFF 常量
 * 从真实浏览器请求的 x-s-common x8 字段中提取
 * 长度 1640 字符，与创作者平台的 728 字符完全不同
 */
const FFF_CONSUMER = 'I38rHdgsjopgIvesdVwgIC+oIELmBZ5e3VwXLgFTIxS3bqwErFeexd0ekncAzMFYnqthIhJeDdRxqqwdIvAsWBchwPttgm46KUzxIh0s0LKsjqwny7DZIvosxbPjyZuAIhKeDa7sfUTTJqtR+qwApdpNIChmNI8KzVwSICgekutHwqwDIEFqIE/sTIZiIxrMIvgedqwR+7pPzZNsdY3efqtAIkNe3VwgqqtpputxKzgs1WpeICVWIhQ0/PtQKVwAI3Z2omdeiqwfICAeTVtrIE++IEmncfdejgzYroosfqwOZWoedLDDBogsjZpBIxKsdVtaIkvefqwRbMLIGf4BI37sxqtE/WOex0l4IhQsIE8+QdZkIxEs8MlmIkcfbPwSICqWG7JsYlOskPwRI3KefBAed04+Ivvs3clltPt0IigeieOexmJsVuwtrnosdVtuI3VbbU6eWuwko9osSPwgI3zrI3+xoPwezPwKoauLyMNsYjgsVqt8IiosdU3s6Du0IiNekjOe0lSBIv6s0qwnIvpypVwHPVtAIx5e6utvIkos3VwVIk3sjut3wutnsPwIICclI3lZ+0QjtY/eTqtjIiPqIiNeYuwKZZzrcnNsYjSuIihLwVwznPtCI35ekVwNnSdsTMKeVzSPIids6B7sTuwGpuwwICJeWVwiIiOe6jroIveeDd/e0PtSICKs6Pw64omqIhHeICgeVLAeTgveYb6sYPtKIiMFI3m5rVtKIvzlIk6s3lS3ygde0PweIiHwaqwiOSJe0WOsDPtNnutnI3i0Ihz4butbNVwcI30s0pde3VwIJutqIEMOHPtUIxc8wzFRIiJsxgNsfD/e0uw1PVtZIiLuI3NsYqtOICKe09bSIEYI/pM0IvVGICoexuwxcVtNtPt8I3W6Ivosxe/eVVwlJSIfIvc2GVtnoutMIkF5I3RbI3QVIEKeV7As6pbeZPwtIEqepqwqZuw2IhdexdF0IkZ1GrgeWutZNPtmrWrhZoc9IiksLPwoIk6siAYnIiQHZqwtIxpesPt+eutsIhIqIvzMIvzgHuwdIkHqIE5s1qwxeYblIvIcIC5sfgJsSuw+IC4yICLSgWFgIvTkpIPYIv/sVp/e0qwyIh6skVtnIhW4ICOsiuw3I3uwpPwiI3NeTMYLeutdOVtrIxNeDVtnIhNedlDvIige0m6exqwpKBAeYVtH/l7s3VwqIxee6c0eVVteIilvIEqHbuw/GMDaIC6eSVwwg7JsiYQ5/PwpIvYqIE0eYcr+I30sYqt8ICSbIhes0DljIEHaIE4KNDPGI3OsYIWRIkPAICuSI35ednpyOVwGrVwrBZ6sjcJsSuwYICoefZ7e3qwngVw4ICMObuwiZuwOQuwYOPwY4qtUO9AsTD/sT9dskI/e6VwLIiqpIhYxI3SII3de370eTeY38ut4IEPqLqwp8d6sVVwqICKsfz0sSBuGIx7eDutB8ID9ICNe0qwxIv0sVVwTtPtaI37edgIyOqtPnBJefmpfIE7sDutn/qw3Bods3VwicPw4bPwBIvF8IkTEBL0sDl7s6Pt3Ix6e1qwKbPwGKaeekZWusshdqcSCpVtbsVtoIxEkI3FJIvu6GLKsiUmaIxLoI3iqePwNIvii2VtB';

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
      B64_CHARS[(v >> 6) & 63] +
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
  function safeAdd(x: number, y: number) { const lsw = (x & 0xffff) + (y & 0xffff); const msw = (x >> 16) + (y >> 16) + (lsw >> 16); return (msw << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num: number, cnt: number) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(c ^ (b | (~d)), a, b, x, s, t); }

  function md5cycle(x: number[], k: number[]) {
    let [a, b, c, d] = x;
    a = md5ff(a, b, c, d, k[0], 7, -680876936); d = md5ff(d, a, b, c, k[1], 12, -389564586); c = md5ff(c, d, a, b, k[2], 17, 606105819); b = md5ff(b, c, d, a, k[3], 22, -1044525330);
    a = md5ff(a, b, c, d, k[4], 7, -176418897); d = md5ff(d, a, b, c, k[5], 12, 1200080426); c = md5ff(c, d, a, b, k[6], 17, -1473231341); b = md5ff(b, c, d, a, k[7], 22, -45705983);
    a = md5ff(a, b, c, d, k[8], 7, 1770035416); d = md5ff(d, a, b, c, k[9], 12, -1958414417); c = md5ff(c, d, a, b, k[10], 17, -42063); b = md5ff(b, c, d, a, k[11], 22, -1990404162);
    a = md5ff(a, b, c, d, k[12], 7, 1804603682); d = md5ff(d, a, b, c, k[13], 12, -40341101); c = md5ff(c, d, a, b, k[14], 17, -1502002290); b = md5ff(b, c, d, a, k[15], 22, 1236535329);
    a = md5gg(a, b, c, d, k[1], 5, -165796510); d = md5gg(d, a, b, c, k[6], 9, -1069501632); c = md5gg(c, d, a, b, k[11], 14, 643717713); b = md5gg(b, c, d, a, k[0], 20, -373897302);
    a = md5gg(a, b, c, d, k[5], 5, -701558691); d = md5gg(d, a, b, c, k[10], 9, 38016083); c = md5gg(c, d, a, b, k[15], 14, -660478335); b = md5gg(b, c, d, a, k[4], 20, -405537848);
    a = md5gg(a, b, c, d, k[9], 5, 568446438); d = md5gg(d, a, b, c, k[14], 9, -1019803690); c = md5gg(c, d, a, b, k[3], 14, -187363961); b = md5gg(b, c, d, a, k[8], 20, 1163531501);
    a = md5gg(a, b, c, d, k[13], 5, -1444681467); d = md5gg(d, a, b, c, k[2], 9, -51403784); c = md5gg(c, d, a, b, k[7], 14, 1735328473); b = md5gg(b, c, d, a, k[12], 20, -1926607734);
    a = md5hh(a, b, c, d, k[5], 4, -378558); d = md5hh(d, a, b, c, k[8], 11, -2022574463); c = md5hh(c, d, a, b, k[11], 16, 1839030562); b = md5hh(b, c, d, a, k[14], 23, -35309556);
    a = md5hh(a, b, c, d, k[1], 4, -1530992060); d = md5hh(d, a, b, c, k[4], 11, 1272893353); c = md5hh(c, d, a, b, k[7], 16, -155497632); b = md5hh(b, c, d, a, k[10], 23, -1094730640);
    a = md5hh(a, b, c, d, k[13], 4, 681279174); d = md5hh(d, a, b, c, k[0], 11, -358537222); c = md5hh(c, d, a, b, k[3], 16, -722521979); b = md5hh(b, c, d, a, k[6], 23, 76029189);
    a = md5hh(a, b, c, d, k[9], 4, -640364487); d = md5hh(d, a, b, c, k[12], 11, -421815835); c = md5hh(c, d, a, b, k[15], 16, 530742520); b = md5hh(b, c, d, a, k[2], 23, -995338651);
    a = md5ii(a, b, c, d, k[0], 6, -198630844); d = md5ii(d, a, b, c, k[7], 10, 1126891415); c = md5ii(c, d, a, b, k[14], 15, -1416354905); b = md5ii(b, c, d, a, k[5], 21, -57434055);
    a = md5ii(a, b, c, d, k[12], 6, 1700485571); d = md5ii(d, a, b, c, k[3], 10, -1894986606); c = md5ii(c, d, a, b, k[10], 15, -1051523); b = md5ii(b, c, d, a, k[1], 21, -2054922799);
    a = md5ii(a, b, c, d, k[8], 6, 1873313359); d = md5ii(d, a, b, c, k[15], 10, -30611744); c = md5ii(c, d, a, b, k[6], 15, -1560198380); b = md5ii(b, c, d, a, k[13], 21, 1309151649);
    a = md5ii(a, b, c, d, k[4], 6, -145523070); d = md5ii(d, a, b, c, k[11], 10, -1120210379); c = md5ii(c, d, a, b, k[2], 15, 718787259); b = md5ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = safeAdd(a, x[0]); x[1] = safeAdd(b, x[1]); x[2] = safeAdd(c, x[2]); x[3] = safeAdd(d, x[3]);
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
    for (let j = 0; j < 4; j++) s += hex[(n >> (j * 8 + 4)) & 0xf] + hex[(n >> (j * 8)) & 0xf];
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
 *
 * Creator API (/web_api/)：移植自 Spider_XHS/static/xhs_creator_260411.js XsCommon()
 *   x9 = gens9(hexToBytes(MD5(xt + xs + b1)))  ← 先 MD5 再 CRC32
 *   x1="4.3.2", x4="4.84.1", x11="normal"
 *
 * Consumer API (/api/sns/ 等)：移植自 Spider_XHS/static/xhs_xray_pack1.js xsCommon()
 *   x9 = gens9(xt + xs + b1)  ← 直接 CRC32（ASCII 字符串，charCodeAt == UTF-8 bytes）
 *   x1="3.7.8-2", x4="4.38.0", x6=xt, x7=xs
 *
 * 每次请求必须用本次的 xs/xt 重新计算，不能复用
 */
function calcXsCommon(a1: string, xs: string, xt: number | string, apiPath = ''): string {
  const xtStr = String(xt);
  const isCreatorApi = apiPath.indexOf('/web_api/') >= 0 || apiPath.indexOf('/api/galaxy/') >= 0;

  // 优先从 localStorage 读取指纹 b1，若不存在则退回静态 FFF 常量
  const b1 = localStorage.getItem('b1') || (isCreatorApi ? FFF_CREATOR : FFF_CONSUMER);

  const platform = getPlatformName();
  const s0 = getPlatformCode(platform);
  const x0 = localStorage.getItem('b1b1') || '1';

  let x9: number;
  let d: Record<string, any>;

  if (isCreatorApi) {
    // Creator API：x9 = gens9(hexToBytes(MD5(xt + xs + b1)))
    const md5Input = xtStr + xs + b1;
    const md5Hex = xhsMd5(md5Input);
    x9 = gens9(hexToBytes(md5Hex));

    d = {
      s0,
      s1: '',
      x0,
      x1: '4.3.2',
      x2: platform,
      x3: 'ugc',
      x4: '4.84.1',
      x5: a1,
      x6: xtStr,
      x7: xs,
      x8: b1,
      x9,
      x10: 0,
      x11: 'normal',
    };
  } else {
    // Consumer API：x9 = gens9(bytes of xt + xs + b1)
    // ASCII 字符串，TextEncoder 字节 == charCodeAt，与 xhs_xray_pack1.js encrypt_mcr 一致
    const x9Input = xtStr + xs + b1;
    x9 = gens9(Array.from(new TextEncoder().encode(x9Input)));

    d = {
      s0,
      s1: '',
      x0,
      x1: '4.3.5',
      x2: platform,
      x3: 'xhs-pc-web',
      x4: '6.12.3',
      x5: a1,
      x6: '',
      x7: '',
      x8: b1,
      x9,
      x10: Number(sessionStorage.getItem('sc') || '0'),
      x11: 'normal',
    };
  }

  const jsonStr = JSON.stringify(d);
  const utf8Bytes = Array.from(new TextEncoder().encode(jsonStr));
  return xhsB64Encode(utf8Bytes);
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function getCookieValue(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function getPlatformName(): string {
  const ua = navigator.userAgent || '';
  if (/Mac/i.test(ua)) return 'Mac OS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Windows';
}

function getPlatformCode(platform: string): number {
  switch (platform) {
    case 'Android': return 2;
    case 'iOS': return 1;
    case 'Mac OS': return 3;
    case 'Linux': return 4;
    default: return 5; // other / Windows
  }
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

  const isCreatorApi = url.indexOf('/web_api/') >= 0 || url.indexOf('/api/galaxy/') >= 0;
  const x1 = isCreatorApi ? 'ugc' : 'xhs-pc-web';
  const x4 = 'object';
  const signObj = { x0: '4.3.5', x1, x2: getPlatformName(), x3: s, x4 };
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

    if (typeof (window as any).mnsv2 === 'function') {
      // 优先 mnsv2 (XYS_ 格式) — 消费端和创作者端均适用
      xs = signWithMnsv2(url, data || '');
      xt = Date.now();
    } else if (typeof (window as any)._webmsxyw === 'function') {
      // 兜底：mnsv2 不可用时用 _webmsxyw (XYW_ 格式)
      if (!signReady) await signFnReady;
      const signFn = (window as any)._webmsxyw;
      const signResult = signFn(url, data, a1);
      xs = signResult['X-s'] || signResult['x-s'] || '';
      xt = signResult['X-t'] || signResult['x-t'] || Date.now();
    } else {
      throw new Error('Neither _webmsxyw nor mnsv2 found on window.');
    }

    const xsCommon = calcXsCommon(a1, xs, xt, url);

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
  proto.setRequestHeader = function (name: string, value: string) {
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

// ── 合成行为事件注入（为 RAP SDK 提供鼠标/键盘/滚动行为数据）────────────────────
//
// 关键洞察：Sanji 用 setTimeout 异步消化事件。在同一帧里批量同步分发大量事件，
// Sanji 会识别为异常模式（decoded byte[3]=0x04 低质量）。
//
// 正确方案：在页面加载后就启动后台 "行为预热定时器"，每隔 800~1500ms 分散注入
// 少量事件，让 Sanji 在真正的 setTimeout 回调中逐步消化，形成类似真实用户的
// 时间分布。当 handleSignedFetch 需要 x-rap-param 时，Sanji 缓冲区已经充实，
// decoded byte[3] 自然变为 0x05（高质量）。

interface Point { x: number; y: number; }

// Bézier 曲线插值（三次）
function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

// 生成从 start 到 end 的 Bézier 鼠标路径
function bezierMousePath(start: Point, end: Point, steps = 28): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const side = Math.random() > 0.5 ? 1 : -1;
  const cp1: Point = {
    x: start.x + dx * 0.25 + side * (Math.random() * 80 + 40),
    y: start.y + dy * 0.25 - side * (Math.random() * 80 + 40),
  };
  const cp2: Point = {
    x: start.x + dx * 0.75 + side * (Math.random() * 60 + 20),
    y: start.y + dy * 0.75 - side * (Math.random() * 60 + 20),
  };
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = Math.pow(i / steps, 0.8);
    const pt = cubicBezier(start, cp1, cp2, end, t);
    points.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
  }
  return points;
}

// 单次注入少量事件（3~6 个 mousemove + 偶发 wheel），用于后台定时预热
function injectSmallBatch(): void {
  try {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const sx = Math.random() * vw * 0.6 + vw * 0.1;
    const sy = Math.random() * vh * 0.6 + vh * 0.1;
    const ex = sx + (Math.random() - 0.5) * 200;
    const ey = sy + (Math.random() - 0.5) * 150;
    const steps = 3 + Math.floor(Math.random() * 4);
    const path = bezierMousePath({ x: sx, y: sy }, { x: ex, y: ey }, steps);
    for (const pt of path) {
      window.dispatchEvent(new MouseEvent('mousemove', {
        clientX: pt.x, clientY: pt.y,
        screenX: pt.x, screenY: pt.y + 80,
        bubbles: true, cancelable: true,
      }));
    }
    // 随机偶发滚动（约 30% 概率）
    if (Math.random() < 0.3) {
      window.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 40 + Math.random() * 80,
        deltaMode: 0,
        bubbles: true, cancelable: true,
      }));
    }
  } catch (_) { }
}

function getRapQualityByte(rapParam: string): number | null {
  try {
    const decoded = atob(rapParam);
    // RAP prefixes differ at decoded byte[3]: ByQBBQ -> 0x05, ByQBBA -> 0x04, ByQBBg -> 0x06.
    return decoded.length > 3 ? decoded.charCodeAt(3) : null;
  } catch (_) {
    return null;
  }
}

function formatRapQuality(rapParam: string | null | undefined): string {
  const quality = rapParam ? getRapQualityByte(rapParam) : null;
  return quality === null ? '??' : quality.toString(16);
}

function isPreferredRapParam(rapParam: string | null | undefined): boolean {
  return getRapQualityByte(rapParam || '') === 5;
}

function getRapAppId(apiPath: string): string {
  const isCreatorApi = apiPath.indexOf('/web_api/sns/v2/note') >= 0
    || apiPath.indexOf('/web_api/sns/v5/creator/') >= 0;
  return isCreatorApi ? 'creator-platform' : 'xhs-pc-web';
}

function getRapBundleUrl(): string {
  if (RAP_BUNDLE_URL) return RAP_BUNDLE_URL;
  throw new Error('Cannot locate xhs-rap-bundle.js URL');
}

let rapSandboxPromise: Promise<Window> | null = null;

function getRapSandboxWindow(): Promise<Window> {
  if (rapSandboxPromise) return rapSandboxPromise;

  rapSandboxPromise = new Promise<Window>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    const bundleUrl = getRapBundleUrl();
    const timer = setTimeout(() => {
      reject(new Error('RAP sandbox load timed out'));
    }, 8000);

    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.onload = () => {
      clearTimeout(timer);
      const frameWindow = iframe.contentWindow as any;
      if (!frameWindow || typeof frameWindow.generate_x_rap_param !== 'function') {
        reject(new Error('RAP sandbox generator not available'));
        return;
      }
      resolve(frameWindow as Window);
    };
    iframe.onerror = () => {
      clearTimeout(timer);
      reject(new Error('RAP sandbox iframe failed to load'));
    };
    iframe.srcdoc = `<!doctype html><meta charset="utf-8"><script src="${bundleUrl}"></script>`;
    (document.documentElement || document.body).appendChild(iframe);
  }).catch((e) => {
    rapSandboxPromise = null;
    throw e;
  });

  return rapSandboxPromise;
}

function generateRapParamFromSandbox(apiPath: string, body: string): Promise<string | null> {
  return getRapSandboxWindow().then((frameWindow: any) => {
    const appId = getRapAppId(apiPath);
    const MAX_ATTEMPTS = 12;
    let bestRapParam: string | null = null;
    let bestQuality: number | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const rapParam = frameWindow.generate_x_rap_param(apiPath, body || '', appId) || '';
      const quality = getRapQualityByte(rapParam);
      const isTargetQuality = quality === 5;

      if (rapParam && (bestRapParam === null || isTargetQuality)) {
        bestRapParam = rapParam;
        bestQuality = quality;
      }
      if (isTargetQuality) {
        return rapParam;
      }
    }

    console.warn(`${TAG} [RAP-Sandbox] no preferred RAP after ${MAX_ATTEMPTS} attempts, bestQuality=0x${bestQuality === null ? '??' : bestQuality.toString(16)}`);
    return bestRapParam;
  });
}

function generateRapParamFromLivePage(apiPath: string, body: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    let storedValue: string | null = null;
    const TIMEOUT_MS = 3000;

    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        Object.defineProperty(window, '__capturedRapParam', {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } catch (_) {
        try { (window as any).__capturedRapParam = value; } catch (_2) { }
      }
      resolve(value);
    };

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
      console.warn(`${TAG} [RAP-LiveFallback] defineProperty failed:`, e.message);
      try { (window as any).__capturedRapParam = null; } catch (_) { }
    }

    const timeoutId = setTimeout(() => settle(storedValue), TIMEOUT_MS);

    try {
      (window as any).__rap_app_id__ = getRapAppId(apiPath);
      const url = /^https?:\/\//.test(apiPath) ? apiPath : 'https://edith.xiaohongshu.com' + apiPath;
      const xhr = new _currentXHR();
      xhr.open('POST', url, true);
      try { xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8'); } catch (_) { }
      xhr.send(body);
    } catch (e: any) {
      console.error(`${TAG} [RAP-LiveFallback] XHR trigger error:`, e.message);
      settle(null);
    }
  });
}

async function generateRapParam(apiPath: string, body: string): Promise<string | null> {
  try {
    const sandboxRapParam = await generateRapParamFromSandbox(apiPath, body);
    if (isPreferredRapParam(sandboxRapParam)) {
      return sandboxRapParam;
    }

    const liveRapParam = await generateRapParamFromLivePage(apiPath, body);
    if (isPreferredRapParam(liveRapParam)) {
      return liveRapParam;
    }

    return sandboxRapParam || liveRapParam;
  } catch (e: any) {
    console.warn(`${TAG} [generateRapParam] sandbox failed, falling back to live page RAP:`, e.message);
    return generateRapParamFromLivePage(apiPath, body);
  }
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
// content script 通过 postMessage 委托 inject script 在 page context 发 fetch。
// 用 fetch 而非 XHR：XHR 会被 Sanji hook 干扰（覆盖 x-rap-param、触发副作用请求）。
// page context 的 fetch 天然带正确的 Origin（https://www.xiaohongshu.com），且不被 Sanji 拦截。

async function handleXhrRequest(event: MessageEvent) {
  const { msgId, url, method, headers, body } = event.data;
  try {
    const fetchHeaders: Record<string, string> = {};
    if (headers && typeof headers === 'object') {
      for (const key of Object.keys(headers)) {
        fetchHeaders[key] = (headers as any)[key];
      }
    }
    const fetchOpts: RequestInit = {
      method: method || 'POST',
      headers: fetchHeaders,
      credentials: 'include',
    };
    if (body) fetchOpts.body = body;

    const response = await fetch(url, fetchOpts);
    const responseText = await response.text();
    window.postMessage({
      type: 'XHS_XHR_RESPONSE',
      msgId,
      status: response.status,
      responseText,
    }, '*');
  } catch (e: any) {
    window.postMessage({
      type: 'XHS_XHR_RESPONSE',
      msgId,
      status: 0,
      responseText: '',
      error: e.message || 'fetch error',
    }, '*');
  }
}

// ── 一体化签名+RAP+Fetch（复刻 console 测试 9 的完整流程）─────────────────────
// content script 发 XHS_SIGNED_FETCH，inject script 在 page context 里一气呵成完成：
// 1. 签名（mnsv2）
// 2. 触发 Sanji 生成 x-rap-param（xhr.send + 600ms 等待）
// 3. fetch 发请求
// 和 console 测试 9 完全一致，不跨 context 通信。

async function handleSignedFetch(event: MessageEvent) {
  const { msgId, apiPath, method, body } = event.data;
  try {
    const bodyStr = body || '';
    const fullUrl = 'https://edith.xiaohongshu.com' + apiPath;

    const a1 = getCookieValue('a1');
    if (!a1) throw new Error('a1 cookie not found');

    let xs: string;
    let xt: number;
    let xsCommon = '';

    if (typeof (window as any).mnsv2 === 'function') {
      // 优先用 mnsv2 生成 XYS_ 格式签名（消费端和创作者端均适用）
      xs = signWithMnsv2(apiPath, bodyStr);
      xt = Date.now();
      xsCommon = calcXsCommon(a1, xs, xt, apiPath);
    } else if (typeof (window as any)._webmsxyw === 'function') {
      // 兜底：mnsv2 不可用时用 _webmsxyw
      if (!signReady) await signFnReady;
      const signFn = (window as any)._webmsxyw;
      const signResult = signFn(apiPath, bodyStr, a1);
      xs = signResult['X-s'] || signResult['x-s'] || '';
      xt = signResult['X-t'] || signResult['x-t'] || Date.now();
      xsCommon = calcXsCommon(a1, xs, xt, apiPath);
    } else {
      throw new Error('No sign function available (neither mnsv2 nor _webmsxyw)');
    }

    // 2. 生成 x-rap-param。主路径在隔离 iframe 中同步执行 Spider_XHS 的 RAP 环境。
    (window as any).__rap_app_id__ = getRapAppId(apiPath);
    const rapParam = await generateRapParam(apiPath, bodyStr) || '';

    // 3. fetch（page context，Origin 正确）
    const hexChars = 'abcdef0123456789';
    const genHex = (n: number) => Array.from({ length: n }, () => hexChars[Math.floor(Math.random() * 16)]).join('');

    const fetchHeaders: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json;charset=UTF-8',
      'x-b3-traceid': genHex(16),
      'x-s': xs,
      'x-t': String(xt),
      'x-xray-traceid': genHex(32),
    };
    if (xsCommon) fetchHeaders['x-s-common'] = xsCommon;
    if (rapParam) fetchHeaders['x-rap-param'] = rapParam;

    const response = await fetch(fullUrl, {
      method: method || 'POST',
      headers: fetchHeaders,
      credentials: 'include',
      body: bodyStr || undefined,
    });
    const responseText = await response.text();

    window.postMessage({
      type: 'XHS_SIGNED_FETCH_RESPONSE',
      msgId,
      status: response.status,
      responseText,
    }, '*');
  } catch (e: any) {
    console.error(`${TAG} [handleSignedFetch] ERROR:`, e.message);
    window.postMessage({
      type: 'XHS_SIGNED_FETCH_RESPONSE',
      msgId,
      status: 0,
      responseText: '',
      error: e.message || 'signed fetch error',
    }, '*');
  }
}

// ── 注册所有消息监听 ─────────────────────────────────────────────────────────

window.addEventListener('message', (event) => {
  if (!event.data || event.source !== window) return;
  const type = event.data?.type;
  if (type === 'XHS_SIGN_REQUEST') handleSignRequest(event);
  else if (type === 'XHS_RAP_REQUEST') handleRapRequest(event);
  else if (type === 'XHS_XHR_REQUEST') handleXhrRequest(event);
  else if (type === 'XHS_SIGNED_FETCH') handleSignedFetch(event);
  else if (type === 'XHS_READ_RAP') {
    // content script 请求读取 page context 上的 __capturedRapParam
    const { msgId } = event.data;
    window.postMessage({
      type: 'XHS_READ_RAP_RESPONSE',
      msgId,
      value: (window as any).__capturedRapParam || '',
    }, '*');
  }
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
    const signObj = { x0: '4.3.5', x1: 'xhs-pc-web', x2: getPlatformName(), x3: s, x4: 'object' };
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
      const xsCommon = calcXsCommon(a1, xs, xt, '/api/sns/web/v2/user/me');
      if (!xsCommon) console.warn(`${TAG} Self-test: x-s-common is empty (CryptoJS missing?)`);
    } catch (e: any) {
      console.error(`${TAG} Self-test error:`, e.message);
    }
  }
});
