import { describe, it, expect, vi, beforeEach } from 'vitest';

const manualOverrides = new Map<number, boolean>();
const lastFilledIds = new Map<number, string>();
const selectedReplyIds = new Map<number, string | null>();

// 模拟 renderDetailView 中的核心逻辑
function runBindingLogic(tid: number, pageContext: any, currentInputValue: string) {
    const curEntityId = pageContext.currentEntity?.entityId || '';
    const isTweetDetail = pageContext.scene === 'tweet_detail';
    
    let isManual = manualOverrides.get(tid) || false;
    let lastFilled = lastFilledIds.get(tid) || '';
    let selectedReplyId = selectedReplyIds.get(tid) || null;

    // Auto-fill trigger: switched to a different tweet detail
    if (isTweetDetail && curEntityId && curEntityId !== lastFilled) {
        isManual = false;
        lastFilled = curEntityId;
        selectedReplyId = null; // Clear reply selection when switching main tweet
        manualOverrides.set(tid, false);
        lastFilledIds.set(tid, curEntityId);
        selectedReplyIds.set(tid, null);
    }

    // Auto-clear trigger: leaving tweet_detail when it was previously auto-filled
    if (!isTweetDetail && !isManual && lastFilled !== '') {
        lastFilled = '';
        lastFilledIds.set(tid, '');
        selectedReplyIds.set(tid, null);
    }

    // Determine value to show in input
    let displayTargetId = '';
    let sourceLabel = 'NONE';

    if (isManual) {
        displayTargetId = currentInputValue;
        sourceLabel = 'MANUAL OVERRIDE';
    } else if (isTweetDetail && selectedReplyId) {
        displayTargetId = selectedReplyId;
        sourceLabel = 'AUTO: SELECTED REPLY';
    } else if (isTweetDetail && lastFilled) {
        displayTargetId = lastFilled;
        sourceLabel = 'AUTO: CURRENT ENTITY';
    } else {
        displayTargetId = isManual ? currentInputValue : '';
    }

    return { displayTargetId, sourceLabel };
}

describe('Target Binding Logic (F-Zone)', () => {
    const tid = 101;

    beforeEach(() => {
        manualOverrides.clear();
        lastFilledIds.clear();
        selectedReplyIds.clear();
    });

    it('should auto-fill target ID in tweet_detail scene', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };

        const result = runBindingLogic(tid, pageContext, '');
        expect(result.displayTargetId).toBe('T123');
        expect(result.sourceLabel).toBe('AUTO: CURRENT ENTITY');
        expect(lastFilledIds.get(tid)).toBe('T123');
    });

    it('should prioritized selected reply over current entity', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        // Initial auto-fill
        runBindingLogic(tid, pageContext, '');
        
        // Select a reply
        selectedReplyIds.set(tid, 'R456');

        const result = runBindingLogic(tid, pageContext, '');
        expect(result.displayTargetId).toBe('R456');
        expect(result.sourceLabel).toBe('AUTO: SELECTED REPLY');
    });

    it('should return to CURRENT ENTITY if reply selection is cleared', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pageContext, '');
        selectedReplyIds.set(tid, 'R456');
        
        // Clear selection
        selectedReplyIds.set(tid, null);

        const result = runBindingLogic(tid, pageContext, '');
        expect(result.displayTargetId).toBe('T123');
        expect(result.sourceLabel).toBe('AUTO: CURRENT ENTITY');
    });

    it('should be overridden by manual input even if reply is selected', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pageContext, '');
        selectedReplyIds.set(tid, 'R456');
        
        // Manual override
        manualOverrides.set(tid, true);
        const userValue = 'T_MANUAL';

        const result = runBindingLogic(tid, pageContext, userValue);
        expect(result.displayTargetId).toBe('T_MANUAL');
        expect(result.sourceLabel).toBe('MANUAL OVERRIDE');
    });

    it('should clear reply selection when switching to a DIFFERENT tweet detail', () => {
        const pc1 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pc1, '');
        selectedReplyIds.set(tid, 'R_OLD');

        // Switch to T789
        const pc2 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T789', entityType: 'tweet' }
        };
        const result = runBindingLogic(tid, pc2, '');
        
        expect(result.displayTargetId).toBe('T789');
        expect(result.sourceLabel).toBe('AUTO: CURRENT ENTITY');
        expect(selectedReplyIds.get(tid)).toBe(null);
    });

    it('should NOT overwrite if user has manually modified the input', () => {
        // First, it was auto-filled
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pageContext, '');
        
        // Then user modifies it
        manualOverrides.set(tid, true);
        const userValue = 'T_MANUAL';

        // Refresh happens
        const result = runBindingLogic(tid, pageContext, userValue);
        expect(result.displayTargetId).toBe('T_MANUAL');
        expect(result.sourceLabel).toBe('MANUAL OVERRIDE');
    });

    it('should overwrite even if manually modified if switching to a DIFFERENT tweet', () => {
        // First, it was auto-filled and then overridden
        const pageContext1 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pageContext1, '');
        manualOverrides.set(tid, true);

        // Switch to T456
        const pageContext2 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T456', entityType: 'tweet' }
        };
        const result = runBindingLogic(tid, pageContext2, 'T_MANUAL');
        
        expect(result.displayTargetId).toBe('T456');
        expect(result.sourceLabel).toBe('AUTO: CURRENT ENTITY');
        expect(manualOverrides.get(tid)).toBe(false);
    });

    it('should NOT auto-fill in non-tweet_detail scenes', () => {
        const pageContext = {
            scene: 'home',
            currentEntity: null
        };

        const result = runBindingLogic(tid, pageContext, '');
        expect(result.displayTargetId).toBe('');
        expect(result.sourceLabel).toBe('NONE');
    });

    it('should clear auto-filled value when leaving tweet_detail', () => {
        // In tweet_detail
        const pc1 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pc1, '');

        // Move to home
        const pc2 = {
            scene: 'home',
            currentEntity: null
        };
        const result = runBindingLogic(tid, pc2, 'T123');
        expect(result.displayTargetId).toBe('');
        expect(lastFilledIds.get(tid)).toBe('');
    });

    it('should NOT clear manual override when leaving tweet_detail', () => {
        // In tweet_detail, manually overridden
        const pc1 = {
            scene: 'tweet_detail',
            currentEntity: { entityId: 'T123', entityType: 'tweet' }
        };
        runBindingLogic(tid, pc1, '');
        manualOverrides.set(tid, true);
        const userVal = 'T_USER';

        // Move to home
        const pc2 = {
            scene: 'home',
            currentEntity: null
        };
        const result = runBindingLogic(tid, pc2, userVal);
        expect(result.displayTargetId).toBe('T_USER');
        expect(result.sourceLabel).toBe('MANUAL OVERRIDE');
    });
});
