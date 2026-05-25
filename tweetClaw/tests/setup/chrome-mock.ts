/**
 * Chrome Extension API global mock
 * 在所有测试模块加载之前注入，防止 background.ts 顶层 chrome.* 调用崩溃
 */

import { vi } from 'vitest';

const noopFn = vi.fn();
const noopListener = { addListener: noopFn, removeListener: noopFn, hasListener: noopFn };

const chromeMock = {
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
        },
    },
    alarms: {
        onAlarm: noopListener,
        create: noopFn,
        clear: noopFn,
        get: vi.fn().mockResolvedValue(null),
    },
    runtime: {
        onStartup: noopListener,
        onInstalled: noopListener,
        onSuspend: noopListener,
        onMessage: noopListener,
        sendMessage: vi.fn().mockResolvedValue({}),
        getManifest: vi.fn().mockReturnValue({ version: '0.7.23' }),
        getURL: vi.fn((path: string) => `chrome-extension://testid/${path}`),
        lastError: null,
    },
    tabs: {
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: 1 }),
        get: vi.fn().mockResolvedValue({ id: 1, url: '' }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
        remove: vi.fn().mockResolvedValue(undefined),
    },
    windows: {
        getAll: vi.fn().mockResolvedValue([]),
        onCreated: noopListener,
        onRemoved: noopListener,
    },
    extension: {
        inIncognitoContext: false,
    },
};

// 注入全局，确保在所有测试模块加载前生效
(globalThis as any).chrome = chromeMock;
