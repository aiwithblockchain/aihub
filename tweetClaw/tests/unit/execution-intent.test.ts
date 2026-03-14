import { describe, it, expect, beforeEach } from 'vitest';

// Simulator for debug.ts variables
const manualOverrides = new Map<number, boolean>();
const selectedReplyIds = new Map<number, string | null>();

function renderExecutionIntent(tid: number, pageContext: any, currentInputValue: string): string {
    const isManual = manualOverrides.get(tid) || false;
    const selectedReplyId = selectedReplyIds.get(tid) || null;
    const isTweetDetail = pageContext.scene === 'tweet_detail';
    const curEntity = pageContext.currentEntity;

    let targetType = 'NO TARGET';
    let targetId = '';
    let authorHandle = '';
    let sourceLabel = 'NONE';

    if (isManual) {
        targetType = 'MANUAL TARGET';
        targetId = currentInputValue;
        sourceLabel = 'MANUAL OVERRIDE';
    } else if (isTweetDetail && selectedReplyId) {
        const reply = (pageContext.repliesSnapshot || []).find((r: any) => r.tweetId === selectedReplyId);
        targetType = 'SELECTED REPLY';
        targetId = selectedReplyId;
        authorHandle = reply?.authorHandle || '';
        sourceLabel = 'AUTO: SELECTED REPLY';
    } else if (isTweetDetail && curEntity) {
        targetType = 'CURRENT TWEET';
        targetId = curEntity.entityId;
        authorHandle = curEntity.authorHandle || '';
        sourceLabel = 'AUTO: CURRENT ENTITY';
    }

    if (targetType === 'NO TARGET') {
        return `INTENT: NO TARGET | NONE`;
    }

    return `INTENT: ${targetType} | ${authorHandle ? `@${authorHandle.replace('@', '')} | ` : ''}${targetId} | ${sourceLabel}`;
}

describe('Execution Intent Logic (F-Zone)', () => {
    const tid = 101;

    beforeEach(() => {
        manualOverrides.clear();
        selectedReplyIds.clear();
    });

    it('1. should show CURRENT TWEET intent when in tweet_detail and no reply selected', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', authorHandle: '@main_author' }
        };
        const html = renderExecutionIntent(tid, pageContext, '');
        expect(html).toContain('INTENT: CURRENT TWEET');
        expect(html).toContain('@main_author');
        expect(html).toContain('T123');
        expect(html).toContain('AUTO: CURRENT ENTITY');
    });

    it('2. should show SELECTED REPLY intent when a reply is selected', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', authorHandle: '@main_author' },
            repliesSnapshot: [
                { tweetId: 'R456', authorHandle: '@reply_author' }
            ]
        };
        selectedReplyIds.set(tid, 'R456');

        const html = renderExecutionIntent(tid, pageContext, '');
        expect(html).toContain('INTENT: SELECTED REPLY');
        expect(html).toContain('@reply_author');
        expect(html).toContain('R456');
        expect(html).toContain('AUTO: SELECTED REPLY');
    });

    it('3. should show MANUAL TARGET intent when manual override is active', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', authorHandle: '@main_author' }
        };
        manualOverrides.set(tid, true);
        const userValue = 'CUSTOM_ID';

        const html = renderExecutionIntent(tid, pageContext, userValue);
        expect(html).toContain('INTENT: MANUAL TARGET');
        expect(html).toContain('CUSTOM_ID');
        expect(html).toContain('MANUAL OVERRIDE');
    });

    it('4. should show NO TARGET when no entity or selection is available', () => {
        const pageContext = {
            scene: 'home',
            currentEntity: null
        };
        const html = renderExecutionIntent(tid, pageContext, '');
        expect(html).toContain('INTENT: NO TARGET');
        expect(html).toContain('NONE');
    });

    it('5. should update intent synchronously when selection changes', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', authorHandle: '@main_author' },
            repliesSnapshot: [
                { tweetId: 'R456', authorHandle: '@reply_author' }
            ]
        };
        
        // Initial state
        let html = renderExecutionIntent(tid, pageContext, '');
        expect(html).toContain('CURRENT TWEET');

        // Select a reply
        selectedReplyIds.set(tid, 'R456');
        html = renderExecutionIntent(tid, pageContext, '');
        expect(html).toContain('SELECTED REPLY');
    });
});
