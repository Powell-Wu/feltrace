import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {selectStaticItems} from '../src/query.mjs';
const require=createRequire(import.meta.url);let load;try{({load}=require('cheerio'))}catch{({load}=require('../../app/node_modules/cheerio'))}
const root=path.resolve(import.meta.dirname,'..');

async function fixture(t){
 const temp=await mkdtemp(path.join(os.tmpdir(),'feltrace-static-fixture-')),output=path.join(temp,'site');
 const clock=Date.now(),recent=new Date(clock-86400000).toISOString();
 const paper=(id,version)=>({id,title:id==='old'?'旧版 distinctive':'当前 electron beam',originalTitle:null,summary:'Fixture summary',tags:['诊断'],category:'research',selected:true,contentStream:'paper',publishedAt:version===1?'2020-01-01T00:00:00Z':recent,discoveredAt:recent,source:{name:'Fixture source'},links:{original:'https://example.org/'+id},paper:{workId:'work',status:'preprint',arxivVersion:version,versionAt:recent,onlineAt:null,submittedAt:null,authors:['A. Smith'],doi:null,arxivId:'2601.00001'}});
 const older=paper('old',1),current=paper('current',2),news={...paper('news',1),title:'General selected facility news',contentStream:'news',category:'facilities',paper:null};
 const items=[older,current,news],state={failure:null,requests:[]};
 const catalogue={schemaVersion:2,checkedAt:'2026-10-22',groups:{},labels:{},items:[],profiles:[{id:'fixture',name:'Fixture facility',overview:{figures:[{imagePath:'/facility-figures/fixture-layout.png'}]}}],coverage:[]};
 const streams={papers:[current],facilities:[news],selected:[current]},all={papers:[older,current],facilities:[news],selected:[older,current]};
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const card=item=>`<article class="${item.paper?'paper':'facility'}-card"><a data-item-id="${item.id}" href="/items/${item.id}">${escape(item.title)}</a><button aria-label="收藏"></button></article>`;
 const shell=(p,rows=[])=>`<!doctype html><html><head><title>Fixture</title><link rel="stylesheet" href="/assets/style.css"><link rel="canonical" href="http://localhost:3000${p}"><script type="module">throw Error('must be stripped')</script></head><body><main id="main"><div class="academic-page"><h1>Fixture</h1><form class="academic-filters"><input name="q"><select name="range"><option value="all">All</option><option value="30">30</option><option value="90">90</option></select><select name="sort"><option value="published">Published</option><option value="discovered">Discovered</option></select></form><div class="academic-result-meta"></div><div class="academic-feed">${rows.map(card).join('')}</div><figure><img src="/api/img-proxy?u=fixture&amp;sig=fixture-only" alt="Original fixture figure"><figcaption>Figure 1 caption · <a href="https://example.org/paper">Original source</a></figcaption></figure><div data-personal-library="true">Private archive must be removed</div>${p==='/facilities/compare'?'<div class="facility-explorer"><div id="catalogue"></div></div>':''}<a href="/facilities/fixture/research">Facility research</a></div></main></body></html>`;
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');state.requests.push(u.pathname);
  const reply=(value,type='application/json',status=200)=>{res.writeHead(status,{'content-type':type});res.end(type==='application/json'?JSON.stringify(value):value);};
  if(u.pathname==='/api/site/academic'){
   const mode=u.searchParams.get('mode'),rows=(u.searchParams.get('versions')==='all'?all:streams)[mode];
   return reply({items:rows,filterTags:Object.fromEntries(rows.map(item=>[item.id,[...item.tags,'entity:fixture']])),total:rows.length,pageCount:1,page:1,mode,range:'all',sort:'published',generatedAt:recent});
  }
  if(u.pathname==='/api/v1/facility-parameters')return reply(catalogue);
  if(u.pathname==='/facility-figures/fixture-layout.png')return reply(Buffer.from('fixture-original-layout'),'image/png');
  if(u.pathname==='/api/site/topics')return reply({topics:[]});
  if(u.pathname==='/facilities/fixture/research'&&state.failure==='page')return reply('missing page','text/plain',404);
  if(/^\/api\/site\/reports\/(daily|weekly|monthly)$/.test(u.pathname))return reply({items:[]});
  if(u.pathname.startsWith('/api/site/items/'))return reply({paperVersions:[]});
  if(u.pathname==='/api/img-proxy')return reply('image upstream unavailable','text/plain',502);
  if(u.pathname==='/assets/style.css')return reply(state.failure==='css'?'unavailable':`body{font-family:fixture}@font-face{font-family:fixture;src:url("${state.failure==='font'?'/assets/new-font.woff2':'/assets/font.woff2'}")}`,'text/css',state.failure==='css'?503:200);
  if(u.pathname==='/assets/new-font.woff2')return reply('unavailable','text/plain',503);
  if(u.pathname==='/assets/font.woff2')return reply(Buffer.from('fixture-font'),'font/woff2');
  const mode=u.pathname==='/papers'?'papers':u.pathname==='/facilities'?'facilities':u.pathname==='/'?'selected':null;
  if(mode)return reply(shell(u.pathname,(u.searchParams.get('versions')==='all'&&state.failure!=='forwarding'?all:streams)[mode]),'text/html');
  if(['/about','/more','/topics','/changelog','/daily','/daily/archive','/weekly','/monthly','/facilities/compare','/facilities/fixture/research'].includes(u.pathname)||items.some(i=>u.pathname==='/items/'+i.id))return reply(shell(u.pathname),'text/html');
  return reply('not found','text/plain',404);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${server.address().port}`;
 async function run(){
  const child=spawn(process.execPath,['scripts/export.mjs'],{cwd:root,env:{...process.env,FELTRACE_SOURCE_URL:origin,FELTRACE_OUTPUT_DIR:output},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject)});
  return {code,stdout,stderr};
 }
 return {output,state,run};
}
async function walk(dir){const files=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())files.push(...await walk(p));else files.push(p)}return files;}

test('offline export retains query candidates, research pages, source captions and safe degradation',async t=>{
 const {run,output,state}=await fixture(t),result=await run();assert.equal(result.code,0,result.stderr);
 const release=JSON.parse(await readFile(path.join(output,'release.json'),'utf8'));
 assert.equal(release.status,'degraded');assert.equal(release.assetFailures.length,1);assert.deepEqual(release.assetFailures,[{kind:'asset',code:'unavailable'}]);
 const data=JSON.parse(await readFile(path.join(output,'data/index.json'),'utf8'));
 assert.equal(data.items.length,2);assert.equal(data.candidates.length,3);assert.ok(data.cards.old);
 assert.deepEqual(selectStaticItems(data,'papers',new URLSearchParams('range=all&q=distinctive')).items.map(i=>i.id),['old']);
 assert.equal(selectStaticItems(data,'papers',new URLSearchParams('range=all&tag=entity%3Afixture')).items.length,1);
 assert.deepEqual(data.candidates.find(item=>item.id==='current').tags,['诊断']);
 assert.equal(selectStaticItems(data,'papers',new URLSearchParams('range=30&sort=discovered')).items.length,1);
 assert.equal((await stat(path.join(output,'items/old/index.html'))).isFile(),true);
 assert.equal((await stat(path.join(output,'facilities/fixture/research/index.html'))).isFile(),true);
 assert.equal(await readFile(path.join(output,'facility-figures/fixture-layout.png'),'utf8'),'fixture-original-layout','originals not present in the initial SSR page must still be copied for later facility selection');
 const html=await readFile(path.join(output,'items/current/index.html'),'utf8');
 assert.match(html,/图片暂不可用/);assert.match(html,/Figure 1 caption/);assert.match(html,/https:\/\/example.org\/paper/);assert.doesNotMatch(html,/Private archive/);
 assert.ok(state.requests.includes('/assets/font.woff2'));
 for(const file of (await walk(output)).filter(f=>/\.(json|html|js|css)$/.test(f))){
  const body=await readFile(file,'utf8');assert.doesNotMatch(body,/sig=fixture-only|\/api\/img-proxy|https?:\/\/localhost|__reactRouterContext/);
 }
 const feed=await readFile(path.join(output,'feed.xml'),'utf8');assert.match(feed,/当前 electron beam/);assert.doesNotMatch(feed,/General selected/);
 const selected=JSON.parse(await readFile(path.join(output,'data/selected.json'),'utf8'));assert.equal(selected.count,1);
});
test('all exported relative links and stylesheet dependencies resolve without an external service',async t=>{
 const {run,output}=await fixture(t),result=await run();assert.equal(result.code,0,result.stderr);
 for(const file of (await walk(output)).filter(f=>f.endsWith('.html'))){
  const $=load(await readFile(file,'utf8'));
  for(const element of $('[href],[src]').toArray()){
   const value=$(element).attr('href')||$(element).attr('src');if(!value||/^(https?:|mailto:|data:|#)/.test(value))continue;
   assert.ok(value.startsWith('/feltrace/'),value);let target=path.join(output,new URL(value,'https://fixture.test').pathname.slice('/feltrace/'.length));
   if((await stat(target)).isDirectory())target=path.join(target,'index.html');assert.ok((await stat(target)).isFile(),target);
  }
 }
 const css=await readFile((await walk(output)).find(f=>f.endsWith('.css')&&!f.endsWith('static.css')),'utf8');
 assert.match(css,/url\("\/feltrace\/assets\/[a-f0-9]+\.woff2"\)/);
});
for(const failure of ['css','font','page','forwarding'])test(`a required ${failure} failure retains the previous export`,async t=>{
 const {run,output,state}=await fixture(t);assert.equal((await run()).code,0);
 const before=await readFile(path.join(output,'release.json'),'utf8');await writeFile(path.join(output,'retained.txt'),'previous approved candidate');
 state.failure=failure;const result=await run();assert.notEqual(result.code,0);assert.match(result.stderr,/required stylesheet|Required page|no rendered card/);
 assert.equal(await readFile(path.join(output,'release.json'),'utf8'),before);
 assert.equal(await readFile(path.join(output,'retained.txt'),'utf8'),'previous approved candidate');
 assert.doesNotMatch(result.stdout,/sig=|\/api\/img-proxy/);
});
