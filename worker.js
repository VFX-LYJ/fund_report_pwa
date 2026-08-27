const CACHE_VERSION = 'v22-risk-user-submit-compat';
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
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  }});
}
function norm(v) { return String(v || '').replace(/[（）()\s\u3000]/g, '').toLowerCase(); }
function clean(v) { return String(v || '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
function managerMeta(manager='') { return MANAGERS.find(x => x[1] === manager) || MANAGERS.find(x => manager.includes(x[1])) || ['', manager, [manager], []]; }
function aliases(manager='') { const x=managerMeta(manager); return [...new Set([manager,x[0],...(x[2]||[])].filter(Boolean))]; }
function excludes(manager='') { return managerMeta(manager)[3] || []; }
function entityMatches(value, manager) { const n=norm(value); if(excludes(manager).some(x=>n.includes(norm(x)))) return false; return aliases(manager).some(x=>n.includes(norm(x))); }

function inferManager(code='', name='') {
  const text = `${code} ${name}`;
  const byCode = { '000001':'华夏基金管理有限公司', '110011':'易方达基金管理有限公司' };
  if (byCode[String(code).replace(/\D/g,'')]) return byCode[String(code).replace(/\D/g,'')];
  for (const x of MANAGERS) if (x[2].some(a => text.includes(a)) || text.includes(x[0])) return x[1];
  return '';
}
function extractDate(v='') { const m=String(v).match(/(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` : ''; }
function classifyType(v='') { if(/市场禁入|证券市场禁入/.test(v))return'市场禁入'; if(/行政处罚/.test(v))return'行政处罚'; if(/纪律处分/.test(v))return'纪律处分'; if(/警示函/.test(v))return'警示函'; if(/监管措施|责令改正|监管谈话|暂停.*业务|限制.*业务|认定为不适当人选|公开谴责/.test(v))return'监管措施'; return'其他'; }
function level(type) { return type==='行政处罚'||type==='市场禁入'?'high':type==='纪律处分'||type==='警示函'||type==='监管措施'?'medium':'low'; }
function listAnchors(html, base) { const out=[]; const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m; while((m=re.exec(html))){let url;try{url=new URL(m[1].replace(/&amp;/g,'&'),base).href}catch{continue} const title=clean(m[2]); if(title.length<5)continue; const around=clean(html.slice(Math.max(0,m.index-450),Math.min(html.length,m.index+700))); out.push({url,title,date:extractDate(`${title} ${around}`)});} return out; }
async function fetchUpstream(url, timeout=8000) { const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeout); try { const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1','Accept':'text/html,application/xhtml+xml,text/plain;q=0.9','Accept-Language':'zh-CN,zh;q=0.9','Referer':'https://www.csrc.gov.cn/','Cache-Control':'no-cache'}}); if(!r.ok)throw new Error(`上游HTTP ${r.status}`); return await r.text(); } catch(e){ if(e?.name==='AbortError')throw new Error('上游请求超时'); throw e; } finally { clearTimeout(t); } }
function cacheRequest(key){return new Request(`https://fund-risk-cache.invalid/${encodeURIComponent(key)}`);}
async function storageGet(env,key){if(env?.RISK_KV){try{return await env.RISK_KV.get(key,'json')}catch{return null}} try{const r=await caches.default.match(cacheRequest(key));return r?await r.json():null}catch{return null}}
async function storagePut(env,key,value,ttl=30*86400){if(env?.RISK_KV){await env.RISK_KV.put(key,JSON.stringify(value),{expirationTtl:ttl});return} try{await caches.default.put(cacheRequest(key),new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${ttl}`}}))}catch{}}
function managerKey(m){return `risk:manager:${m}`;}
function recordKey(r){return `${norm(r?.url)}|${norm(r?.title)}`;}
function dedupe(records=[]){const map=new Map();for(const r of records){const k=r.key||recordKey(r);if(k&&!map.has(k))map.set(k,{...r,key:k});}return [...map.values()].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));}
async function readManagerData(env,m){const v=await storageGet(env,managerKey(m));if(Array.isArray(v))return{manager:m,records:v};return v||{manager:m,records:[]};}
async function writeManagerData(env,m,d){await storagePut(env,managerKey(m),d);}
function makeRecord(item,body,sourceId,manager){const full=`${item.title} ${body}`;const type=classifyType(full);const has=entityMatches(full,manager);const conf=has&&RISK_TITLE.test(item.title)?'high':has&&RISK_TITLE.test(full)?'medium':'low';if(conf==='low')return null;return{key:`${item.url}|${item.title}`,title:item.title,url:item.url,date:item.date||extractDate(body),type,level:level(type),agency:SOURCES[sourceId].name,subject:manager,relation:'manager',confidence:conf,measure:type,summary:item.title,query:SOURCES[sourceId].name,updatedAt:new Date().toISOString(),source:'official'};}
async function crawlSource(env,sourceId,manager){const s=SOURCES[sourceId],debug={fetched:false,items:0,parsed:0,matched:0,afterConfidenceFilter:0,error:null},records=[];let html;try{html=await fetchUpstream(s.base);debug.fetched=true}catch(e){debug.error=e.message||'请求失败';return{records,debug}} const items=listAnchors(html,s.base).filter(x=>RISK_TITLE.test(x.title)&&!NON_RISK.test(x.title));debug.items=(html.match(/<a\b/gi)||[]).length;debug.parsed=items.length;for(const item of items.slice(0,36)){if(!entityMatches(item.title,manager))continue;debug.matched++;try{const body=await fetchUpstream(item.url,7000);const r=makeRecord(item,body,sourceId,manager);if(r){records.push(r);debug.afterConfidenceFilter++;}}catch{}await new Promise(r=>setTimeout(r,350));}return{records:dedupe(records),debug};}
async function crawlOfficial(env,manager){const all=[],sources={};let ok=0;for(const id of SOURCE_ORDER){const x=await crawlSource(env,id,manager);sources[id]=x.debug;all.push(...x.records);if(x.debug.fetched)ok++;await new Promise(r=>setTimeout(r,700));}const records=dedupe(all);const status=ok===0?'failed':records.length===0?'no_data':ok<SOURCE_ORDER.length?'partial':'success';return{records,status,debug:{sources,filterStats:{beforeEntityMatch:Object.values(sources).reduce((n,s)=>n+s.parsed,0),afterEntityMatch:Object.values(sources).reduce((n,s)=>n+s.matched,0),afterConfidenceFilter:records.length}}};}
function calcRiskScore(records=[]){if(!records.length)return{score:null,level:'数据不足',reason:'暂未检索到公开监管记录，不代表没有风险'};let penalty=0;const now=Date.now();for(const r of records){let w=r.type==='行政处罚'||r.type==='市场禁入'?25:r.type==='纪律处分'?15:r.type==='警示函'||r.type==='监管措施'?8:3;if(r.date&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)){const y=Math.max(0,(now-Date.parse(r.date))/31557600000);if(y<1)w*=1.5;else if(y<3)w*=1.2;else if(y>5)w*=.6;}penalty+=w;}const score=Math.max(5,Math.round(100-Math.min(90,penalty)));return{score,level:score<50?'高风险':score<75?'中等风险':'低风险',reason:`基于 ${records.length} 条公开监管记录计算`};}
function validDate(v){return/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));}
function allowedRiskUrl(v){try{const u=new URL(v);return/^https?:$/.test(u.protocol)&&(u.hostname==='csrc.gov.cn'||u.hostname.endsWith('.csrc.gov.cn'));}catch{return false}}
async function submitRisk(request,env){let b;try{b=await request.json()}catch{return response({ok:false,error:'请求数据格式错误'},400)}const manager=String(b?.manager||'').trim().slice(0,120),relation=String(b?.relation||'').trim(),subject=String(b?.subject||'').trim().slice(0,120),type=String(b?.type||'').trim(),date=String(b?.date||'').trim(),title=String(b?.title||'').trim().slice(0,500),url=String(b?.url||'').trim().slice(0,2000),summary=String(b?.summary||'').trim().slice(0,200),code=String(b?.code||'').trim().slice(0,30),name=String(b?.name||'').trim().slice(0,120);if(!manager||!relation||!subject||!type||!date||!title||!url)return response({ok:false,error:'请完整填写所有必填字段'},400);if(!RELATIONS.includes(relation))return response({ok:false,error:'关联类型无效'},400);if(!RISK_TYPES.includes(type))return response({ok:false,error:'处罚类型无效'},400);if(!validDate(date))return response({ok:false,error:'决定日期格式必须为 YYYY-MM-DD'},400);if(!allowedRiskUrl(url))return response({ok:false,error:'原文链接必须来自中国证监会或地方证监局官网'},400);const data=await readManagerData(env,manager),fp=norm(url)+'|'+norm(title);if((data.records||[]).some(r=>recordKey(r)===fp))return response({ok:false,error:'该记录已提交过'},409);const rateKey=`risk:submit-rate:${norm(manager)}`;let rate=await storageGet(env,rateKey);if(!rate||Date.now()-rate.startedAt>RATE_WINDOW*1000)rate={count:0,startedAt:Date.now()};if(rate.count>=RATE_LIMIT)return response({ok:false,error:'提交过于频繁，请 10 分钟后再试'},429);rate.count++;await storagePut(env,rateKey,rate,RATE_WINDOW);const id=`risk:pending:${Date.now()}_${crypto.randomUUID().slice(0,8)}`;const record={id,manager,relation,subject,type,date,title,url,summary,code,name,source:'user',status:'pending',confidence:'medium',submittedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await storagePut(env,id,record,90*86400);return response({ok:true,message:'提交成功，等待审核',id});}
async function listPending(env){if(!env.RISK_KV)return response({ok:true,records:[],message:'未绑定 RISK_KV，待审列表暂无法枚举'});const list=await env.RISK_KV.list({prefix:'risk:pending:'}),records=[];for(const x of list.keys){const r=await env.RISK_KV.get(x.name,'json');if(r?.status==='pending')records.push(r);}records.sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)));return response({ok:true,records});}
async function approveRisk(request,env){if(!env.RISK_KV)return response({ok:false,error:'审核功能需要绑定 RISK_KV'},503);let b;try{b=await request.json()}catch{return response({ok:false,error:'请求数据格式错误'},400)}const id=String(b?.id||'').trim(),action=String(b?.action||'').trim();if(!id||!['approve','reject'].includes(action))return response({ok:false,error:'参数错误'},400);const r=await env.RISK_KV.get(id,'json');if(!r)return response({ok:false,error:'待审记录不存在'},404);if(r.status!=='pending')return response({ok:false,error:'该记录已经处理'},409);if(action==='reject'){r.status='rejected';r.updatedAt=new Date().toISOString();await env.RISK_KV.put(id,JSON.stringify(r),{expirationTtl:30*86400});return response({ok:true,message:'已拒绝'});}const data=await readManagerData(env,r.manager);r.status='approved';r.source='user';r.confidence='medium';r.updatedAt=new Date().toISOString();data.manager=r.manager;data.records=dedupe([...(data.records||[]),r]);await writeManagerData(env,r.manager,data);await env.RISK_KV.put(id,JSON.stringify(r),{expirationTtl:30*86400});return response({ok:true,message:'审核通过，已进入正式风险库',record:r});}

async function handleRisk(request,env){
  const url=new URL(request.url);
  const code=String(url.searchParams.get('code')||'').trim();
  const name=String(url.searchParams.get('name')||'').trim();
  let manager=String(url.searchParams.get('manager')||'').trim();
  // manager is intentionally optional for backward compatibility with the existing app.js.
  if(!manager) manager=inferManager(code,name);
  if(!manager)return response({ok:false,error:'无法根据基金代码或名称识别管理人，请补充 manager 参数'},400);
  const force=url.searchParams.get('force')==='1';
  const stored=await readManagerData(env,manager);
  let records=dedupe(stored.records||[]),status=stored.status||(records.length?'success':'no_data'),debug=null;
  if(force||!records.length){const official=await crawlOfficial(env,manager);debug=official.debug;records=dedupe([...(official.records||[]),...records]);if(records.length){status=official.status==='failed'||official.status==='no_data'?'partial':official.status;await writeManagerData(env,manager,{...stored,manager,aliases:aliases(manager),excludes:excludes(manager),records,lastCrawledAt:new Date().toISOString(),lastSuccessAt:official.status==='failed'?(stored.lastSuccessAt||null):new Date().toISOString(),latestDate:records.map(r=>r.date).filter(Boolean).sort().pop()||stored.latestDate||null,status,source:'中国证监会总部及地方证监局监管措施列表',version:CACHE_VERSION});}else status=official.status;}
  if(!records.length)status=status==='failed'?'failed':'no_data';
  return response({ok:true,status,manager,code,name,records,riskScore:calcRiskScore(records),latest:records[0]||null,dataStatus:status==='success'?'官方监管列表缓存':status==='partial'?'部分来源成功':status==='failed'?'官方数据源检索失败':'暂未检索到公开监管记录',source:'中国证监会总部及地方证监局监管措施列表',...(force?{debug}:{})});
}

async function runScheduled(env){for(const x of MANAGERS.slice(0,5)){const manager=x[1];try{const official=await crawlOfficial(env,manager),stored=await readManagerData(env,manager),records=dedupe([...(official.records||[]),...(stored.records||[])]),now=new Date().toISOString();await writeManagerData(env,manager,{...stored,manager,aliases:aliases(manager),excludes:excludes(manager),records,lastCrawledAt:now,lastSuccessAt:official.status==='failed'?(stored.lastSuccessAt||null):now,latestDate:records.map(r=>r.date).filter(Boolean).sort().pop()||stored.latestDate||null,status:official.status,source:'中国证监会总部及地方证监局监管措施列表',version:CACHE_VERSION});}catch{}await new Promise(r=>setTimeout(r,1200));}}

export default {async fetch(request,env){if(request.method==='OPTIONS')return response({ok:true},204);const u=new URL(request.url);try{if(u.pathname==='/api/risk'&&request.method==='GET')return handleRisk(request,env);if(u.pathname==='/api/risk/submit'&&request.method==='POST')return submitRisk(request,env);if(u.pathname==='/api/risk/pending'&&request.method==='GET')return listPending(env);if(u.pathname==='/api/risk/approve'&&request.method==='POST')return approveRisk(request,env);return response({ok:false,error:'Not Found'},404);}catch(e){return response({ok:false,error:e?.message||'服务器内部错误'},500);}},async scheduled(event,env,ctx){ctx.waitUntil(runScheduled(env));}};
