/**
 * NetworkObserver (Layer 2)
 * Enhanced with full diagnostic tracking for GraphQL interceptions.
 */
export class NetworkObserver {
    private latestAccount: any | null = null;
    private diagnostics = {
        totalSignalsCount: 0,
        interceptedGraphqlCount: 0,
        lastHitTimestamp: null as number | null,
        lastOperationName: null as string | null,
        observedOperations: [] as string[],
        signalHistory: [] as string[],
        latestTweets: [] as any[],
        latestSearch: [] as any[],
        latestDetail: [] as any[]
    };

    public onSignal(payload: any) {
        this.diagnostics.signalHistory.push(`${Date.now()}: ${payload.type} (${payload.operationName || 'no-op'})`);
        if (this.diagnostics.signalHistory.length > 20) this.diagnostics.signalHistory.shift();

        // 1. 记录所有扫描到的 GraphQL 请求（诊断用途）
        if (payload.type === 'graphql-observation') {
            this.diagnostics.interceptedGraphqlCount++;
            if (!this.diagnostics.observedOperations.includes(payload.operationName)) {
                this.diagnostics.observedOperations.push(payload.operationName);
            }
        }

        // 2. 捕捉内容
        if (payload.type === 'timeline-captured') {
            this.diagnostics.latestTweets = payload.tweets || [];
            this.diagnostics.totalSignalsCount++;
            console.log('NetworkObserver: Captured', this.diagnostics.latestTweets.length, 'home tweets');
        }
        if (payload.type === 'search-captured') {
            this.diagnostics.latestSearch = payload.tweets || [];
            this.diagnostics.totalSignalsCount++;
            console.log('NetworkObserver: Captured', this.diagnostics.latestSearch.length, 'search results');
        }
        if (payload.type === 'detail-captured') {
            this.diagnostics.latestDetail = payload.tweets || [];
            this.diagnostics.totalSignalsCount++;
            console.log('NetworkObserver: Captured', this.diagnostics.latestDetail.length, 'thread details');
        }

        // 3. 只有提取到身份的才作为正式信号
        if (payload.type === 'identity-fragment') {
            if (payload.fragment) {
                this.latestAccount = payload.fragment;
                console.log('NetworkObserver: Resolved full account context:', this.latestAccount.handle);
            } else if (payload.handle) {
                this.latestAccount = { handle: payload.handle };
                console.log('NetworkObserver: Resolved handle', payload.handle);
            }
            
            if (this.latestAccount) {
                this.diagnostics.totalSignalsCount++;
                this.diagnostics.lastHitTimestamp = Date.now();
                this.diagnostics.lastOperationName = payload.operationName || 'unknown';
            }
        }
    }


    public getCapturedAccount(): any | null {
        return this.latestAccount;
    }

    public getDiagnostics() {
        return {
            ...this.diagnostics,
            currentAccount: this.latestAccount,
            isResolved: !!this.latestAccount
        };
    }
}
