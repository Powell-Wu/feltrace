import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);let load;try{({load}=require('cheerio'))}catch{({load}=require('../../app/node_modules/cheerio'))}
const root=path.resolve('site');
async function files(p=root){const all=[];for(const e of await readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())all.push(...await files(f));else all.push(f)}return all;}
test('Public export contains every search record and both real clocks',async()=>{const d=JSON.parse(await readFile(path.join(root,'data/index.json'),'utf8'));const r=JSON.parse(await readFile(path.join(root,'release.json'),'utf8'));assert.equal(d.items.filter(i=>i.stream==='paper').length,r.papers);assert.equal(d.items.filter(i=>i.stream!=='paper').length,r.facilities);assert.equal(d.items.filter(i=>i.selected).length,r.selected);for(const i of d.items){assert.ok(d.cards[i.id]);assert.ok(i.discoveredAt);assert.ok(Object.hasOwn(i,'publishedAt'));assert.ok(i.original.startsWith('http'));assert.ok((await stat(path.join(root,'items',i.id,'index.html'))).isFile())}});
test('Every exported HTML link and asset stays within the deployed project path',async()=>{const errors=[];for(const f of (await files()).filter(f=>f.endsWith('.html'))){const $=load(await readFile(f,'utf8'));for(const el of $('[href],[src]').toArray()){const value=$(el).attr('href')||$(el).attr('src');if(!value||value.startsWith('#')||/^(https?:|mailto:|data:)/.test(value))continue;if(!value.startsWith('/feltrace/')){errors.push(`${path.relative(root,f)}: ${value}`);continue}let dest=path.join(root,new URL(value,'https://example.com').pathname.slice('/feltrace/'.length));try{if((await stat(dest)).isDirectory())dest=path.join(dest,'index.html');await stat(dest)}catch{errors.push(`${path.relative(root,f)}: ${value}`)}}}assert.deepEqual(errors,[])});
test('No local service, proxy signatures, backend endpoint or hydration bundle is shipped',async()=>{for(const f of (await files()).filter(f=>/\.(html|json|css|js)$/.test(f))){const body=await readFile(f,'utf8');assert.doesNotMatch(body,/https?:\/\/(?:localhost|127\.0\.0\.1)|\/api\/img-proxy|SESSION_SECRET|LLM_API_KEY|POSTGRES_PASSWORD|__reactRouterContext|\/admin\/login/);if(f.endsWith('.html')){const $=load(body);assert.equal($('script[type="module"]').length,0);const executable=$('script').not('[type="application/json"]');const comparator=f===path.join(root,'facilities/compare/index.html');assert.equal(executable.length,comparator?2:1);assert.equal(executable.first().attr('src'),'/feltrace/static.js');if(comparator)assert.equal(executable.last().attr('src'),'/feltrace/facility-explorer.js')}}});
test('Public legal pages have concrete read-only behavior and feedback destination',async()=>{for(const n of ['terms','privacy']){const $=load(await readFile(path.join(root,n,'index.html'),'utf8'));assert.ok($('h1').text());assert.match($('.static-copy').text(),/Powell-Wu/);assert.doesNotMatch($('.static-copy').text(),/请填写|开源框架自带的模板/);assert.ok($('.static-copy a[href="https://github.com/Powell-Wu/feltrace/issues"]').length)}});
test('The reported S³FEL source formula and selected-value disclosure survive static export',async()=>{
 const data=JSON.parse(await readFile(path.join(root,'data/index.json'),'utf8'));
 const item=data.items.find(i=>i.paper?.arxivId==='2610.07604');assert.ok(item,'reported paper is present');
 const $=load(await readFile(path.join(root,'items',item.id,'index.html'),'utf8'));
 assert.match($('#paper-abstract .katex-mathml').html(),/<msup>/);
 assert.ok($('#paper-abstract annotation').text().includes(String.raw`\rm S^3FEL`),'source TeX remains available');
 assert.match($('details').text(),/精选理由 · 展开阅读价值/);
 assert.ok($('link[rel="stylesheet"]').length>0);
});
test('Agent links reach a real capability page and projected static feeds',async()=>{
 const $=load(await readFile(path.join(root,'agent/index.html'),'utf8'));
 assert.match($('h1').text(),/Agent 接入/);
 assert.match($('.static-copy').text(),/没有远程 MCP/);
 const home=load(await readFile(path.join(root,'index.html'),'utf8'));
 assert.ok(home('a[href="/feltrace/agent/"]').length);
 const release=JSON.parse(await readFile(path.join(root,'release.json'),'utf8'));
 for(const name of ['papers','facilities','selected']){
  const feed=JSON.parse(await readFile(path.join(root,`data/${name}.json`),'utf8'));
  assert.equal(feed.count,release[name]);assert.equal(feed.count,feed.items.length);assert.equal(feed.schemaVersion,1);
  for(const item of feed.items){assert.ok(item.url.startsWith('https://powell-wu.github.io/feltrace/items/'));assert.ok(item.discoveredAt);assert.ok(Object.hasOwn(item,'publishedAt'));assert.equal(item.abstract,undefined);assert.equal(item.body,undefined);if(!item.selected)assert.equal(item.reason,null);}
 }
 assert.match(await readFile(path.join(root,'llms.txt'),'utf8'),/data\/papers.json/);
});
test('Every stylesheet dependency is copied on repeated exports',async()=>{
 const styles=(await files()).filter(f=>f.endsWith('.css'));
 for(const f of styles){const css=await readFile(f,'utf8');
  for(const [,value] of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)){
   if(value.startsWith('data:')||value.startsWith('https:'))continue;
   assert.ok(value.startsWith('/feltrace/assets/'),value);
   assert.ok((await stat(path.join(root,value.slice('/feltrace/'.length)))).isFile(),value);
  }
 }
});
test('Parameter page is readable before enhancement and ships the same versioned evidence as its feed',async()=>{
 const data=JSON.parse(await readFile(path.join(root,'data/facility-parameters.json'),'utf8'));
 const $=load(await readFile(path.join(root,'facilities/compare/index.html'),'utf8'));
 assert.match($('h1').text(),/装置对比/);
 assert.equal($('#grid tbody tr').length,data.items.filter(item=>item.level==='source').length);
 assert.deepEqual(JSON.parse($('#facility-data').text()),data);
 assert.equal(Object.keys(data.labels).length,17);
 assert.ok(data.items.some(item=>item.level==='instrument'));
 assert.ok(load(await readFile(path.join(root,'index.html'),'utf8'))('a[href="/feltrace/facilities/compare/"]').length);
 assert.ok(load(await readFile(path.join(root,'more/index.html'),'utf8'))('a[href="/feltrace/facilities/compare/"]').length);
 const script=await readFile(path.join(root,'facility-explorer.js'),'utf8');
 assert.doesNotMatch(script,/\bexport\s+(const|function)|fetch\(/);
 assert.match(script,/mountFacilityExplorer/);
});
