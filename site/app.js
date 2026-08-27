const main=document.getElementById('main');
const searchTab=document.getElementById('searchTab');
const favTab=document.getElementById('favTab');
const favKey='fundFavV8';
let fav=JSON.parse(localStorage.getItem(favKey)||'[]'),timer=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function save(){localStorage.setItem(favKey,JSON.stringify(fav));}
function jsonp(url,cb,timeout=10000){return new Promise((ok,no)=>{const s=document.createElement('script');const t=setTimeout(()=>{cleanup();no(new Error('请求超时'))},timeout);function cleanup(){clearTimeout(t);s.remove();try{delete window[cb]}catch{}}window[cb]=d=>{cleanup();ok(d)};s.onerror=()=>{cleanup();no(new Error('数据源暂时无法访问'))};s.src=url;s.async=true;document.head.appendChild(s)})}
async function searchApi(q){const cb='fundSearch_'+Date.now();return jsonp('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key='+encodeURIComponent(q)+'&callback='+cb,cb)}

function sourceUrls(code){return{holdings:'https://fundf10.eastmoney.com/ccmx_'+encodeURIComponent(code)+'.html',reports:'https://fundf10.eastmoney.com/jjgg_'+encodeURIComponent(code)+'_3.html',source:'https://fundf10.eastmoney.com/',csrc:'https://www.csrc.gov.cn/'}}

// 在“当前基金页面”内部切换到来源页，不再创建独立的全屏浮层。
// 来源页仍用固定桌面宽度 + 当前 iPhone 可视宽度等比缩放，避免横向拖动。
function openSource(url,title='来源页面'){
  const previous=main.innerHTML;
  const previousScroll=window.scrollY;
  main.innerHTML='<section class="inline-source"><div class="inline-source-head"><button class="source-back" id="sourceBack">‹ 返回基金</button><strong>'+esc(title)+'</strong><button class="source-refresh" id="sourceReload">↻</button></div><div class="inline-source-viewport"><div class="inline-source-scale"><iframe id="sourceFrame" src="'+esc(url)+'" title="'+esc(title)+'" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></div></section>';
  document.querySelector('.topbar').style.display='none';
  document.querySelector('.tabbar').style.display='none';
  const viewport=document.querySelector('.inline-source-viewport'), box=document.querySelector('.inline-source-scale'), frame=document.getElementById('sourceFrame');
  const BASE=1000;
  function fit(){
    const w=Math.max(320,viewport.clientWidth), h=viewport.clientHeight;
    const scale=Math.min(1,w/BASE);
    box.style.width=BASE+'px';box.style.transform='scale('+scale+')';box.style.transformOrigin='top left';
    box.style.height=(h/scale)+'px';frame.style.width=BASE+'px';frame.style.height=(h/scale)+'px';
  }
  requestAnimationFrame(fit);window.addEventListener('resize',fit);
  document.getElementById('sourceBack').onclick=()=>{window.removeEventListener('resize',fit);main.innerHTML=previous;document.querySelector('.topbar').style.display='';document.querySelector('.tabbar').style.display='';window.scrollTo(0,previousScroll);bindFundEvents();};
  document.getElementById('sourceReload').onclick=()=>{frame.src=url};
}

