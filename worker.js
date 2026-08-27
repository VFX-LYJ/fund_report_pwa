const CACHE_VERSION = 'v22.1-upstream-fetch-debug';
const RATE_WINDOW = 10 * 60;
const RATE_LIMIT = 5;
const RELATIONS = ['manager', 'person', 'fund'];
const RISK_TYPES = ['行政处罚', '警示函', '监管措施', '市场禁入', '纪律处分', '其他'];

const MANAGERS = [
  ['华夏', '华夏基金管理有限公司', ['华夏基金', '华夏基金管理'], ['华夏银行', '华夏证券', '华夏保险', '华夏人寿']],
  ['易方达', '易方达基金管理有限公司', ['易方达基金', '易方达'], ['易方达证券']],
  ['广发', '广发基金管理有限公司', ['广发基金'], ['广发银行', '广发证券', '广发期货']],
  ['富国', '富国基金管理有限公司', ['富国基金'], ['富国银行', '富国证券']],
  ['南方', '南方基金管理股份有限公司', ['南方基金'], ['南方航空', '南方电网', '南方证券']],
  ['国泰', '国泰基金管理有限公司', ['国泰基金'], ['国泰君安', '国泰航空']],
  ['嘉实', '嘉实基金管理有限公司', ['嘉实基金'], []],
  ['汇添富', '汇添富基金管理股份有限公司', ['汇添富基金', '汇添富'], []],
  ['博时', '博时基金管理有限公司', ['博时基金'], []],
  ['招商', '招商基金管理有限公司', ['招商基金'], ['招商银行', '招商证券']],
  ['中欧', '中欧基金管理有限公司', ['中欧基金'], []],
  ['鹏华', '鹏华基金管理有限公司', ['鹏华基金'], []],
  ['华宝', '华宝基金管理有限公司', ['华宝基金'], ['华宝证券', '华宝信托']],
  ['天弘', '天弘基金管理有限公司', ['天弘基金'], []],
  ['建信', '建信基金管理有限责任公司', ['建信基金'], ['建设银行', '建信信托']],
  ['工银瑞信', '工银瑞信基金管理有限公司', ['工银瑞信基金', '工银瑞信'], ['工商银行']],
  ['交银施罗德', '交银施罗德基金管理有限公司', ['交银施罗德基金'], []],
  ['银华', '银华基金管理股份有限公司', ['银华基金'], []],
  ['华安', '华安基金管理有限公司', ['华安基金'], ['华安证券', '华安保险']],
  ['景顺长城', '景顺长城基金管理有限公司', ['景顺长城基金'], []],
  ['中信保诚', '中信保诚基金管理有限公司', ['中信保诚基金'], ['中信证券', '中信银行']],
  ['民生加银', '民生加银基金管理有限公司', ['民生加银基金'], ['民生银行', '民生证券']],
  ['泰康', '泰康基金管理有限公司', ['泰康基金'], ['泰康保险']],
  ['永赢', '永赢基金管理有限公司', ['永赢基金'], []],
  ['安信', '安信基金管理有限责任公司', ['安信基金'], ['安信证券']],
  ['华商', '华商基金管理有限公司', ['华商基金'], []],
  ['宝盈', '宝盈基金管理有限公司', ['宝盈基金'], []],
  ['金鹰', '金鹰基金管理有限公司', ['金鹰基金'], ['金鹰证券']],
  ['融通', '融通基金管理有限公司', ['融通基金'], []],
  ['大成', '大成基金管理有限公司', ['大成基金'], []]
];

const SOURCES = {
  csrc: { name: '证监会总部', base: 'https://www.csrc.gov.cn/csrc/c106259/common_list_gd.shtml' },
  beijing: { name: '北京证监局', base: 'https://www.csrc.gov.cn/csrc/c100045/common_list_gd.shtml' },
  shanghai: { name: '上海证监局', base: 'https://www.csrc.gov.cn/csrc/c100053/common_list_gd.shtml' }
};
const SOURCE_ORDER = ['csrc', 'beijing', 'shanghai'];
const RISK_TITLE = /行政处罚决定书|行政处罚事先告知书|行政处罚|市场禁入决定书|证券市场禁入|警示函|监管措施决定书|行政监管措施|采取.*监管措施|责令改正|监管谈话|纪律处分决定书|纪律处分|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责/i;
const NON_RISK = /证监会发布|证监会优化|证监会组织|证监会召开|培训|会议|致辞|讲话|新闻|政策解读|行业标准|工作方案|工作会议|公告|通知|答记者问|新闻发布会|活动|论坛|研讨|座谈|征求意见|意见稿|制度建设|数据模型/i;

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    }
  });
}

