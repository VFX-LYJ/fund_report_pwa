const main = document.getElementById('main');
const searchTab = document.getElementById('searchTab');
const favTab = document.getElementById('favTab');

const favKey = 'fundFavV8';
const riskCacheKey = 'fundRiskV14';

let fav = JSON.parse(
  localStorage.getItem(favKey) || '[]'
);

let timer = null;

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    x => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[x])
  );

function save() {
  localStorage.setItem(
    favKey,
    JSON.stringify(fav)
  );
}

function jsonp(
  url,
  cb,
  timeout = 10000
) {
  return new Promise((ok, no) => {
    const s =
      document.createElement('script');

    const t = setTimeout(() => {
      cleanup();
      no(new Error('请求超时'));
    }, timeout);

    function cleanup() {
      clearTimeout(t);
      s.remove();

      try {
        delete window[cb];
      } catch {}
    }

    window[cb] = d => {
      cleanup();
      ok(d);
    };

    s.onerror = () => {
      cleanup();
      no(
        new Error(
          '数据源暂时无法访问'
        )
      );
    };

    s.src = url;
    s.async = true;

    document.head.appendChild(s);
  });
}

async function searchApi(q) {
  const cb =
    'fundSearch_' +
    Date.now();

  return jsonp(
    'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=' +
      encodeURIComponent(q) +
      '&callback=' +
      cb,
    cb
  );
}

function sourceUrls(code) {
  return {
    holdings:
      'https://fundf10.eastmoney.com/ccmx_' +
      encodeURIComponent(code) +
      '.html',

    reports:
      'https://fundf10.eastmoney.com/jjgg_' +
      encodeURIComponent(code) +
      '_3.html',

    source:
      'https://fundf10.eastmoney.com/',

    csrc:
      'https://www.csrc.gov.cn/'
  };
}

/* =========================
   来源页面
========================= */

function openSource(
  url,
  title = '来源页面'
) {
  const previous =
    main.innerHTML;

  const previousScroll =
    window.scrollY;

  main.innerHTML =
    '<section class="inline-source">' +
      '<div class="inline-source-head">' +
        '<button class="source-back" id="sourceBack">‹ 返回基金</button>' +
        '<strong>' +
          esc(title) +
        '</strong>' +
        '<button class="source-refresh" id="sourceReload">↻</button>' +
      '</div>' +

      '<div class="inline-source-viewport">' +
        '<div class="inline-source-scale">' +
          '<iframe id="sourceFrame" src="' +
            esc(url) +
            '" title="' +
            esc(title) +
            '" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
        '</div>' +
      '</div>' +

    '</section>';

  document.querySelector(
    '.topbar'
  ).style.display = 'none';

  document.querySelector(
    '.tabbar'
  ).style.display = 'none';

  const viewport =
    document.querySelector(
      '.inline-source-viewport'
    );

  const box =
    document.querySelector(
      '.inline-source-scale'
    );

  const frame =
    document.getElementById(
      'sourceFrame'
    );

  const BASE = 1000;

  function fit() {
    const w =
      Math.max(
        320,
        viewport.clientWidth
      );

    const h =
      viewport.clientHeight;

    const scale =
      Math.min(
        1,
        w / BASE
      );

    box.style.width =
      BASE + 'px';

    box.style.transform =
      'scale(' +
      scale +
      ')';

    box.style.transformOrigin =
      'top left';

    box.style.height =
      h / scale +
      'px';

    frame.style.width =
      BASE + 'px';

    frame.style.height =
      h / scale +
      'px';
  }

  requestAnimationFrame(fit);

  window.addEventListener(
    'resize',
    fit
  );

  document.getElementById(
    'sourceBack'
  ).onclick = () => {
    window.removeEventListener(
      'resize',
      fit
    );

    main.innerHTML =
      previous;

    document.querySelector(
      '.topbar'
    ).style.display = '';

    document.querySelector(
      '.tabbar'
    ).style.display = '';

    window.scrollTo(
      0,
      previousScroll
    );

    bindFundEvents();
  };

  document.getElementById(
    'sourceReload'
  ).onclick = () => {
    frame.src = url;
  };
}

