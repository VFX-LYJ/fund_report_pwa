(() => {
  const major=t=>/行政处罚|市场禁入|刑事|犯罪|罚款|没收/.test(t||'');
  function apply(){
    const box=document.getElementById('riskFilter'),list=document.getElementById('riskList');
    if(!box||!list)return;
    if(box.dataset.v145!=='1'){
      box.dataset.v145='1';
      box.innerHTML='<button class="on" data-risk="全部">全部 <i>0</i></button><button class="risk-major" data-risk="重大风险">重大风险 <i>0</i></button><button class="risk-potential" data-risk="潜在风险">潜在风险 <i>0</i></button>';
      [...box.querySelectorAll('button')].forEach(b=>b.onclick=()=>{const k=b.dataset.risk;[...box.querySelectorAll('button')].forEach(x=>x.classList.toggle('on',x===b));[...list.querySelectorAll('.risk-item')].forEach(x=>x.style.display=k==='全部'||(major(x.querySelector('.risk-tag')?.textContent)?'重大风险':'潜在风险')===k?'':'none')});
    }
    const items=[...list.querySelectorAll('.risk-item')];
    items.forEach(x=>{const b=x.querySelector('.risk-detail');if(b&&!b.dataset.v145){b.dataset.v145='1';b.onclick=()=>{const u=b.dataset.url;if(u){const w=window.open(u,'_blank','noopener,noreferrer');if(!w)location.href=u}}}});
    const m=items.filter(x=>major(x.querySelector('.risk-tag')?.textContent)).length;
    box.querySelector('[data-risk="全部"] i').textContent=items.length;
    box.querySelector('[data-risk="重大风险"] i').textContent=m;
    box.querySelector('[data-risk="潜在风险"] i').textContent=items.length-m;
  }
  new MutationObserver(apply).observe(document.getElementById('main'),{childList:true,subtree:true});
  const s=document.createElement('style');s.textContent='.risk-filter{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.risk-filter::-webkit-scrollbar{display:none}.risk-filter button{flex:none;font-weight:800}.risk-filter i{font-style:normal;font-size:11px;margin-left:3px}.risk-major{border-color:#b42318!important;color:#a01b12!important;background:#fff5f4!important}.risk-potential{border-color:#8a9098!important;color:#626871!important;background:#f7f8fa!important}.risk-filter button.on{background:#17191c!important;color:#fff!important;border-color:#17191c!important}';document.head.appendChild(s);
})();
