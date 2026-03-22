/**
 * 获取或创建当前 Chrome Profile 的稳定唯一标识符。
 * 存储在 chrome.storage.local 中，Profile 隔离，重启后保持不变。
 * 仅在扩展被卸载后才会丢失（chrome.storage.local 随扩展数据清除）。
 */
const INSTANCE_ID_KEY = 'bridge.instanceId';
const INSTANCE_NAME_KEY = 'bridge.instanceName';

export async function getOrCreateInstanceId(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_ID_KEY);
        if (result[INSTANCE_ID_KEY] && typeof result[INSTANCE_ID_KEY] === 'string') {
            return result[INSTANCE_ID_KEY];
        }
        // 首次运行：生成新 UUID 并持久化
        const newId = crypto.randomUUID();
        await chrome.storage.local.set({ [INSTANCE_ID_KEY]: newId });
        console.log('[tweetClaw] generated new instanceId:', newId);
        return newId;
    } catch (e) {
        // 降级：返回空字符串，Server 端会生成 tmp- 前缀的临时 ID 兜底
        console.warn('[tweetClaw] failed to read/write storage for instanceId:', e);
        return '';
    }
}

/**
 * 获取或创建实例名字。
 * 首次安装时生成默认名字（User-随机4位数字）。
 */
export async function getOrCreateInstanceName(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_NAME_KEY);
        if (result[INSTANCE_NAME_KEY] && typeof result[INSTANCE_NAME_KEY] === 'string') {
            return result[INSTANCE_NAME_KEY];
        }
        // 首次运行：生成默认名字
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const defaultName = `User-${randomNum}`;
        await chrome.storage.local.set({ [INSTANCE_NAME_KEY]: defaultName });
        console.log('[tweetClaw] generated default instanceName:', defaultName);
        return defaultName;
    } catch (e) {
        console.warn('[tweetClaw] failed to read/write storage for instanceName:', e);
        return 'User';
    }
}

/**
 * 设置实例名字。
 */
export async function setInstanceName(name: string): Promise<void> {
    try {
        await chrome.storage.local.set({ [INSTANCE_NAME_KEY]: name });
        console.log('[tweetClaw] updated instanceName:', name);
    } catch (e) {
        console.error('[tweetClaw] failed to set instanceName:', e);
        throw e;
    }
}

/**
 * 获取当前实例名字。
 */
export async function getInstanceName(): Promise<string> {
    try {
        const result = await chrome.storage.local.get(INSTANCE_NAME_KEY);
        return result[INSTANCE_NAME_KEY] || 'User';
    } catch (e) {
        console.warn('[tweetClaw] failed to get instanceName:', e);
        return 'User';
    }
}
