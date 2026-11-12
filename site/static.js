// Academic filtering mirrors publication/academic.ts over the public version candidates.
function selectStaticItems(data,stream,params,saved=new Set()) {
 const q=(params.get('q')||'').trim().slice(0,120),tag=params.get('tag')?.trim().slice(0,60),category=params.get('category');
 const requestedRange=params.get('range')||(stream==='papers'?'90':'all');
 const range=['30','90'].includes(requestedRange)?requestedRange:'all';
 const sort=params.get('sort')==='published'?'published':params.get('sort')==='discovered'?'discovered':stream==='papers'||stream==='starred'?'published':'discovered';
 const now=Date.parse(data.generatedAt),since=range==='all'?null:now-Number(range)*86400000;
 const members=data.memberships?.[stream];
 const allowed=members?new Set(members):null;
 const date=item=>Date.parse(sort==='discovered'?item.discoveredAt:(item.academicPublishedAt??item.paper?.onlineAt??item.publishedAt??item.paper?.submittedAt));
 const term=q.toLowerCase();
 const matches=(data.candidates??data.items).filter(item=>{
  const included=stream==='starred'?saved.has(item.id):allowed?allowed.has(item.id)
   :stream==='selected'?item.selected&&(item.stream==='paper'||['methods','software'].includes(item.category))
   :stream==='papers'?item.stream==='paper':item.stream==='news';
  if(!included||tag&&!(item.queryTags??item.tags).includes(tag)||category&&item.category!==category)return false;
  // Dynamic search uses one literal substring in any one field, rather than split-word AND.
  const fields=[item.title,item.originalTitle,item.summary,item.paper?.doi,item.paper?.arxivId,
   item.paper?.authors?`[${item.paper.authors.map(name=>JSON.stringify(name)).join(', ')}]`:null];
  if(term&&!fields.some(field=>String(field??'').toLowerCase().includes(term)))return false;
  const at=date(item);
  return since===null||Number.isFinite(at)&&at>=since&&at<=now;
 });
 // Apply the query before work/version selection, matching the dynamic SQL window.
 const works=new Map();
 for(const item of matches){const key=stream==='starred'?item.id:item.paper?.workId??item.id,old=works.get(key);if(!old||preferVersion(item,old)<0)works.set(key,item);}
 const items=[...works.values()];
 items.sort((a,b)=>{
  const left=date(a),right=date(b);
  if(Number.isFinite(left)!==Number.isFinite(right))return Number.isFinite(left)?-1:1;
  if(Number.isFinite(left)&&left!==right)return right-left;
  return a.id===b.id?0:a.id<b.id?1:-1;
 });
 return {items,q,tag,range,sort};
}

function preferVersion(a,b){
 const journal=Number(b.paper?.status==='journal')-Number(a.paper?.status==='journal');
 if(journal)return journal;
 const version=(b.paper?.arxivVersion??-Infinity)-(a.paper?.arxivVersion??-Infinity);
 if(version&&!Number.isNaN(version))return version;
 const left=Date.parse(a.paper?.versionAt??a.paper?.onlineAt??a.publishedAt),right=Date.parse(b.paper?.versionAt??b.paper?.onlineAt??b.publishedAt);
 if(Number.isFinite(left)!==Number.isFinite(right))return Number.isFinite(left)?-1:1;
 if(Number.isFinite(left)&&left!==right)return right-left;
 return a.id===b.id?0:a.id<b.id?-1:1;
}

