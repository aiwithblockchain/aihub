/**
 * Twitter Transaction ID (txid) generator.
 * Uses x-client-transaction-id library (same as TweetCat).
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

function injectOnDemandRuntimeFallback(doc: Document, html: string): Document {
    const chunkIdMatch = html.match(/(\d+):\s*["']ondemand\.s["']/);
    if (!chunkIdMatch) {
        logTxid('fallback skipped: ondemand chunk id not found');
        return doc;
    }

    const chunkId = chunkIdMatch[1];
    const hashRegex = new RegExp(`\\b${chunkId}:\\s*["']([a-zA-Z0-9_-]+)["']`, 'g');
    let hash: string | null = null;

    for (const match of html.matchAll(hashRegex)) {
        const candidate = match[1];
        if (candidate !== 'ondemand.s') {
            hash = candidate;
        }
    }

    if (!hash) {
        logTxid('fallback skipped: ondemand chunk hash not found', { chunkId });
        return doc;
    }

    const runtimeScript = doc.createElement('script');
    runtimeScript.setAttribute('data-tweetclaw-txid-fallback', 'true');
    runtimeScript.textContent = `${chunkId}:"ondemand.s"}[e]||e)+"."+{${chunkId}:"${hash}"}`;
    (doc.head || doc.documentElement).appendChild(runtimeScript);

    logTxid('fallback runtime injected', { chunkId, hash });
    return doc;
}

async function getXHomepage(): Promise<{ html: string; baseDoc: Document }> {
    const now = Date.now();
    if (!cachedHtml || !cachedBaseDoc || now - lastFetched > 60_000) {
        const res = await fetch("https://x.com/", { credentials: "omit" });
        const html = await res.text();
        cachedHtml = html;
        cachedBaseDoc = new DOMParser().parseFromString(html, "text/html");
        lastFetched = now;
        logTxid('homepage cache refreshed');
    }
    return { html: cachedHtml, baseDoc: cachedBaseDoc };
}

function cloneDoc(doc: Document): Document {
    return new DOMParser().parseFromString(doc.documentElement.outerHTML, 'text/html');
}

async function createTransaction(doc: Document): Promise<ClientTransaction> {
    return ClientTransaction.create(doc);
}

export async function getTransactionIdFor(method: string, path: string): Promise<string> {
    const { html, baseDoc } = await getXHomepage();

    try {
        const tx = await createTransaction(cloneDoc(baseDoc));
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
    const tx = await createTransaction(fallbackDoc);
    const txid = tx.generateTransactionId(method, path);
    logTxid('txid generated with fallback runtime', { method, path });
    return txid;
}
