/**
 * Twitter Transaction ID (txid) generator.
 * Ported from TweetCat project.
 */

const KEY = "86C9766BF24F33C4BA215BDD305DAB25";

function getAlphaCheckSum(method: string, path: string, time: number): string {
    const s = `${method}!${path}!${time}!${KEY}`;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

export async function getTransactionIdFor(method: string, path: string): Promise<string> {
    const t = Math.floor(Date.now() / 1000);
    const checksum = getAlphaCheckSum(method.toUpperCase(), path, t);
    
    // Format: <timestamp_base36>:<checksum>
    const tBase36 = t.toString(36);
    return `${tBase36}:${checksum}`;
}
