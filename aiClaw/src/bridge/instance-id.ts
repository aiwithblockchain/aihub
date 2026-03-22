/**
 * 获取或创建当前 Chrome Profile 的稳定唯一标识符。
 * 存储在 chrome.storage.local 中，Profile 隔离，重启后保持不变。
 * 仅在扩展被卸载后才会丢失（chrome.storage.local 随扩展数据清除）。
 */
const INSTANCE_ID_KEY = 'bridge.instanceId';

export async function getOrCreateInstanceId(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_ID_KEY);
        if (result[INSTANCE_ID_KEY] && typeof result[INSTANCE_ID_KEY] === 'string') {
            return result[INSTANCE_ID_KEY];
        }
        // 首次运行：生成新 UUID 并持久化
        const newId = crypto.randomUUID();
        await chrome.storage.local.set({ [INSTANCE_ID_KEY]: newId });
        console.log('[aiClaw] generated new instanceId:', newId);
        return newId;
    } catch (e) {
        // 降级：返回空字符串，Server 端会生成 tmp- 前缀的临时 ID 兜底
        console.warn('[aiClaw] failed to read/write storage for instanceId:', e);
        return '';
    }
}

const INSTANCE_NAME_KEY = 'bridge.instanceName';

export async function getOrCreateInstanceName(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_NAME_KEY);
        if (result[INSTANCE_NAME_KEY] && typeof result[INSTANCE_NAME_KEY] === 'string') {
            return result[INSTANCE_NAME_KEY];
        }
        const defaultName = 'aiClaw-' + crypto.randomUUID().substring(0, 4);
        await chrome.storage.local.set({ [INSTANCE_NAME_KEY]: defaultName });
        console.log('[aiClaw] generated default instanceName:', defaultName);
        return defaultName;
    } catch (e) {
        console.warn('[aiClaw] failed to read/write storage for instanceName:', e);
        return '';
    }
}

export async function setInstanceName(name: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [INSTANCE_NAME_KEY]: name });
        console.log('[aiClaw] updated instanceName:', name);
    } catch (e) {
        console.error('[aiClaw] failed to set instanceName:', e);
    }
}

export async function getInstanceName(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_NAME_KEY);
        return (result[INSTANCE_NAME_KEY] as string) || '';
    } catch (e) {
        console.warn('[aiClaw] failed to get instanceName:', e);
        return '';
    }
}
