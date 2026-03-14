import { describe, it, expect, beforeEach } from 'vitest';

// Simulator for debug.ts variables and functions
let selectedTabId: number | null = 101;
const selectedReplyIds = new Map<number, string | null>();

function renderSelectedReplyCard(replies: any[], scene: string): string {
    if (scene !== 'tweet_detail' || selectedTabId === null) return '';
    
    const selectedId = selectedReplyIds.get(selectedTabId);
    if (!selectedId) return '';

    const selectedReply = (replies || []).find(r => r.tweetId === selectedId);
    if (!selectedReply) return '';

    return `
        <div class="card mb-3 border-primary" style="border-width: 1px">
            <div class="card-header d-flex justify-content-between align-items-center" style="background: rgba(13, 110, 253, 0.05)">
                <span class="text-primary fw-bold">SELECTED REPLY DETAIL</span>
                <span class="badge bg-dark text-primary border border-primary" style="font-size:10px">READ ONLY</span>
            </div>
            <div class="card-body py-2">
                <div class="row">
                    <div class="col-8 border-right">
                        <div class="sys-stat"><span>Reply ID</span><span class="val text-warning">${selectedReply.tweetId}</span></div>
                        <div class="sys-stat"><span>Author</span><span class="val text-info">${selectedReply.authorHandle || '—'} ${selectedReply.authorName ? `<small class="text-muted">(${selectedReply.authorName})</small>` : ''}</span></div>
                        <div class="sys-stat"><span>Author ID</span><span class="val" style="font-size:10px; opacity:0.7">${selectedReply.authorId || '—'}</span></div>
                        <div class="sys-stat"><span>Created At</span><span class="val" style="font-size:10px">${selectedReply.createdAt || '—'}</span></div>
                        <div class="sys-stat"><span>Ownership</span><span class="val ${selectedReply.isByActiveAccount ? 'text-success' : 'text-muted'}">${selectedReply.isByActiveAccount ? 'YOU' : 'OTHERS'}</span></div>
                        <div class="mt-2" style="font-size:10px; color:#718096; text-transform:uppercase; font-weight:700">Content Snapshot</div>
                        <div class="p-2 mt-1 bg-dark rounded text-light" style="font-size:11px; max-height: 80px; overflow-y: auto;">
                            ${selectedReply.text || '<span class="text-muted italic">No content captured.</span>'}
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="mt-1" style="font-size:10px; color:#718096; text-transform:uppercase; font-weight:700">Metrics</div>
                        <div class="sys-stat mt-2"><span>Like</span><span class="val">${selectedReply.likeCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Reply</span><span class="val">${selectedReply.replyCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Repost</span><span class="val">${selectedReply.repostCount ?? '—'}</span></div>
                    </div>
                </div>
            </div>
        </div>`;
}

describe('Selected Reply Detail Card Rendering', () => {
    const tid = 101;
    const mockReplies = [
        {
            tweetId: 'R1',
            authorHandle: '@reply_user',
            authorName: 'Reply User',
            authorId: 'U1',
            text: 'This is a reply',
            createdAt: '2026-03-13T10:00:00Z',
            likeCount: 5,
            replyCount: 1,
            repostCount: 2,
            isByActiveAccount: false
        },
        {
            tweetId: 'R2',
            authorHandle: '@me',
            authorName: 'My Account',
            authorId: 'U2',
            text: 'This is my reply',
            createdAt: '2026-03-13T10:05:00Z',
            likeCount: 10,
            replyCount: 0,
            repostCount: 0,
            isByActiveAccount: true
        }
    ];

    beforeEach(() => {
        selectedTabId = tid;
        selectedReplyIds.clear();
    });

    it('1. should show reply detail when a reply is selected', () => {
        selectedReplyIds.set(tid, 'R1');
        const html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        
        expect(html).toContain('SELECTED REPLY DETAIL');
        expect(html).toContain('R1');
        expect(html).toContain('@reply_user');
        expect(html).toContain('This is a reply');
        expect(html).toContain('OTHERS');
    });

    it('2. should not render card when no reply is selected', () => {
        selectedReplyIds.set(tid, null);
        const html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).toBe('');
    });

    it('3. should update detail correctly when switching to another reply', () => {
        // First selection
        selectedReplyIds.set(tid, 'R1');
        let html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).toContain('R1');
        
        // Switch selection
        selectedReplyIds.set(tid, 'R2');
        html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).toContain('R2');
        expect(html).toContain('YOU');
        expect(html).toContain('My Account');
    });

    it('4. should disappear when selection is cleared', () => {
        selectedReplyIds.set(tid, 'R1');
        let html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).not.toBe('');

        selectedReplyIds.set(tid, null);
        html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).toBe('');
    });

    it('should not render if scene is not tweet_detail', () => {
        selectedReplyIds.set(tid, 'R1');
        const html = renderSelectedReplyCard(mockReplies, 'profile');
        expect(html).toBe('');
    });

    it('should not render if no tab is selected', () => {
        selectedTabId = null;
        selectedReplyIds.set(tid, 'R1');
        const html = renderSelectedReplyCard(mockReplies, 'tweet_detail');
        expect(html).toBe('');
    });
});
