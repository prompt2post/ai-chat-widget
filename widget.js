/* =========================================================================
 * AI 英文客服挂件  ·  Embeddable Customer-Service Widget
 * -------------------------------------------------------------------------
 * YOU NEVER EDIT THIS FILE. Host it once, reuse for every client.
 *
 * Each client's site pastes ONE small config block + this file, before </body>:
 *
 *   <script>
 *     window.AICS = {
 *       storeName: "Store Name",
 *       brandColor: "#2f7d5b",
 *       supportEmail: "help@store.com",
 *       apiKey: "sk-...",                // DeepSeek key (支付宝充值)
 *       knowledgeBase: `
 *         Shipping: worldwide, 7-12 days to US, flat $6, free over $59.
 *         Returns: 30 days, full refund on unopened items.
 *         Products: ...
 *       `
 *     };
 *   </script>
 *   <script src="https://your-host/widget.js" defer></script>
 *
 *   (Shopify: Online Store → Themes → Edit code → theme.liquid, before </body>.
 *    WooCommerce: footer scripts.)
 *
 * SECURITY NOTE (tell the client):
 *   The apiKey sits in the page, so it's visible to anyone who views source.
 *   That's the trade-off of a no-server widget. Keep it safe by:
 *     • using a DEDICATED DeepSeek key for this site only,
 *     • setting a low monthly spend cap (e.g. ¥30) in the DeepSeek dashboard,
 *     • rotating the key if it's ever abused.
 *   For premium clients you can hide the key behind a small serverless proxy.
 * ========================================================================= */

