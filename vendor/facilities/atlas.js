// One source for SSR, the application and exported snapshots. No reader-side data fetches.
const atlasEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const atlasDimensions = [
 ['accelerator','加速器技术'],['topology','驱动结构'],['timing','供束结构'],
 ['radiation','辐射方案'],['spectrum','光谱区域'],['inventory','源线组成'],['stage','资料阶段'],
];
const atlasPilots = ['lcls','european-xfel','shine'];
const atlasSourceBranches = profile => profile.branches.filter(branch => branch.level === 'source');
const atlasUnique = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];
function atlasSafeUrl(value) {
 try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
 catch { return null; }
}
function atlasSafeDataImage(value) {
 return typeof value==='string'&&/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value)?value:null;
}
function atlasSources(profile, refs) {
 return atlasUnique(refs ?? []).filter(ref => Number.isInteger(ref) && profile.sources[ref]).map(ref => ({...profile.sources[ref], ref}));
}
function atlasSourceList(profile, refs) {
 const sources = atlasSources(profile, refs);
 if (!sources.length) return '<p class="atlas-missing">逐项原文定位待补，已有设施分类来源见下方。</p>';
 return `<ul class="atlas-sources">${sources.map(source => {
  const url = atlasSafeUrl(source.url);
  return `<li><span class="atlas-source-mark">[${source.ref + 1}]</span> ${url ? `<a href="${atlasEsc(url)}" target="_blank" rel="noopener noreferrer">${atlasEsc(source.title)} ↗</a>` : atlasEsc(source.title)}<small>${atlasEsc(source.locator)}</small></li>`;
 }).join('')}</ul>`;
}
function atlasClaims(profile) {
 const branches = atlasSourceBranches(profile);
 const fallback = {
  accelerator: profile.accelerator,
  topology: '独立布局分类待补',
  timing: profile.pulseStructure,
  radiation: atlasUnique(branches.flatMap(branch => branch.modes)).join('；'),
  spectrum: atlasUnique(branches.map(branch => branch.band)).join('；'),
  inventory: `已收录 ${branches.length} 条源线：${branches.map(branch => branch.name).join('、')}`,
  stage: '按分支配置查阅',
 };
 return atlasDimensions.map(([key,label]) => profile.overview?.claims?.find(claim => claim.key === key) ?? {
  key,label,value:fallback[key] || '未收录',sourceRefs:[],sourceDate:null,
  qualification:key === 'inventory' ? '这是本站收录数，不代表设施源线总数；实验端站另计。' : key === 'topology' ? '不根据超导、常导或连续波标签推断是否采用能量回收。' : key === 'stage' ? '沿用已存分类与各配置的资料阶段，不据此断言当前可用能力。' : '沿用已有设施分类；逐项来源定位尚待补齐。',
 });
}
function atlasClaim(profile, key) {
 const claim=atlasClaims(profile).find(item => item.key === key);
 if(key === 'topology' && !/ERL|能量回收/i.test(`${claim.value} ${claim.qualification}`))return {...claim,qualification:`${claim.qualification} ERL（能量回收）状态未单独核实。`};
 return claim;
}
function atlasClaimMarkup(profile, key, context = 'compare') {
 const claim = atlasClaim(profile,key);
 const refs = atlasSources(profile,claim.sourceRefs);
 const disclosure = `${profile.id}:${key}:${context}`;
 return `<details class="atlas-claim${refs.length ? '' : ' atlas-inherited'}" data-atlas-disclosure="${atlasEsc(disclosure)}"><summary><span class="atlas-claim-value">${atlasEsc(claim.value)}</span><span class="atlas-source-mark">${refs.length ? refs.map(source => `[${source.ref+1}]`).join('') : '分类记录'}</span></summary><div class="atlas-claim-body"><p class="atlas-qualification">${atlasEsc(claim.qualification)}</p><p class="atlas-source-date">资料日期：${atlasEsc(claim.sourceDate ?? '原记录未注明')} · 分类记录核对：${atlasEsc(profile.checkedAt)}</p>${atlasSourceList(profile,claim.sourceRefs)}</div></details>`;
}
export function validAtlasSelection(ids, profiles) {
 return atlasUnique(ids).filter(id => profiles.some(profile => profile.id === id)).slice(0,4);
}
/** A link retains viewing conditions; changed catalogue content is always disclosed. */
export function restoreFacilityAtlas(data,hash='') {
 const params=new URLSearchParams(hash.replace(/^#/,''));
 if(!params.has('atlas'))return {};
 if(params.get('atlas')!=='1')return {message:'此链接使用了未支持的对比格式，请重新选择设施。'};
 const requested=(params.get('facilities')??'').split(',').filter(Boolean),selectedIds=validAtlasSelection(requested,data.profiles),messages=[];
 if(requested.length!==selectedIds.length)messages.push('链接中的部分设施不存在、重复或超出4项，已略过；请核对比较对象。');
 const revision=params.get('rev');
 if(revision&&revision!==data.revision)messages.push(data.revision?'资料版本已变化：当前显示现有资料，请重新核对出处与比较结论。':'当前资料没有版本标识，无法确认与分享时一致。');
 return {selectedIds,detailId:params.get('detail'),filter:params.get('filter'),search:(params.get('q')??'').slice(0,200),message:messages.join(' ')};
}
export function facilityAtlasHash(data,options={}) {
 const state=atlasState(data,options),params=new URLSearchParams({atlas:'1',facilities:state.selectedIds.join(','),detail:state.detailId??'',filter:state.filter});
 if(state.search)params.set('q',state.search);
 if(data.revision)params.set('rev',data.revision);
 return '#'+params;
}
export function facilityAtlasCsv(data,ids) {
 const quote=value=>'"'+String(value??'').replace(/^[=+@\t\r-]/,"'$&").replaceAll('"','""')+'"';
 const rows=[['catalogue_revision','facility_id','facility','dimension','label','value','conditions','source_date','review_date','sources'],...validAtlasSelection(ids,data.profiles).flatMap(id=>{
  const profile=data.profiles.find(profile=>profile.id===id);
  return atlasClaims(profile).map(claim=>[data.revision??'',id,profile.name,claim.key,claim.label,claim.value,claim.qualification,claim.sourceDate,profile.overview?.review?.checkedAt??profile.checkedAt,JSON.stringify(atlasSources(profile,claim.sourceRefs).map(({title,url,locator})=>({title,url,locator})))]);
 })];
 return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}
function atlasState(data, options) {
 const selectedIds = validAtlasSelection(Array.isArray(options.selectedIds) ? options.selectedIds : atlasPilots,data.profiles);
 const detailId = data.profiles.some(profile => profile.id === options.detailId) ? options.detailId : data.profiles.find(profile => profile.id === 'european-xfel')?.id ?? data.profiles[0]?.id;
 const candidate=options.basePath ?? '/';
 const basePath = /^\/(?:[a-zA-Z0-9_.~-]+\/)*$/.test(candidate) && !candidate.split('/').some(part=>part==='.'||part==='..') ? candidate : '/';
 const figureAssets=Object.fromEntries(Object.entries(options.figureAssets && typeof options.figureAssets==='object'?options.figureAssets:{}).filter(([key,value])=>atlasFigurePath(key,'/')&&atlasSafeDataImage(value)));
 return {selectedIds,detailId,search:String(options.search ?? '').slice(0,200),filter:['all','seeded','soft','hard'].includes(options.filter)?options.filter:'all',message:options.message ?? '',basePath,figureAssets,shareLink:options.shareLink??''};
}
function atlasReviewDate(profile) {
 const review=profile.overview?.review;
 return `<small class="atlas-review-date"${review?` title="${atlasEsc(review.summary)}"`:''}>${review?'资料核验':'分类记录'} · ${atlasEsc(review?.checkedAt ?? profile.checkedAt)}</small>`;
}
function atlasReview(profile) {
 const review=profile.overview?.review;
 const method={'official-web-and-archived-source':'官方网页与已归档原件核对'}[review?.method] ?? (/\p{Script=Han}/u.test(review?.method ?? '')?review.method:'');
 return `<section class="atlas-review" aria-label="资料核验范围"><div class="atlas-review-heading"><strong>${review?'本轮资料核验':'资料核验范围待补'}</strong><span>${atlasEsc(review?.checkedAt ?? profile.checkedAt)}</span></div>${review?`<p class="atlas-review-summary">${atlasEsc(review.summary)}</p>${method?`<p class="atlas-review-method">核验方式：${atlasEsc(method)}</p>`:''}`:'<p class="atlas-review-summary">沿用已有设施分类记录，尚未登记本轮原文核验范围；所示日期为既有分类记录日期。</p>'}<p class="atlas-review-boundary">核验范围以上述说明为准；不代表每个模式、每项参数均已更新到此日期，也不等于设施运行日期。</p></section>`;
}
function atlasFigurePath(value,basePath) {
 if(typeof value!=='string'||!/^\/facility-figures\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif|gif|svg)$/.test(value))return null;
 if(value.includes('//')||value.split('/').some(part=>part==='.'||part==='..'))return null;
 return basePath+value.slice(1);
}
function atlasFigures(profile,state) {
 const figures=profile.overview?.figures ?? [];
 return `<section class="atlas-figures" aria-labelledby="atlas-figures-title"><div class="atlas-section-head"><div><h3 id="atlas-figures-title">官方与作者原始布局图</h3><p>保留原图与图注，结合来源日期理解设施布局和建设阶段。</p></div></div>${figures.length?`<div class="atlas-figure-gallery">${figures.map(figure=>{
  const imagePath=atlasFigurePath(figure.imagePath,state.basePath),imageSource=imagePath?(state.figureAssets[figure.imagePath]??imagePath):null,originalUrl=atlasSafeUrl(figure.originalAssetUrl);
  const imageId=`atlas-figure-${profile.id}-${figure.id}`;
  return `<figure class="atlas-figure" data-atlas-figure="${atlasEsc(figure.id)}"><div class="atlas-figure-heading"><h4 id="${atlasEsc(imageId)}">${atlasEsc(figure.title)}</h4><span class="atlas-diagram-label">${figure.kind==='paper-layout'?'作者论文原图':'官方原图'}</span></div>${imageSource?`<div class="atlas-figure-viewport" role="region" aria-label="${atlasEsc(figure.title)}，可横向滚动查看" tabindex="0"><a href="${atlasEsc(imageSource)}" target="_blank" rel="noopener noreferrer" data-atlas-figure-original="${atlasEsc(figure.id)}"><img data-atlas-figure-image="${atlasEsc(figure.id)}" src="${atlasEsc(imageSource)}" alt="${atlasEsc(figure.caption)}" loading="lazy" decoding="async"></a></div><p class="atlas-figure-help">可横向滚动，或<a href="${atlasEsc(imageSource)}" target="_blank" rel="noopener noreferrer" data-atlas-figure-original="${atlasEsc(figure.id)}">查看原尺寸 ↗</a></p>`:'<p class="atlas-figure-unavailable">原图尚未入库。请通过下方来源查阅原始布局；未将外部图片地址直接嵌入页面。</p>'}<figcaption><p class="atlas-figure-caption"><span>原图注</span>${atlasEsc(figure.caption)}</p><p class="atlas-source-date">资料日期：${atlasEsc(figure.sourceDate ?? '原记录未注明')}</p><p class="atlas-figure-note">${atlasEsc(figure.note)}</p>${originalUrl?`<a class="atlas-text-button" href="${atlasEsc(originalUrl)}" target="_blank" rel="noopener noreferrer">来源原图入口 ↗</a>`:''}${atlasSourceList(profile,figure.sourceRefs)}</figcaption></figure>`;
 }).join('')}</div>`:'<p class="atlas-figure-unavailable">原始整体布局图尚未登记。已有功能关系示意仅供辅助理解，不能作为官方原图。</p>'}</section>`;
}
function atlasMatches(profile, state) {
 const branches = atlasSourceBranches(profile);
 const modes = [...branches.flatMap(branch => branch.modes),atlasClaim(profile,'radiation').value].join(' ');
 const bands = [...branches.map(branch => branch.band),atlasClaim(profile,'spectrum').value].join(' ');
 const terms = [profile.name,profile.region,profile.institution,profile.accelerator,profile.felType,modes,bands,...branches.map(branch=>branch.name),...atlasClaims(profile).map(claim=>claim.value)].join(' ').toLowerCase();
 return terms.includes(state.search.trim().toLowerCase()) && (state.filter === 'all' || state.filter === 'seeded' && /种子/.test(modes) || state.filter === 'soft' && /软X/.test(bands) || state.filter === 'hard' && /硬X/.test(bands));
}
function atlasOverview(data,state) {
 const profiles = data.profiles.filter(profile => atlasMatches(profile,state));
 return `<section class="atlas-overview" aria-labelledby="atlas-overview-title"><div class="atlas-section-head"><div><span class="atlas-eyebrow">01 / FACILITY LANDSCAPE</span><h2 id="atlas-overview-title">装置一览</h2><p>先看驱动与辐射方案。点击内容查看依据，选择设施进一步比较。</p></div><span class="atlas-count">${profiles.length} / ${data.profiles.length} 个设施</span></div><div class="atlas-scroll"><table class="atlas-table atlas-overview-table"><thead><tr><th scope="col">设施</th><th scope="col">加速器技术</th><th scope="col">辐射方案</th><th scope="col">光谱区域</th><th scope="col">源线组成</th></tr></thead><tbody>${profiles.map(profile => `<tr class="atlas-overview-row${state.selectedIds.includes(profile.id) ? ' is-selected' : ''}" data-atlas-facility="${atlasEsc(profile.id)}"><th scope="row" data-label="设施"><div class="atlas-facility-cell"><input type="checkbox" data-atlas-pick="${atlasEsc(profile.id)}" data-atlas-focus="pick:${atlasEsc(profile.id)}" aria-label="选择 ${atlasEsc(profile.name)} 进行设施对比" ${state.selectedIds.includes(profile.id) ? 'checked' : ''}><div><button class="atlas-facility-name" data-atlas-inspect="${atlasEsc(profile.id)}" data-atlas-focus="inspect:${atlasEsc(profile.id)}">${atlasEsc(profile.name)}</button><small class="atlas-meta">${atlasEsc([profile.region,profile.institution].filter(Boolean).join(' · '))}</small>${atlasReviewDate(profile)}</div></div></th>${[['accelerator','加速器技术'],['radiation','辐射方案'],['spectrum','光谱区域'],['inventory','源线组成']].map(([key,label]) => `<td data-label="${label}">${atlasClaimMarkup(profile,key,'overview')}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5"><p class="atlas-empty">没有匹配设施。试试设施名称、SASE、自种子或外种子。</p></td></tr>'}</tbody></table></div><p class="atlas-footnote">源线、光子束线与实验端站分别记录；已收录数不等于设施总数。分类资料不代表当前全部运行能力。</p></section>`;
}
function atlasComparison(data,state) {
 const profiles = state.selectedIds.map(id => data.profiles.find(profile => profile.id === id));
 return `<section class="atlas-comparison" aria-labelledby="atlas-comparison-title"><div class="atlas-section-head"><div><span class="atlas-eyebrow">02 / TECHNICAL COMPARISON</span><h2 id="atlas-comparison-title">技术路线对比</h2><p>将加速器技术、布局、供束与辐射方案分开看，不用一个标签概括整座设施。</p></div><div class="atlas-actions"><button class="atlas-text-button" data-atlas-share data-atlas-focus="share" ${profiles.length ? '' : 'disabled'}>分享此对比</button><button class="atlas-text-button" data-atlas-csv ${profiles.length ? '' : 'disabled'}>导出技术对比 CSV</button><button class="atlas-text-button" data-atlas-clear data-atlas-focus="clear" ${profiles.length ? '' : 'disabled'}>清空选择</button></div></div><div class="atlas-selection" aria-label="已选择的设施">${profiles.map((profile,index) => `<span class="atlas-selection-item"><span>${atlasEsc(profile.name)}</span>${index ? `<button class="atlas-text-button" data-atlas-move="${atlasEsc(profile.id)}" data-atlas-focus="move:${atlasEsc(profile.id)}" aria-label="将 ${atlasEsc(profile.name)} 向前移动">←</button>` : ''}<button class="atlas-text-button" data-atlas-remove="${atlasEsc(profile.id)}" data-atlas-focus="remove:${atlasEsc(profile.id)}" aria-label="移除 ${atlasEsc(profile.name)}">×</button></span>`).join('')}<small>${profiles.length} / 4 个设施</small></div>${state.shareLink?`<label class="atlas-share">对比链接<input readonly data-atlas-sharebox data-atlas-focus="sharebox" value="${atlasEsc(state.shareLink)}" aria-label="可复制的技术对比链接"><small>恢复所选设施、顺序和筛选；资料版本变化时会提示。</small></label>`:''}${profiles.length ? `<div class="atlas-scroll"><table class="atlas-table atlas-compare-table"><thead><tr><th scope="col">比较维度</th>${profiles.map(profile => `<th scope="col"><button class="atlas-facility-name" data-atlas-inspect="${atlasEsc(profile.id)}" data-atlas-focus="compare-inspect:${atlasEsc(profile.id)}">${atlasEsc(profile.name)}</button><small class="atlas-meta">${atlasEsc(profile.region)}</small>${atlasReviewDate(profile)}</th>`).join('')}</tr></thead><tbody>${atlasDimensions.map(([key,label]) => `<tr><th scope="row">${label}</th>${profiles.map(profile => `<td data-label="${atlasEsc(profile.name)}">${atlasClaimMarkup(profile,key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="atlas-empty">从装置一览中选择设施，最多可比较 4 个。选择设施不会混入源端与端站参数。</p>'}</section>`;
}
function atlasWrappedText(text,max=13) {
 const chars = Array.from(String(text));
 const result=[];
 for(let i=0;i<chars.length;i+=max)result.push(chars.slice(i,i+max).join(''));
 return result;
}
function atlasTopology(profile) {
 const topology = profile.overview?.topology;
 if (!topology?.nodes?.length) return `<section class="atlas-topology"><h3>整体结构</h3><p class="atlas-missing">整体架构图待补充。</p><p class="atlas-qualification">已有源线分类见右侧；不根据零散参数推测整机连接关系。</p>${atlasSourceList(profile,profile.sources.map((_,index)=>index))}</section>`;
 const nodes = topology.nodes;
 const edges = topology.edges.filter(edge=>nodes.some(node=>node.id===edge.from)&&nodes.some(node=>node.id===edge.to));
 const levels = new Map(nodes.map(node=>[node.id,0]));
 for(let i=0;i<nodes.length;i++){
  let changed=false;
  for(const edge of edges){const value=Math.min(nodes.length-1,levels.get(edge.from)+1);if(value>levels.get(edge.to)){levels.set(edge.to,value);changed=true;}}
  if(!changed)break;
 }
 const columns=atlasUnique(nodes.map(node=>levels.get(node.id))).sort((a,b)=>a-b);
 const rows=Math.max(...columns.map(level=>nodes.filter(node=>levels.get(node.id)===level).length));
 const boxWidth=166,boxHeight=Math.max(76,...nodes.map(node=>28+atlasWrappedText(node.label).length*17+(node.detail?8+atlasWrappedText(node.detail,21).length*14:0))),gapX=70,gapY=32,padding=20;
 const width=columns.length*(boxWidth+gapX)-gapX+padding*2,height=Math.max(180,rows*(boxHeight+gapY)-gapY+padding*2);
 const positions=new Map();
 for(const level of columns){const group=nodes.filter(node=>levels.get(node.id)===level);group.forEach((node,index)=>positions.set(node.id,{x:padding+columns.indexOf(level)*(boxWidth+gapX),y:(height-(group.length*boxHeight+(group.length-1)*gapY))/2+index*(boxHeight+gapY)}));}
 const marker=`atlas-arrow-${profile.id}`;
 const svgEdges=edges.map(edge=>{const from=positions.get(edge.from),to=positions.get(edge.to),x1=from.x+boxWidth,y1=from.y+boxHeight/2,x2=to.x,y2=to.y+boxHeight/2;return `<path class="atlas-edge atlas-topology-edge" d="M ${x1} ${y1} C ${x1+gapX/2} ${y1}, ${x2-gapX/2} ${y2}, ${x2-5} ${y2}" marker-end="url(#${atlasEsc(marker)})"/>${edge.label?`<text class="atlas-edge-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-7}" text-anchor="middle">${atlasEsc(edge.label)}</text>`:''}`;}).join('');
 const svgNodes=nodes.map(node=>{const {x,y}=positions.get(node.id),lines=atlasWrappedText(node.label),details=node.detail?atlasWrappedText(node.detail,21):[];return `<g class="atlas-node atlas-topology-node" data-kind="${atlasEsc(node.kind)}"><title>${atlasEsc(node.label+(node.detail?'：'+node.detail:''))}</title><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="10"/><text class="atlas-node-label" x="${x+boxWidth/2}" y="${y+25}" text-anchor="middle">${lines.map((line,index)=>`<tspan x="${x+boxWidth/2}" dy="${index?17:0}">${atlasEsc(line)}</tspan>`).join('')}</text>${details.length?`<text class="atlas-node-detail" x="${x+boxWidth/2}" y="${y+25+lines.length*17+5}" text-anchor="middle">${details.map((line,index)=>`<tspan x="${x+boxWidth/2}" dy="${index?14:0}">${atlasEsc(line)}</tspan>`).join('')}</text>`:''}</g>`;}).join('');
 return `<section class="atlas-topology"><div class="atlas-topology-heading"><h3>${atlasEsc(topology.title)}</h3><span class="atlas-diagram-label">功能关系示意</span></div><svg class="atlas-topology-svg" width="${width}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="atlas-topology-title-${atlasEsc(profile.id)}"><title id="atlas-topology-title-${atlasEsc(profile.id)}">${atlasEsc(profile.name)}：${atlasEsc(topology.title)}。${atlasEsc(edges.map(edge=>`${nodes.find(node=>node.id===edge.from).label} 到 ${nodes.find(node=>node.id===edge.to).label}`).join('；'))}</title><defs><marker id="${atlasEsc(marker)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>${svgEdges}${svgNodes}</svg><p class="atlas-qualification">${atlasEsc(topology.note)}</p><p class="atlas-footnote">依据所列资料整理，非比例图；不替代官方整体布局图。</p>${atlasSourceList(profile,topology.sourceRefs)}</section>`;
}
function atlasDetail(data,state) {
 const profile = data.profiles.find(profile=>profile.id===state.detailId);
 if (!profile) return '';
 const sourceBranches=atlasSourceBranches(profile),instruments=profile.branches.filter(branch=>branch.level==='instrument');
 return `<section class="atlas-detail" aria-labelledby="atlas-detail-title"><div class="atlas-section-head"><div><span class="atlas-eyebrow">03 / INSIDE THE FACILITY</span><h2 id="atlas-detail-title">${atlasEsc(profile.name)} · 结构与来源</h2></div><label class="atlas-detail-select">查看设施<select data-atlas-detail data-atlas-focus="detail">${data.profiles.map(item=>`<option value="${atlasEsc(item.id)}" ${item.id===profile.id?'selected':''}>${atlasEsc(item.name)}</option>`).join('')}</select></label></div><p class="atlas-description">${atlasEsc(profile.description ?? profile.felType)}</p>${atlasReview(profile)}<p class="atlas-scope">${atlasEsc(profile.overview?.scope ?? '沿用本站既有设施分类，逐项来源与整体结构尚待完善；以下为已收录分支，不代表完整设施目录。')}</p><section class="atlas-inventory"><h3>源线组成与统计口径</h3>${atlasClaimMarkup(profile,'inventory','detail')}</section>${atlasFigures(profile,state)}<div class="atlas-detail-grid">${atlasTopology(profile)}<section class="atlas-branches"><h3>本站已收录的分支参数</h3><p class="atlas-qualification">参数目录已收录 ${sourceBranches.length} 条源线${instruments.length?`、${instruments.length} 个实验端站`:''}；各自参数与资料阶段分别保留，不代表设施源线或端站总数。</p>${[...sourceBranches,...instruments].map(branch=>`<article class="atlas-branch" data-atlas-branch="${atlasEsc(branch.id)}"><div><h4>${atlasEsc(branch.name)}</h4><span class="atlas-band">${atlasEsc(branch.band)}</span></div><p class="atlas-branch-modes">${atlasEsc(branch.modes.join(' · '))}</p>${branch.note?`<p class="atlas-qualification">${atlasEsc(branch.note)}</p>`:''}${branch.description?`<p>${atlasEsc(branch.description)}</p>`:''}</article>`).join('')}<button class="atlas-button" data-atlas-open-parameters="${atlasEsc(profile.id)}" data-atlas-focus="parameters">查看分支参数与工况 →</button></section></div><details class="atlas-evidence" data-atlas-disclosure="${atlasEsc(profile.id)}:sources"><summary>全部分类来源与资料边界 <span>${profile.sources.length} 项</span></summary><p>分类记录核对：${atlasEsc(profile.checkedAt)}。资料与运行日期分别记录，原文核验范围见上方说明；具体参数保留各自的版本与工况。</p>${atlasSourceList(profile,profile.sources.map((_,index)=>index))}<a class="atlas-text-button" href="${atlasEsc(state.basePath)}facilities/${atlasEsc(profile.id)}/research/">继续阅读 ${atlasEsc(profile.name)} 相关研究 →</a></details></section>`;
}
export function renderFacilityAtlas(data,options={}) {
 const state=atlasState(data,options);
 return `<section class="atlas-section"><div class="atlas-toolbar"><label class="atlas-search">查找设施或技术方案<input type="search" data-atlas-search data-atlas-focus="search" value="${atlasEsc(state.search)}" placeholder="设施、SASE、自种子、外种子…"></label><label>快速查看<select data-atlas-filter data-atlas-focus="filter">${[['all','全部设施'],['seeded','含种子方案'],['soft','含软X分支'],['hard','含硬X分支']].map(([value,label])=>`<option value="${value}" ${state.filter===value?'selected':''}>${label}</option>`).join('')}</select></label><p class="atlas-toolbar-note">${data.profiles.length} 个设施 · 最多选择 4 个<br>各方案按分支与资料时期记录</p></div><p class="atlas-status" role="status" aria-live="polite">${atlasEsc(state.message)}</p>${atlasOverview(data,state)}${atlasComparison(data,state)}${atlasDetail(data,state)}<dialog class="atlas-figure-dialog" aria-labelledby="atlas-figure-dialog-title"><div class="atlas-figure-dialog-heading"><h3 id="atlas-figure-dialog-title">原始布局图</h3><button type="button" data-atlas-figure-close aria-label="关闭原图">关闭 ×</button></div><div class="atlas-figure-dialog-viewport"></div><p>原尺寸显示，可在图内横向或纵向滚动；按 Esc 返回。</p></dialog></section>`;
}
export function mountFacilityAtlas(root,data) {
 let figureAssets={};
 try{figureAssets=JSON.parse(root.ownerDocument.querySelector('#facility-figure-assets')?.textContent ?? '{}');}catch{}
 let state=atlasState(data,{basePath:root.ownerDocument.body?.dataset?.base ?? '/',figureAssets,...restoreFacilityAtlas(data,root.ownerDocument.defaultView.location.hash)});
 const open=new Set();
 const render=()=>{
  for(const detail of root.querySelectorAll('[data-atlas-disclosure]')){if(detail.open)open.add(detail.dataset.atlasDisclosure);else open.delete(detail.dataset.atlasDisclosure);}
  const active=root.ownerDocument.activeElement;
  const focus=root.contains(active)?active?.dataset?.atlasFocus:null;
  const range=active?.tagName==='INPUT'&&active.type==='search'?[active.selectionStart,active.selectionEnd]:null;
  root.innerHTML=renderFacilityAtlas(data,state);
  for(const detail of root.querySelectorAll('[data-atlas-disclosure]'))detail.open=open.has(detail.dataset.atlasDisclosure);
  if(focus){const candidates=[...root.querySelectorAll('[data-atlas-focus]')];const replacement=candidates.find(element=>element.dataset.atlasFocus===focus) ?? (focus.startsWith('move:') ? candidates.find(element=>element.dataset.atlasFocus===focus.replace('move:','pick:')) : null);replacement?.focus({preventScroll:true});if(range)replacement?.setSelectionRange?.(...range);}
 };
 const onInput=event=>{if(event.target?.matches?.('[data-atlas-search]')&&!event.isComposing){state.search=event.target.value;state.shareLink='';state.message='';render();}};
 const onCompositionEnd=event=>{if(event.target?.matches?.('[data-atlas-search]')){state.search=event.target.value;state.shareLink='';render();}};
 const onChange=event=>{
  const target=event.target;
  if(target.matches?.('[data-atlas-pick],[data-atlas-filter],[data-atlas-detail]'))state.shareLink='';
  if(target.matches?.('[data-atlas-pick]')){const id=target.dataset.atlasPick;if(target.checked){if(state.selectedIds.length>=4){state.message='最多比较 4 个设施，请先移除其中一项。';}else{state.selectedIds.push(id);state.message=`已选择 ${state.selectedIds.length} 个设施。`;}}else{state.selectedIds=state.selectedIds.filter(value=>value!==id);state.message=`已选择 ${state.selectedIds.length} 个设施。`;}render();}
  else if(target.matches?.('[data-atlas-filter]')){state.filter=target.value;state.message='';render();}
  else if(target.matches?.('[data-atlas-detail]')){state.detailId=target.value;render();}
 };
 const onClick=event=>{
  const imageLink=event.target?.closest?.('[data-atlas-figure-original]');
  if(imageLink&&root.contains(imageLink)){
   const dialog=root.querySelector('.atlas-figure-dialog');
   if(typeof dialog?.showModal==='function'){
    event.preventDefault();
    const picture=root.ownerDocument.createElement('img'),figure=imageLink.closest('figure');
    picture.src=imageLink.getAttribute('href');picture.alt=figure?.querySelector('img')?.alt ?? '';
    dialog.querySelector('h3').textContent=figure?.querySelector('h4')?.textContent ?? '原始布局图';
    dialog.querySelector('.atlas-figure-dialog-viewport').replaceChildren(picture);
    dialog.showModal();dialog.querySelector('[data-atlas-figure-close]').focus();
   }
   return;
  }
  const button=event.target?.closest?.('button');if(!button||!root.contains(button))return;
  if(button.matches('[data-atlas-inspect],[data-atlas-remove],[data-atlas-move],[data-atlas-clear]'))state.shareLink='';
  if(button.hasAttribute('data-atlas-figure-close')){root.querySelector('.atlas-figure-dialog')?.close();}
  else if(button.hasAttribute('data-atlas-inspect')){state.detailId=button.dataset.atlasInspect;render();const detail=root.querySelector('.atlas-detail');detail?.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(button.hasAttribute('data-atlas-remove')){state.selectedIds=state.selectedIds.filter(id=>id!==button.dataset.atlasRemove);state.message=`已选择 ${state.selectedIds.length} 个设施。`;render();root.querySelector('.atlas-selection button, [data-atlas-pick]')?.focus({preventScroll:true});}
  else if(button.hasAttribute('data-atlas-move')){const index=state.selectedIds.indexOf(button.dataset.atlasMove);if(index>0)[state.selectedIds[index-1],state.selectedIds[index]]=[state.selectedIds[index],state.selectedIds[index-1]];render();}
  else if(button.hasAttribute('data-atlas-share')){const win=root.ownerDocument.defaultView,url=new URL(win.location.href);url.hash=facilityAtlasHash(data,state);win.history.replaceState(win.history.state,'',url);state.shareLink=url.href;render();root.querySelector('[data-atlas-sharebox]')?.select();}
  else if(button.hasAttribute('data-atlas-csv')){const win=root.ownerDocument.defaultView,url=win.URL.createObjectURL(new Blob([facilityAtlasCsv(data,state.selectedIds)],{type:'text/csv;charset=utf-8'})),link=root.ownerDocument.createElement('a');link.href=url;link.download='feltrace-facility-comparison.csv';link.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
  else if(button.hasAttribute('data-atlas-clear')){state.selectedIds=[];state.message='已清空设施选择。';render();root.querySelector('[data-atlas-pick]')?.focus({preventScroll:true});}
  else if(button.hasAttribute('data-atlas-open-parameters')){const EventClass=root.ownerDocument.defaultView.CustomEvent;root.dispatchEvent(new EventClass('facility:parameters',{bubbles:true,detail:{facilityId:button.dataset.atlasOpenParameters}}));}
 };
 const onHash=()=>{state=atlasState(data,{basePath:state.basePath,figureAssets:state.figureAssets,...restoreFacilityAtlas(data,root.ownerDocument.defaultView.location.hash)});render();};
 root.ownerDocument.defaultView.addEventListener('hashchange',onHash);
 root.addEventListener('input',onInput);root.addEventListener('compositionend',onCompositionEnd);root.addEventListener('change',onChange);root.addEventListener('click',onClick);
 render();
 return()=>{root.ownerDocument.defaultView.removeEventListener('hashchange',onHash);root.removeEventListener('input',onInput);root.removeEventListener('compositionend',onCompositionEnd);root.removeEventListener('change',onChange);root.removeEventListener('click',onClick);};
}
