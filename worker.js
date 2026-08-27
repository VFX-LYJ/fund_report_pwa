const CSRC_SEARCH = 'https://www.csrc.gov.cn/guestweb4/s';
const EASTMONEY_FUND = code => `https://fund.eastmoney.com/${encodeURIComponent(code)}.html`;
const TTL = 6 * 60 * 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function responseJSON(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json;charset=UTF-8', ...CORS, ...extra}});
}
function clean(s=''){return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function decodeHtml(s=''){return s.replace(/&#(\\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function absUrl(href){if(!href)return ''; try{return new URL(href,'https://www.csrc.gov.cn').href}catch{return ''}}
function inferType(title, text){const s=(title+' '+text); if(/行政处罚|处罚决定书|罚款|没收违法所得/.test(s))return '行政处罚'; if(/市场禁入|证券市场禁入/.test(s))return '市场禁入'; if(/监管措施|警示函|责令改正|监管谈话|暂不受理|暂停业务|监管决定/.test(s))return '监管措施'; return '其他'}
function parseDate(s){const m=s.match(/(20\\d{2})[-年\/.](\\d{1,2})[-月\/.](\\d{1,2})/); return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:''}
function parseSearch(html, manager){
  const out=[]; const seen=new Set();
  const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html))){
    const url=absUrl(decodeHtml(m[1])); const title=clean(decodeHtml(m[2]));
    if(!url||!title||!url.includes('csrc.gov.cn')||title.length<4)continue;
    const context=clean(decodeHtml(html.slice(Math.max(0,m.index-500),Math.min(html.length,m.index+1200))));
    if(!/行政处罚|监管措施|警示函|责令改正|监管谈话|市场禁入|暂不受理|暂停|处罚决定书|监管决定/.test(title+' '+context))continue;
    if(!new RegExp(manager.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&'),'i').test(title+' '+context) && !/基金|证券投资基金|基金管理/.test(title+' '+context))continue;
    const key=url+'|'+title;if(seen.has(key))continue;seen.add(key);
    out.push({title,url,date:parseDate(title+' '+context),type:inferType(title,context),agency:/北京证监局/.test(context)?'北京证监局':'中国证监会',subject:manager,summary:title,measure:inferMeasure(title+' '+context),result:''});
    if(out.length>=60)break;
  }
  return out;
}
function inferMeasure(s){const hits=['责令改正','出具警示函','监管谈话','暂不受理行政许可','暂停相关业务','限制业务活动','市场禁入'];return hits.filter(x=>s.includes(x)).join('、')}
async function fetchText(url,init={}){const r=await fetch(url,{...init,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1','Accept':'text/html,application/xhtml+xml'}});if(!r.ok)throw new Error('上游返回 '+r.status);return await r.text()}
async function identifyManager(code,name){
  try{const html=await fetchText(EASTMONEY_FUND(code)); const text=clean(decodeHtml(html));
    const patterns=[/基金管理人[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\\-]{4,60}基金管理(?:有限公司|股份有限公司|有限责任公司))/,
      /管理人[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\\-]{4,60}基金管理(?:有限公司|股份有限公司|有限责任公司))/];
    for(const p of patterns){const m=text.match(p);if(m)return m[1].trim()}
  }catch(e){}
  const map=[['华夏','华夏基金管理有限公司'],['易方达','易方达基金管理有限公司'],['广发','广发基金管理有限公司'],['富国','富国基金管理有限公司'],['南方','南方基金管理股份有限公司'],['国泰','国泰基金管理有限公司'],['嘉实','嘉实基金管理有限公司'],['建信','建信基金管理有限责任公司'],['天弘','天弘基金管理有限公司'],['华宝','华宝基金管理有限公司'],['摩根','摩根基金管理（中国）有限公司'],['国富','国海富兰克林基金管理有限公司'],['万家','万家基金管理有限公司'],['浦银','浦银安盛基金管理有限公司']];
  return map.find(([k])=>String(name).includes(k))?.[1]||'';
}
async function searchCsrc(manager, term, pageNum=1){
  const params=new URLSearchParams({siteCode:'bm56000001',checkHandle:'1',pageSize:'20',pageNum:String(pageNum),searchWord:term,column:'全部',searchSource:'0',govWorkBean:'{}',countKey:'0',uc:'0',left_right_index:'0',checkHandle:'1',orderBy:'2',wordPlace:'0'});
  const html=await fetchText(CSRC_SEARCH+'?'+params.toString()); return parseSearch(html,manager);
}
async function risk(request){
  const u=new URL(request.url); const code=(u.searchParams.get('code')||'').replace(/\D/g,'').slice(0,6); const name=u.searchParams.get('name')||'';
  if(!code)return responseJSON({error:'missing code'},400);
  const cacheKey=new Request(new URL('/api/risk?code='+code+'&name='+encodeURIComponent(name),u.origin).href);
  const cache=caches.default; const cached=await cache.match(cacheKey); if(cached){const data=await cached.json(); data.cached=true; return responseJSON(data,200)}
  const manager=await identifyManager(code,name); if(!manager)return responseJSON({manager:'',records:[],error:'无法自动识别基金管理人'},200);
  const terms=[manager,manager.replace(/基金管理(有限公司|股份有限公司|有限责任公司)$/,''),name].filter(Boolean);
  let all=[];
  for(const t of terms){try{all=all.concat(await searchCsrc(manager,t,1),await searchCsrc(manager,t,2));}catch(e){}}
  const seen=new Set(); all=all.filter(x=>{const k=x.url+'|'+x.title;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,100);
  const data={ok:true,code,name,manager,records:all,updatedAt:new Date().toISOString(),source:'中国证监会公开信息检索'};
  const resp=responseJSON(data); const cacheResp=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json;charset=UTF-8', 'Cache-Control':`public,max-age=${TTL}`}}); await cache.put(cacheKey,cacheResp); return resp;
}
export default {async fetch(request,env){const u=new URL(request.url);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(u.pathname==='/api/risk'&&request.method==='GET')return risk(request);if(env.ASSETS)return env.ASSETS.fetch(request);return new Response('Fund PWA v12',{status:200,headers:{'Content-Type':'text/plain;charset=UTF-8'}})}};
