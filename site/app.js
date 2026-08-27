const main = document.getElementById('main');
const searchTab = document.getElementById('searchTab');
const favTab = document.getElementById('favTab');
const favKey = 'fundFavV8';
const riskCacheKey = 'fundRiskV143';
let fav = JSON.parse(localStorage.getItem(favKey) || '[]');
let timer = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[x]));
const save = () => localStorage.setItem(favKey, JSON.stringify(fav));

function jsonp(url, cb, timeout = 10000) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    const t = setTimeout(() => { cleanup(); no(new Error('请求超时')); }, timeout);
    const cleanup = () => {
      clearTimeout(t);
      s.remove();
      try { delete window[cb]; } catch {}
    };
    window[cb] = d => { cleanup(); ok(d); };
    s.onerror = () => { cleanup(); no(new Error('数据源暂时无法访问')); };
    s.src = url;
    s.async = true;
    document.head.appendChild(s);
  });
}

async function searchApi(q) {
  const cb = 'fundSearch_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return jsonp(
    'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=' +
    encodeURIComponent(q) + '&callback=' + cb,
    cb
  );
}

function sourceUrls(code) {
  return {
    holdings: 'https://fundf10.eastmoney.com/ccmx_' + encodeURIComponent(code) + '.html',
    reports: 'https://fundf10.eastmoney.com/jjgg_' + encodeURIComponent(code) + '_3.html',
    source: 'https://fundf10.eastmoney.com/',
    csrc: 'https://www.csrc.gov.cn/'
  };
}

function openSource(url, title = '来源页面', direct = false) {
  if (direct) {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) location.href = url;
    return;
  }

  const previous = main.innerHTML;
  const previousScroll = window.scrollY;
  main.innerHTML = `
    <section class="inline-source">
      <div class="inline-source-head">
        <button class="source-back" id="sourceBack">‹ 返回基金</button>
        <strong>${esc(title)}</strong>
        <button class="source-refresh" id="sourceReload">↻</button>
      </div>
      <div class="inline-source-viewport">
        <div class="inline-source-scale">
          <iframe id="sourceFrame" src="${esc(url)}" title="${esc(title)}" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
      </div>
    </section>`;

  document.querySelector('.topbar').style.display = 'none';
  document.querySelector('.tabbar').style.display = 'none';
  const viewport = document.querySelector('.inline-source-viewport');
  const box = document.querySelector('.inline-source-scale');
  const frame = document.getElementById('sourceFrame');
  const fit = () => {
    const w = Math.max(320, viewport.clientWidth);
    const h = viewport.clientHeight;
    const scale = Math.min(1, w / 1000);
    box.style.width = '1000px';
    box.style.transform = 'scale(' + scale + ')';
    box.style.transformOrigin = 'top left';
    box.style.height = h / scale + 'px';
    frame.style.width = '1000px';
    frame.style.height = h / scale + 'px';
  };
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);

  document.getElementById('sourceBack').onclick = () => {
    window.removeEventListener('resize', fit);
    main.innerHTML = previous;
    document.querySelector('.topbar').style.display = '';
    document.querySelector('.tabbar').style.display = '';
    window.scrollTo(0, previousScroll);
    bindFundEvents();
  };
  document.getElementById('sourceReload').onclick = () => { frame.src = url; };
}

function bindSearchEvents() {
  const q = document.getElementById('q');
  const r = document.getElementById('r');
  if (!q || !r) return;
  q.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(q.value.trim()), 300);
  };
  [...r.querySelectorAll('.card')].forEach(b => {
    b.onclick = () => openFund(b.dataset.code, b.dataset.name);
  });
}

function searchPage(preserve = true) {
  searchTab.classList.add('active');
  favTab.classList.remove('active');
  const oldQ = preserve ? (document.getElementById('q')?.value || '') : '';
  const oldR = preserve ? (document.getElementById('r')?.innerHTML || '') : '';
  main.innerHTML = `
    <section class="hero"><h1>查基金季报</h1><p>输入基金名称或 6 位基金代码</p></section>
    <div class="searchbox"><span>⌕</span><input id="q" autocomplete="off" placeholder="例如：024239 或 华夏全球科技"></div>
    <div class="hint">基金资料由来源网站提供。风险信息自动检索中国证监会公开记录。</div>
    <div id="r" class="results"></div>`;
  const q = document.getElementById('q');
  const r = document.getElementById('r');
  q.value = oldQ;
  r.innerHTML = oldR;
  bindSearchEvents();
  q.focus();
  try { q.setSelectionRange(q.value.length, q.value.length); } catch {}
}