/* =========================
   搜索
========================= */

function searchPage() {
  searchTab.classList.add(
    'active'
  );

  favTab.classList.remove(
    'active'
  );

  main.innerHTML =
    '<section class="hero">' +
      '<h1>查基金季报</h1>' +
      '<p>输入基金名称或 6 位基金代码</p>' +
    '</section>' +

    '<div class="searchbox">' +
      '<span>⌕</span>' +
      '<input id="q" autocomplete="off" placeholder="例如：024239 或 华夏全球科技">' +
    '</div>' +

    '<div class="hint">' +
      '基金资料由来源网站提供。风险信息自动检索中国证监会公开记录。' +
    '</div>' +

    '<div id="r" class="results"></div>';

  const q =
    document.getElementById('q');

  q.oninput = () => {
    clearTimeout(timer);

    timer = setTimeout(
      () =>
        doSearch(
          q.value.trim()
        ),
      300
    );
  };

  q.focus();
}

async function doSearch(q) {
  const r =
    document.getElementById('r');

  if (!q) {
    r.innerHTML = '';
    return;
  }

  r.innerHTML =
    '<div class="loading">正在搜索……</div>';

  try {
    const d =
      await searchApi(q);

    const a =
      (d.Datas || [])
        .filter(x => x.CODE);

    r.innerHTML =
      a.slice(0, 15)
        .map(
          x =>
            '<button class="card" data-code="' +
            esc(x.CODE) +
            '" data-name="' +
            esc(x.NAME) +
            '">' +

              '<div class="card-main">' +
                '<div class="name">' +
                  esc(x.NAME) +
                '</div>' +

                '<div class="meta">' +
                  esc(x.CODE) +
                  ' · ' +
                  esc(
                    x.CATEGORYDESC ||
                    x.TYPE ||
                    '基金'
                  ) +
                '</div>' +
              '</div>' +

              '<div class="chev">›</div>' +

            '</button>'
        )
        .join('') ||
      '<div class="empty">没有找到基金</div>';

    [
      ...r.querySelectorAll(
        '.card'
      )
    ].forEach(b => {
      b.onclick = () =>
        openFund(
          b.dataset.code,
          b.dataset.name
        );
    });

  } catch (e) {
    r.innerHTML =
      '<div class="error">' +
      '搜索接口暂时无法访问，请稍后再试。' +
      '</div>';
  }
}

/* =========================
   自选
========================= */

function favPage() {
  searchTab.classList.remove(
    'active'
  );

  favTab.classList.add(
    'active'
  );

  main.innerHTML =
    '<section class="hero">' +
      '<h1>我的自选</h1>' +
      '<p>自选保存在这台设备上</p>' +
    '</section>' +

    (
      fav.length
        ? fav
            .map(
              x =>
                '<button class="card" data-code="' +
                esc(x.code) +
                '" data-name="' +
                esc(x.name) +
                '">' +

                  '<div class="card-main">' +
                    '<div class="name">' +
                      esc(x.name) +
                    '</div>' +

                    '<div class="meta">' +
                      esc(x.code) +
                    '</div>' +
                  '</div>' +

                  '<div class="chev">›</div>' +

                '</button>'
            )
            .join('')
        : '<div class="empty">' +
          '还没有自选基金<br>' +
          '<small>搜索基金后进入基金详情即可加入自选</small>' +
          '</div>'
    );

  [
    ...main.querySelectorAll(
      '.card'
    )
  ].forEach(b => {
    b.onclick = () =>
      openFund(
        b.dataset.code,
        b.dataset.name
      );
  });
}

/* =========================
   风险缓存
========================= */

function riskCacheId(code) {
  return (
    riskCacheKey +
    '_' +
    String(code)
      .replace(/\D/g, '')
      .slice(0, 6)
  );
}

function readRiskCache(code) {
  try {
    const raw =
      localStorage.getItem(
        riskCacheId(code)
      );

    if (!raw) return null;

    const x =
      JSON.parse(raw);

    if (
      !x ||
      !x.data
    ) {
      return null;
    }

    return x;
  } catch {
    return null;
  }
}

