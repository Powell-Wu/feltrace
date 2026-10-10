// Repair project-relative resource links in an already exported snapshot.
import {readFile,writeFile,readdir,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);let load;try{({load}=require('cheerio'))}catch{({load}=require('../../app/node_modules/cheerio'))}
const root=path.resolve('site'),base='/feltrace/',cache=new Map();
async function walk(p){const a=[];for(const e of await readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())a.push(...await walk(f));else a.push(f)}return a}
const broken=new Set();
for(const f of (await walk(root)).filter(f=>f.endsWith('.html'))){const $=load(await readFile(f,'utf8'));$('link[rel="alternate"]').attr('href',base+'feed.xml');for(const el of $('use[href]').toArray()){const e=$(el),raw=e.attr('href');if(!raw.startsWith('/assets/'))continue;const u=new URL(raw,'http://localhost:3000');if(!cache.has(u.pathname)){const name='assets/'+createHash('sha256').update(u.pathname).digest('hex').slice(0,20)+'.svg';const r=await fetch(u.origin+u.pathname);if(!r.ok)throw Error('SVG unavailable');await writeFile(path.join(root,name),Buffer.from(await r.arrayBuffer()));cache.set(u.pathname,base+name)}e.attr('href',cache.get(u.pathname)+u.hash)}await writeFile(f,$.html());for(const el of $('[href],[src]').toArray()){const value=$(el).attr('href')||$(el).attr('src');if(!value||value.startsWith('#')||/^(https?:|mailto:|data:)/.test(value))continue;if(!value.startsWith(base)){broken.add(value);continue}let dest=path.join(root,new URL(value,'https://example.com').pathname.slice(base.length));try{if((await stat(dest)).isDirectory())dest=path.join(dest,'index.html');await stat(dest)}catch{broken.add(value)}}}
await writeFile(path.join(root,'static.js'),await readFile('src/static.js'));
console.log(JSON.stringify({unresolvedLinks:[...broken]}));
