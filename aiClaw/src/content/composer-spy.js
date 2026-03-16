/**
 * ACSpy - ChatGPT Composer DOM Spy
 * 直接粘贴到 ChatGPT DevTools Console 运行
 * 完成后执行: window.__acSpyDump()
 */
(function () {
  const LOG = [];
  const T0 = performance.now();

  function log(type, data) {
    const entry = { t: Math.round(performance.now() - T0), type, data };
    LOG.push(entry);
    console.log(`[ACSpy +${entry.t}ms] [${type}]`, data);
  }

  function describeEl(el) {
    if (!el) return '(null)';
    const tag = el.tagName?.toLowerCase() || '?';
    const id = el.id ? `#${el.id}` : '';
    const testid = el.getAttribute?.('data-testid') ? `[testid="${el.getAttribute('data-testid')}"]` : '';
    const aria = el.getAttribute?.('aria-label') ? `[aria="${el.getAttribute('aria-label')}"]` : '';
    const role = el.getAttribute?.('role') ? `[role="${el.getAttribute('role')}"]` : '';
    const cls = el.className ? `.${String(el.className).slice(0, 60).replace(/\s+/g, '.')}` : '';
    return `<${tag}${id}${testid}${aria}${role}${cls}>`;
  }

  // 1. 找 composer form
  const composer = document.querySelector('form[class*="group\\/composer"]');
  if (!composer) {
    // 降级：找包含 prompt-textarea 的 form
    const fallback = document.getElementById('prompt-textarea')?.closest('form');
    if (!fallback) {
      console.error('[ACSpy] 未找到 composer form！请在 chatgpt.com 对话页面执行');
      return;
    }
  }
  const form = composer || document.getElementById('prompt-textarea')?.closest('form');

  log('INIT', {
    form: describeEl(form),
    'data-type': form.getAttribute('data-type'),
    'data-expanded': form.getAttribute('data-expanded'),
  });

  // 2. MutationObserver 监听 form 内变化
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node;
          const testid = el.getAttribute?.('data-testid');

          log('DOM_ADDED', { el: describeEl(el), testid, parent: describeEl(el.parentElement) });

          if (testid === 'send-button') log('🚀 SEND_BTN_APPEARED', { el: describeEl(el), disabled: el.disabled });
          if (testid === 'stop-button') log('⏹️ STOP_BTN_APPEARED', { el: describeEl(el) });
          if (testid === 'composer-speech-button') log('🎤 SPEECH_BTN_APPEARED', {});

          // 递归检查子元素
          el.querySelectorAll?.('[data-testid]').forEach(child => {
            const cid = child.getAttribute('data-testid');
            if (cid === 'send-button') log('🚀 SEND_BTN_APPEARED (nested)', { el: describeEl(child) });
            if (cid === 'stop-button') log('⏹️ STOP_BTN_APPEARED (nested)', { el: describeEl(child) });
          });
        });

        m.removedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node;
          const testid = el.getAttribute?.('data-testid');
          log('DOM_REMOVED', { el: describeEl(el), testid });
          if (testid === 'stop-button') log('✅ STOP_BTN_GONE → 生成完成', {});
          if (testid === 'send-button') log('📤 SEND_BTN_GONE → 已发送', {});
        });
      }

      if (m.type === 'attributes') {
        const el = m.target;
        const attr = m.attributeName;
        const newVal = el.getAttribute?.(attr);
        log('ATTR', { el: describeEl(el), attr, old: m.oldValue, new: newVal });

        if (attr === 'data-expanded') log('📐 COMPOSER_EXPAND', { expanded: newVal !== null, val: newVal });
        if (attr === 'disabled' && el.tagName === 'BUTTON') log('🔘 BTN_DISABLED', { el: describeEl(el), disabled: newVal !== null });
        if (attr === 'class' && el.getAttribute?.('data-testid') === 'send-button') log('🎨 SEND_BTN_CLASS', { class: newVal });
      }

      if (m.type === 'characterData') {
        const parent = m.target.parentElement;
        if (parent) log('TEXT', { parent: describeEl(parent), text: m.target.data?.slice(0, 80) });
      }
    }
  });

  mo.observe(form, {
    childList: true, subtree: true,
    attributes: true, attributeOldValue: true,
    characterData: true, characterDataOldValue: true,
    attributeFilter: ['disabled', 'data-expanded', 'data-testid', 'aria-label', 'class', 'contenteditable'],
  });

  // 3. 监听 thread（AI 回复区域）
  const thread = document.getElementById('thread') || document.querySelector('[class*="group/thread"]');
  if (thread) {
    const tmo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const el = node;
            if (el.tagName === 'ARTICLE') {
              log('📄 NEW_ARTICLE', { turn: el.getAttribute('data-turn'), testid: el.getAttribute('data-testid') });
            }
            el.querySelectorAll?.('[data-message-author-role]').forEach(msg => {
              log('💬 MSG_ROLE', { role: msg.getAttribute('data-message-author-role'), id: msg.getAttribute('data-message-id') });
            });
          });
        }
        if (m.type === 'attributes' && m.attributeName === 'data-scroll-anchor') {
          log('⚓ SCROLL_ANCHOR', { el: describeEl(m.target), val: m.target.getAttribute('data-scroll-anchor') });
        }
      }
    });
    tmo.observe(thread, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['data-scroll-anchor', 'data-message-author-role'],
    });
    log('THREAD_SPY_ON', {});
  }

  // 4. 监听输入框事件
  const input = document.getElementById('prompt-textarea');
  if (input) {
    input.addEventListener('input', (e) => {
      log('✏️ INPUT', { text: e.target.textContent?.slice(0, 80), innerText: e.target.innerText?.slice(0, 80) });
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') log('⌨️ ENTER', { shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey, prevented: e.defaultPrevented });
    });
    input.addEventListener('focus', () => log('🎯 FOCUS', {}));
    log('INPUT_SPY_ON', { el: describeEl(input) });
  }

  form.addEventListener('submit', (e) => log('📨 SUBMIT', { prevented: e.defaultPrevented }));

  // 5. 定时快照（500ms，只在状态变化时打印）
  let lastSnap = '';
  let snapN = 0;
  const iv = setInterval(() => {
    if (++snapN > 600) { clearInterval(iv); return; }
    const sendBtn = document.querySelector('[data-testid="send-button"]');
    const stopBtn = document.querySelector('[data-testid="stop-button"]');
    const inputEl = document.getElementById('prompt-textarea');
    const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    const lastMsg = msgs[msgs.length - 1];

    const snap = {
      n: snapN,
      send: sendBtn ? (sendBtn.disabled ? 'DISABLED' : 'ENABLED') : 'NONE',
      stop: stopBtn ? 'PRESENT' : 'NONE',
      input: inputEl?.textContent?.trim().slice(0, 40) || '',
      msgs: msgs.length,
      lastMsgLen: lastMsg?.textContent?.length || 0,
    };
    const s = JSON.stringify(snap);
    if (s !== lastSnap) {
      log('📸 SNAP', snap);
      lastSnap = s;
    }
  }, 500);

  // 6. 导出
  window.__acSpyDump = () => {
    const out = JSON.stringify(LOG, null, 2);
    console.log('\n=== ACSpy DUMP START ===\n' + out + '\n=== ACSpy DUMP END ===\n');
    navigator.clipboard?.writeText(out).then(
      () => console.log('✅ 已复制到剪贴板'),
      () => console.log('❌ 请手动从上方复制')
    );
    return LOG;
  };

  window.__acSpyStop = () => { mo.disconnect(); clearInterval(iv); log('🛑 STOPPED', {}); };

  console.log(`
╔═══════════════════════════════════════╗
║  ACSpy 已启动 ✅                       ║
╠═══════════════════════════════════════╣
║  步骤：                                ║
║  1. 在输入框输入文字                    ║
║  2. 点击发送（或 Enter）               ║
║  3. 等 AI 回复完毕                     ║
║  4. 执行: window.__acSpyDump()        ║
║     把输出的 JSON 发给 Claude          ║
╚═══════════════════════════════════════╝
`);
})();
