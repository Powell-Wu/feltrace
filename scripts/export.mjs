import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile,rename,rm,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let load;
try {({load}=require('cheerio'));} catch {({load}=require('../../app/node_modules/cheerio'));}
const origin=new URL(process.env.FELTRACE_SOURCE_URL||'http://localhost:3000');
if(!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Export source must be the local public web service');
const base=(process.env.FELTRACE_BASE_PATH||'/feltrace/').replace(/\/$/,'')+'/';
if(!/^\/[a-zA-Z0-9/_-]*\/$/.test(base))throw Error('Invalid base path');
const publicOrigin='https://powell-wu.github.io';
const out=path.join(ROOT,'site.next');
await mkdir(out,{recursive:true});
const generatedAt=new Date().toISOString();
const escaped=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetCache=new Map(),failures=[];
let previousAssets=[];try{previousAssets=await readdir(path.join(ROOT,'site','assets'));}catch{}
const localUrl=p=>new URL(p,origin);
async function get(p){const r=await fetch(localUrl(p),{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`${p}: HTTP ${r.status}`);return r;}
async function json(p){return (await get(p)).json();}
async function put(p,data){const dest=path.join(out,p);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,data);}
async function asset(raw){
 if(!raw)return '';
 const u=new URL(raw,origin);
 if(u.origin!==origin.origin)return raw;
 if(assetCache.has(u.href))return assetCache.get(u.href);
 const pending=(async()=>{try{
   const digest=createHash('sha256').update(u.pathname+u.search).digest('hex').slice(0,20);
   const cached=previousAssets.find(n=>n.startsWith(digest+'.'));
   if(cached){const name='assets/'+cached;await put(name,await readFile(path.join(ROOT,'site',name)));return base+name;}
   const r=await get(u.pathname+u.search),type=r.headers.get('content-type')||'';
   const ext=type.includes('css')?'css':type.includes('svg')?'svg':type.includes('webp')?'webp':type.includes('png')?'png':type.includes('jpeg')?'jpg':type.includes('woff2')?'woff2':type.includes('icon')?'ico':'bin';
   const name=`assets/${createHash('sha256').update(u.pathname+u.search).digest('hex').slice(0,20)}.${ext}`;
   if(ext==='css'){
    let css=await r.text();const refs=[...css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)];
    for(const ref of refs){if(ref[1].startsWith('data:'))continue;const resource=await asset(new URL(ref[1],u).href);css=css.replace(ref[0],`url("${resource}")`);}
    await put(name,css);
   }else{await put(name,Buffer.from(await r.arrayBuffer()));}
   return base+name;
  }catch(e){failures.push({kind:'asset',path:u.pathname,reason:e.message});return '';}})();
 assetCache.set(u.href,pending);return pending;
}
function internal(raw){
 if(!raw||raw.startsWith('#')||/^(mailto:|tel:)/.test(raw))return raw;
 const u=new URL(raw,origin);
 if(u.origin!==origin.origin)return raw;
 let p=u.pathname.replace(/\/$/,'')||'/';
 if(p==='/all')p='/papers';
 if(p==='/feed.xml')return base+'feed.xml';
 if(p.startsWith('/story/'))p='/papers';
 if(p==='/agent')p='/about';
 if(p==='/feedback')return 'https://github.com/Powell-Wu/feltrace/issues';
 if(p.startsWith('/admin')||p.startsWith('/api/')||p.startsWith('/codex-reset')||p.startsWith('/leaderboard')||p==='/hot')return base+'about/';
 if(p.endsWith('/original')){const id=p.split('/')[2];return itemMap.get(id)?.links?.original||base+`items/${id}/`;}
 if(p.endsWith('/markdown'))return base+`items/${p.split('/')[2]}/`;
 return base+(p==='/'?'':p.slice(1)+'/')+u.search+u.hash;
}
const itemMap=new Map(),cards=new Map(),streams={};
const rawPages=new Map();
for(const [mode,route] of [['papers','/papers'],['facilities','/facilities'],['selected','/']]){
 let total=0;
 for(let page=1;page<=100;page++){
  const query=`?mode=${mode}&range=all&sort=published&page=${page}`;
  const data=await json('/api/site/academic'+query);
  if(page===1){total=data.total;streams[mode]={...data,items:[]};}
  for(const item of data.items){itemMap.set(item.id,item);streams[mode].items.push(item);}
  const html=await (await get(route+`?range=all&sort=published&page=${page}`)).text();
  rawPages.set(route+(page===1?'':`?page=${page}`),html);
  const $=load(html);
  $('.paper-card,.facility-card').each((i,el)=>{const id=$(el).find('[data-item-id]').attr('data-item-id');if(id&&!cards.has(id))cards.set(id,$.html(el));});
  if(page>=data.pageCount)break;
 }
 if(new Set(streams[mode].items.map(i=>i.id)).size!==total)throw Error(`${mode}: count changed during snapshot; retry export`);
 console.log(`${mode}: ${total}`);
}
async function clean(html,p){
 const $=load(html);
 $('script,link[rel="modulepreload"],link[rel="preload"],link[rel="manifest"],meta[property="og:image"],meta[name="twitter:image"]').remove();
 $('[data-discover],[data-prefetch]').removeAttr('data-discover').removeAttr('data-prefetch');
 $('a,link[rel="alternate"]').each((i,e)=>{const href=$(e).attr('href');if(href)$(e).attr('href',internal(href));});
 for(const el of $('use[href]').toArray()){const e=$(el),u=new URL(e.attr('href'),origin);if(u.origin===origin.origin){const value=await asset(u.pathname+u.search);if(value)e.attr('href',value+u.hash);else e.remove();}}
 for(const el of $('link[rel="stylesheet"],link[rel="icon"],link[rel="apple-touch-icon"],img,source').toArray()){
  const e=$(el),key=e.is('link')?'href':'src';
  if(e.attr(key)){const value=await asset(e.attr(key));if(value)e.attr(key,value);else if(e.is('img')){e.replaceWith('<span class="text-[11px] text-ink-4">图片暂不可用</span>');continue;}else e.remove();}
  e.removeAttr('srcset').removeAttr('imagesrcset');
 }
 $('[style]').each((i,e)=>{const v=$(e).attr('style');if(v?.includes('localhost')||v?.includes('/api/'))$(e).removeAttr('style');});
 $('link[rel="canonical"]').attr('href',publicOrigin+base+(p==='/'?'':p.slice(1)+'/'));
 $('meta[property="og:url"]').attr('content',publicOrigin+base+(p==='/'?'':p.slice(1)+'/'));
 $('meta[name="robots"]').remove();$('head').append('<meta name="robots" content="noindex,follow">');
 $('button[aria-label="更多操作"]').remove();
 $('button[aria-label="回到顶部"]').attr('data-static-action','top');
 $('button').filter((i,e)=>$(e).text().trim()==='返回').attr('data-static-action','back');
 $('form.academic-filters').attr('action',base+(p==='/'?'':p.slice(1)+'/'));
 const itemId=p.startsWith('/items/')?p.split('/')[2]:null;
 if(itemId)$('button[aria-label="收藏"]').attr('data-save-id',itemId);
 $('head').append(`<link rel="stylesheet" href="${base}static.css"><script src="${base}static.js" defer></script>`);
 $('body').attr('data-base',base).attr('data-page',p).attr('data-exported-at',generatedAt);
 $('#main>div').prepend(`<div class="static-status">公开阅读预览 · 内容更新于 <time datetime="${generatedAt}">${escaped(new Date(generatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}))}（台北）</time></div>`);
 $('#main>div').append(`<footer class="static-footer"><a href="${base}terms/">使用说明</a><a href="${base}privacy/">隐私说明</a><a href="https://github.com/Powell-Wu/feltrace/issues">更正与反馈</a></footer>`);
 return $;
}
async function savePage(p,$){await put(p==='/'?'index.html':p.slice(1)+'/index.html',$.html());}
// Keep the existing renderer's card markup and stylesheet; hydrate only static reading controls.
const publicItems=[...itemMap.values()];
const cleanCards={};
for(const [id,html] of cards){const $=load(html,null,false);for(const el of $('img').toArray()){const e=$(el);const src=await asset(e.attr('src'));if(src)e.attr('src',src);else e.remove();e.removeAttr('srcset');}$('a').each((i,e)=>$(e).attr('href',internal($(e).attr('href'))));$('[aria-label="收藏"]').attr('data-save-id',id);cleanCards[id]=$.html();}
for(const [route,mode] of [['/','selected'],['/papers','papers'],['/facilities','facilities']]){
 const $=await clean(rawPages.get(route),route);
 $('.academic-page').attr('data-stream',mode);
 const feed=$('.academic-feed').empty();
 for(const i of streams[mode].items)feed.append(cleanCards[i.id]);
 $('nav[aria-label="分页"]').remove();
 $('.academic-filters select[name="range"]').val('all');
 $('.academic-filters select[name="sort"]').val('published');
 await savePage(route,$);
}
const extraRoutes=new Set(['/about','/more','/topics','/changelog','/daily','/daily/archive','/weekly','/monthly']);
const topics=(await json('/api/site/topics')).topics;
for(const topic of topics){
 extraRoutes.add('/topics/'+topic.slug);
 const page=await json('/api/site/topics/'+topic.slug);
 for(let n=2;n<=page.pageCount;n++)extraRoutes.add(`/topics/${topic.slug}/page/${n}`);
}
for(const kind of ['daily','weekly','monthly'])for(const report of (await json(`/api/site/reports/${kind}`)).items)extraRoutes.add(`/${kind}/${report.key}`);
for(const id of itemMap.keys())extraRoutes.add('/items/'+id);
// Include public versions and report references only when the existing public detail endpoint permits them.
for(const id of [...itemMap.keys()]){
 const detail=await json('/api/site/items/'+id);
 for(const version of detail.item?.paperVersions||detail.paperVersions||[])if(version.id)extraRoutes.add('/items/'+version.id);
}
for(const p of extraRoutes){
 try {const $=await clean(await (await get(p)).text(),p);await savePage(p,$);}
 catch(e){throw Error(`Required page ${p} failed: ${e.message}`);}
 if(p.startsWith('/items/'))process.stdout.write('.');
}
console.log('\nPublic pages rendered');
// Local collection is device-only, with no server account.
const stars=await clean(rawPages.get('/papers'),'/starred');
stars('.academic-page').attr('data-stream','starred');stars('h1').first().text('我的收藏');stars('.academic-feed').empty();stars('nav[aria-label="分页"]').remove();
await savePage('/starred',stars);
const baseShell=rawPages.get('/papers');
for(const name of ['terms','privacy','about']){
 const $=await clean(baseShell,'/'+name);
 const md=await readFile(path.join(ROOT,'copy',name+'.html'),'utf8');
 $('#main>div').html(`<div class="static-status">FELTrace · 公开阅读预览</div>${md}<footer class="static-footer"><a href="${base}">返回精选</a><a href="${base}terms/">使用说明</a><a href="${base}privacy/">隐私说明</a></footer>`);
 $('#main a[href="/terms"]').attr('href',base+'terms/');$('#main a[href="/privacy"]').attr('href',base+'privacy/');
 $('title').text(({terms:'使用说明',privacy:'隐私说明',about:'关于 FELTrace'})[name]+' · FELTrace');
 await savePage('/'+name,$);
}
// Strip proxy URLs/signatures and export only search metadata already visible in cards.
const index=publicItems.map(i=>({id:i.id,title:i.title,originalTitle:i.originalTitle,summary:i.summary,source:i.source.name,tags:i.tags,category:i.category,publishedAt:i.publishedAt,discoveredAt:i.discoveredAt,paper:i.paper?{authors:i.paper.authors,doi:i.paper.doi,arxivId:i.paper.arxivId}:null,selected:i.selected,stream:i.contentStream,original:i.links.original}));
await put('data/index.json',JSON.stringify({generatedAt,items:index,cards:cleanCards},null,2));
for(const name of ['static.js','static.css'])await put(name,await readFile(path.join(ROOT,'src',name)));
const rssItems=publicItems.filter(i=>i.selected).map(i=>`<item><title>${escaped(i.title)}</title><link>${publicOrigin+base}items/${i.id}/</link><guid>${publicOrigin+base}items/${i.id}/</guid><description>${escaped(i.summary)}</description></item>`).join('');
await put('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FELTrace · 学术精选</title><link>${publicOrigin+base}</link><description>自由电子激光光源与加速器研究索引</description>${rssItems}</channel></rss>`);
await put('robots.txt',`User-agent: *\nDisallow: ${base}\n`);
await put('.nojekyll','');
const report={generatedAt,base,source:'existing public HTTP endpoints',papers:streams.papers.total,facilities:streams.facilities.total,selected:streams.selected.total,pages:extraRoutes.size+6,assets:assetCache.size,assetFailures:failures};
await put('release.json',JSON.stringify(report,null,2));
// Preserve the old successful export until the replacement has completed.
const current=path.join(ROOT,'site'),backup=path.join(ROOT,'.preview','previous');await mkdir(path.dirname(backup),{recursive:true});
try {await stat(current);await rm(backup,{recursive:true,force:true});await rename(current,backup);}catch(e){if(e.code!=='ENOENT')throw e;}
for(let attempt=0;attempt<10;attempt++){try{await rename(out,current);break;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt===9)throw e;await new Promise(r=>setTimeout(r,500));}}
console.log(JSON.stringify(report));
