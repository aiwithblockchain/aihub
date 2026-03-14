/**
 * debug.ts - TweetClaw Debug Panel (v5.4)
 *
 * 修复：
 *   - D 区 toggle 冒泡问题：expanded content 改为 .api-hit 的兄弟节点
 *   - E 区空白时补充提示 + 推文作者参考信息
 */

import { parseRouteKind } from '../utils/route-parser';
import { validateTweetDetailParams, formatTweetDetailUrl } from '../utils/x-url-utils';

// ─────────────────────────────────────────────
// UI 视觉增强：强制提升标签对比度 (v5.4.1)
// ─────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
    /* 强制提升所有 sys-stat 标签的对比度 */
    .sys-stat span:first-child:not(.val) { 
        color: #cbd5e0 !important; 
        opacity: 0.9 !important;
    }
    /* 提升 text-muted 在暗色背景下的可见度 */
    .text-muted { 
        color: #a0aec0 !important; 
    }
`;
document.head.appendChild(style);

let selectedTabId: number | null = null;
let tabList: any[] = [];
let bridgeOnline = false;
let currentHits: any[] = [];  // D 区当前显示的 hits，供 Modal 引用
const manualOverrides = new Map<number, boolean>();
const selectedReplyIds = new Map<number, string | null>();
const selectedProfileTweetIds = new Map<number, string | null>();
let lastFilledIds = new Map<number, string>();
let replyDraftText = '';
let isReviewConfirmed = false;
let lastReviewNote: any = null;
let lastPageContext: any = null;

// New state maps for inputs to avoid data loss on frequent re-renders
const navUrlDrafts = new Map<number, string>();
const openTweetScreenNameDrafts = new Map<number, string>();
const openTweetIdDrafts = new Map<number, string>();

let lastOpenTweetRequests = new Map<number, { screenName: string, tweetId: string, timestamp: number }>();

const APPROVAL_STATE = {
    DRAFT_EMPTY: 'DRAFT_EMPTY',
    DRAFT_NOT_READY: 'DRAFT_NOT_READY',
    READY_FOR_REVIEW: 'READY_FOR_REVIEW',
    LOCKED_LOGGED_OUT: 'LOCKED_LOGGED_OUT'
};

function getCurrentReplyIntent(tid: number, pageContext: any, currentInputValue: string) {
    const isManual = manualOverrides.get(tid) || false;
    const selectedReplyId = selectedReplyIds.get(tid) || null;
    const isTweetDetail = pageContext.scene === 'tweet_detail';
    const curEntity = pageContext.currentEntity;

    let targetType = 'NONE';
    let targetId = '';
    let authorHandle = '';

    if (isManual) {
        targetType = 'manual target';
        targetId = currentInputValue;
    } else if (isTweetDetail && selectedReplyId) {
        const reply = (pageContext.repliesSnapshot || []).find((r: any) => r.tweetId === selectedReplyId);
        targetType = 'selected reply';
        targetId = selectedReplyId;
        authorHandle = reply?.authorHandle || '';
    } else if (isTweetDetail && curEntity) {
        targetType = 'current tweet';
        targetId = curEntity.entityId;
        authorHandle = curEntity.authorHandle || '';
    }
    
    return { targetType, targetId, authorHandle };
}

// ─────────────────────────────────────────────
// 事件代理
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Modal（D 区 hit 详情弹窗）
// ─────────────────────────────────────────────
function showHitModal(h: any) {
    // 清掉旧 modal（如有）
    document.getElementById('tc-hit-modal')?.remove();

    let apiPath = '—';
    let queryParamsHtml = '';
    let fallbackUrlHtml = '';

    try {
        if (h.apiUrl) {
            const u = new URL(h.apiUrl);
            apiPath = u.pathname;
            
            const params = new URLSearchParams(u.search);
            const parsedParams: Record<string, any> = {};
            let hasParams = false;
            
            for (const [key, value] of params.entries()) {
                hasParams = true;
                try {
                    parsedParams[key] = JSON.parse(value);
                } catch {
                    parsedParams[key] = value;
                }
            }
            
            if (hasParams) {
                const paramsJson = safeJson(parsedParams);
                queryParamsHtml = `
                <div class="tc-modal-section">
                    <div class="tc-modal-label text-warning">QUERY PARAMETERS</div>
                    <pre class="tc-modal-pre">${paramsJson}</pre>
                </div>`;
            }
        }
    } catch { 
        apiPath = h.apiUrl || '—'; 
        fallbackUrlHtml = `
        <div class="tc-modal-section">
            <div class="tc-modal-label">RAW API URL</div>
            <pre class="tc-modal-pre">${h.apiUrl}</pre>
        </div>`;
    }

    const reqJson  = safeJson(h.requestBody);
    const respJson = safeJson(h.responseBody || {});

    const modal = document.createElement('div');
    modal.id = 'tc-hit-modal';
    modal.innerHTML = `
    <div class="tc-modal-backdrop"></div>
    <div class="tc-modal-box">
        <div class="tc-modal-header">
            <span class="method" style="margin-right:10px">${h.method || 'POST'}</span>
            <span class="fw-bold text-white" style="font-size:14px; margin-right:10px">${h.op}</span>
            <span class="text-info" style="font-size:11px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap" title="${apiPath}">${apiPath}</span>
            <span class="text-muted" style="font-size:10px; margin-right:12px">${new Date(h.timestamp).toLocaleTimeString()}</span>
            <button id="tc-modal-close" style="background:none;border:none;color:#a0aec0;font-size:18px;cursor:pointer;line-height:1">✕</button>
        </div>
        <div class="tc-modal-body">
            <div class="tc-modal-section" style="display:flex; gap: 20px;">
                <div style="flex:1; overflow:hidden;">
                    <div class="tc-modal-label">API PATH</div>
                    <div class="text-light" style="font-size:11px; word-break:break-all;">${apiPath}</div>
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div class="tc-modal-label">PAGE URL</div>
                    <div class="text-muted" style="font-size:11px; word-break:break-all;">${h.pageUrl || '—'}</div>
                </div>
            </div>
            ${fallbackUrlHtml}
            ${queryParamsHtml}
            ${h.requestBody ? `
            <div class="tc-modal-section">
                <div class="tc-modal-label text-primary">REQUEST BODY</div>
                <pre class="tc-modal-pre">${reqJson}</pre>
            </div>` : ''}
            <div class="tc-modal-section">
                <div class="tc-modal-label text-success">RESPONSE BODY</div>
                <pre class="tc-modal-pre">${respJson}</pre>
            </div>
        </div>
    </div>`;

    document.body.appendChild(modal);

    const close = () => document.getElementById('tc-hit-modal')?.remove();
    document.getElementById('tc-modal-close')!.onclick = close;
    modal.querySelector('.tc-modal-backdrop')!.addEventListener('click', close);
}

function setupDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // 选择 X tab
        const tabEl = target.closest('.tab-item') as HTMLElement;
        if (tabEl?.dataset.id && !target.closest('button')) {
            selectedTabId = parseInt(tabEl.dataset.id);
            refreshData();
            return;
        }

        // Workspace Control: Focus Tab
        const focusBtn = target.closest('.btn-tab-focus') as HTMLButtonElement;
        if (focusBtn?.dataset.id) {
            const tid = parseInt(focusBtn.dataset.id!);
            sendMsg({ type: 'FOCUS_X_TAB', tabId: tid }).then(() => refreshData());
            return;
        }

        // Workspace Control: Close Tab
        const closeBtn = target.closest('.btn-tab-close') as HTMLButtonElement;
        if (closeBtn?.dataset.id) {
            const tid = parseInt(closeBtn.dataset.id!);
            if (confirm(`Close tab ${tid}?`)) {
                sendMsg({ type: 'CLOSE_X_TAB', tabId: tid }).then(() => {
                    if (selectedTabId === tid) selectedTabId = null;
                    navUrlDrafts.delete(tid);
                    openTweetScreenNameDrafts.delete(tid);
                    openTweetIdDrafts.delete(tid);
                    refreshData();
                });
            }
            return;
        }

        // Workspace Control: Navigate Tab
        const navBtn = target.closest('.btn-tab-navigate') as HTMLButtonElement;
        if (navBtn?.dataset.id) {
            const tid = parseInt(navBtn.dataset.id!);
            const input = document.getElementById('nav-url-input') as HTMLInputElement;
            const url = input?.value?.trim();
            if (url) {
                sendMsg({ type: 'NAVIGATE_X_TAB', tabId: tid, url }).then((resp) => {
                    if (resp?.ok) {
                        navUrlDrafts.delete(tid);
                        refreshData();
                    } else if (resp?.error) {
                        alert(`Navigation failed: ${resp.error}`);
                    }
                });
            }
            return;
        }


        // Workspace Control: Open Tweet (Semantic)
        const openTweetBtn = target.closest('.btn-tab-open-tweet') as HTMLButtonElement;
        if (openTweetBtn?.dataset.id) {
            const tid = parseInt(openTweetBtn.dataset.id!);
            const sNameInput = document.getElementById('open-tweet-screen-name') as HTMLInputElement;
            const tIdInput = document.getElementById('open-tweet-id') as HTMLInputElement;
            const screenName = sNameInput?.value?.trim() || '';
            const tweetId = tIdInput?.value?.trim() || '';
            
            const valid = validateTweetDetailParams(screenName, tweetId);
            if (valid.ok) {
                // Record request for mismatch warning
                lastOpenTweetRequests.set(tid, { screenName, tweetId, timestamp: Date.now() });

                const url = formatTweetDetailUrl(screenName, tweetId);
                sendMsg({ type: 'NAVIGATE_X_TAB', tabId: tid, url }).then((resp) => {
                    if (resp?.ok) {
                        openTweetScreenNameDrafts.delete(tid);
                        openTweetIdDrafts.delete(tid);
                        refreshData();
                    } else if (resp?.error) {
                        alert(`Open Tweet failed: ${resp.error}`);
                    }
                });
            } else {
                alert(`Invalid Parameters: ${valid.error}`);
            }
            return;
        }

        // Workspace Control: Create Tab
        const createBtn = target.closest('#btn-create-tab') as HTMLButtonElement;
        if (createBtn) {
            sendMsg({ type: 'CREATE_X_TAB', url: 'https://x.com/' }).then((resp) => {
                if (resp?.ok) {
                    selectedTabId = resp.tabId;
                    refreshData();
                }
            });
            return;
        }

        // D 区：Details 按钮 → 弹 Modal
        const detailBtn = target.closest('.btn-hit-detail') as HTMLButtonElement;
        if (detailBtn?.dataset.hitIndex !== undefined) {
            const idx = parseInt(detailBtn.dataset.hitIndex!);
            if (!isNaN(idx) && currentHits[idx]) showHitModal(currentHits[idx]);
            return;
        }

        // 统一写操作按钮（F 区手动/快捷合并操作）
        const manualActionBtn = target.closest('.btn-manual-action') as HTMLButtonElement;
        if (manualActionBtn?.dataset.tabid) {
            const { action, tabid } = manualActionBtn.dataset;
            const inputEl = document.getElementById('manual-target-id') as HTMLInputElement;
            const inputVal = inputEl?.value?.trim();
            if (inputVal && action) doAction(parseInt(tabid!), inputVal, action, manualActionBtn);
            else if (!inputVal) alert("Please enter a valid target ID (Tweet ID or User ID) first.");
            return;
        }

        // Track manual changes to target ID
        if (target.id === 'manual-target-id' && selectedTabId !== null) {
            manualOverrides.set(selectedTabId, true);
            isReviewConfirmed = false;
        }

        // Selection of Reply from Snapshot
        const replyRow = target.closest('.tc-reply-row') as HTMLElement;
        if (replyRow?.dataset.id && selectedTabId !== null) {
            const rid = replyRow.dataset.id;
            const currentSelected = selectedReplyIds.get(selectedTabId);
            
            if (currentSelected === rid) {
                // Toggle off
                selectedReplyIds.set(selectedTabId, null);
            } else {
                // Select new
                selectedReplyIds.set(selectedTabId, rid);
                manualOverrides.set(selectedTabId, false); // Clicking a reply clears manual override
                isReviewConfirmed = false;
            }
            refreshData();
            return;
        }

        // Selection of Profile Tweet from Snapshot
        const profileTweetRow = target.closest('.tc-profile-tweet-row') as HTMLElement;
        if (profileTweetRow?.dataset.id && selectedTabId !== null) {
            const tid = profileTweetRow.dataset.id;
            const currentSelected = selectedProfileTweetIds.get(selectedTabId);
            
            if (currentSelected === tid) {
                // Toggle off
                selectedProfileTweetIds.set(selectedTabId, null);
            } else {
                // Select new
                selectedProfileTweetIds.set(selectedTabId, tid);
            }
            refreshData();
            return;
        }

        // Review Only Button
        const reviewBtn = target.closest('#btn-review-only') as HTMLButtonElement;
        if (reviewBtn && selectedTabId !== null && lastPageContext) {
            const inputEl = document.getElementById('manual-target-id') as HTMLInputElement;
            const inputVal = inputEl?.value?.trim();
            
            // Re-derive the target just like renderReplyDraftUI
            const intent = getCurrentReplyIntent(selectedTabId, lastPageContext, inputVal || '');
            
            isReviewConfirmed = true;
            lastReviewNote = {
                targetId: intent.targetId,
                targetType: intent.targetType,
                draftText: replyDraftText,
                timestamp: Date.now(),
                reviewConfirmed: true
            };
            refreshData();
            return;
        }
    });

    // Handle input event specifically for manual override detection
    document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.id === 'manual-target-id' && selectedTabId !== null) {
            manualOverrides.set(selectedTabId, true);
            isReviewConfirmed = false;
        }
        if (target.id === 'reply-draft-text') {
            replyDraftText = target.value;
            isReviewConfirmed = false;
            // A simple trick: update the preview div directly.
            const previewEl = document.getElementById('reply-intent-preview-container');
            if (previewEl) {
                refreshData();
            }
        }
        if (target.id === 'nav-url-input' && selectedTabId !== null) {
            navUrlDrafts.set(selectedTabId, target.value);
        }
        if (target.id === 'open-tweet-screen-name' && selectedTabId !== null) {
            openTweetScreenNameDrafts.set(selectedTabId, target.value);
        }
        if (target.id === 'open-tweet-id' && selectedTabId !== null) {
            openTweetIdDrafts.set(selectedTabId, target.value);
        }
    });
}

// ─────────────────────────────────────────────
// Background 推送监听
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'DEBUG_UPDATE_PUSH') return;
    if (selectedTabId === null || selectedTabId === message.tabId) {
        refreshData();
    } else {
        refreshTabListOnly();
    }
});

// ─────────────────────────────────────────────
// Bridge Ping
// ─────────────────────────────────────────────
async function checkBridge(): Promise<void> {
    if (selectedTabId === null) { bridgeOnline = false; return; }
    try {
        const resp: any = await new Promise(r => {
            chrome.tabs.sendMessage(selectedTabId!, { type: 'TC_PING' }, res => {
                if (chrome.runtime.lastError) r({ ok: false });
                else r(res || { ok: false });
            });
        });
        bridgeOnline = !!(resp?.ok);
    } catch {
        bridgeOnline = false;
    }
}

// ─────────────────────────────────────────────
// 数据拉取
// ─────────────────────────────────────────────
async function refreshTabListOnly() {
    tabList = await sendMsg({ type: 'LIST_ALL_X_TABS' }) || [];
    renderTabList();
    renderSidebarEnv();
}

async function refreshData() {
    try {
        tabList = await sendMsg({ type: 'LIST_ALL_X_TABS' }) || [];
        
        // 验证当前选中的 tab 还是否存在
        if (selectedTabId !== null) {
            const exists = tabList.some(t => t.id === selectedTabId);
            if (!exists) selectedTabId = null;
        }

        // 如果没有选中且有可用 tab，默认选第一个
        if (selectedTabId === null && tabList.length > 0) {
            selectedTabId = tabList[0].id;
        }

        renderTabList();

        if (selectedTabId !== null) {
            const detail: any = await sendMsg({ type: 'GET_TAB_DATA', tabId: selectedTabId });
            const pageContext: any = await sendMsg({ type: 'GET_PAGE_CONTEXT', tabId: selectedTabId });
            await checkBridge();

            // --- Focus Preservation Start ---
            const activeId = document.activeElement?.id;
            const selectionStart = (document.activeElement as HTMLInputElement | HTMLTextAreaElement)?.selectionStart;
            const selectionEnd = (document.activeElement as HTMLInputElement | HTMLTextAreaElement)?.selectionEnd;
            // --------------------------------

            lastPageContext = pageContext;
            renderDetailView(detail || {}, pageContext || {});

            // --- Focus Preservation End ---
            if (activeId) {
                const el = document.getElementById(activeId) as HTMLInputElement | HTMLTextAreaElement;
                if (el) {
                    el.focus();
                    if (selectionStart !== undefined && selectionStart !== null) {
                        el.setSelectionRange(selectionStart, selectionEnd || selectionStart);
                    }
                }
            }
            // ------------------------------
        } else {
            renderEmptyState();
        }

        renderSidebarEnv();
    } catch (e) {
        console.error('[TweetClaw-Debug] refreshData error:', e);
    }
}

function sendMsg(msg: any): Promise<any> {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(msg, res => {
            if (chrome.runtime.lastError) {
                console.warn('[TweetClaw-Debug] sendMessage error:', chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(res);
            }
        });
    });
}

// ─────────────────────────────────────────────
// 侧边栏：Tab 列表
// ─────────────────────────────────────────────
function renderTabList() {
    const container = document.getElementById('tab-list');
    if (!container) return;

    // Add Create Tab button at the top
    let html = `
    <div class="mb-3 px-1">
        <button id="btn-create-tab" class="btn btn-primary btn-sm w-100" style="font-size:11px;">+ Open x.com</button>
    </div>`;

    if (tabList.length === 0) {
        html += `<div class="text-muted small p-2">No X tabs open.</div>`;
        container.innerHTML = html;
        return;
    }

    html += tabList.map(t => {
        const isSelected = t.id === selectedTabId;
        // 优先用账号 handle，否则从 URL 提取有意义的路径标识
        const identity = t.account?.handle || urlLabel(t.url);
        const rKind = parseRouteKind(t.url);
        
        return `
        <div class="tab-item ${isSelected ? 'active' : ''}" data-id="${t.id}">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold small ${isSelected ? 'text-white' : 'text-info'}">${identity}</span>
                <span class="status-badge ${t.active ? 'bg-success-subtle' : 'bg-secondary'}">${t.active ? 'ACTIVE' : 'IDLE'}</span>
            </div>
            <div class="text-truncate" style="opacity:.6;font-size:10px;">TAB ${t.id} · ${rKind.toUpperCase()}</div>
            <div class="d-flex gap-1 mt-2">
                <button class="btn btn-outline-info btn-xs btn-tab-focus" data-id="${t.id}" style="font-size:9px; padding:1px 6px;">Focus</button>
                <button class="btn btn-outline-danger btn-xs btn-tab-close" data-id="${t.id}" style="font-size:9px; padding:1px 6px;">Close</button>
            </div>
        </div>`;
    }).join('');
    container.innerHTML = html;
}

// ─────────────────────────────────────────────
// 侧边栏：执行环境
// ─────────────────────────────────────────────
function renderSidebarEnv() {
    const el = document.getElementById('sidebar-env');
    if (!el) return;
    let html = `
        <div class="sys-stat"><span>Write Policy</span><span class="val text-success">Content Script ✓</span></div>
        <div class="sys-stat"><span>Exec Bridge</span>
            <span class="val ${bridgeOnline ? 'text-success' : 'text-danger'}">${bridgeOnline ? 'ONLINE ✓' : 'OFFLINE ✗'}</span>
        </div>
        <div class="sys-stat"><span>Inject Role</span><span class="val text-warning">Passive Sensor</span></div>
        <div class="sys-stat"><span>Inject Writes</span><span class="val text-success">None ✓</span></div>`;

    if (lastReviewNote) {
        const timeStr = new Date(lastReviewNote.timestamp).toLocaleTimeString();
        html += `
            <div class="mt-3 pt-2 border-top border-secondary" style="font-size:9px; line-height:1.2">
                <div style="color:#a0aec0; text-transform:uppercase; font-weight:700; margin-bottom:2px">Last Review Note</div>
                <div class="text-info">${lastReviewNote.targetType.toUpperCase()} (${lastReviewNote.targetId})</div>
                <div class="text-truncate" style="opacity:0.8">Text: ${lastReviewNote.draftText || '—'}</div>
                <div class="text-muted" style="font-size:8px">at ${timeStr}</div>
            </div>`;
    }
    el.innerHTML = html;
}

// ─────────────────────────────────────────────
// 空状态
// ─────────────────────────────────────────────
function renderEmptyState() {
    const c = document.getElementById('tab-data-view');
    if (c) c.innerHTML = `
        <div class="text-center mt-5 text-muted">
            <h4>No X tab selected</h4>
            <p class="small">Open x.com and select a tab on the left</p>
        </div>`;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 从 X/Twitter tab URL 提取简短可读标识。
 * 例：https://x.com/home          → "x.com/home"
 *     https://x.com/coder/status → "x.com/coder"
 *     https://twitter.com/…      → "twitter.com/…"
 */
function urlLabel(url: string | undefined): string {
    if (!url) return 'X Tab';
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean); // ['home'] or ['user','status','id']
        const slug = parts.length > 0 ? `/${parts[0]}` : '';
        return u.hostname.replace('www.', '') + slug;
    } catch {
        return 'X Tab';
    }
}

function fmtTime(ts: number | null | undefined): string {
    if (!ts) return '—';
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return new Date(ts).toLocaleTimeString();
}

function badge(ok: boolean, t = 'ACTIVE', f = 'OFFLINE'): string {
    return ok
        ? `<span class="badge bg-success">${t}</span>`
        : `<span class="badge bg-danger">${f}</span>`;
}

function truncate(s: string, n = 120): string {
    if (!s) return '—';
    return s.length > n ? s.slice(0, n) + '…' : s;
}

function nFmt(num: number | string | null | undefined): string {
    if (num === null || num === undefined) return '—';
    if (typeof num === 'string') return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

function safeJson(obj: any, indent = 2): string {
    try { return JSON.stringify(obj, null, indent); } catch { return String(obj); }
}

function reqSummary(obj: any): string {
    if (!obj) return '—';
    if (typeof obj === 'string') return truncate(obj, 80);
    const keys = Object.keys(obj).slice(0, 4).join(', ');
    return `{${keys}${Object.keys(obj).length > 4 ? '…' : ''}}`;
}

// ─────────────────────────────────────────────
// Scene Card 渲染
// ─────────────────────────────────────────────
function renderSceneCard(context: any): string {
    if (!context) return '';
    const sceneName = (context.scene || 'UNKNOWN').toUpperCase().replace(/_/g, ' ');
    const routeName = (context.routeKind || 'NONE').toUpperCase();
    
    // 如果不是 X 页面，简化显示
    if (context.scene === 'not_x') {
        return `
            <div class="card mb-3 border-secondary">
                <div class="card-body py-2 text-center text-muted small">
                    Current tab is not on X workspace.
                </div>
            </div>`;
    }

    return `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span class="text-info fw-bold">SCENE: ${sceneName}</span>
                <span class="badge bg-dark text-info border border-info" style="font-size:10px">ROUTE: ${routeName}</span>
            </div>
            <div class="card-body py-1">
                <div class="sys-stat"><span>URL</span><span class="val text-truncate" style="max-width:260px; font-size:10px; opacity:0.7">${context.currentUrl || '—'}</span></div>
                <div class="mt-2" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700; letter-spacing:0.5px">Capabilities</div>
                <div class="d-flex flex-wrap gap-1 mt-1 mb-2">
                    ${(context.availableActions || []).map((a: string) => `<span class="badge bg-info text-dark" style="font-size:9px; opacity:0.9; font-weight:600">${a}</span>`).join('')}
                    ${(context.availableActions || []).length === 0 ? '<span class="text-muted small">None</span>' : ''}
                </div>
            </div>
        </div>`;
}

function renderMismatchWarning(tid: number, pageContext: any): string {
    const lastRequest = lastOpenTweetRequests.get(tid);
    if (!lastRequest) return '';

    // If we've navigated away from tweet_detail, clear the request
    if (pageContext.scene !== 'tweet_detail') {
        lastOpenTweetRequests.delete(tid);
        return '';
    }

    const currentEntity = pageContext.currentEntity;
    const currentHandle = currentEntity?.authorHandle;
    const currentId = currentEntity?.entityId;

    // If we have an entity ID and it doesn't match the requested one, 
    // it means the user has navigated away from the requested tweet.
    if (currentId && currentId !== lastRequest.tweetId) {
        lastOpenTweetRequests.delete(tid);
        return '';
    }

    if (!currentHandle) return '';

    const cleanRequested = lastRequest.screenName.replace('@', '').toLowerCase();
    const cleanActual = currentHandle.replace('@', '').toLowerCase();

    if (cleanRequested !== cleanActual) {
        return `
            <div class="alert alert-warning py-2 px-3 mb-3 border-warning" style="font-size: 11px; background: rgba(255, 193, 7, 0.1);">
                <div class="fw-bold mb-1">⚠ AUTHOR MISMATCH WARNING</div>
                <div class="d-flex flex-column gap-1">
                    <div>Requested: <span class="text-info">@${lastRequest.screenName.replace('@', '')}</span></div>
                    <div>Resolved: <span class="text-warning">@${currentHandle.replace('@', '')}</span></div>
                    <div class="mt-1 opacity-75">Navigated successfully, but author does not match requested screenName.</div>
                </div>
            </div>`;
    }

    return '';
}

// ─────────────────────────────────────────────
// Entity Card 渲染 (NEW)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Entity Card 渲染 (NEW)
// ─────────────────────────────────────────────
function renderEntityCard(entity: any, scene: string): string {
    if (scene !== 'tweet_detail' && scene !== 'profile') {
        return `
            <div class="card mb-3 opacity-75">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span class="text-muted fw-bold">CURRENT ENTITY</span>
                    <span class="text-muted" style="font-size:10px">N/A FOR THIS SCENE</span>
                </div>
                <div class="card-body py-3 text-center text-muted italic" style="font-size:11px">
                    Entity selection is active only in <strong>Tweet Detail</strong> or <strong>Profile</strong> views.
                </div>
            </div>`;
    }

    if (!entity) {
        return `
            <div class="card mb-3 border-warning">
                <div class="card-header text-warning fw-bold">CURRENT ENTITY: PENDING</div>
                <div class="card-body py-3 text-center text-muted italic" style="font-size:11px">
                    Identifying entity details... Scroll or interact with the page.
                </div>
            </div>`;
    }

    if (entity.entityType !== 'tweet') return '';

    const isUrlOnly = entity.source === 'url_only';
    const sourceLabel = isUrlOnly ? '<span class="text-warning" style="font-size:10px">ENTITY PARTIALLY RESOLVED FROM URL ONLY</span>' : '<span class="text-success" style="font-size:10px">ENTITY RESOLVED (MERGED)</span>';

    return `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span class="text-primary fw-bold">CURRENT ENTITY: TWEET</span>
                ${sourceLabel}
            </div>
            <div class="card-body py-2">
                <div class="row">
                    <div class="col-8 border-right">
                        <div class="sys-stat"><span>Tweet ID</span><span class="val text-warning">${entity.entityId}</span></div>
                        <div class="sys-stat"><span>Author</span><span class="val text-info">${entity.authorHandle || '—'} ${entity.authorName ? `<small class="text-muted">(${entity.authorName})</small>` : ''}</span></div>
                        <div class="sys-stat"><span>Author ID</span><span class="val" style="font-size:10px; opacity:0.7">${entity.authorId || '—'}</span></div>
                        <div class="sys-stat"><span>Created At</span><span class="val" style="font-size:10px">${entity.createdAt || '—'}</span></div>
                        <div class="sys-stat"><span>Ownership</span><span class="val ${entity.isOwnedByActiveAccount ? 'text-success' : 'text-muted'}">${entity.isOwnedByActiveAccount ? 'OWNED BY ACTIVE ACCOUNT' : 'OTHERS'}</span></div>
                        <div class="mt-2" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Content Snapshot</div>
                        <div class="p-2 mt-1 bg-dark rounded text-light" style="font-size:11px; max-height: 80px; overflow-y: auto;">
                            ${entity.text || '<span class="text-muted italic">No content captured.</span>'}
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="mt-1" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Metrics</div>
                        <div class="sys-stat mt-2"><span>Like</span><span class="val">${entity.likeCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Reply</span><span class="val">${entity.replyCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Repost</span><span class="val">${entity.retweetCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Bookmark</span><span class="val">${entity.bookmarkCount ?? '—'}</span></div>
                    </div>
                </div>
                ${isUrlOnly ? `
                <div class="mt-2 text-center">
                    <div class="alert alert-warning py-1 px-2 m-0" style="font-size:10px">
                        Partial data. Open this tweet on X to capture full details.
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// Replies Snapshot 渲染 (NEW)
// ─────────────────────────────────────────────
function renderRepliesSnapshot(replies: any[], scene: string): string {
    if (scene !== 'tweet_detail') return '';

    // 空状态：使用与上方 Section 一致的标识颜色
    if (!replies || replies.length === 0) {
        return `
            <div class="card mb-3 border-secondary">
                <div class="card-header text-info fw-bold">REPLIES SNAPSHOT</div>
                <div class="card-body py-3 text-center text-secondary italic" style="font-size:11px; opacity: 0.6">
                    No active replies captured yet.
                </div>
            </div>`;
    }

    const count = replies.length;
    const displayList = replies.slice(0, 5);
    const selectedId = selectedTabId !== null ? selectedReplyIds.get(selectedTabId) : null;

    // 有数据状态：使用鲜艳的绿色强调捕获成功
    return `
        <div class="card mb-3 border-success" style="border-width: 1px">
            <div class="card-header d-flex justify-content-between align-items-center" style="background: rgba(25, 135, 84, 0.05)">
                <span class="text-success fw-bold">REPLIES SNAPSHOT</span>
                <span class="badge bg-dark text-success border border-success" style="font-size:10px; box-shadow: 0 0 5px rgba(25,135,84,0.3)">${count} CAPTURED</span>
            </div>
            <div class="card-body p-0">
                <table class="table table-dark table-hover mb-0" style="font-size:11px">
                    <tbody>
                        ${displayList.map(r => {
                            const isSelected = r.tweetId === selectedId;
                            return `
                            <tr class="tc-reply-row ${isSelected ? 'table-primary shadow-sm' : ''}" 
                                data-id="${r.tweetId}" 
                                style="cursor: pointer; transition: all 0.2s; ${isSelected ? 'background: rgba(13, 110, 253, 0.2) !important; border-left: 3px solid #0d6efd;' : ''}">
                                <td class="ps-3 py-2" style="width: 25%">
                                    <div class="fw-bold text-info text-truncate">${r.authorHandle}</div>
                                    <div style="font-size:9px; color: #8899A6">${fmtTime(new Date(r.createdAt).getTime())}</div>
                                    ${r.isByActiveAccount ? '<span class="badge bg-success text-white ms-1" style="font-size:8px; padding: 1px 4px; border-radius: 4px; vertical-align: middle">YOU</span>' : ''}
                                </td>
                                <td class="py-2">
                                    <div class="text-light-emphasis fw-medium" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3">
                                        ${truncate(r.text, 100)}
                                    </div>
                                    <div class="mt-1 d-flex gap-2" style="font-size:9px; opacity:0.85">
                                        <span class="text-secondary">Like: ${r.likeCount ?? 0}</span>
                                        <span class="text-secondary">RT: ${r.repostCount ?? 0}</span>
                                        <span class="text-secondary">Reply: ${r.replyCount ?? 0}</span>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                ${count > 5 ? `<div class="text-center py-1 text-secondary small border-top bg-dark" style="font-size:9px; opacity: 0.6">Only showing first 5 replies.</div>` : ''}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// Profile Tweets Snapshot 渲染 (NEW)
// ─────────────────────────────────────────────
function renderProfileTweetsSnapshot(tweets: any[], scene: string, selectedId: string | null): string {
    if (scene !== 'profile') return '';

    if (!tweets || tweets.length === 0) {
        return `
            <div class="card mb-3 border-secondary">
                <div class="card-header text-info fw-bold">PROFILE TWEETS SNAPSHOT</div>
                <div class="card-body py-3 text-center text-secondary italic" style="font-size:11px; opacity: 0.6">
                    No profile tweets captured yet. <br>
                    <small>Scroll the profile page to trigger extraction.</small>
                </div>
            </div>`;
    }

    const count = tweets.length;
    const displayList = tweets.slice(0, 5);

    return `
        <div class="card mb-3 border-success" style="border-width: 1px">
            <div class="card-header d-flex justify-content-between align-items-center" style="background: rgba(25, 135, 84, 0.05)">
                <span class="text-success fw-bold">PROFILE TWEETS SNAPSHOT</span>
                <span class="badge bg-dark text-success border border-success" style="font-size:10px">${count} CAPTURED</span>
            </div>
            <div class="card-body p-0">
                <table class="table table-dark table-hover mb-0" style="font-size:11px">
                    <tbody>
                        ${displayList.map(t => {
                            const isSelected = t.tweetId === selectedId;
                            return `
                            <tr class="tc-profile-tweet-row ${isSelected ? 'table-primary shadow-sm' : ''}" 
                                data-id="${t.tweetId}" 
                                style="cursor: pointer; transition: all 0.2s; ${isSelected ? 'background: rgba(13, 110, 253, 0.2) !important; border-left: 3px solid #0d6efd;' : ''}">
                                <td class="ps-3 py-2" style="width: 25%">
                                    <div class="fw-bold text-info text-truncate">${t.authorHandle}</div>
                                    <div style="font-size:9px; color: #8899A6">${t.createdAt ? fmtTime(new Date(t.createdAt).getTime()) : '—'}</div>
                                    ${t.isOwnedByActiveAccount ? '<span class="badge bg-warning text-dark ms-1" style="font-size:8px; padding: 1px 4px; border-radius: 4px; vertical-align: middle">OWNED</span>' : ''}
                                </td>
                                <td class="py-2">
                                    <div class="text-light-emphasis" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3">
                                        ${truncate(t.text, 100)}
                                    </div>
                                    <div class="mt-1 d-flex gap-2" style="font-size:9px; opacity:0.85">
                                        <span class="text-secondary">Likes: ${nFmt(t.likeCount)}</span>
                                        <span class="text-secondary">RTs: ${nFmt(t.repostCount)}</span>
                                        <span class="text-secondary">Replies: ${nFmt(t.replyCount)}</span>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                <div class="card-footer py-1 d-flex justify-content-between align-items-center bg-dark" style="font-size:9px; opacity: 0.8">
                    <span class="text-secondary">${count > 5 ? 'Only showing first 5 tweets.' : ''}</span>
                    ${selectedId ? `<span class="text-info fw-bold">Selected: ${selectedId}</span>` : '<span class="text-muted">No tweet selected</span>'}
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// Selected Reply Detail 渲染 (NEW)
// ─────────────────────────────────────────────
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
                        <div class="mt-2" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Content Snapshot</div>
                        <div class="p-2 mt-1 bg-dark rounded text-light" style="font-size:11px; max-height: 80px; overflow-y: auto;">
                            ${selectedReply.text || '<span class="text-muted italic">No content captured.</span>'}
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="mt-1" style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Metrics</div>
                        <div class="sys-stat mt-2"><span>Like</span><span class="val">${selectedReply.likeCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Reply</span><span class="val">${selectedReply.replyCount ?? '—'}</span></div>
                        <div class="sys-stat"><span>Repost</span><span class="val">${selectedReply.repostCount ?? '—'}</span></div>
                    </div>
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────
// Selected Profile Tweet Detail 渲染 (NEW)
// ─────────────────────────────────────────────
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

/**
 * Candidate Intent / Execution Candidate Card for Selected Profile Tweet
 * (Read-only, informs the operator this tweet is a candidate for future actions)
 */
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



// ─────────────────────────────────────────────
// Execution Intent 渲染 (NEW)
// ─────────────────────────────────────────────
function renderExecutionIntent(tid: number, pageContext: any, currentInputValue: string): string {
    const { targetType, targetId, authorHandle } = getCurrentReplyIntent(tid, pageContext, currentInputValue);
    
    let sourceLabel = 'NONE';
    let badgeClass = 'bg-secondary';
    let borderColor = '#cbd5e0';

    if (targetType === 'manual target') {
        sourceLabel = 'MANUAL OVERRIDE';
        badgeClass = 'bg-warning text-dark';
        borderColor = '#ffc107';
    } else if (targetType === 'selected reply') {
        sourceLabel = 'AUTO: SELECTED REPLY';
        badgeClass = 'bg-primary';
        borderColor = '#0d6efd';
    } else if (targetType === 'current tweet') {
        sourceLabel = 'AUTO: CURRENT ENTITY';
        badgeClass = 'bg-success';
        borderColor = '#198754';
    }

    if (targetType === 'NONE') {
        return `
            <div class="mb-2 p-2 border-start border-3" style="background: rgba(45,55,72,0.2); border-color: #4a5568; border-radius: 0 4px 4px 0">
                <div class="d-flex justify-content-between align-items-center">
                    <div style="font-size: 11px;">
                        <span class="text-muted fw-bold">INTENT:</span>
                        <span class="ms-1 text-muted italic">NO TARGET</span>
                    </div>
                    <span class="badge bg-dark text-muted border border-secondary" style="font-size:8px">NONE</span>
                </div>
            </div>`;
    }

    return `
        <div class="mb-2 p-2 border-start border-3" style="background: rgba(45,55,72,0.2); border-color: ${borderColor}; border-radius: 0 4px 4px 0">
            <div class="d-flex justify-content-between align-items-center">
                <div style="font-size: 11px;">
                    <span class="text-muted fw-bold">INTENT:</span>
                    <span class="ms-1 fw-bold text-white">${targetType.toUpperCase()}</span>
                    ${authorHandle ? `<span class="ms-1 text-info" style="font-size: 10px">@${authorHandle.replace('@', '')}</span>` : ''}
                </div>
                <span class="badge ${badgeClass}" style="font-size:8px; font-weight: normal">${sourceLabel}</span>
            </div>
            <div class="mt-1 font-monospace text-warning" style="font-size: 10px; opacity: 0.9">${targetId || 'EMPTY'}</div>
        </div>`;
}

// ─────────────────────────────────────────────
// Reply Draft UI 渲染 (NEW)
// ─────────────────────────────────────────────
function renderReplyDraftUI(tid: number, pageContext: any, currentInputValue: string, isLoggedOut: boolean): string {
    const { targetType, targetId, authorHandle } = getCurrentReplyIntent(tid, pageContext, currentInputValue);

    if (targetType === 'NONE') return '';

    const hasTarget = !!targetId;
    const hasText = !!replyDraftText.trim();
    
    let currentState = APPROVAL_STATE.DRAFT_EMPTY;
    if (isLoggedOut) {
        currentState = APPROVAL_STATE.LOCKED_LOGGED_OUT;
    } else if (!hasText) {
        currentState = APPROVAL_STATE.DRAFT_EMPTY;
    } else if (!hasTarget) {
        currentState = APPROVAL_STATE.DRAFT_NOT_READY;
    } else {
        currentState = APPROVAL_STATE.READY_FOR_REVIEW;
    }

    let statusHtml = '';
    let statusLabel = '';
    let statusColor = 'text-muted';
    let showReviewBtn = false;
    let reviewConfirmedHtml = '';

    switch (currentState) {
        case APPROVAL_STATE.LOCKED_LOGGED_OUT:
            statusLabel = 'LOCKED (LOGGED OUT)';
            statusColor = 'text-danger';
            statusHtml = '<span class="text-danger" style="font-size:10px">Please log in to X to continue.</span>';
            break;
        case APPROVAL_STATE.DRAFT_EMPTY:
            statusLabel = 'DRAFT EMPTY';
            statusHtml = '<span class="text-muted" style="font-size:10px">Waiting for draft content...</span>';
            break;
        case APPROVAL_STATE.DRAFT_NOT_READY:
            statusLabel = 'DRAFT NOT READY';
            statusColor = 'text-warning';
            statusHtml = '<span class="text-warning" style="font-size:10px">Has draft but no valid target detected.</span>';
            break;
        case APPROVAL_STATE.READY_FOR_REVIEW:
            statusLabel = 'READY FOR HUMAN REVIEW';
            statusColor = 'text-info';
            statusHtml = '<span class="text-info" style="font-size:10px">Content and target are ready for review.</span>';
            showReviewBtn = true;
            if (isReviewConfirmed) {
                reviewConfirmedHtml = `
                <div class="mt-2 text-center p-2 rounded" style="background: rgba(25, 135, 84, 0.2); border: 1px solid rgba(25, 135, 84, 0.4)">
                    <span class="text-success fw-bold" style="font-size:11px">READY: REVIEW CONFIRMED (STILL NOT SENT)</span>
                </div>`;
            }
            break;
    }

    return `
        <div id="reply-intent-preview-container">
            <div class="mt-4">
                <div style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700; margin-bottom:6px">Reply Draft</div>
                <textarea id="reply-draft-text" class="form-control form-control-sm bg-black text-light border-secondary" rows="2" placeholder="Write your reply draft here..." style="font-size:11px;">${replyDraftText}</textarea>
            </div>
            
            <div class="mt-3 p-2" style="background: rgba(0,0,0,0.2); border: 1px solid #2d3748; border-radius: 6px;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div style="font-size:10px; color:#cbd5e0; text-transform:uppercase; font-weight:700">Reply Intent Preview</div>
                    <span class="badge bg-dark border ${statusColor.replace('text-', 'border-')}" style="font-size:8px; ${statusColor.replace('text-', 'color:')}">${statusLabel}</span>
                </div>
                <div class="sys-stat"><span>Target</span><span class="val text-info" style="font-size:10px">${targetType.toUpperCase()} ${authorHandle ? `(@${authorHandle.replace('@','')})` : ''}</span></div>
                <div class="sys-stat"><span>ID</span><span class="val text-warning" style="font-size:10px">${targetId || '—'}</span></div>
                <div class="sys-stat"><span>Draft</span><span class="val text-truncate" style="max-width: 150px; font-size:10px">${replyDraftText || '—'}</span></div>
                <div class="mt-1 text-center">
                    ${statusHtml}
                </div>
                ${reviewConfirmedHtml}
                ${showReviewBtn && !isReviewConfirmed ? `
                <div class="mt-2 pt-2 border-top border-secondary">
                    <button id="btn-review-only" class="btn btn-info btn-sm w-100 py-1" style="font-size:11px; font-weight:bold">Review Only (Local Confirmation)</button>
                </div>` : ''}
            </div>
        </div>
    `;
}

// ─────────────────────────────────────────────
// E 区：Session / Identity 渲染
// 有 account → 展示正式身份
// 无 account 但有 featuredTweet → 展示"已观察到的推文作者"作为参考
// 都没有 → 提示用户操作
// ─────────────────────────────────────────────
function renderIdentityPanel(account: any, featuredTweet: any, dataId: any, scene: string): string {
    if (account) {
        return `
            <div class="sys-stat"><span>Handle</span><span class="val text-info">${account.handle}</span></div>
            <div class="sys-stat"><span>User ID</span><span class="val" style="font-size:11px">${account.userId}</span></div>
            <div class="sys-stat"><span>Display Name</span><span class="val">${account.displayName || '—'}</span></div>
            <div class="sys-stat"><span>Verified</span>${badge(!!account.verified, 'YES', 'NO')}</div>`;
    }

    if (scene === 'identity_resolving') {
        return `
            <div class="text-info small mb-2 d-flex align-items-center" style="font-size:11px">
                <div class="spinner-border spinner-border-sm me-2" role="status" style="width:10px; height:10px"></div>
                Resolving identity...<br>
            </div>
            <div class="text-muted" style="font-size:10px">
                Waiting for <code>Viewer</code> capture. <br>
                <span class="text-warning">Scroll the page or try refreshing if stuck.</span>
            </div>`;
    }

    // 保底显示：如果我们有 UID（来自 Cookie），即使没拿到 Handle 也展示它
    const uidHtml = account?.userId ? `<div class="sys-stat"><span>Verified UID</span><span class="val text-success">${account.userId}</span></div>` : '';

    // 没有身份 → 先给提示，再展示推文作者参考
    const hint = `
        <div class="text-warning small mb-2" style="font-size:11px">
            ⚠ Identity not fully captured.<br>
            <span class="text-muted">Need <code>Viewer</code> or <code>settings.json</code> intercept.</span>
        </div>
        ${uidHtml}
        <div class="mt-2 text-center"><button class="btn btn-dark btn-sm" style="font-size:9px" onclick="location.reload()">REFRESH DEBUG PANEL</button></div>`;

    if (!featuredTweet) return hint;

    // 有推文但无身份：展示"已观察到的推文作者"
    return hint + `
        <hr class="border-secondary my-2">
        <div style="font-size:10px;color:#8899A6;margin-bottom:6px">OBSERVED TWEET AUTHOR (reference)</div>
        <div class="sys-stat"><span>Author Handle</span><span class="val text-secondary">${featuredTweet.authorHandle || '—'}</span></div>
        <div class="sys-stat"><span>Author Name</span><span class="val text-secondary">${featuredTweet.authorName || '—'}</span></div>
        <div class="sys-stat"><span>Author ID</span><span class="val text-secondary" style="font-size:10px">${featuredTweet.authorId || '—'}</span></div>`;
}

// ─────────────────────────────────────────────
// 主渲染：A/B/C/D/E/F 六区
// ─────────────────────────────────────────────
function renderDetailView(data: any, pageContext: any) {
    const container = document.getElementById('tab-data-view');
    if (!container) return;

    const hits      = (data.apiHits || []) as any[];
    const hookSt    = data.hookStatus || { fetch: false, xhr: false };
    const stats     = data.stats || {};
    const allOps    = (data.allWatchedOps || []) as string[];
    const account   = data.account || null;
    const mainTweet = data.featuredTweet || null;
    const lastHit   = hits.length > 0 ? hits[0].timestamp : null;
    const tabMeta   = tabList.find(t => t.id === selectedTabId) || {};
    const isXPage   = /^https?:\/\/(twitter\.com|x\.com)/.test(tabMeta.url || '');

    // 保存 hits 供 Modal 引用
    currentHits = hits;

    // ── D 区：卡片渲染（无嵌套滚动，Details 按钮弹 Modal）
    function renderHitCard(h: any, i: number): string {
        let apiPath = '—';
        try { apiPath = h.apiUrl ? new URL(h.apiUrl).pathname.split('/').slice(-2).join('/') : '—'; } catch { apiPath = h.op; }
        const paramSummary = reqSummary(h.requestBody);
        const isId = ['AuthenticatedUserQuery','Viewer','AccountSettings','settings.json','VerifyCredentials'].includes(h.op);
        return `
        <div class="hit-card ${isId ? 'hit-card-id' : ''}">
            <div class="hit-card-top">
                <span class="method">${h.method || 'GET'}</span>
                <span class="hit-card-op" title="${h.op}">${h.op}</span>
                ${isId ? '<span class="badge bg-warning text-dark" style="font-size:9px">IDENTITY</span>' : ''}
                <span class="hit-time ms-auto">${new Date(h.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="hit-card-path" title="${h.apiUrl || ''}">${apiPath}</div>
            <div class="hit-card-params">${paramSummary !== '—' ? paramSummary : '<span class="text-muted">no params</span>'}</div>
            <div class="hit-card-footer">
                <span class="text-success" style="font-size:10px">● 200</span>
                <button class="btn-hit-detail" data-hit-index="${i}">Details ›</button>
            </div>
        </div>`;
    }

    const isLoggedOut = pageContext?.scene === 'login_required';
    const hasTarget = !!mainTweet?.id;
    const canWrite = !isLoggedOut && (pageContext?.scene !== 'identity_resolving');

    // ── Target ID Binding Logic ──
    const tid = selectedTabId!;
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

    // Selection of Profile Tweet clearing
    if (pageContext.scene !== 'profile' && selectedProfileTweetIds.get(tid)) {
        selectedProfileTweetIds.set(tid, null);
    }

    // Determine value to show in input
    const existingInput = document.getElementById('manual-target-id') as HTMLInputElement;
    let displayTargetId = '';
    let sourceLabelHtml = '';

    if (isManual) {
        displayTargetId = existingInput ? existingInput.value : '';
        sourceLabelHtml = `<span class="badge bg-warning-subtle text-warning border border-warning ms-2" style="font-size:9px; font-weight:normal">MANUAL OVERRIDE</span>`;
    } else if (isTweetDetail && selectedReplyId) {
        displayTargetId = selectedReplyId;
        sourceLabelHtml = `<span class="badge bg-primary text-white border border-primary ms-2" style="font-size:9px; font-weight:normal">AUTO: SELECTED REPLY</span>`;
    } else if (isTweetDetail && lastFilled) {
        displayTargetId = lastFilled;
        sourceLabelHtml = `<span class="badge bg-success-subtle text-success border border-success ms-2" style="font-size:9px; font-weight:normal">AUTO: CURRENT ENTITY</span>`;
    }

    container.innerHTML = `
<!-- ═══ ROW 0: Scene & Entity Card (NEW) ═══ -->
<div class="row mb-1">
    <div class="col-12">
        ${renderSceneCard(pageContext)}
        ${renderMismatchWarning(tid, pageContext)}
        ${renderEntityCard(pageContext.currentEntity, pageContext.scene)}
        ${renderProfileTweetsSnapshot(pageContext.profileTweetsSnapshot || [], pageContext.scene, selectedProfileTweetIds.get(tid) || null)}
        ${renderSelectedProfileTweetCard(pageContext.profileTweetsSnapshot || [], pageContext.scene)}
        ${renderProfileTweetCandidateIntentCard(pageContext.profileTweetsSnapshot || [], pageContext.scene)}
        ${renderRepliesSnapshot(pageContext.repliesSnapshot || [], pageContext.scene)}
        ${renderSelectedReplyCard(pageContext.repliesSnapshot || [], pageContext.scene)}
    </div>
</div>

<!-- ═══ ROW 1: Tab Info · Hook Status ═══ -->

<!-- ═══ ROW 1: Tab Info · Hook Status ═══ -->
<div class="row mb-3">
    <div class="col-6">
        <div class="card h-100">
            <div class="card-header text-info">A · Current Tab</div>
            <div class="card-body py-2">
                <div class="sys-stat"><span class="text-muted">Tab ID</span><span class="val">${data.id ?? '—'}</span></div>
                <div class="sys-stat"><span class="text-muted">Active</span>${badge(!!tabMeta.active, 'YES', 'NO')}</div>
                <div class="sys-stat"><span class="text-muted">X / Twitter</span>${badge(isXPage, 'YES', 'NO')}</div>
                <div class="sys-stat"><span class="text-muted">Last Op</span><span class="val text-warning" style="font-size:11px">${data.lastOp || '—'}</span></div>
                <div class="mt-2" style="font-size:10px;color:#cbd5e0">URL</div>
                <div class="text-light text-truncate" style="font-size:10px">${tabMeta.url || data.url || '—'}</div>
                <div class="mt-2" style="font-size:10px;color:#cbd5e0">NAVIGATE TAB</div>
                <div class="d-flex gap-1 mt-1">
                    <input type="text" id="nav-url-input" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="https://x.com/..." style="font-size:10px;" value="${navUrlDrafts.get(tid) || tabMeta.url || data.url || ''}">
                    <button class="btn btn-outline-info btn-xs btn-tab-navigate" data-id="${data.id}" style="font-size:10px; padding: 2px 8px;">GO</button>
                </div>
                <div class="mt-2" style="font-size:10px;color:#cbd5e0">OPEN TWEET (Semantic)</div>
                <div class="d-flex gap-1 mt-1">
                    <input type="text" id="open-tweet-screen-name" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="screenName" style="font-size:10px; flex: 1;" value="${openTweetScreenNameDrafts.get(tid) || ''}">
                    <input type="text" id="open-tweet-id" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="tweetId" style="font-size:10px; flex: 2;" value="${openTweetIdDrafts.get(tid) || ''}">
                    <button class="btn btn-outline-info btn-xs btn-tab-open-tweet" data-id="${data.id}" style="font-size:10px; padding: 2px 8px;">OPEN</button>
                </div>
            </div>
        </div>
    </div>
    <div class="col-6">
        <div class="card h-100">
            <div class="card-header text-warning">B · Inject &amp; Hook Status</div>
            <div class="card-body py-2">
                <div class="sys-stat"><span class="text-muted">Inject Active</span>${badge(hookSt.fetch || hookSt.xhr, 'YES', 'UNKNOWN')}</div>
                <div class="sys-stat"><span class="text-muted">Fetch Hook</span>${badge(hookSt.fetch)}</div>
                <div class="sys-stat"><span class="text-muted">XHR Hook</span>${badge(hookSt.xhr)}</div>
                <div class="sys-stat"><span class="text-muted">Last API Hit</span><span class="val">${fmtTime(lastHit)}</span></div>
                <div class="sys-stat"><span class="text-muted">Last BG Sync</span><span class="val">${fmtTime(data.lastBgSync)}</span></div>
                <div class="sys-stat"><span class="text-muted">Anomaly</span><span class="val text-success">None</span></div>
            </div>
        </div>
    </div>
</div>

<!-- ═══ ROW 2: Identity · Write Env ═══ -->
<div class="row mb-3">
    <div class="col-6">
        <div class="card h-100">
            <div class="card-header text-success">E · Session / Identity</div>
            <div class="card-body py-2">
                ${renderIdentityPanel(account, mainTweet, data.id, pageContext?.scene)}
            </div>
        </div>
    </div>
    <div class="col-6">
        <div class="card h-100 ${isLoggedOut ? 'border-danger opacity-75' : ''}">
            <div class="card-header text-danger d-flex justify-content-between">
                <span>F · Write Execution Env</span>
                ${isLoggedOut ? '<span class="badge bg-danger">LOGGED OUT</span>' : ''}
            </div>
            <div class="card-body py-2">
                <div class="sys-stat"><span class="text-muted">Write Env</span><span class="val ${isLoggedOut ? 'text-danger' : 'text-success'}">${isLoggedOut ? 'LOCKED' : 'Content Script ✓'}</span></div>
                <div class="sys-stat"><span class="text-muted">Content Bridge</span>${badge(!isLoggedOut && bridgeOnline, 'ONLINE', 'OFFLINE')}</div>
                <div class="sys-stat"><span class="text-muted">Inject Writes</span><span class="val ${isLoggedOut ? 'text-muted' : 'text-success'}">${isLoggedOut ? 'Disabled' : 'None ✓'}</span></div>
                <div class="sys-stat"><span class="text-muted">Anomaly</span>
                    <span class="val ${isLoggedOut ? 'text-warning' : (bridgeOnline ? 'text-success' : 'text-danger')}">${isLoggedOut ? 'Session Invalid' : (bridgeOnline ? 'None' : '⚠ Bridge offline')}</span>
                </div>
                ${!isLoggedOut && mainTweet ? `
                <hr class="my-2 border-secondary">
                <div style="color:#8899A6;font-size:10px;margin-bottom:6px">LAST CAPTURED CONTENT</div>
                <div class="text-muted mb-1" style="font-size:10px">
                    <strong class="text-light">${mainTweet.authorName || ''}</strong>
                    <span> @${mainTweet.authorHandle?.replace('@','') || ''}</span>
                    <br><span style="opacity:.6">Tweet ID: ${mainTweet.id}  |  User ID: ${mainTweet.authorId || ''}</span>
                </div>` : (isLoggedOut ? '' : (pageContext?.scene === 'identity_resolving' ? '<div class="text-info small mt-2">Waiting for identity...</div>' : '<div class="text-muted small mt-2">No tweet captured yet.</div>'))}
                
                <hr class="my-3 border-secondary">
                ${renderExecutionIntent(data.id, pageContext, displayTargetId)}
                <div style="color:#cbd5e0;font-size:10px;margin-bottom:6px">
                    EXECUTE ACTION (Target ID)
                </div>
                <div class="d-flex gap-2 align-items-center mb-2">
                    <input type="text" id="manual-target-id" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Enter target Tweet ID or User ID..." style="font-size:11px;" value="${displayTargetId}" ${!canWrite ? 'disabled' : ''}>
                </div>
                <div class="d-flex gap-1 flex-wrap">
                    <button class="btn btn-outline-primary btn-manual-action btn-sm" data-tabid="${data.id}" data-action="like" ${!canWrite ? 'disabled' : ''}>LIKE</button>
                    <button class="btn btn-outline-success btn-manual-action btn-sm" data-tabid="${data.id}" data-action="retweet" ${!canWrite ? 'disabled' : ''}>RT</button>
                    <button class="btn btn-outline-warning btn-manual-action btn-sm" data-tabid="${data.id}" data-action="bookmark" ${!canWrite ? 'disabled' : ''}>SAVE</button>
                    <button class="btn btn-outline-info btn-manual-action btn-sm" data-tabid="${data.id}" data-action="follow" ${!canWrite ? 'disabled' : ''}>FOLLOW</button>
                    <button class="btn btn-outline-secondary btn-manual-action btn-sm" data-tabid="${data.id}" data-action="unfollow" ${!canWrite ? 'disabled' : ''}>UNFOLLOW</button>
                </div>
                ${renderReplyDraftUI(data.id, pageContext, displayTargetId, isLoggedOut)}
                ${isLoggedOut ? '<div class="mt-2 text-danger" style="font-size:10px">⚠ Actions locked until X session is restored.</div>' : (!hasTarget && !isLoggedOut ? '<div class="mt-1 text-muted" style="font-size:9px">Pick a tweet on X to enable actions.</div>' : '')}
            </div>
        </div>
    </div>
</div>

<!-- ═══ ROW 3: API Hit Matrix ═══ -->
<div class="row mb-3">
    <div class="col-12">
        <div class="card">
            <div class="card-header text-primary">C · Watched API Hit Matrix (${allOps.length} ops)</div>
            <div style="overflow:auto">
                <table class="table table-dark table-hover mb-0" style="font-size:11px">
                    <thead><tr>
                        <th class="ps-3">Operation</th>
                        <th>Status</th>
                        <th>Hits</th>
                        <th>Last Hit</th>
                        <th>Cache</th>
                        <th class="pe-3">Request Summary</th>
                    </tr></thead>
                    <tbody>
                    ${allOps.map(op => {
                        const s = stats[op];
                        const cached = !!data.data?.[op];
                        const lastHitRow = hits.find((h: any) => h.op === op);
                        return `<tr>
                            <td class="ps-3 fw-bold">${op}</td>
                            <td>${s ? '<span class="text-success">● HIT</span>' : '<span class="text-muted">○ —</span>'}</td>
                            <td>${s?.count || 0}</td>
                            <td>${s ? fmtTime(s.lastHit) : '—'}</td>
                            <td>${cached ? '<span class="text-info">✓</span>' : '<span class="text-muted">—</span>'}</td>
                            <td class="pe-3 text-muted" style="font-size:10px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                                ${lastHitRow ? reqSummary(lastHitRow.requestBody) : '—'}
                            </td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- ═══ ROW 4: Raw Intercept Grid ═══ -->
<div class="row">
    <div class="col-12">
        <div class="card">
            <div class="card-header text-secondary d-flex align-items-center">
                <span>D · Raw Intercept Stream</span>
                <span class="badge bg-secondary ms-2">${hits.length}</span>
                <span style="font-size:10px;color:#cbd5e0;margin-left:8px">Click Details to inspect</span>
            </div>
            <div class="p-3">
                ${hits.length === 0
                    ? `<div class="text-muted small">No intercepts yet — open or scroll x.com to trigger.</div>`
                    : `<div class="hit-grid">${hits.map((h: any, i: number) => renderHitCard(h, i)).join('')}</div>`
                }
            </div>
        </div>
    </div>
</div>`;
}

// ─────────────────────────────────────────────
// 写操作执行与 Toast 遮罩
// ─────────────────────────────────────────────
function showToast(message: string, isError: boolean = false, autoCloseTime: number = 0) {
    let t = document.getElementById('tc-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'tc-toast';
        document.body.appendChild(t);
    }
    t.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px)">
        <div style="background:#1a202c;border:2px solid ${isError ? '#f56565' : '#4ade80'};border-radius:12px;padding:24px 40px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)">
            <h4 style="color:${isError ? '#f56565' : '#4ade80'};margin:0;">${message}</h4>
        </div>
    </div>`;
    
    if (autoCloseTime > 0) {
        setTimeout(() => { if (t) t.remove(); }, autoCloseTime);
    }
}

async function doAction(tabId: number, targetId: string, action: string, btn: HTMLButtonElement) {
    btn.disabled = true;
    const orig = btn.innerText;
    btn.innerText = '…';
    
    showToast(`EXECUTING: ${action.toUpperCase()}...`, false);
    
    // 因为 Follow 往往需要 userId，在此我们默认使用 targetId
    // 如果用户填错了类型或者输入框为空，会在底层抛出错误。
    const resp = await sendMsg({ type: 'EXEC_PROXY_ACTION', tabId, tweetId: targetId, userId: targetId, action });
    
    btn.disabled = false;
    btn.innerText = orig;
    
    if (resp?.ok) {
        showToast(`✅ ${action.toUpperCase()} SUCCESS!`, false, 2000);
    } else {
        showToast(`❌ ${action.toUpperCase()} FAILED\n\n<span style="font-size:12px;color:#cbd5e0;display:block;margin-top:10px">${resp?.error?.message || 'Unknown error'}</span>`, true, 4000);
        console.error('[TweetClaw-Debug] Action failed:', resp);
    }
}

// ─────────────────────────────────────────────
// 初始化
// ─────────────────────────────────────────────
setupDelegation();
refreshData();
console.log('[TweetClaw-Debug] v5.4 loaded.');
