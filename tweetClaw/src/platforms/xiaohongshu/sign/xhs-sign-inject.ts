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
  console.log(`${TAG} Received sign request: msgId=${msgId}, url=${url}, dataLen=${data?.length || 0}`);

  try {
    const a1 = getCookieValue('a1');
    if (!a1) throw new Error('a1 cookie not found. Please ensure you are logged in.');

    let xs: string;
    let xt: number;

    // 优先用 window.mnsv2 生成 XYS_ 格式签名（creator 页面）
    if (typeof (window as any).mnsv2 === 'function') {
      xs = signWithMnsv2(url, data || '');
      xt = Date.now();
      console.log(`${TAG} Sign via mnsv2 (XYS_): msgId=${msgId}, xs=${xs.slice(0, 15)}...`);
    } else {
      // 回退到 _webmsxyw（www 页面）
      if (!signReady) await signFnReady;
      const signFn = (window as any)._webmsxyw;
      if (typeof signFn !== 'function') throw new Error('Neither mnsv2 nor _webmsxyw found on window.');
      const signResult = signFn(url, data, a1);
      xs = signResult['X-s'] || signResult['x-s'] || '';
      xt = signResult['X-t'] || signResult['x-t'] || Date.now();
      console.log(`${TAG} Sign via _webmsxyw: msgId=${msgId}, xs=${xs.slice(0, 15)}...`);
    }

    const xsCommon = calcXsCommon(a1, xs, xt);
    console.log(`${TAG} calcXsCommon OK: ${xsCommon.slice(0, 50)}...`);

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

// ── RAP iframe 沙盒：复用页面已有的 webpack chunk 4630 生成 x-rap-param ──────
//
// 思路与 Twitter txid（x-client-transaction-id）完全一致：
//   - 算法就在页面已加载的 webpack chunks 里（chunk 4630, module 9116）
//   - 直接从 self.webpackChunkxhs_pc_web 取出工厂函数，字符串化后写入 iframe
//   - iframe 里 self/window 是独立的，假 XMLHttpRequest 不污染主页面
//   - 不需要引入任何外部 bundle 文件
//
// 注意：必须用 d.write() 将工厂函数源码写入 iframe 执行，
//       不能用 factory.call(iframeWindow)，因为函数内部 self 仍指向主页面。

let rapIframe: HTMLIFrameElement | null = null;
let rapIframeReady: Promise<void> | null = null;

function findRapFactory(): string | null {
  const chunks = (self as any).webpackChunkxhs_pc_web;
  if (!Array.isArray(chunks)) return null;
  for (const chunk of chunks) {
    const modules = chunk[1] as Record<string, Function>;
    if (modules && typeof modules['9116'] === 'function') {
      return modules['9116'].toString();
    }
  }
  return null;
}

function initRapIframe(): Promise<void> {
  if (rapIframeReady) return rapIframeReady;

  rapIframeReady = new Promise((resolve, reject) => {
    // 轮询等待 webpackChunkxhs_pc_web 加载完并包含 module 9116
    // （inject script 在 document_start 运行，此时 chunks 还没加载）
    let elapsed = 0;
    const MAX_WAIT = 15000;
    const INTERVAL = 200;

    const waitForChunks = () => {
      const factorySource = findRapFactory();
      if (factorySource) {
        startIframe(factorySource, resolve, reject);
        return;
      }
      elapsed += INTERVAL;
      if (elapsed >= MAX_WAIT) {
        reject(new Error('RAP module 9116 not found after 15s'));
        return;
      }
      setTimeout(waitForChunks, INTERVAL);
    };
    waitForChunks();
  });

  return rapIframeReady;
}

function startIframe(factorySource: string, resolve: () => void, reject: (e: Error) => void) {
    console.log(`${TAG} Found RAP factory (${factorySource.length} chars), setting up iframe...`);

    rapIframe = document.createElement('iframe');
    rapIframe.style.display = 'none';
    document.documentElement.appendChild(rapIframe);

    const d = rapIframe.contentDocument!;
    d.open();
    // 把工厂函数源码写进 iframe，在 iframe 自己的 self/window 上下文中执行
    // 这样 RAP 算法里的 self.webpackChunkxhs_pc_web.push 就会绑到 iframe 的 window
    d.write(`<!DOCTYPE html><html><head></head><body><script>
(function setupRap() {
  // 配置：RAP SDK 需要的全局变量
  window.anti_hp_sign_config = {
    signIncludesUrl: [
      { pattern: "web_api/sns/v2/note", mode: "endsWith" },
      { pattern: "web_api/sns/v5/creator/", mode: "includes" },
      { pattern: "api/sns/web/v1/homefeed", mode: "endsWith" }
    ],
    responseTransformConfigs: []
  };
  window.__rap_app_id__ = "creator-platform";
  window.__INITIAL_STATE__ = { global: {}, user: {}, search: {} };
  window.__capturedRapParam = null;

  // 假 XMLHttpRequest（供 Sanji 捕获后作为 "原始" XHR）
  // Sanji 会用 var __XMLHttpRequest = XMLHttpRequest 保存我们的假实现，
  // 再用自己的版本替换 window.XMLHttpRequest。
  // Sanji 在 send() 里生成 x-rap-param，然后对内层（假）XHR 调用 setRequestHeader。
  var FakeXHR = function() {
    this._headers = {}; this.readyState = 0; this.status = 200;
    this.responseText = '{"success":true,"data":{"items":[]}}';
    this.response = this.responseText;
    this.upload = { addEventListener:function(){}, removeEventListener:function(){} };
  };
  FakeXHR.prototype.open = function(m,u){ this._url=u; this.readyState=1; };
  FakeXHR.prototype.setRequestHeader = function(n,v){
    this._headers[String(n).toLowerCase()]=String(v);
    if(String(n).toLowerCase()==='x-rap-param') window.__capturedRapParam=String(v);
  };
  FakeXHR.prototype.send = function(){
    this.readyState=4;
    if(typeof this.onreadystatechange==='function') this.onreadystatechange();
    if(typeof this.onload==='function') this.onload();
  };
  FakeXHR.prototype.abort = function(){};
  FakeXHR.prototype.addEventListener = function(t,h){ if(t==='load') this.onload=h; };
  FakeXHR.prototype.removeEventListener = function(){};
  FakeXHR.prototype.getResponseHeader = function(){ return null; };
  FakeXHR.prototype.getAllResponseHeaders = function(){ return ''; };
  FakeXHR.prototype.overrideMimeType = function(){};
  window.XMLHttpRequest = FakeXHR;

  // SyncPromise（RAP 内部需要同步执行）
  function SP(exec){
    this.value=undefined; this.error=undefined;
    try{exec(function(v){this.value=v;}.bind(this),function(e){this.error=e;}.bind(this));}catch(e){this.error=e;}
  }
  SP.prototype.then=function(r,j){try{return this.error?(j?SP.resolve(j(this.error)):this):SP.resolve(r?r(this.value):this.value);}catch(e){return SP.reject(e);}};
  SP.prototype.catch=function(j){return this.then(null,j);};
  SP.prototype.finally=function(f){if(f)f();return this;};
  SP.resolve=function(v){if(v&&typeof v.then==='function'&&!(v instanceof SP)){var o;v.then(function(r){o=r;});return new SP(function(r){r(o);});}return new SP(function(r){r(v);});};
  SP.reject=function(e){return new SP(function(_,j){j(e);});};
  SP.all=function(vs){return SP.resolve(vs.map(function(v){return v instanceof SP?v.value:v;}));};
  window.Promise=SP; Promise=SP;

  // 同步 timer（防止异步泄露到真实事件循环）
  var timerQueue=[];
  window.setTimeout=function(fn){timerQueue.push(fn);return timerQueue.length;};
  window.clearTimeout=function(){};
  window.setInterval=function(fn,ms){timerQueue.push(fn);return timerQueue.length;};
  window.clearInterval=function(){};
  setTimeout=window.setTimeout; clearTimeout=window.clearTimeout;
  window.__flushRapTimers=function(){
    for(var i=0;i<50&&timerQueue.length;i++){
      var t=timerQueue.splice(0);
      for(var j=0;j<t.length;j++){try{t[j]();}catch(e){}}
    }
  };

  // navigator.userAgentData.getHighEntropyValues 必须返回 SyncPromise
  // 真实浏览器返回原生 Promise，SP 无法同步 resolve 它，会导致 Sanji 内部拿不到值
  if(navigator.userAgentData && navigator.userAgentData.getHighEntropyValues){
    navigator.userAgentData.getHighEntropyValues = function(keys){
      var values={architecture:"x86",bitness:"64",brands:navigator.userAgentData.brands,fullVersionList:navigator.userAgentData.brands,mobile:false,model:"",platform:"Windows",platformVersion:"15.0.0",uaFullVersion:"131.0.0.0",wow64:false};
      var requested=Array.isArray(keys)?keys:Object.keys(values);
      var result={};
      requested.forEach(function(key){result[key]=values[key];});
      return SP.resolve(result);
    };
  }

  // 其他 Sanji 可能访问的 API mock
  window.blur=function(){};
  window.postMessage=function(){};
  console.debug=function(){};
  window.requestAnimationFrame=function(cb){timerQueue.push(function(){cb(Date.now());});return timerQueue.length;};
  window.cancelAnimationFrame=function(){};

  // 执行 RAP 工厂函数（webpack module 9116 的 factory）
  // factory 是零参数函数，内部 Sanji IIFE 自执行并 hook XMLHttpRequest
  try {
    var rapFactory = (${factorySource});
    rapFactory();
    window.__flushRapTimers();

    // 工厂执行完毕，Sanji 已经 hook 了 XMLHttpRequest（可能完全替换了它）。
    // 无论 Sanji 是替换整个构造器还是只扩展 prototype.send，
    // 都在当前 window.XMLHttpRequest 的 prototype 上再补一道 setRequestHeader 拦截，
    // 确保 x-rap-param 一定被捕获。
    var origSetHeader = window.XMLHttpRequest.prototype.setRequestHeader;
    window.XMLHttpRequest.prototype.setRequestHeader = function(n,v){
      if(String(n).toLowerCase()==='x-rap-param') window.__capturedRapParam=String(v);
      if(typeof origSetHeader==='function') origSetHeader.call(this,n,v);
    };

    window.__rapReady = true;
    console.log('[RAP-iframe] Sanji initialized, XMLHttpRequest hooked');
  } catch(e) {
    console.error('[RAP-iframe] factory error:', e && e.message ? e.message : String(e));
    window.__rapReady = false;
  }
})();
<\/script></body></html>`);
    d.close();

    // 轮询直到 iframe 初始化完成
    let attempts = 0;
    const check = () => {
      attempts++;
      const iw = rapIframe!.contentWindow as any;
      if (iw && iw.__rapReady === true) {
        console.log(`${TAG} RAP iframe ready (attempts=${attempts})`);
        resolve();
      } else if (iw && iw.__rapReady === false) {
        reject(new Error('RAP iframe init failed: __rapReady=false'));
      } else if (attempts > 50) {
        reject(new Error('RAP iframe timed out'));
      } else {
        setTimeout(check, 50);
      }
    };
    setTimeout(check, 100);
}

// ── 以上为 startIframe 函数体结束 ────────────────────────────────────────────

function generateRapParam(apiPath: string, body: string): string | null {
  if (!rapIframe?.contentWindow) {
    console.warn(`${TAG} RAP iframe not available`);
    return null;
  }
  try {
    const w = rapIframe.contentWindow as any;
    w.__capturedRapParam = null;
    w.__rap_app_id__ = 'creator-platform';
    const url = /^https?:\/\//.test(apiPath)
      ? apiPath
      : 'https://edith.xiaohongshu.com' + apiPath;
    const xhr = new w.XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');
    xhr.send(body);
    w.__flushRapTimers();
    return w.__capturedRapParam || null;
  } catch (e: any) {
    console.error(`${TAG} generateRapParam error:`, e.message);
    return null;
  }
}

// 启动 RAP iframe 初始化（页面加载时立即开始，不阻塞签名流程）
// 保存 Promise 供 handlePublishRequest 等待
const rapIframeReadyPromise = initRapIframe();
rapIframeReadyPromise.catch(e => console.warn(`${TAG} RAP iframe init failed:`, e.message));

// ── RAP 参数请求处理 ─────────────────────────────────────────────────────────
//
// content script 请求生成 x-rap-param，inject script 计算后返回值。
// content script 自己用 fetch 发请求（isolated world，不受主页面 RAP SDK 影响）。

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
  console.log(`${TAG} Received RAP request: msgId=${msgId}, apiPath=${apiPath}`);

  try {
    await rapIframeReadyPromise;
    const rapParam = generateRapParam(apiPath, body);
    if (rapParam) {
      console.log(`${TAG} x-rap-param generated: ${rapParam.slice(0, 50)}...`);
    } else {
      console.warn(`${TAG} x-rap-param generation returned null`);
    }
    window.postMessage({ type: 'XHS_RAP_RESPONSE', msgId, success: true, rapParam: rapParam || '' }, '*');
  } catch (e: any) {
    console.error(`${TAG} RAP error:`, e);
    window.postMessage({ type: 'XHS_RAP_RESPONSE', msgId, success: false, error: e.message }, '*');
  }
}

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
  console.log(`${TAG} Health check request received: msgId=${msgId}`);
  const result = checkMnsv2Status();
  console.log(`${TAG} Health check result: ok=${result.ok}, mnsv2_present=${result.mnsv2_present}, sign_format_ok=${result.sign_format_ok}, reason=${result.reason || 'none'}, sample=${result.sample || 'n/a'}`);
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

