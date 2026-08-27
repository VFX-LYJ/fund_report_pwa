const CSRC_SEARCH = 'https://www.csrc.gov.cn/guestweb4/s';
const EASTMONEY_FUND = code =>
  `https://fund.eastmoney.com/${encodeURIComponent(code)}.html`;

const TTL = 12 * 60 * 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function responseJSON(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      ...CORS,
      ...extra
    }
  });
}

function decodeHtml(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

function clean(s = '') {
  return decodeHtml(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(href) {
  try {
    return new URL(
      decodeHtml(href),
      'https://www.csrc.gov.cn'
    ).href;
  } catch {
    return '';
  }
}

function escRe(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(s = '') {
  return String(s)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(s = '') {
  const m = String(s).match(
    /(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/
  );

  return m
    ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`
    : '';
}

function inferType(title, text) {
  const s = `${title} ${text}`;

  if (/市场禁入|证券市场禁入/.test(s)) {
    return '市场禁入';
  }

  if (
    /行政处罚|处罚决定书|没收违法所得|罚款|处罚/.test(s)
  ) {
    return '行政处罚';
  }

  if (
    /纪律处分|纪律委员会|纪律处分决定/.test(s)
  ) {
    return '纪律处分';
  }

  if (
    /警示函|出具警示函/.test(s)
  ) {
    return '警示函';
  }

  if (
    /监管措施|责令改正|监管谈话|暂不受理|暂停.*业务|限制.*业务|整改/.test(s)
  ) {
    return '监管措施';
  }

  if (
    /诚信档案|诚信记录|诚信信息/.test(s)
  ) {
    return '诚信记录';
  }

  return '其他';
}

function inferLevel(type) {
  switch (type) {
    case '行政处罚':
    case '市场禁入':
      return 'high';

    case '警示函':
    case '监管措施':
      return 'medium';

    case '纪律处分':
      return 'medium';

    default:
      return 'low';
  }
}

function riskLike(title, text) {
  return /行政处罚|处罚决定书|处罚|监管措施|警示函|责令改正|监管谈话|市场禁入|暂不受理|暂停.*业务|限制.*业务|整改|纪律处分|诚信档案|诚信记录/.test(
    `${title} ${text}`
  );
}

function inferMeasure(s) {
  const hits = [
    '责令改正',
    '出具警示函',
    '警示函',
    '监管谈话',
    '暂不受理行政许可',
    '暂停相关业务',
    '限制业务活动',
    '市场禁入',
    '整改',
    '行政处罚',
    '罚款',
    '纪律处分'
  ];

  return [
    ...new Set(hits.filter(x => String(s).includes(x)))
  ].join('、');
}

function inferAgency(text, url) {
  const m = String(text).match(
    /(中国证监会|[\u4e00-\u9fa5]{2,12}证监局)/
  );

  if (m) return m[1];

  try {
    const h = new URL(url).hostname;
    const parts = h.split('.');

    if (parts[0] && parts[0] !== 'www') {
      return parts[0] + '证监局';
    }
  } catch {}

  return '中国证监会';
}

async function fetchText(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      'Accept':
        'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  });

  if (!r.ok) {
    throw new Error(`上游返回 ${r.status}`);
  }

  return await r.text();
}

/*
 * 从证监会搜索结果中提取记录
 */
function parseSearch(html, subject, relation = '管理人') {
  const out = [];

  const exact = subject
    ? new RegExp(escRe(subject), 'i')
    : null;

  const re =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let m;

  while ((m = re.exec(html))) {
    const url = absUrl(m[1]);
    const title = clean(m[2]);

    if (
      !url ||
      !title ||
      !url.includes('csrc.gov.cn') ||
      title.length < 4
    ) {
      continue;
    }

    const context = clean(
      html.slice(
        Math.max(0, m.index - 1800),
        Math.min(html.length, m.index + 3000)
      )
    );

    const blob = `${title} ${context}`;

    if (!riskLike(title, context)) {
      continue;
    }

    if (exact && !exact.test(blob)) {
      continue;
    }

    const type = inferType(title, context);

    const key =
      `${url}|${title}|${type}`;

    if (out.some(x => x.key === key)) {
      continue;
    }

    out.push({
      key,
      title,
      url,
      date: parseDate(`${title} ${context}`),
      type,
      level: inferLevel(type),
      agency: inferAgency(context, url),
      subject,
      relation,
      summary: title,
      measure: inferMeasure(blob),
      result: ''
    });

    if (out.length >= 80) {
      break;
    }
  }

  return out;
}

function searchParams(term, pageNum) {
  return new URLSearchParams({
    siteCode: 'bm56000001',
    checkHandle: '1',
    pageSize: '20',
    pageNum: String(pageNum),
    searchWord: term,
    column: '全部',
    searchSource: '0',
    govWorkBean: '{}',
    countKey: '0',
    uc: '0',
    left_right_index: '0',
    orderBy: '2',
    wordPlace: '0'
  }).toString();
}

async function searchCsrc(subject, term, pageNum, relation) {
  const html = await fetchText(
    `${CSRC_SEARCH}?${searchParams(term, pageNum)}`
  );

  return parseSearch(
    html,
    subject,
    relation
  );
}

/*
 * 管理人识别
 */
async function identifyManager(code, name) {
  try {
    const html = await fetchText(
      EASTMONEY_FUND(code)
    );

    const text = clean(html);

    const patterns = [
      /基金管理人[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-]{4,100}基金管理(?:有限公司|股份有限公司|有限责任公司))/,
      /管理人[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-]{4,100}基金管理(?:有限公司|股份有限公司|有限责任公司))/
    ];

    for (const p of patterns) {
      const m = text.match(p);

      if (m) {
        return m[1].trim();
      }
    }
  } catch {}

  const map = [
    ['华夏', '华夏基金管理有限公司'],
    ['易方达', '易方达基金管理有限公司'],
    ['广发', '广发基金管理有限公司'],
    ['富国', '富国基金管理有限公司'],
    ['南方', '南方基金管理股份有限公司'],
    ['国泰', '国泰基金管理有限公司'],
    ['嘉实', '嘉实基金管理有限公司'],
    ['建信', '建信基金管理有限责任公司'],
    ['天弘', '天弘基金管理有限公司'],
    ['华宝', '华宝基金管理有限公司'],
    ['摩根', '摩根基金管理（中国）有限公司'],
    ['国富', '国海富兰克林基金管理有限公司'],
    ['万家', '万家基金管理有限公司'],
    ['浦银', '浦银安盛基金管理有限公司'],
    ['博时', '博时基金管理有限公司'],
    ['中欧', '中欧基金管理有限公司'],
    ['工银瑞信', '工银瑞信基金管理有限公司'],
    ['招商', '招商基金管理有限公司'],
    ['鹏华', '鹏华基金管理有限公司'],
    ['交银施罗德', '交银施罗德基金管理有限公司'],
    ['兴证全球', '兴证全球基金管理有限公司'],
    ['银华', '银华基金管理股份有限公司'],
    ['华安', '华安基金管理有限公司'],
    ['汇添富', '汇添富基金管理股份有限公司'],
    ['兴业', '兴业基金管理有限公司'],
    ['中银', '中银基金管理有限公司'],
    ['平安', '平安基金管理有限公司'],
    ['招商', '招商基金管理有限公司'],
    ['诺安', '诺安基金管理有限公司'],
    ['长城', '长城基金管理有限公司'],
    ['交银', '交银施罗德基金管理有限公司'],
    ['东方', '东方基金管理股份有限公司'],
    ['长信', '长信基金管理有限责任公司'],
    ['华泰柏瑞', '华泰柏瑞基金管理有限公司'],
    ['鹏华', '鹏华基金管理有限公司'],
    ['浙商', '浙商基金管理有限公司'],
    ['前海开源', '前海开源基金管理有限公司'],
    ['招商', '招商基金管理有限公司']
  ];

  const hit = map.find(([k]) =>
    String(name).includes(k)
  );

  return hit?.[1] || '';
}

/*
 * 尝试从基金资料页面找基金经理
 */
async function identifyManagers(code) {
  const names = [];

  try {
    const html = await fetchText(
      EASTMONEY_FUND(code)
    );

    const text = clean(html);

    /*
     * 常见东方财富基金经理页面文字形式：
     * 基金经理：张三
     * 基金经理：张三、李四
     */
    const patterns = [
      /基金经理[：:\s]*([\u4e00-\u9fa5]{2,8}(?:\s*[、,，]\s*[\u4e00-\u9fa5]{2,8}){0,8})/,
      /现任基金经理[：:\s]*([\u4e00-\u9fa5]{2,8}(?:\s*[、,，]\s*[\u4e00-\u9fa5]{2,8}){0,8})/
    ];

    for (const p of patterns) {
      const m = text.match(p);

      if (!m) continue;

      const arr = m[1]
        .split(/[、,，]/)
        .map(x => x.trim())
        .filter(x =>
          /^[\u4e00-\u9fa5]{2,8}$/.test(x)
        );

      names.push(...arr);
    }
  } catch {}

  return [
    ...new Set(names)
  ].slice(0, 12);
}

/*
 * 生成搜索关键词
 */
function buildTerms(manager, fundName, managers = []) {
  const terms = [];

  const base = manager
    .replace(
      /基金管理(?:有限公司|股份有限公司|有限责任公司)$/,
      ''
    )
    .trim();

  const add = x => {
    if (!x) return;

    const s = String(x).trim();

    if (s.length >= 2) {
      terms.push(s);
    }
  };

  /*
   * 管理人
   */
  add(`"${manager}"`);
  add(`"${manager}" 监管`);
  add(`"${manager}" 行政处罚`);
  add(`"${manager}" 处罚`);
  add(`"${manager}" 警示函`);
  add(`"${manager}" 监管措施`);
  add(`"${manager}" 责令改正`);
  add(`"${manager}" 监管谈话`);
  add(`"${manager}" 市场禁入`);
  add(`"${manager}" 纪律处分`);
  add(`"${manager}" 诚信`);

  /*
   * 管理人简称
   */
  if (base) {
    add(`"${base}" 警示函`);
    add(`"${base}" 行政处罚`);
    add(`"${base}" 监管措施`);
  }

  /*
   * 基金名称
   */
  if (fundName) {
    add(`"${fundName}"`);
    add(`"${fundName}" 监管`);
    add(`"${fundName}" 处罚`);
  }

  /*
   * 基金经理
   */
  for (const managerName of managers) {
    add(`"${managerName}" 基金经理`);
    add(`"${managerName}" 监管`);
    add(`"${managerName}" 警示函`);
    add(`"${managerName}" 行政处罚`);
  }

  return [
    ...new Set(terms)
  ].slice(0, 24);
}

/*
 * 去重
 */
function uniqueRecords(records) {
  const seen = new Set();

  return records.filter(x => {
    const normalizedTitle = normalizeText(
      x.title || ''
    );

    const k =
      `${x.url || ''}|${normalizedTitle}`;

    if (seen.has(k)) {
      return false;
    }

    seen.add(k);
    return true;
  });
}

/*
 * 风险评分
 *
 * 100 = 当前没有发现明显风险
 * 分数越低，历史监管风险越高
 *
 * 这里只是内部风险指标，
 * 不是法律结论。
 */
function calculateRiskScore(records) {
  let score = 100;

  const now = Date.now();

  for (const x of records) {
    let penalty = 0;

    switch (x.type) {
      case '市场禁入':
        penalty = 18;
        break;

      case '行政处罚':
        penalty = 12;
        break;

      case '警示函':
        penalty = 5;
        break;

      case '监管措施':
        penalty = 4;
        break;

      case '纪律处分':
        penalty = 4;
        break;

      case '诚信记录':
        penalty = 2;
        break;

      default:
        penalty = 1;
    }

    /*
     * 时间衰减：
     * 5 年以前的记录影响减弱
     */
    if (x.date) {
      const t = Date.parse(x.date);

      if (!Number.isNaN(t)) {
        const years =
          (now - t) /
          (365.25 * 24 * 60 * 60 * 1000);

        if (years > 5) {
          penalty *= 0.35;
        } else if (years > 3) {
          penalty *= 0.55;
        } else if (years > 1) {
          penalty *= 0.8;
        }
      }
    }

    score -= penalty;
  }

  score = Math.round(
    Math.max(0, Math.min(100, score))
  );

  let level = '低';

  if (score < 50) {
    level = '高';
  } else if (score < 75) {
    level = '中';
  }

  return {
    score,
    level
  };
}

function calculateCounts(records) {
  const types = [
    '行政处罚',
    '市场禁入',
    '警示函',
    '监管措施',
    '纪律处分',
    '诚信记录',
    '其他'
  ];

  const counts = {};

  for (const t of types) {
    counts[t] = 0;
  }

  for (const x of records) {
    counts[x.type] =
      (counts[x.type] || 0) + 1;
  }

  return counts;
}

function latestRecord(records) {
  return (
    [...records]
      .filter(x => x.date)
      .sort((a, b) =>
        (b.date || '').localeCompare(
          a.date || ''
        )
      )[0] || null
  );
}

/*
 * 核心风险 API
 */
async function risk(request) {
  const u = new URL(request.url);

  const code = (
    u.searchParams.get('code') || ''
  )
    .replace(/\D/g, '')
    .slice(0, 6);

  const name =
    u.searchParams.get('name') || '';

  if (!code) {
    return responseJSON(
      { error: 'missing code' },
      400
    );
  }

  const cacheKey =
    new Request(
      new URL(
        '/api/risk?code=' +
          code +
          '&name=' +
          encodeURIComponent(name),
        u.origin
      ).href
    );

  const cache = caches.default;

  /*
   * Worker Cache
   */
  const cached =
    await cache.match(cacheKey);

  if (cached) {
    const data =
      await cached.json();

    data.cached = true;
    data.cacheSource = 'cloudflare-cache';

    return responseJSON(data);
  }

  /*
   * 识别管理人
   */
  const manager =
    await identifyManager(
      code,
      name
    );

  if (!manager) {
    return responseJSON(
      {
        ok: false,
        code,
        name,
        manager: '',
        records: [],
        counts: {},
        riskScore: null,
        error:
          '无法自动识别基金管理人'
      },
      200
    );
  }

  /*
   * 基金经理
   */
  const managers =
    await identifyManagers(code);

  /*
   * 多关键词
   */
  const terms =
    buildTerms(
      manager,
      name,
      managers
    );

  let all = [];

  /*
   * 控制并发：
   * 每批 3 个关键词
   * 每个关键词最多 4 页
   */
  for (
    let i = 0;
    i < terms.length;
    i += 3
  ) {
    const batch =
      terms.slice(i, i + 3);

    const jobs = [];

    for (const term of batch) {
      for (
        let page = 1;
        page <= 4;
        page++
      ) {
        jobs.push(
          searchCsrc(
            manager,
            term,
            page,
            term.includes('基金经理')
              ? '基金经理'
              : term.includes(name)
              ? '基金'
              : '基金管理人'
          ).catch(() => [])
        );
      }
    }

    const results =
      await Promise.all(jobs);

    for (const r of results) {
      all.push(...r);
    }
  }

  /*
   * 最终去重
   */
  all =
    uniqueRecords(all)
      .sort((a, b) =>
        (b.date || '0000').localeCompare(
          a.date || '0000'
        )
      )
      .slice(0, 500);

  /*
   * 统计
   */
  const counts =
    calculateCounts(all);

  /*
   * 风险评分
   */
  const riskScore =
    calculateRiskScore(all);

  /*
   * 最近记录
   */
  const latest =
    latestRecord(all);

  const data = {
    ok: true,

    version: 'V14',

    code,
    name,
    manager,

    managers,

    records: all,

    counts,

    riskScore,

    latest,

    queryTerms: terms,

    total: all.length,

    updatedAt:
      new Date().toISOString(),

    source:
      '中国证券监督管理委员会公开信息检索',

    cached: false
  };

  /*
   * Worker Cache
   */
  const cacheResp =
    new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type':
            'application/json;charset=UTF-8',

          'Cache-Control':
            `public,max-age=${TTL}`
        }
      }
    );

  await cache.put(
    cacheKey,
    cacheResp
  );

  return responseJSON(data);
}

export default {
  async fetch(request, env) {
    const u =
      new URL(request.url);

    if (
      request.method === 'OPTIONS'
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers: CORS
        }
      );
    }

    if (
      u.pathname === '/api/risk' &&
      request.method === 'GET'
    ) {
      return risk(request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(
        request
      );
    }

    return new Response(
      'Fund PWA V14',
      {
        status: 200,
        headers: {
          'Content-Type':
            'text/plain;charset=UTF-8'
        }
      }
    );
  }
};
