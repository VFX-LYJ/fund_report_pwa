(function(){
  const $=s=>document.querySelector(s),esc2=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const legacyRiskPage=window.riskPage,legacyOpenFund=window.openFund,TYPES=['行政处罚','警示函','监管措施','市场禁入','纪律处分','其他'];
  const ADMIN_KEY='fundRiskAdminPassword';

  function addRiskCard(){
    const host=$('#riskList');
    if(!host)return;
    if(!$('#riskSubmitCard')){
      const c=document.createElement('button');c.type='button';c.id='riskSubmitCard';c.className='risk-user-submit-card';
      c.innerHTML='<div><strong>补充公开风险记录</strong><p>发现遗漏的证监会/证监局公开处罚？可提交原文链接补充</p></div><span>›</span>';
      c.onclick=()=>openRiskSubmit({code:window.__riskCode||'',name:window.__riskName||'',manager:window.__riskManager||''});
      host.insertAdjacentElement('afterend',c);
    }
    addAdminCard(host);
  }

  function addAdminCard(host){
    if($('#riskAdminCard'))return;
    const c=document.createElement('button');c.type='button';c.id='riskAdminCard';c.className='risk-admin-card';
    c.innerHTML='<div><strong>管理员：风险数据库管理</strong><p>管理员可直接录入风险，或审核用户提交记录</p></div><span>›</span>';
    c.onclick=()=>openRiskAdmin({code:window.__riskCode||'',name:window.__riskName||'',manager:window.__riskManager||''});
    host.insertAdjacentElement('afterend',c);
  }

  function addFundRiskHints(code,name,manager){
    window.__riskCode=code||window.__riskCode||'';window.__riskName=name||window.__riskName||'';window.__riskManager=manager||window.__riskManager||'';
    const riskBtn=$('#riskBtn');
    if(!riskBtn)return;
    if(!$('#riskSubmitHint')){
      const x=document.createElement('button');x.type='button';x.id='riskSubmitHint';x.className='risk-user-submit-hint';
      x.textContent='发现遗漏处罚？点击补充 →';x.onclick=()=>openRiskSubmit({code,name,manager:window.__riskManager||''});
      riskBtn.insertAdjacentElement('afterend',x);
    }
    if(!$('#riskAdminHint')){
      const x=document.createElement('button');x.type='button';x.id='riskAdminHint';x.className='risk-admin-hint';
      x.textContent='管理员：风险数据库管理 →';x.onclick=()=>openRiskAdmin({code,name,manager:window.__riskManager||''});
      const anchor=$('#riskSubmitHint')||riskBtn;x.insertAdjacentElement('afterend',x);
    }
  }

  async function decorateUserRecords(code,name){
    try{
      const r=await fetch('/api/risk?code='+encodeURIComponent(code||'')+'&name='+encodeURIComponent(name||''),{headers:{Accept:'application/json'}});
      const d=await r.json();
      const users=(d.records||[]).filter(x=>x.source==='user'&&x.status==='approved');
      if(!users.length)return;
      document.querySelectorAll('.risk-item').forEach(card=>{
        const title=card.querySelector('h3')?.textContent||'';
        if(users.some(x=>x.title===title)&&!card.querySelector('.risk-user-label')){
          const top=card.querySelector('.risk-item-top');
          if(top)top.insertAdjacentHTML('beforeend','<span class="risk-user-label">用户补充 · 已核实</span>');
        }
      });
      const note=document.querySelector('.risk-note');
      if(note&&!note.textContent.includes('用户补充'))note.textContent+=' 部分记录来自用户补充的公开信息，已经过基本校验。';
    }catch{}
  }

  window.riskPage=function(code,name){
    window.__riskCode=code;window.__riskName=name;legacyRiskPage(code,name);
    setTimeout(()=>{addRiskCard();decorateUserRecords(code,name)},100);
  };

  window.openFund=function(code,name){
    legacyOpenFund(code,name);
    setTimeout(()=>{
      const manager=window.__riskManager||'';
      addFundRiskHints(code,name,manager);
    },50);
  };

  function validUrl(v){try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&(u.hostname==='csrc.gov.cn'||u.hostname.endsWith('.csrc.gov.cn'))}catch{return false}}
  async function managerOf(code,name){try{const r=await fetch('/api/risk?code='+encodeURIComponent(code||'')+'&name='+encodeURIComponent(name||''));const d=await r.json();return d.manager||''}catch{return''}}
  function pageShell(title,sub,content){main.innerHTML='<section class="risk-submit-page"><div class="risk-submit-head"><button class="back" id="riskPageBack">‹ 返回</button><div><h1>'+title+'</h1><p>'+sub+'</p></div></div>'+content+'</section>';document.querySelector('.topbar').style.display='none';document.querySelector('.tabbar').style.display='none'}
  function restore(p){document.querySelector('.topbar').style.display='';document.querySelector('.tabbar').style.display='';p?.code?legacyOpenFund(p.code,p.name):legacyRiskPage(p?.code||'',p?.name||'')}

  function formMarkup(prefix,prev,admin){return '<form id="'+prefix+'Form" novalidate><label class="risk-form-field"><span>管理人 <b>*</b></span><input id="'+prefix+'Manager" required placeholder="请输入基金管理人名称" value="'+esc2(prev.manager||'')+'"></label><fieldset class="risk-form-field"><legend>关联类型 <b>*</b></legend><div class="risk-choice" id="'+prefix+'Relation"><button type="button" data-value="manager" class="on">公司级</button><button type="button" data-value="person">人员级</button><button type="button" data-value="fund">产品级</button></div></fieldset><label class="risk-form-field"><span>涉及对象 <b>*</b></span><input id="'+prefix+'Subject" required placeholder="公司级自动使用管理人"></label><label class="risk-form-field"><span>处罚类型 <b>*</b></span><select id="'+prefix+'Type">'+TYPES.map(x=>'<option>'+x+'</option>').join('')+'</select></label><label class="risk-form-field"><span>决定日期 <b>*</b></span><input id="'+prefix+'Date" type="date" required></label><label class="risk-form-field"><span>标题 <b>*</b></span><input id="'+prefix+'Title" required placeholder="请输入决定书完整标题"></label><label class="risk-form-field"><span>原文链接 <b>*</b></span><input id="'+prefix+'Url" type="url" required placeholder="https://www.csrc.gov.cn/..."><small>请粘贴证监会或地方证监局官网的决定书原文链接</small></label><label class="risk-form-field"><span>补充说明</span><textarea id="'+prefix+'Summary" maxlength="200" rows="4" placeholder="选填，最多 200 字"></textarea></label><input type="hidden" id="'+prefix+'Code" value="'+esc2(prev.code||'')+'"><input type="hidden" id="'+prefix+'Name" value="'+esc2(prev.name||'')+'"><div class="risk-submit-error" id="'+prefix+'Error"></div><button class="risk-submit-button" type="submit">'+(admin?'管理员直接加入风险库':'提交补充')+'</button></form>'}

  function bindRiskForm(prefix,prev,admin){
    const form=$('#'+prefix+'Form'),mi=$('#'+prefix+'Manager'),si=$('#'+prefix+'Subject'),rel=$('#'+prefix+'Relation'),url=$('#'+prefix+'Url'),err=$('#'+prefix+'Error');
    const sync=()=>{const v=rel.querySelector('.on').dataset.value;if(v==='manager'){si.value=mi.value;si.readOnly=true}else si.readOnly=false};
    rel.querySelectorAll('button').forEach(b=>b.onclick=()=>{rel.querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');sync()});
    mi.oninput=()=>sync();sync();url.oninput=()=>url.classList.toggle('invalid',!!url.value&&!validUrl(url.value));
    form.onsubmit=async e=>{
      e.preventDefault();err.textContent='';
      if(!mi.value.trim()||!si.value.trim()||!$('#'+prefix+'Date').value||!$('#'+prefix+'Title').value.trim()||!validUrl(url.value)){err.textContent=validUrl(url.value)?'请完整填写所有必填字段。':'请粘贴证监会或地方证监局官网的决定书原文链接';return}
      const btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='提交中……';
      try{
        const body={manager:mi.value.trim(),relation:rel.querySelector('.on').dataset.value,subject:si.value.trim(),type:$('#'+prefix+'Type').value,date:$('#'+prefix+'Date').value,title:$('#'+prefix+'Title').value.trim(),url:url.value.trim(),summary:$('#'+prefix+'Summary').value.trim(),code:$('#'+prefix+'Code').value,name:$('#'+prefix+'Name').value};
        const headers={'Content-Type':'application/json'};if(admin)headers['X-Admin-Password']=sessionStorage.getItem(ADMIN_KEY)||'';
        const endpoint=admin?'/api/risk/admin-add':'/api/risk/submit';
        const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)}),d=await r.json();
        if(!r.ok||!d.ok)throw Error(d.error||'提交失败，请稍后再试');
        if(admin){err.className='risk-submit-success-text';err.textContent='已直接加入正式风险库';btn.disabled=false;btn.textContent='管理员直接加入风险库'}
        else{main.innerHTML='<section class="risk-submit-success"><div class="success-icon">✓</div><h1>提交成功</h1><p>已提交，等待审核。感谢您的贡献！</p><button class="risk-submit-button" id="riskSuccessBack">返回风险页</button></section>';$('#riskSuccessBack').onclick=()=>{document.querySelector('.topbar').style.display='';document.querySelector('.tabbar').style.display='';window.riskPage(prev.code,prev.name)}}
      }catch(ex){err.className='risk-submit-error';err.textContent=ex.message||'提交失败，请稍后再试';btn.disabled=false;btn.textContent=admin?'管理员直接加入风险库':'提交补充'}
    }
  }

  function openRiskSubmit(p={}){
    const prev={code:p.code||'',name:p.name||'',manager:p.manager||''};
    pageShell('补充公开风险记录','仅接受中国证监会及各地方证监局官网公开的决定书链接',formMarkup('rs',prev,false));
    const mi=$('#rsManager');
    if(!prev.manager&&prev.code)managerOf(prev.code,prev.name).then(m=>{if(m){mi.value=m;$('#rsSubject').value=m;window.__riskManager=m}});
    bindRiskForm('rs',prev,false);$('#riskPageBack').onclick=()=>restore(prev)
  }

  function openRiskAdmin(p={}){
    const prev={code:p.code||'',name:p.name||'',manager:p.manager||''};
    pageShell('管理员风险数据库','管理员可直接录入风险，或审核用户提交记录','<div class="risk-admin-login"><label class="risk-form-field"><span>管理员密码 <b>*</b></span><input id="adminPassword" type="password" autocomplete="current-password" placeholder="请输入管理员密码"></label><button class="risk-submit-button" id="adminLogin">进入管理</button><div class="risk-submit-error" id="adminLoginError"></div></div>');
    $('#adminLogin').onclick=async()=>{const password=$('#adminPassword').value;if(!password){$('#adminLoginError').textContent='请输入管理员密码';return}const r=await fetch('/api/risk/pending',{headers:{'X-Admin-Password':password}});const d=await r.json();if(!r.ok||!d.ok){$('#adminLoginError').textContent=d.error||'管理员验证失败';return}sessionStorage.setItem(ADMIN_KEY,password);renderAdminPanel(prev,d.records||[])};
    $('#riskPageBack').onclick=()=>restore(prev)
  }

  function renderAdminPanel(prev,pending){pageShell('风险数据库管理','已通过管理员验证','<div class="risk-admin-section"><h2>管理员直接录入</h2>'+formMarkup('adm',prev,true)+'</div><div class="risk-admin-section"><h2>待审核记录 <span id="pendingCount">'+pending.length+'</span></h2><div id="pendingList"></div></div>');bindRiskForm('adm',prev,true);renderPending(pending);$('#riskPageBack').onclick=()=>restore(prev)}
  function renderPending(records){const host=$('#pendingList');if(!records.length){host.innerHTML='<p class="risk-admin-empty">暂无待审核记录</p>';return}host.innerHTML=records.map(r=>'<article class="risk-pending-item"><h3>'+esc2(r.title)+'</h3><div>'+esc2(r.date)+' · '+esc2(r.type)+' · '+esc2(r.manager)+'</div><p>对象：'+esc2(r.subject)+'</p><a href="'+esc2(r.url)+'" target="_blank" rel="noopener">查看原文</a><div class="risk-pending-actions"><button data-action="approve" data-id="'+esc2(r.id)+'">✓ 确认加入</button><button data-action="reject" data-id="'+esc2(r.id)+'">删除</button></div></article>').join('');host.querySelectorAll('button').forEach(b=>b.onclick=()=>processPending(b.dataset.id,b.dataset.action,b))}
  async function processPending(id,action,btn){btn.disabled=true;try{const r=await fetch('/api/risk/approve',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':sessionStorage.getItem(ADMIN_KEY)||''},body:JSON.stringify({id,action})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'操作失败');btn.closest('.risk-pending-item').remove();const left=document.querySelectorAll('.risk-pending-item').length;if(!left)$('#pendingList').innerHTML='<p class="risk-admin-empty">暂无待审核记录</p>';if($('#pendingCount'))$('#pendingCount').textContent=left}catch(e){alert(e.message||'操作失败');btn.disabled=false}}
  window.openRiskSubmit=openRiskSubmit;
  window.openRiskAdmin=openRiskAdmin;
})();
