import { describe, it, expect } from 'vitest';
import { validateTweetDetailParams, formatTweetDetailUrl } from '../../src/utils/x-url-utils';

describe('X URL Utils - Shared Logic', () => {
    describe('validateTweetDetailParams', () => {
        it('1. 合法参数校验通过', () => {
            const res = validateTweetDetailParams('jack', '12345');
            expect(res.ok).toBe(true);
        });

        it('2. screenName 含空格校验失败', () => {
            const res = validateTweetDetailParams('jack doe', '12345');
            expect(res.ok).toBe(false);
            expect(res.error).toContain('not contain spaces or slashes');
        });

        it('3. screenName 含斜杠校验失败', () => {
            const res = validateTweetDetailParams('jack/doe', '12345');
            expect(res.ok).toBe(false);
            expect(res.error).toContain('not contain spaces or slashes');
        });

        it('4. tweetId 非数字校验失败', () => {
            const res = validateTweetDetailParams('jack', 'abc');
            expect(res.ok).toBe(false);
            expect(res.error).toContain('must be a numeric string');
        });

        it('5. 缺失参数校验失败', () => {
            // @ts-ignore
            expect(validateTweetDetailParams('', '123').ok).toBe(false);
            // @ts-ignore
            expect(validateTweetDetailParams('jack', '').ok).toBe(false);
        });
    });

    describe('formatTweetDetailUrl', () => {
        it('1. 正确拼接 URL', () => {
            expect(formatTweetDetailUrl('jack', '20')).toBe('https://x.com/jack/status/20');
        });

        it('2. 自动处理 @ 符号', () => {
            expect(formatTweetDetailUrl('@jack', '20')).toBe('https://x.com/jack/status/20');
        });
    });
});