async function doSearch(q) {
  const r = document.getElementById('r');
  if (!r) return;
  if (!q) { r.innerHTML = ''; return; }
  r.innerHTML = '<div class="loading">正在搜索……</div>';
  try {
    const d = await searchApi(q);
    const a = (d.Datas || []).filter(x => x.CODE);
    r.innerHTML = a.slice(0, 15).map(x => `
      <button class="card" data-code="${esc(x.CODE)}" data-name="${esc(x.NAME)}">
        <div class="card-main"><div class="name">${esc(x.NAME)}</div><div class="meta">${esc(x.CODE)} · ${esc(x.CATEGORYDESC || x.TYPE || '基金')}</div></div>
        <div class="chev">›</div>
      </button>`).join('') || '<div class="empty">没有找到基金</div>';
    bindSearchEvents();
  } catch (e) {
    r.innerHTML = '<div class="error">搜索接口暂时无法访问，请稍后再试。</div>';
  }
}

function favPage() {
  searchTab.classList.remove('active');
  favTab.classList.add('active');
  main.innerHTML = `<section class="hero"><h1>我的自选</h1><p>自选保存在这台设备上</p></section>` +
    (fav.length ? fav.map(x => `
      <button class="card" data-code="${esc(x.code)}" data-name="${esc(x.name)}">
        <div class="card-main"><div class="name">${esc(x.name)}</div><div class="meta">${esc(x.code)}</div></div>
        <div class="chev">›</div>
      </button>`).join('') : '<div class="empty">还没有自选基金<br><small>搜索基金后进入基金详情即可加入自选</small></div>');
  [...main.querySelectorAll('.card')].forEach(b => b.onclick = () => openFund(b.dataset.code, b.dataset.name));
}

