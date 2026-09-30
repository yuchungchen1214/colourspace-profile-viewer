// bcs data, visibility, and the summary shown above the charts.
const $=id=>document.getElementById(id),palette=['#56b4e9','#e69f00','#009e73','#cc79a7','#d55e00','#f0e442','#7088ff','#a9c95a','#ff748c','#b58aff'];let profiles=(window.BUILTIN_DEMO_BCS||[]).map(({name,text})=>({...parseBcsText(text,name,'built-in/'+name+'.bcs',text.length,0),builtIn:true,flatSource:true}));const hiddenProfiles=new Set(),selectedFileIndices=new Set(),collapsedProfileFolders=new Set(),collapsedProfileCategories=new Set();let selectionAnchor=-1,hoveredProfileIndex=-1;function profileVisible(i){return !hiddenProfiles.has(i)}
const targetPresets=[
 {label:'sRGB',gamutId:'srgbRec709',whitePointId:'d65',eotfId:'srgb'},
 {label:'Rec.709',gamutId:'srgbRec709',whitePointId:'d65',eotfId:'bt1886'},
 {label:'Adobe RGB',gamutId:'adobeRgb',whitePointId:'d65',eotfId:'custom',gamma:2.19921875},
 {label:'P3',gamutId:'p3',whitePointId:'dci',eotfId:'gamma26'},
 {label:'Rec. 2020',gamutId:'rec2020',whitePointId:'d65',eotfId:'bt1886'}
];
// The first file is normally topmost; a hovered visible file temporarily takes that layer.
function forEachVisibleProfileBackToFront(draw,panel=null){
 const selected=panel?.selectedProfiles;
 const visible=i=>profileVisible(i)||panel?.localShownProfiles.has(i)||i===hoveredProfileIndex;
 for(let i=profiles.length-1;i>=0;i--)if((!selected||selected.has(i))&&i!==hoveredProfileIndex&&visible(i))draw(profiles[i],i);
 if(hoveredProfileIndex>=0&&hoveredProfileIndex<profiles.length&&visible(hoveredProfileIndex)&&(!selected||selected.has(hoveredProfileIndex)))draw(profiles[hoveredProfileIndex],hoveredProfileIndex);
}
function profileDeemphasized(index){return hoveredProfileIndex>=0&&hoveredProfileIndex<profiles.length&&activeChartPanels().some(panel=>panel.selectedProfiles?.has(hoveredProfileIndex))&&index!==hoveredProfileIndex}
const mutedChartColorCache=new Map();
function chartProfileColor(color,index){
 if(!profileDeemphasized(index)||!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color))return color;
 if(!mutedChartColorCache.has(color)){
  const expanded=color.length===4?'#'+[1,2,3].map(offset=>color[offset].repeat(2)).join(''):color;
  const rgb=[1,3,5].map(offset=>parseInt(expanded.slice(offset,offset+2),16)),gray=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  mutedChartColorCache.set(color,'#'+rgb.map(value=>Math.round((gray+(value-gray)*.42)*.78).toString(16).padStart(2,'0')).join(''));
 }
 return mutedChartColorCache.get(color);
}
function setHoveredProfile(index){if(hoveredProfileIndex===index)return;hoveredProfileIndex=index;render()}
function useProfileColors(panel){return panel.colorMode==='profiles'}
function parseBcsText(text,name,sourcePath=name,fileSize=text.length,fileLastModified=0){
 const d=new DOMParser().parseFromString(text,'application/xml');
 const points=[...d.querySelectorAll('patch')].map(p=>{let n=k=>Number(p.querySelector(k)?.textContent);return{r:n('red'),g:n('green'),b:n('blue'),X:n('X'),Y:n('Y'),Z:n('Z')}}).filter(p=>Object.values(p).every(Number.isFinite));
 const head=d.querySelector('builder_color_space > head'),x=head?.querySelector('x'),y=head?.querySelector('y');
 const coordinate=(key)=>{const xv=x?.getAttribute(key),yv=y?.getAttribute(key);return xv!==null&&xv!==undefined&&yv!==null&&yv!==undefined&&Number.isFinite(Number(xv))&&Number.isFinite(Number(yv))?[Number(xv),Number(yv)]:null};
 const gammaText=head?.querySelector('gamma')?.textContent?.trim(),gamma=gammaText&&Number.isFinite(Number(gammaText))?Number(gammaText):null;
 const headTarget=head?{primaries:Object.fromEntries(['R','G','B'].map((channel,index)=>[channel,coordinate(['red','green','blue'][index])])),whitePoint:coordinate('white'),gamma}:null;
 return{name,sourcePath,fileSize,fileLastModified,rawText:text,points,headTarget};
}
function parse(file,sourcePath=file.webkitRelativePath||file.name){return file.text().then(text=>parseBcsText(text,file.name,sourcePath,file.size,file.lastModified))}
function isMeasuredProfile(profile){return profile.points.length>0}
function isSupportedProfile(profile){return isMeasuredProfile(profile)||Boolean(profile.headTarget&&([...Object.values(profile.headTarget.primaries),profile.headTarget.whitePoint].some(Boolean)||Number.isFinite(profile.headTarget.gamma)))}
const builtInProfilePalette=['#b58aff','#ff748c'];
function profileColor(index){
 const profile=profiles[index];
 if(profile?.displayColor)return profile.displayColor;
 if(profile?.builtIn)return builtInProfilePalette[profiles.slice(0,index).filter(item=>item.builtIn).length%builtInProfilePalette.length];
 const importedIndex=profiles.slice(0,index).filter(item=>!item.builtIn).length;
 return palette[importedIndex%palette.length];
}

