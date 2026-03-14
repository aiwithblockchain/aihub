import { describe, it, expect, beforeEach } from 'vitest';

// Simulator for debug.ts variables and functions
let selectedTabId: number | null = 101;
const selectedProfileTweetIds = new Map<number, string | null>();

function nFmt(num: number | string | null | undefined): string {
    if (num === null || num === undefined) return '—';
    if (typeof num === 'string') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function renderSelectedProfileTweetCard(tweets: any[], scene: string): string {
    if (scene !== 'profile' || selectedTabId === null) return '';
    
    const selectedId = selectedProfileTweetIds.get(selectedTabId);
    if (!selectedId) return '';

    const selectedTweet = (tweets || []).find(t => t.tweetId === selectedId);
    if (!selectedTweet) return '';

    return `
        <div class="card mb-3 border-primary" style="border-width: 1px">
            <div class="card-header d-flex justify-content-between align-items-center" style="background: rgba(13, 110, 253, 0.05)">
                <span class="text-primary fw-bold">SELECTED PROFILE TWEET DETAIL</span>
                <span class="badge bg-dark text-primary border border-primary" style="font-size:10px">READ ONLY</span>
            </div>
            <div class="card-body py-2">
                <div class="row">
                    <div class="col-8 border-right">
                        <div class="sys-stat"><span>Tweet ID</span><span class="val text-warning">${selectedTweet.tweetId}</span></div>
                        <div class="sys-stat"><span>Author</span><span class="val text-info">${selectedTweet.authorHandle || '—'} ${selectedTweet.authorName ? `<small class="text-muted">(${selectedTweet.authorName})</small>` : ''}</span></div>
                        <div class="sys-stat"><span>Created At</span><span class="val" style="font-size:10px">${selectedTweet.createdAt || '—'}</span></div>
                        <div class="sys-stat"><span>Ownership</span><span class="val ${selectedTweet.isOwnedByActiveAccount ? 'text-success' : 'text-muted'}">${selectedTweet.isOwnedByActiveAccount ? 'OWNED' : 'OTHERS'}</span></div>
                        <div class="mt-2" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Content Snapshot</div>
                        <div class="p-2 mt-1 bg-dark rounded text-light" style="font-size:11px; max-height: 80px; overflow-y: auto;">
                            ${selectedTweet.text || '<span class="text-muted italic">No content captured.</span>'}
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="mt-1" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Metrics</div>
                        <div class="sys-stat mt-2"><span>Like</span><span class="val">${nFmt(selectedTweet.likeCount)}</span></div>
                        <div class="sys-stat"><span>Reply</span><span class="val">${nFmt(selectedTweet.replyCount)}</span></div>
                        <div class="sys-stat"><span>Repost</span><span class="val">${nFmt(selectedTweet.repostCount)}</span></div>
                    </div>
                </div>
            </div>
        </div>`;
}

describe('Selected Profile Tweet Detail Card Rendering', () => {
    const tid = 101;
    const mockTweets = [
        {
            tweetId: 'PT1',
            authorHandle: '@user1',
            authorName: 'User One',
            text: 'Profile tweet one',
            createdAt: '2026-03-13T10:00:00Z',
            likeCount: 15,
            replyCount: 2,
            repostCount: 3,
            isOwnedByActiveAccount: true
        },
        {
            tweetId: 'PT2',
            authorHandle: '@user2',
            authorName: 'User Two',
            text: 'Profile tweet two',
            createdAt: '2026-03-13T10:05:00Z',
            likeCount: 20,
            replyCount: 1,
            repostCount: 0,
            isOwnedByActiveAccount: false
        }
    ];

    beforeEach(() => {
        selectedTabId = tid;
        selectedProfileTweetIds.clear();
    });

    it('1. 选中 profile tweet 时渲染 detail card', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        const html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        
        expect(html).toContain('SELECTED PROFILE TWEET DETAIL');
        expect(html).toContain('PT1');
        expect(html).toContain('@user1');
        expect(html).toContain('Profile tweet one');
        expect(html).toContain('OWNED');
    });

    it('2. 未选中时不渲染', () => {
        selectedProfileTweetIds.set(tid, null);
        const html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        expect(html).toBe('');
    });

    it('3. 切换选中时 detail 正确更新', () => {
        // First selection
        selectedProfileTweetIds.set(tid, 'PT1');
        let html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        expect(html).toContain('PT1');
        
        // Switch selection
        selectedProfileTweetIds.set(tid, 'PT2');
        html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        expect(html).toContain('PT2');
        expect(html).toContain('OTHERS');
        expect(html).toContain('User Two');
    });

    it('4. 取消选中后 card 消失', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        let html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        expect(html).not.toBe('');

        selectedProfileTweetIds.set(tid, null);
        html = renderSelectedProfileTweetCard(mockTweets, 'profile');
        expect(html).toBe('');
    });

    it('5. 非 profile scene 下不渲染', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        const html = renderSelectedProfileTweetCard(mockTweets, 'tweet_detail');
        expect(html).toBe('');
    });
});
