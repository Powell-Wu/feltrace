import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../site');
const base='/feltrace/';
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.xml':'application/rss+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/'){res.writeHead(302,{Location:base});res.end();return}if(!p.startsWith(base)){res.writeHead(404);res.end();return}p=path.resolve(root,p.slice(base.length));if(p!==root&&!p.startsWith(root+path.sep))throw Error('Invalid path');if((await stat(p)).isDirectory())p=path.join(p,'index.html');res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(p))}catch{res.writeHead(404);res.end('Not found')}}).listen(4174,'127.0.0.1',()=>console.log('FELTrace preview: http://127.0.0.1:4174/feltrace/'));
