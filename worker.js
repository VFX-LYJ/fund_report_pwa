const CACHE_VERSION = 'v22-risk-user-submit';
const CACHE_TTL = 12 * 60 * 60;
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
  csrc: { id: 'csrc', name: '证监会总部', base: 'https://www.csrc.gov.cn/csrc/c106259/common_list_gd.shtml' },
  beijing: { id: 'beijing', name: '北京证监局', base: 'https://www.csrc.gov.cn/csrc/c100045/common_list_gd.shtml' },
  shanghai: { id: 'shanghai', name: '上海证监局', base: 'https://www.csrc.gov.cn/csrc/c100053/common_list_gd.shtml' }
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

function norm(value) {
  return String(value || '').replace(/[（）()\s\u3000]/g, '').toLowerCase();
}

function clean(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function managerMeta(manager = '') {
  return MANAGERS.find(x => x[1] === manager) || MANAGERS.find(x => manager.includes(x[1])) || ['', manager, [manager], []];
}

function aliases(manager = '') {
  const item = managerMeta(manager);
  return [...new Set([manager, item[0], ...(item[2] || [])].filter(Boolean))];
}

function excludes(manager = '') {
  return managerMeta(manager)[3] || [];
}

function entityMatches(value, manager) {
  const n = norm(value);
  if (excludes(manager).some(x => n.includes(norm(x)))) return false;
  return aliases(manager).some(x => n.includes(norm(x)));
}

function extractDate(value = '') {
  const m = String(value).match(/(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}` : '';
}

function classifyType(value = '') {
  if (/市场禁入|证券市场禁入/.test(value)) return '市场禁入';
  if (/行政处罚/.test(value)) return '行政处罚';
  if (/纪律处分/.test(value)) return '纪律处分';
  if (/警示函/.test(value)) return '警示函';
  if (/监管措施|责令改正|监管谈话|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责/.test(value)) return '监管措施';
  return '其他';
}

function level(type) {
  return type === '行政处罚' || type === '市场禁入' ? 'high' :
    type === '纪律处分' || type === '警示函' || type === '监管措施' ? 'medium' : 'low';
}

function confidence({ relation, title, body, manager, person = '', fund = '' }) {
  const titleN = norm(title);
  const bodyN = norm(body);
  const hasManager = entityMatches(`${title} ${body}`, manager);
  const risk = RISK_TITLE.test(`${title} ${body}`);

  if (relation === 'manager') {
    if (hasManager && RISK_TITLE.test(title)) return 'high';
    if (hasManager && risk) return 'medium';
    return 'low';
  }
  if (relation === 'person') {
    const p = norm(person);
    const personMatch = p && (titleN.includes(p) || bodyN.includes(p));
    return personMatch && /基金经理|任职|现任|时任|管理人/.test(body) && hasManager && risk ? 'high' :
      personMatch && hasManager ? 'medium' : 'low';
  }
  const f = norm(fund);
  const fundMatch = f && (titleN.includes(f) || bodyN.includes(f));
  return fundMatch && risk ? 'high' : fundMatch ? 'medium' : 'low';
}

function listAnchors(html, base) {
  const result = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    let url;
    try { url = new URL(match[1].replace(/&amp;/g, '&'), base).href; } catch { continue; }
    const title = clean(match[2]);
    if (title.length < 5) continue;
    const around = clean(html.slice(Math.max(0, match.index - 450), Math.min(html.length, match.index + 700)));
    result.push({ url, title, date: extractDate(`${title} ${around}`), around });
  }
  return result;
}

function parseList(sourceId, html) {
  const source = SOURCES[sourceId];
  return listAnchors(html, source.base).filter(item => RISK_TITLE.test(item.title) && !NON_RISK.test(item.title));
}

async function fetchUpstream(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.csrc.gov.cn/',
        'Cache-Control': 'no-cache'
      }
    });
    if (!r.ok) throw new Error(`上游HTTP ${r.status}`);
    return await r.text();
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('上游请求超时');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function makeOfficialRecord(item, body, sourceId, manager) {
  const full = `${item.title} ${body}`;
  const type = classifyType(full);
  const conf = confidence({ relation: 'manager', title: item.title, body, manager });
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

function recordKey(record) {
  return `${norm(record?.url)}|${norm(record?.title)}`;
}

function dedupe(records = []) {
  const map = new Map();
  for (const record of records) {
    const k = record.key || recordKey(record);
    if (k && !map.has(k)) map.set(k, { ...record, key: k });
  }
  return [...map.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
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
  } catch { return null; }
}

async function storagePut(env, key, value, ttl = 30 * 86400) {
  if (env?.RISK_KV) {
    await env.RISK_KV.put(key, JSON.stringify(value), { expirationTtl: ttl });
    return;
  }
  try {
    await caches.default.put(cacheRequest(key), new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public,max-age=${ttl}` }
    }));
  } catch {}
}

