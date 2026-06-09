/**
 * Instagram 请求签名模块
 * 使用 Web Crypto API 实现 HMAC-SHA256 签名
 */

import { SIGNATURE_KEY, SIGNATURE_VERSION, BREADCRUMB_KEY } from './constants';

/**
 * 签名后的请求体格式
 */
export interface SignedPost {
  signed_body: string;
  ig_sig_key_version: string;
}

/**
 * 用户行为追踪签名格式
 */
export interface UserBreadcrumb {
  size: number;
  term: number;
  text_change_event_count: number;
  timestamp: number;
}

/**
 * 使用 HMAC-SHA256 生成签名
 * @param data 待签名的数据字符串
 * @param key 签名密钥（默认使用 SIGNATURE_KEY）
 * @returns 十六进制签名字符串
 */
export async function signature(data: string, key: string = SIGNATURE_KEY): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);

  // 导入 HMAC 密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 生成签名
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(data)
  );

  // 转换为十六进制字符串
  const signatureArray = new Uint8Array(signatureBuffer);
  return Array.from(signatureArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 对请求负载进行签名
 * @param payload 请求负载（对象或字符串）
 * @returns 签名后的请求体
 */
export async function sign(payload: Record<string, any> | string): Promise<SignedPost> {
  const json = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  const sig = await signature(json);

  return {
    ig_sig_key_version: SIGNATURE_VERSION,
    signed_body: `${sig}.${json}`,
  };
}

/**
 * 生成用户行为追踪签名（用于评论等操作）
 * @param size 文本大小（字符数）
 * @returns Base64 编码的签名数据
 */
export async function userBreadcrumb(size: number): Promise<string> {
  // 生成随机参数
  const term = Math.floor(Math.random() * 2 + 2) * 1000 + size + Math.floor(Math.random() * 15 + 20) * 1000;
  const textChangeEventCount = Math.round(size / (Math.random() * 1 + 2)) || 1;
  const timestamp = Date.now();

  const data = `${size} ${term} ${textChangeEventCount} ${timestamp}`;

  // 生成签名
  const sig = await signature(data, BREADCRUMB_KEY);

  // 组合数据：签名 + 原始数据
  const breadcrumbData = `${sig}\n${data}`;

  // Base64 编码
  return btoa(breadcrumbData);
}

/**
 * 生成随机延迟时间
 * @param min 最小延迟（毫秒）
 * @param max 最大延迟（毫秒）
 * @returns 随机延迟时间（毫秒）
 */
export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 智能延迟（用于写操作频率控制）
 * @param minDelay 最小延迟（毫秒）
 * @param maxDelay 最大延迟（毫秒）
 */
export async function smartDelay(minDelay: number = 5000, maxDelay: number = 15000): Promise<void> {
  const delayTime = randomDelay(minDelay, maxDelay);
  console.log(`[IG API] Smart delay: ${delayTime}ms`);
  await delay(delayTime);
}

/**
 * 测试签名函数
 * 用于验证签名算法是否正确
 */
export async function testSignature(): Promise<void> {
  const testData = '{"test":"data"}';
  const sig = await signature(testData);
  console.log('Test data:', testData);
  console.log('Signature:', sig);
  console.log('Signed post:', await sign({ test: 'data' }));
}