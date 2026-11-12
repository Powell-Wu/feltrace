import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectStaticItems} from '../src/query.mjs';

const now='2026-10-22T00:00:00.000Z';
const make=(id,extra={})=>({id,title:id,originalTitle:null,summary:null,tags:[],category:'research',stream:'paper',selected:false,publishedAt:'2020-01-01T00:00:00.000Z',discoveredAt:'2026-10-10T00:00:00.000Z',paper:null,...extra});
const select=(items,search,stream='papers',extra={})=>selectStaticItems({generatedAt:now,items,...extra},stream,new URLSearchParams(search)).items.map(i=>i.id);

test('date range follows the selected clock and includes exact boundaries',()=>{
 const items=[make('old-new'),make('unknown',{publishedAt:null}),make('boundary',{publishedAt:'2026-09-22T00:00:00.000Z'}),make('before',{publishedAt:'2026-09-21T23:59:59.999Z'}),make('future',{publishedAt:'2026-10-22T00:00:00.001Z'})];
 assert.deepEqual(select(items,'range=30&sort=published'),['boundary']);
 assert.deepEqual(select(items,'range=30&sort=discovered'),['unknown','old-new','future','boundary','before']);
 assert.equal(select(items,'range=all&sort=published').length,5);
});
test('publication clock coalesces online, publication and submitted dates; unknown stays last',()=>{
 const items=[make('online',{paper:{onlineAt:'2026-10-20T00:00:00.000Z'}}),make('submitted',{publishedAt:null,paper:{submittedAt:'2026-10-01T00:00:00.000Z'}}),make('unknown',{publishedAt:null})];
 assert.deepEqual(select(items,'range=30&sort=published'),['online','submitted']);
 assert.deepEqual(select(items,'range=all&sort=published'),['online','submitted','unknown']);
});
test('literal search does not split words, search source names or treat wildcard text as operators',()=>{
 const items=[make('phrase',{title:'electron beam 100%_stable'}),make('separate',{title:'electron',summary:'beam'}),make('source',{source:'electron beam'})];
 assert.deepEqual(select(items,'range=all&q=electron+beam'),['phrase']);
 assert.deepEqual(select(items,'range=all&q=100%25_stable'),['phrase']);
 assert.deepEqual(select(items,'range=all&q=ELECTRON+BEAM'),['phrase']);
});
test('DOI, arXiv, authors JSON text and exact tags remain searchable',()=>{
 const items=[make('paper',{paper:{doi:'10.1234/abc',arxivId:'2610.00001',authors:['A. Smith','B. Chen']},tags:['entity:lcls']})];
 for(const q of ['10.1234/abc','2610.00001','Smith','"A. Smith", "B. Chen"'])assert.deepEqual(select(items,'range=all&q='+encodeURIComponent(q)),['paper']);
 assert.deepEqual(select(items,'range=all&tag=entity%3Alcls'),['paper']);
 assert.deepEqual(select(items,'range=all&tag=lcls'),[]);
 assert.deepEqual(select([make('hidden-tag',{tags:['诊断'],queryTags:['诊断','entity:lcls']})],'range=all&tag=entity%3Alcls'),['hidden-tag']);
});
test('filtering precedes work selection, including an older version only matching a query',()=>{
 const older=make('v1',{title:'legacy distinctive',paper:{workId:'work',status:'preprint',arxivVersion:1,versionAt:'2026-09-01T00:00:00Z'}});
 const newer=make('v2',{title:'revised',paper:{workId:'work',status:'preprint',arxivVersion:2,versionAt:'2026-10-01T00:00:00Z'}});
 const data={candidates:[older,newer],memberships:{papers:['v1','v2']}};
 assert.deepEqual(select([newer],'range=all','papers',data),['v2']);
 assert.deepEqual(select([newer],'range=all&q=distinctive','papers',data),['v1']);
 assert.deepEqual(select([newer],'range=all','papers',{...data,memberships:{papers:['v1']}}),['v1']);
});
test('work representative prefers journal, arXiv version, version time then ascending id',()=>{
 const p=(id,workId,fields)=>make(id,{paper:{workId,status:'preprint',...fields}});
 const items=[p('preprint','one',{arxivVersion:9}),p('journal','one',{status:'journal'}),p('v1','two',{arxivVersion:1}),p('v2','two',{arxivVersion:2}),p('early','three',{versionAt:'2026-01-01'}),p('late','three',{versionAt:'2026-02-01'}),p('a','four',{}),p('b','four',{})];
 assert.deepEqual(new Set(select(items,'range=all')),new Set(['journal','v2','late','a']));
});
test('stream membership excludes general selected news and defaults match dynamic pages',()=>{
 const paper=make('paper',{selected:true,publishedAt:'2026-10-01'}),news=make('news',{stream:'news',selected:true,publishedAt:'2026-10-02'}),method=make('method',{stream:'news',selected:true,category:'methods',publishedAt:'2026-10-03'});
 assert.deepEqual(select([paper,news,method],'','selected'),['paper','method']);
 assert.deepEqual(select([paper,news,method],'range=all','facilities'),['news','method']);
 assert.deepEqual(select([paper,news,method],'','papers'),['paper']);
 assert.deepEqual(select([make('old')],'','papers'),[]);
 assert.deepEqual(select([make('old')],'range=all','papers'),['old']);
});
test('unknown dates sink and equal clocks sort by descending stable id',()=>{
 assert.deepEqual(select([make('a'),make('b'),make('unknown',{discoveredAt:null})],'range=all&sort=discovered'),['b','a','unknown']);
});
test('saved versions remain individually visible instead of collapsing the reader bookmarks',()=>{
 const items=[make('v1',{paper:{workId:'same',status:'preprint',arxivVersion:1}}),make('v2',{paper:{workId:'same',status:'preprint',arxivVersion:2}})];
 assert.deepEqual(selectStaticItems({generatedAt:now,items},'starred',new URLSearchParams(),new Set(['v1','v2'])).items.map(i=>i.id),['v2','v1']);
});