function norm(v) {
  return String(v || '').replace(/[（）()\s\u3000]/g, '').toLowerCase();
}

function clean(v) {
  return String(v || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function managerMeta(manager = '') {
  return MANAGERS.find(x => x[1] === manager) ||
    MANAGERS.find(x => manager.includes(x[1])) ||
    ['', manager, [manager], []];
}

function aliases(manager = '') {
  const x = managerMeta(manager);
  return [...new Set([manager, x[0], ...(x[2] || [])].filter(Boolean))];
}

function excludes(manager = '') {
  return managerMeta(manager)[3] || [];
}

function entityMatches(value, manager) {
  const n = norm(value);
  if (excludes(manager).some(x => n.includes(norm(x)))) return false;
  return aliases(manager).some(x => n.includes(norm(x)));
}

function inferManager(code = '', name = '') {
  const text = `${code} ${name}`;
  const byCode = {
    '000001': '华夏基金管理有限公司',
    '110011': '易方达基金管理有限公司'
  };
  const normalizedCode = String(code).replace(/\D/g, '');
  if (byCode[normalizedCode]) return byCode[normalizedCode];
  for (const x of MANAGERS) {
    if (x[2].some(a => text.includes(a)) || text.includes(x[0])) return x[1];
  }
  return '';
}

function extractDate(v = '') {
  const m = String(v).match(/(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : '';
}

function classifyType(v = '') {
  if (/市场禁入|证券市场禁入/.test(v)) return '市场禁入';
  if (/行政处罚/.test(v)) return '行政处罚';
  if (/纪律处分/.test(v)) return '纪律处分';
  if (/警示函/.test(v)) return '警示函';
  if (/监管措施|责令改正|监管谈话|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责/.test(v)) return '监管措施';
  return '其他';
}

function level(type) {
  return type === '行政处罚' || type === '市场禁入'
    ? 'high'
    : type === '纪律处分' || type === '警示函' || type === '监管措施'
      ? 'medium'
      : 'low';
}

function listAnchors(html, base) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let url;
    try {
      url = new URL(m[1].replace(/&amp;/g, '&'), base).href;
    } catch {
      continue;
    }
    const title = clean(m[2]);
    if (title.length < 5) continue;
    const around = clean(html.slice(Math.max(0, m.index - 450), Math.min(html.length, m.index + 700)));
    out.push({ url, title, date: extractDate(`${title} ${around}`) });
  }
  return out;
}

// CSRC occasionally responds slowly from Cloudflare Workers. The old 8s timeout
// caused every source to become "fetched:false" before the upstream had a chance
// to return. Keep the timeout long enough for the official site, while still
// bounding a single request so force=1 cannot hang indefinitely.
const UPSTREAM_TIMEOUT = 25000;
const DETAIL_TIMEOUT = 18000;

async function fetchUpstream(url, timeout = UPSTREAM_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const startedAt = Date.now();
  try {
    const responseUpstream = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5',
        'Referer': 'https://www.csrc.gov.cn/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    const finalUrl = responseUpstream.url || url;
    if (!responseUpstream.ok) {
      throw new Error(`上游HTTP ${responseUpstream.status}`);
    }
    const text = await responseUpstream.text();
    return {
      text,
      meta: {
        requestedUrl: url,
        finalUrl,
        status: responseUpstream.status,
        elapsedMs: Date.now() - startedAt,
        contentLength: text.length
      }
    };
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`上游请求超时（${timeout / 1000}s）`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function cacheRequest(key) {
  return new Request(`https://fund-risk-cache.invalid/${encodeURIComponent(key)}`);
}

async function storageGet(env, key) {
  if (env?.RISK_KV) {
    try { return await env.RISK_KV.get(key, 'json'); } catch { return null; }
  }
  try {
    const r = await caches.default.match(cacheRequest(key));
    return r ? await r.json() : null;
  } catch {
    return null;
  }
}

async function storagePut(env, key, value, ttl = 30 * 86400) {
  if (env?.RISK_KV) {
    await env.RISK_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
    return;
  }
  try {
    await caches.default.put(
      cacheRequest(key),
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public,max-age=${ttl}` }
      })
    );
  } catch {}
}

function managerKey(m) {
  return `risk:manager:${m}`;
}

function recordKey(r) {
  return `${norm(r?.url)}|${norm(r?.title)}`;
}

function dedupe(records = []) {
  const map = new Map();
  for (const r of records) {
    const k = r.key || recordKey(r);
    if (k && !map.has(k)) map.set(k, { ...r, key: k });
  }
  return [...map.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function readManagerData(env, manager) {
  const v = await storageGet(env, managerKey(manager));
  if (Array.isArray(v)) return { manager, records: v };
  return v || { manager, records: [] };
}

async function writeManagerData(env, manager, data) {
  await storagePut(env, managerKey(manager), data);
}

function makeRecord(item, body, sourceId, manager) {
  const full = `${item.title} ${body}`;
  const type = classifyType(full);
  const has = entityMatches(full, manager);
  const conf = has && RISK_TITLE.test(item.title)
    ? 'high'
    : has && RISK_TITLE.test(full)
      ? 'medium'
      : 'low';
  if (conf === 'low') return null;
  return {
    key: `${item.url}|${item.title}`,
    title: item.title,
    url: item.url,
    date: item.date || extractDate(body),
    type,
    level: level(type),
    agency: SOURCES[sourceId].name,
    subject: manager,
    relation: 'manager',
    confidence: conf,
    measure: type,
    summary: item.title,
    query: SOURCES[sourceId].name,
    updatedAt: new Date().toISOString(),
    source: 'official'
  };
}

async function crawlSource(env, sourceId, manager) {
  const source = SOURCES[sourceId];
  const debug = {
    fetched: false,
    url: source.base,
    finalUrl: null,
    httpStatus: null,
    elapsedMs: null,
    items: 0,
    parsed: 0,
    matched: 0,
    afterConfidenceFilter: 0,
    error: null
  };
  const records = [];

  let page;
  try {
    page = await fetchUpstream(source.base, UPSTREAM_TIMEOUT);
    debug.fetched = true;
    debug.finalUrl = page.meta.finalUrl;
    debug.httpStatus = page.meta.status;
    debug.elapsedMs = page.meta.elapsedMs;
  } catch (e) {
    debug.error = e?.message || '请求失败';
    return { records, debug };
  }

  const html = page.text;
  const allAnchors = listAnchors(html, source.base);
  debug.items = allAnchors.length;
  const items = allAnchors.filter(x => RISK_TITLE.test(x.title) && !NON_RISK.test(x.title));
  debug.parsed = items.length;

  // Only fetch a small number of detail pages. The list page itself is enough
  // to prove upstream connectivity; details are used only to improve confidence.
  for (const item of items.slice(0, 24)) {
    if (!entityMatches(item.title, manager)) continue;
    debug.matched++;
    try {
      const detail = await fetchUpstream(item.url, DETAIL_TIMEOUT);
      const record = makeRecord(item, detail.text, sourceId, manager);
      if (record) {
        records.push(record);
        debug.afterConfidenceFilter++;
      }
    } catch {
      // A detail page failing must not erase a successfully fetched list page.
      // The list item remains observable through debug.matched.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return { records: dedupe(records), debug };
}

async function crawlOfficial(env, manager) {
  const all = [];
  const sources = {};
  let fetchedCount = 0;

  for (const sourceId of SOURCE_ORDER) {
    const result = await crawlSource(env, sourceId, manager);
    sources[sourceId] = result.debug;
    all.push(...result.records);
    if (result.debug.fetched) fetchedCount++;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const records = dedupe(all);
  const status = fetchedCount === 0
    ? 'failed'
    : records.length === 0
      ? 'no_data'
      : fetchedCount < SOURCE_ORDER.length
        ? 'partial'
        : 'success';

  return {
    records,
    status,
    debug: {
      sources,
      filterStats: {
        beforeEntityMatch: Object.values(sources).reduce((n, s) => n + s.parsed, 0),
        afterEntityMatch: Object.values(sources).reduce((n, s) => n + s.matched, 0),
        afterConfidenceFilter: records.length
      }
    }
  };
}

function calcRiskScore(records = []) {
  if (!records.length) {
    return {
      score: null,
      level: '数据不足',
      reason: '暂未检索到公开监管记录，不代表没有风险'
    };
  }
  let penalty = 0;
  const now = Date.now();
  for (const r of records) {
    let weight = r.type === '行政处罚' || r.type === '市场禁入'
      ? 25
      : r.type === '纪律处分'
        ? 15
        : r.type === '警示函' || r.type === '监管措施'
          ? 8
          : 3;
    if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      const years = Math.max(0, (now - Date.parse(r.date)) / 31557600000);
      if (years < 1) weight *= 1.5;
      else if (years < 3) weight *= 1.2;
      else if (years > 5) weight *= 0.6;
    }
    penalty += weight;
  }
  const score = Math.max(5, Math.round(100 - Math.min(90, penalty)));
  return {
    score,
    level: score < 50 ? '高风险' : score < 75 ? '中等风险' : '低风险',
    reason: `基于 ${records.length} 条公开监管记录计算`
  };
}

function validDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function allowedRiskUrl(v) {
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol) &&
      (u.hostname === 'csrc.gov.cn' || u.hostname.endsWith('.csrc.gov.cn'));
  } catch {
    return false;
  }
}

async function submitRisk(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return response({ ok: false, error: '请求数据格式错误' }, 400); }

  const manager = String(body?.manager || '').trim().slice(0, 120);
  const relation = String(body?.relation || '').trim();
  const subject = String(body?.subject || '').trim().slice(0, 120);
  const type = String(body?.type || '').trim();
  const date = String(body?.date || '').trim();
  const title = String(body?.title || '').trim().slice(0, 500);
  const url = String(body?.url || '').trim().slice(0, 2000);
  const summary = String(body?.summary || '').trim().slice(0, 200);
  const code = String(body?.code || '').trim().slice(0, 30);
  const name = String(body?.name || '').trim().slice(0, 120);

  if (!manager || !relation || !subject || !type || !date || !title || !url) {
    return response({ ok: false, error: '请完整填写所有必填字段' }, 400);
  }
  if (!RELATIONS.includes(relation)) return response({ ok: false, error: '关联类型无效' }, 400);
  if (!RISK_TYPES.includes(type)) return response({ ok: false, error: '处罚类型无效' }, 400);
  if (!validDate(date)) return response({ ok: false, error: '决定日期格式必须为 YYYY-MM-DD' }, 400);
  if (!allowedRiskUrl(url)) return response({ ok: false, error: '原文链接必须来自中国证监会或地方证监局官网' }, 400);

  const data = await readManagerData(env, manager);
  const fingerprint = norm(url) + '|' + norm(title);
  if ((data.records || []).some(r => recordKey(r) === fingerprint)) {
    return response({ ok: false, error: '该记录已提交过' }, 409);
  }

  const rateKey = `risk:submit-rate:${norm(manager)}`;
  let rate = await storageGet(env, rateKey);
  if (!rate || Date.now() - rate.startedAt > RATE_WINDOW * 1000) {
    rate = { count: 0, startedAt: Date.now() };
  }
  if (rate.count >= RATE_LIMIT) {
    return response({ ok: false, error: '提交过于频繁，请 10 分钟后再试' }, 429);
  }
  rate.count++;
  await storagePut(env, rateKey, rate, RATE_WINDOW);

  const id = `risk:pending:${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    id,
    manager,
    relation,
    subject,
    type,
    date,
    title,
    url,
    summary,
    code,
    name,
    source: 'user',
    status: 'pending',
    confidence: 'medium',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await storagePut(env, id, record, 90 * 86400);
  return response({ ok: true, message: '提交成功，等待审核', id });
}

async function listPending(env) {
  if (!env.RISK_KV) {
    return response({ ok: true, records: [], message: '未绑定 RISK_KV，待审列表暂无法枚举' });
  }
  const list = await env.RISK_KV.list({ prefix: 'risk:pending:' });
  const records = [];
  for (const item of list.keys) {
    const record = await env.RISK_KV.get(item.name, 'json');
    if (record?.status === 'pending') records.push(record);
  }
  records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return response({ ok: true, records });
}

async function approveRisk(request, env) {
  if (!env.RISK_KV) return response({ ok: false, error: '审核功能需要绑定 RISK_KV' }, 503);
  let body;
  try { body = await request.json(); }
  catch { return response({ ok: false, error: '请求数据格式错误' }, 400); }

  const id = String(body?.id || '').trim();
  const action = String(body?.action || '').trim();
  if (!id || !['approve', 'reject'].includes(action)) return response({ ok: false, error: '参数错误' }, 400);

  const record = await env.RISK_KV.get(id, 'json');
  if (!record) return response({ ok: false, error: '待审记录不存在' }, 404);
  if (record.status !== 'pending') return response({ ok: false, error: '该记录已经处理' }, 409);

  if (action === 'reject') {
    record.status = 'rejected';
    record.updatedAt = new Date().toISOString();
    await env.RISK_KV.put(id, JSON.stringify(record), { expirationTtl: 30 * 86400 });
    return response({ ok: true, message: '已拒绝' });
  }

  const data = await readManagerData(env, record.manager);
  record.status = 'approved';
  record.source = 'user';
  record.confidence = 'medium';
  record.updatedAt = new Date().toISOString();
  data.manager = record.manager;
  data.records = dedupe([...(data.records || []), record]);
  await writeManagerData(env, record.manager, data);
  await env.RISK_KV.put(id, JSON.stringify(record), { expirationTtl: 30 * 86400 });
  return response({ ok: true, message: '审核通过，已进入正式风险库', record });
}

async function handleRisk(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const name = String(url.searchParams.get('name') || '').trim();
  let manager = String(url.searchParams.get('manager') || '').trim();
  if (!manager) manager = inferManager(code, name);
  if (!manager) return response({ ok: false, error: '无法根据基金代码或名称识别管理人，请补充 manager 参数' }, 400);

  const force = url.searchParams.get('force') === '1';
  const stored = await readManagerData(env, manager);
  let records = dedupe(stored.records || []);
  let status = stored.status || (records.length ? 'success' : 'no_data');
  let debug = null;

  if (force || !records.length) {
    const official = await crawlOfficial(env, manager);
    debug = official.debug;
    records = dedupe([...(official.records || []), ...records]);
    if (records.length) {
      status = official.status === 'failed' || official.status === 'no_data' ? 'partial' : official.status;
      await writeManagerData(env, manager, {
        ...stored,
        manager,
        aliases: aliases(manager),
        excludes: excludes(manager),
        records,
        lastCrawledAt: new Date().toISOString(),
        lastSuccessAt: official.status === 'failed' ? (stored.lastSuccessAt || null) : new Date().toISOString(),
        latestDate: records.map(r => r.date).filter(Boolean).sort().pop() || stored.latestDate || null,
        status,
        source: '中国证监会总部及地方证监局监管措施列表',
        version: CACHE_VERSION
      });
    } else {
      status = official.status;
    }
  }

  if (!records.length) status = status === 'failed' ? 'failed' : 'no_data';

  return response({
    ok: true,
    status,
    manager,
    code,
    name,
    records,
    riskScore: calcRiskScore(records),
    latest: records[0] || null,
    dataStatus: status === 'success' ? '官方监管列表缓存'
      : status === 'partial' ? '部分来源成功'
      : status === 'failed' ? '官方数据源检索失败'
      : '暂未检索到公开监管记录',
    source: '中国证监会总部及地方证监局监管措施列表',
    ...(force ? { debug } : {})
  });
}

async function runScheduled(env) {
  for (const x of MANAGERS.slice(0, 5)) {
    const manager = x[1];
    try {
      const official = await crawlOfficial(env, manager);
      const stored = await readManagerData(env, manager);
      const records = dedupe([...(official.records || []), ...(stored.records || [])]);
      const now = new Date().toISOString();
      await writeManagerData(env, manager, {
        ...stored,
        manager,
        aliases: aliases(manager),
        excludes: excludes(manager),
        records,
        lastCrawledAt: now,
        lastSuccessAt: official.status === 'failed' ? (stored.lastSuccessAt || null) : now,
        latestDate: records.map(r => r.date).filter(Boolean).sort().pop() || stored.latestDate || null,
        status: official.status,
        source: '中国证监会总部及地方证监局监管措施列表',
        version: CACHE_VERSION
      });
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return response({ ok: true }, 204);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/risk' && request.method === 'GET') return handleRisk(request, env);
      if (url.pathname === '/api/risk/submit' && request.method === 'POST') return submitRisk(request, env);
      if (url.pathname === '/api/risk/pending' && request.method === 'GET') return listPending(env);
      if (url.pathname === '/api/risk/approve' && request.method === 'POST') return approveRisk(request, env);
      return response({ ok: false, error: 'Not Found' }, 404);
    } catch (e) {
      return response({ ok: false, error: e?.message || '服务器内部错误' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  }
};
