import { describe, it, expect } from 'vitest';
import { findViewerSummary } from '../../src/capture/extractor';

/**
 * X Guest Token handle 真正特征：全小写字母+数字、恰好15字符、含数字。
 * 真实用户 handle 如 '1DU1Gf7oElR2h28' 含大写，不是 guest。
 */
const REAL_GUEST_HANDLE = 'xyz1234abc5678z';

describe('Identity Extractor - Viewer Resolution', () => {

    it('anchors identity from VerifyCredentials (v1.1 REST) flat structure', () => {
        const verifyResponse = {
            id_str: '12345',
            screen_name: 'test_user',
            name: 'Test Account',
            verified: false
        };
        const summary = findViewerSummary(verifyResponse);
        expect(summary?.handle).toBe('@test_user');
        expect(summary?.userId).toBe('12345');
        expect(summary?.displayName).toBe('Test Account');
    });

    it('anchors identity from nested GraphQL viewer block', () => {
        const gqlResponse = {
            data: {
                viewer: {
                    user_results: {
                        result: {
                            rest_id: '101',
                            legacy: { screen_name: 'gql_viewer', name: 'GraphQL User' }
                        }
                    }
                }
            }
        };
        const summary = findViewerSummary(gqlResponse);
        expect(summary?.handle).toBe('@gql_viewer');
        expect(summary?.userId).toBe('101');
    });

    it('REJECTS identity anchoring from proper guest handles (all-lowercase 15-char+digit)', () => {
        const guestResponse = {
            data: {
                viewer: {
                    user_results: {
                        result: {
                            rest_id: 'guest_id_001',
                            legacy: { screen_name: REAL_GUEST_HANDLE }
                        }
                    }
                }
            }
        };
        const summary = findViewerSummary(guestResponse);
        expect(summary).toBeNull();
    });

    it('DOES NOT reject real user handles with uppercase letters (fixes original bug)', () => {
        // '1DU1Gf7oElR2h28' contains uppercase D,U,G,R — must NOT be treated as guest
        const realUserResponse = {
            id_str: '999',
            screen_name: '1DU1Gf7oElR2h28',
            name: 'Real User',
            verified: false
        };
        const summary = findViewerSummary(realUserResponse);
        expect(summary).not.toBeNull();
        expect(summary?.handle).toBe('@1DU1Gf7oElR2h28');
    });

    it('REJECTS identity anchoring from regular user profile pages (UserByScreenName etc)', () => {
        // data.data.user.result — 这是 UserByScreenName 的响应结构
        // findViewerSummary 只信任 viewer / authenticated_user_info 路径
        const profileResponse = {
            data: {
                user: {
                    result: {
                        rest_id: '305032356',
                        legacy: { screen_name: 'NASA', name: 'NASA' }
                    }
                }
            }
        };
        const summary = findViewerSummary(profileResponse);
        expect(summary).toBeNull();
    });

    it('userId is always returned as a string', () => {
        const response = {
            id_str: '444',
            screen_name: 'string_id_user',
            name: 'User'
        };
        const summary = findViewerSummary(response);
        expect(typeof summary?.userId).toBe('string');
        expect(summary?.userId).toBe('444');
    });

    it('targetUid filters out non-matching viewer results', () => {
        const gqlResponse = {
            data: {
                viewer: {
                    user_results: {
                        result: {
                            rest_id: '101',
                            legacy: { screen_name: 'gql_viewer', name: 'GraphQL User' }
                        }
                    }
                }
            }
        };
        expect(findViewerSummary(gqlResponse, '101')?.handle).toBe('@gql_viewer');
        expect(findViewerSummary(gqlResponse, '999')).toBeNull();
    });

    it('returns null for completely unrecognised data structures', () => {
        expect(findViewerSummary({ some: 'random', data: 'blob' })).toBeNull();
        expect(findViewerSummary(null)).toBeNull();
        expect(findViewerSummary({})).toBeNull();
    });
});
