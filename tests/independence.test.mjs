import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {buildFacilityClient} from '../vendor/facilities/build-facility-client.mjs';

const root=path.resolve(import.meta.dirname,'..');
async function files(directory){const result=[];for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){const relative=path.join(directory,entry.name);if(entry.isDirectory())result.push(...await files(relative));else result.push(relative);}return result;}

test('public exporter and publication scripts have no private app dependency',async()=>{
 const sources=[...(await files('scripts')),...(await files('vendor')),...(await files('tests')).filter(file=>file!==path.join('tests','independence.test.mjs')),'Publish-FELTrace.ps1'];
 for(const file of sources){
  const body=await readFile(path.join(root,file),'utf8');
  assert.doesNotMatch(body,/\.\.\/\.\.\/app(?:\/|$)/,file);
  assert.doesNotMatch(body,/apps[\\/]web[\\/]/,file);
  assert.doesNotMatch(body,/node_modules[\\/]cheerio/,file);
  assert.doesNotMatch(body,/workspaceRoot/,file);
 }
 const publish=await readFile(path.join(root,'Publish-FELTrace.ps1'),'utf8');
 assert.match(publish,/\$runtime=Join-Path \$source '\.runtime'/);
 assert.match(publish,/'vendor','docs'/);
});

test('vendored facility source reproduces the reviewed browser bundle exactly',async()=>{
 const actual=await buildFacilityClient();
 const expected=await readFile(path.join(root,'site/facility-explorer-v2.js'),'utf8');
 assert.equal(actual,expected);
});