function writeRiskCache(
  code,
  data
) {
  try {
    localStorage.setItem(
      riskCacheId(code),
      JSON.stringify({
        savedAt:
          Date.now(),

        data
      })
    );
  } catch {}
}

/* =========================
   风险 API
========================= */

async function fetchRiskApi(
  code,
  name
) {
  const u =
    '/api/risk?code=' +
    encodeURIComponent(code) +
    '&name=' +
    encodeURIComponent(name);

  const r =
    await fetch(u, {
      headers: {
        Accept:
          'application/json'
      }
    });

  if (!r.ok) {
    throw new Error(
      '风险接口 HTTP ' +
      r.status
    );
  }

  return await r.json();
}

/* =========================
   风险页面
========================= */

function riskPage(
  code,
  name
) {
  const u =
    sourceUrls(code);

  main.innerHTML =
    '<div class="risk-head">' +

      '<button class="back" id="riskBack">' +
        '‹ 返回基金' +
      '</button>' +

      '<div>' +
        '<div class="risk-title">' +
          '历史风险' +
        '</div>' +

        '<div class="risk-sub">' +
          'V14 · 自动监管风险数据库' +
        '</div>' +
      '</div>' +

      '<button class="risk-refresh" id="riskRefresh">' +
        '↻' +
      '</button>' +

    '</div>' +

    '<div class="risk-summary" id="riskSummary">' +
      '<div class="risk-loading">' +
        '正在自动检索证监会公开记录……' +
      '</div>' +
    '</div>' +

    '<div class="risk-filter" id="riskFilter">' +

      '<button class="on" data-type="全部">' +
        '全部' +
      '</button>' +

      '<button data-type="行政处罚">' +
        '行政处罚' +
      '</button>' +

      '<button data-type="市场禁入">' +
        '市场禁入' +
      '</button>' +

      '<button data-type="警示函">' +
        '警示函' +
      '</button>' +

      '<button data-type="监管措施">' +
        '监管措施' +
      '</button>' +

      '<button data-type="纪律处分">' +
        '纪律处分' +
      '</button>' +

      '<button data-type="诚信记录">' +
        '诚信记录' +
      '</button>' +

      '<button data-type="其他">' +
        '其他' +
      '</button>' +

    '</div>' +

    '<div id="riskList" class="risk-list"></div>' +

    '<div class="risk-note">' +
      '风险记录根据基金管理人、基金名称及可识别的基金经理信息，自动检索中国证监会公开信息。管理人或基金经理被监管，不等于本基金产品本身违法。风险评分仅用于信息整理，不构成投资或法律结论。' +
    '</div>' +

    '<div class="source">' +
      '信息来源：' +
      '<button class="plain-link" id="riskOfficial">' +
        '中国证券监督管理委员会 ↗' +
      '</button>' +
    '</div>';

  let data = {
    manager: '',
    records: []
  };

  let filter =
    '全部';

  let loading =
    false;

  function renderSummary(
    fromCache = false,
    refreshing = false
  ) {
    const sum =
      document.getElementById(
        'riskSummary'
      );

    const records =
      data.records || [];

    const counts =
      data.counts || {};

    const score =
      data.riskScore?.score;

    let scoreClass =
      'risk-score-low';

    if (
      score !== null &&
      score !== undefined
    ) {
      if (score < 50) {
        scoreClass =
          'risk-score-high';
      } else if (score < 75) {
        scoreClass =
          'risk-score-medium';
      }
    }

    sum.innerHTML =
      '<div class="risk-manager">' +
        '<span>基金</span>' +
        '<b>' +
          esc(name) +
        '</b>' +
        '<em>' +
          esc(code) +
        '</em>' +
      '</div>' +

      '<div class="risk-manager">' +
        '<span>管理人</span>' +
        '<b>' +
          esc(
            data.manager ||
            '自动识别失败'
          ) +
        '</b>' +
      '</div>' +

      (
        data.managers?.length
          ? '<div class="risk-manager">' +
              '<span>基金经理</span>' +
              '<b>' +
                esc(
                  data.managers.join(
                    '、'
                  )
                ) +
              '</b>' +
            '</div>'
          : ''
      ) +

      '<div class="risk-score-box">' +

        '<div class="risk-score-main">' +
          '<strong class="' +
            scoreClass +
            '">' +
            (
              score === null ||
              score === undefined
                ? '--'
                : score
            ) +
          '</strong>' +

          '<span>风险指数</span>' +
        '</div>' +

        '<div class="risk-score-text">' +
          '<b>' +
            (
              data.riskScore?.level ||
              '未评估'
            ) +
          '</b>' +

          '<small>' +
            (
              score === null ||
              score === undefined
                ? '暂无足够数据'
                : '分数越低代表历史监管记录越多'
            ) +
          '</small>' +
        '</div>' +

      '</div>' +

      '<div class="risk-stats">' +

        '<div>' +
          '<strong>' +
            records.length +
          '</strong>' +
          '<small>关联记录</small>' +
        '</div>' +

        '<div>' +
          '<strong>' +
            (counts['行政处罚'] || 0) +
          '</strong>' +
          '<small>行政处罚</small>' +
        '</div>' +

        '<div>' +
          '<strong>' +
            (counts['警示函'] || 0) +
          '</strong>' +
          '<small>警示函</small>' +
        '</div>' +

        '<div>' +
          '<strong>' +
            (counts['监管措施'] || 0) +
          '</strong>' +
          '<small>监管措施</small>' +
        '</div>' +

      '</div>' +

      (
        data.latest
          ? '<div class="risk-latest">' +
              '<span>最近一次监管记录</span>' +
              '<b>' +
                esc(
                  data.latest.date ||
                  ''
                ) +
              '</b>' +
              '<p>' +
                esc(
                  data.latest.title ||
                  ''
                ) +
              '</p>' +
            '</div>'
          : ''
      ) +

      '<div class="risk-status-line">' +
        (
          refreshing
            ? '↻ 正在检查最新记录……'
            : fromCache
            ? '✓ 已从本机缓存快速加载'
            : data.cached
            ? '✓ Cloudflare 缓存结果'
            : '✓ 刚刚完成公开信息检索'
        ) +
      '</div>';
  }

  function render() {
    const list =
      document.getElementById(
        'riskList'
      );

    const arr =
      (data.records || [])
        .filter(
          x =>
            filter === '全部' ||
            x.type === filter
        );

    if (!arr.length) {
      list.innerHTML =
        '<div class="risk-empty">' +

          '<strong>' +
            (
              filter === '全部'
                ? '未检索到匹配的公开监管记录'
                : '该分类暂无记录'
            ) +
          '</strong>' +

          '<br>' +

          '<small>' +
            '当前公开检索未找到匹配项，不代表绝对不存在其他记录。' +
          '</small>' +

        '</div>';

      return;
    }

    list.innerHTML =
      arr
        .map(
          x =>
            '<article class="risk-item">' +

              '<div class="risk-item-top">' +

                '<span class="risk-tag ' +
                  (
                    x.type === '行政处罚' ||
                    x.type === '市场禁入'
                      ? 'danger'
                      : x.type === '警示函' ||
                        x.type === '监管措施'
                      ? 'warning'
                      : ''
                  ) +
                '">' +

                  esc(
                    x.type ||
                    '其他'
                  ) +

                '</span>' +

                '<time>' +
                  esc(
                    x.date ||
                    '日期未识别'
                  ) +
                '</time>' +

              '</div>' +

              '<h3>' +
                esc(
                  x.title ||
                  '证监会公开监管记录'
                ) +
              '</h3>' +

              '<div class="risk-meta-row">' +
                '<span>' +
                  esc(
                    x.relation ||
                    '关联记录'
                  ) +
                '</span>' +
              '</div>' +

              '<p>' +
                '<b>监管机关：</b>' +
                esc(
                  x.agency ||
                  '中国证监会'
                ) +
              '</p>' +

              '<p>' +
                '<b>涉及对象：</b>' +
                esc(
                  x.subject ||
                  data.manager ||
                  '未标明'
                ) +
              '</p>' +

              (
                x.summary
                  ? '<p>' +
                      esc(
                        x.summary
                      ) +
                    '</p>'
                  : ''
              ) +

              (
                x.measure
                  ? '<div class="risk-result">' +
                      '<b>监管措施：</b>' +
                      esc(
                        x.measure
                      ) +
                    '</div>'
                  : ''
              ) +

              '<button data-url="' +
                esc(
                  x.url ||
                  'https://www.csrc.gov.cn/'
                ) +
                '" class="risk-detail">' +
                '查看证监会原文 ↗' +
              '</button>' +

            '</article>'
        )
        .join('');

    [
      ...list.querySelectorAll(
        '.risk-detail'
      )
    ].forEach(b => {
      b.onclick = () =>
        openSource(
          b.dataset.url,
          '证监会原文'
        );
    });
  }

  async function refresh(
    showLoading = true
  ) {
    if (loading) return;

    loading = true;

    if (showLoading) {
      document.getElementById(
        'riskSummary'
      ).innerHTML =
        '<div class="risk-loading">' +
          '正在检索证监会公开记录……' +
          '<small>首次检索可能需要几秒钟</small>' +
        '</div>';
    }

    try {
      const result =
        await fetchRiskApi(
          code,
          name
        );

      data = result;

      writeRiskCache(
        code,
        data
      );

      renderSummary(
        false,
        false
      );

      render();

    } catch (e) {
      /*
       * 如果网络失败，
       * 但之前有缓存，
       * 就保留旧结果
       */
      if (
        data.records?.length
      ) {
        renderSummary(
          true,
          false
        );

        const note =
          document.getElementById(
            'riskSummary'
          );

        note.insertAdjacentHTML(
          'beforeend',
          '<div class="risk-refresh-error">' +
            '最新数据更新失败，当前显示的是上次缓存结果。' +
          '</div>'
        );

        render();
      } else {
        document.getElementById(
          'riskSummary'
        ).innerHTML =
          '<div class="risk-error">' +
            '<b>自动风险检索暂时失败</b>' +
            '<br>' +
            '<small>' +
              esc(
                e.message ||
                '网络错误'
              ) +
            '</small>' +
            '<br>' +
            '<button id="riskRetry" class="source-button">' +
              '重新检索' +
            '</button>' +
          '</div>';

        document.getElementById(
          'riskRetry'
        ).onclick = () =>
          refresh(true);
      }
    }

    loading = false;
  }

  /*
   * 先读本机缓存
   */
  const cached =
    readRiskCache(code);

  if (
    cached?.data
  ) {
    data =
      cached.data;

    renderSummary(
      true,
      true
    );

    render();

    /*
     * 后台刷新
     */
    setTimeout(
      () => refresh(false),
      150
    );
  } else {
    refresh(true);
  }

  document.getElementById(
    'riskBack'
  ).onclick = () =>
    openFund(
      code,
      name
    );

  document.getElementById(
    'riskRefresh'
  ).onclick = () =>
    refresh(true);

  [
    ...document.querySelectorAll(
      '#riskFilter button'
    )
  ].forEach(b => {
    b.onclick = () => {
      filter =
        b.dataset.type;

      document
        .querySelectorAll(
          '#riskFilter button'
        )
        .forEach(x =>
          x.classList.remove(
            'on'
          )
        );

      b.classList.add('on');

      render();
    };
  });

  document.getElementById(
    'riskOfficial'
  ).onclick = () =>
    openSource(
      u.csrc,
      '中国证监会'
    );
}

