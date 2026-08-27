/* V14.5 UI patch: 保留 V14.1 可用的数据抓取，展示层简化为两类 */
(() => {
  let searchHTML = '', searchQuery = '';
  const saveSearch = () => { const q=document.getElementById('q'), r=document.getElementById('r'); if(q&&r){searchQuery=q.value||'';searchHTML=main.innerHTML;} };
  const restoreSearch = () => { if(!searchHTML)return false; main.innerHTML=searchHTML; const q=document.getElementById('q'); if(q){q.value=searchQuery;q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>doSearch(q.value.trim()),300)}} [...main.querySelectorAll('#r .card')].forEach(b=>b.onclick=()=>openFund(b.dataset.code,b.dataset.name)); return true; };
  const oldSearch=searchPage, oldFav=favPage;
  searchTab.onclick=()=>{searchTab.classList.add('active');favTab.classList.remove('active');if(!restoreSearch())oldSearch();};
  favTab.onclick=()=>{saveSearch();oldFav();};
  const oldOpenFund=openFund; window.openFund=(code,name)=>{saveSearch();return oldOpenFund(code,name);};

  // 信息来源直接打开官方 URL，不使用 iframe。
  window.openSource=(url,title='信息来源')=>{if(!url)return;const w=window.open(url,'_blank','noopener,noreferrer');if(!w)location.href=url;};

  // 两栏：重大风险 / 潜在风险。具体官方文书仍保留原类型和原文链接。
  const majorType=t=>/行政处罚|市场禁入|刑事|犯罪|罚款|没收/.test(t||'');
  const oldRisk=riskPage;
  window.riskPage=function(code,name){oldRisk(code,name);setTimeout(()=>{
    const box=document.getElementById('riskFilter'), list=document.getElementById('riskList'); if(!box||!list)return;
    box.innerHTML='<button class="risk-all on" data-risk="全部">全部 <i>0</i></button><button class="risk-major" data-risk="重大风险">重大风险 <i>0</i></button><button class="risk-potential" data-risk="潜在风险">潜在风险 <i>0</i></button>';
    const classify=item=>majorType(item.querySelector('.risk-tag')?.textContent.trim())?'重大风险':'潜在风险';
    const apply=k=>{[...list.querySelectorAll('.risk-item')].forEach(x=>x.style.display=k==='全部'||classify(x)===k?'':'none');[...box.querySelectorAll('button')].forEach(x=>x.classList.toggle('on',x.dataset.risk===k));};
    const count=()=>{const a=[...list.querySelectorAll('.risk-item')];const m=a.filter(x=>classify(x)==='重大风险').length;box.querySelector('[data-risk="全部"] i').textContent=a.length;box.querySelector('[data-risk="重大风险"] i').textContent=m;box.querySelector('[data-risk="潜在风险"] i').textContent=a.length-m;};
    [...box.querySelectorAll('button')].forEach(b=>b.onclick=()=>apply(b.dataset.risk)); count();
    // 覆盖原文按钮，保证每一条记录使用自己的真实 URL。
    [...list.querySelectorAll('.risk-detail')].forEach(b=>b.onclick=()=>window.openSource(b.dataset.url,'信息来源'));
  },350); };
  const style=document.createElement('style');style.textContent='.risk-filter{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.risk-filter::-webkit-scrollbar{display:none}.risk-filter button{flex:none;font-weight:800}.risk-filter i{font-style:normal;font-size:11px;margin-left:3px}.risk-major{border-color:#b42318!important;color:#a01b12!important;background:#fff5f4!important}.risk-potential{border-color:#8a9098!important;color:#626871!important;background:#f7f8fa!important}.risk-filter button.on{background:#17191c!important;color:#fff!important;border-color:#17191c!important}';document.head.appendChild(style);
})();
