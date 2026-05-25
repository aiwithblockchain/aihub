/**
 * XHS Sign Health Check - 单元测试
 *
 * 覆盖范围：
 * 1. ws-protocol 常量正确性（COMMAND/RESPONSE 类型对）
 * 2. checkXhsSignHealth() background 层全分支
 *    - no_creator_tab（未打开 creator 页）
 *    - content_script_error（sendMessage 抛出异常）
 *    - content_script_error（result.success=false）
 *    - 健康：ok=true
 *    - 不健康：mnsv2 缺失
 *    - 不健康：签名格式变化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MESSAGE_TYPES } from '../../src/bridge/ws-protocol';
import { checkXhsSignHealth } from '../../src/service_work/background';

// ── chrome API mock ──────────────────────────────────────────────────────────

function makeChromeTabsMock(
    queryResult: any[],
    sendMessageResult: any
) {
    return {
        tabs: {
            query: vi.fn().mockResolvedValue(queryResult),
            sendMessage: typeof sendMessageResult === 'function'
                ? sendMessageResult
                : vi.fn().mockResolvedValue(sendMessageResult),
        },
        runtime: {
            getManifest: vi.fn().mockReturnValue({ version: '0.7.23' }),
            lastError: null,
        },
    };
}

// ── 1. ws-protocol 常量正确性 ─────────────────────────────────────────────────

describe('ws-protocol: xhs_check_sign_health message types', () => {
    it('COMMAND_XHS_CHECK_SIGN_HEALTH should equal command.xhs_check_sign_health', () => {
        expect(MESSAGE_TYPES.COMMAND_XHS_CHECK_SIGN_HEALTH).toBe('command.xhs_check_sign_health');
    });

    it('RESPONSE_XHS_CHECK_SIGN_HEALTH should equal response.xhs_check_sign_health', () => {
        expect(MESSAGE_TYPES.RESPONSE_XHS_CHECK_SIGN_HEALTH).toBe('response.xhs_check_sign_health');
    });

    it('command and response types should be distinct', () => {
        expect(MESSAGE_TYPES.COMMAND_XHS_CHECK_SIGN_HEALTH).not.toBe(
            MESSAGE_TYPES.RESPONSE_XHS_CHECK_SIGN_HEALTH
        );
    });
});

// ── 2. checkXhsSignHealth() background 层 ───────────────────────────────────

describe('checkXhsSignHealth()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── 分支 1: creator tab 不存在 ─────────────────────────────────────────

    it('returns tab_found=false and ok=false when no creator tab is open', async () => {
        vi.stubGlobal('chrome', makeChromeTabsMock([], null));

        const result = await checkXhsSignHealth();

        expect(result.tab_found).toBe(false);
        expect(result.ok).toBe(false);
        expect(result.mnsv2_present).toBe(false);
        expect(result.sign_format_ok).toBe(false);
        expect(result.reason).toBe('no_creator_tab');
        expect(typeof result.checked_at).toBe('number');
    });

    // ── 分支 2: sendMessage 抛出异常（content script 未注入）───────────────

    it('returns tab_found=true and ok=false when sendMessage throws', async () => {
        const tab = { id: 42, url: 'https://creator.xiaohongshu.com/publish/publish' };
        vi.stubGlobal('chrome', {
            tabs: {
                query: vi.fn().mockResolvedValue([tab]),
                sendMessage: vi.fn().mockRejectedValue(new Error('Could not establish connection')),
            },
            runtime: { getManifest: vi.fn().mockReturnValue({ version: '0.7.23' }), lastError: null },
        });

        const result = await checkXhsSignHealth();

        expect(result.tab_found).toBe(true);
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('Content script communication failed');
    });

    // ── 分支 3: content script 返回 success=false ──────────────────────────

    it('returns tab_found=true and ok=false when content script returns success=false', async () => {
        const tab = { id: 42, url: 'https://creator.xiaohongshu.com/publish/publish' };
        vi.stubGlobal('chrome', makeChromeTabsMock(
            [tab],
            { success: false, error: 'inject_timeout' }
        ));

        const result = await checkXhsSignHealth();

        expect(result.tab_found).toBe(true);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('inject_timeout');
    });

    // ── 分支 4: 健康 —— mnsv2 存在且签名格式正确 ──────────────────────────

    it('returns ok=true when mnsv2 is present and sign format is correct', async () => {
        const tab = { id: 42, url: 'https://creator.xiaohongshu.com/publish/publish' };
        vi.stubGlobal('chrome', makeChromeTabsMock(
            [tab],
            {
                success: true,
                data: {
                    ok: true,
                    mnsv2_present: true,
                    sign_format_ok: true,
                    sample: 'XYS_2UQhPsHC...',
                },
            }
        ));

        const result = await checkXhsSignHealth();

        expect(result.tab_found).toBe(true);
        expect(result.ok).toBe(true);
        expect(result.mnsv2_present).toBe(true);
        expect(result.sign_format_ok).toBe(true);
        expect(result.sample).toBe('XYS_2UQhPsHC...');
        expect(typeof result.checked_at).toBe('number');
    });

    // ── 分支 5: mnsv2 缺失 ─────────────────────────────────────────────────

    it('returns ok=false when mnsv2 is missing on creator page', async () => {
        const tab = { id: 42, url: 'https://creator.xiaohongshu.com/publish/publish' };
        vi.stubGlobal('chrome', makeChromeTabsMock(
            [tab],
            {
                success: true,
                data: {
                    ok: false,
                    mnsv2_present: false,
                    sign_format_ok: false,
                    reason: 'mnsv2_missing',
                },
            }
        ));

        const result = await checkXhsSignHealth();

        expect(result.ok).toBe(false);
        expect(result.mnsv2_present).toBe(false);
        expect(result.sign_format_ok).toBe(false);
        expect(result.reason).toBe('mnsv2_missing');
        expect(result.tab_found).toBe(true);
    });

    // ── 分支 6: mnsv2 存在但签名格式变化 ──────────────────────────────────

    it('returns ok=false when mnsv2 exists but format has changed', async () => {
        const tab = { id: 42, url: 'https://creator.xiaohongshu.com/publish/publish' };
        vi.stubGlobal('chrome', makeChromeTabsMock(
            [tab],
            {
                success: true,
                data: {
                    ok: false,
                    mnsv2_present: true,
                    sign_format_ok: false,
                    reason: 'format_changed',
                    sample: 'NEWFMT_xyz123',
                },
            }
        ));

        const result = await checkXhsSignHealth();

        expect(result.ok).toBe(false);
        expect(result.mnsv2_present).toBe(true);
        expect(result.sign_format_ok).toBe(false);
        expect(result.reason).toBe('format_changed');
        expect(result.sample).toBe('NEWFMT_xyz123');
    });

    // ── 分支 7: checked_at 时间戳总是被设置 ───────────────────────────────

    it('always stamps checked_at with current timestamp', async () => {
        vi.stubGlobal('chrome', makeChromeTabsMock([], null));

        const before = Date.now();
        const result = await checkXhsSignHealth();
        const after = Date.now();

        expect(result.checked_at).toBeGreaterThanOrEqual(before);
        expect(result.checked_at).toBeLessThanOrEqual(after);
    });

    // ── 分支 8: 有多个 creator tab 时取第一个 ─────────────────────────────

    it('uses the first creator tab when multiple are open', async () => {
        const tabs = [
            { id: 10, url: 'https://creator.xiaohongshu.com/publish/publish' },
            { id: 20, url: 'https://creator.xiaohongshu.com/other-page' },
        ];
        const sendMessage = vi.fn().mockResolvedValue({
            success: true,
            data: { ok: true, mnsv2_present: true, sign_format_ok: true },
        });
        vi.stubGlobal('chrome', {
            tabs: { query: vi.fn().mockResolvedValue(tabs), sendMessage },
            runtime: { getManifest: vi.fn().mockReturnValue({ version: '0.7.23' }), lastError: null },
        });

        await checkXhsSignHealth();

        // 只应发消息给第一个 tab (id=10)
        expect(sendMessage).toHaveBeenCalledWith(10, { type: 'XHS_CHECK_SIGN_HEALTH' });
        expect(sendMessage).toHaveBeenCalledTimes(1);
    });
});