function managerKey(manager) {
  return `risk:manager:${manager}`;
}

function sourceMetaKey(sourceId) {
  return `risk:source:${sourceId}`;
}

async function readManagerData(env, manager) {
  const value = await storageGet(env, managerKey(manager));
  if (Array.isArray(value)) return { manager, records: value };
  return value || { manager, records: [] };
}

async function writeManagerData(env, manager, data) {
  await storagePut(env, managerKey(manager), data);
}

async function crawlSource(env, sourceId, manager, maxPages = 3, maxDetails = 12) {
  const source = SOURCES[sourceId];
  const debug = { fetched: false, items: 0, parsed: 0, matched: 0, error: null };
  const records = [];
  const pages = [source.base];
  const seenPages = new Set();

  for (let page = 0; page < maxPages && page < pages.length; page++) {
    const pageUrl = pages[page];
    if (seenPages.has(pageUrl)) continue;
    seenPages.add(pageUrl);
    let html;
    try {
      html = await fetchUpstream(pageUrl, 8000);
      debug.fetched = true;
    } catch (error) {
      debug.error = error.message || '请求失败';
      continue;
    }

    const items = parseList(sourceId, html);
    debug.items += (html.match(/<a\b/gi) || []).length;
    debug.parsed += items.length;

    for (const item of items) {
      if (records.length >= maxDetails) break;
      if (!entityMatches(item.title, manager)) continue;
      debug.matched++;
      try {
        const body = await fetchUpstream(item.url, 7000);
        const record = makeOfficialRecord(item, body, sourceId, manager);
        if (record) records.push(record);
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    const next = listAnchors(html, pageUrl).find(x => x.url !== pageUrl && (/下一页|下一頁/.test(x.title) || /common_list_gd_\d+/.test(x.url)));
    if (next && !seenPages.has(next.url)) pages.push(next.url);
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  const oldMeta = await storageGet(env, sourceMetaKey(sourceId));
  const now = new Date().toISOString();
  await storagePut(env, sourceMetaKey(sourceId), {
    sourceId,
    lastCrawledAt: now,
    lastSuccessAt: debug.fetched ? now : (oldMeta?.lastSuccessAt || null),
    latestDate: records.map(x => x.date).filter(Boolean).sort().pop() || oldMeta?.latestDate || null,
    status: debug.fetched ? 'ok' : 'failed'
  });
  return { records: dedupe(records), debug };
}

async function crawlOfficial(env, manager) {
  const all = [];
  const sources = {};
  let successfulSources = 0;

  for (const sourceId of SOURCE_ORDER) {
    const result = await crawlSource(env, sourceId, manager, 3, 12);
    sources[sourceId] = result.debug;
    all.push(...result.records);
    if (result.debug.fetched) successfulSources++;
    await new Promise(resolve => setTimeout(resolve, 900));
  }

  const records = dedupe(all);
  let status = 'success';
  if (successfulSources === 0) status = 'failed';
  else if (!records.length) status = 'no_data';
  else if (successfulSources < SOURCE_ORDER.length) status = 'partial';

  return {
    records,
    status,
    debug: { sources, filterStats: { beforeEntityMatch: Object.values(sources).reduce((n, s) => n + (s.parsed || 0), 0), afterEntityMatch: records.length, afterConfidenceFilter: records.length } }
  };
}

function calcRiskScore(records = []) {
  if (!records.length) return {
    score: null,
    level: '数据不足',
    reason: '暂未检索到公开监管记录，不代表没有风险'
  };

  let penalty = 0;
  const now = Date.now();
  for (const record of records) {
    let weight = record.type === '行政处罚' || record.type === '市场禁入' ? 25 :
      record.type === '纪律处分' ? 15 :
      record.type === '警示函' || record.type === '监管措施' ? 8 : 3;
    if (record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      const years = Math.max(0, (now - Date.parse(record.date)) / (365.25 * 86400000));
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

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function allowedRiskUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'csrc.gov.cn' || url.hostname.endsWith('.csrc.gov.cn'));
  } catch { return false; }
}

async function submitRisk(request, env) {
  let body;
  try { body = await request.json(); } catch { return response({ ok: false, error: '请求数据格式错误' }, 400); }

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

  if (!manager || !relation || !subject || !type || !date || !title || !url) return response({ ok: false, error: '请完整填写所有必填字段' }, 400);
  if (!RELATIONS.includes(relation)) return response({ ok: false, error: '关联类型无效' }, 400);
  if (!RISK_TYPES.includes(type)) return response({ ok: false, error: '处罚类型无效' }, 400);
  if (!validDate(date)) return response({ ok: false, error: '决定日期格式必须为 YYYY-MM-DD' }, 400);
  if (!allowedRiskUrl(url)) return response({ ok: false, error: '原文链接必须来自中国证监会或地方证监局官网' }, 400);

  const existingData = await readManagerData(env, manager);
  const fingerprint = norm(url) + '|' + norm(title);
  if ((existingData.records || []).some(record => recordKey(record) === fingerprint)) return response({ ok: false, error: '该记录已提交过' }, 409);

  const rateKey = `risk:submit-rate:${norm(manager)}`;
  let rate = await storageGet(env, rateKey);
  if (!rate || Date.now() - rate.startedAt > RATE_WINDOW * 1000) rate = { count: 0, startedAt: Date.now() };
  if (rate.count >= RATE_LIMIT) return response({ ok: false, error: '提交过于频繁，请 10 分钟后再试' }, 429);
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
  if (!env.RISK_KV) return response({ ok: true, records: [], message: '未绑定 RISK_KV，待审列表暂无法枚举' });
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
  try { body = await request.json(); } catch { return response({ ok: false, error: '请求数据格式错误' }, 400); }
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
  const merged = dedupe([...(data.records || []), record]);
  data.manager = record.manager;
  data.records = merged;
  data.lastSuccessAt = data.lastSuccessAt || new Date().toISOString();
  await writeManagerData(env, record.manager, data);
  await env.RISK_KV.put(id, JSON.stringify(record), { expirationTtl: 30 * 86400 });
  return response({ ok: true, message: '审核通过，已进入正式风险库', record });
}

async function handleRisk(request, env) {
  const url = new URL(request.url);
  const manager = String(url.searchParams.get('manager') || '').trim();
  if (!manager) return response({ ok: false, error: '缺少 manager 参数' }, 400);

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
      status = official.status === 'failed' ? 'partial' : official.status === 'no_data' ? 'partial' : official.status;
      await writeManagerData(env, manager, {
        ...stored,
        manager,
        aliases: aliases(manager),
        excludes: excludes(manager),
        records,
        lastCrawledAt: new Date().toISOString(),
        lastSuccessAt: official.status === 'failed' ? (stored.lastSuccessAt || null) : new Date().toISOString(),
        latestDate: records.map(x => x.date).filter(Boolean).sort().pop() || stored.latestDate || null,
        status,
        source: '中国证监会总部及地方证监局监管措施列表',
        version: CACHE_VERSION
      });
    } else {
      status = official.status;
    }
  }

  if (!records.length) status = status === 'failed' ? 'failed' : 'no_data';
  const riskScore = calcRiskScore(records);
  return response({
    ok: true,
    status,
    manager,
    records,
    riskScore,
    latest: records[0] || null,
    dataStatus: status === 'success' ? '官方监管列表缓存' : status === 'partial' ? '部分来源成功' : status === 'failed' ? '官方数据源检索失败' : '暂未检索到公开监管记录',
    source: '中国证监会总部及地方证监局监管措施列表',
    ...(force ? { debug } : {})
  });
}

async function runScheduled(env) {
  const managers = MANAGERS.slice(0, 5);
  for (const item of managers) {
    const manager = item[1];
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
        latestDate: records.map(x => x.date).filter(Boolean).sort().pop() || stored.latestDate || null,
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
    } catch (error) {
      return response({ ok: false, error: error?.message || '服务器内部错误' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  }
};