function searchPage(){searchTab.classList.add('active');favTab.classList.remove('active');main.innerHTML='<section class="hero"><h1>查基金季报</h1><p>输入基金名称或 6 位基金代码</p></section><div class="searchbox"><span>⌕</span><input id="q" autocomplete="off" placeholder="例如：024239 或 华夏全球科技"></div><div class="hint">基金资料由来源网站提供。App 不再抓取、缓存或改写持仓与定期报告内容。</div><div id="r" class="results"></div>';const q=document.getElementById('q');q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>doSearch(q.value.trim()),300)};q.focus()}
async function doSearch(q){const r=document.getElementById('r');if(!q){r.innerHTML='';return}r.innerHTML='<div class="loading">正在搜索……</div>';try{const d=await searchApi(q),a=(d.Datas||[]).filter(x=>x.CODE);r.innerHTML=a.slice(0,15).map(x=>'<button class="card" data-code="'+esc(x.CODE)+'" data-name="'+esc(x.NAME)+'"><div class="card-main"><div class="name">'+esc(x.NAME)+'</div><div class="meta">'+esc(x.CODE)+' · '+esc(x.CATEGORYDESC||x.TYPE||'基金')+'</div></div><div class="chev">›</div></button>').join('')||'<div class="empty">没有找到基金</div>';[...r.querySelectorAll('.card')].forEach(b=>b.onclick=()=>openFund(b.dataset.code,b.dataset.name))}catch(e){r.innerHTML='<div class="error">搜索接口暂时无法访问，请稍后再试。</div>'}}
function favPage(){searchTab.classList.remove('active');favTab.classList.add('active');main.innerHTML='<section class="hero"><h1>我的自选</h1><p>自选保存在这台 iPhone 上</p></section>'+(fav.length?fav.map(x=>'<button class="card" data-code="'+esc(x.code)+'" data-name="'+esc(x.name)+'"><div class="card-main"><div class="name">'+esc(x.name)+'</div><div class="meta">'+esc(x.code)+'</div></div><div class="chev">›</div></button>').join(''):'<div class="empty">还没有自选基金<br><small>搜索基金后进入基金详情即可加入自选</small></div>');[...main.querySelectorAll('.card')].forEach(b=>b.onclick=()=>openFund(b.dataset.code,b.dataset.name))}