(function () {
  'use strict';

  if (window.__ai_cs_widget_loaded) return;   // guard against double-load
  window.__ai_cs_widget_loaded = true;

  // Read the client's config from the page, fill in sensible defaults.
  var U = window.AICS || {};
  var C = {
    storeName:    U.storeName    || 'our store',
    brandColor:   U.brandColor   || '#2f7d5b',
    supportEmail: U.supportEmail || 'support@example.com',
    agentName:    U.agentName    || '',
    launcherLabel:U.launcherLabel|| 'Chat with us',
    greeting:     U.greeting     || 'Hi there! 👋 Ask me anything about shipping, returns, or our products.',
    apiEndpoint:  U.apiEndpoint  || 'https://api.deepseek.com/chat/completions',
    model:        U.model        || 'deepseek-chat',
    apiKey:       U.apiKey        || '',
    chips:        U.chips         || ['Do you ship to my country?', 'How long is delivery?', "What's your return policy?"],
    knowledgeBase:U.knowledgeBase || '',
  };
  var brand = C.brandColor;

  function darken(hex, amt) {
    try {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.max(0, ((n >> 16) & 255) - amt);
      var g = Math.max(0, ((n >> 8) & 255) - amt);
      var b = Math.max(0, (n & 255) - amt);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }
  var brandDark = darken(brand, 28);

  var SYSTEM_PROMPT =
    'You are the friendly customer-service assistant' +
    (C.agentName ? ' named "' + C.agentName + '"' : '') +
    ' for "' + C.storeName + '", an online store that ships worldwide.\n\n' +
    'RULES:\n' +
    '- Answer ONLY as ' + C.storeName + ' support. Be warm, concise (2-4 sentences), helpful.\n' +
    '- Use ONLY the facts in the KNOWLEDGE BASE. Never invent prices, dates, or policies.\n' +
    '- If something is not covered, say you will connect them with a human at ' + C.supportEmail + '.\n' +
    '- IMPORTANT: reply in the SAME language the customer wrote in.\n' +
    '- One friendly emoji occasionally is fine; do not overdo it.\n\n' +
    '=== KNOWLEDGE BASE ===\n' + C.knowledgeBase;

  // ------------------------------ Styles ------------------------------
  var css = [
    '.acs-launch{position:fixed;bottom:22px;right:22px;z-index:2147483000;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;background:' + brand + ';color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);display:grid;place-items:center;transition:transform .15s}',
    '.acs-launch:hover{transform:scale(1.06);background:' + brandDark + '}',
    '.acs-launch svg{width:26px;height:26px}',
    '.acs-badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:#e5533c;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;border:2px solid #fff}',
    '.acs-panel{position:fixed;bottom:90px;right:22px;z-index:2147483000;width:370px;max-width:calc(100vw - 28px);height:540px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);border:1px solid #e6e6e6;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '.acs-panel.acs-open{display:flex}',
    '.acs-head{background:' + brand + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:11px}',
    '.acs-avatar{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font-weight:700;font-size:15px}',
    '.acs-who{flex:1}.acs-who .acs-name{font-weight:700;font-size:14px}.acs-who .acs-status{font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px}',
    '.acs-dot{width:7px;height:7px;border-radius:50%;background:#7ff0b0;display:inline-block}',
    '.acs-x{background:none;border:none;color:#fff;cursor:pointer;opacity:.85;font-size:20px;line-height:1;padding:0 2px}.acs-x:hover{opacity:1}',
    '.acs-body{flex:1;overflow-y:auto;padding:16px;background:#f7f7f5;display:flex;flex-direction:column;gap:10px}',
    '.acs-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.acs-bot{background:#fff;border:1px solid #e6e6e6;align-self:flex-start;border-bottom-left-radius:4px;color:#222}',
    '.acs-user{background:' + brand + ';color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.acs-typing{align-self:flex-start;display:flex;gap:4px;padding:11px 13px;background:#fff;border:1px solid #e6e6e6;border-radius:14px}',
    '.acs-typing i{width:7px;height:7px;border-radius:50%;background:#bbb;animation:acsblink 1.2s infinite}',
    '.acs-typing i:nth-child(2){animation-delay:.2s}.acs-typing i:nth-child(3){animation-delay:.4s}',
    '@keyframes acsblink{0%,60%,100%{opacity:.3}30%{opacity:1}}',
    '.acs-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 9px;background:#f7f7f5}',
    '.acs-chip{font-size:12px;padding:6px 11px;border-radius:20px;border:1px solid #e0e0e0;background:#fff;cursor:pointer;color:#333}',
    '.acs-chip:hover{border-color:' + brand + ';color:' + brand + '}',
    '.acs-input{display:flex;gap:8px;padding:11px;border-top:1px solid #eee;background:#fff}',
    '.acs-input input{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;font-family:inherit}',
    '.acs-input input:focus{border-color:' + brand + '}',
    '.acs-input button{background:' + brand + ';border:none;color:#fff;border-radius:10px;width:42px;cursor:pointer;display:grid;place-items:center}',
    '.acs-input button:hover{background:' + brandDark + '}.acs-input button:disabled{opacity:.5;cursor:default}',
    '.acs-foot{font-size:10px;color:#aaa;text-align:center;padding:5px;background:#fff}',
  ].join('');

  // ------------------------------ Build DOM ------------------------------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function init() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);

    var launch = el('button', 'acs-launch');
    launch.setAttribute('aria-label', C.launcherLabel);
    launch.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="acs-badge">1</span>';

    var chipsHtml = (C.chips || []).map(function (c) {
      return '<button class="acs-chip">' + c.replace(/</g, '&lt;') + '</button>';
    }).join('');

    var panel = el('div', 'acs-panel');
    panel.innerHTML =
      '<div class="acs-head">' +
        '<div class="acs-avatar">' + (C.agentName ? C.agentName[0] : C.storeName[0]) + '</div>' +
        '<div class="acs-who"><div class="acs-name">' + (C.agentName ? C.agentName + ' · ' : '') + C.storeName + '</div>' +
        '<div class="acs-status"><span class="acs-dot"></span> Online · replies instantly</div></div>' +
        '<button class="acs-x" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="acs-body"></div>' +
      '<div class="acs-chips">' + chipsHtml + '</div>' +
      '<form class="acs-input"><input type="text" placeholder="Type your question…" autocomplete="off" />' +
      '<button type="submit" aria-label="Send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></form>' +
      '<div class="acs-foot">AI assistant</div>';

    document.body.appendChild(launch);
    document.body.appendChild(panel);

    var body = panel.querySelector('.acs-body');
    var form = panel.querySelector('.acs-input');
    var input = form.querySelector('input');
    var sendBtn = form.querySelector('button');
    var badge = launch.querySelector('.acs-badge');
    var messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    var greeted = false, busy = false;

    function scroll() { body.scrollTop = body.scrollHeight; }
    function addMsg(role, text) {
      var m = el('div', 'acs-msg ' + (role === 'user' ? 'acs-user' : 'acs-bot'));
      m.textContent = text; body.appendChild(m); scroll(); return m;
    }
    function typing() {
      var t = el('div', 'acs-typing', '<i></i><i></i><i></i>'); body.appendChild(t); scroll(); return t;
    }

    function open() {
      panel.classList.add('acs-open'); badge.style.display = 'none';
      if (!greeted) { greeted = true; addMsg('bot', C.greeting); }
      setTimeout(function () { input.focus(); }, 80);
    }
    function close() { panel.classList.remove('acs-open'); }

    function send(text) {
      text = (text || input.value).trim();
      if (!text || busy) return;
      addMsg('user', text); input.value = '';
      messages.push({ role: 'user', content: text });
      busy = true; sendBtn.disabled = true;
      var t = typing();

      if (!C.apiKey || C.apiKey.indexOf('PASTE_') === 0 || C.apiKey.indexOf('sk-') !== 0) {
        setTimeout(function () {
          t.remove();
          addMsg('bot', 'Thanks! Our assistant isn\'t connected yet. Please email ' + C.supportEmail + ' and we\'ll help right away.');
          busy = false; sendBtn.disabled = false; input.focus();
        }, 600);
        return;
      }

      fetch(C.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + C.apiKey },
        body: JSON.stringify({ model: C.model, messages: messages, temperature: 0.4, max_tokens: 400 }),
      }).then(function (r) {
        return r.ok ? r.json() : r.text().then(function (tx) { throw new Error(r.status + ' ' + tx.slice(0, 120)); });
      }).then(function (data) {
        t.remove();
        var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim()
          || 'Sorry, could you rephrase that?';
        addMsg('bot', reply);
        messages.push({ role: 'assistant', content: reply });
      }).catch(function (e) {
        t.remove();
        addMsg('bot', 'Sorry, I had trouble responding. Please email ' + C.supportEmail + '. (' + e.message + ')');
      }).then(function () {
        busy = false; sendBtn.disabled = false; input.focus();
      });
    }

    launch.addEventListener('click', function () {
      panel.classList.contains('acs-open') ? close() : open();
    });
    panel.querySelector('.acs-x').addEventListener('click', close);
    form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
    panel.querySelector('.acs-chips').addEventListener('click', function (e) {
      if (e.target.classList.contains('acs-chip')) send(e.target.textContent);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
