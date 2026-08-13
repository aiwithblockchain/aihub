// content-script-heartbeat.ts
//
// 两项解耦的职责：
//   1. 周期性把存活时间戳写入 chrome.storage.session（不唤醒 SW），供 background 判断平台 live；
//   2. 周期性刷新页面（location.reload）。
// 不建立持久 Port、不 sendMessage、不等待 ack，因此不存在「断线重连 → 重载」的无限循环。

const TAG = '[TweetClaw-HB]';

// 与 background 侧保持一致的前缀
const ALIVE_KEY_PREFIX = 'tweetclaw:alive:';

const LIVE_INTERVAL_MS    = 20_000;           // 写存活时间戳间隔
const RELOAD_INTERVAL_MS  = 30 * 60 * 1000;   // 周期刷新间隔

export function connect(platform: string) {
    // 1. 报告存活：每 20s 写一次时间戳，latest-write-wins，不等待任何响应
    let writeErrorLogged = false;
    const logWriteError = (e: unknown) => {
        if (writeErrorLogged) return;
        writeErrorLogged = true;
        console.warn(`${TAG} storage.session.set failed: platform=${platform}`, e);
    };

    setInterval(() => {
        try {
            void chrome.storage.session
                .set({ [`${ALIVE_KEY_PREFIX}${platform}`]: Date.now() })
                .catch(logWriteError);
        } catch (e) {
            logWriteError(e);
        }
    }, LIVE_INTERVAL_MS);

    // 2. 周期刷新：独立定时器，与报告存活完全解耦
    setInterval(() => {
        console.log(`${TAG} Periodic reload: platform=${platform}`);
        location.reload();
    }, RELOAD_INTERVAL_MS);

    console.log(
        `${TAG} Started: platform=${platform}, alive=${LIVE_INTERVAL_MS}ms, reload=${RELOAD_INTERVAL_MS}ms`
    );
}
