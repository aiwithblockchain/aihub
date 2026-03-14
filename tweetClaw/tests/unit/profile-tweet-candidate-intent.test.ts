import { describe, it, expect, beforeEach } from 'vitest';

// Simulator for debug.ts variables and functions
let selectedTabId: number | null = 101;
const selectedProfileTweetIds = new Map<number, string | null>();

function renderProfileTweetCandidateIntentCard(tweets: any[], scene: string): string {
    if (scene !== 'profile' || selectedTabId === null) return '';
    
    const selectedId = selectedProfileTweetIds.get(selectedTabId);
    if (!selectedId) return '';

    const selectedTweet = (tweets || []).find(t => t.tweetId === selectedId);
    if (!selectedTweet) return '';

    return `
        <div class="mb-3 p-2 border-start border-3" style="background: rgba(45,55,72,0.2); border-color: #4a5568; border-radius: 0 4px 4px 0">
            <div class="d-flex justify-content-between align-items-center">
                <div style="font-size: 11px;">
                    <span class="text-muted fw-bold">Candidate Type:</span>
                    <span class="ms-1 fw-bold text-white">PROFILE TWEET</span>
                    <span class="ms-1 text-info" style="font-size: 10px">@${(selectedTweet.authorHandle || '').replace('@', '')}</span>
                </div>
                <span class="badge bg-dark text-muted border border-secondary" style="font-size:8px">READ ONLY CANDIDATE</span>
            </div>
            <div class="mt-1 d-flex justify-content-between align-items-center">
                <span class="font-monospace text-warning" style="font-size: 10px; opacity: 0.9">${selectedTweet.tweetId}</span>
                <span class="text-muted" style="font-size: 9px; font-style: italic">Not yet bound to action target</span>
            </div>
            <div class="mt-1" style="font-size: 9px; color: #a0aec0">
                Ownership: ${selectedTweet.isOwnedByActiveAccount ? 'OWNED' : 'OTHERS'}
            </div>
        </div>`;
}

describe('Profile Tweet Candidate Intent Card Rendering', () => {
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
        }
    ];

    beforeEach(() => {
        selectedTabId = tid;
        selectedProfileTweetIds.clear();
    });

    it('1. selected profile tweet 时显示 candidate intent', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        const html = renderProfileTweetCandidateIntentCard(mockTweets, 'profile');
        
        expect(html).toContain('Candidate Type:');
        expect(html).toContain('PROFILE TWEET');
        expect(html).toContain('PT1');
        expect(html).toContain('@user1');
        expect(html).toContain('READ ONLY CANDIDATE');
        expect(html).toContain('Not yet bound to action target');
        expect(html).toContain('Ownership: OWNED');
    });

    it('2. 未选中时不显示', () => {
        selectedProfileTweetIds.set(tid, null);
        const html = renderProfileTweetCandidateIntentCard(mockTweets, 'profile');
        expect(html).toBe('');
    });

    it('3. 切换选中时 candidate 内容同步更新', () => {
        const moreTweets = [
            ...mockTweets,
            {
                tweetId: 'PT2',
                authorHandle: '@user2',
                isOwnedByActiveAccount: false
            }
        ];
        
        selectedProfileTweetIds.set(tid, 'PT1');
        let html = renderProfileTweetCandidateIntentCard(moreTweets, 'profile');
        expect(html).toContain('PT1');
        expect(html).toContain('@user1');
        
        selectedProfileTweetIds.set(tid, 'PT2');
        html = renderProfileTweetCandidateIntentCard(moreTweets, 'profile');
        expect(html).toContain('PT2');
        expect(html).toContain('@user2');
        expect(html).toContain('Ownership: OTHERS');
    });

    it('4. 取消选中后消失', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        let html = renderProfileTweetCandidateIntentCard(mockTweets, 'profile');
        expect(html).not.toBe('');

        selectedProfileTweetIds.set(tid, null);
        html = renderProfileTweetCandidateIntentCard(mockTweets, 'profile');
        expect(html).toBe('');
    });

    it('5. 非 profile scene 不显示', () => {
        selectedProfileTweetIds.set(tid, 'PT1');
        const html = renderProfileTweetCandidateIntentCard(mockTweets, 'tweet_detail');
        expect(html).toBe('');
    });
});
