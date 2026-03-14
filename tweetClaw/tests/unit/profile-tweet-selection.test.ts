import { describe, it, expect, beforeEach } from 'vitest';

const selectedProfileTweetIds = new Map<number, string | null>();

// Mocking the core logic from debug.ts
function runProfileSelectionLogic(tid: number, pageContext: any) {
    // Selection of Profile Tweet clearing
    if (pageContext.scene !== 'profile' && selectedProfileTweetIds.get(tid)) {
        selectedProfileTweetIds.set(tid, null);
    }
    
    return selectedProfileTweetIds.get(tid);
}

describe('Profile Tweet Selection Logic', () => {
    const tid1 = 101;
    const tid2 = 102;

    beforeEach(() => {
        selectedProfileTweetIds.clear();
    });

    it('should allow selecting a profile tweet in profile scene', () => {
        const pageContext = { scene: 'profile' };
        
        // Initial state
        expect(runProfileSelectionLogic(tid1, pageContext)).toBeUndefined();

        // Simulate selection click
        selectedProfileTweetIds.set(tid1, 'PT123');
        expect(runProfileSelectionLogic(tid1, pageContext)).toBe('PT123');
    });

    it('should toggle selection off when clicking the same tweet', () => {
        const pageContext = { scene: 'profile' };
        
        // Select PT123
        selectedProfileTweetIds.set(tid1, 'PT123');
        expect(runProfileSelectionLogic(tid1, pageContext)).toBe('PT123');

        // Simulate clicking again (toggle off)
        const currentSelected = selectedProfileTweetIds.get(tid1);
        if (currentSelected === 'PT123') {
            selectedProfileTweetIds.set(tid1, null);
        }
        
        expect(runProfileSelectionLogic(tid1, pageContext)).toBe(null);
    });

    it('should switch selection when clicking a different tweet', () => {
        const pageContext = { scene: 'profile' };
        
        // Select PT123
        selectedProfileTweetIds.set(tid1, 'PT123');
        
        // Select PT456
        selectedProfileTweetIds.set(tid1, 'PT456');
        
        expect(runProfileSelectionLogic(tid1, pageContext)).toBe('PT456');
    });

    it('should clear selection when leaving profile scene', () => {
        // Initial state: in profile scene, PT123 selected
        selectedProfileTweetIds.set(tid1, 'PT123');
        
        // Move to tweet_detail scene
        const pageContext = { scene: 'tweet_detail' };
        
        const result = runProfileSelectionLogic(tid1, pageContext);
        expect(result).toBe(null);
    });

    it('should maintain isolated selection per tab', () => {
        const pageContext = { scene: 'profile' };
        
        // Select PT123 on tid1
        selectedProfileTweetIds.set(tid1, 'PT123');
        
        // Select PT456 on tid2
        selectedProfileTweetIds.set(tid2, 'PT456');
        
        expect(runProfileSelectionLogic(tid1, pageContext)).toBe('PT123');
        expect(runProfileSelectionLogic(tid2, pageContext)).toBe('PT456');
    });
});
