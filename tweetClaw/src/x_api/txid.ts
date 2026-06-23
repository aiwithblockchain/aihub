/**
 * Twitter Transaction ID (txid) generator.
 *
 * 方案 B（2026-06）：X 改版后 DOM 不再包含 loading-x-anim SVG 元素，
 * 上游 x-client-transaction-id 库的 AnimationFrameDataError 无法修复。
 * 改为通过 CustomEvent 桥接调用 X 前端自己的 txid 生成函数
 * （webpack 模块 991160 导出的 kc(host, path, method)）。
 *
 * content script (isolated world) → CustomEvent → injection.ts (page world)
 * → webpackRequire(991160).kc(host, path, method) → txid
 */
import { ClientTransaction } from "x-client-transaction-id";

let cachedHtml: string | null = null;
let cachedBaseDoc: Document | null = null;
let lastFetched = 0;

function logTxid(message: string, extra?: Record<string, unknown>) {
    if (extra) {
        console.info('[TweetClaw-txid]', message, extra);
        return;
    }
    console.info('[TweetClaw-txid]', message);
}

// ── 方案 B: 通过 CustomEvent 桥接调用 X 自己的 kc 函数 ──

let bridgeAvailable: boolean | null = null;

async function getTxidViaBridge(method: string, path: string): Promise<string | null> {
    const requestId = `txid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            document.removeEventListener('tweetclaw:txid-response', onResponse as EventListener);
            logTxid('bridge timeout, falling back to library', { requestId });
            resolve(null);
        }, 3000);

        function onResponse(event: Event) {
            const detail = (event as CustomEvent).detail;
            if (!detail || detail.requestId !== requestId) return;
            clearTimeout(timeout);
            document.removeEventListener('tweetclaw:txid-response', onResponse as EventListener);
            if (detail.ok && detail.txid) {
                resolve(detail.txid as string);
            } else {
                logTxid('bridge returned error', { error: detail.error });
                resolve(null);
            }
        }

        document.addEventListener('tweetclaw:txid-response', onResponse as EventListener);
        document.dispatchEvent(new CustomEvent('tweetclaw:txid-request', {
            detail: {
                requestId,
                host: 'api.twitter.com',
                path,
                method,
            }
        }));
    });
}

// ── 方案 A (fallback): 上游 x-client-transaction-id 库 ──

function injectOnDemandRuntimeFallback(doc: Document, html: string): Document {
    const chunkIdMatch = html.match(/(\d+):\s*["']ondemand\.s["']/);
    const hashMatch = html.match(/ondemand\.s["']:\s*["']([a-f0-9]+)["']/);
    const chunkId = chunkIdMatch?.[1] || '7';
    const hash = hashMatch?.[1] || 'e7960b8a';

    const runtimeScript = doc.createElement('script');
    runtimeScript.textContent = `${chunkId}:"ondemand.s"}[e]||e)+"."+{${chunkId}:"${hash}"}`;
    (doc.head || doc.documentElement).appendChild(runtimeScript);

    logTxid('fallback runtime injected', { chunkId, hash });
    return doc;
}

async function getXHomepage(): Promise<{ html: string; baseDoc: Document }> {
    const now = Date.now();
    if (cachedHtml && cachedBaseDoc && now - lastFetched <= 60_000) {
        return { html: cachedHtml, baseDoc: cachedBaseDoc };
    }

    if (typeof document !== 'undefined' && document.location) {
        const host = document.location.hostname;
        if (host === 'x.com' || host === 'twitter.com') {
            const html = document.documentElement.outerHTML;
            if (html.includes('ondemand.s')) {
                cachedHtml = html;
                cachedBaseDoc = new DOMParser().parseFromString(html, 'text/html');
                lastFetched = now;
                logTxid('homepage cache refreshed from current tab document');
                return { html: cachedHtml, baseDoc: cachedBaseDoc };
            }
            logTxid('current tab document missing ondemand.s, falling back to fetch');
        }
    }

    const res = await fetch("https://x.com/", { credentials: "omit" });
    const html = await res.text();
    cachedHtml = html;
    cachedBaseDoc = new DOMParser().parseFromString(html, "text/html");
    lastFetched = now;
    logTxid('homepage cache refreshed via fetch fallback');
    return { html: cachedHtml, baseDoc: cachedBaseDoc };
}

function injectAnimationFrameIds(doc: Document): void {
    const existing = doc.querySelectorAll("[id^='loading-x-anim']");
    if (existing.length >= 4) return;

    const allSvgs = Array.from(doc.querySelectorAll('svg'));
    const candidates = allSvgs.filter(svg => {
        const g = svg.children[0];
        if (!g) return false;
        const path = g.children[1];
        if (!path) return false;
        const d = path.getAttribute('d');
        return d !== null && d.includes('C');
    });

    if (candidates.length === 0) {
        logTxid('no animation SVGs found with C commands');
        return;
    }

    const originals = [...candidates];
    candidates.forEach((svg, i) => {
        svg.id = `loading-x-anim-${i}`;
    });

    while (candidates.length < 4) {
        const template = originals[candidates.length % originals.length];
        const clone = template.cloneNode(true) as SVGSVGElement;
        clone.id = `loading-x-anim-${candidates.length}`;
        template.parentElement?.appendChild(clone);
        candidates.push(clone);
    }

    logTxid('animation frame IDs injected', {
        originals: originals.length,
        total: candidates.length,
    });
}

function cloneDoc(doc: Document): Document {
    return new DOMParser().parseFromString(doc.documentElement.outerHTML, 'text/html');
}

async function createTransaction(doc: Document): Promise<ClientTransaction> {
    return ClientTransaction.create(doc);
}

async function getTxidViaLibrary(method: string, path: string): Promise<string> {
    const { html, baseDoc } = await getXHomepage();

    try {
        const doc = cloneDoc(baseDoc);
        injectAnimationFrameIds(doc);
        const tx = await createTransaction(doc);
        const txid = tx.generateTransactionId(method, path);
        logTxid('txid generated with upstream runtime', { method, path });
        return txid;
    } catch (error) {
        logTxid('upstream txid generation failed, retrying with fallback runtime', {
            method,
            path,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    const fallbackDoc = injectOnDemandRuntimeFallback(cloneDoc(baseDoc), html);
    injectAnimationFrameIds(fallbackDoc);
    const tx = await createTransaction(fallbackDoc);
    const txid = tx.generateTransactionId(method, path);
    logTxid('txid generated with fallback runtime', { method, path });
    return txid;
}

// ── 主入口：先尝试方案 B (bridge)，失败则回退方案 A (library) ──

export async function getTransactionIdFor(method: string, path: string): Promise<string> {
    // 方案 B: 通过 CustomEvent 桥接调用 X 自己的 kc 函数
    if (bridgeAvailable !== false) {
        try {
            const txid = await getTxidViaBridge(method, path);
            if (txid) {
                if (bridgeAvailable === null) {
                    bridgeAvailable = true;
                    logTxid('bridge mode active (X native kc function)');
                }
                return txid;
            }
            bridgeAvailable = false;
            logTxid('bridge unavailable, falling back to library mode');
        } catch (e) {
            bridgeAvailable = false;
            logTxid('bridge error, falling back to library mode', {
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }

    // 方案 A: 上游库 (fallback)
    return getTxidViaLibrary(method, path);
}