const profileSummaryCache=new WeakMap();let activeProfileIndex=0;
// Assignments belong to stable Profile IDs; slots determine their vertical order.
const profilePanelIndices=[-1,-1,-1,-1],profilePanelIdsBySlot=[1,2,3,4],profileRowWeights=[1,1,1,1];
let profileLayoutRows=2;
const PROFILE_PANEL_MIN_HEIGHT=60;
const PROFILE_PANEL_DRAG_TYPE='application/x-colourspace-profile-panel-id';
let draggingProfilePanelId=null,suppressProfileMenuClick=false;
function profilePanelIdAtSlot(slot){return profilePanelIdsBySlot[slot-1]}
function profileIndexAtSlot(slot){return profilePanelIndices[profilePanelIdAtSlot(slot)-1]}
function profilePanelElementAtSlot(slot){return document.querySelector(`.profile-compare-panel[data-profile-id="${profilePanelIdAtSlot(slot)}"]`)}
function updateProfileGridPlacement(){
 for(let slot=1;slot<=4;slot++){const panel=profilePanelElementAtSlot(slot);if(panel)panel.style.gridRow=profileLayoutRows===2?'':String(slot*2-1)}
 for(let gap=1;gap<=3;gap++){const handle=document.getElementById(gap===1?'profileRowResizer':`profileRowResizer${gap}${gap+1}`);if(handle)handle.style.gridRow=profileLayoutRows===2?'':String(gap*2)}
}
function setProfileSlotAssignments(ids){
 if(!Array.isArray(ids)||ids.length<2||ids.length>4||new Set(ids).size!==ids.length||ids.some(id=>!Number.isInteger(id)||id<1||id>4))throw new Error('Invalid Profile slot assignments.');
 const normalized=[...ids,...[1,2,3,4].filter(id=>!ids.includes(id))];
 profilePanelIdsBySlot.splice(0,4,...normalized);
 for(let slot=1;slot<=4;slot++){
  const panel=profilePanelElementAtSlot(slot);
  panel.dataset.profileSlot=String(slot);
  panel.classList.toggle('profile-slot-one',slot===1);panel.classList.toggle('profile-slot-two',slot===2);
  panel.querySelector('.profile-clear-button').dataset.profileSlot=String(slot);
  const profile=profiles[profileIndexAtSlot(slot)];
  panel.setAttribute('aria-label',`Profile comparison slot ${slot}${profile?`: ${profile.name}`:''}`);
 }
 updateProfileGridPlacement();renderProfilePanels();
}
function setProfileLayout(rows){
 if(!Number.isInteger(rows)||rows<1||rows>4)throw new Error('Profile layout must contain one to four rows.');
 profileLayoutRows=rows;
 const column=document.querySelector('.profile-column');
 column.dataset.layoutRows=String(rows);column.style.setProperty('--profile-layout-rows',String(rows));
 column.classList.toggle('profile-layout-expanded',rows!==2);
 document.querySelector('.dashboard-layout').style.setProperty('--profile-layout-min-height',rows===4?'276px':rows===3?'204px':'0px');
 column.style.gridTemplateRows=rows===2?'':Array.from({length:rows},(_,index)=>`${index? '12px ':''}minmax(${PROFILE_PANEL_MIN_HEIGHT}px, ${profileRowWeights[index]}fr)`).join(' ');
 for(let gap=1;gap<=3;gap++){
  const handle=document.getElementById(gap===1?'profileRowResizer':`profileRowResizer${gap}${gap+1}`);
  if(handle)handle.hidden=gap>=rows;
 }
 updateProfileGridPlacement();
 document.querySelectorAll('.profile-compare-panel').forEach(panel=>{panel.hidden=Number(panel.dataset.profileSlot)>rows});
}
function distributeProfileRowsEvenly(){
 if(profileLayoutRows===2){window.setProfileRowsEqualHeight?.();return}
 profileRowWeights.fill(1);updateExpandedProfileTracks();
}
function swapProfilePanels(sourceId,targetId){
 if(sourceId===targetId||window.__viewerReadOnlyReport)return;
 clearFilesProfilePreview();
 for(let slot=1;slot<=4;slot++){clearTargetMeasuredPreview(`profile-${slot}`);clearLocatedFile(`profile-${slot}`)}
 const next=[...profilePanelIdsBySlot],sourceSlot=next.indexOf(sourceId),targetSlot=next.indexOf(targetId);
 if(sourceSlot<0||targetSlot<0)return;
 [next[sourceSlot],next[targetSlot]]=[next[targetSlot],next[sourceSlot]];
 setProfileSlotAssignments(next);
}
let previewProfileIndex=-1,previewProfileSlot=-1,pendingSettingsProfileLinks=null;
let targetMeasuredPreview=null;
let locatedFile=null;
const fileLocatorArrow=document.createElement('div');fileLocatorArrow.className='file-locator-arrow';fileLocatorArrow.hidden=true;fileLocatorArrow.setAttribute('role','status');$('filesPanel').append(fileLocatorArrow);
function clearLocatedFile(source){
 if(locatedFile?.source!==source)return;
 locatedFile.marker?.classList.remove('file-located');$('profiles').classList.remove('file-locating');fileLocatorArrow.hidden=true;
 locatedFile=null;
}
function updateLocatedFileMarker(){
 if(!locatedFile?.row?.isConnected){fileLocatorArrow.hidden=true;return}
 const list=$('profiles'),listRect=list.getBoundingClientRect();
 let marker=locatedFile.row;
 for(let parent=marker.parentElement;parent&&parent!==list;parent=parent.parentElement){
  if(parent.classList.contains('profile-category-content')&&parent.hidden)marker=parent.previousElementSibling||marker;
  if(parent.classList.contains('profile-folder-children')&&parent.hidden)marker=parent.previousElementSibling||marker;
 }
 locatedFile.marker?.classList.remove('file-located');locatedFile.marker=marker;
 const rect=marker.getBoundingClientRect(),above=rect.bottom<=listRect.top+4,below=rect.top>=listRect.bottom-4;
 marker.classList.toggle('file-located',!above&&!below);
 fileLocatorArrow.hidden=!above&&!below;
 if(!fileLocatorArrow.hidden){
  fileLocatorArrow.textContent=above?'▲':'▼';
  fileLocatorArrow.style.top=`${list.offsetTop+(above?4:list.clientHeight-38)}px`;
  fileLocatorArrow.setAttribute('aria-label',`${profiles[locatedFile.index].name} is ${above?'above':'below'} the Files list`);
 }
}
function locateFile(index,source){
 if(!Number.isInteger(index)||!profiles[index]){clearLocatedFile(source);return}
 if(locatedFile?.index===index&&locatedFile.source===source&&locatedFile.row?.isConnected)return;
 if(locatedFile)clearLocatedFile(locatedFile.source);
 const list=$('profiles'),row=list.querySelector(`.profile-item[data-profile-index="${index}"]`);
 if(!row)return;
 list.classList.add('file-locating');
 locatedFile={index,source,profile:profiles[index],row,marker:null};updateLocatedFileMarker();
}
$('profiles').addEventListener('scroll',updateLocatedFileMarker);
function updateTargetMeasuredFields(){
 for(const kind of ['ymax','ymin']){
  if(TARGET_CONFIG.luminance[kind].mode!=='measured')continue;
  const input=$(`target${kind==='ymax'?'Ymax':'Ymin'}Value`);
  const measured=targetMeasuredPreview&&profiles[targetMeasuredPreview.index]?measuredProfileLuminanceRange(profiles[targetMeasuredPreview.index]):null;
  const value=kind==='ymax'?measured?.max:(measured?.hasMin?measured.min:null);
  input.value=Number.isFinite(value)?String(value):'';
 }
 const whiteInputs=$('targetWhiteCoordinates').querySelectorAll('input'),preview=targetMeasuredPreview&&profiles[targetMeasuredPreview.index]?measuredProfileWhitePoint(profiles[targetMeasuredPreview.index]):null;
 const whitePoint=TARGET_CONFIG.whitePointId==='measured'?preview:TARGET_CONFIG.whitePoint;
 whiteInputs.forEach((input,index)=>{input.disabled=TARGET_CONFIG.whitePointId==='measured';input.value=whitePoint?Number(index===0?whitePoint.x:whitePoint.y).toFixed(4):''});
}
function previewTargetMeasured(index,source){
 if(!Number.isInteger(index)||!profiles[index]){clearTargetMeasuredPreview(source);return}
 targetMeasuredPreview={index,source};updateTargetMeasuredFields();
}
function clearTargetMeasuredPreview(source){
 if(targetMeasuredPreview?.source!==source)return;
 targetMeasuredPreview=null;updateTargetMeasuredFields();
}
function averageProfileEotf(p){
 const grey=p.points.filter(q=>[q.r,q.g,q.b,q.Y].every(Number.isFinite)&&Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002).sort((a,b)=>a.r-b.r);
 if(grey.length<3)return NaN;
 const black=grey.find(q=>q.r<=1e-6),white=[...grey].reverse().find(q=>q.r>=1-1e-6);
 const inputMin=black?.r??0,inputMax=white?.r??1,blackY=black?.Y??0,whiteY=white?.Y??Math.max(...grey.map(q=>q.Y)),inputSpan=inputMax-inputMin,lumaSpan=whiteY-blackY;
 if(!(inputSpan>0&&lumaSpan>0))return NaN;
 const gammas=grey.map(q=>{
  const input=(q.r-inputMin)/inputSpan,luma=(q.Y-blackY)/lumaSpan;
  return input>0&&input<1&&luma>0&&luma<1?Math.log(luma)/Math.log(input):NaN;
 }).filter(Number.isFinite);
 return gammas.length?gammas.reduce((sum,gamma)=>sum+gamma,0)/gammas.length:NaN;
}
function profileSummary(p){
 const cached=profileSummaryCache.get(p);
 if(cached?.target===TARGET_CONFIG)return cached.summary;
 const values=p.points.map(q=>cieMetrics(q,p).de).filter(Number.isFinite),mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:NaN,max=values.length?Math.max(...values):NaN;
 const grey=p.points.filter(q=>Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002).sort((a,b)=>a.r-b.r),measuredY=grey.map(q=>q.Y).filter(Number.isFinite),blackPatch=grey.find(q=>q.r<=1e-6&&q.g<=1e-6&&q.b<=1e-6),min=blackPatch?.Y??NaN,maxY=measuredY.length?Math.max(...measuredY):NaN,gamma=averageProfileEotf(p);
 const summary={min,max:maxY,cr:min>0?maxY/min:NaN,mean,maxDe:max,gamma,count:values.length};
 profileSummaryCache.set(p,{target:TARGET_CONFIG,summary});return summary;
}
function renderTargetDetails(){
 const {gamut,whitePoint,eotf,luminance}=TARGET_CONFIG;
 $('targetGamut').value=TARGET_CONFIG.gamutId;
 $('targetWhitePoint').value=TARGET_CONFIG.whitePointId;
 $('targetEotf').value=TARGET_CONFIG.eotfId;
 const gammaInput=$('targetGammaValue');gammaInput.disabled=false;gammaInput.step=TARGET_CONFIG.eotfId==='custom'?'any':'0.01';if(gammaInput!==document.activeElement)gammaInput.value=Number.isFinite(eotf.gamma)?(TARGET_CONFIG.eotfId==='custom'?String(eotf.gamma):Number(eotf.gamma).toFixed(TARGET_CONFIG.eotfId==='bt1886'?3:2)):'';gammaInput.title='Edit Gamma; changes EOTF to Custom';
 const coordinateInput=(value,label)=>{const input=document.createElement('input');input.type='number';input.step='any';input.value=Number(value).toFixed(4);input.disabled=false;input.setAttribute('aria-label',label);input.title=`Edit ${label}; changes setting to Custom`;input.addEventListener('input',()=>input.setCustomValidity(''));return input};
 const primaries=$('targetPrimaries');
 const coordinateFields=(x,y,xLabel,yLabel)=>{const fields=document.createElement('div');fields.className='target-coordinate-fields';fields.append(coordinateInput(x,xLabel),document.createTextNode(','),coordinateInput(y,yLabel));return fields};
 if(!primaries.children.length){
  for(const channel of ['R','G','B']){const row=document.createElement('div');row.className='target-coordinate-row';row.dataset.channel=channel;const label=document.createElement('span');label.textContent=`${channel} =`;const [x,y]=gamut.primaries[channel];row.append(label,coordinateFields(x,y,`${channel} primary x`,`${channel} primary y`));primaries.append(row)}
 }
 const whiteCoordinates=$('targetWhiteCoordinates');
 if(!whiteCoordinates.children.length){const whiteRow=document.createElement('div');whiteRow.className='target-coordinate-row';const whiteLabel=document.createElement('span');whiteLabel.textContent='W =';whiteRow.append(whiteLabel,coordinateFields(whitePoint.x,whitePoint.y,'White point x','White point y'));whiteCoordinates.append(whiteRow)}
 const updateCoordinate=(input,value)=>{if(input===document.activeElement||!input.validity.valid)return;input.value=Number(value).toFixed(4)};
 for(const channel of ['R','G','B']){const row=primaries.querySelector(`[data-channel="${channel}"]`),[x,y]=gamut.primaries[channel],[xInput,yInput]=row.querySelectorAll('input');updateCoordinate(xInput,x);updateCoordinate(yInput,y)}
 const [whiteX,whiteY]=whiteCoordinates.querySelectorAll('input');updateCoordinate(whiteX,whitePoint.x);updateCoordinate(whiteY,whitePoint.y);
 for(const kind of ['ymax','ymin']){
  const setting=luminance[kind],id=kind==='ymax'?'Ymax':'Ymin',button=$(`target${id}Mode`),input=$(`target${id}Value`);
  button.textContent=setting.mode==='measured'?'Measured':'Custom';
  button.title=`Switch ${id} to ${setting.mode==='measured'?'Custom':'Measured'}`;
  button.setAttribute('aria-pressed',String(setting.mode==='custom'));
  input.disabled=false;
  if(input!==document.activeElement&&input.validity.valid)input.value=setting.mode==='custom'&&Number.isFinite(setting.value)?String(setting.value):'';
  input.placeholder='';
 }
 updateTargetMeasuredFields();
 primaries.querySelectorAll('input').forEach(input=>input.onchange=event=>{
  const values={};for(const channel of ['R','G','B']){const row=primaries.querySelector(`[data-channel="${channel}"]`);values[channel]=[...row.querySelectorAll('input')].map(field=>Number(field.value))}
  try{selectCustomTargetPrimaries(values);primaries.querySelectorAll('input').forEach(input=>input.setCustomValidity(''));refresh()}catch(error){event.target.setCustomValidity(error.message)}
 });
 whiteCoordinates.querySelectorAll('input').forEach(input=>input.onchange=event=>{
  const [x,y]=[...whiteCoordinates.querySelectorAll('input')].map(field=>Number(field.value));
  try{selectCustomTargetWhitePoint(x,y);whiteCoordinates.querySelectorAll('input').forEach(input=>input.setCustomValidity(''));refresh()}catch(error){event.target.setCustomValidity(error.message)}
 });
}
function gamutCoverage(primaries){
 const xy=patch=>{if(!patch)return null;const total=patch.X+patch.Y+patch.Z;return Number.isFinite(total)&&total>1e-12?[patch.X/total,patch.Y/total]:null};
 let polygon=['R','G','B'].map(channel=>xy(primaries[channel]));
 if(polygon.some(point=>!point||!point.every(Number.isFinite)))return NaN;
 const target=['R','G','B'].map(channel=>TARGET_CONFIG.gamut.primaries[channel]);
 const signedArea=points=>points.reduce((sum,point,i)=>{const next=points[(i+1)%points.length];return sum+point[0]*next[1]-next[0]*point[1]},0)/2;
 const targetArea=Math.abs(signedArea(target));
 if(!(targetArea>0))return NaN;
 const orientation=Math.sign(signedArea(target));
 for(let i=0;i<target.length;i++){
  const a=target[i],b=target[(i+1)%target.length];
  const side=point=>orientation*((b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]));
  const input=polygon;polygon=[];
  for(let j=0;j<input.length;j++){
   const start=input[j],end=input[(j+1)%input.length],ds=side(start),de=side(end),startInside=ds>=-1e-12,endInside=de>=-1e-12;
   if(startInside!==endInside){const t=ds/(ds-de);polygon.push([start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])])}
   if(endInside)polygon.push(end);
  }
  if(!polygon.length)return 0;
 }
 return Math.max(0,Math.min(1,Math.abs(signedArea(polygon))/targetArea));
}
function renderProfilePanel(slot){
 const panel=profilePanelElementAtSlot(slot),index=previewProfileSlot===slot?previewProfileIndex:profileIndexAtSlot(slot),profile=profiles[index];
 if(!panel)return;
 const gamut=panel.querySelector('.profile-gamut'),stats=panel.querySelector('.profile-stats');
 const nameRow=panel.querySelector('.profile-assignment-name'),filename=panel.querySelector('.profile-assignment-filename'),dot=panel.querySelector('.profile-assignment-dot');
 panel.classList.toggle('has-profile',Boolean(profile));
 if(!profile){gamut.textContent='';stats.textContent='';filename.textContent='';nameRow.title='';return}
 filename.textContent=profile.name;filename.title=profile.sourcePath||profile.name;nameRow.title=profile.sourcePath||profile.name;dot.style.setProperty('--profile-color',profileColor(index));
 const primaries=ciePrimaryPoints(profile),summary=profileSummary(profile);
 const xy=patch=>{
  if(!patch)return 'N/A';
  const total=patch.X+patch.Y+patch.Z;
  return total>1e-12?`${(patch.X/total).toFixed(4)}, ${(patch.Y/total).toFixed(4)}`:'N/A';
 };
 const nits=(value,digits)=>Number.isFinite(value)?`${value.toFixed(digits)} nits`:'N/A';
 gamut.textContent=[
  'Gamut:',
  ...['R','G','B','W'].map(channel=>`${channel} = ${xy(primaries[channel])}`),
  `EOTF: ${Number.isFinite(summary.gamma)?'Gamma '+summary.gamma.toFixed(2):'N/A'}`,
  `Ymax: ${nits(summary.max,3)}`,
  `Ymin: ${nits(summary.min,4)}`
 ].join('\n');
 const coverage=gamutCoverage(primaries);
 stats.textContent=[
  `Measurement points: ${profile.points.length}`,
  `Gamut coverage: ${Number.isFinite(coverage)?(coverage*100).toFixed(1)+'%':'N/A'}`,
  `Average ΔE: ${Number.isFinite(summary.mean)?summary.mean.toFixed(3):'N/A'}`,
  `Maximum ΔE: ${Number.isFinite(summary.maxDe)?summary.maxDe.toFixed(3):'N/A'}`
 ].join('\n');
}
function ensureAdditionalProfilePanels(){
 const column=document.querySelector('.profile-column'),template=column.querySelector('.profile-compare-panel[data-profile-id="2"]');
 for(let id=3;id<=4;id++)if(!column.querySelector(`.profile-compare-panel[data-profile-id="${id}"]`)){
  const panel=template.cloneNode(true);panel.dataset.profileId=String(id);panel.dataset.profileSlot=String(id);panel.classList.remove('profile-slot-two');panel.setAttribute('aria-label',`Profile comparison slot ${id}`);
  panel.querySelector('.profile-clear-button').dataset.profileSlot=String(id);panel.querySelector('.profile-menu-button').setAttribute('aria-label',`Profile ${id} options`);panel.hidden=true;column.append(panel);
 }
 for(let gap=2;gap<=3;gap++){
  const previous=column.querySelector(`.profile-compare-panel[data-profile-id="${gap}"]`),next=column.querySelector(`.profile-compare-panel[data-profile-id="${gap+1}"]`);
  if(!previous||!next)continue;
  let handle=document.getElementById(`profileRowResizer${gap}${gap+1}`);
  if(!handle){handle=document.createElement('button');handle.type='button';handle.id=`profileRowResizer${gap}${gap+1}`;handle.className='profile-row-resizer';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','horizontal');handle.setAttribute('aria-label',`Resize Profile panels ${gap} and ${gap+1}`);handle.title='Drag to adjust the Profile panel heights';previous.after(handle)}
 }
}
ensureAdditionalProfilePanels();
function updateExpandedProfileTracks(){
 if(profileLayoutRows===2)return;
 const tracks=[];
 for(let index=0;index<profileLayoutRows;index++){
  if(index)tracks.push('12px');
  tracks.push(`minmax(${PROFILE_PANEL_MIN_HEIGHT}px, ${profileRowWeights[index]}fr)`);
 }
 document.querySelector('.profile-column').style.gridTemplateRows=tracks.join(' ');
}
function bindExpandedProfileResizers(){
 for(let gap=1;gap<=3;gap++){
  const handle=document.getElementById(gap===1?'profileRowResizer':`profileRowResizer${gap}${gap+1}`);
  if(!handle||handle.dataset.expandedResizeBound)return;
  handle.dataset.expandedResizeBound='true';let start=null;
  const resizeTo=delta=>{
   if(!start)return;
   const minDelta=PROFILE_PANEL_MIN_HEIGHT-start.left,maxDelta=start.right-PROFILE_PANEL_MIN_HEIGHT,clampedDelta=Math.min(maxDelta,Math.max(minDelta,delta));
   const left=start.left+clampedDelta,right=start.right-clampedDelta;
   profileRowWeights[start.gap-1]=left;profileRowWeights[start.gap]=right;updateExpandedProfileTracks();
   handle.setAttribute('aria-valuenow',String(Math.round(left)));
  };
  handle.addEventListener('pointerdown',event=>{
   if(profileLayoutRows===2||handle.hidden||event.button!==0)return;
   event.preventDefault();
   for(let slot=1;slot<=profileLayoutRows;slot++)profileRowWeights[slot-1]=Math.max(PROFILE_PANEL_MIN_HEIGHT,profilePanelElementAtSlot(slot).getBoundingClientRect().height);
   const leftPanel=profilePanelElementAtSlot(gap),rightPanel=profilePanelElementAtSlot(gap+1);
   start={pointerId:event.pointerId,y:event.clientY,left:leftPanel.getBoundingClientRect().height,right:rightPanel.getBoundingClientRect().height,gap};
   handle.classList.add('dragging');handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{if(start&&event.pointerId===start.pointerId)resizeTo(event.clientY-start.y)});
  const finish=event=>{if(!start||event.pointerId!==start.pointerId)return;start=null;handle.classList.remove('dragging');if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId)};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  handle.addEventListener('keydown',event=>{
   if(profileLayoutRows===2||!['ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();
   const leftPanel=profilePanelElementAtSlot(gap),rightPanel=profilePanelElementAtSlot(gap+1);
   const left=leftPanel.getBoundingClientRect().height,right=rightPanel.getBoundingClientRect().height,delta=(event.key==='ArrowDown'?1:-1)*(event.shiftKey?40:10);
   const minDelta=PROFILE_PANEL_MIN_HEIGHT-left,maxDelta=right-PROFILE_PANEL_MIN_HEIGHT,clampedDelta=Math.min(maxDelta,Math.max(minDelta,delta));
   const nextLeft=left+clampedDelta,nextRight=right-clampedDelta;
   profileRowWeights[gap-1]=nextLeft;profileRowWeights[gap]=nextRight;updateExpandedProfileTracks();
  });
 }
}
bindExpandedProfileResizers();
function renderProfilePanels(){for(let slot=1;slot<=4;slot++)renderProfilePanel(slot)}
function previewProfileFromFiles(index){
 if(!Number.isInteger(index)||!profiles[index]||!isMeasuredProfile(profiles[index]))return;
 const slot=Array.from({length:profileLayoutRows},(_,i)=>i+1).find(slot=>profileIndexAtSlot(slot)<0)||profileLayoutRows;
 if(previewProfileIndex===index&&previewProfileSlot===slot)return;
 previewProfileIndex=index;previewProfileSlot=slot;renderProfilePanel(slot);
}
function clearFilesProfilePreview(){
 if(previewProfileSlot<0)return;
 const slot=previewProfileSlot;previewProfileIndex=-1;previewProfileSlot=-1;renderProfilePanel(slot);
}
function showProfileDetails(index){
 activeProfileIndex=index;
 renderTargetDetails();
}
function assignProfilePanel(slot,index){
 if(!Number.isInteger(index)||!profiles[index]||!isMeasuredProfile(profiles[index]))return;
 profilePanelIndices[profilePanelIdAtSlot(slot)-1]=index;renderProfilePanel(slot);
 const panel=profilePanelElementAtSlot(slot);
 if(panel)panel.setAttribute('aria-label',`Profile comparison slot ${slot}: ${profiles[index].name}`);
}
function addProfileToFirstEmptyPanel(index){
 const slot=Array.from({length:profileLayoutRows},(_,i)=>i+1).find(slot=>profileIndexAtSlot(slot)<0);
 if(!slot)return;
 clearFilesProfilePreview();assignProfilePanel(slot,index);
}
function bindProfilePanelDropTargets(){
 document.querySelectorAll('.profile-compare-panel').forEach(panel=>{
  const menuButton=panel.querySelector('.profile-menu-button');menuButton.draggable=!window.__viewerReadOnlyReport;
  menuButton.title=window.__viewerReadOnlyReport?'Profile options':'Click for options; drag to swap Profiles';
  menuButton.addEventListener('dragstart',event=>{
   if(window.__viewerReadOnlyReport){event.preventDefault();return}
   closeProfileMenus();draggingProfilePanelId=Number(panel.dataset.profileId);suppressProfileMenuClick=true;
   event.dataTransfer.setData(PROFILE_PANEL_DRAG_TYPE,String(draggingProfilePanelId));
   event.dataTransfer.effectAllowed='move';panel.classList.add('profile-drag-source');
  });
  menuButton.addEventListener('dragend',()=>{
   draggingProfilePanelId=null;
   document.querySelectorAll('.profile-drag-source,.profile-swap-target').forEach(item=>item.classList.remove('profile-drag-source','profile-swap-target'));
   setTimeout(()=>{suppressProfileMenuClick=false},0);
  });
  panel.addEventListener('mouseenter',()=>{const slot=Number(panel.dataset.profileSlot),index=previewProfileSlot===slot?previewProfileIndex:profileIndexAtSlot(slot);previewTargetMeasured(index,`profile-${slot}`);locateFile(index,`profile-${slot}`)});
  panel.addEventListener('mouseleave',()=>{const slot=Number(panel.dataset.profileSlot);clearTargetMeasuredPreview(`profile-${slot}`);clearLocatedFile(`profile-${slot}`)});
  const hasProfilePayload=event=>[...(event.dataTransfer?.types||[])].some(type=>type==='application/x-bcs-profile-index'||type==='application/x-bcs-profile-indices');
  panel.addEventListener('dragenter',event=>{
   if(window.__viewerReadOnlyReport&&hasProfilePayload(event)){event.preventDefault();event.stopPropagation();return}
   if(event.dataTransfer?.types.includes(PROFILE_PANEL_DRAG_TYPE)){if(draggingProfilePanelId!==Number(panel.dataset.profileId))panel.classList.add('profile-swap-target');return}
   if(hasProfilePayload(event)){event.preventDefault();panel.classList.add('drop-active')}
  });
  panel.addEventListener('dragover',event=>{
   if(window.__viewerReadOnlyReport&&hasProfilePayload(event)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='none';return}
   if(event.dataTransfer?.types.includes(PROFILE_PANEL_DRAG_TYPE)){
    if(draggingProfilePanelId!==null&&draggingProfilePanelId!==Number(panel.dataset.profileId)){event.preventDefault();event.dataTransfer.dropEffect='move';panel.classList.add('profile-swap-target')}
    return;
   }
   if(hasProfilePayload(event)){event.preventDefault();event.dataTransfer.dropEffect='copy';panel.classList.add('drop-active')}
  });
  panel.addEventListener('dragleave',event=>{if(!panel.contains(event.relatedTarget))panel.classList.remove('drop-active','profile-swap-target')});
  panel.addEventListener('drop',event=>{
   if(window.__viewerReadOnlyReport&&hasProfilePayload(event)){event.preventDefault();event.stopPropagation();return}
   if(event.dataTransfer?.types.includes(PROFILE_PANEL_DRAG_TYPE)){
    event.preventDefault();panel.classList.remove('profile-swap-target');
    if(draggingProfilePanelId!==null)swapProfilePanels(draggingProfilePanelId,Number(panel.dataset.profileId));
    return;
   }
   if(!hasProfilePayload(event))return;
   event.preventDefault();panel.classList.remove('drop-active');
   const index=Number(event.dataTransfer.getData('application/x-bcs-profile-index')||event.dataTransfer.getData('text/plain'));
   assignProfilePanel(Number(panel.dataset.profileSlot),index);
  });
 });
}


// Convert measured patches to values used by the four charts.
function eotfSeries(p, relativeEotf=true){
 const g=p.points.filter(q=>Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002).sort((a,z)=>a.r-z.r);
 const {min,max}=targetLuminanceRange(p),{x:xw,y:yw}=targetWhitePointForProfile(p)||TARGET_CONFIG.whitePoint;
  if(!isValidTargetLuminanceRange({min,max}))throw new Error('Invalid bcs target luma');
 const targetWhite=[max*xw/yw,max,max*(1-xw-yw)/yw],targetBlack=[min*xw/yw,min,min*(1-xw-yw)/yw];
 const black=g.find(q=>q.r<=1e-6)||{X:targetBlack[0],Y:targetBlack[1],Z:targetBlack[2]};
 const white=g.find(q=>q.r>=1-1e-6)||{X:targetWhite[0],Y:targetWhite[1],Z:targetWhite[2]};
 // Relative mode is normalized to the selected Target luminance range, not
 // each profile's own measured black/white. Otherwise custom Ymin/Ymax cancel
 // out and different bcs curves cannot be compared against the same target.
 const relativeRange=targetWhite.map((value,i)=>value-targetBlack[i]),relativeWhite=[white.X,white.Y,white.Z].map((value,i)=>(value-targetBlack[i])/relativeRange[i]),relativeEndpoint=(white.Y-min)/(max-min),relativeScale=relativeWhite.map(value=>Math.abs(value)>1e-12?relativeEndpoint/value:1);
 const values=g.map(q=>({q,R:relativeEotf?(q.X-targetBlack[0])/relativeRange[0]*relativeScale[0]:q.X/targetWhite[0],
  G:relativeEotf?(q.Y-targetBlack[1])/relativeRange[1]*relativeScale[1]:q.Y/targetWhite[1],
  B:relativeEotf?(q.Z-targetBlack[2])/relativeRange[2]*relativeScale[2]:q.Z/targetWhite[2]}));
 return {g,values,toLinear:x=>targetEncodedToLinear(x,min,max),targetY:x=>targetEotf(x,min,max,relativeEotf)};
}
function panelProfileCount(panel){return panel?[...panel.selectedProfiles].filter(index=>profileVisible(index)||panel.localShownProfiles.has(index)).length:profiles.filter((_,i)=>profileVisible(i)).length}
function multi_bcs_comparison_mode(panel){return panelProfileCount(panel)>1}
function multiple_visible_bcs(panel){return panelProfileCount(panel)>1}
function ciePrimaryPoints(profile){const eps=.002,valid=profile.points.filter(q=>q.X+q.Y+q.Z>1e-12),pick=(channel,others)=>valid.filter(q=>q[channel]>eps&&others.every(k=>q[k]<=eps)).sort((a,b)=>b[channel]-a[channel]||b.Y-a.Y)[0];return{R:pick('r',['g','b']),G:pick('g',['r','b']),B:pick('b',['r','g']),W:valid.filter(q=>Math.abs(q.r-q.g)<=eps&&Math.abs(q.g-q.b)<=eps).sort((a,b)=>b.r-a.r||b.Y-a.Y)[0]}}

function deltaEDistributionCounts(profile){
 const bins=Array(21).fill(0);
 profile.points.forEach(q=>{const de=cieMetrics(q,profile).de;if(Number.isFinite(de)&&de>=0)bins[Math.min(20,Math.floor(de/.5))]++});
 return bins;
}

function updateChartLegend(){
 const cieShape='CIE shape: □ red ΔE (≥2.3)　△ orange (1–2.3)　○ green (&lt;1); color = bcs';
 const cieColor='CIE: red ΔE (≥2.3)　orange (1–2.3)　green (&lt;1)';
 const mono=activeChartPanels().some(panel=>useProfileColors(panel));
 const eotfBalance=mono?'<span>● R</span><span>■ G</span><span>▲ B</span><span>Node shape = channel in EOTF and RGB Balance</span>':'EOTF / RGB Balance: red R, green G, blue B';
 $('chartLegend').innerHTML=`<span class="channel-key">${eotfBalance}<span class="cie-key">${mono?cieShape:activeChartPanels().some(panel=>panel.type==='cie'&&!panel.state.allPoints)?cieColor+' · Gamut only: '+cieShape:cieColor}</span></span>`;
}
function refresh(){
 renderTargetDetails();
 render();
 const list=$('profiles');list.replaceChildren();renderProfileTree(list);
 if(locatedFile){const {index,source,profile}=locatedFile;locatedFile=null;if(profiles[index]===profile)locateFile(index,source);else{list.classList.remove('file-locating');fileLocatorArrow.hidden=true}}
 bindFileListSelection(list);
 updateChartLegend();
 showProfileDetails(profiles.length?Math.min(activeProfileIndex,profiles.length-1):-1);
 renderProfilePanels();
}
function updateFileSelectionStyles(){
 $('profiles').querySelectorAll('.profile-item').forEach(item=>item.classList.toggle('file-selected',selectedFileIndices.has(Number(item.dataset.profileIndex))));
}
function addProfilesToAllCharts(indices){
 const unique=[...new Set(indices)].filter(index=>Number.isInteger(index)&&profiles[index]&&isMeasuredProfile(profiles[index]));
 if(!unique.length)return;
 activeChartPanels().filter(panel=>panel.type).forEach(panel=>{
  unique.forEach(index=>{panel.selectedProfiles.add(index);if(hiddenProfiles.has(index))panel.localShownProfiles.add(index);else panel.localShownProfiles.delete(index)});
  updateChartPanelControls(panel);renderChartPanel(panel);
 });
 hoveredProfileIndex=-1;updateChartLegend();updateProfileChartAssignments();
}
function addProfilesToChart(indices,panel){
 const unique=[...new Set(indices)].filter(index=>Number.isInteger(index)&&profiles[index]&&isMeasuredProfile(profiles[index]));
 if(!unique.length||!panel?.type)return;
 unique.forEach(index=>{panel.selectedProfiles.add(index);if(hiddenProfiles.has(index))panel.localShownProfiles.add(index);else panel.localShownProfiles.delete(index)});
 updateChartPanelControls(panel);renderChartPanel(panel);hoveredProfileIndex=-1;updateChartLegend();updateProfileChartAssignments();
}
function doubleClickFileProfile(index){
 if(window.__viewerReadOnlyReport)return;
 if(!isMeasuredProfile(profiles[index])){openTargetImport(profiles[index]);return}
 addProfileToFirstEmptyPanel(index);
 if(singleChartSlotIndex===null)addProfilesToAllCharts([index]);
 else addProfilesToChart([index],chartPanelAtSlot(singleChartSlotIndex));
}
function renderProfileTree(list){
 const roots={spaces:{folders:new Map(),files:[]},profiles:{folders:new Map(),files:[],builtIn:[]}};
 profiles.forEach((profile,index)=>{
  const kind=isMeasuredProfile(profile)?'profiles':'spaces';
  if(kind==='spaces'){roots.spaces.files.push({index,filename:profile.name});return}
  if(profile.builtIn){roots.profiles.builtIn.push({index,filename:profile.name});return}
  const parts=profile.flatSource?[]:(profile.sourcePath||profile.name).split('/').filter(Boolean),filename=profile.flatSource?profile.name:(parts.pop()||profile.name);let node=roots[kind];
  for(const part of parts){const path=node.path?node.path+'/'+part:part;if(!node.folders.has(part))node.folders.set(part,{name:part,path,folders:new Map(),files:[]});node=node.folders.get(part)}
  node.files.push({index,filename});
 });
 const append=(node,container,depth,kind)=>{
  for(const {index,filename} of node.files){
   const profile=profiles[index],item=document.createElement('div');
   item.className='profile profile-item'+(profileVisible(index)?'':' off')+(selectedFileIndices.has(index)?' file-selected':'');
   item.tabIndex=0;item.draggable=!window.__viewerReadOnlyReport;item.dataset.profileIndex=index;item.dataset.profileKind=kind;item.setAttribute('aria-label',profile.name+(window.__viewerReadOnlyReport?'':isMeasuredProfile(profile)?' profile; drag onto a chart or Target':' target-only bcs; drag onto Target'));item.style.paddingLeft=`${7+depth*16}px`;
   item.addEventListener('click',event=>selectFileRow(index,event));
   item.addEventListener('dblclick',event=>{event.preventDefault();doubleClickFileProfile(index)});
   item.addEventListener('dragstart',event=>{
    if(window.__viewerReadOnlyReport){event.preventDefault();return}
    if(!selectedFileIndices.has(index)){selectedFileIndices.clear();selectedFileIndices.add(index);selectionAnchor=index;updateFileSelectionStyles()}
    const indices=[...selectedFileIndices].sort((a,b)=>a-b);
    event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',String(index));event.dataTransfer.setData('application/x-bcs-profile-indices',JSON.stringify(indices));event.dataTransfer.setData('application/x-bcs-profile-index',String(index));item.classList.add('dragging')
   });
   item.addEventListener('dragend',()=>item.classList.remove('dragging'));
   const toggle=document.createElement(kind==='spaces'?'span':'button');
   toggle.className=kind==='spaces'?'dot profile-space-dot':'dot profile-toggle'+(profileVisible(index)?'':' off');toggle.style.setProperty('--profile-color',kind==='spaces'?'#999':profileColor(index));
   if(kind==='profiles'){
    toggle.type='button';toggle.setAttribute('aria-label',(profileVisible(index)?'Hide on all charts: ':'Show on all charts: ')+profile.name);toggle.setAttribute('aria-pressed',String(profileVisible(index)));toggle.title=(profileVisible(index)?'Hide on all charts':'Show on all charts')+' · '+profile.name;
    toggle.addEventListener('click',event=>{
     event.stopPropagation();
     const targets=selectedFileIndices.has(index)&&selectedFileIndices.size>1?[...selectedFileIndices]:[index];
     const hide=profileVisible(index);
     for(const targetIndex of targets){if(hide)hiddenProfiles.add(targetIndex);else hiddenProfiles.delete(targetIndex);activeChartPanels().forEach(panel=>{panel.localShownProfiles.delete(targetIndex);updateChartPanelControls(panel)})}
     refresh();
    });
   }
   const name=document.createElement('span');name.textContent=filename;
   const assigned=activeChartPanels().filter(panel=>panel.selectedProfiles.has(index)).length;item.classList.toggle('in-chart',assigned>0);
   item.title=(profile.flatSource?profile.name:profile.sourcePath)+(kind==='spaces'?' · Drag onto Target to apply colour space settings':assigned?` · Displayed in ${assigned} chart${assigned===1?'':'s'}`:' · Drag onto a chart to display');item.append(toggle,name);
   item.addEventListener('mouseenter',()=>{setHoveredProfile(index);previewProfileFromFiles(index)});item.addEventListener('focusin',()=>showProfileDetails(index));container.append(item);
  }
  for(const folder of [...node.folders.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}))){
   const group=document.createElement('div');group.className='profile-folder';
   const heading=document.createElement('button');heading.type='button';heading.className='profile-folder-heading';heading.draggable=!window.__viewerReadOnlyReport;heading.textContent='▾ '+folder.name;heading.style.paddingLeft=`${7+depth*16}px`;
   heading.addEventListener('dragstart',event=>{
    if(window.__viewerReadOnlyReport){event.preventDefault();return}
    const prefix=folder.path+'/';
    const indices=profiles.map((profile,index)=>profile.sourcePath.startsWith(prefix)&&(isMeasuredProfile(profile)?'profiles':'spaces')===kind?index:-1).filter(index=>index>=0);
    if(!indices.length){event.preventDefault();return}
    event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('text/plain',String(indices[0]));event.dataTransfer.setData('application/x-bcs-profile-indices',JSON.stringify(indices));event.dataTransfer.setData('application/x-bcs-profile-index',String(indices[0]));
   });
   const collapseKey=kind+'|'+folder.path;
   const children=document.createElement('div');children.className='profile-folder-children';children.hidden=collapsedProfileFolders.has(collapseKey);
   heading.textContent=(children.hidden?'▸ ':'▾ ')+folder.name;
   heading.onclick=event=>{if(event.detail>1)return;const expand=children.hidden;children.hidden=!expand;if(expand)collapsedProfileFolders.delete(collapseKey);else collapsedProfileFolders.add(collapseKey);heading.textContent=(expand?'▾ ':'▸ ')+folder.name;updateLocatedFileMarker()};
   group.append(heading,children);container.append(group);append(folder,children,depth+1,kind);
  }
 };
 for(const [kind,title] of [['spaces','Color Spaces'],['profiles','Profiles']]){
  const root=roots[kind];
  const section=document.createElement('section');section.className='profile-category';
  const key=kind,body=document.createElement('div');body.className='profile-category-content';body.hidden=collapsedProfileCategories.has(key);
  const heading=document.createElement('button');heading.type='button';heading.className='profile-category-heading';heading.setAttribute('aria-expanded',String(!body.hidden));heading.textContent=(body.hidden?'▸ ':'▾ ')+title;
  heading.addEventListener('click',()=>{body.hidden=!body.hidden;heading.setAttribute('aria-expanded',String(!body.hidden));heading.textContent=(body.hidden?'▸ ':'▾ ')+title;if(body.hidden)collapsedProfileCategories.add(key);else collapsedProfileCategories.delete(key);updateLocatedFileMarker()});
  section.append(heading,body);list.append(section);
  if(kind==='spaces'){
   const builtInHeading=document.createElement('div');builtInHeading.className='profile-subcategory-heading';builtInHeading.textContent='Built-in';body.append(builtInHeading);
  }
  if(kind==='profiles'&&root.builtIn.length){
   const builtInHeading=document.createElement('div');builtInHeading.className='profile-subcategory-heading';builtInHeading.textContent='Built-in';body.append(builtInHeading);
   append({files:root.builtIn,folders:new Map()},body,0,kind);
  }
  if(kind==='spaces')for(const preset of targetPresets){
   const item=document.createElement('div');item.className='target-preset-item';item.tabIndex=0;item.draggable=true;item.textContent=preset.label;
   item.title='Built-in color space · Drag onto Target or double-click to apply';item.setAttribute('aria-label',`${preset.label} built-in color space; drag onto Target or double-click to apply`);
   item.addEventListener('dragstart',event=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-bcs-target-preset',preset.label);item.classList.add('dragging')});
   item.addEventListener('dragend',()=>item.classList.remove('dragging'));
   item.addEventListener('dblclick',event=>{event.preventDefault();applyTargetPreset(preset)});
   body.append(item);
  }
  if((kind==='spaces'||kind==='profiles')&&(root.files.length||root.folders.size)){
   const importedHeading=document.createElement('div');importedHeading.className='profile-subcategory-heading';importedHeading.textContent='Imported';body.append(importedHeading);
  }
  append(root,body,0,kind);
 }
}
function selectFileRow(index,event){
 const additive=event.metaKey||event.ctrlKey;
 if(event.shiftKey){
  const ordered=[...$('profiles').querySelectorAll('.profile-item')].filter(item=>item.getClientRects().length).map(item=>Number(item.dataset.profileIndex));
  const clicked=ordered.indexOf(index),anchored=ordered.indexOf(selectionAnchor),anchorPosition=anchored>=0?anchored:clicked;
  if(clicked<0)return;
  const start=Math.min(anchorPosition,clicked),end=Math.max(anchorPosition,clicked);
  if(!additive)selectedFileIndices.clear();
  for(const visibleIndex of ordered.slice(start,end+1))selectedFileIndices.add(visibleIndex);
 }else if(additive){
  if(selectedFileIndices.has(index))selectedFileIndices.delete(index);else selectedFileIndices.add(index);
  selectionAnchor=index;
 }else{selectedFileIndices.clear();selectedFileIndices.add(index);selectionAnchor=index}
 updateFileSelectionStyles();
}
function bindFileListSelection(list){
 let marquee=null,box=null;
 list.onpointerdown=event=>{
  if(event.button!==0||event.target.closest('.profile-item,.profile-folder-heading,.profile-category-heading,.target-preset-item'))return;
  marquee={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,additive:event.metaKey||event.ctrlKey,moved:false};
  box=document.createElement('div');box.className='file-selection-marquee';document.body.append(box);
  list.setPointerCapture(event.pointerId);event.preventDefault();
 };
 list.onpointermove=event=>{
  if(!marquee||event.pointerId!==marquee.pointerId)return;
  const left=Math.min(marquee.startX,event.clientX),top=Math.min(marquee.startY,event.clientY),width=Math.abs(event.clientX-marquee.startX),height=Math.abs(event.clientY-marquee.startY);
  marquee.moved=marquee.moved||width+height>4;
  Object.assign(box.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
 };
 const finish=event=>{
  if(!marquee||event.pointerId!==marquee.pointerId)return;
  if(marquee.moved){
   if(!marquee.additive)selectedFileIndices.clear();
   const area={left:Math.min(marquee.startX,event.clientX),right:Math.max(marquee.startX,event.clientX),top:Math.min(marquee.startY,event.clientY),bottom:Math.max(marquee.startY,event.clientY)};
   list.querySelectorAll('.profile-item').forEach(item=>{const r=item.getBoundingClientRect();if(r.right>=area.left&&r.left<=area.right&&r.bottom>=area.top&&r.top<=area.bottom)selectedFileIndices.add(Number(item.dataset.profileIndex))});
   selectionAnchor=selectedFileIndices.size?[...selectedFileIndices].sort((a,b)=>a-b)[0]:-1;
  }else if(!marquee.additive){selectedFileIndices.clear();selectionAnchor=-1}
  box?.remove();box=null;marquee=null;updateFileSelectionStyles();
 };
 list.onpointerup=finish;list.onpointercancel=finish;
}
function removeSelectedProfiles(){
 if(window.__viewerReadOnlyReport)return false;
 const removed=new Set([...selectedFileIndices].filter(index=>Number.isInteger(index)&&index>=0&&index<profiles.length&&!profiles[index].builtIn));
 if(!removed.size)return false;
 const previousActive=activeProfileIndex,oldToNew=new Map(),remaining=[];
 profiles.forEach((profile,index)=>{if(!removed.has(index)){oldToNew.set(index,remaining.length);remaining.push(profile)}});
 const remap=set=>new Set([...set].map(index=>oldToNew.get(index)).filter(Number.isInteger));
 profiles=remaining;
 for(let slot=0;slot<profilePanelIndices.length;slot++)profilePanelIndices[slot]=oldToNew.get(profilePanelIndices[slot])??-1;
 const visibleHidden=remap(hiddenProfiles);hiddenProfiles.clear();visibleHidden.forEach(index=>hiddenProfiles.add(index));
 chartPanels.forEach(panel=>{panel.selectedProfiles=remap(panel.selectedProfiles);panel.localShownProfiles=remap(panel.localShownProfiles);updateChartPanelControls(panel)});
 selectedFileIndices.clear();selectionAnchor=-1;hoveredProfileIndex=-1;
 activeProfileIndex=oldToNew.get(previousActive)??Math.min(previousActive,Math.max(0,profiles.length-1));
 hideChartHover();refresh();return true;
}
window.addEventListener('keydown',event=>{
 if(event.key!=='Delete'&&event.key!=='Backspace')return;
 const target=event.target;
 if(target instanceof HTMLElement&&(target.isContentEditable||target.matches('input,textarea,select,[role="textbox"]')))return;
 if(!removeSelectedProfiles())return;
 event.preventDefault();event.stopImmediatePropagation();
},true);
 $('profiles').addEventListener('mouseleave',()=>{setHoveredProfile(-1);clearFilesProfilePreview()});
 $('profiles').addEventListener('mousemove',event=>{const item=event.target.closest('.profile-item'),index=item?Number(item.dataset.profileIndex):-1;setHoveredProfile(index);if(index>=0)previewProfileFromFiles(index)});
function droppedEntryFile(entry){return new Promise((resolve,reject)=>entry.file(resolve,reject))}
function droppedDirectoryEntries(directory){
 const reader=directory.createReader();
 return new Promise((resolve,reject)=>{
  const entries=[];const read=()=>reader.readEntries(batch=>{if(!batch.length){resolve(entries);return}entries.push(...batch);read()},reject);read();
 });
}
async function collectDroppedEntry(entry,parentPath=''){
 if(entry.isFile){
  if(!/\.(bcs|xml)$/i.test(entry.name))return [];
  const file=await droppedEntryFile(entry),sourcePath=parentPath?parentPath+'/'+entry.name:entry.name;
  return [{file,sourcePath}];
 }
 if(!entry.isDirectory)return [];
 const folderPath=parentPath?parentPath+'/'+entry.name:entry.name,children=await droppedDirectoryEntries(entry),rows=[];
 for(const child of children)rows.push(...await collectDroppedEntry(child,folderPath));
 return rows;
}
async function collectDroppedFilesOrFolders(entries){
 const rows=[];for(const entry of entries)rows.push(...await collectDroppedEntry(entry));return rows;
}
async function collectDroppedHandle(handle,parentPath=''){
 if(handle.kind==='file'){
  if(!/\.(bcs|xml)$/i.test(handle.name))return [];
  return [{file:await handle.getFile(),sourcePath:parentPath?parentPath+'/'+handle.name:handle.name}];
 }
 if(handle.kind!=='directory')return [];
 const folderPath=parentPath?parentPath+'/'+handle.name:handle.name,children=[];
 for await(const child of handle.values())children.push(child);
 children.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
 const rows=[];for(const child of children)rows.push(...await collectDroppedHandle(child,folderPath));return rows;
}
const filesPanel=$('filesPanel');
function isLocalFileDrag(event){
 const transfer=event.dataTransfer;
 return [...(transfer?.types||[])].some(type=>type==='Files'||type==='application/x-moz-file')||[...(transfer?.items||[])].some(item=>item.kind==='file')||Boolean(transfer?.files?.length);
}
if(window.__viewerReadOnlyReport){
 for(const type of ['dragenter','dragover','drop'])document.addEventListener(type,event=>{
  if(!isLocalFileDrag(event))return;
  event.preventDefault();event.stopImmediatePropagation();
 },true);
}
filesPanel.addEventListener('dragenter',event=>{
 if(!isLocalFileDrag(event))return;
 event.preventDefault();filesPanel.classList.add('files-drop-active');
});
filesPanel.addEventListener('dragover',event=>{
 if(!isLocalFileDrag(event))return;
 event.preventDefault();event.dataTransfer.dropEffect='copy';filesPanel.classList.add('files-drop-active');
});
filesPanel.addEventListener('dragleave',event=>{
 if(filesPanel.contains(event.relatedTarget))return;
 filesPanel.classList.remove('files-drop-active');
});
filesPanel.addEventListener('drop',async event=>{
 if(!isLocalFileDrag(event))return;
 event.preventDefault();filesPanel.classList.remove('files-drop-active');$('filesStatus').hidden=true;
 const items=[...(event.dataTransfer.items||[])];
 // Snapshot File objects before awaiting: Chrome clears the drop data store afterwards.
 const droppedFiles=[...(event.dataTransfer.files||[])];
 const entries=items.map(item=>item.kind==='file'?(item.webkitGetAsEntry?.()||item.getAsEntry?.()):null).filter(Boolean);
 const handleReads=items.map(item=>{if(item.kind!=='file'||typeof item.getAsFileSystemHandle!=='function')return null;try{return item.getAsFileSystemHandle()}catch{return null}});
 let rows=[];
 try{
  const settled=await Promise.allSettled(handleReads.filter(Boolean));
  const handles=settled.filter(result=>result.status==='fulfilled'&&result.value).map(result=>result.value);
  const directories=handles.filter(handle=>handle.kind==='directory');
  if(directories.length)rows=(await Promise.all(directories.map(handle=>collectDroppedHandle(handle)))).flat();
  else if(entries.some(entry=>entry.isDirectory))rows=(await Promise.all(entries.filter(entry=>entry.isDirectory).map(entry=>collectDroppedEntry(entry)))).flat();
  else if(entries.some(entry=>entry.isFile))rows=await collectDroppedFilesOrFolders(entries.filter(entry=>entry.isFile));
  else if(handles.length)rows=(await Promise.all(handles.map(handle=>collectDroppedHandle(handle)))).flat();
  else rows=droppedFiles.filter(file=>/\.(bcs|xml)$/i.test(file.name)).map(file=>({file,sourcePath:file.webkitRelativePath||file.name}));
 }catch(error){
  const fallback=droppedFiles.filter(file=>/\.(bcs|xml)$/i.test(file.name)).map(file=>({file,sourcePath:file.webkitRelativePath||file.name}));
  if(fallback.length)rows=fallback;else{console.error('Unable to read dropped local files.',error);$('filesStatus').textContent='Cannot read dropped files or folder.';$('filesStatus').hidden=false;return}
 }
 if(rows.length)try{await appendProfileFiles(rows)}catch(error){$('filesStatus').textContent='Cannot parse dropped bcs files.';$('filesStatus').hidden=false;console.error('Unable to parse dropped bcs files.',error)}
 else{$('filesStatus').textContent='No bcs files in this folder.';$('filesStatus').hidden=false}
});
function commitTargetLuminance(kind,mode,value){
 selectTargetLuminance(kind,mode,value);$(`target${kind==='ymax'?'Ymax':'Ymin'}Value`).setCustomValidity('');refresh();return true;
}
for(const kind of ['ymax','ymin']){
 const id=kind==='ymax'?'Ymax':'Ymin';
 $(`target${id}Value`).addEventListener('input',event=>event.target.setCustomValidity(''));
 $(`target${id}Mode`).onclick=()=>{
  const current=TARGET_CONFIG.luminance[kind],mode=current.mode==='measured'?'custom':'measured';
  const profile=profiles[activeProfileIndex];
  const measured=profile?targetLuminanceRange(profile,{ymax:{mode:'measured'},ymin:{mode:'measured'}}):{min:0,max:100};
  const value=current.value??(mode==='custom'?(kind==='ymax'?measured.max:measured.min):null);
  commitTargetLuminance(kind,mode,value);
 };
 $(`target${id}Value`).onchange=event=>{
  const raw=event.target.value.trim(),value=raw===''?NaN:Number(raw);
  if(!Number.isFinite(value)||value<0||(kind==='ymax'&&value===0)){
   event.target.setCustomValidity('Enter valid luminance (nits).');return;
  }
  commitTargetLuminance(kind,'custom',value);
 };
}
$('targetGamut').onchange=event=>{
 selectTargetGamut(event.target.value);
 hideChartHover();
 refresh();
};
$('targetWhitePoint').onchange=event=>{
 selectTargetWhitePoint(event.target.value);
 hideChartHover();
 refresh();
};
$('targetEotf').onchange=event=>{
 selectTargetEotf(event.target.value);
 $('targetGammaValue').setCustomValidity('');
 hideChartHover();
 refresh();
};
$('targetGammaValue').onchange=event=>{
 const gamma=Number(event.target.value);
 try{selectCustomTargetGamma(gamma);event.target.setCustomValidity('');refresh()}
 catch(error){event.target.setCustomValidity(error.message)}
};
$('targetGammaValue').addEventListener('input',event=>event.target.setCustomValidity(''));
function profileReference(profile){return{sourcePath:profile.sourcePath||'',name:profile.name||'',fileSize:Number.isFinite(profile.fileSize)?profile.fileSize:null,fileLastModified:Number.isFinite(profile.fileLastModified)?profile.fileLastModified:null}}
function findProfileReference(reference){
 if(!reference)return-1;
 let index=reference.sourcePath?profiles.findIndex(profile=>profile.sourcePath===reference.sourcePath):-1;
 if(index<0)index=profiles.findIndex(profile=>profile.name===reference.name&&(reference.fileSize===null||profile.fileSize===reference.fileSize)&&(reference.fileLastModified===null||profile.fileLastModified===reference.fileLastModified));
 return index;
}
function applySettingsProfileLinks(links){
 if(!links)return false;
 hiddenProfiles.clear();for(const reference of links.hidden||[]){const index=findProfileReference(reference);if(index>=0)hiddenProfiles.add(index)}
 profilePanelIndices.fill(-1);for(let slot=1;slot<=4;slot++){const index=findProfileReference(links.profileSlots?.[slot-1]);if(index>=0)profilePanelIndices[profilePanelIdAtSlot(slot)-1]=index}
 chartPanels.forEach((panel,index)=>{
  panel.selectedProfiles.clear();panel.localShownProfiles.clear();
  for(const reference of links.charts?.[index]?.selected||[]){const profileIndex=findProfileReference(reference);if(profileIndex>=0)panel.selectedProfiles.add(profileIndex)}
  for(const reference of links.charts?.[index]?.localShown||[]){const profileIndex=findProfileReference(reference);if(profileIndex>=0)panel.localShownProfiles.add(profileIndex)}
  updateChartPanelControls(panel);
 });
 collapsedProfileFolders.clear();for(const folder of links.collapsedFolders||[])collapsedProfileFolders.add(folder);
 return true;
}
function settingsLinksResolved(links){
 const references=[...(links?.hidden||[]),...(links?.profileSlots||[]).filter(Boolean),...(links?.charts||[]).flatMap(chart=>[...(chart?.selected||[]),...(chart?.localShown||[])])];
 return references.every(reference=>findProfileReference(reference)>=0);
}
async function loadProfileFiles(entries){if(window.__viewerReadOnlyReport)return;const rows=Array.from(entries||[]).map(entry=>entry?.file?entry:{file:entry,sourcePath:entry.webkitRelativePath||entry.name});const builtIns=profiles.filter(profile=>profile.builtIn);profiles=[...builtIns,...(await Promise.all(rows.map(row=>parse(row.file,row.sourcePath)))).filter(isSupportedProfile)];profilePanelIndices.fill(-1);collapsedProfileFolders.clear();hiddenProfiles.clear();selectedFileIndices.clear();selectionAnchor=-1;hoveredProfileIndex=-1;activeProfileIndex=0;$('filesStatus').hidden=true;resetChartsForProfiles();if(pendingSettingsProfileLinks){applySettingsProfileLinks(pendingSettingsProfileLinks);if(settingsLinksResolved(pendingSettingsProfileLinks))pendingSettingsProfileLinks=null}refresh()}
async function appendProfileFiles(entries){
 if(window.__viewerReadOnlyReport)return;
 const rows=Array.from(entries||[]).map(entry=>entry?.file?entry:{file:entry,sourcePath:entry.webkitRelativePath||entry.name});
 const additions=(await Promise.all(rows.map(row=>parse(row.file,row.sourcePath)))).filter(isSupportedProfile);
 const startedEmpty=!profiles.some(profile=>!profile.builtIn);
 const pathKey=path=>String(path||'').normalize('NFC').replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/{2,}/g,'/');
 const seenPaths=new Set(profiles.map(profile=>pathKey(profile.sourcePath||profile.name)));
 let skippedDuplicates=0;
 for(const addition of additions){
  const key=pathKey(addition.sourcePath||addition.name);
  if(seenPaths.has(key)){skippedDuplicates++;continue}
  seenPaths.add(key);profiles.push(addition);
 }
 if(startedEmpty&&profiles.length)resetChartsForProfiles();
 if(pendingSettingsProfileLinks){applySettingsProfileLinks(pendingSettingsProfileLinks);if(settingsLinksResolved(pendingSettingsProfileLinks))pendingSettingsProfileLinks=null}
 const status=$('filesStatus');status.textContent=skippedDuplicates?`Skipped ${skippedDuplicates} file${skippedDuplicates===1?'':'s'} already loaded from the same path.`:'';status.hidden=!skippedDuplicates;refresh();
}
function clearLoadedProfiles(){
 if(window.__viewerReadOnlyReport)return;
 $('filesStatus').hidden=true;profiles=profiles.filter(profile=>profile.builtIn);profilePanelIndices.fill(-1);previewProfileIndex=-1;previewProfileSlot=-1;collapsedProfileFolders.clear();hiddenProfiles.clear();selectedFileIndices.clear();selectionAnchor=-1;hoveredProfileIndex=-1;activeProfileIndex=0;
 if(chartHover){chartHover.pinnedData=null;chartHover.hoverData=null;clearPinnedChartRing();hideChartHover()}
 resetChartsForProfiles();refresh();
}
function clearAllChartProfiles(){
 if(window.__viewerReadOnlyReport)return;
 hideChartHover();
 for(const panel of activeChartPanels()){panel.selectedProfiles.clear();panel.localShownProfiles.clear();updateChartPanelControls(panel);renderChartPanel(panel)}
 updateChartLegend();updateProfileChartAssignments();
}
function updateChartLayoutCount(){
 const columns=Number($('chartLayoutColumns').value);
 const rows=Number($('chartLayoutRows').value);
 const count=columns*rows;
 $('chartLayoutCount').textContent=`${columns} across × ${rows} down · ${count} ${count===1?'chart':'charts'}`;
 const affected=activeChartPanels().filter(panel=>!chartSlotIsActive(panel.slotIndex,columns,rows)&&panel.selectedProfiles.size>0);
 const warning=$('chartLayoutWarning');
 if(affected.length){
  warning.textContent=`${affected.length} ${affected.length===1?'chart':'charts'} will be removed and reset.`;
  warning.hidden=false;
 }else{warning.textContent='';warning.hidden=true}
 for(const cell of $('chartLayoutPicker').children){
  const cellColumn=Number(cell.dataset.columns),cellRow=Number(cell.dataset.rows);
  cell.classList.toggle('selected',cellColumn<=columns&&cellRow<=rows);
  const panel=chartPanelAtSlot((cellRow-1)*4+cellColumn-1);
  cell.classList.toggle('will-clear',chartSlotIsActive(panel.slotIndex)&&!chartSlotIsActive(panel.slotIndex,columns,rows)&&panel.selectedProfiles.size>0);
  cell.setAttribute('aria-pressed',String(cellColumn===Number($('chartLayoutColumns').value)&&cellRow===Number($('chartLayoutRows').value)));
 }
}
function previewChartLayout(column,row){
 for(const cell of $('chartLayoutPicker').children){
  const cellColumn=Number(cell.dataset.columns),cellRow=Number(cell.dataset.rows);
  cell.classList.toggle('preview',cellColumn<=column&&cellRow<=row);
  cell.classList.toggle('preview-corner',cellColumn===column&&cellRow===row);
 }
}
function clearChartLayoutPreview(){
 for(const cell of $('chartLayoutPicker').children)cell.classList.remove('preview','preview-corner');
}
for(let row=1;row<=4;row++)for(let column=1;column<=4;column++){
 const cell=document.createElement('button');
 cell.type='button';cell.className='chart-layout-cell';
 cell.dataset.columns=String(column);cell.dataset.rows=String(row);
 cell.setAttribute('aria-label',`${column} across, ${row} down, ${column*row} charts`);
 cell.addEventListener('mouseenter',()=>previewChartLayout(column,row));
 cell.addEventListener('click',()=>{
  $('chartLayoutColumns').value=String(column);$('chartLayoutRows').value=String(row);
  updateChartLayoutCount();
 });
 $('chartLayoutPicker').append(cell);
}
$('chartLayoutPicker').addEventListener('mouseleave',clearChartLayoutPreview);
function openChartLayoutDialog(){
 if(window.__viewerReadOnlyReport)return;
 $('chartLayoutColumns').value=String(chartColumnCount);$('chartLayoutRows').value=String(chartRowCount);
 clearChartLayoutPreview();updateChartLayoutCount();$('chartLayoutDialog').showModal();
}
function profileSlotIsActive(slot,columns,rows){return slot>=0&&slot<columns*rows}
function updateProfileLayoutDialog(){
 const columns=Number($('profileLayoutColumns').value),rows=Number($('profileLayoutRows').value),count=columns*rows;
 $('profileLayoutCount').textContent=`${columns} across × ${rows} down · ${count} Profile ${count===1?'panel':'panels'}`;
 const removed=Array.from({length:4},(_,slot)=>slot).filter(slot=>profileSlotIsActive(slot,1,profileLayoutRows)&&!profileSlotIsActive(slot,columns,rows)&&profileIndexAtSlot(slot+1)>=0).length;
 const warning=$('profileLayoutWarning');
 if(removed){warning.textContent=`${removed} Profile ${removed===1?'panel':'panels'} will be removed and cleared.`;warning.hidden=false}
 else{warning.textContent='';warning.hidden=true}
 for(const cell of $('profileLayoutPicker').children){
  const cellColumn=Number(cell.dataset.columns),cellRow=Number(cell.dataset.rows),slot=cellRow-1;
  cell.classList.toggle('selected',cellColumn<=columns&&cellRow<=rows);
  cell.classList.toggle('will-clear',profileSlotIsActive(slot,1,profileLayoutRows)&&!profileSlotIsActive(slot,columns,rows)&&profileIndexAtSlot(slot+1)>=0);
  cell.setAttribute('aria-pressed',String(cellColumn===columns&&cellRow===rows));
 }
}
function previewProfileLayout(columns,rows){
 for(const cell of $('profileLayoutPicker').children){
  const cellColumn=Number(cell.dataset.columns),cellRow=Number(cell.dataset.rows);
  cell.classList.toggle('preview',cellColumn<=columns&&cellRow<=rows);
  cell.classList.toggle('preview-corner',cellColumn===columns&&cellRow===rows);
 }
}
function clearProfileLayoutPreview(){for(const cell of $('profileLayoutPicker').children)cell.classList.remove('preview','preview-corner')}
for(let row=1;row<=4;row++){
 const cell=document.createElement('button');cell.type='button';cell.className='chart-layout-cell';cell.dataset.columns='1';cell.dataset.rows=String(row);
 cell.setAttribute('aria-label',`1 across, ${row} down, ${row} Profile ${row===1?'panel':'panels'}`);
 cell.addEventListener('mouseenter',()=>previewProfileLayout(1,row));
 cell.addEventListener('click',()=>{$('profileLayoutColumns').value='1';$('profileLayoutRows').value=String(row);updateProfileLayoutDialog()});
 $('profileLayoutPicker').append(cell);
}
$('profileLayoutPicker').addEventListener('mouseleave',clearProfileLayoutPreview);
function openProfileLayoutDialog(){
 if(window.__viewerReadOnlyReport)return;
 $('profileLayoutColumns').value='1';$('profileLayoutRows').value=String(profileLayoutRows);clearProfileLayoutPreview();updateProfileLayoutDialog();$('profileLayoutDialog').showModal();
}
$('applyProfileLayout').addEventListener('click',()=>{
 if(window.__viewerReadOnlyReport)return;
 const columns=Number($('profileLayoutColumns').value),rows=Number($('profileLayoutRows').value);
 clearFilesProfilePreview();
 if(columns*rows<profileLayoutRows){for(let slot=columns*rows+1;slot<=profileLayoutRows;slot++){profilePanelIndices[profilePanelIdAtSlot(slot)-1]=-1;renderProfilePanel(slot);clearTargetMeasuredPreview(`profile-${slot}`);clearLocatedFile(`profile-${slot}`)}}
 setProfileLayout(columns*rows);renderProfilePanels();$('profileLayoutDialog').close();
});
$('profileLayoutDialog').addEventListener('click',event=>{
 const dialog=$('profileLayoutDialog');if(event.target!==dialog)return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close('cancel');
});
$('applyChartLayout').addEventListener('click',()=>{
 if(window.__viewerReadOnlyReport)return;
 const columns=Number($('chartLayoutColumns').value),rows=Number($('chartLayoutRows').value);
 setChartLayout(columns,rows);
 $('chartLayoutDialog').close();
});
$('chartLayoutDialog').addEventListener('click',event=>{
 const dialog=$('chartLayoutDialog');
 if(event.target!==dialog)return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close('cancel');
});
function clearAllProfileInformation(){
 if(window.__viewerReadOnlyReport)return;
 if(previewProfileSlot>=0)clearFilesProfilePreview();
 profilePanelIndices.fill(-1);renderProfilePanels();
 document.querySelectorAll('.profile-compare-panel').forEach(panel=>panel.setAttribute('aria-label',`Profile comparison slot ${panel.dataset.profileSlot}`));
}
function clearAssignedProfile(slot){
 if(window.__viewerReadOnlyReport)return;
 if(previewProfileSlot===slot)clearFilesProfilePreview();
 profilePanelIndices[profilePanelIdAtSlot(slot)-1]=-1;renderProfilePanel(slot);
 const panel=profilePanelElementAtSlot(slot);
 if(panel)panel.setAttribute('aria-label',`Profile comparison slot ${slot}`);
}
function resetTargetSettings(){
 if(window.__viewerReadOnlyReport)return;
 selectTargetSettings({gamutId:'srgbRec709',whitePointId:'d65',eotfId:'gamma22'});
 selectTargetLuminance('ymax','measured');selectTargetLuminance('ymin','measured');
 for(const id of ['targetYmaxValue','targetYminValue','targetGammaValue'])$(id).setCustomValidity('');
 targetMeasuredPreview=null;
 hideChartHover();refresh();
}
function resetReportTargetSettings(){
 const target=window.__reportTargetSettings;if(!target)return;
 selectTargetSettings({gamutId:target.gamutId,whitePointId:target.whitePointId,eotfId:target.eotfId});
 if(target.gamutId==='custom')selectCustomTargetPrimaries(target.primaries);
 if(target.whitePointId==='custom')selectCustomTargetWhitePoint(target.whitePoint.x,target.whitePoint.y);
 if(target.eotfId==='custom')selectCustomTargetGamma(target.eotf.gamma);
 for(const kind of ['ymax','ymin'])selectTargetLuminance(kind,target.luminance[kind].mode,target.luminance[kind].value);
 targetMeasuredPreview=null;hideChartHover();refresh();
}
function clearPatchDetails(){if(chartHover){chartHover.pinnedData=null;chartHover.hoverData=null;clearPinnedChartRing();hideChartHover()}}
const clearContextMenu=document.createElement('div');clearContextMenu.className='workspace-clear-menu';clearContextMenu.hidden=true;clearContextMenu.setAttribute('role','menu');document.body.append(clearContextMenu);
let contextMenuHighlights=[];
function hideClearContextMenu(){clearContextMenu.hidden=true;clearContextMenu.replaceChildren();contextMenuHighlights.forEach(element=>element.classList.remove('context-menu-scope-highlight'));contextMenuHighlights=[]}
function showActionContextMenu(event,items,scopeLabel='',highlightElement=null){
 event.preventDefault();clearContextMenu.replaceChildren();
 contextMenuHighlights.forEach(element=>element.classList.remove('context-menu-scope-highlight'));
 contextMenuHighlights=Array.isArray(highlightElement)?highlightElement.filter(Boolean):highlightElement?[highlightElement]:[];
 contextMenuHighlights.forEach(element=>element.classList.add('context-menu-scope-highlight'));
 if(scopeLabel){const heading=document.createElement('div');heading.className='workspace-clear-menu-heading';heading.textContent=scopeLabel;heading.setAttribute('role','presentation');clearContextMenu.append(heading)}
 for(const item of items){
  const button=document.createElement('button');button.type='button';button.textContent=item.label;button.setAttribute('role','menuitem');button.disabled=Boolean(item.disabled);
  button.addEventListener('click',actionEvent=>{hideClearContextMenu();if(!item.disabled)item.action(actionEvent)});clearContextMenu.append(button);
 }
 clearContextMenu.hidden=false;
 const left=Math.max(4,Math.min(event.clientX,innerWidth-clearContextMenu.offsetWidth-8));
 const top=Math.max(4,Math.min(event.clientY,innerHeight-clearContextMenu.offsetHeight-8));
 clearContextMenu.style.left=`${left}px`;clearContextMenu.style.top=`${top}px`;
}
function showClearContextMenu(event,action,label,highlightElement=null){showActionContextMenu(event,[{label,action}], '',highlightElement)}
const rightDetailLayout=document.querySelector('.right-layout');
const detailDashboard=document.querySelector('.dashboard-layout');
const targetDetailPanel=document.querySelector('.target-summary');
const targetMenu=$('targetMenu'),targetMenuButton=targetDetailPanel.querySelector('[data-panel-menu]');
function closeTargetMenu(){targetMenu.hidden=true;targetMenuButton.setAttribute('aria-expanded','false')}
const patchDetailPanel=document.querySelector('.detail-panel .patch-panel');
const noteDetailPanel=document.querySelector('.detail-panel .note-panel');
const detailViewButton=$('detailViewButton');
const detailViewMenu=$('detailViewMenu');
let detailView='patch';
function closeDetailViewMenu(){detailViewMenu.hidden=true;detailViewButton.setAttribute('aria-expanded','false')}
function setTargetPanelCollapsed(collapsed){
 const panel=targetDetailPanel;
 panel.dataset.collapsed=String(collapsed);
 $('toggleTargetMenuItem').textContent=collapsed?'Expand':'Collapse';
 const height=collapsed?'60px':'var(--locked-summary-height)';
 rightDetailLayout.style.setProperty('--target-panel-height',height);
 detailDashboard.style.setProperty('--minimum-target-height',height);
}
function setDetailView(view){
 detailView=window.__viewerReadOnlyReport?'note':view==='patch'?'patch':'note';
 detailViewButton.hidden=Boolean(window.__viewerReadOnlyReport);
 $('clearNoteMenuItem').hidden=Boolean(window.__viewerReadOnlyReport);
 $('detailPanelTitle').textContent=detailView==='patch'?'Patch':'Note';
 detailViewMenu.querySelectorAll('[data-detail-view]').forEach(item=>item.setAttribute('aria-checked',String(item.dataset.detailView===detailView)));
 patchDetailPanel.hidden=detailView!=='patch';
 noteDetailPanel.hidden=detailView!=='note';
 setPinnedChartPatchHover(detailView==='patch'&&patchDetailPanel.matches(':hover'));
 if(detailView==='patch')noteEditor.hideToolbar();
}
targetMenuButton.addEventListener('click',()=>{
 const opening=targetMenu.hidden;closeTargetMenu();closeDetailViewMenu();if(opening){targetMenu.hidden=false;targetMenuButton.setAttribute('aria-expanded','true');targetMenu.querySelector('button').focus()}
});
$('resetTargetMenuItem').addEventListener('click',()=>{closeTargetMenu();if(window.__viewerReadOnlyReport)resetReportTargetSettings();else resetTargetSettings()});
$('toggleTargetMenuItem').addEventListener('click',()=>{closeTargetMenu();setTargetPanelCollapsed(targetDetailPanel.dataset.collapsed!=='true')});
targetMenu.addEventListener('keydown',event=>{
 const items=[...targetMenu.querySelectorAll('button')],index=items.indexOf(document.activeElement);
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus()}
 if(event.key==='Escape'){event.preventDefault();closeTargetMenu();targetMenuButton.focus()}
});
for(const eventName of ['pointerdown','focusin','contextmenu'])document.addEventListener(eventName,event=>{if(!event.target.closest('.target-menu-wrap'))closeTargetMenu()},true);
document.addEventListener('click',event=>{if(!event.target.closest('.target-menu-wrap'))closeTargetMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTargetMenu()});
setTargetPanelCollapsed(targetDetailPanel.dataset.collapsed==='true');
setDetailView('patch');
detailViewButton.addEventListener('click',()=>{
 const opening=detailViewMenu.hidden;closeDetailViewMenu();closeTargetMenu();
 if(opening){detailViewMenu.hidden=false;detailViewButton.setAttribute('aria-expanded','true');detailViewMenu.querySelector('[aria-checked="true"]').focus()}
});
detailViewMenu.querySelectorAll('[data-detail-view]').forEach(item=>item.addEventListener('click',()=>{setDetailView(item.dataset.detailView);closeDetailViewMenu();detailViewButton.focus()}));
$('clearNoteMenuItem').addEventListener('click',()=>{closeDetailViewMenu();if(!window.__viewerReadOnlyReport)noteEditor.clear();detailViewButton.focus()});
detailViewMenu.addEventListener('keydown',event=>{
 const items=[...detailViewMenu.querySelectorAll('button')],index=items.indexOf(document.activeElement);
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus()}
 if(event.key==='Escape'){event.preventDefault();closeDetailViewMenu();detailViewButton.focus()}
});
for(const eventName of ['pointerdown','focusin','contextmenu'])document.addEventListener(eventName,event=>{if(!event.target.closest('.detail-menu-wrap'))closeDetailViewMenu()},true);
document.addEventListener('click',event=>{if(!event.target.closest('.detail-menu-wrap'))closeDetailViewMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDetailViewMenu()});
document.addEventListener('click',event=>{if(!event.target.closest('.workspace-clear-menu'))hideClearContextMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideClearContextMenu()});
const settingsButton=$('settingsButton'),settingsMenu=$('settingsMenu');
const aboutButton=$('aboutButton'),aboutDialog=$('aboutDialog');
const headerMeta=$('headerMeta'),headerMetaForm=$('headerMetaForm'),headerDate=$('headerDate'),headerAuthor=$('headerAuthor');
const today=new Date(),localDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
let reportDate=localDate,reportAuthor='WhARTS Ltd.';
function renderHeaderMeta(){headerMeta.textContent=[reportDate,reportAuthor].filter(Boolean).join(' · ')||'Add date / author';headerMeta.classList.toggle('header-meta-empty',!reportDate&&!reportAuthor)}
function closeHeaderMetaEditor(){headerMetaForm.hidden=true;headerMeta.hidden=false}
headerMeta.addEventListener('dblclick',()=>{if(window.__viewerReadOnlyReport)return;headerDate.value=reportDate;headerAuthor.value=reportAuthor;headerMeta.hidden=true;headerMetaForm.hidden=false;headerDate.focus()});
headerMetaForm.addEventListener('submit',event=>{event.preventDefault();reportDate=headerDate.value;reportAuthor=headerAuthor.value.trim();renderHeaderMeta();closeHeaderMetaEditor()});
$('headerMetaCancel').addEventListener('click',closeHeaderMetaEditor);
headerMetaForm.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeHeaderMetaEditor()}});
function cancelHeaderMetaEditOutside(event){if(!headerMetaForm.hidden&&!event.target.closest('#headerMetaForm'))closeHeaderMetaEditor()}
document.addEventListener('pointerdown',cancelHeaderMetaEditOutside,true);
document.addEventListener('focusin',cancelHeaderMetaEditOutside,true);
document.addEventListener('contextmenu',cancelHeaderMetaEditOutside,true);
renderHeaderMeta();
function currentWorkspaceSettings(includeBcsAssignments=false){
 const dashboard=document.querySelector('.dashboard-layout'),profileColumn=document.querySelector('.profile-column'),css=getComputedStyle(dashboard),profileCss=getComputedStyle(profileColumn);
 const readSize=(style,key)=>Number.parseFloat(style.getPropertyValue(key))||0;
 const ref=index=>index>=0&&profiles[index]?profileReference(profiles[index]):null;
 const charts=chartPanels.map(panel=>{
  const chart={chartId:panel.id,type:panel.type,colorMode:panel.colorMode,states:Object.fromEntries([...panel.states].map(([type,state])=>[type,{...state,view:{...state.view}}]))};
  if(includeBcsAssignments){chart.selected=[...panel.selectedProfiles].map(ref);chart.localShown=[...panel.localShownProfiles].map(ref)}
  return chart;
 });
 const settings={
  format:'colourspace-profile-viewer-settings',version:1,
  header:{date:reportDate,author:reportAuthor},
  noteHtml:noteEditor.getHtml(),
  collapsedPanels:{target:targetDetailPanel.dataset.collapsed==='true'},detailView,
  layout:{columns:chartColumnCount,rows:chartRowCount,singleChartSlotIndex,chartIdsBySlot:[...chartIdsBySlot],profileRows:profileLayoutRows,profilePanelIdsBySlot:[...profilePanelIdsBySlot],filesWidth:readSize(css,'--files-width'),profileWidth:readSize(css,'--locked-profile-width'),profileTopHeight:readSize(profileCss,'--locked-profile-top-height')},
  target:{gamutId:TARGET_CONFIG.gamutId,primaries:TARGET_CONFIG.gamut.primaries,whitePointId:TARGET_CONFIG.whitePointId,whitePoint:{x:TARGET_CONFIG.whitePoint.x,y:TARGET_CONFIG.whitePoint.y},eotfId:TARGET_CONFIG.eotfId,eotf:{...TARGET_CONFIG.eotf},luminance:TARGET_CONFIG.luminance},
  charts
 };
 if(includeBcsAssignments){settings.profileSlots=[1,2,3,4].map(slot=>ref(profileIndexAtSlot(slot)));settings.collapsedFolders=[...collapsedProfileFolders];settings.hiddenProfiles=[...hiddenProfiles].map(ref)}
 return settings;
}
function currentLayoutSettings(){
 const {format,version,collapsedPanels,detailView,layout,charts}=currentWorkspaceSettings();
 return{format,version,collapsedPanels,detailView,layout,charts};
}
async function saveExportFile(blob,suggestedName,description,extension){
 if(typeof window.showSaveFilePicker==='function'){
  try{
   const handle=await window.showSaveFilePicker({suggestedName,types:[{description,accept:{[blob.type]:[extension]}}]});
   const writable=await handle.createWritable();await writable.write(blob);await writable.close();return true;
  }catch(error){if(error.name==='AbortError')return false;throw error}
 }
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=suggestedName;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
}
function exportFileName(suffix,extension){
 const part=value=>String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'');
 const prefix=[part(reportDate),part(reportAuthor)].filter(Boolean).join('-');
 return`${prefix?prefix+'-':''}${suffix}.${extension}`;
}
function downloadSettingsFile(data){return saveExportFile(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),exportFileName('settings','json'),'Viewer settings','.json')}
function applyImportedSettings(settings,restoreContent=false){
 if(settings?.format!=='colourspace-profile-viewer-settings'||settings.version!==1)throw new Error('This is not a supported settings file.');
 const layout=settings.layout,target=settings.target;
 if(!layout||!Number.isInteger(layout.columns)||!Number.isInteger(layout.rows)||layout.columns<1||layout.columns>4||layout.rows<1||layout.rows>4||layout.columns*layout.rows>16)throw new Error('The saved layout is invalid.');
 if(layout.profileRows!==undefined&&(!Number.isInteger(layout.profileRows)||layout.profileRows<1||layout.profileRows>4))throw new Error('The saved Profile layout is invalid.');
 if(restoreContent&&!target)throw new Error('The report Target settings are missing.');
 if(!Array.isArray(settings.charts)||settings.charts.length!==16)throw new Error('The chart settings are incomplete.');
 setTargetPanelCollapsed(settings.collapsedPanels?.target===true);
 setDetailView(settings.detailView==='patch'?'patch':'note');
 if(restoreContent){
  if(typeof settings.noteHtml==='string')noteEditor.setHtml(settings.noteHtml);
  else noteEditor.setPlainText(settings.note);
  if(settings.header){if(typeof settings.header.date==='string')reportDate=settings.header.date.trim();if(typeof settings.header.author==='string')reportAuthor=settings.header.author.trim();renderHeaderMeta();closeHeaderMetaEditor()}
  selectTargetSettings({gamutId:target.gamutId,whitePointId:target.whitePointId,eotfId:target.eotfId});
  if(target.gamutId==='custom')selectCustomTargetPrimaries(target.primaries);
  if(target.whitePointId==='custom')selectCustomTargetWhitePoint(target.whitePoint.x,target.whitePoint.y);
  if(target.eotfId==='custom')selectCustomTargetGamma(target.eotf.gamma);
  for(const kind of ['ymax','ymin'])selectTargetLuminance(kind,target.luminance[kind].mode,target.luminance[kind].value);
 }
 const existingAssignments=restoreContent?null:chartPanels.map(panel=>({selected:new Set(panel.selectedProfiles),localShown:new Set(panel.localShownProfiles)}));
 setProfileSlotAssignments(layout.profilePanelIdsBySlot||[1,2]);setProfileLayout(Number.isInteger(layout.profileRows)?layout.profileRows:2);
 setChartSlotAssignments(layout.chartIdsBySlot||Array.from({length:16},(_,index)=>index+1));
 setChartLayout(layout.columns,layout.rows);
 if(existingAssignments)chartPanels.forEach((panel,index)=>{
  panel.selectedProfiles=existingAssignments[index].selected;
  panel.localShownProfiles=existingAssignments[index].localShown;
 });
 for(let index=0;index<chartPanels.length;index++){
  const panel=chartPanels[index],saved=settings.charts[index];
  if(saved.chartId!==undefined&&saved.chartId!==panel.id)throw new Error(`Invalid chart ID in panel ${index+1}.`);
  if(saved.type!==null&&!chartDefinitions.some(definition=>definition.id===saved.type))throw new Error(`Invalid chart type in panel ${index+1}.`);
  panel.colorMode=['channels','profiles'].includes(saved.colorMode)?saved.colorMode:'channels';
  panel.states=new Map();
  for(const [type,state] of Object.entries(saved.states||{}))if(chartDefinitions.some(definition=>definition.id===type)){
   const normalized={...createChartState(type),...(state&&typeof state==='object'?state:{})},view=state?.view;
   if(type==='graph3d'){
    const defaults=createChartState(type).camera,camera=state?.camera||{};
    normalized.coordinateMode=state?.coordinateMode==='uvY'?'uvY':'xyY';
    normalized.camera={yaw:Number.isFinite(camera.yaw)?camera.yaw:defaults.yaw,pitch:Number.isFinite(camera.pitch)?Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch)):defaults.pitch,panX:Number.isFinite(camera.panX)?camera.panX:defaults.panX,panY:Number.isFinite(camera.panY)?camera.panY:defaults.panY,zoom:Number.isFinite(camera.zoom)?Math.max(.7,Math.min(100,camera.zoom)):defaults.zoom};
   }
   normalized.view=view&&['xmin','xmax','ymin','ymax'].every(key=>Number.isFinite(view[key]))&&view.xmax>view.xmin&&view.ymax>view.ymin?{...view}:initialChartView(type,normalized);
   panel.states.set(type,normalized);
  }
  panel.type=saved.type;if(panel.type&&!panel.states.has(panel.type))panel.states.set(panel.type,createChartState(panel.type));panel.state=panel.type?panel.states.get(panel.type):null;
  updateChartPanelControls(panel);renderChartPanel(panel);
 }
 singleChartSlotIndex=chartSlotIsActive(layout.singleChartSlotIndex)?layout.singleChartSlotIndex:null;
 $('chartSlots').classList.toggle('single-chart',singleChartSlotIndex!==null);applyChartPanelVisibility();
 window.applySavedWorkspaceSizes?.({filesWidth:layout.filesWidth,profileWidth:layout.profileWidth,profileTopHeight:layout.profileTopHeight});
 const includesBcsAssignments=Array.isArray(settings.profileSlots)||Array.isArray(settings.hiddenProfiles)||Array.isArray(settings.collapsedFolders)||settings.charts.some(chart=>Array.isArray(chart.selected)||Array.isArray(chart.localShown));
 if(restoreContent&&includesBcsAssignments){
  const links={profileSlots:settings.profileSlots||[],hidden:settings.hiddenProfiles||[],charts:settings.charts,collapsedFolders:settings.collapsedFolders||[]};
  applySettingsProfileLinks(links);pendingSettingsProfileLinks=settingsLinksResolved(links)?null:links;
 }
 hideChartHover();refresh();updateChartLegend();updateProfileChartAssignments();
}
function assertExportableTarget(indices){
 if(document.querySelector('.target-summary input:invalid'))throw new Error('Target contains invalid input. Correct Target before exporting.');
 const checked=indices.length?indices:[-1];
 for(const index of checked){
  const profile=index<0?{points:[]}:profiles[index];
  if(!targetConfigurationIsValid(profile))throw new Error('Target incomplete or invalid. Correct Target before exporting.');
 }
}
function assertExportableProfile(index){
 const profile=profiles[index];
 if(!profile||typeof profile.rawText!=='string')throw new Error('Reload the used bcs files before exporting.');
 const xml=new DOMParser().parseFromString(profile.rawText,'application/xml');
 if(xml.querySelector('parsererror'))throw new Error(`Invalid bcs XML: ${profile.name}`);
 const patches=[...xml.querySelectorAll('patch')];
 const head=xml.querySelector('builder_color_space > head'),x=head?.querySelector('x'),y=head?.querySelector('y');
 const gammaText=head?.querySelector('gamma')?.textContent?.trim();
 if(gammaText!==undefined&&(!gammaText||!Number.isFinite(Number(gammaText))||Number(gammaText)<=0))throw new Error(`Invalid bcs gamma: ${profile.name}`);
 for(const channel of ['red','green','blue','white']){
  const xv=x?.getAttribute(channel),yv=y?.getAttribute(channel);
  if(xv==null&&yv==null)continue;
  if(!xv||!yv||!Number.isFinite(Number(xv))||!Number.isFinite(Number(yv))||Number(xv)<=0||Number(yv)<=0||Number(xv)+Number(yv)>1)throw new Error(`Invalid bcs chromaticity: ${profile.name}`);
 }
 if(!isSupportedProfile(profile)||patches.length!==profile.points.length||patches.some(patch=>['red','green','blue','X','Y','Z'].some(key=>{
  const value=patch.querySelector(key)?.textContent?.trim();return !value||!Number.isFinite(Number(value));
 })))throw new Error(`Invalid bcs data: ${profile.name}`);
}
async function exportSettings(){try{return await downloadSettingsFile(currentLayoutSettings())}catch(error){alert(`Could not save settings: ${error.message}`);return false}}
async function importSettings(file){
 if(window.__viewerReadOnlyReport)return;
 try{applyImportedSettings(JSON.parse(await file.text()))}
 catch(error){alert(`Could not import settings: ${error.message}`)}
}
function makeCompleteReport(){
 const used=new Set(profilePanelIndices.filter(index=>index>=0&&profiles[index]&&profileVisible(index)));
 for(const panel of activeChartPanels())for(const index of panel.selectedProfiles)if(index>=0&&index<profiles.length&&profileVisible(index))used.add(index);
 assertExportableTarget([...used].filter(index=>isMeasuredProfile(profiles[index])));
 for(const index of used)assertExportableProfile(index);
 const settings=currentWorkspaceSettings(true),indices=[...used].sort((a,b)=>a-b),flatPathByIndex=new Map(),usedNames=new Set();
 for(const index of indices){
  const name=profiles[index].name;let candidate=name,sequence=2;
  while(usedNames.has(candidate.normalize('NFC').toLocaleLowerCase())){
   const extensionIndex=name.lastIndexOf('.'),stem=extensionIndex>0?name.slice(0,extensionIndex):name,extension=extensionIndex>0?name.slice(extensionIndex):'';
   candidate=`${stem} (${sequence++})${extension}`;
  }
  usedNames.add(candidate.normalize('NFC').toLocaleLowerCase());flatPathByIndex.set(index,candidate);
 }
 const flatReferences=new Map(indices.map(index=>[JSON.stringify(profileReference(profiles[index])),{...profileReference(profiles[index]),sourcePath:flatPathByIndex.get(index)}]));
 const remapReferences=references=>references.map(reference=>flatReferences.get(JSON.stringify(reference))).filter(Boolean);
 settings.collapsedFolders=[];
 settings.profileSlots=settings.profileSlots.map(reference=>reference?flatReferences.get(JSON.stringify(reference))||null:null);
 settings.hiddenProfiles=remapReferences(settings.hiddenProfiles);
 for(const chart of settings.charts){
  chart.selected=remapReferences(chart.selected);
  chart.localShown=remapReferences(chart.localShown);
 }
 return{format:'colourspace-profile-viewer-report',version:1,createdAt:new Date().toISOString(),settings,profiles:indices.map(index=>{const profile=profiles[index];return{sourceIndex:index,name:profile.name,sourcePath:flatPathByIndex.get(index),flatSource:true,fileSize:profile.fileSize,fileLastModified:profile.fileLastModified,displayColor:profileColor(index),text:profile.rawText}})};
}
function makeShareableReportHtml(report){
 const preview={index:previewProfileIndex,slot:previewProfileSlot};
 previewProfileIndex=-1;previewProfileSlot=-1;renderProfilePanels();
 let clone;
 try{
  const doc=document;clone=document.documentElement.cloneNode(true);
  clone.querySelector('.target-summary')?.setAttribute('data-collapsed','false');
  const appMode=clone.querySelector('#appMode');if(appMode)appMode.textContent='Report';
  clone.querySelector('body').classList.add('report-readonly');
  clone.querySelector('#noteText')?.setAttribute('contenteditable','false');
  const headerEditor=clone.querySelector('#headerMetaForm');if(headerEditor)headerEditor.hidden=true;
  const headerLabel=clone.querySelector('#headerMeta');if(headerLabel)headerLabel.hidden=false;
  if(headerLabel&&!report.settings.header?.date&&!report.settings.header?.author)headerLabel.textContent='';
  const live=[...document.documentElement.querySelectorAll('*')],copies=[...clone.querySelectorAll('*')];
  for(let index=0;index<live.length;index++){
   const source=live[index],copy=copies[index];
   if(!copy)continue;
   if(source instanceof HTMLInputElement){copy.setAttribute('value',source.value);if(source.checked)copy.setAttribute('checked','');else copy.removeAttribute('checked')}
   else if(source instanceof HTMLTextAreaElement)copy.textContent=source.value;
   else if(source instanceof HTMLSelectElement){[...source.options].forEach((option,optionIndex)=>{if(source.options[optionIndex].selected)copy.options[optionIndex].setAttribute('selected','');else copy.options[optionIndex].removeAttribute('selected')})}
  }
  const used=new Set(report.profiles.map(profile=>profile.sourceIndex));
  clone.querySelectorAll('.profile-item').forEach(item=>{if(!used.has(Number(item.dataset.profileIndex)))item.remove()});
  clone.querySelectorAll('.profile-folder').forEach(folder=>{if(!folder.querySelector('.profile-item'))folder.remove()});
  clone.querySelectorAll('.profile-compare-panel').forEach(panel=>{
   const slot=Number(panel.dataset.profileSlot);
   if(report.settings.profileSlots[slot-1])return;
   panel.classList.remove('has-profile');panel.setAttribute('aria-label',`Profile comparison slot ${slot}`);
   for(const selector of ['.profile-assignment-filename','.profile-gamut','.profile-stats']){const field=panel.querySelector(selector);if(field)field.textContent=''}
  });
  clone.querySelectorAll('.patch-grid [id^="patch"]').forEach(field=>field.textContent='');
  const patchDot=clone.querySelector('#patchNameDot');if(patchDot)patchDot.hidden=true;
  const detailTitle=clone.querySelector('#detailPanelTitle');if(detailTitle)detailTitle.textContent='Note';
  const detailButton=clone.querySelector('#detailViewButton');if(detailButton)detailButton.hidden=true;
  const patchView=clone.querySelector('.detail-panel .patch-panel');if(patchView)patchView.hidden=true;
  const noteView=clone.querySelector('.detail-panel .note-panel');if(noteView)noteView.hidden=false;
  const noteToolbar=clone.querySelector('#noteToolbar');if(noteToolbar)noteToolbar.hidden=true;
  const legend=clone.querySelector('#chartLegend');if(legend)legend.replaceChildren();
  for(const kind of ['ymax','ymin'])if(report.settings.target.luminance[kind].mode==='measured'){
   const input=clone.querySelector(`#target${kind==='ymax'?'Ymax':'Ymin'}Value`);if(input){input.value='';input.removeAttribute('value')}
  }
  const runtimeNode=document.getElementById('viewer-report-runtime');
  if(!runtimeNode)throw new Error('The interactive report runtime is missing. Rebuild the viewer before exporting.');
  const runtime=JSON.parse(runtimeNode.textContent);
  clone.querySelectorAll('script,link[rel="stylesheet"]').forEach(element=>element.remove());
  const head=clone.querySelector('head'),meta=head.querySelector('meta[charset]')||doc.createElement('meta');meta.charset='utf-8';head.prepend(meta);
  const viewport=head.querySelector('meta[name="viewport"]')||doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';head.append(viewport);
  const runtimeData=doc.createElement('script');runtimeData.id='viewer-report-runtime';runtimeData.type='application/json';runtimeData.textContent=JSON.stringify(runtime).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');head.append(runtimeData);
  const embedded=doc.createElement('script');embedded.id='viewer-report-data';embedded.type='application/json';
  embedded.textContent=JSON.stringify(report).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');head.append(embedded);
  const boot=doc.createElement('script');
  boot.textContent=`(()=>{window.__viewerReadOnlyReport=true;const runtime=JSON.parse(document.getElementById('viewer-report-runtime').textContent),report=JSON.parse(document.getElementById('viewer-report-data').textContent),style=document.createElement('style');window.__reportTargetSettings=report.settings.target;style.textContent=runtime.css;const inlineStyle=document.head.querySelector('style');if(inlineStyle)inlineStyle.before(style);else document.head.append(style);for(const asset of runtime.scripts){const script=document.createElement('script');script.textContent=asset.code;document.body.append(script)}for(const code of runtime.inlineScripts){const script=document.createElement('script');script.textContent=code;document.body.append(script)}window.__restoreViewerReport(report);requestAnimationFrame(()=>requestAnimationFrame(()=>window.applySavedWorkspaceSizes?.(report.settings.layout)))})();`;
  clone.querySelector('body').append(boot);
  const title=clone.querySelector('title');if(title)title.textContent='ColourSpace Profile Viewer report';
  return'<!doctype html>\n'+clone.outerHTML;
 }finally{previewProfileIndex=preview.index;previewProfileSlot=preview.slot;renderProfilePanels()}
}
async function exportReport(kind){
 try{
  const report=makeCompleteReport();
  if(kind==='html'){
   const htmlReport={...report,settings:{...report.settings,collapsedPanels:{...report.settings.collapsedPanels,target:false}}};
   return await saveExportFile(new Blob([makeShareableReportHtml(htmlReport)],{type:'text/html'}),exportFileName('report','html'),'Shareable HTML report','.html');
  }
  return await saveExportFile(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),exportFileName('data','json'),'Complete viewer data','.json');
 }catch(error){alert(`Could not export report: ${error.message}`);return false}
}
async function parseReportFile(file){
 const text=await file.text();
 if(/\.html?$/i.test(file.name)){const doc=new DOMParser().parseFromString(text,'text/html'),data=doc.querySelector('#viewer-report-data');if(!data)throw new Error('This HTML file does not contain an importable report.');return JSON.parse(data.textContent)}
 return JSON.parse(text);
}
async function importReport(file){
 if(window.__viewerReadOnlyReport)return;
 try{
  restoreCompleteReport(await parseReportFile(file));
 }catch(error){alert(`Could not import report: ${error.message}`)}
}
function restoreCompleteReport(report){
 if(report?.format!=='colourspace-profile-viewer-report'||report.version!==1||!Array.isArray(report.profiles)||!report.settings)throw new Error('This is not a supported complete report.');
 const restored=report.profiles.map(source=>{
   if(typeof source.text!=='string'||typeof source.name!=='string')throw new Error('The report contains an invalid bcs entry.');
   const profile=parseBcsText(source.text,source.name,source.sourcePath||source.name,Number(source.fileSize)||source.text.length,Number(source.fileLastModified)||0);
   if(!isSupportedProfile(profile))throw new Error(`The embedded bcs file “${source.name}” contains no readable profile data.`);
   profile.flatSource=source.flatSource===true;
   if(/^#[0-9a-f]{6}$/i.test(source.displayColor||''))profile.displayColor=source.displayColor;
   return profile;
 });
 profiles=restored;profilePanelIndices.fill(-1);previewProfileIndex=-1;previewProfileSlot=-1;hiddenProfiles.clear();collapsedProfileFolders.clear();selectedFileIndices.clear();selectionAnchor=-1;hoveredProfileIndex=-1;activeProfileIndex=0;pendingSettingsProfileLinks=null;$('filesStatus').hidden=true;resetChartsForProfiles();
 applyImportedSettings(report.settings,true);refresh();
}
window.__restoreViewerReport=restoreCompleteReport;
const settingsFileInput=$('settingsFileInput');
const reportFileInput=$('reportFileInput'),importDialog=$('importDialog'),exportDialog=$('exportDialog');
function closeSettingsMenu(){settingsMenu.hidden=true;settingsButton.setAttribute('aria-expanded','false')}
aboutButton.addEventListener('click',()=>{closeSettingsMenu();aboutDialog.showModal()});
aboutDialog.addEventListener('click',event=>{if(event.target===aboutDialog)aboutDialog.close()});
function clearWorkspaceContent(){
 if(window.__viewerReadOnlyReport)return;
 closeSettingsMenu();hideChartHover();clearPatchDetails();clearFilesProfilePreview();
 targetMeasuredPreview=null;updateTargetMeasuredFields();pendingSettingsProfileLinks=null;
 previewProfileIndex=-1;previewProfileSlot=-1;profilePanelIndices.fill(-1);hoveredProfileIndex=-1;
 if(locatedFile)clearLocatedFile(locatedFile.source);
 noteEditor.clear();
 for(const panel of chartPanels){
  panel.selectedProfiles.clear();panel.localShownProfiles.clear();panel.points=[];
  panel.lastRenderedProfiles=new Set();panel.lastRenderedWithProfiles=false;
  updateChartPanelControls(panel);
 }
 resetTargetSettings();updateProfileChartAssignments();
 if(!targetConfigurationIsValid())for(const panel of activeChartPanels()){
  const canvas=panel.canvas,ctx=canvas.getContext('2d');
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#111111';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
 }
}
function resetWorkspaceLayout(){
 if(window.__viewerReadOnlyReport)return;
 closeSettingsMenu();hideChartHover();clearFilesProfilePreview();
 setProfileSlotAssignments([1,2,3,4]);setProfileLayout(2);
 setChartLayout(2,2);
 for(const panel of chartPanels){
  const row=Math.floor(panel.slotIndex/4),column=panel.slotIndex%4,type=row<2&&column<2?chartDefinitions[row*2+column].id:null;
  panel.type=type;panel.state=type?createChartState(type):null;panel.states=type?new Map([[type,panel.state]]):new Map();panel.colorMode='channels';
  if(!chartSlotIsActive(panel.slotIndex)){panel.selectedProfiles.clear();panel.localShownProfiles.clear()}
  panel.points=[];
  updateChartPanelControls(panel);
 }
 setTargetPanelCollapsed(false);setDetailView('patch');
 window.resetWorkspaceSizes?.();resetTargetSettings();
}
$('resetAllButton').addEventListener('click',resetWorkspaceLayout);
$('clearWorkspaceButton').addEventListener('click',clearWorkspaceContent);
$('importReportButton').addEventListener('click',()=>{closeSettingsMenu();importDialog.showModal()});
$('exportReportButton').addEventListener('click',()=>{
 closeSettingsMenu();
 for(const input of exportDialog.querySelectorAll('input[type="checkbox"]'))input.checked=false;
 $('exportSelectedButton').disabled=true;
 exportDialog.showModal();
});
$('importSettingsChoice').addEventListener('click',()=>{importDialog.close();settingsFileInput.click()});
$('importCompleteDataChoice').addEventListener('click',()=>{importDialog.close();reportFileInput.click()});
const exportChoices=[...exportDialog.querySelectorAll('input[type="checkbox"]')];
exportChoices.forEach(input=>input.addEventListener('change',()=>{$('exportSelectedButton').disabled=!exportChoices.some(choice=>choice.checked)}));
$('exportSelectedButton').addEventListener('click',async()=>{
 const selected=exportChoices.filter(input=>input.checked).map(input=>input.id);
 exportDialog.close();
 for(const choice of selected){
  let completed=true;
  if(choice==='exportSettingsChoice')completed=await exportSettings();
  else if(choice==='exportCompleteDataChoice')completed=await exportReport('json');
  else if(choice==='exportExternalReportChoice')completed=await exportReport('html');
  if(completed===false)break;
 }
});
settingsFileInput.addEventListener('change',()=>{const file=settingsFileInput.files?.[0];if(file)importSettings(file);settingsFileInput.value=''});
reportFileInput.addEventListener('change',()=>{const file=reportFileInput.files?.[0];if(file)importReport(file);reportFileInput.value=''});
settingsButton.addEventListener('click',event=>{
 event.stopPropagation();const opening=settingsMenu.hidden;settingsMenu.hidden=!opening;settingsButton.setAttribute('aria-expanded',String(opening));
});
document.addEventListener('click',event=>{
 if(event.target.closest('.settings-float'))return;
 settingsMenu.hidden=true;settingsButton.setAttribute('aria-expanded','false');
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 settingsMenu.hidden=true;settingsButton.setAttribute('aria-expanded','false');
});
function closeProfileMenus(){document.querySelectorAll('.profile-menu').forEach(menu=>{menu.hidden=true;menu.previousElementSibling?.setAttribute('aria-expanded','false')})}
document.querySelectorAll('.profile-menu-button').forEach(button=>button.addEventListener('click',event=>{
 if(suppressProfileMenuClick)return;
 event.stopPropagation();const menu=button.nextElementSibling,opening=menu.hidden;closeProfileMenus();
 if(opening){menu.hidden=false;button.setAttribute('aria-expanded','true')}
}));
document.querySelectorAll('.profile-clear-button').forEach(button=>button.addEventListener('click',()=>{
 clearAssignedProfile(Number(button.dataset.profileSlot));closeProfileMenus();
}));
document.addEventListener('click',event=>{if(!event.target.closest('.profile-menu-wrap'))closeProfileMenus()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeProfileMenus()});
const filesMenuButton=$('filesMenuButton'),filesMenu=$('filesMenu');
filesMenuButton.addEventListener('click',event=>{
 event.stopPropagation();
 if(window.__viewerReadOnlyReport)return;
 const opening=filesMenu.hidden;filesMenu.hidden=!opening;filesMenuButton.setAttribute('aria-expanded',String(opening));
});
$('unloadFilesMenuItem').addEventListener('click',()=>{filesMenu.hidden=true;filesMenuButton.setAttribute('aria-expanded','false');clearLoadedProfiles()});
document.addEventListener('click',event=>{
 if(event.target.closest('.files-header .chart-menu-wrap'))return;
 filesMenu.hidden=true;filesMenuButton.setAttribute('aria-expanded','false');
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 filesMenu.hidden=true;filesMenuButton.setAttribute('aria-expanded','false');
});
if(window.__viewerReadOnlyReport)filesMenuButton.hidden=true;
const profileColorPicker=$('profileColorPicker'),profileColorInput=$('profileColorInput');
let profileColorTargets=[];
let profileColorDraft='#56b4e9';
function closeProfileColorPicker(){profileColorPicker.hidden=true;profileColorTargets=[]}
function openProfileColorPicker(indices,preferredIndex,x,y){
 profileColorTargets=indices.filter(index=>profiles[index]&&isMeasuredProfile(profiles[index]));
 if(!profileColorTargets.length)return;
 const sourceIndex=profileColorTargets.includes(preferredIndex)?preferredIndex:profileColorTargets[0];
 profileColorDraft=profileColor(sourceIndex);profileColorInput.value=profileColorDraft;
 profileColorPicker.hidden=false;
 profileColorPicker.style.left='0px';profileColorPicker.style.top='0px';
 const pickerWidth=profileColorPicker.offsetWidth,pickerHeight=profileColorPicker.offsetHeight;
 const left=Math.max(8,Math.min(x,innerWidth-pickerWidth-8));
 const top=Math.max(8,Math.min(y,innerHeight-pickerHeight-8));
 profileColorPicker.style.left=`${left}px`;profileColorPicker.style.top=`${top}px`;
 // Flush the fixed-position layout before opening the native picker so the
 // browser anchors its popup to the swatch at its final on-screen location.
 profileColorInput.getBoundingClientRect();
 if(typeof profileColorInput.showPicker==='function')profileColorInput.showPicker();else profileColorInput.click();
}
function assignRandomProfileColors(indices){
 const targets=indices.filter(index=>profiles[index]&&isMeasuredProfile(profiles[index]));
 if(!targets.length)return;
 const start=Math.random()*360;
 targets.forEach((index,order)=>{
  const hue=(start+order*137.508)%360;
  const saturation=0.68+Math.random()*0.2,value=0.88+Math.random()*0.1;
  const chroma=value*saturation,x=chroma*(1-Math.abs((hue/60)%2-1)),m=value-chroma;
  const rgb=hue<60?[chroma,x,0]:hue<120?[x,chroma,0]:hue<180?[0,chroma,x]:hue<240?[0,x,chroma]:hue<300?[x,0,chroma]:[chroma,0,x];
  profiles[index].displayColor='#'+rgb.map(channel=>Math.max(0,Math.min(255,Math.round((channel+m)*255))).toString(16).padStart(2,'0')).join('');
 });
 refresh();
}
profileColorInput.addEventListener('input',()=>{profileColorDraft=profileColorInput.value});
$('applyProfileColor').addEventListener('click',()=>{
 const color=profileColorInput.value||profileColorDraft;
 for(const index of profileColorTargets)if(profiles[index])profiles[index].displayColor=color;
 closeProfileColorPicker();refresh();
});
$('cancelProfileColor').addEventListener('click',closeProfileColorPicker);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!profileColorPicker.hidden){event.stopPropagation();closeProfileColorPicker()}});
document.addEventListener('pointerdown',event=>{if(!profileColorPicker.hidden&&!profileColorPicker.contains(event.target))closeProfileColorPicker()},true);
window.addEventListener('resize',()=>{if(!profileColorPicker.hidden)closeProfileColorPicker()});
$('profiles').addEventListener('contextmenu',event=>{
 if(window.__viewerReadOnlyReport)return;
 const row=event.target.closest('.profile-item');
 if(!row||row.dataset.profileKind!=='profiles')return;
 event.preventDefault();event.stopPropagation();
 const index=Number(row.dataset.profileIndex);
 if(!selectedFileIndices.has(index)){selectedFileIndices.clear();selectedFileIndices.add(index);selectionAnchor=index;updateFileSelectionStyles()}
 const targets=[...selectedFileIndices].filter(itemIndex=>profiles[itemIndex]&&isMeasuredProfile(profiles[itemIndex]));
 const label=targets.length>1?`Set color for ${targets.length} profiles…`:'Set color…';
 const highlight=targets.length>1
  ?[...$('profiles').querySelectorAll('.profile-item')].filter(item=>targets.includes(Number(item.dataset.profileIndex)))
  :row;
 showActionContextMenu(event,[
  {label,action:actionEvent=>openProfileColorPicker(targets,index,actionEvent.clientX,actionEvent.clientY)},
  {label:'Assign random color',action:()=>assignRandomProfileColors(targets)}
 ],targets.length>1?'Selected profiles':'',highlight);
});
document.querySelector('.chart-column').addEventListener('contextmenu',event=>{
 if(event.defaultPrevented||event.target.closest('button,.chart-menu,select,input'))return;
 const showAllHiddenProfiles=()=>{
  hiddenProfiles.clear();hoveredProfileIndex=-1;
  for(const panel of chartPanels){panel.localShownProfiles.clear();updateChartPanelControls(panel)}
  hideChartHover();refresh();
 };
 const setAllChartColors=mode=>{
  hideChartHover();
  for(const panel of chartPanels){panel.colorMode=mode;updateChartPanelControls(panel)}
  activeChartPanels().forEach(renderChartPanel);updateChartLegend();
 };
 showActionContextMenu(event,[
  ...(window.__viewerReadOnlyReport?[]:[{label:'Layout…',action:openChartLayoutDialog}]),
  {label:'Set all to mono color',action:()=>setAllChartColors('profiles')},
  {label:'Set all to multi color',action:()=>setAllChartColors('channels')},
  {label:`Show all hidden (${[...hiddenProfiles].filter(index=>profiles[index]).length})`,action:showAllHiddenProfiles,disabled:hiddenProfiles.size===0},
  ...(window.__viewerReadOnlyReport?[]:[{label:'Clear all bcs',action:clearAllChartProfiles}])
 ],'All charts',[...document.querySelectorAll('#chartSlots>.chart-slot:not([hidden])')]);
});
document.querySelector('.profile-column').addEventListener('contextmenu',event=>{
 if(window.__viewerReadOnlyReport)return;
 if(event.target.closest('.profile-menu-wrap'))return;
 showActionContextMenu(event,[{label:'Layout…',action:openProfileLayoutDialog},{label:'Distribute row heights evenly',action:distributeProfileRowsEvenly},{label:'Clear all profiles',action:clearAllProfileInformation}],'All profiles',[...event.currentTarget.querySelectorAll('.profile-compare-panel:not([hidden])')]);
});
document.querySelector('.target-summary').addEventListener('contextmenu',event=>{
 if(window.__viewerReadOnlyReport)return;
 if(event.target.closest('select,input,button,textarea'))return;
 showClearContextMenu(event,resetTargetSettings,'Reset target',event.currentTarget);
});
document.querySelector('.detail-panel').addEventListener('contextmenu',event=>{
 if(window.__viewerReadOnlyReport)return;
 if(event.target.closest('.note-toolbar'))return;
 if(detailView==='note')showClearContextMenu(event,()=>noteEditor.clear(),'Clear note',event.currentTarget);
 else showClearContextMenu(event,clearPatchDetails,'Dismiss',event.currentTarget);
});
document.addEventListener('contextmenu',event=>{
 if(event.defaultPrevented)return;
 event.preventDefault();
});
const targetDropPanel=document.querySelector('.target-summary');
function applyTargetPreset(preset){
 selectTargetSettings({gamutId:preset.gamutId,whitePointId:preset.whitePointId,eotfId:preset.eotfId});
 if(Number.isFinite(preset.gamma))selectCustomTargetGamma(preset.gamma);
 $('targetGammaValue').setCustomValidity('');
 hideChartHover();refresh();
}
const targetImportDialog=document.createElement('dialog');targetImportDialog.className='target-import-dialog';
targetImportDialog.innerHTML='<h2>Use measured values as Target</h2><p class="target-import-name"></p><div class="target-import-options"></div><div class="target-import-actions"><button type="button" class="target-import-cancel">Cancel</button><button type="button" class="target-import-apply">Apply</button></div>';
document.body.append(targetImportDialog);
let targetImportProfile=null;
const targetImportChoices=[['gamut','Gamut'],['whitePoint','White Point'],['eotf','EOTF'],['ymax','Ymax'],['ymin','Ymin']];
function measuredTargetChoices(profile){
 if(!isMeasuredProfile(profile)&&profile.headTarget){
  const {primaries,whitePoint,gamma}=profile.headTarget;
  const validXy=pair=>pair?.length===2&&pair.every(Number.isFinite)&&pair[0]>0&&pair[1]>0&&pair[0]+pair[1]<=1;
  const unavailable={value:null,valid:false,label:'N/A'};
  return{
   gamut:{value:primaries,valid:['R','G','B'].every(channel=>validXy(primaries[channel])),label:['R','G','B'].map(channel=>`${channel} ${primaries[channel]?.map(value=>value.toFixed(4)).join(', ')||'N/A'}`).join(' · ')},
   whitePoint:{value:whitePoint,valid:validXy(whitePoint),label:whitePoint?.map(value=>value.toFixed(4)).join(', ')||'N/A'},
   eotf:{value:gamma,valid:Number.isFinite(gamma)&&gamma>0,label:Number.isFinite(gamma)?`Gamma ${gamma.toFixed(2)}`:'N/A'},
   ymax:unavailable,ymin:unavailable
  };
 }
 const primaries=ciePrimaryPoints(profile),xy=point=>{const sum=point?.X+point?.Y+point?.Z;return Number.isFinite(sum)&&sum>1e-12?[point.X/sum,point.Y/sum]:null};
 const gamut=Object.fromEntries(['R','G','B'].map(channel=>[channel,xy(primaries[channel])]));
 const whitePoint=xy(primaries.W),gamma=profileSummary(profile).gamma,luminance=measuredProfileLuminanceRange(profile);
 const validXy=pair=>pair?.length===2&&pair.every(Number.isFinite)&&pair[0]>0&&pair[1]>0&&pair[0]+pair[1]<=1;
 return{
  gamut:{value:gamut,valid:['R','G','B'].every(channel=>validXy(gamut[channel])),label:['R','G','B'].map(channel=>`${channel} ${gamut[channel]?.map(value=>value.toFixed(4)).join(', ')||'N/A'}`).join(' · ')},
  whitePoint:{value:whitePoint,valid:validXy(whitePoint),label:whitePoint?.map(value=>value.toFixed(4)).join(', ')||'N/A'},
  eotf:{value:gamma,valid:Number.isFinite(gamma)&&gamma>0,label:Number.isFinite(gamma)?`Gamma ${gamma.toFixed(2)}`:'N/A'},
  ymax:{value:luminance?.max,valid:Number.isFinite(luminance?.max)&&luminance.max>0,label:Number.isFinite(luminance?.max)?`${luminance.max.toFixed(4)} nits`:'N/A'},
  ymin:{value:luminance?.min,valid:Boolean(luminance?.hasMin)&&Number.isFinite(luminance.min),label:luminance?.hasMin?`${luminance.min.toFixed(4)} nits`:'N/A'}
 };
}
function openTargetImport(profile){
 targetImportProfile=profile;
 const values=measuredTargetChoices(profile),options=targetImportDialog.querySelector('.target-import-options');options.replaceChildren();
 targetImportDialog.querySelector('.target-import-name').textContent=profile.name;
 for(const [key,title] of targetImportChoices){
  const label=document.createElement('label'),checkbox=document.createElement('input'),detail=document.createElement('span');
  checkbox.type='checkbox';checkbox.value=key;checkbox.checked=values[key].valid;checkbox.disabled=!values[key].valid;
  detail.textContent=`${title}: ${values[key].label}`;label.append(checkbox,detail);options.append(label);
 }
 targetImportDialog.showModal();
}
targetImportDialog.querySelector('.target-import-cancel').onclick=()=>targetImportDialog.close();
targetImportDialog.querySelector('.target-import-apply').onclick=()=>{
 if(!targetImportProfile)return;
 const values=measuredTargetChoices(targetImportProfile),selected=new Set([...targetImportDialog.querySelectorAll('input:checked')].map(input=>input.value));
 targetImportDialog.close();targetImportProfile=null;
 if(selected.has('gamut'))selectCustomTargetPrimaries(values.gamut.value);
 if(selected.has('whitePoint'))selectCustomTargetWhitePoint(...values.whitePoint.value);
 if(selected.has('eotf'))selectCustomTargetGamma(values.eotf.value);
 if(selected.has('ymax'))selectTargetLuminance('ymax','custom',values.ymax.value);
 if(selected.has('ymin'))selectTargetLuminance('ymin','custom',values.ymin.value);
 if(selected.size){hideChartHover();refresh()}
};
const hasTargetProfilePayload=event=>['application/x-bcs-profile-index','application/x-bcs-target-preset'].some(type=>[...(event.dataTransfer?.types||[])].includes(type));
targetDropPanel.addEventListener('dragenter',event=>{if(window.__viewerReadOnlyReport&&event.dataTransfer?.types.includes('application/x-bcs-profile-index'))return;if(hasTargetProfilePayload(event)){event.preventDefault();targetDropPanel.classList.add('drop-active')}});
targetDropPanel.addEventListener('dragover',event=>{if(window.__viewerReadOnlyReport&&event.dataTransfer?.types.includes('application/x-bcs-profile-index')){event.preventDefault();event.dataTransfer.dropEffect='none';return}if(hasTargetProfilePayload(event)){event.preventDefault();event.dataTransfer.dropEffect='copy';targetDropPanel.classList.add('drop-active')}});
targetDropPanel.addEventListener('dragleave',event=>{if(!targetDropPanel.contains(event.relatedTarget))targetDropPanel.classList.remove('drop-active')});
targetDropPanel.addEventListener('drop',event=>{
 if(!hasTargetProfilePayload(event))return;
 if(window.__viewerReadOnlyReport&&event.dataTransfer.types.includes('application/x-bcs-profile-index')){event.preventDefault();event.stopPropagation();return}
 event.preventDefault();event.stopPropagation();targetDropPanel.classList.remove('drop-active');
 const presetLabel=event.dataTransfer.getData('application/x-bcs-target-preset');
 if(presetLabel){const preset=targetPresets.find(item=>item.label===presetLabel);if(preset)applyTargetPreset(preset);return}
 const index=Number(event.dataTransfer.getData('application/x-bcs-profile-index'));
 if(Number.isInteger(index)&&profiles[index])openTargetImport(profiles[index]);
});

setProfileLayout(profileLayoutRows);bindProfilePanelDropTargets();
initializeChartPanels();
addEventListener('resize',()=>{hideChartHover();refresh()});
renderTargetDetails();refresh();