/* =========================
   基金详情
========================= */

function openFund(
  code,
  name
) {
  const is =
    fav.some(
      x => x.code === code
    );

  const u =
    sourceUrls(code);

  main.innerHTML =
    '<div class="fund-head">' +

      '<div class="backrow">' +
        '<button class="back" id="back">' +
          '‹ 返回' +
        '</button>' +
      '</div>' +

      '<div class="fund-name">' +
        esc(name) +
      '</div>' +

      '<div class="code">' +
        esc(code) +
      '</div>' +

      '<button class="fav-button ' +
        (is ? 'saved' : '') +
        '" id="star">' +

        '<span>' +
          (is ? '★' : '☆') +
        '</span>' +

        '<b>' +
          (
            is
              ? '已加入自选'
              : '加入自选'
          ) +
        '</b>' +

      '</button>' +

    '</div>' +

    '<div class="section-title">' +
      '重要持仓' +
    '</div>' +

    '<div class="source-card">' +
      '<div>' +
        '<strong>前十大重仓</strong>' +
        '<p>' +
          '进入东方财富基金档案的持仓披露页面，并在当前 App 页面内查看。' +
        '</p>' +
      '</div>' +

      '<button class="source-button" id="holdBtn">' +
        '查看持仓 ↗' +
      '</button>' +

    '</div>' +

    '<div class="section-title">' +
      '历史定期报告' +
    '</div>' +

    '<div class="source-card">' +
      '<div>' +
        '<strong>基金定期报告</strong>' +
        '<p>' +
          '进入该基金公告的「定期报告」栏目。' +
        '</p>' +
      '</div>' +

      '<button class="source-button" id="reportBtn">' +
        '查看季报 ↗' +
      '</button>' +

    '</div>' +

    '<div class="section-title">' +
      '历史风险' +
    '</div>' +

    '<button class="risk-entry" id="riskBtn">' +

      '<div>' +
        '<strong>V14 自动风险数据库</strong>' +

        '<p>' +
          '管理人 + 基金 + 基金经理多维度检索证监会历史记录。' +
        '</p>' +
      '</div>' +

      '<span>›</span>' +

    '</button>' +

    '<div class="source-tip">' +
      '风险数据第一次查询可能需要几秒钟；以后打开会优先使用本机缓存，再后台检查最新记录。' +
    '</div>' +

    '<div class="source">' +
      '信息来源：' +
      '<button class="plain-link" id="sourceLink">' +
        '东方财富基金数据 ↗' +
      '</button>' +
    '</div>';

  bindFundEvents();
}