// ── Self-test：等 _webmsxyw 就绪后验证签名+xs_common ─────────────────────────

signFnReady.then(() => {
  const signFn = (window as any)._webmsxyw;
  const a1 = getCookieValue('a1');
  console.log(`${TAG} Self-test: _webmsxyw=${typeof signFn}, a1=${a1 ? a1.slice(0, 8) + '...' : 'NOT_FOUND'}`);

  if (typeof signFn === 'function' && a1) {
    try {
      const result = signFn('/api/sns/web/v2/user/me', '', a1);
      const xs = result['X-s'] || result['x-s'] || '';
      const xt = result['X-t'] || result['x-t'] || '';
      console.log(`${TAG} Self-test x-s: ${xs.slice(0, 30)}...`);
      console.log(`${TAG} Self-test x-t: ${xt}`);

      const xsCommon = calcXsCommon(a1, xs, xt);
      if (xsCommon) {
        console.log(`${TAG} Self-test x-s-common OK: ${xsCommon.slice(0, 50)}...`);
      } else {
        console.warn(`${TAG} Self-test x-s-common EMPTY (CryptoJS missing?)`);
      }
    } catch (e: any) {
      console.error(`${TAG} Self-test error:`, e.message);
    }
  }
});

console.log(`${TAG} Inject script loaded, waiting for _webmsxyw...`);
