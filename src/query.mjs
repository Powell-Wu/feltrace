// Academic filtering mirrors publication/academic.ts over the public version candidates.
export function selectStaticItems(data,stream,params,saved=new Set()) {
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