async function fetchRiskApi(code,name){
  const u='/api/risk?code='+encodeURIComponent(code)+'&name='+encodeURIComponent(name);
  const r=await fetch(u,{headers:{'Accept':'application/json'}});
  if(!r.ok) throw new Error('风险接口 HTTP '+r.status);
  return await r.json();
}
function riskPage(code,name){
  const u=sourceUrls(code);
  main.innerHTML='<div class="risk-head"><button class="back" id="riskBack">‹ 返回基金</button><div><div class="risk-title">历史风险</div><div class="risk-sub">自动监管风险数据库 · 多关键词多页检索</div></div><button class="risk-refresh" id="riskRefresh">↻</button></div>'+
  '<div class="risk-summary" id="riskSummary"><div class="risk-loading">正在自动检索证监会公开记录……</div></div>'+
  '<div class="risk-filter" id="riskFilter"><button class="on" data-type="全部">全部</button><button data-type="行政处罚">行政处罚</button><button data-type="监管措施">监管措施</button><button data-type="市场禁入">市场禁入</button><button data-type="诚信记录">诚信记录</button><button data-type="其他">其他</button></div>'+
  '<div id="riskList" class="risk-list"></div>'+
  '<div class="risk-note">风险服务按“基金代码 → 基金管理人 → 多关键词、多页证监会公开记录”自动关联；覆盖行政处罚、监管措施、市场禁入、诚信记录，并尽量识别基金经理/责任人员关联记录。管理人或个人被监管，不等于本基金产品本身违法。结果保留官方原文链接。</div>'+
  '<div class="source">信息来源：<button class="plain-link" id="riskOfficial">中国证券监督管理委员会 ↗</button></div>';

  let data={manager:'',records:[]},filter='全部';
  function render(){
    const list=document.getElementById('riskList');
    const arr=(data.records||[]).filter(x=>filter==='全部'||x.type===filter);
    list.innerHTML=arr.length?arr.map(x=>'<article class="risk-item"><div class="risk-item-top"><span class="risk-tag '+(x.type==='行政处罚'||x.level==='high'?'danger':'')+'">'+esc(x.type||'其他')+'</span><time>'+esc(x.date||'日期未识别')+'</time></div><h3>'+esc(x.title||'证监会公开监管记录')+'</h3><p><b>监管机关：</b>'+esc(x.agency||'中国证监会')+'</p><p><b>涉及对象：</b>'+esc(x.subject||data.manager||'未标明')+'</p><p>'+esc(x.summary||'详见官方原文')+'</p><div class="risk-result">'+(x.measure?'<b>监管措施：</b>'+esc(x.measure)+'<br>':'')+(x.result?'<b>处理结果：</b>'+esc(x.result):'')+'</div><button data-url="'+esc(x.url||'https://www.csrc.gov.cn/')+'" class="risk-detail">查看证监会原文 ↗</button></article>').join(''):'<div class="risk-empty"><strong>未检索到匹配的公开监管记录</strong><br><small>这表示当前公开检索未找到匹配项，不代表绝对不存在其他记录。</small></div>';
    [...list.querySelectorAll('.risk-detail')].forEach(b=>b.onclick=()=>openSource(b.dataset.url,'证监会原文'));
  }
  async function load(){
    const sum=document.getElementById('riskSummary'),list=document.getElementById('riskList');
    sum.innerHTML='<div class="risk-loading">正在自动检索证监会公开记录……</div>';list.innerHTML='';
    try{
      data=await fetchRiskApi(code,name);
      const records=data.records||[];
      const counts={行政处罚:records.filter(x=>x.type==='行政处罚').length,监管措施:records.filter(x=>x.type==='监管措施').length,市场禁入:records.filter(x=>x.type==='市场禁入').length,诚信记录:records.filter(x=>x.type==='诚信记录').length};
      sum.innerHTML='<div class="risk-manager"><span>基金</span><b>'+esc(name)+'</b><em>'+esc(code)+'</em></div><div class="risk-manager"><span>管理人</span><b>'+esc(data.manager||'自动识别失败')+'</b></div><div class="risk-manager"><span>数据状态</span><b>'+esc(data.cached?'缓存结果':'刚刚检索')+'</b></div><div class="risk-stats"><div><strong>'+records.length+'</strong><small>关联记录</small></div><div><strong>'+counts['行政处罚']+'</strong><small>行政处罚</small></div><div><strong>'+counts['监管措施']+'</strong><small>监管措施</small></div></div>';
      render();
    }catch(e){
      sum.innerHTML='<div class="risk-error"><b>自动风险检索暂时失败</b><br><small>'+esc(e.message||'网络错误')+'</small><br><button id="riskRetry" class="source-button">重新检索</button></div>';
      document.getElementById('riskRetry').onclick=load;
    }
  }
  document.getElementById('riskBack').onclick=()=>openFund(code,name);
  document.getElementById('riskRefresh').onclick=load;
  [...document.querySelectorAll('#riskFilter button')].forEach(b=>b.onclick=()=>{filter=b.dataset.type;document.querySelectorAll('#riskFilter button').forEach(x=>x.classList.remove('on'));b.classList.add('on');render()});
  document.getElementById('riskOfficial').onclick=()=>openSource(u.csrc,'中国证监会');
  load();
}

