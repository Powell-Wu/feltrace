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
 let index;
 async function load(){if(!index){const r=await fetch(base+'data/index.json');if(!r.ok)throw Error('索引加载失败');index=await r.json()}return index;}
 function countText(n){const meta=document.querySelector('.academic-result-meta');if(meta)meta.replaceChildren(Object.assign(document.createElement('p'),{textContent:`${n} 条资料 · 公开快照内检索` }));}
 async function render(){
 const container=document.querySelector('[data-stream]');if(!container)return;
 const data=await load(),stream=container.dataset.stream,params=new URLSearchParams(location.search);
 const q=(params.get('q')||'').trim().toLowerCase(),tag=params.get('tag'),category=params.get('category'),range=params.get('range')||'all',sort=params.get('sort')||'published';
 let items=data.items.filter(i=>stream==='starred'?saved.has(i.id):stream==='selected'?i.selected:stream==='papers'?i.stream==='paper':i.stream!=='paper');
 const words=q.split(/\s+/).filter(Boolean),cutoff=Date.parse(data.generatedAt)-(Number(range)||Infinity)*86400000;
 items=items.filter(i=>(!tag||i.tags.includes(tag))&&(!category||i.category===category)&&words.every(w=>[i.title,i.originalTitle,i.summary,i.source,i.paper?.authors?.join(' '),i.paper?.doi,i.paper?.arxivId].join(' ').toLowerCase().includes(w))&&(range==='all'||i.publishedAt&&Date.parse(i.publishedAt)>=cutoff));
 const clock=sort==='discovered'?'discoveredAt':'publishedAt';items.sort((a,b)=>(Date.parse(b[clock])||0)-(Date.parse(a[clock])||0));
 const size=20,pages=Math.max(1,Math.ceil(items.length/size)),current=Math.min(pages,Math.max(1,Number(params.get('page'))||1));
 const feed=container.querySelector('.academic-feed');feed.innerHTML=items.slice((current-1)*size,current*size).map(i=>data.cards[i.id]||'').join('')||'<p class="static-empty">没有匹配的资料。</p>';
 if(stream==='selected'&&current===1&&!q&&!tag&&feed.firstElementChild?.matches('.paper-card,.facility-card')){feed.firstElementChild.classList.add('academic-lead');const label=document.createElement('p');label.className='lead-label';label.textContent='重点阅读 / FEATURED READING';feed.firstElementChild.prepend(label);}
 const form=container.querySelector('form');if(form){for(const k of ['q','range','sort']){const el=form.elements.namedItem(k);if(el)el.value=({q,range,sort})[k]}}
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
 document.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.alt='图片暂不可用';img.style.display='none'}));
})();
