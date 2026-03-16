/**
 * ChatGPT Composer DOM Spy
 *
 * 把这段代码粘贴到 ChatGPT 页面的 DevTools Console 里运行。
 * 它会监听 form.group/composer 的所有 DOM 变化和关键事件，
 * 把完整日志打印到 console，供我们分析 adapter 的正确实现方式。
 *
 * 使用方法：
 *   1. 打开 chatgpt.com，进入任意对话
 *   2. 打开 DevTools → Console
 *   3. 粘贴整段代码，回车执行
 *   4. 正常输入一条消息并发送，等待 AI 回复完成
 *   5. 执行 window.__acSpyDump() 导出完整日志
 */

(function () {
  // ─── 日志收集器 ───────────────────────────────────────────────────────────
  const LOG: Array<{ t: number; type: string; data: unknown }> = [];
  const T0 = performance.now();

  function log(type: string, data: unknown) {
    const entry = { t: Math.round(performance.now() - T0), type, data };
    LOG.push(entry);
    console.log(`[ACSpy +${entry.t}ms] [${type}]`, data);
  }

  // ─── 找到 composer form ───────────────────────────────────────────────────
  function findComposer(): HTMLFormElement | null {
    // class="group/composer w-full" 是 Tailwind group 语法，实际 class 名是 "group/composer"
    // querySelector 需要转义斜杠
    return document.querySelector('form[class*="group/composer"]');
  }

  const composer = findComposer();
  if (!composer) {
    console.error('[ACSpy] 未找到 composer form，请确认你在 ChatGPT 对话页面');
    // @ts-ignore
    return;
  }

  log('INIT', {
    composerClass: composer.className,
    composerAttrs: {
      'data-type': composer.getAttribute('data-type'),
      'data-expanded': composer.getAttribute('data-expanded'),
    },
    innerHTML_summary: composer.innerHTML.slice(0, 200) + '...',
  });

  // ─── 辅助：提取元素的精简描述 ─────────────────────────────────────────────
  function describeEl(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const testid = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
    const ariaLabel = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
    const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';
    const type = (el as HTMLButtonElement).type ? `[type="${(el as HTMLButtonElement).type}"]` : '';
    // 只截取 class 前 80 字符
    const cls = el.className ? `.${String(el.className).slice(0, 80).replace(/\s+/g, '.')}` : '';
    return `<${tag}${id}${testid}${ariaLabel}${role}${type}${cls}>`;
  }

  // ─── 1. MutationObserver：监听 DOM 变化 ───────────────────────────────────
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            log('DOM_ADDED', {
              el: describeEl(el),
              parent: describeEl(el.parentElement!),
              testid: el.getAttribute('data-testid'),
              ariaLabel: el.getAttribute('aria-label'),
              // 如果是 button，记录更多
              ...(el.tagName === 'BUTTON' && {
                buttonType: (el as HTMLButtonElement).type,
                innerText: el.textContent?.trim().slice(0, 50),
              }),
            });

            // 特别关注 send-button 和 stop-button 的出现
            if (el.getAttribute('data-testid') === 'send-button') {
              log('🚀 SEND_BUTTON_APPEARED', { el: describeEl(el) });
            }
            if (el.getAttribute('data-testid') === 'stop-button') {
              log('⏹️ STOP_BUTTON_APPEARED', { el: describeEl(el) });
            }
          }
        });

        m.removedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            log('DOM_REMOVED', {
              el: describeEl(el),
              testid: el.getAttribute('data-testid'),
            });

            if (el.getAttribute('data-testid') === 'stop-button') {
              log('✅ STOP_BUTTON_DISAPPEARED → AI 回复完成', { el: describeEl(el) });
            }
            if (el.getAttribute('data-testid') === 'send-button') {
              log('📤 SEND_BUTTON_DISAPPEARED → 消息已发出', { el: describeEl(el) });
            }
          }
        });
      }

      if (m.type === 'attributes') {
        const el = m.target as Element;
        const newVal = el.getAttribute(m.attributeName!);
        log('ATTR_CHANGE', {
          el: describeEl(el),
          attr: m.attributeName,
          oldValue: m.oldValue,
          newValue: newVal,
        });

        // 特别关注 data-expanded 变化（composer 展开/收起）
        if (m.attributeName === 'data-expanded') {
          log('📐 COMPOSER_EXPAND_CHANGE', { expanded: newVal !== null });
        }
        // 特别关注 disabled 变化（按钮可用性）
        if (m.attributeName === 'disabled') {
          log('🔘 BUTTON_DISABLED_CHANGE', {
            el: describeEl(el),
            disabled: newVal !== null,
          });
        }
      }

      if (m.type === 'characterData') {
        const parent = (m.target as Text).parentElement;
        if (parent) {
          log('TEXT_CHANGE', {
            parent: describeEl(parent),
            newText: (m.target as Text).data.slice(0, 100),
          });
        }
      }
    }
  });

  mo.observe(composer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
    attributeFilter: [
      'data-testid', 'aria-label', 'disabled', 'data-expanded',
      'contenteditable', 'class', 'data-message-author-role',
      'data-turn', 'data-scroll-anchor',
    ],
  });

  // ─── 2. 同时监听整个 thread 区域（回复出现） ──────────────────────────────
  const thread = document.getElementById('thread') || document.querySelector('[id="thread"]');
  if (thread) {
    const threadMO = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as Element;

            // 监听新 article 出现（新的对话轮次）
            if (el.tagName === 'ARTICLE' || el.querySelector?.('article')) {
              const article = el.tagName === 'ARTICLE' ? el : el.querySelector('article')!;
              log('📝 NEW_TURN_ARTICLE', {
                'data-turn': article.getAttribute('data-turn'),
                'data-testid': article.getAttribute('data-testid'),
                'data-turn-id': article.getAttribute('data-turn-id'),
              });
            }

            // 监听 assistant 消息容器出现
            if ((el as Element).querySelector?.('[data-message-author-role="assistant"]')) {
              log('🤖 ASSISTANT_MESSAGE_CONTAINER_APPEARED', {
                el: describeEl(el),
              });
            }
            if (el.getAttribute?.('data-message-author-role') === 'assistant') {
              log('🤖 ASSISTANT_MESSAGE_DIV_APPEARED', {
                'data-message-id': el.getAttribute('data-message-id'),
                'data-message-model-slug': el.getAttribute('data-message-model-slug'),
              });
            }
          });

          m.removedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as Element;
            if (el.getAttribute?.('data-testid') === 'stop-button') {
              log('✅✅ THREAD_STOP_BUTTON_REMOVED → 生成完成', {});
            }
          });
        }

        if (m.type === 'attributes') {
          const el = m.target as Element;
          // 监听 data-scroll-anchor 变化（最后一条消息）
          if (m.attributeName === 'data-scroll-anchor') {
            log('⚓ SCROLL_ANCHOR_CHANGE', {
              el: describeEl(el),
              'data-turn': el.getAttribute('data-turn'),
              scrollAnchor: el.getAttribute('data-scroll-anchor'),
            });
          }
        }
      }
    });

    threadMO.observe(thread, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-scroll-anchor', 'data-message-author-role', 'data-turn'],
      attributeOldValue: true,
    });

    log('THREAD_SPY_ON', { threadId: thread.id });
  } else {
    log('THREAD_SPY_SKIP', { reason: '#thread not found' });
  }

  // ─── 3. 事件监听：捕获 input / keydown / submit ───────────────────────────
  const proseMirrorDiv = document.getElementById('prompt-textarea');
  if (proseMirrorDiv) {
    proseMirrorDiv.addEventListener('input', (e) => {
      log('✏️ INPUT_EVENT', {
        type: e.type,
        currentText: (e.target as HTMLElement).textContent?.slice(0, 100),
        innerText: (e.target as HTMLElement).innerText?.slice(0, 100),
      });
    });

    proseMirrorDiv.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      log('⌨️ KEYDOWN', {
        key: ke.key,
        code: ke.code,
        ctrlKey: ke.ctrlKey,
        metaKey: ke.metaKey,
        shiftKey: ke.shiftKey,
      });
    });

    proseMirrorDiv.addEventListener('focus', () => log('🎯 INPUT_FOCUS', {}));
    proseMirrorDiv.addEventListener('blur', () => log('💤 INPUT_BLUR', {}));

    log('INPUT_SPY_ON', { el: describeEl(proseMirrorDiv) });
  }

  // form submit 事件
  composer.addEventListener('submit', (e) => {
    log('📨 FORM_SUBMIT', {
      defaultPrevented: e.defaultPrevented,
    });
  });

  // ─── 4. 定时快照：每500ms 检查关键元素状态 ────────────────────────────────
  let snapshotCount = 0;
  const snapshotInterval = setInterval(() => {
    snapshotCount++;

    const sendBtn = document.querySelector('[data-testid="send-button"]');
    const stopBtn = document.querySelector('[data-testid="stop-button"]');
    const inputEl = document.getElementById('prompt-textarea');
    const assistantNodes = document.querySelectorAll('[data-message-author-role="assistant"]');
    const lastAssistant = assistantNodes.length > 0 ? assistantNodes[assistantNodes.length - 1] : null;

    const snap = {
      snapshot: snapshotCount,
      send_button: sendBtn ? 'EXISTS' : 'NOT_FOUND',
      stop_button: stopBtn ? 'EXISTS' : 'NOT_FOUND',
      input_text: inputEl?.textContent?.trim().slice(0, 50) || '(empty)',
      last_assistant_id: lastAssistant?.getAttribute('data-message-id') || 'none',
      last_assistant_text_len: lastAssistant?.textContent?.length || 0,
    };

    // 只在状态变化时打印（减少噪音）
    const snapStr = JSON.stringify(snap);
    if (snapStr !== (window as any).__acLastSnap) {
      log('📸 SNAPSHOT', snap);
      (window as any).__acLastSnap = snapStr;
    }

    if (snapshotCount > 600) { // 5分钟后停止
      clearInterval(snapshotInterval);
      log('⏰ SNAPSHOT_STOPPED', { reason: 'timeout 5min' });
    }
  }, 500);

  // ─── 5. 导出函数 ──────────────────────────────────────────────────────────
  (window as any).__acSpyDump = () => {
    const output = JSON.stringify(LOG, null, 2);
    console.log('=== ACSpy Full Log ===\n' + output);
    // 同时复制到剪贴板
    navigator.clipboard.writeText(output).then(
      () => console.log('✅ 日志已复制到剪贴板'),
      () => console.log('❌ 复制失败，请手动从上方复制'),
    );
    return LOG;
  };

  (window as any).__acSpyStop = () => {
    mo.disconnect();
    clearInterval(snapshotInterval);
    log('🛑 SPY_STOPPED', {});
    console.log('[ACSpy] 监听已停止，执行 window.__acSpyDump() 获取日志');
  };

  console.log(`
╔══════════════════════════════════════════╗
║         ACSpy 已启动 ✅                   ║
╠══════════════════════════════════════════╣
║  现在请：                                 ║
║  1. 在输入框输入一些文字                   ║
║  2. 点击发送按钮（或按 Enter）             ║
║  3. 等待 AI 完成回复                       ║
║  4. 执行: window.__acSpyDump()            ║
║     把日志发给 Claude 分析                 ║
╚══════════════════════════════════════════╝
  `);
})();
