(() => {
  'use strict';

  // 风险补充模块：统一使用 UTF-8 中文，不依赖第三方 UI 框架。
  // 管理员密码只作为请求凭据使用，不硬编码到前端代码。
  const ADMIN_SESSION_KEY = 'fundRiskAdminPassword';
  const RISK_TYPES = ['行政处罚', '警示函', '监管措施', '市场禁入', '纪律处分', '其他'];

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

  const state = {
    code: '',
    name: '',
    manager: '',
    page: 'fund'
  };

  const legacyRiskPage = window.riskPage;
  const legacyOpenFund = window.openFund;

  function hideAppChrome() {
    $('.topbar')?.style.setProperty('display', 'none');
    $('.tabbar')?.style.setProperty('display', 'none');
  }

  function showAppChrome() {
    $('.topbar')?.style.removeProperty('display');
    $('.tabbar')?.style.removeProperty('display');
  }

  function rememberContext(code = '', name = '', manager = '') {
    state.code = code || state.code || '';
    state.name = name || state.name || '';
    state.manager = manager || state.manager || window.__riskManager || '';
    window.__riskCode = state.code;
    window.__riskName = state.name;
    window.__riskManager = state.manager;
  }

  function insertAfter(anchor, element) {
    if (!anchor?.parentNode) return false;
    anchor.insertAdjacentElement('afterend', element);
    return true;
  }

  function makeButton(className, id, title, description, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.className = className;
    button.innerHTML = `<div><strong>${esc(title)}</strong>${description ? `<p>${esc(description)}</p>` : ''}</div><span aria-hidden="true">›</span>`;
    button.addEventListener('click', onClick);
    return button;
  }

  function addRiskPageEntries() {
    const list = $('#riskList');
    if (!list) return;

    if (!$('#riskSubmitCard')) {
      const submitCard = makeButton(
        'risk-user-submit-card',
        'riskSubmitCard',
        '补充公开风险记录',
        '发现遗漏的证监会/证监局公开处罚？可提交原文链接补充',
        () => openRiskSubmit({
          code: state.code,
          name: state.name,
          manager: state.manager,
          fromRisk: true
        })
      );
      insertAfter(list, submitCard);
    }

    if (!$('#riskAdminCard')) {
      const adminCard = makeButton(
        'risk-admin-card',
        'riskAdminCard',
        '管理员：风险数据库管理',
        '管理员可直接录入风险，或审核用户提交记录',
        () => openRiskAdmin({
          code: state.code,
          name: state.name,
          manager: state.manager,
          fromRisk: true
        })
      );
      const submitCard = $('#riskSubmitCard');
      insertAfter(submitCard || list, adminCard);
    }

    if (!$('#riskSupplementGuide')) {
      const guide = document.createElement('p');
      guide.id = 'riskSupplementGuide';
      guide.className = 'risk-supplement-guide';
      guide.textContent = '没有找到记录？可以点击上方补充公开风险记录。';
      const submitCard = $('#riskSubmitCard');
      if (submitCard?.parentNode) submitCard.parentNode.insertBefore(guide, submitCard);
    }
  }

  function addFundPageEntries(code, name, manager) {
    rememberContext(code, name, manager);
    const riskButton = $('#riskBtn');
    if (!riskButton) return;

    if (!$('#riskSubmitHint')) {
      const submit = document.createElement('button');
      submit.type = 'button';
      submit.id = 'riskSubmitHint';
      submit.className = 'risk-user-submit-hint';
      submit.textContent = '发现遗漏处罚？点击补充 →';
      submit.addEventListener('click', () => openRiskSubmit({
        code: state.code,
        name: state.name,
        manager: state.manager
      }));
      insertAfter(riskButton, submit);
    }

    if (!$('#riskAdminHint')) {
      const admin = document.createElement('button');
      admin.type = 'button';
      admin.id = 'riskAdminHint';
      admin.className = 'risk-admin-hint';
      admin.textContent = '管理员：风险数据库管理 →';
      admin.addEventListener('click', () => openRiskAdmin({
        code: state.code,
        name: state.name,
        manager: state.manager
      }));
      insertAfter($('#riskSubmitHint') || riskButton, admin);
    }
  }

  function decorateApprovedUserRecords(records) {
    const approved = (records || []).filter((item) => item?.source === 'user' && item?.status === 'approved');
    if (!approved.length) return;

    document.querySelectorAll('.risk-item').forEach((card) => {
      if (card.querySelector('.risk-user-label')) return;
      const title = card.querySelector('h3')?.textContent?.trim() || '';
      const url = card.querySelector('a[href]')?.getAttribute('href') || '';
      const hit = approved.some((item) => item.title === title || (url && item.url === url));
      if (!hit) return;

      const top = card.querySelector('.risk-item-top') || card;
      const label = document.createElement('span');
      label.className = 'risk-user-label';
      label.textContent = '用户补充 · 已核实';
      top.appendChild(label);
    });
  }

  async function decorateRiskRecords(code, name) {
    try {
      const response = await fetch(`/api/risk?code=${encodeURIComponent(code || '')}&name=${encodeURIComponent(name || '')}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) return;
      const data = await response.json();
      decorateApprovedUserRecords(data.records || []);

      const note = $('.risk-note');
      if (note && !note.textContent.includes('用户补充')) {
        note.textContent += ' 部分记录来自用户补充的公开信息，已经过基本校验。';
      }
    } catch (_) {
      // 风险主体页面已经由 app.js 渲染；标签失败不影响风险页面正常使用。
    }
  }

  function injectRiskPage() {
    addRiskPageEntries();
    decorateRiskRecords(state.code, state.name);
  }

  function restoreFund(code, name) {
    showAppChrome();
    if (typeof legacyOpenFund === 'function' && code) legacyOpenFund(code, name);
  }

  function restoreRisk(code, name) {
    showAppChrome();
    if (typeof legacyRiskPage === 'function') legacyRiskPage(code || '', name || '');
  }

  function pageShell(title, subtitle, content) {
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = `
      <section class="risk-submit-page">
        <div class="risk-submit-head">
          <button type="button" class="back" id="riskPageBack">‹ 返回</button>
          <div>
            <h1>${esc(title)}</h1>
            <p>${esc(subtitle)}</p>
          </div>
        </div>
        ${content}
      </section>`;
    hideAppChrome();
  }

  function isOfficialRiskUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (!/^https?:$/.test(url.protocol)) return false;
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      return host === 'csrc.gov.cn' || host.endsWith('.csrc.gov.cn');
    } catch (_) {
      return false;
    }
  }

  async function resolveManager(code, name) {
    if (!code && !name) return '';
    try {
      const response = await fetch(`/api/risk?code=${encodeURIComponent(code || '')}&name=${encodeURIComponent(name || '')}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) return '';
      const data = await response.json();
      return data.manager || '';
    } catch (_) {
      return '';
    }
  }

  function formMarkup(prefix, context, adminMode) {
    const typeOptions = RISK_TYPES.map((type) => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
    return `
      <form id="${prefix}Form" class="risk-clean-form" novalidate>
        <label class="risk-form-field">
          <span>管理人 <b>*</b></span>
          <input id="${prefix}Manager" value="${esc(context.manager)}" required placeholder="请输入基金管理人名称" autocomplete="organization">
        </label>

        <fieldset class="risk-form-field">
          <legend>关联类型 <b>*</b></legend>
          <div class="risk-choice" id="${prefix}Relation">
            <button type="button" class="on" data-value="manager">公司级</button>
            <button type="button" data-value="person">人员级</button>
            <button type="button" data-value="fund">产品级</button>
          </div>
        </fieldset>

        <label class="risk-form-field">
          <span>涉及对象 <b>*</b></span>
          <input id="${prefix}Subject" required placeholder="公司级为管理人；人员级填姓名；产品级填基金名称或代码">
        </label>

        <label class="risk-form-field">
          <span>处罚类型 <b>*</b></span>
          <select id="${prefix}Type" required>
            <option value="">请选择处罚类型</option>
            ${typeOptions}
          </select>
        </label>

        <label class="risk-form-field">
          <span>决定日期 <b>*</b></span>
          <input id="${prefix}Date" type="date" required>
        </label>

        <label class="risk-form-field">
          <span>标题 <b>*</b></span>
          <input id="${prefix}Title" maxlength="200" required placeholder="请输入决定书完整标题">
        </label>

        <label class="risk-form-field">
          <span>原文链接 <b>*</b></span>
          <input id="${prefix}Url" type="url" inputmode="url" autocomplete="url" required placeholder="https://www.csrc.gov.cn/...">
          <small id="${prefix}UrlHint">请粘贴证监会或地方证监局官网的决定书原文链接</small>
        </label>

        <label class="risk-form-field">
          <span>补充说明</span>
          <textarea id="${prefix}Summary" maxlength="200" rows="4" placeholder="选填，最多 200 字"></textarea>
        </label>

        <input type="hidden" id="${prefix}Code" value="${esc(context.code)}">
        <input type="hidden" id="${prefix}Name" value="${esc(context.name)}">
        <div class="risk-submit-error" id="${prefix}Error" aria-live="polite"></div>
        <button class="risk-submit-button" type="submit">${adminMode ? '管理员直接加入风险库' : '提交补充'}</button>
      </form>`;
  }

  function bindRiskForm(prefix, context, adminMode) {
    const form = $(`#${prefix}Form`);
    if (!form) return;

    const manager = $(`#${prefix}Manager`, form);
    const subject = $(`#${prefix}Subject`, form);
    const relation = $(`#${prefix}Relation`, form);
    const type = $(`#${prefix}Type`, form);
    const date = $(`#${prefix}Date`, form);
    const title = $(`#${prefix}Title`, form);
    const url = $(`#${prefix}Url`, form);
    const urlHint = $(`#${prefix}UrlHint`, form);
    const summary = $(`#${prefix}Summary`, form);
    const error = $(`#${prefix}Error`, form);
    const submit = form.querySelector('button[type="submit"]');

    const syncSubject = () => {
      const selected = relation.querySelector('.on')?.dataset.value;
      if (selected === 'manager') {
        subject.value = manager.value.trim();
        subject.readOnly = true;
      } else {
        subject.readOnly = false;
      }
    };

    relation.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        relation.querySelectorAll('button').forEach((item) => item.classList.remove('on'));
        button.classList.add('on');
        syncSubject();
      });
    });

    manager.addEventListener('input', () => {
      if (relation.querySelector('.on')?.dataset.value === 'manager') syncSubject();
    });

    url.addEventListener('input', () => {
      if (!url.value.trim()) {
        urlHint.textContent = '请粘贴证监会或地方证监局官网的决定书原文链接';
        urlHint.className = '';
      } else if (isOfficialRiskUrl(url.value)) {
        urlHint.textContent = '✓ 已通过官网域名校验';
        urlHint.className = 'valid';
      } else {
        urlHint.textContent = '链接必须来自中国证监会或地方证监局官网（csrc.gov.cn）';
        urlHint.className = 'invalid';
      }
    });

    syncSubject();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.className = 'risk-submit-error';
      error.textContent = '';

      const managerValue = manager.value.trim();
      const relationValue = relation.querySelector('.on')?.dataset.value || '';
      const subjectValue = subject.value.trim();
      const typeValue = type.value;
      const dateValue = date.value;
      const titleValue = title.value.trim();
      const urlValue = url.value.trim();
      const summaryValue = summary.value.trim();

      if (!managerValue || !relationValue || !subjectValue || !typeValue || !dateValue || !titleValue || !urlValue) {
        error.textContent = '请完整填写所有必填字段。';
        return;
      }
      if (!isOfficialRiskUrl(urlValue)) {
        error.textContent = '请粘贴证监会或地方证监局官网的决定书原文链接。';
        url.focus();
        return;
      }
      if (summaryValue.length > 200) {
        error.textContent = '补充说明最多 200 字。';
        return;
      }

      submit.disabled = true;
      submit.textContent = '提交中……';

      const body = {
        manager: managerValue,
        relation: relationValue,
        subject: subjectValue,
        type: typeValue,
        date: dateValue,
        title: titleValue,
        url: urlValue,
        summary: summaryValue,
        code: $(`#${prefix}Code`, form)?.value || context.code,
        name: $(`#${prefix}Name`, form)?.value || context.name
      };

      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const endpoint = adminMode ? '/api/risk/admin-add' : '/api/risk/submit';
      if (adminMode) headers['X-Admin-Password'] = sessionStorage.getItem(ADMIN_SESSION_KEY) || '';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || data.message || '提交失败，请稍后再试');

        if (adminMode) {
          error.className = 'risk-submit-success-text';
          error.textContent = '已直接加入正式风险库。';
          submit.disabled = false;
          submit.textContent = '管理员直接加入风险库';
          return;
        }

        const main = document.getElementById('main');
        main.innerHTML = `
          <section class="risk-submit-success">
            <div class="success-icon" aria-hidden="true">✓</div>
            <h1>提交成功</h1>
            <p>已提交，等待审核。感谢您的贡献！</p>
            <button class="risk-submit-button" id="riskSuccessBack" type="button">返回风险页</button>
          </section>`;
        $('#riskSuccessBack')?.addEventListener('click', () => restoreRisk(context.code, context.name));
      } catch (err) {
        error.className = 'risk-submit-error';
        error.textContent = err?.message || '提交失败，请稍后再试。';
        submit.disabled = false;
        submit.textContent = adminMode ? '管理员直接加入风险库' : '提交补充';
      }
    });
  }

  function openRiskSubmit(options = {}) {
    rememberContext(options.code, options.name, options.manager);
    const context = { ...state };

    pageShell(
      '补充公开风险记录',
      '仅接受中国证监会及各地方证监局官网公开的决定书链接',
      formMarkup('rs', context, false)
    );

    bindRiskForm('rs', context, false);

    if (!context.manager && context.code) {
      resolveManager(context.code, context.name).then((manager) => {
        if (!manager || !$('#rsManager')) return;
        $('#rsManager').value = manager;
        window.__riskManager = manager;
        if ($('#rsRelation .on')?.dataset.value === 'manager') $('#rsSubject').value = manager;
      });
    }

    $('#riskPageBack')?.addEventListener('click', () => {
      if (options.fromRisk) restoreRisk(context.code, context.name);
      else restoreFund(context.code, context.name);
    });
  }

  function openRiskAdmin(options = {}) {
    rememberContext(options.code, options.name, options.manager);
    const context = { ...state };

    pageShell(
      '管理员风险数据库',
      '管理员可直接录入风险，或审核用户提交记录',
      `<div class="risk-admin-login">
        <label class="risk-form-field">
          <span>管理员密码 <b>*</b></span>
          <input id="adminPassword" type="password" autocomplete="current-password" placeholder="请输入管理员密码">
        </label>
        <button class="risk-submit-button" id="adminLogin" type="button">进入管理</button>
        <div class="risk-submit-error" id="adminLoginError" aria-live="polite"></div>
      </div>`
    );

    const login = $('#adminLogin');
    const passwordInput = $('#adminPassword');
    const loginError = $('#adminLoginError');

    const doLogin = async () => {
      const password = passwordInput.value;
      loginError.textContent = '';
      if (!password) {
        loginError.textContent = '请输入管理员密码';
        return;
      }
      login.disabled = true;
      login.textContent = '验证中……';
      try {
        const response = await fetch('/api/risk/pending', {
          headers: { Accept: 'application/json', 'X-Admin-Password': password },
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || '管理员验证失败');
        sessionStorage.setItem(ADMIN_SESSION_KEY, password);
        renderAdminPanel(context, data.records || [], options.fromRisk);
      } catch (err) {
        loginError.textContent = err?.message || '管理员验证失败';
        login.disabled = false;
        login.textContent = '进入管理';
      }
    };

    login?.addEventListener('click', doLogin);
    passwordInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') doLogin();
    });
    $('#riskPageBack')?.addEventListener('click', () => {
      if (options.fromRisk) restoreRisk(context.code, context.name);
      else restoreFund(context.code, context.name);
    });
  }

  function renderAdminPanel(context, pending, fromRisk) {
    pageShell(
      '风险数据库管理',
      '管理员已验证，可以直接录入、审核或删除记录',
      `<div class="risk-admin-section">
        <h2>管理员直接录入</h2>
        ${formMarkup('adm', context, true)}
      </div>
      <div class="risk-admin-section">
        <h2>待审核记录 <span id="pendingCount">${pending.length}</span></h2>
        <div id="pendingList"></div>
      </div>`
    );

    bindRiskForm('adm', context, true);
    renderPending(pending);
    $('#riskPageBack')?.addEventListener('click', () => {
      if (fromRisk) restoreRisk(context.code, context.name);
      else restoreFund(context.code, context.name);
    });
  }

  function renderPending(records) {
    const host = $('#pendingList');
    if (!host) return;
    if (!records.length) {
      host.innerHTML = '<p class="risk-admin-empty">暂无待审核记录</p>';
      return;
    }

    host.innerHTML = records.map((record) => `
      <article class="risk-pending-item" data-id="${esc(record.id)}">
        <h3>${esc(record.title)}</h3>
        <div>${esc(record.date)} · ${esc(record.type)} · ${esc(record.manager)}</div>
        <p>对象：${esc(record.subject)}</p>
        ${record.summary ? `<p>说明：${esc(record.summary)}</p>` : ''}
        <a href="${esc(record.url)}" target="_blank" rel="noopener noreferrer">查看原文</a>
        <div class="risk-pending-actions">
          <button type="button" data-action="approve" data-id="${esc(record.id)}">✓ 确认加入</button>
          <button type="button" data-action="reject" data-id="${esc(record.id)}">删除</button>
        </div>
      </article>`).join('');

    host.querySelectorAll('.risk-pending-actions button').forEach((button) => {
      button.addEventListener('click', () => processPending(button.dataset.id, button.dataset.action, button));
    });
  }

  async function processPending(id, action, button) {
    if (!id || !action || !button) return;
    const password = sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
    if (!password) {
      alert('管理员登录状态已失效，请重新登录。');
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = action === 'approve' ? '处理中……' : '删除中……';

    try {
      const response = await fetch('/api/risk/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Admin-Password': password
        },
        body: JSON.stringify({ id, action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || data.message || '操作失败');

      button.closest('.risk-pending-item')?.remove();
      const remaining = document.querySelectorAll('.risk-pending-item').length;
      if ($('#pendingCount')) $('#pendingCount').textContent = String(remaining);
      if (!remaining && $('#pendingList')) $('#pendingList').innerHTML = '<p class="risk-admin-empty">暂无待审核记录</p>';
    } catch (err) {
      alert(err?.message || '操作失败');
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // 包装原页面函数：不改变原有基金/风险页逻辑，只在渲染完成后注入稳定入口。
  if (typeof legacyRiskPage === 'function') {
    window.riskPage = function(code, name) {
      rememberContext(code, name);
      legacyRiskPage(code, name);
      // riskPage 内部有异步数据渲染，因此多次尝试，但每个元素都有 ID 防重复。
      [0, 80, 250, 600].forEach((delay) => setTimeout(injectRiskPage, delay));
    };
  }

  if (typeof legacyOpenFund === 'function') {
    window.openFund = function(code, name) {
      rememberContext(code, name);
      legacyOpenFund(code, name);
      [0, 80, 250, 600].forEach((delay) => setTimeout(() => addFundPageEntries(code, name, state.manager), delay));
    };
  }

  window.openRiskSubmit = openRiskSubmit;
  window.openRiskAdmin = openRiskAdmin;
})();