// 纯静态 Pages 兼容：风险数据库随站点一起部署，不依赖 /functions、Worker 或 Pages Functions。
// 数据文件 risk-db.js 可在以后更新后直接重新部署。
function buildRiskData(code,name){
  const key=String(code).padStart(6,'0');
  const direct=window.RISK_DB?.funds?.[key];
  const manager=direct?.manager || inferManager(name);
  const managerRecords=manager?(window.RISK_DB?.managers?.[manager]||[]):[];
  const records=[...(direct?.records||[]),...managerRecords.map(x=>({...x,relation:x.relation||'基金管理人/基金经理关联记录'}))];
  const seen=new Set();
  const unique=records.filter(x=>{const k=(x.url||'')+'|'+(x.date||'')+'|'+(x.title||'');if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return {manager,records:unique,updated:window.RISK_DB?.updated||'数据库版本未标注'};
}
function inferManager(name){
  const n=String(name||'');
  const map=[['华夏','华夏基金管理有限公司'],['易方达','易方达基金管理有限公司'],['广发','广发基金管理有限公司'],['富国','富国基金管理有限公司'],['南方','南方基金管理股份有限公司'],['国泰','国泰基金管理有限公司'],['嘉实','嘉实基金管理有限公司'],['建信','建信基金管理有限责任公司'],['天弘','天弘基金管理有限公司'],['华宝','华宝基金管理有限公司'],['摩根','摩根基金管理（中国）有限公司'],['国富','国海富兰克林基金管理有限公司'],['万家','万家基金管理有限公司']];
  const hit=map.find(([k])=>n.includes(k));return hit?hit[1]:'';
}

function openFund(code,name){
  const is=fav.some(x=>x.code===code),u=sourceUrls(code);
  main.innerHTML='<div class="fund-head"><div class="backrow"><button class="back" id="back">‹ 返回</button></div><div class="fund-name">'+esc(name)+'</div><div class="code">'+esc(code)+'</div><button class="fav-button '+(is?'saved':'')+'" id="star"><span>'+(is?'★':'☆')+'</span><b>'+(is?'已加入自选':'加入自选')+'</b></button></div>'+ 
  '<div class="section-title">重要持仓</div><div class="source-card"><div><strong>前十大重仓</strong><p>进入东方财富基金档案的持仓披露页面，并在当前 App 页面内查看。</p></div><button class="source-button" id="holdBtn">查看持仓 ↗</button></div>'+ 
  '<div class="section-title">历史定期报告</div><div class="source-card"><div><strong>基金定期报告</strong><p>进入该基金公告的「定期报告」栏目。</p></div><button class="source-button" id="reportBtn">查看季报 ↗</button></div>'+ 
  '<div class="section-title">历史风险</div><button class="risk-entry" id="riskBtn"><div><strong>自动风险数据库</strong><p>自动识别基金管理人，整理证监会行政处罚、监管措施、市场禁入等历史记录。</p></div><span>›</span></button>'+ 
  '<div class="source-tip">来源网站在当前基金界面内打开；左上角蓝色「‹ 返回基金」返回本基金。网页按当前 iPhone 可视宽度自动缩放。</div><div class="source">信息来源：<button class="plain-link" id="sourceLink">东方财富基金数据 ↗</button></div>';
  bindFundEvents();
}

function bindFundEvents(){
  const back=document.getElementById('back'); if(back) back.onclick=()=>searchPage();
  const star=document.getElementById('star'); if(star) star.onclick=()=>{
    const code=document.querySelector('.code')?.textContent.trim()||'';const name=document.querySelector('.fund-name')?.textContent.trim()||'';const i=fav.findIndex(x=>x.code===code);if(i>=0)fav.splice(i,1);else fav.unshift({code,name});save();const active=fav.some(x=>x.code===code);star.classList.toggle('saved',active);star.querySelector('span').textContent=active?'★':'☆';star.querySelector('b').textContent=active?'已加入自选':'加入自选';
  };
  const code=document.querySelector('.code')?.textContent.trim();if(!code)return;const u=sourceUrls(code);
  const hold=document.getElementById('holdBtn');if(hold)hold.onclick=()=>openSource(u.holdings,'基金持仓');
  const report=document.getElementById('reportBtn');if(report)report.onclick=()=>openSource(u.reports,'定期报告');
  const source=document.getElementById('sourceLink');if(source)source.onclick=()=>openSource(u.source,'信息来源');
  const csrc=document.getElementById('csrcLink');if(csrc)csrc.onclick=()=>openSource(u.csrc,'中国证监会');
  const risk=document.getElementById('riskBtn');if(risk)risk.onclick=()=>riskPage(code,document.querySelector('.fund-name')?.textContent.trim()||'');
}
searchTab.onclick=searchPage;favTab.onclick=favPage;searchPage();
