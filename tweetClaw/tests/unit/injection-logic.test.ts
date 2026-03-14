import { describe, it, expect } from 'vitest';
import { findScreenNameRecursive, getOpName, isTrustableIdentityOp } from '../../src/capture/extractor';

/**
 * X Guest Token handle 真正特征：
 *   - 恰好 15 个字符
 *   - 全小写字母 + 数字（无大写字母、无下划线）
 *   - 至少含一个数字
 *
 * 真实用户 handle 如 '1DU1Gf7oElR2h28' 含大写字母，绝对不是 guest token。
 */
const REAL_GUEST_HANDLE = 'xyz1234abc5678z'; // 15 chars, all lowercase+digits ✓

describe('Injection Logic (Layer 2 Capture)', () => {

    describe('findScreenNameRecursive (Safety Filter)', () => {
        it('should REJECT proper guest handles (all-lowercase 15-char+digit pattern)', () => {
            const data = { screen_name: REAL_GUEST_HANDLE };
            expect(findScreenNameRecursive(data)).toBeNull();
        });

        it('should NOT reject real user handles with uppercase letters', () => {
            // '1DU1Gf7oElR2h28' has uppercase — it is a real user, MUST NOT be rejected
            const data = { screen_name: '1DU1Gf7oElR2h28' };
            expect(findScreenNameRecursive(data)).toBe('1DU1Gf7oElR2h28');
        });

        it('should find valid screen_name in nested legacy object', () => {
            const data = {
                data: {
                    user: {
                        result: {
                            legacy: { screen_name: 'real_me' }
                        }
                    }
                }
            };
            expect(findScreenNameRecursive(data)).toBe('real_me');
        });

        it('should return null if screen_name is missing', () => {
            const data = { data: { other: 'stuff' } };
            expect(findScreenNameRecursive(data)).toBe(null);
        });
    });

    describe('getOpName (URL Parsing)', () => {
        it('should extract operation name from GraphQL URL', () => {
            const url = 'https://x.com/i/api/graphql/zzeLd/Viewer?variables={}';
            expect(getOpName(url)).toBe('Viewer');
        });

        it('should extract operation name from another GraphQL URL', () => {
            const url = 'https://x.com/i/api/graphql/abc123/HomeTimeline?variables={}';
            expect(getOpName(url)).toBe('HomeTimeline');
        });

        it('should return VerifyCredentials for 1.1 verify_credentials URL', () => {
            const url = 'https://x.com/i/api/1.1/account/verify_credentials.json';
            expect(getOpName(url)).toBe('VerifyCredentials');
        });

        it('should return settings.json for 1.1 settings URL', () => {
            const url = 'https://x.com/i/api/1.1/account/settings.json';
            expect(getOpName(url)).toBe('settings.json');
        });

        it('should return null for unrecognised URLs', () => {
            expect(getOpName('https://x.com/home')).toBeNull();
        });
    });

    describe('isTrustableIdentityOp (Anchor Filter)', () => {
        it('should trust authenticated root ops', () => {
            expect(isTrustableIdentityOp('Viewer')).toBe(true);
            expect(isTrustableIdentityOp('VerifyCredentials')).toBe(true);
            expect(isTrustableIdentityOp('AuthenticatedUserQuery')).toBe(true);
            expect(isTrustableIdentityOp('AccountSettings')).toBe(true);
            expect(isTrustableIdentityOp('settings.json')).toBe(true);
        });

        it('should NOT trust generic user fetches (profile pages etc)', () => {
            expect(isTrustableIdentityOp('UserByScreenName')).toBe(false);
            expect(isTrustableIdentityOp('UserTweets')).toBe(false);
            expect(isTrustableIdentityOp('HomeTimeline')).toBe(false);
        });
    });
});
