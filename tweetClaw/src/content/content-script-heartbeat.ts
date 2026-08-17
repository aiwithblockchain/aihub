// content-script-heartbeat.ts
//
// 消息式心跳：
//   1. 每 20s 向 background 发 TWEETCLAW_HEARTBEAT，由 background 更新健康表；
//   2. 发送失败（扩展上下文失效 / background 不可达）时 reload 当前页面。
// 不建立持久 Port、不等待 pong、不写 storage.session。

const TAG = '[TweetClaw-HB]';

const HEARTBEAT_MSG = 'TWEETCLAW_HEARTBEAT';
const HEARTBEAT_INTERVAL_MS = 20_000;

export function connect(platform: string) {
    let reloadScheduled = false;

    const reloadOnce = (reason: string) => {
        if (reloadScheduled) return;
        reloadScheduled = true;
        console.warn(`${TAG} reload: platform=${platform}, reason=${reason}`);
        location.reload();
    };

    const sendHeartbeat = () => {
        try {
            chrome.runtime.sendMessage(
                { type: HEARTBEAT_MSG, platform, url: location.href },
                () => {
                    if (chrome.runtime.lastError) {
                        reloadOnce(`sendMessage failed: ${chrome.runtime.lastError.message}`);
                    }
                }
            );
        } catch (e) {
            reloadOnce(`sendMessage threw: ${String(e)}`);
        }
    };

    // 注意：首条心跳在注入后立即发送。这里依赖 background 的
    // chrome.runtime.onMessage.addListener 在顶层同步注册；若将来把该监听器
    // 移入异步初始化之后，需改为延迟一个周期再发首条心跳，避免冷启动丢消息触发 reload 循环。
    sendHeartbeat();
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    console.log(`${TAG} Started: platform=${platform}, heartbeat=${HEARTBEAT_INTERVAL_MS}ms`);
}
