const CACHE_VERSION = 'v24-risk-admin';
const RATE_WINDOW = 10 * 60;
const RATE_LIMIT = 5;
const RELATIONS = ['manager', 'person', 'fund'];
const RISK_TYPES = ['行政处罚', '警示函', '监管措施', '市场禁入', '纪律处分', '其他'];

// 管理员密码必须通过 Cloudflare Secret 配置：ADMIN_PASSWORD
// 不要把真实密码写进仓库或前端代码。
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

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
      'Cache-Control': 'no-store'
    }
  });
}

function norm(value) {
  return String(value || '').replace(/[（）()\s\u3000]/g, '').toLowerCase();
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

function inferManager(code = '', name = '', supplied = '') {
  if (supplied) return supplied;
  const normalizedCode = String(code).replace(/\D/g, '');
  const known = {
    '000001': '华夏基金管理有限公司',
    '110011': '易方达基金管理有限公司'
  };
  if (known[normalizedCode]) return known[normalizedCode];
  const text = `${code} ${name}`;
  for (const x of MANAGERS) {
    if (text.includes(x[0]) || x[2].some(a => text.includes(a))) return x[1];
  }
  return '';
}

function managerKey(manager) {
  return `risk:manager:${manager}`;
}

function recordKey(record) {
  return `${norm(record?.url)}|${norm(record?.title)}`;
}

function dedupe(records = []) {
  const map = new Map();
  for (const record of records) {
    const key = record.key || recordKey(record);
    if (key && !map.has(key)) map.set(key, { ...record, key });
  }
  return [...map.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function getRiskData(env, manager) {
  if (!env.RISK_KV) return null;
  const value = await env.RISK_KV.get(managerKey(manager), 'json');
  if (!value) return null;
  if (Array.isArray(value)) return { manager, records: value };
  return value;
}

async function putRiskData(env, manager, value) {
  if (!env.RISK_KV) throw new Error('RISK_KV 未绑定，请先在 wrangler.toml 配置 KV namespace');
  await env.RISK_KV.put(managerKey(manager), JSON.stringify(value));
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
  for (const record of records) {
    let weight = record.type === '行政处罚' || record.type === '市场禁入'
      ? 25
      : record.type === '纪律处分'
        ? 15
        : record.type === '警示函' || record.type === '监管措施'
          ? 8
          : 3;
    if (record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      const years = Math.max(0, (now - Date.parse(record.date)) / 31557600000);
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
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) &&
      (u.hostname === 'csrc.gov.cn' || u.hostname.endsWith('.csrc.gov.cn'));
  } catch {
    return false;
  }
}

function sanitizeRiskBody(body = {}) {
  return {
    manager: String(body.manager || '').trim().slice(0, 120),
    relation: String(body.relation || '').trim(),
    subject: String(body.subject || '').trim().slice(0, 120),
    type: String(body.type || '').trim(),
    date: String(body.date || '').trim(),
    title: String(body.title || '').trim().slice(0, 500),
    url: String(body.url || '').trim().slice(0, 2000),
    summary: String(body.summary || '').trim().slice(0, 200),
    code: String(body.code || '').trim().slice(0, 30),
    name: String(body.name || '').trim().slice(0, 120)
  };
}

function validateRiskBody(body) {
  if (!body.manager || !body.relation || !body.subject || !body.type || !body.date || !body.title || !body.url) {
    return '请完整填写所有必填字段';
  }
  if (!RELATIONS.includes(body.relation)) return '关联类型无效';
  if (!RISK_TYPES.includes(body.type)) return '处罚类型无效';
  if (!validDate(body.date)) return '决定日期格式必须为 YYYY-MM-DD';
  if (!allowedRiskUrl(body.url)) return '原文链接必须来自中国证监会或地方证监局官网';
  return '';
}

async function fingerprintExists(env, fingerprint) {
  const managers = MANAGERS.map(x => x[1]);
  for (const manager of managers) {
    const data = await getRiskData(env, manager);
    if ((data?.records || []).some(r => recordKey(r) === fingerprint)) return true;
  }
  const pending = await env.RISK_KV.list({ prefix: 'risk:pending:' });
  for (const item of pending.keys) {
    const record = await env.RISK_KV.get(item.name, 'json');
    if (record && recordKey(record) === fingerprint && record.status !== 'rejected') return true;
  }
  return false;
}

async function checkAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const supplied = request.headers.get('X-Admin-Password') || '';
  return supplied.length > 0 && supplied === env.ADMIN_PASSWORD;
}

async function submitRisk(request, env, approvedByAdmin = false) {
  if (!env.RISK_KV) return response({ ok: false, error: '风险数据库尚未配置 KV，暂时无法提交补充记录' }, 503);
  let body;
  try { body = await request.json(); } catch { return response({ ok: false, error: '请求数据格式错误' }, 400); }
  const input = sanitizeRiskBody(body);
  const error = validateRiskBody(input);
  if (error) return response({ ok: false, error }, 400);

  const fingerprint = `${norm(input.url)}|${norm(input.title)}`;
  if (await fingerprintExists(env, fingerprint)) return response({ ok: false, error: '该记录已提交过' }, 409);

  if (!approvedByAdmin) {
    const rateKey = `risk:submit-rate:${norm(input.manager)}`;
    let rate = await env.RISK_KV.get(rateKey, 'json');
    if (!rate || Date.now() - rate.startedAt >= RATE_WINDOW * 1000) rate = { count: 0, startedAt: Date.now() };
    if (rate.count >= RATE_LIMIT) {
      return response({ ok: false, error: '提交过于频繁，同一管理人 10 分钟最多提交 5 条，请稍后再试' }, 429);
    }
    rate.count += 1;
    await env.RISK_KV.put(rateKey, JSON.stringify(rate), { expirationTtl: RATE_WINDOW });
  }

  const now = new Date().toISOString();
  const id = `risk:${approvedByAdmin ? 'admin' : 'pending'}:${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    id,
    ...input,
    source: 'user',
    status: approvedByAdmin ? 'approved' : 'pending',
    confidence: approvedByAdmin ? 'high' : 'medium',
    submittedAt: now,
    updatedAt: now,
    approvedAt: approvedByAdmin ? now : undefined
  };
  if (!approvedByAdmin) {
    delete record.approvedAt;
    await env.RISK_KV.put(id, JSON.stringify(record), { expirationTtl: 90 * 86400 });
    return response({ ok: true, message: '提交成功，等待审核', id });
  }

  const data = await getRiskData(env, input.manager) || {
    manager: input.manager,
    aliases: aliases(input.manager),
    excludes: excludes(input.manager),
    records: []
  };
  data.manager = input.manager;
  data.aliases = aliases(input.manager);
  data.excludes = excludes(input.manager);
  data.records = dedupe([...(data.records || []), record]);
  data.latestDate = data.records.map(r => r.date).filter(Boolean).sort().pop() || null;
  data.status = 'success';
  data.version = CACHE_VERSION;
  data.updatedAt = now;
  await putRiskData(env, input.manager, data);
  return response({ ok: true, message: '管理员已直接加入正式风险库', record });
}

async function listPending(env) {
  if (!env.RISK_KV) return response({ ok: false, error: 'RISK_KV 未绑定' }, 503);
  const result = await env.RISK_KV.list({ prefix: 'risk:pending:' });
  const records = [];
  for (const item of result.keys) {
    const record = await env.RISK_KV.get(item.name, 'json');
    if (record?.status === 'pending') records.push(record);
  }
  records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return response({ ok: true, records });
}

async function approveRisk(request, env) {
  if (!(await checkAdmin(request, env))) return response({ ok: false, error: '管理员密码错误或未配置' }, 401);
  if (!env.RISK_KV) return response({ ok: false, error: 'RISK_KV 未绑定' }, 503);
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

  const data = await getRiskData(env, record.manager) || {
    manager: record.manager,
    aliases: aliases(record.manager),
    excludes: excludes(record.manager),
    records: []
  };
  const approved = {
    ...record,
    source: 'user',
    status: 'approved',
    confidence: 'medium',
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.manager = record.manager;
  data.aliases = aliases(record.manager);
  data.excludes = excludes(record.manager);
  data.records = dedupe([...(data.records || []), approved]);
  data.latestDate = data.records.map(r => r.date).filter(Boolean).sort().pop() || null;
  data.status = 'success';
  data.version = CACHE_VERSION;
  await putRiskData(env, record.manager, data);
  await env.RISK_KV.put(id, JSON.stringify(approved), { expirationTtl: 30 * 86400 });
  return response({ ok: true, message: '审核通过，已进入正式风险库', record: approved });
}

async function adminPending(request, env) {
  if (!(await checkAdmin(request, env))) return response({ ok: false, error: '管理员密码错误或未配置' }, 401);
  return listPending(env);
}

function makeDebug(data) {
  const records = data?.records || [];
  return {
    storage: { source: 'cloudflare_kv', fetched: Boolean(data), items: records.length, parsed: records.length, matched: records.length },
    filterStats: {
      beforeEntityMatch: records.length,
      afterEntityMatch: records.length,
      afterConfidenceFilter: records.filter(r => r.confidence !== 'low').length
    },
    crawl: {
      mode: 'domestic_crawler_to_kv',
      workerFetchOfficialSite: false,
      lastCrawledAt: data?.lastCrawledAt || null,
      lastSuccessAt: data?.lastSuccessAt || null,
      latestDate: data?.latestDate || null
    }
  };
}

async function handleRisk(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').trim();
  const name = String(url.searchParams.get('name') || '').trim();
  const suppliedManager = String(url.searchParams.get('manager') || '').trim();
  const manager = inferManager(code, name, suppliedManager);
  const force = url.searchParams.get('force') === '1';
  if (!manager) {
    return response({ ok: false, error: '无法根据基金代码或名称识别管理人，请补充 manager 参数' }, 400);
  }
  if (!env.RISK_KV) {
    return response({
      ok: true,
      status: 'failed', manager, code, name, records: [],
      riskScore: { score: null, level: '数据不足', reason: '风险数据库尚未绑定 KV，暂时无法读取官方监管数据' },
      dataStatus: '风险数据库未配置', source: 'Cloudflare KV（国内爬虫写入）',
      ...(force ? { debug: makeDebug(null) } : {})
    });
  }
  const data = await getRiskData(env, manager);
  const records = dedupe(data?.records || []);
  let status;
  if (records.length > 0) status = data?.status === 'partial' ? 'partial' : 'success';
  else if (data?.status === 'failed') status = 'failed';
  else status = 'no_data';
  const riskScore = calcRiskScore(records);
  const dataStatus = status === 'success'
    ? '官方监管列表缓存（国内爬虫写入 KV）'
    : status === 'partial'
      ? '部分官方来源已写入 KV'
      : status === 'failed'
        ? '国内监管数据同步失败'
        : '暂未检索到公开监管记录';
  return response({
    ok: true, status, manager, code, name, records, riskScore,
    latest: records[0] || null, dataStatus,
    source: '中国证监会总部及地方证监局列表（国内爬虫 → KV）',
    ...(force ? { debug: makeDebug(data) } : {})
  });
}

async function runScheduled(env) {
  if (!env.RISK_KV) return;
  await env.RISK_KV.put('risk:meta:worker', JSON.stringify({
    lastWorkerCheckAt: new Date().toISOString(),
    mode: 'domestic_crawler_to_kv',
    workerDirectFetchOfficialSite: false
  }), { expirationTtl: 7 * 86400 });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return response({ ok: true }, 204);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/risk' && request.method === 'GET') return await handleRisk(request, env);
      if (url.pathname === '/api/risk/submit' && request.method === 'POST') return await submitRisk(request, env, false);
      if (url.pathname === '/api/risk/pending' && request.method === 'GET') return await adminPending(request, env);
      if (url.pathname === '/api/risk/approve' && request.method === 'POST') return await approveRisk(request, env);
      if (url.pathname === '/api/risk/admin-add' && request.method === 'POST') {
        if (!(await checkAdmin(request, env))) return response({ ok: false, error: '管理员密码错误或未配置' }, 401);
        return await submitRisk(request, env, true);
      }
      return response({ ok: false, error: 'Not Found' }, 404);
    } catch (error) {
      return response({ ok: false, error: error?.message || '服务器内部错误' }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  }
};