function riskCacheId(code) {
  return riskCacheKey + '_' + String(code).replace(/\D/g, '').slice(0, 6);
}
function readRiskCache(code) {
  try {
    const x = JSON.parse(localStorage.getItem(riskCacheId(code)) || 'null');
    return x && x.data ? x : null;
  } catch { return null; }
}
function writeRiskCache(code, data) {
  try { localStorage.setItem(riskCacheId(code), JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

async function fetchRiskApi(code, name, force = false) {
  const u = '/api/risk?code=' + encodeURIComponent(code) + '&name=' + encodeURIComponent(name) + (force ? '&force=1' : '');
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) {
    let msg = '风险接口 HTTP ' + r.status;
    try { const e = await r.json(); if (e.error) msg = e.error; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

function riskClass(type) {
  return /行政处罚|市场禁入|刑事|犯罪|罚款|没收/.test(type || '') ? '重大风险' : '潜在风险';
}

function statusMessage(data) {
  if (data?.status === 'no_data') return '暂未检索到公开监管记录，不代表没有风险';
  if (data?.status === 'failed') return '公开监管数据检索失败，当前结果不能用于判断“无风险”';
  if (data?.status === 'partial') return '部分公开监管数据源更新失败，以下仅展示目前已获得的数据';
  return '';
}

function supplementPage({ code = '', name = '', manager = '', fromRisk = false } = {}) {
  const previous = main.innerHTML;
  const safeManager = manager || '';
  main.innerHTML = `
    <section class="supplement-page">
      <div class="backrow"><button class="back" id="supplementBack">‹ 返回</button></div>
      <div class="section-title">补充公开风险记录</div>
      <p class="source-tip">仅接受中国证监会及各地方证监局官网公开的决定书链接</p>
      <form id="riskSupplementForm" class="supplement-form" novalidate>
        <label class="form-card"><span>管理人 <b>*</b></span><input id="suppManager" name="manager" value="${esc(safeManager)}" placeholder="请输入基金管理人名称" required></label>
        <div class="form-card"><span>关联类型 <b>*</b></span>
          <div class="choice-group">
            <label><input type="radio" name="relation" value="manager" checked> 公司级 <small>管理人本身被处罚</small></label>
            <label><input type="radio" name="relation" value="person"> 人员级 <small>基金经理/相关人员被处罚</small></label>
            <label><input type="radio" name="relation" value="fund"> 产品级 <small>明确涉及某只基金产品</small></label>
          </div>
        </div>
        <label class="form-card"><span>涉及对象 <b>*</b></span><input id="suppSubject" name="subject" value="${esc(safeManager)}" placeholder="公司级自动填管理人；人员级填姓名；产品级填基金名称/代码" required></label>
        <label class="form-card"><span>处罚类型 <b>*</b></span>
          <select id="suppType" name="type" required>
            <option value="">请选择处罚类型</option><option>行政处罚</option><option>警示函</option><option>监管措施</option><option>市场禁入</option><option>纪律处分</option><option>其他</option>
          </select>
        </label>
        <label class="form-card"><span>决定日期 <b>*</b></span><input id="suppDate" name="date" type="date" required></label>
        <label class="form-card"><span>标题 <b>*</b></span><input id="suppTitle" name="title" maxlength="200" placeholder="请输入决定书完整标题" required></label>
        <label class="form-card"><span>原文链接 <b>*</b></span><input id="suppUrl" name="url" type="url" inputmode="url" placeholder="https://www.csrc.gov.cn/..." required><small id="suppUrlHint">请粘贴证监会或地方证监局官网的决定书原文链接</small></label>
        <label class="form-card"><span>补充说明</span><textarea id="suppSummary" name="summary" maxlength="200" rows="4" placeholder="可补充处罚对象、处罚内容等信息，最多 200 字"></textarea></label>
        <input type="hidden" name="code" value="${esc(code)}">
        <input type="hidden" name="name" value="${esc(name)}">
        <div id="suppMessage" class="form-message" aria-live="polite"></div>
        <button class="source-button supplement-submit" id="suppSubmit" type="submit">提交补充</button>
      </form>
    </section>`;

  const form = document.getElementById('riskSupplementForm');
  const relationInputs = [...form.querySelectorAll('input[name="relation"]')];
  const subject = document.getElementById('suppSubject');
  const managerInput = document.getElementById('suppManager');
  const urlInput = document.getElementById('suppUrl');
  const urlHint = document.getElementById('suppUrlHint');
  const message = document.getElementById('suppMessage');
  const submit = document.getElementById('suppSubmit');

  const allowedOfficialUrl = value => {
    try {
      const u = new URL(value.trim());
      if (!/^https?:$/.test(u.protocol)) return false;
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'csrc.gov.cn' || host.endsWith('.csrc.gov.cn')) return true;
      return /(^|\.)(beijing|shanghai|guangdong|shenzhen|zhejiang|jiangsu|shandong)\.csrc\.gov\.cn$/.test(host);
    } catch { return false; }
  };

  const syncRelation = () => {
    const relation = form.querySelector('input[name="relation"]:checked')?.value;
    if (relation === 'manager') {
      subject.value = managerInput.value.trim();
      subject.readOnly = true;
    } else {
      subject.readOnly = false;
      if (subject.value === managerInput.value.trim() && relation === 'person') subject.value = '';
    }
  };
  relationInputs.forEach(x => x.onchange = syncRelation);
  managerInput.oninput = () => {
    if (form.querySelector('input[name="relation"]:checked')?.value === 'manager') subject.value = managerInput.value;
  };
  urlInput.oninput = () => {
    if (!urlInput.value.trim()) {
      urlHint.textContent = '请粘贴证监会或地方证监局官网的决定书原文链接';
      urlHint.className = '';
    } else if (allowedOfficialUrl(urlInput.value)) {
      urlHint.textContent = '✓ 已通过官网域名校验';
      urlHint.className = 'valid';
    } else {
      urlHint.textContent = '链接必须来自中国证监会或地方证监局官网（csrc.gov.cn）';
      urlHint.className = 'invalid';
    }
  };

  document.getElementById('supplementBack').onclick = () => {
    if (fromRisk && code && name) riskPage(code, name);
    else if (previous && previous.includes('fund-head')) { main.innerHTML = previous; bindFundEvents(); }
    else searchPage(true);
  };

  // 从基金详情进入时，先用风险接口补全管理人；接口失败不影响手工填写。
  if (!manager && code && name) {
    fetchRiskApi(code, name, false).then(d => {
      if (d?.manager && !managerInput.value) {
        managerInput.value = d.manager;
        syncRelation();
      }
    }).catch(() => {});
  }

  form.onsubmit = async e => {
    e.preventDefault();
    message.className = 'form-message';
    message.textContent = '';
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.manager = payload.manager.trim();
    payload.subject = payload.subject.trim();
    payload.title = payload.title.trim();
    payload.url = payload.url.trim();
    payload.summary = String(payload.summary || '').trim().slice(0, 200);

    if (!payload.manager || !payload.relation || !payload.subject || !payload.type || !payload.date || !payload.title || !payload.url) {
      message.className = 'form-message error';
      message.textContent = '请完整填写所有必填字段。';
      return;
    }
    if (!allowedOfficialUrl(payload.url)) {
      message.className = 'form-message error';
      message.textContent = '原文链接无效：请粘贴中国证监会或地方证监局官网的决定书原文链接。';
      urlInput.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = '提交中……';
    try {
      const r = await fetch('/api/risk/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      let d = {};
      try { d = await r.json(); } catch {}
      if (!r.ok || !d.ok) throw new Error(d.message || d.error || '提交失败，请稍后再试');
      message.className = 'form-message success';
      message.textContent = '已提交，等待审核。感谢您的贡献！';
      submit.textContent = '提交成功';
      setTimeout(() => {
        if (code && name) riskPage(code, name);
        else searchPage(true);
      }, 1200);
    } catch (err) {
      message.className = 'form-message error';
      message.textContent = err.message || '提交失败，请稍后再试。';
      submit.disabled = false;
      submit.textContent = '提交补充';
    }
  };

  syncRelation();
}

function riskPage(code, name) {
  const u = sourceUrls(code);
  let data = { manager: '', records: [] };
  let filter = '全部';
  let loading = false;

  main.innerHTML = `
    <div class="risk-head"><button class="back" id="riskBack">‹ 返回基金</button><div><div class="risk-title">历史风险</div><div class="risk-sub">自动监管风险数据库</div></div><button class="risk-refresh" id="riskRefresh">↻</button></div>
    <div class="risk-summary" id="riskSummary"><div class="risk-loading">正在自动检索证监会公开记录……</div></div>
    <div class="risk-filter" id="riskFilter"><button class="on" data-risk="全部">全部 <i>0</i></button><button data-risk="重大风险">重大风险 <i>0</i></button><button data-risk="潜在风险">潜在风险 <i>0</i></button></div>
    <div id="riskList" class="risk-list"></div>
    <button class="risk-supplement-card" id="riskSupplementBtn"><div><strong>补充公开风险记录</strong><p>发现遗漏的证监会/证监局公开处罚？可提交原文链接补充</p></div><span>›</span></button>
    <div class="risk-note">风险记录根据基金管理人、基金名称及可识别的基金经理信息，自动检索中国证监会公开信息。管理人或基金经理被监管，不等于本基金产品本身违法。风险评分仅用于信息整理，不构成投资或法律结论。部分记录来自用户补充的公开信息，已经过基本校验。</div>`;

  function renderSummary(fromCache = false, refreshing = false) {
    const sum = document.getElementById('riskSummary');
    const records = data.records || [];
    const score = data.riskScore?.score;
    let scoreClass = 'risk-score-low';
    if (score !== null && score !== undefined) scoreClass = score < 50 ? 'risk-score-high' : score < 75 ? 'risk-score-medium' : 'risk-score-low';
    const status = data.status || '';
    const statusText = statusMessage(data);
    sum.innerHTML = `
      <div class="risk-manager"><span>基金</span><b>${esc(name)}</b><em>${esc(code)}</em></div>
      <div class="risk-manager"><span>管理人</span><b>${esc(data.manager || '自动识别失败')}</b></div>
      ${data.managers?.length ? '<div class="risk-manager"><span>基金经理</span><b>' + esc(data.managers.join('、')) + '</b></div>' : ''}
      <div class="risk-score-box"><div class="risk-score-main"><strong class="${scoreClass}">${score == null ? '--' : score}</strong><span>风险指数</span></div><div class="risk-score-text"><b>${esc(data.riskScore?.level || (status === 'no_data' ? '数据不足' : '未评估'))}</b><small>${score == null ? '暂无足够数据，不代表没有风险' : '历史监管记录整理指数'}</small></div></div>
      <div class="risk-stats"><div><strong>${records.length}</strong><small>关联记录</small></div><div><strong>${data.counts?.['行政处罚'] || 0}</strong><small>行政处罚</small></div><div><strong>${data.counts?.['警示函'] || 0}</strong><small>警示函</small></div><div><strong>${data.counts?.['监管措施'] || 0}</strong><small>监管措施</small></div></div>
      ${data.latest ? '<div class="risk-latest"><span>最近一次监管记录</span><b>' + esc(data.latest.date || '') + '</b><p>' + esc(data.latest.title || '') + '</p></div>' : ''}
      ${statusText ? '<div class="risk-status-warning">' + esc(statusText) + '</div>' : ''}
      <div class="risk-status-line">${refreshing ? '↻ 正在检查最新记录……' : fromCache ? '✓ 已从本机缓存快速加载' : data.cached ? '✓ Cloudflare 缓存结果' : '✓ 刚刚完成公开信息检索'}</div>`;
  }

  function render() {
    const list = document.getElementById('riskList');
    const all = data.records || [];
    const arr = all.filter(x => filter === '全部' || riskClass(x.type) === filter);
    const box = document.getElementById('riskFilter');
    box.querySelector('[data-risk="全部"] i').textContent = all.length;
    box.querySelector('[data-risk="重大风险"] i').textContent = all.filter(x => riskClass(x.type) === '重大风险').length;
    box.querySelector('[data-risk="潜在风险"] i').textContent = all.filter(x => riskClass(x.type) === '潜在风险').length;

    if (!arr.length) {
      const status = data.status;
      let title = filter === '全部' ? '未检索到匹配的公开监管记录' : '该分类暂无记录';
      let hint = '暂无可展示的风险记录。';
      if (status === 'no_data') hint = '暂未检索到公开监管记录，不代表没有风险。';
      if (status === 'failed') hint = '风险数据源检索失败，不能据此判断没有风险。';
      if (status === 'partial') hint = '部分数据源未成功更新，当前结果可能不完整。';
      list.innerHTML = `<div class="risk-empty"><strong>${title}</strong><br><small>${hint}</small></div>`;
      return;
    }

    list.innerHTML = arr.map(x => `
      <article class="risk-item">
        <div class="risk-item-top"><span class="risk-tag ${/行政处罚|市场禁入/.test(x.type || '') ? 'danger' : /警示函|监管措施/.test(x.type || '') ? 'warning' : ''}">${esc(x.type || '其他')}</span><time>${esc(x.date || '日期未识别')}</time></div>
        <h3>${esc(x.title || '证监会公开监管记录')}</h3>
        <p><b>涉及对象：</b>${esc(x.subject || data.manager || '未标明')}</p>
        ${x.summary ? '<p>' + esc(x.summary) + '</p>' : ''}
        ${(x.result || x.measure) ? '<p><b>处理结果：</b>' + esc(x.result || x.measure) + '</p>' : ''}
        ${x.source === 'user' && x.status === 'approved' ? '<div class="user-risk-badge">用户补充 · 已核实</div>' : ''}
        <button data-url="${esc(x.url || u.csrc)}" class="risk-detail">信息来源 ↗</button>
      </article>`).join('');
    [...list.querySelectorAll('.risk-detail')].forEach(b => b.onclick = () => openSource(b.dataset.url, '信息来源', true));
  }

  async function refresh(showLoading = true, force = false) {
    if (loading) return;
    loading = true;
    if (showLoading) document.getElementById('riskSummary').innerHTML = '<div class="risk-loading">正在检索证监会公开记录……<small>按当前基金、管理人和基金经理分别检索</small></div>';
    try {
      data = await fetchRiskApi(code, name, force);
      writeRiskCache(code, data);
      renderSummary(false, false);
      render();
    } catch (e) {
      if (data.records?.length) {
        renderSummary(true, false);
        render();
        document.getElementById('riskSummary').insertAdjacentHTML('beforeend', '<div class="risk-refresh-error">最新数据更新失败，当前显示的是上次缓存结果。</div>');
      } else {
        data = { ...data, status: 'failed', riskScore: { score: null, level: '数据不足', reason: '公开监管数据检索失败，不能据此判断没有风险' } };
        document.getElementById('riskSummary').innerHTML = `<div class="risk-error"><b>风险检索失败</b><br><small>公开监管数据暂时无法获取，不能据此判断“无风险”。</small><br><button id="riskRetry" class="source-button">重新检索</button></div>`;
        document.getElementById('riskRetry').onclick = () => refresh(true, true);
      }
    } finally { loading = false; }
  }

  const cached = readRiskCache(code);
  if (cached?.data) {
    data = cached.data;
    renderSummary(true, true);
    render();
    refresh(false, false);
  } else {
    refresh(true, false);
  }

  document.getElementById('riskBack').onclick = () => openFund(code, name);
  document.getElementById('riskRefresh').onclick = () => refresh(true, true);
  document.getElementById('riskSupplementBtn').onclick = () => supplementPage({ code, name, manager: data.manager || '', fromRisk: true });
  [...document.querySelectorAll('#riskFilter button')].forEach(b => b.onclick = () => {
    filter = b.dataset.risk;
    document.querySelectorAll('#riskFilter button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    render();
  });
}

function openFund(code, name) {
  const is = fav.some(x => x.code === code);
  const u = sourceUrls(code);
  main.innerHTML = `
    <div class="fund-head"><div class="backrow"><button class="back" id="back">‹ 返回</button></div><div class="fund-name">${esc(name)}</div><div class="code">${esc(code)}</div><button class="fav-button ${is ? 'saved' : ''}" id="star"><span>${is ? '★' : '☆'}</span><b>${is ? '已加入自选' : '加入自选'}</b></button></div>
    <div class="section-title">重要持仓</div><div class="source-card"><div><strong>前十大重仓</strong><p>进入东方财富基金档案的持仓披露页面，并在当前 App 页面内查看。</p></div><button class="source-button" id="holdBtn">查看持仓 ↗</button></div>
    <div class="section-title">历史定期报告</div><div class="source-card"><div><strong>基金定期报告</strong><p>进入该基金公告的「定期报告」栏目。</p></div><button class="source-button" id="reportBtn">查看季报 ↗</button></div>
    <div class="section-title">历史风险</div><button class="risk-entry" id="riskBtn"><div><strong>自动风险数据库</strong><p>当前基金 + 管理人 + 基金经理分别关联证监会公开记录。</p></div><span>›</span></button>
    <button class="risk-supplement-link" id="fundSupplementBtn">发现遗漏处罚？点击补充 →</button>
    <div class="source-tip">风险数据会优先显示缓存，同时后台检查最新记录；检索失败不会显示成“0条记录”。</div>
    <div class="source">信息来源：<button class="plain-link" id="sourceLink">东方财富基金数据 ↗</button></div>`;
  bindFundEvents();
}

function bindFundEvents() {
  const back = document.getElementById('back');
  if (back) back.onclick = () => searchPage(true);

  const star = document.getElementById('star');
  if (star) star.onclick = () => {
    const code = document.querySelector('.code')?.textContent.trim() || '';
    const name = document.querySelector('.fund-name')?.textContent.trim() || '';
    const i = fav.findIndex(x => x.code === code);
    if (i >= 0) fav.splice(i, 1); else fav.unshift({ code, name });
    save();
    const active = fav.some(x => x.code === code);
    star.classList.toggle('saved', active);
    star.querySelector('span').textContent = active ? '★' : '☆';
    star.querySelector('b').textContent = active ? '已加入自选' : '加入自选';
  };

  const code = document.querySelector('.code')?.textContent.trim();
  if (!code) return;
  const name = document.querySelector('.fund-name')?.textContent.trim() || '';
  const u = sourceUrls(code);
  const hold = document.getElementById('holdBtn');
  if (hold) hold.onclick = () => openSource(u.holdings, '基金持仓');
  const report = document.getElementById('reportBtn');
  if (report) report.onclick = () => openSource(u.reports, '定期报告');
  const source = document.getElementById('sourceLink');
  if (source) source.onclick = () => openSource(u.source, '信息来源');
  const risk = document.getElementById('riskBtn');
  if (risk) risk.onclick = () => riskPage(code, name);
  const supplement = document.getElementById('fundSupplementBtn');
  if (supplement) supplement.onclick = () => supplementPage({ code, name, manager: '' });
}

searchTab.onclick = () => searchPage(true);
favTab.onclick = favPage;
searchPage(false);