(()=>{
 const base=document.body.dataset.base,page=document.body.dataset.page;
 const storage={get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}};
 let saved=new Set(storage.get('feltrace-public-saved',[]));
 const theme=storage.get('feltrace-public-theme','system');
 function applyTheme(t){document.documentElement.setAttribute('data-theme',t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.querySelectorAll('[role="radiogroup"][aria-label="外观"]').forEach(group=>{const thumb=group.querySelector('span[aria-hidden]');if(thumb)thumb.style.transform=`translateX(${({dark:0,system:1,light:2})[t]*100}%)`;group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(({深色:'dark',浅色:'light',跟随系统:'system'})[b.title]===t)))});}
 applyTheme(theme);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyTheme(storage.get('feltrace-public-theme','system')));
 function toast(s){const t=document.createElement('div');t.className='static-toast';t.setAttribute('role','status');t.textContent=s;document.body.append(t);setTimeout(()=>t.remove(),2500);}
 function buttons(){document.querySelectorAll('[data-save-id]').forEach(b=>{const on=saved.has(b.dataset.saveId);b.classList.toggle('static-saved',on);b.setAttribute('aria-label',on?'取消收藏':'收藏');b.setAttribute('aria-pressed',String(on));});}
 buttons();
 function openAbstract(){if(location.hash==='#paper-abstract'){const d=document.getElementById('abstract-disclosure');if(d)d.open=true;}}
 openAbstract();addEventListener('hashchange',openAbstract);
 let index;
 async function load(){if(!index){const r=await fetch(base+'data/index.json');if(!r.ok)throw Error('索引加载失败');index=await r.json()}return index;}
 function countText(n){const meta=document.querySelector('.academic-result-meta');if(meta)meta.replaceChildren(Object.assign(document.createElement('p'),{textContent:`${n} 条资料 · 公开快照内检索` }));}
 async function render(){
 const container=document.querySelector('[data-stream]');if(!container)return;
 const data=await load(),stream=container.dataset.stream,params=new URLSearchParams(location.search);
 const {items,q,tag,range,sort}=selectStaticItems(data,stream,params,saved);
 const scope=container.querySelector('[data-search-scope]');
 if(scope)scope.textContent=`检索范围：${({papers:'近期论文',facilities:'设施动态',selected:'学术精选',starred:'我的收藏'})[stream]} · ${range==='all'?'全部时间':`近${range}天`} · 按${sort==='published'?'发表':'收录'}时间筛选。${stream==='selected'?'此处只检索精选资料。':'公开阅读快照内检索。'}`;
 const size=20,pages=Math.max(1,Math.ceil(items.length/size)),current=Math.min(pages,Math.max(1,Number(params.get('page'))||1));
 const feed=container.querySelector('.academic-feed');feed.innerHTML=items.slice((current-1)*size,current*size).map(i=>data.cards[i.id]||'').join('')||'<p class="static-empty">没有匹配的资料。</p>';
 container.querySelectorAll('.academic-empty').forEach(element=>element.remove());
 if(!items.length&&stream!=='starred'){
  const expanded=new URLSearchParams(params);expanded.set('range','all');expanded.set('sort',sort);expanded.delete('page');
  const link=document.createElement('a');link.className='text-accent';link.href='?'+expanded;link.textContent='在全部时间继续检索';feed.append(link);
  if(stream==='selected'){const allPapers=document.createElement('a');allPapers.className='ml-4 text-accent';allPapers.href=base+'papers/?'+expanded;allPapers.textContent='在全部论文中检索';feed.append(allPapers);}
 }
 if(stream==='selected'&&current===1&&!q&&!tag&&feed.firstElementChild?.matches('.paper-card,.facility-card')){feed.firstElementChild.classList.add('academic-lead');const label=document.createElement('p');label.className='lead-label';label.textContent='重点阅读 / FEATURED READING';feed.firstElementChild.prepend(label);}
 const form=container.querySelector('form');if(form){for(const k of ['q','range','sort']){const el=form.elements.namedItem(k);if(el)el.value=({q,range,sort})[k]}let tagInput=form.elements.namedItem('tag');if(tag){if(!tagInput){tagInput=document.createElement('input');tagInput.type='hidden';tagInput.name='tag';form.append(tagInput)}tagInput.value=tag}else tagInput?.remove()}
 document.querySelectorAll('[aria-label="分页"],.static-pagination').forEach(e=>e.remove());
 if(pages>1){const nav=document.createElement('nav');nav.className='static-pagination';nav.setAttribute('aria-label','分页');for(const [label,n] of [['上一页',current-1],[`${current} / ${pages}`,current],['下一页',current+1]]){const b=document.createElement('button');b.textContent=label;b.disabled=n<1||n>pages||n===current;b.addEventListener('click',()=>{params.set('page',n);history.pushState(null,'','?'+params);render().catch(fail);container.scrollIntoView({behavior:'smooth'})});nav.append(b)}feed.after(nav)}
 countText(items.length);buttons();
 }
 function fail(e){toast(e.message||'暂时无法加载');}
 document.addEventListener('submit',e=>{if(!e.target.matches('.academic-filters'))return;e.preventDefault();const p=new URLSearchParams(new FormData(e.target));p.delete('page');history.pushState(null,'','?'+p);render().catch(fail)});
 document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.closest('[role="radiogroup"][aria-label="外观"]')){const t=({深色:'dark',浅色:'light',跟随系统:'system'})[b.title];if(t){storage.set('feltrace-public-theme',t);applyTheme(t)}return;}
 if(b.dataset.saveId){const id=b.dataset.saveId;if(saved.has(id))saved.delete(id);else saved.add(id);if(!storage.set('feltrace-public-saved',[...saved]))toast('浏览器未允许保存收藏，本次仅临时保留');buttons();if(page==='/starred')render().catch(fail);return;}
 if(b.dataset.staticAction==='top'){scrollTo({top:0,behavior:'smooth'});return;}
 if(b.dataset.staticAction==='back'){if(history.length>1)history.back();else location.href=base;return;}
 if(b.getAttribute('aria-label')==='分享'){try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else {await navigator.clipboard.writeText(location.href);toast('链接已复制')}}catch{}return;}
 if(b.getAttribute('aria-label')?.startsWith('查看大图')){const img=b.querySelector('img');if(!img)return;const d=document.createElement('dialog');d.className='static-lightbox';const full=img.cloneNode();full.removeAttribute('loading');const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>d.close();d.append(full,close);d.addEventListener('close',()=>d.remove());d.addEventListener('click',e=>{if(e.target===d)d.close()});document.body.append(d);d.showModal();}
 });
 document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a||a.origin!==location.origin||a.pathname!==location.pathname||!document.querySelector('[data-stream]')||!a.search)return;e.preventDefault();history.pushState(null,'',a.href);render().catch(fail)});
 addEventListener('popstate',()=>render().catch(fail));render().catch(fail);
 document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const placeholder=document.createElement('span');placeholder.className='static-asset-unavailable';placeholder.textContent=`图片暂不可用${img.alt?` · ${img.alt}`:''}`;img.replaceWith(placeholder)}));
})();