function bindFundEvents() {
  const back =
    document.getElementById(
      'back'
    );

  if (back) {
    back.onclick =
      () => searchPage();
  }

  const star =
    document.getElementById(
      'star'
    );

  if (star) {
    star.onclick = () => {
      const code =
        document
          .querySelector(
            '.code'
          )
          ?.textContent
          .trim() || '';

      const name =
        document
          .querySelector(
            '.fund-name'
          )
          ?.textContent
          .trim() || '';

      const i =
        fav.findIndex(
          x => x.code === code
        );

      if (i >= 0) {
        fav.splice(i, 1);
      } else {
        fav.unshift({
          code,
          name
        });
      }

      save();

      const active =
        fav.some(
          x => x.code === code
        );

      star.classList.toggle(
        'saved',
        active
      );

      star.querySelector(
        'span'
      ).textContent =
        active
          ? '★'
          : '☆';

      star.querySelector(
        'b'
      ).textContent =
        active
          ? '已加入自选'
          : '加入自选';
    };
  }

  const code =
    document
      .querySelector(
        '.code'
      )
      ?.textContent
      .trim();

  if (!code) return;

  const u =
    sourceUrls(code);

  const hold =
    document.getElementById(
      'holdBtn'
    );

  if (hold) {
    hold.onclick = () =>
      openSource(
        u.holdings,
        '基金持仓'
      );
  }

  const report =
    document.getElementById(
      'reportBtn'
    );

  if (report) {
    report.onclick = () =>
      openSource(
        u.reports,
        '定期报告'
      );
  }

  const source =
    document.getElementById(
      'sourceLink'
    );

  if (source) {
    source.onclick = () =>
      openSource(
        u.source,
        '信息来源'
      );
  }

  const risk =
    document.getElementById(
      'riskBtn'
    );

  if (risk) {
    risk.onclick = () =>
      riskPage(
        code,
        document
          .querySelector(
            '.fund-name'
          )
          ?.textContent
          .trim() || ''
      );
  }
}

/* =========================
   初始化
========================= */

searchTab.onclick =
  searchPage;

favTab.onclick =
  favPage;

searchPage();
