// Global regulatory-event index layer.
// The index is built incrementally in Cloudflare Cache API so fund pages only perform
// association against already-crawled regulatory records instead of treating every
// search result as belonging to the current fund.
const CSRC='https://www.csrc.gov.cn/guestweb4/s';
const INDEX_KEY='https://risk-index.internal/v1/global';
const VERSION='risk-index-v1';
const MANAGERS=['华夏基金管理有限公司','易方达基金管理有限公司','广发基金管理有限公司','富国基金管理有限公司','南方基金管理股份有限公司','国泰基金管理有限公司','嘉实基金管理有限公司','建信基金管理有限责任公司','天弘基金管理有限公司','华宝基金管理有限公司','摩根基金管理（中国）有限公司','国海富兰克林基金管理有限公司','万家基金管理有限公司','浦银安盛基金管理有限公司','博时基金管理有限公司','中欧基金管理有限公司','工银瑞信基金管理有限公司','招商基金管理有限公司','鹏华基金管理有限公司','交银施罗德基金管理有限公司','兴证全球基金管理有限公司','银华基金管理股份有限公司','华安基金管理有限公司','汇添富基金管理股份有限公司','兴业基金管理有限公司','中银基金管理有限公司','平安基金管理有限公司','诺安基金管理有限公司','长城基金管理有限公司','东方基金管理股份有限公司','长信基金管理有限责任公司','华泰柏瑞基金管理有限公司','浙商基金管理有限公司','前海开源基金管理有限公司'];
const headers={'User-Agent':'Mozilla/5.0','Accept':'text/html,application/xhtml+xml,text/plain;q=0.9','Accept-Language':'zh-CN,zh;q=0.9'};
const clean=s=>String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const url=h=>{try{return new URL(h,'https://www.csrc.gov.cn').href}catch{return''}};
const date=s=>{const m=String(s).match(/(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/);return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:''};
const type=s=>/市场禁入|证券市场禁入/.test(s)?'市场禁入':/行政处罚|处罚决定书|罚款|没收违法所得/.test(s)?'行政处罚':/警示函/.test(s)?'警示函':/纪律处分/.test(s)?'纪律处分':/监管措施|责令改正|监管谈话|暂不受理|暂停.*业务|限制.*业务|整改/.test(s)?'监管措施':'其他';
const level=t=>t==='行政处罚'||t==='市场禁入'?'high':t==='警示函'||t==='监管措施'||t==='纪律处分'?'medium':'low';
function params(term,page){return new URLSearchParams({siteCode:'bm56000001',checkHandle:'1',pageSize:'20',pageNum:String(page),searchWord:term,column:'全部',searchSource:'0',govWorkBean:'{}',countKey:'0',uc:'0',left_right_index:'0',orderBy:'2',wordPlace:'0'}).toString()}
async function fetchPage(term,page){const c=new AbortController(),tm=setTimeout(()=>c.abort(),6500);try{const r=await fetch(`${CSRC}?${params(term,page)}`,{signal:c.signal,headers});if(!r.ok)throw Error(String(r.status));return await r.text()}finally{clearTimeout(tm)}}
function parse(html,query){const out=[],re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){const u=url(m[1]),title=clean(m[2]);if(!u.includes('csrc.gov.cn')||title.length<4)continue;const context=clean(html.slice(Math.max(0,m.index-700),Math.min(html.length,m.index+1300))),blob=`${title} ${context}`;if(!/(行政处罚|处罚决定书|市场禁入|警示函|监管措施|责令改正|监管谈话|纪律处分)/.test(blob))continue;if(!blob.includes(query))continue;const k=u+'|'+title;if(out.some(x=>x.key===k))continue;const t=type(blob);out.push({key:k,title,url:u,date:date(blob),type:t,level:level(t),agency:(blob.match(/中国证监会|[\u4e00-\u9fa5]{2,12}证监局/)||['中国证监会'])[0],query});}return out}
async function crawlManager(manager){const pages=await Promise.allSettled([1,2,3,4].map(p=>fetchPage(manager,p)));return pages.flatMap((x,i)=>x.status==='fulfilled'?parse(x.value,manager):[])}
async function readIndex(){const c=await caches.default.match(INDEX_KEY);if(!c)return {version:VERSION,records:[],managers:{},updatedAt:''};try{return await c.json()}catch{return {version:VERSION,records:[],managers:{},updatedAt:''}}}
async function writeIndex(index){await caches.default.put(INDEX_KEY,new Response(JSON.stringify(index),{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=86400'}}))}
function norm(s){return String(s||'').replace(/[（）()\s]/g,'').toLowerCase()}
export async function getGlobalIndex(){return readIndex()}
export async function ensureManager(index,manager){if(!manager)return index;if(index.managers?.[manager])return index;const rows=await crawlManager(manager);index.managers=index.managers||{};index.managers[manager]={at:new Date().toISOString(),keys:rows.map(x=>x.key),count:rows.length};const map=new Map(index.records.map(x=>[x.key,x]));for(const x of rows)map.set(x.key,x);index.records=[...map.values()].slice(-5000);index.updatedAt=new Date().toISOString();await writeIndex(index);return index}
export function matchIndex(index,manager,people,fund){const mt=[manager,manager?.replace(/基金管理(有限公司|股份有限公司|有限责任公司)$/,''),manager==='国海富兰克林基金管理有限公司'?'国富基金':'',manager==='摩根基金管理（中国）有限公司'?'摩根基金':''].filter(Boolean).map(norm);const ps=(people||[]).map(norm);const fn=norm(fund);return (index.records||[]).filter(r=>{const b=norm(`${r.title} ${r.query}`);return mt.some(x=>x.length>=3&&b.includes(x))||ps.some(x=>x.length>=2&&b.includes(x))||fn&&b.includes(fn)})}
export {MANAGERS};
