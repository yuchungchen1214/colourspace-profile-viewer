// Each panel owns its canvas, modes, viewport, hit targets and pointer capture.
// Only profile data, target settings and the bcs colour palette are shared.
const chartDefinitions = [
 {id:'cie',label:'CIE'}, {id:'graph3d',label:'Volumetric'},
 {id:'eotf',label:'EOTF'}, {id:'balance',label:'RGB Balance'}, {id:'deltae',label:'Delta-E'}
];
const initialChartTypes=['eotf','balance','cie','deltae'];
const chartPanels = [];
// Chart IDs identify the chart and its data; slot indices identify positions in the 4×4 grid.
const chartIdsBySlot = Array.from({length:16},(_,index)=>index+1);
const CHART_DRAG_TYPE='application/x-colourspace-chart-id';
let draggingChartId=null;
let suppressChartMenuClick=false;
function chartPanelAtSlot(slotIndex){return chartPanels[chartIdsBySlot[slotIndex]-1]}
function setChartSlotAssignments(ids){
 if(!Array.isArray(ids)||ids.length!==16||new Set(ids).size!==16||ids.some(id=>!Number.isInteger(id)||id<1||id>16))throw new Error('Invalid chart slot assignments.');
 chartIdsBySlot.splice(0,16,...ids);
 for(let slotIndex=0;slotIndex<16;slotIndex++){
  const panel=chartPanelAtSlot(slotIndex);
  panel.slotIndex=slotIndex;panel.article.dataset.slot=String(slotIndex);
  const row=Math.floor(slotIndex/4),column=slotIndex%4;
  panel.article.style.gridColumn=String(column+1);panel.article.style.gridRow=String(row+1);
  panel.article.style.setProperty('--chart-slot-order',String(row*chartColumnCount+column+1));
  panel.menuButton.setAttribute('aria-label',`Change chart in panel ${slotIndex+1}`);
  updateChartPanelControls(panel);
 }
}
function swapChartPanels(source,target){
 if(source===target||!chartSlotIsActive(source.slotIndex)||!chartSlotIsActive(target.slotIndex))return;
 const next=[...chartIdsBySlot];
 [next[source.slotIndex],next[target.slotIndex]]=[next[target.slotIndex],next[source.slotIndex]];
 setChartSlotAssignments(next);
 applyChartPanelVisibility();hideChartHover();
 requestAnimationFrame(()=>{renderChartPanel(source);renderChartPanel(target)});
 updateChartLegend();updateProfileChartAssignments();
}
let chartHover = null;
let chartPointMenu = null;
let singleChartSlotIndex = null;
let chartColumnCount = 2;
let chartRowCount = 2;
let chartResizeObserver = null;
let chartResizeFrame = 0;
const chartResizePending = new Set();

function observeChartPanelSize(panel) {
 if(typeof ResizeObserver==='undefined')return;
 if(!chartResizeObserver)chartResizeObserver=new ResizeObserver(entries=>{
  for(const entry of entries){
   const panel=chartPanels.find(item=>item.article===entry.target);
   if(!panel||panel.article.hidden)continue;
   const size={width:entry.contentRect.width,height:entry.contentRect.height};
   if(panel.observedSize&&Math.abs(panel.observedSize.width-size.width)<.5&&Math.abs(panel.observedSize.height-size.height)<.5)continue;
   panel.observedSize=size;chartResizePending.add(panel);
  }
  if(chartResizePending.size&&!chartResizeFrame)chartResizeFrame=requestAnimationFrame(()=>{
   chartResizeFrame=0;
   for(const panel of chartResizePending)if(!panel.article.hidden)renderChartPanel(panel);
   chartResizePending.clear();
  });
 });
 chartResizeObserver.observe(panel.article);
}

function chartSlotIsActive(index,columns=chartColumnCount,rows=chartRowCount){
 return Number.isInteger(index)&&index>=0&&index<16&&Math.floor(index/4)<rows&&index%4<columns;
}
function activeChartPanels(){
 const active=[];
 for(let row=0;row<chartRowCount;row++)for(let column=0;column<chartColumnCount;column++)active.push(chartPanelAtSlot(row*4+column));
 return active;
}
function applyChartPanelVisibility(){
 for(const panel of chartPanels)panel.article.hidden=!chartSlotIsActive(panel.slotIndex)||(singleChartSlotIndex!==null&&panel.slotIndex!==singleChartSlotIndex);
}
function setChartLayout(columns,rows){
 const nextCount=columns*rows;
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||columns>4||rows<1||rows>4||nextCount>16)return;
 const wasActive=new Set(activeChartPanels().map(panel=>panel.id));
 chartColumnCount=columns;chartRowCount=rows;
 const host=$('chartSlots');host.style.setProperty('--chart-column-count',columns);
 for(const panel of chartPanels){
  const row=Math.floor(panel.slotIndex/4),column=panel.slotIndex%4,active=chartSlotIsActive(panel.slotIndex);
  panel.article.style.gridColumn=String(column+1);panel.article.style.gridRow=String(row+1);
  panel.article.style.setProperty('--chart-slot-order',String(row*columns+column+1));
  if(active!==wasActive.has(panel.id)){
   panel.selectedProfiles.clear();panel.localShownProfiles.clear();
   panel.colorMode='channels';
   const initialType=row<2&&column<2?initialChartTypes[row*2+column]:null;
   panel.type=initialType;panel.state=initialType?createChartState(initialType):null;
   panel.states=initialType?new Map([[initialType,panel.state]]):new Map();updateChartPanelControls(panel);
  }
 }
 singleChartSlotIndex=null;host.classList.remove('single-chart');
 applyChartPanelVisibility();hideChartHover();
 requestAnimationFrame(()=>activeChartPanels().forEach(renderChartPanel));
 updateChartLegend();updateProfileChartAssignments();
}

function toggleSingleChart(panel) {
 const host=$('chartSlots');
 singleChartSlotIndex=singleChartSlotIndex===panel.slotIndex?null:panel.slotIndex;
 host.classList.toggle('single-chart',singleChartSlotIndex!==null);
 applyChartPanelVisibility();
 hideChartHover();
 requestAnimationFrame(()=>{
  if(singleChartSlotIndex===null)activeChartPanels().forEach(renderChartPanel);
  else renderChartPanel(chartPanelAtSlot(singleChartSlotIndex));
 });
}

function chartBounds(type, state) {
 if(type==='cie')return state.coordinateMode==='xy'
  ?{xmin:0,xmax:.8,ymin:0,ymax:.9}:{xmin:0,xmax:.7,ymin:0,ymax:.6};
 if(type==='deltae')return state.distribution
  ?{xmin:0,xmax:10,ymin:0,ymax:1}:{xmin:0,xmax:1,ymin:0,ymax:10};
 return type==='balance'?{xmin:0,xmax:1,ymin:-.5,ymax:.5}:{xmin:0,xmax:1,ymin:0,ymax:1};
}
function initialChartView(type, state) {
 const bounds=chartBounds(type,state);
 if(type!=='cie')return {...bounds};
 const side=Math.max(bounds.xmax-bounds.xmin,bounds.ymax-bounds.ymin);
 const cx=(bounds.xmin+bounds.xmax)/2,cy=(bounds.ymin+bounds.ymax)/2;
 return {xmin:cx-side/2,xmax:cx+side/2,ymin:cy-side/2,ymax:cy+side/2};
}
function createChartState(type) {
 const state={relative:true,absolute:false,coordinateMode:'xy',allPoints:true,distribution:false};
 if(type==='graph3d'){state.coordinateMode='xyY';state.allPoints=true;state.camera={yaw:1.15,pitch:.31,panX:0,panY:-18,zoom:1.16}}
 state.view=initialChartView(type,state);
 return state;
}
function niceChartStep(value) {
 const p=10**Math.floor(Math.log10(Math.max(value,1e-12))),n=value/p;
 return (n<=1?1:n<=2?2:n<=5?5:10)*p;
}
function chartTicks(lo,hi,step) {
 const ticks=[];
 for(let i=Math.ceil(lo/step-1e-9);i<=Math.floor(hi/step+1e-9);i++)ticks.push(Number((i*step).toFixed(10)));
 return ticks;
}
function prepareChart(panel) {
 const {canvas,type,state}=panel,ctx=canvas.getContext('2d');
 const w=canvas.clientWidth,h=canvas.clientHeight,ratio=devicePixelRatio||1;
 canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.scale(ratio,ratio);
 ctx.fillStyle='#111214';ctx.fillRect(0,0,w,h);
 const size=Math.max(0,Math.min(w-62,h-42)),frame={x:48,y:h-30-size,w:size,h:size};
 if(type==='graph3d'){panel.plot=frame;panel.clip=frame;return{ctx,frame,clip:frame}}
 const v=state.view,bounds=chartBounds(type,state),xs=v.xmax-v.xmin,ys=v.ymax-v.ymin;
 const X=x=>frame.x+(x-v.xmin)/xs*size,Y=y=>frame.y+(v.ymax-y)/ys*size;
 const left=Math.max(frame.x,X(bounds.xmin)),right=Math.min(frame.x+size,X(bounds.xmax));
 const top=Math.max(frame.y,Y(bounds.ymax)),bottom=Math.min(frame.y+size,Y(bounds.ymin));
 const domainClip={x:left,y:top,w:Math.max(0,right-left),h:Math.max(0,bottom-top)};
 const span=Math.max(xs,ys),step=span<=.03?.001:span<=.3?.01:.1;
 let dx=step,dy=step;
 if(type==='deltae'){
  dx=state.distribution?Math.min(1,niceChartStep(xs/Math.max(1,Math.floor(size/48))))
   :Math.min(.1,niceChartStep(xs/Math.max(1,Math.floor(size/45))));
  dy=state.distribution?dx/10:dx*10;
 }
 const xt=chartTicks(Math.max(v.xmin,bounds.xmin),Math.min(v.xmax,bounds.xmax),dx);
 const yt=chartTicks(Math.max(v.ymin,bounds.ymin),Math.min(v.ymax,bounds.ymax),dy);
 ctx.save();ctx.beginPath();ctx.rect(domainClip.x,domainClip.y,domainClip.w,domainClip.h);ctx.clip();
 ctx.fillStyle='#343638';ctx.fillRect(domainClip.x,domainClip.y,domainClip.w,domainClip.h);
 if(type==='cie')drawCieSpectrumVectorClipped(ctx,X,Y,state.coordinateMode,bounds);
 ctx.strokeStyle='#45474b';ctx.lineWidth=1;
 for(const q of xt){ctx.beginPath();ctx.moveTo(X(q),top);ctx.lineTo(X(q),bottom);ctx.stroke()}
 for(const q of yt){ctx.beginPath();ctx.moveTo(left,Y(q));ctx.lineTo(right,Y(q));ctx.stroke()}
 ctx.restore();ctx.fillStyle='#aaa';ctx.font='11px system-ui';
 const digits=step===.001?3:span<=.5?2:1;
 const label=q=>type==='deltae'?String(Number(state.distribution?q.toPrecision(5):q.toFixed(6))):q.toFixed(digits);
 ctx.textAlign='center';let last=-Infinity;
 for(const q of xt){
  const x=X(q),text=label(q),half=ctx.measureText(text).width/2;
  if(type==='deltae'&&(x<frame.x+half||x>w-14-half))continue;
  const tx=Math.max(half+2,Math.min(w-half-2,x));
  if(tx-last>=42){ctx.fillText(text,tx,h-10);last=tx}
 }
 ctx.textAlign='right';last=Infinity;
 for(const q of yt){const y=Y(q);if(last-y>=28){ctx.fillText(label(q),frame.x-7,y+4);last=y}}
 ctx.textAlign='start';
 // Measured EOTF and absolute balance errors can extend beyond target bounds.
 const clip=type==='deltae'||type==='eotf'||(type==='balance'&&state.absolute)?frame:domainClip;
 panel.plot=frame;panel.clip=clip;
 return {ctx,X,Y,frame,clip};
}
function chartLine(graph,points,xValue,yValue,color,dash=[]) {
 if(!points.length)return;
 const ctx=graph.ctx;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);ctx.beginPath();
 points.forEach((point,i)=>{const x=graph.X(xValue(point)),y=graph.Y(yValue(point));i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
 ctx.stroke();ctx.setLineDash([]);
}
function addChartPoint(panel,point) {
 const {px,py}=point,r=panel.clip;
 if(Number.isFinite(px)&&Number.isFinite(py)&&r.w>0&&r.h>0&&px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h)panel.points.push(point);
}
function channelNode(ctx,x,y,channel,panel) {
 ctx.beginPath();
 if(useProfileColors(panel)&&channel==='G')ctx.rect(x-3,y-3,6,6);
 else if(useProfileColors(panel)&&channel==='B'){ctx.moveTo(x,y-4);ctx.lineTo(x+4,y+3);ctx.lineTo(x-4,y+3);ctx.closePath()}
 else ctx.arc(x,y,3.5,0,Math.PI*2);
 ctx.fill();
}
function drawEotfPanel(panel,graph) {
 const relative=panel.state.relative,referenceIndex=[...panel.selectedProfiles].sort((a,b)=>a-b).find(index=>profileVisible(index)||panel.localShownProfiles.has(index));
 const reference=Number.isInteger(referenceIndex)?profiles[referenceIndex]:null;
 const customLuminance=TARGET_CONFIG.luminance.ymin.mode==='custom'||TARGET_CONFIG.luminance.ymax.mode==='custom';
 const requestedRange=reference||customLuminance?targetLuminanceRange(reference):{min:0,max:1};
 const {min,max}=isValidTargetLuminanceRange(requestedRange)?requestedRange:{min:0,max:1};
 const targetY=x=>targetEotf(x,min,max,relative);
 chartLine(graph,Array.from({length:101},(_,i)=>i/100),x=>x,targetY,'#ddd',[4,3]);
 forEachVisibleProfileBackToFront((profile,index)=>{
  const data=eotfSeries(profile,relative),xx=p=>relative?p.q.r:data.toLinear(p.q.r);
  const channels=[['R','#f66'],['G','#6d6'],['B','#69f']];
  for(const [channel,color] of channels)chartLine(graph,data.values,xx,p=>p[channel],chartProfileColor(useProfileColors(panel)?profileColor(index):color,index));
  for(const point of data.values)for(const [channel,color] of channels){
   const xValue=xx(point),yValue=point[channel],px=graph.X(xValue),py=graph.Y(yValue);
   graph.ctx.fillStyle=chartProfileColor(useProfileColors(panel)?profileColor(index):color,index);
   channelNode(graph.ctx,px,py,channel,panel);addChartPoint(panel,{px,py,xValue,yValue,channel,profile:profile.name,profileIndex:index,q:point.q});
  }
 },panel);
}
function drawBalancePanel(panel,graph) {
 chartLine(graph,[0,1],x=>x,()=>0,'#ddd',[4,3]);
 forEachVisibleProfileBackToFront((profile,index)=>{
  const whitePoint=targetWhitePointForProfile(profile),matrix=whitePoint?safeTargetMatrices(TARGET_CONFIG.gamut,whitePoint).xyzToRgb:null;
  const grey=profile.points.filter(q=>Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002).sort((a,b)=>a.r-b.r);
  const points=grey.map(q=>{
   if(!matrix||!whitePoint)return{q,R:NaN,G:NaN,B:NaN};
   const sum=q.X+q.Y+q.Z,chroma=sum>1e-12?[q.X/sum,q.Y/sum,q.Z/sum]:[NaN,NaN,NaN];
   let values=matrix.map(row=>row.reduce((n,v,i)=>n+v*chroma[i],0)-whitePoint.y);
   if(panel.state.absolute){const {min,max}=targetLuminanceRange(profile),targetY=min+(max-min)*targetEncodedToLinear(q.r,min,max);values=targetY>0?matrix.map(row=>(row[0]*q.X+row[1]*q.Y+row[2]*q.Z)/targetY-1):[NaN,NaN,NaN]}
   return {q,R:values[0],G:values[1],B:values[2]};
  }).filter(q=>[q.R,q.G,q.B].every(Number.isFinite));
  const channels=[['R','#f66'],['G','#6d6'],['B','#69f']];
  for(const [channel,color] of channels)chartLine(graph,points,p=>p.q.r,p=>p[channel],chartProfileColor(useProfileColors(panel)?profileColor(index):color,index));
  for(const point of points)for(const [channel,color] of channels){
   const xValue=point.q.r,yValue=point[channel],px=graph.X(xValue),py=graph.Y(yValue);
   graph.ctx.fillStyle=chartProfileColor(useProfileColors(panel)?profileColor(index):color,index);
   channelNode(graph.ctx,px,py,channel,panel);addChartPoint(panel,{px,py,xValue,yValue,channel,profile:profile.name,profileIndex:index,q:point.q});
  }
 },panel);
}
function cieCoordinates(x,y,mode) {
 if(mode==='xy')return {x,y};
 const d=-2*x+12*y+3;return {x:4*x/d,y:9*y/d};
}
function cieNodePath(ctx,px,py,de,large=false) {
 ctx.beginPath();
 if(de<1)ctx.arc(px,py,large?3:2.6,0,Math.PI*2);
 else if(de<2.3){const size=large?3.5:3;ctx.moveTo(px,py-size);ctx.lineTo(px+size,py+size-.5);ctx.lineTo(px-size,py+size-.5);ctx.closePath()}
 else {const size=large?3:2.5;ctx.rect(px-size,py-size,size*2,size*2)}
}
function drawCiePanel(panel,graph) {
 const {ctx}=graph,{coordinateMode,allPoints}=panel.state;
 const coords=(x,y)=>cieCoordinates(x,y,coordinateMode);
 const patchCoords=q=>{const sum=q.X+q.Y+q.Z;return coords(q.X/sum,q.Y/sum)};
 const gamut=['R','G','B','R'].map(key=>coords(...TARGET_CONFIG.gamut.primaries[key]));
 chartLine(graph,gamut,p=>p.x,p=>p.y,'#ddd',[4,3]);
 const targetProfiles=[];forEachVisibleProfileBackToFront((profile,index)=>targetProfiles.push({profile,index}),panel);
 const markerProfiles=targetProfiles.length?targetProfiles:[{profile:null,index:null}];
 for(const {profile,index} of markerProfiles)for(const {label,color,point,r,g,b} of graph3DTargetVertices(profile)){
  const p=patchCoords(point);if(!p)continue;const px=graph.X(p.x),py=graph.Y(p.y);
  ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#111214';ctx.lineWidth=1;ctx.stroke();
  addChartPoint(panel,{px,py,xValue:p.x,yValue:p.y,r,g,b,de:NaN,target:[point.X,point.Y,point.Z],actualXYZ:null,profile:profile?.name||'Target',profileIndex:index,label,vertexColor:color,targetVertex:true});
 }
 const connect=(primaries,color)=>{const vertices=['R','G','B'].map(key=>primaries[key]).filter(Boolean).map(patchCoords);if(vertices.length===3)chartLine(graph,[...vertices,vertices[0]],p=>p.x,p=>p.y,color)};
 const hit=(q,profile,metric,p,px,py,label,profileIndex)=>addChartPoint(panel,{px,py,xValue:p.x,yValue:p.y,r:q.r,g:q.g,b:q.b,de:metric.de,target:metric.target,actualXYZ:[q.X,q.Y,q.Z],q,profile:profile.name,profileIndex,label});
 forEachVisibleProfileBackToFront((profile,index)=>{
  const color=chartProfileColor(profileColor(index),index),primaries=ciePrimaryPoints(profile);
  if(!allPoints){
   connect(primaries,color);
   for(const key of ['R','G','B','W']){
    const q=primaries[key];if(!q||q.X+q.Y+q.Z<=1e-12)continue;
    const p=patchCoords(q),px=graph.X(p.x),py=graph.Y(p.y),metric=cieMetrics(q,profile);
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.7;cieNodePath(ctx,px,py,metric.de,true);ctx.fill();ctx.stroke();
    hit(q,profile,metric,p,px,py,key==='W'?'White':key,index);
   }
   return;
  }
  const single=panelProfileCount(panel)===1;
  if(single)connect(primaries,useProfileColors(panel)?color:chartProfileColor('#999',index));
  const highlights=new Map();
  if(useProfileColors(panel))for(const key of ['R','G','B','W'])if(primaries[key])highlights.set(primaries[key],key==='W'?'White':key);
  for(const q of profile.points){
   if(q.X+q.Y+q.Z<=1e-12)continue;
   const p=patchCoords(q),px=graph.X(p.x),py=graph.Y(p.y),metric=cieMetrics(q,profile);
   if(useProfileColors(panel)){
    ctx.strokeStyle=color;ctx.lineWidth=1.5;cieNodePath(ctx,px,py,metric.de);
    if(highlights.has(q)){ctx.fillStyle=color;ctx.fill()}ctx.stroke();
   }else{ctx.fillStyle=chartProfileColor(metric.color,index);ctx.fillRect(px-2,py-2,4,4)}
   hit(q,profile,metric,p,px,py,highlights.get(q),index);
  }
  if(single&&!useProfileColors(panel))for(const key of ['R','G','B','W']){
   const q=primaries[key];if(!q||q.X+q.Y+q.Z<=1e-12)continue;
   const p=patchCoords(q);ctx.strokeStyle=chartProfileColor('#999',index);ctx.lineWidth=1.5;ctx.strokeRect(graph.X(p.x)-4.5,graph.Y(p.y)-4.5,9,9);
  }
 },panel);
}
function drawDeltaEPanel(panel,graph) {
 forEachVisibleProfileBackToFront((profile,index)=>{
  const color=chartProfileColor(profileColor(index),index);
  const series=panel.state.distribution?deltaEDistributionCounts(profile).map((count,i)=>({
   xValue:i*.5,yValue:profile.points.length?count/profile.points.length:0,
   count,total:profile.points.length,binStart:i*.5,binEnd:i===20?Infinity:(i+1)*.5
  })):profile.points.filter(q=>Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002&&q.X+q.Y+q.Z>1e-12)
   .map(q=>{const metric=cieMetrics(q,profile);return{xValue:q.r,yValue:metric.de,r:q.r,g:q.g,b:q.b,target:metric.target,actualXYZ:[q.X,q.Y,q.Z],q}}).sort((a,b)=>a.xValue-b.xValue);
  chartLine(graph,series,p=>p.xValue,p=>p.yValue,color);
  for(const point of series){
   const px=graph.X(point.xValue),py=graph.Y(point.yValue);
   graph.ctx.fillStyle=color;graph.ctx.beginPath();graph.ctx.arc(px,py,3.5,0,Math.PI*2);graph.ctx.fill();
   addChartPoint(panel,{...point,px,py,profile:profile.name,profileIndex:index});
  }
 },panel);
}
function graph3DCoordinates(point,mode,profile=null,axisMax=null){
 const sum=point.X+point.Y+point.Z;if(!(sum>1e-12))return null;
 const targetMax=targetLuminanceRange(profile).max,graphY=Number.isFinite(axisMax)&&axisMax>0&&Number.isFinite(targetMax)&&targetMax>0?point.Y/targetMax*axisMax:point.Y;
 if(mode==='uvY'){
  const denominator=point.X+15*point.Y+3*point.Z;if(!(denominator>1e-12))return null;
  const u=4*point.X/denominator,v=9*point.Y/denominator;
  return{a:v,b:u,coordinateX:u,coordinateY:v,Y:graphY,actualY:point.Y};
 }
 const x=point.X/sum,y=point.Y/sum;
 return{a:y,b:x,coordinateX:x,coordinateY:y,Y:graphY,actualY:point.Y};
}
function graph3DConvexHull(points,mode,profile,maxY,aMax,bMax){
 const vertices=[],seen=new Set();
 for(const point of points){
  const c=graph3DCoordinates(point,mode,profile,maxY);if(!c)continue;
  const v=[c.a/aMax,c.Y/maxY,c.b/bMax],key=v.map(value=>value.toFixed(5)).join(':');
  if(seen.has(key))continue;seen.add(key);vertices.push(v);
 }
 if(vertices.length<4)return[];
 const sub=(a,b)=>a.map((value,index)=>value-b[index]),dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=a=>Math.hypot(...a);
 let p0=0;for(let i=1;i<vertices.length;i++)if(vertices[i][0]<vertices[p0][0])p0=i;
 let p1=0,best=-1;for(let i=0;i<vertices.length;i++){const d=length(sub(vertices[i],vertices[p0]));if(d>best){best=d;p1=i}}
 if(best<1e-8)return[];
 const line=sub(vertices[p1],vertices[p0]);let p2=0;best=-1;
 for(let i=0;i<vertices.length;i++){const d=length(cross(sub(vertices[i],vertices[p0]),line))/length(line);if(d>best){best=d;p2=i}}
 if(best<1e-8)return[];
 const normal=cross(sub(vertices[p1],vertices[p0]),sub(vertices[p2],vertices[p0]));let p3=0;best=-1;
 for(let i=0;i<vertices.length;i++){const d=Math.abs(dot(normal,sub(vertices[i],vertices[p0])))/length(normal);if(d>best){best=d;p3=i}}
 if(best<1e-8)return[];
 const interior=[0,1,2].map(axis=>(vertices[p0][axis]+vertices[p1][axis]+vertices[p2][axis]+vertices[p3][axis])/4);
 const makeFace=(a,b,c)=>{let n=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]));if(dot(n,sub(interior,vertices[a]))>0){[b,c]=[c,b];n=n.map(value=>-value)}return{a,b,c,n}};
 let faces=[makeFace(p0,p1,p2),makeFace(p0,p3,p1),makeFace(p0,p2,p3),makeFace(p1,p3,p2)];
 const seeds=new Set([p0,p1,p2,p3]),epsilon=1e-8;
 for(let index=0;index<vertices.length;index++){
  if(seeds.has(index))continue;
  const point=vertices[index],visible=faces.filter(face=>dot(face.n,sub(point,vertices[face.a]))>epsilon);
  if(!visible.length)continue;
  const edges=new Map();
  for(const face of visible)for(const [a,b] of [[face.a,face.b],[face.b,face.c],[face.c,face.a]]){
   const key=a<b?`${a}:${b}`:`${b}:${a}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});
  }
  const removed=new Set(visible);faces=faces.filter(face=>!removed.has(face));
  for(const edge of edges.values())if(edge.count===1)faces.push(makeFace(edge.a,edge.b,index));
 }
 return faces.map(face=>[vertices[face.a],vertices[face.b],vertices[face.c]]);
}
function draw3DGamutSurface(panel,ctx,triangles,project,color,maxY,aMax,bMax){
 const canvas=panel.surfaceCanvas||(panel.surfaceCanvas=document.createElement('canvas'));
 let gl=panel.surfaceGl;
 if(!gl){
  gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});
  if(gl){
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader};
   const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec3 position; void main(){gl_Position=vec4(position,1.0);}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'precision mediump float; uniform vec4 color; void main(){gl_FragColor=color;}'));gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
   panel.surfaceGl=gl;panel.surfaceProgram=program;panel.surfaceBuffer=gl.createBuffer();panel.surfacePosition=gl.getAttribLocation(program,'position');panel.surfaceColor=gl.getUniformLocation(program,'color');
  }
 }
 const mainCanvas=panel.canvas,width=mainCanvas.clientWidth,height=mainCanvas.clientHeight,ratio=devicePixelRatio||1;
 if(gl&&width>0&&height>0){
  canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));gl.viewport(0,0,canvas.width,canvas.height);
  const positions=[];
  for(const triangle of triangles)for(const [a,y,b] of triangle){const point=project(a*aMax,y*maxY,b*bMax);positions.push(point.x/width*2-1,1-point.y/height*2,-point.z*.5)}
  const expanded=color.length===4?'#'+[1,2,3].map(index=>color[index].repeat(2)).join(''):color,rgb=/^#[0-9a-f]{6}$/i.test(expanded)?[1,3,5].map(index=>parseInt(expanded.slice(index,index+2),16)/255):[.65,.68,.72];
  gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(panel.surfaceProgram);gl.bindBuffer(gl.ARRAY_BUFFER,panel.surfaceBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STREAM_DRAW);gl.enableVertexAttribArray(panel.surfacePosition);gl.vertexAttribPointer(panel.surfacePosition,3,gl.FLOAT,false,0,0);gl.uniform4f(panel.surfaceColor,rgb[0],rgb[1],rgb[2],1);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);
  ctx.save();ctx.globalAlpha=.15;ctx.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,width,height);ctx.restore();return;
 }
 // Back-face culling fallback for browsers without WebGL: draw only the
 // outward-facing half of the convex shell instead of layering both sides.
 const faces=triangles.map(triangle=>({vertices:triangle.map(([a,y,b])=>project(a*aMax,y*maxY,b*bMax))}));
 const area=face=>{const[p0,p1,p2]=face.vertices;return(p1.x-p0.x)*(p2.y-p0.y)-(p1.y-p0.y)*(p2.x-p0.x)};
 const positive=faces.reduce((sum,face)=>sum+Math.max(0,area(face)),0),negative=faces.reduce((sum,face)=>sum+Math.max(0,-area(face)),0),frontSign=positive>negative?1:-1;
 ctx.save();ctx.globalAlpha=.15;ctx.fillStyle=color;
 for(const face of faces)if(area(face)*frontSign>0){ctx.beginPath();ctx.moveTo(face.vertices[0].x,face.vertices[0].y);ctx.lineTo(face.vertices[1].x,face.vertices[1].y);ctx.lineTo(face.vertices[2].x,face.vertices[2].y);ctx.closePath();ctx.fill()}
 ctx.restore();
}
function draw3DChromaticityPlane(ctx,project,mode,aMax,bMax){
 const image=cieSpectrumImage(mode==='uvY'?'uv':'xy');
 const locus=CIE_VECTOR_XY.map(point=>cieVectorPoint(point,mode==='uvY'?'uv':'xy'));
 ctx.save();ctx.beginPath();
 locus.forEach((point,index)=>{const projected=project(point.y,0,point.x);if(index===0)ctx.moveTo(projected.x,projected.y);else ctx.lineTo(projected.x,projected.y)});
 ctx.closePath();ctx.clip();
 const origin=project(aMax,0,0),right=project(aMax,0,bMax),bottom=project(0,0,0);
 const width=image.width,height=image.height;
 ctx.transform((right.x-origin.x)/width,(right.y-origin.y)/width,(bottom.x-origin.x)/height,(bottom.y-origin.y)/height,origin.x,origin.y);
 ctx.drawImage(image,0,0,width,height);ctx.restore();
}
function graph3DTargetVertices(profile){
 const colors={R:'#ff3030',G:'#00ed48',B:'#3485ff',W:'#ffffff',C:'#00e8e8',M:'#ff35db',Y:'#ffe52e'};
 const inputs={R:[1,0,0],G:[0,1,0],B:[0,0,1],W:[1,1,1],C:[0,1,1],M:[1,0,1],Y:[1,1,0]};
 return Object.entries(inputs).flatMap(([label,[r,g,b]])=>{
  let xyz;try{xyz=targetXYZ({r,g,b},profile)}catch{return[]}
  if(!Array.isArray(xyz)||!xyz.every(Number.isFinite))return[];
  const [X,Y,Z]=xyz;return[{label,color:colors[label],point:{X,Y,Z},r,g,b}];
 });
}
function draw3DGraphPanel(panel,graph){
 const {ctx,frame}=graph,state=panel.state,mode=state.coordinateMode,camera=state.camera||{yaw:1.15,pitch:.31,panX:0,panY:-18,zoom:1.16};
 // Keep the 3D chromaticity plane on the same coordinate extent as the
 // corresponding flat CIE plot (and its source raster) in both modes.
 const aMax=mode==='uvY'?.6:.9,bMax=mode==='uvY'?.7:.8;
 let maxY=0;forEachVisibleProfileBackToFront(profile=>{const targetMax=targetLuminanceRange(profile).max;if(Number.isFinite(targetMax))maxY=Math.max(maxY,targetMax)},panel);
 maxY=maxY>0?maxY:targetLuminanceRange(null).max||1;
 const cx=frame.x+frame.w/2+(camera.panX||0),cy=frame.y+frame.h/2+(camera.panY||0),scale=Math.min(frame.w,frame.h)*.31*(camera.zoom||1);
 const project=(a,Y,b)=>{
  const x=(a/aMax-.5)*2,y=(Y/maxY-.5)*2,z=(b/bMax-.5)*2,cyaw=Math.cos(camera.yaw),syaw=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  const rx=x*cyaw+z*syaw,rz=-x*syaw+z*cyaw,ry=y*cp-rz*sp;
  return{x:cx+rx*scale,y:cy-ry*scale,z:rz};
 };
 ctx.save();ctx.beginPath();ctx.rect(frame.x,frame.y,frame.w,frame.h);ctx.clip();
 draw3DChromaticityPlane(ctx,project,mode,aMax,bMax);ctx.restore();
 const axisOrigin=project(0,0,0),axisEndpoints=[project(aMax,0,0),project(0,maxY,0),project(0,0,bMax)];
 ctx.save();ctx.lineWidth=1;ctx.strokeStyle='#777a7e';
 for(const endpoint of axisEndpoints){ctx.beginPath();ctx.moveTo(axisOrigin.x,axisOrigin.y);ctx.lineTo(endpoint.x,endpoint.y);ctx.stroke()}
 ctx.restore();ctx.fillStyle='#aaa';ctx.font='11px system-ui';ctx.textAlign='center';
 const aLabel=mode==='uvY'?"v′":'y',bLabel=mode==='uvY'?"u′":'x';
 const axisA=project(aMax,0,0),axisB=project(0,0,bMax),axisY=project(0,maxY,0);
 ctx.fillText(aLabel,axisA.x+8,axisA.y+14);ctx.fillText(bLabel,axisB.x-8,axisB.y+14);ctx.fillText('Y',axisY.x-4,axisY.y-8);
 ctx.save();ctx.beginPath();ctx.rect(frame.x,frame.y,frame.w,frame.h);ctx.clip();
 const targetProfiles=[];forEachVisibleProfileBackToFront((profile,index)=>targetProfiles.push({profile,index}),panel);
 const markerProfiles=targetProfiles.length?targetProfiles:[{profile:null,index:null}];
 for(const {profile,index} of markerProfiles){
  for(const {label,color,point,r,g,b} of graph3DTargetVertices(profile)){
   const coordinates=graph3DCoordinates(point,mode,profile,maxY);if(!coordinates)continue;
   const p=project(coordinates.a,coordinates.Y,coordinates.b);
   ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#111214';ctx.lineWidth=1;ctx.stroke();
   addChartPoint(panel,{px:p.x,py:p.y,xValue:coordinates.a,yValue:coordinates.b,world3D:[coordinates.a,coordinates.Y,coordinates.b],coordinateX:coordinates.coordinateX,coordinateY:coordinates.coordinateY,r,g,b,de:NaN,target:[point.X,point.Y,point.Z],actualXYZ:null,graphY:coordinates.actualY,graphMode:mode,profile:profile?.name||'Target',profileIndex:index,label,vertexColor:color,targetVertex:true});
  }
 }
 forEachVisibleProfileBackToFront((profile,index)=>{
  const color=chartProfileColor(profileColor(index),index),profileColors=useProfileColors(panel),primaries=ciePrimaryPoints(profile),highlights=new Map();
  if(!state.allPoints){draw3DGamutSurface(panel,ctx,graph3DConvexHull(profile.points,mode,profile,maxY,aMax,bMax),project,color,maxY,aMax,bMax);return}
  if(profileColors)for(const key of ['R','G','B','W'])if(primaries[key])highlights.set(primaries[key],key==='W'?'White':key);
  for(const point of profile.points){
   const coordinates=graph3DCoordinates(point,mode,profile,maxY);if(!coordinates)continue;const p=project(coordinates.a,coordinates.Y,coordinates.b),metric=cieMetrics(point,profile);
   if(profileColors){ctx.strokeStyle=color;ctx.lineWidth=1.5;cieNodePath(ctx,p.x,p.y,metric.de);if(highlights.has(point)){ctx.fillStyle=color;ctx.fill()}ctx.stroke()}
   else{ctx.fillStyle=chartProfileColor(metric.color,index);ctx.fillRect(p.x-2,p.y-2,4,4)}
   addChartPoint(panel,{px:p.x,py:p.y,xValue:coordinates.a,yValue:coordinates.b,world3D:[coordinates.a,coordinates.Y,coordinates.b],coordinateX:coordinates.coordinateX,coordinateY:coordinates.coordinateY,profile:profile.name,profileIndex:index,r:point.r,g:point.g,b:point.b,de:metric.de,target:metric.target,actualXYZ:[point.X,point.Y,point.Z],q:point,graphY:coordinates.actualY,graphMode:mode,label:highlights.get(point)});
  }
 },panel);
 ctx.restore();
}
function renderChartPanel(panel) {
 if(!panel.type){
  panel.targetWarning.hidden=true;panel.points=[];panel.plot=null;panel.lastRenderedWithProfiles=false;panel.lastRenderedProfiles=new Set();
  const {canvas}=panel,ratio=devicePixelRatio||1,width=canvas.clientWidth,height=canvas.clientHeight;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#111214';ctx.fillRect(0,0,width,height);
  return;
 }
 // Incomplete custom Target values cannot be recalculated. Keep the last
 // rendered chart visible until the user finishes entering valid values.
 const validTarget=targetConfigurationIsValid();
 panel.targetWarning.hidden=validTarget;
 if(!validTarget){
  panel.lastRenderedProfiles=new Set([...(panel.lastRenderedProfiles||[])].filter(index=>panel.selectedProfiles.has(index)));
  const count=[...panel.selectedProfiles].filter(index=>!panel.lastRenderedProfiles.has(index)).length;
  const warning=['Target incomplete',panel.lastRenderedWithProfiles?'Previous chart shown':null,count?`${count} bcs not drawn`:null].filter(Boolean).join('\n');
  if(panel.targetWarning.textContent!==warning)panel.targetWarning.textContent=warning;
  return;
 }
 panel.points=[];
 const graph=prepareChart(panel);graph.ctx.save();
 graph.ctx.beginPath();graph.ctx.rect(graph.clip.x,graph.clip.y,graph.clip.w,graph.clip.h);graph.ctx.clip();
 try{
  ({eotf:drawEotfPanel,balance:drawBalancePanel,cie:drawCiePanel,deltae:drawDeltaEPanel,graph3d:draw3DGraphPanel})[panel.type](panel,graph);
 }finally{graph.ctx.restore()}
 panel.lastRenderedWithProfiles=panel.selectedProfiles.size>0;
 panel.lastRenderedProfiles=new Set(panel.selectedProfiles);
}
function render() {hideChartHover();activeChartPanels().forEach(renderChartPanel)}

function nearestChartPoint(panel,x,y) {
 let nearest=null,distance=panel.type==='deltae'?10:8;
 // Reverse order keeps the topmost file preferred when nodes overlap exactly.
 for(let i=panel.points.length-1;i>=0;i--){const p=panel.points[i],d=Math.hypot(p.px-x,p.py-y);if(d<distance){nearest=p;distance=d}}
 return nearest;
}
function zoomChartPanel(panel,x,y,deltaY) {
 if(panel.type==='graph3d'){
  if(!deltaY)return;
  const camera=panel.state.camera,frame=panel.plot,factor=deltaY<0?1.1:.9;
  if(!frame)return;
  const centerX=frame.x+frame.w/2+(camera.panX||0),centerY=frame.y+frame.h/2+(camera.panY||0);
  const anchor=panel.hoveredPoint||{px:x,py:y};
  const previousZoom=camera.zoom||1,nextZoom=Math.max(.7,Math.min(100,previousZoom*factor)),actualFactor=nextZoom/previousZoom;
  camera.panX=(camera.panX||0)+(anchor.px-centerX)*(1-actualFactor);
  camera.panY=(camera.panY||0)+(anchor.py-centerY)*(1-actualFactor);
  camera.zoom=nextZoom;return;
 }
 if(!deltaY||!panel.plot?.w||!panel.plot?.h)return;
 const plot=panel.plot,v=panel.state.view,xs=v.xmax-v.xmin,ys=v.ymax-v.ymin;
 // When Patch is showing this panel's hovered node, keep that exact node
 // anchored during wheel zoom even if the wheel event lands slightly away.
 const anchor=panel.hoveredPoint||null;
 const clamp=n=>Math.max(0,Math.min(1,n));
 const fx=clamp(((anchor?anchor.px:x)-plot.x)/plot.w),fy=clamp(((anchor?anchor.py:y)-plot.y)/plot.h);
 const cx=anchor?anchor.xValue:v.xmin+fx*xs,cy=anchor?anchor.yValue:v.ymax-fy*ys;
 const base=initialChartView(panel.type,panel.state),bx=base.xmax-base.xmin,by=base.ymax-base.ymin;
 const minFactor=panel.type==='balance'?.002:.005;
 const factor=Math.max(Math.max(bx*minFactor/xs,by*minFactor/ys),Math.min(deltaY<0?.85:1.18,bx*2/xs,by*2/ys));
 const nx=xs*factor,ny=ys*factor;
 panel.state.view={xmin:cx-fx*nx,xmax:cx+(1-fx)*nx,ymin:cy-(1-fy)*ny,ymax:cy+fy*ny};
}
function panChartPanel(panel,start,dx,dy) {
 if(panel.type==='graph3d')return;
 const plot=panel.plot;if(!plot?.w||!plot?.h)return;
 const x=dx/plot.w*(start.xmax-start.xmin),y=dy/plot.h*(start.ymax-start.ymin);
 panel.state.view={xmin:start.xmin-x,xmax:start.xmax-x,ymin:start.ymin+y,ymax:start.ymax+y};
}
function chartPointerPosition(panel,event) {
 const r=panel.canvas.getBoundingClientRect();
 return {x:(event.clientX-r.left)*panel.canvas.clientWidth/r.width,y:(event.clientY-r.top)*panel.canvas.clientHeight/r.height};
}
function paintPatch(data){if(!chartHover)return;for(const key of ['name','rgb','targetXYZ','targetYxy','actualXYZ','actualYxy','extra']){const field=chartHover.fields[key];field.textContent=data?.[key]||'';field.title=data?.[key]||''}chartHover.fields.nameDot.hidden=!data?.name;chartHover.fields.nameDot.style.setProperty('--patch-color',data?.color||'#aaa')}
function hideChartHover() {clearTargetMeasuredPreview('chart');clearLocatedFile('chart');if(chartHover){if(chartHover.panel)chartHover.panel.hoveredPoint=null;chartHover.panel=null;for(const panel of chartPanels)if(panel.hoverRing)panel.hoverRing.hidden=true;chartHover.ring.hidden=true;chartHover.hoverData=null;paintPatch(chartHover.pinnedData)}}
function closeChartPointMenu(){if(chartPointMenu)chartPointMenu.hidden=true}
function showChartPointMenu(panel,event){
 if(window.__viewerReadOnlyReport)return;
 const local=chartPointerPosition(panel,event),point=nearestChartPoint(panel,local.x,local.y);
 if(!point||point.targetWhite||point.targetVertex||!Number.isInteger(point.profileIndex))return;
 event.preventDefault();hideChartHover();
 const button=chartPointMenu.querySelector('button');
 button.textContent='Remove from this chart';button.title='Remove '+profiles[point.profileIndex].name+' from this chart';
 button.onclick=()=>{
  panel.selectedProfiles.delete(point.profileIndex);panel.localShownProfiles.delete(point.profileIndex);closeChartPointMenu();
  updateChartPanelControls(panel);renderChartPanel(panel);updateProfileChartAssignments();updateChartLegend();
 };
 chartPointMenu.hidden=false;
 const left=Math.max(4,Math.min(event.clientX,innerWidth-chartPointMenu.offsetWidth-8));
 const top=Math.max(4,Math.min(event.clientY,innerHeight-chartPointMenu.offsetHeight-8));
 chartPointMenu.style.left=left+'px';chartPointMenu.style.top=top+'px';button.focus();
}
function chartPointText(panel,point) {
 const n=value=>Number.isFinite(value)?value.toFixed(4):'N/A';
 const de=value=>Number.isFinite(value)?value.toFixed(3):'N/A';
 if(panel.type==='eotf'||panel.type==='balance')return [point.channel,`Input: ${n(point.xValue)}`,`${panel.type==='eotf'?'Output':'Error'}: ${n(point.yValue)}`].join('\n');
 if(panel.type==='cie'){
  if(point.targetVertex)return [`Target ${point.label}`,`${panel.state.coordinateMode}: ${n(point.xValue)}, ${n(point.yValue)}`].join('\n');
  const white=point.whitePoint||TARGET_CONFIG.whitePoint;
  if(point.targetWhite)return [`xy: ${n(white.x)}, ${n(white.y)}`].join('\n');
  const coordinates=panel.state.coordinateMode;
  return [`${coordinates}: ${n(point.xValue)}, ${n(point.yValue)}`,`ΔE: ${de(point.de)}`].join('\n');
 }
 if(panel.type==='graph3d')return point.targetVertex?[`Target ${point.label}`,`${point.graphMode}: ${n(point.graphY)}, ${n(point.coordinateX)}, ${n(point.coordinateY)}`].join('\n'):[`${point.graphMode}: ${n(point.graphY)}, ${n(point.coordinateX)}, ${n(point.coordinateY)}`,`ΔE: ${de(point.de)}`].join('\n');
 if(panel.state.distribution)return [`ΔE range: ${point.binStart.toFixed(3)}–${Number.isFinite(point.binEnd)?point.binEnd.toFixed(3):'∞'}`,`Proportion: ${n(point.yValue)}`,`Measured points: ${point.count} / ${point.total}`].join('\n');
 return [`Input: ${n(point.xValue)}`,`ΔE: ${de(point.yValue)}`].join('\n');
}
function chartPointPatch(panel,point){
 const n=value=>Number.isFinite(value)?value.toFixed(4):'N/A';
 const yxy=value=>{
  if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))return'N/A';
  const [x,y,z]=value,total=x+y+z;
  return Number.isFinite(total)&&Math.abs(total)>1e-12?[y,x/total,y/total].map(n).join(', '):'N/A';
 };
 const xyz=value=>Array.isArray(value)?value.map(n).join(', '):'N/A';
 if(point.targetVertex){const rgb=Number.isFinite(point.r)&&Number.isFinite(point.g)&&Number.isFinite(point.b)?[point.r,point.g,point.b].map(value=>Math.round(value*255)).join(', '):'N/A';return{name:`Target ${point.label}`,color:point.vertexColor||'#aaa',rgb:'RGB: '+rgb,targetXYZ:'Target XYZ: '+xyz(point.target),targetYxy:'Target Yxy: '+yxy(point.target),actualXYZ:'Actual XYZ: N/A',actualYxy:'Actual Yxy: N/A',extra:chartPointText(panel,point)}}
 if(point.targetWhite)return{name:point.profile||'Target',color:Number.isInteger(point.profileIndex)&&point.profileIndex>=0?profileColor(point.profileIndex):'#aaa',rgb:'RGB: N/A',targetXYZ:'Target XYZ: '+xyz(point.target),targetYxy:'Target Yxy: '+yxy(point.target),actualXYZ:'Actual XYZ: N/A',actualYxy:'Actual Yxy: N/A',extra:chartPointText(panel,point)};
 const profile=profiles[point.profileIndex],q=point.q;
 const rgb=Number.isFinite(point.r)&&Number.isFinite(point.g)&&Number.isFinite(point.b)?[point.r,point.g,point.b]:q?[q.r,q.g,q.b]:null;
 let actual=point.actualXYZ||(q?[q.X,q.Y,q.Z]:null),target=point.target;
 if(panel.type==='eotf'||panel.type==='balance'){
  actual=q?[q.X,q.Y,q.Z]:actual;
  if(q&&profile){const {min,max}=targetLuminanceRange(profile),y=min+(max-min)*targetEncodedToLinear(q.r,min,max);target=targetNeutralXYZ(y,profile)}
 }
 const rgbText=rgb?rgb.map(value=>Math.round(value*255)).join(', '):'N/A';
 return{name:point.profile||'N/A',color:profileColor(point.profileIndex),rgb:'RGB: '+rgbText,targetXYZ:'Target XYZ: '+xyz(target),targetYxy:'Target Yxy: '+yxy(target),actualXYZ:'Actual XYZ: '+xyz(actual),actualYxy:'Actual Yxy: '+yxy(actual),extra:chartPointText(panel,point)}
}
function showChartHover(panel,event) {
 if(panel.drag){hideChartHover();return}
 const local=chartPointerPosition(panel,event),point=nearestChartPoint(panel,local.x,local.y);
 if(!point){panel.hoveredPoint=null;if(chartHover?.panel===panel)chartHover.panel=null;hideChartHover();return}
 if(chartHover.panel&&chartHover.panel!==panel)chartHover.panel.hoveredPoint=null;
 panel.hoveredPoint=point;chartHover.panel=panel;
 if(!point.targetVertex){previewTargetMeasured(point.profileIndex,'chart');locateFile(point.profileIndex,'chart')}
 for(const candidatePanel of chartPanels){
  if(!candidatePanel.hoverRing)continue;
  const matches=candidatePanel===panel?[point]:point.q?candidatePanel.points.filter(candidate=>candidate.profileIndex===point.profileIndex&&candidate.q===point.q):[];
  const match=matches.find(candidate=>!candidatePanel.article.hidden&&candidatePanel.type);
  if(!match){candidatePanel.hoverRing.hidden=true;continue}
  const bounds=candidatePanel.canvas.getBoundingClientRect(),ring=candidatePanel.hoverRing;
  ring.style.left=(bounds.left+match.px*bounds.width/candidatePanel.canvas.clientWidth)+'px';ring.style.top=(bounds.top+match.py*bounds.height/candidatePanel.canvas.clientHeight)+'px';ring.hidden=false;
 }
 chartHover.ring.hidden=true;
 chartHover.hoverData=chartPointPatch(panel,point);paintPatch(chartHover.hoverData);
}
function bindChartPointerEvents(panel) {
 const canvas=panel.canvas;
 canvas.addEventListener('contextmenu',event=>showChartPointMenu(panel,event));
 canvas.addEventListener('wheel',event=>{
  if(!panel.type)return;
  event.preventDefault();const p=chartPointerPosition(panel,event);
  zoomChartPanel(panel,p.x,p.y,event.deltaY);renderChartPanel(panel);
 },{passive:false});
 canvas.addEventListener('pointerdown',event=>{
  if(!panel.type)return;
  if(event.button!==0||panel.drag)return;
  event.preventDefault();const p=chartPointerPosition(panel,event);
  const graph3d=panel.type==='graph3d',camera=graph3d?panel.state.camera:null;
  const hoveredNode=graph3d&&event.altKey?nearestChartPoint(panel,p.x,p.y):null;
  const mode=graph3d&&(event.metaKey||event.ctrlKey)?'pan':hoveredNode?.world3D?'orbit-point':'rotate';
  panel.drag={pointerId:event.pointerId,x:p.x,y:p.y,moved:false,mode,orbitPoint:mode==='orbit-point'?{screen:{px:hoveredNode.px,py:hoveredNode.py},world:[...hoveredNode.world3D]}:null,view:{...panel.state.view},camera:camera?{...camera}:null};
  hideChartHover();
  canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
 });
 canvas.addEventListener('pointermove',event=>{
  if(!panel.drag){showChartHover(panel,event);return}
  if(event.pointerId!==panel.drag.pointerId)return;
  const p=chartPointerPosition(panel,event),dx=p.x-panel.drag.x,dy=p.y-panel.drag.y;
  if(Math.hypot(dx,dy)>3)panel.drag.moved=true;
  if(panel.drag.moved){
   if(panel.type==='graph3d'){
    const camera=panel.state.camera,start=panel.drag.camera;
    if(panel.drag.mode==='pan'){camera.panX=start.panX+dx;camera.panY=start.panY+dy}
    else{
     camera.yaw=start.yaw+dx*.01;camera.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,start.pitch+dy*.01));
     if(panel.drag.mode==='orbit-point'){
      const frame=panel.plot,mode=panel.state.coordinateMode,aMax=mode==='uvY'?.6:.9,bMax=mode==='uvY'?.7:.8;
      let maxY=0;forEachVisibleProfileBackToFront(profile=>{const targetMax=targetLuminanceRange(profile).max;if(Number.isFinite(targetMax))maxY=Math.max(maxY,targetMax)},panel);
      maxY=maxY>0?maxY:targetLuminanceRange(null).max||1;
      const [a,Y,b]=panel.drag.orbitPoint.world,x=(a/aMax-.5)*2,y=(Y/maxY-.5)*2,z=(b/bMax-.5)*2;
      const cyaw=Math.cos(camera.yaw),syaw=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
      const rz=-x*syaw+z*cyaw,rx=x*cyaw+z*syaw,ry=y*cp-rz*sp,scale=Math.min(frame.w,frame.h)*.31*(camera.zoom||1);
      camera.panX=panel.drag.orbitPoint.screen.px-(frame.x+frame.w/2)-rx*scale;
      camera.panY=panel.drag.orbitPoint.screen.py-(frame.y+frame.h/2)+ry*scale;
     }
    }
   }else panChartPanel(panel,panel.drag.view,dx,dy);
   renderChartPanel(panel)
  }
 });
 const finish=event=>{
  if(!panel.drag||panel.drag.pointerId!==event.pointerId)return;
  const wasClick=!panel.drag.moved,p=chartPointerPosition(panel,event);
  panel.drag=null;canvas.style.cursor=panel.type==='graph3d'?'grab':'default';
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(wasClick){
   const point=nearestChartPoint(panel,p.x,p.y);
   if(point){chartHover.pinnedData=chartPointPatch(panel,point);chartHover.hoverData=null}
   hideChartHover();
  }else hideChartHover();
 };
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,finish);
 canvas.addEventListener('pointerleave',()=>{if(chartHover?.panel===panel)chartHover.panel=null;panel.hoveredPoint=null;hideChartHover()});
 canvas.addEventListener('dblclick',event=>{if(!panel.type)return;event.preventDefault();hideChartHover();panel.state.view=initialChartView(panel.type,panel.state);if(panel.type==='graph3d')panel.state.camera={yaw:1.15,pitch:.31,panX:0,panY:-18,zoom:1.16};renderChartPanel(panel)});
}
function closeChartMenus() {
 for(const panel of chartPanels){panel.menu.hidden=true;panel.menuButton.setAttribute('aria-expanded','false')}
}
function updateChartPanelControls(panel) {
 panel.title.textContent=chartDefinitions.find(item=>item.id===panel.type)?.label||'Chart';
 panel.canvas.style.cursor=panel.type==='graph3d'?'grab':'default';
 panel.canvas.title=panel.type==='graph3d'?'Drag to rotate · Alt/Option-drag on a node to orbit around it · Command/Control-drag to move':'';
 panel.canvas.setAttribute('aria-label',`${panel.title.textContent} chart, panel ${panel.slotIndex+1}`);
 panel.controls.replaceChildren();
 const button=(text,next,change)=>{
  const control=document.createElement('button');control.type='button';control.textContent=text;control.title='Switch to '+next;
  control.onclick=()=>{hideChartHover();change();updateChartPanelControls(panel);renderChartPanel(panel);updateChartLegend()};panel.controls.append(control);
 };
 const state=panel.state;
 if(panel.type==='eotf')button(state.relative?'Relative':'Absolute',state.relative?'Absolute':'Relative',()=>{state.relative=!state.relative});
 if(panel.type==='balance')button(state.absolute?'Absolute Error':'Normalized',state.absolute?'Normalized':'Absolute Error',()=>{state.absolute=!state.absolute});
 if(panel.type==='cie'){
  button(state.coordinateMode,state.coordinateMode==='xy'?'uv':'xy',()=>{state.coordinateMode=state.coordinateMode==='xy'?'uv':'xy';state.view=initialChartView(panel.type,state)});
  button(state.allPoints?'All points':'Gamut only',state.allPoints?'Gamut only':'All points',()=>{state.allPoints=!state.allPoints});
 }
 if(panel.type==='graph3d')button(state.coordinateMode,state.coordinateMode==='xyY'?'uvY':'xyY',()=>{state.coordinateMode=state.coordinateMode==='xyY'?'uvY':'xyY';state.camera={yaw:1.15,pitch:.31,panX:0,panY:-18,zoom:1.16}});
 if(panel.type==='graph3d')button(state.allPoints?'All points':'Gamut only',state.allPoints?'Gamut only':'All points',()=>{state.allPoints=!state.allPoints});
 if(panel.type==='deltae')button(state.distribution?'Distribution':'Grayscale',state.distribution?'Grayscale':'Distribution',()=>{state.distribution=!state.distribution;state.view=initialChartView(panel.type,state)});
 for(const item of panel.menu.children){if(item.dataset.chartType)item.setAttribute('aria-checked',String(item.dataset.chartType===panel.type));else item.removeAttribute('aria-checked')}
 panel.colorModeButton.textContent=useProfileColors(panel)?'Set to multi color':'Set to mono color';
 panel.colorModeButton.title=panel.colorModeButton.textContent;
 panel.colorModeButton.setAttribute('aria-checked',String(useProfileColors(panel)));
 const hiddenCount=[...panel.selectedProfiles].filter(index=>hiddenProfiles.has(index)&&!panel.localShownProfiles.has(index)).length;
 panel.showAllButton.textContent=`Show hidden (${hiddenCount})`;panel.showAllButton.disabled=hiddenCount===0;
 panel.clearSelectionButton.disabled=panel.selectedProfiles.size===0;
 panel.clearSelectionButton.textContent='Clear bcs';
}
function selectPanelChart(panel,type) {
 if(!chartDefinitions.some(item=>item.id===type))return;
 hideChartHover();panel.type=type;
 if(!panel.states.has(type))panel.states.set(type,createChartState(type));
 panel.state=panel.states.get(type);updateChartPanelControls(panel);renderChartPanel(panel);updateChartLegend();
}
function resetChartsForProfiles() {
 hideChartHover();
 for(const panel of chartPanels){
  panel.selectedProfiles.clear();
  panel.localShownProfiles.clear();
  const cie=panel.states.get('cie');if(cie)cie.allPoints=true;
  const delta=panel.states.get('deltae');if(delta?.distribution)delta.view=initialChartView('deltae',delta);
  updateChartPanelControls(panel);
 }
}
function updateProfileChartAssignments() {
 $('profiles').querySelectorAll('.profile-item').forEach(item=>{
  const index=Number(item.dataset.profileIndex),count=activeChartPanels().filter(panel=>panel.selectedProfiles.has(index)).length;
  item.classList.toggle('in-chart',count>0);
  item.title=profiles[index].name+(isMeasuredProfile(profiles[index])?(count?` · Displayed in ${count} chart${count===1?'':'s'}`:' · Drag onto a chart to display'):' · Drag onto Target to apply colour space settings');
 });
}
function initializeChartPanels() {
 const host=$('chartSlots');host.replaceChildren();
 const ring=document.createElement('div');
 ring.className='chart-hover-ring';ring.hidden=true;document.body.append(ring);chartHover={ring,fields:{name:$('patchName'),nameDot:$('patchNameDot'),rgb:$('patchRgb'),targetXYZ:$('patchTargetXYZ'),targetYxy:$('patchTargetYxy'),actualXYZ:$('patchActualXYZ'),actualYxy:$('patchActualYxy'),extra:$('patchExtra')},hoverData:null,pinnedData:null,panel:null};
 const pointMenu=document.createElement('div'),hidePointButton=document.createElement('button');
 pointMenu.className='chart-point-menu';pointMenu.hidden=true;hidePointButton.type='button';pointMenu.append(hidePointButton);document.body.append(pointMenu);chartPointMenu=pointMenu;
 Array.from({length:16},(_,index)=>({definition:Math.floor(index/4)<2&&index%4<2?chartDefinitions.find(item=>item.id===initialChartTypes[Math.floor(index/4)*2+index%4]):null,index})).forEach(({definition,index})=>{
  const article=document.createElement('article');article.className='chart-slot';article.dataset.slot=String(index);article.dataset.chartId=String(index+1);
  const row=Math.floor(index/4),column=index%4;article.style.gridColumn=String(column+1);article.style.gridRow=String(row+1);article.style.setProperty('--chart-slot-order',String(row*chartColumnCount+column+1));
  const heading=document.createElement('h2');heading.className='chart-heading';
  const title=document.createElement('span');title.className='chart-title';
  const controls=document.createElement('span');controls.className='chart-controls';
  const wrap=document.createElement('span');wrap.className='chart-menu-wrap';
  const menuButton=document.createElement('button');menuButton.type='button';menuButton.className='chart-menu-button';menuButton.textContent='…';menuButton.title='Click to change chart; drag to swap charts';menuButton.draggable=!window.__viewerReadOnlyReport;menuButton.setAttribute('aria-label',`Change chart in panel ${index+1}`);menuButton.setAttribute('aria-haspopup','menu');menuButton.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='chart-menu chart-menu-floating';menu.hidden=true;menu.id=`chart-menu-${index+1}`;menu.setAttribute('role','menu');menuButton.setAttribute('aria-controls',menu.id);
  const canvas=document.createElement('canvas');canvas.id=`chart-panel-${index+1}`;
  const targetWarning=document.createElement('div');targetWarning.className='chart-target-warning';targetWarning.textContent='Target incomplete';targetWarning.setAttribute('role','status');targetWarning.hidden=true;
  const showAllButton=document.createElement('button');showAllButton.type='button';showAllButton.textContent='Show hidden (0)';showAllButton.className='chart-menu-clear';showAllButton.setAttribute('role','menuitem');showAllButton.disabled=true;
  const clearSelectionButton=document.createElement('button');clearSelectionButton.type='button';clearSelectionButton.textContent='Clear bcs';clearSelectionButton.className='chart-menu-clear';clearSelectionButton.setAttribute('role','menuitem');clearSelectionButton.disabled=true;
  clearSelectionButton.hidden=Boolean(window.__viewerReadOnlyReport);
  const colorModeButton=document.createElement('button');colorModeButton.type='button';colorModeButton.setAttribute('role','menuitemcheckbox');colorModeButton.className='chart-menu-clear';
  const hoverRing=document.createElement('div');hoverRing.className='chart-hover-ring';hoverRing.hidden=true;document.body.append(hoverRing);
  const state=definition?createChartState(definition.id):null,panel={id:index+1,slotIndex:index,type:definition?.id||null,state,states:definition?new Map([[definition.id,state]]):new Map(),colorMode:'channels',selectedProfiles:new Set(),localShownProfiles:new Set(),canvas,targetWarning,title,controls,menu,menuButton,colorModeButton,showAllButton,clearSelectionButton,points:[],plot:null,clip:null,drag:null,article,hoverRing};
  chartPanels.push(panel);
  for(const choice of chartDefinitions){
  const option=document.createElement('button');option.type='button';option.textContent=choice.label;option.dataset.chartType=choice.id;option.setAttribute('role','menuitemradio');
  option.hidden=Boolean(window.__viewerReadOnlyReport);
   option.onclick=()=>{closeChartMenus();selectPanelChart(panel,choice.id);menuButton.focus()};menu.append(option);
  }
  colorModeButton.onclick=()=>{panel.colorMode=useProfileColors(panel)?'channels':'profiles';closeChartMenus();updateChartPanelControls(panel);renderChartPanel(panel);updateChartLegend();menuButton.focus()};menu.append(colorModeButton);
  showAllButton.onclick=()=>{
   for(const profileIndex of panel.selectedProfiles)if(hiddenProfiles.has(profileIndex))panel.localShownProfiles.add(profileIndex);
   closeChartMenus();updateChartPanelControls(panel);renderChartPanel(panel);updateChartLegend();updateProfileChartAssignments();
  };menu.append(showAllButton);
  clearSelectionButton.onclick=()=>{if(window.__viewerReadOnlyReport)return;panel.selectedProfiles.clear();panel.localShownProfiles.clear();closeChartMenus();updateChartPanelControls(panel);renderChartPanel(panel);updateProfileChartAssignments();updateChartLegend()};menu.append(clearSelectionButton);
  menuButton.onclick=()=>{if(suppressChartMenuClick)return;const opening=menu.hidden;closeChartMenus();if(opening){
   menu.hidden=false;menuButton.setAttribute('aria-expanded','true');
   const anchor=menuButton.getBoundingClientRect(),bounds=menu.getBoundingClientRect(),gap=4;
   menu.style.left=`${Math.max(8,Math.min(anchor.right-bounds.width,window.innerWidth-bounds.width-8))}px`;
   menu.style.top=`${Math.max(8,Math.min(anchor.bottom+gap,window.innerHeight-bounds.height-8))}px`;
   (menu.querySelector('[aria-checked="true"]:not([hidden])')||menu.querySelector('button:not([hidden])')).focus();
  }};
  menuButton.addEventListener('dragstart',event=>{
   if(window.__viewerReadOnlyReport){event.preventDefault();return}
   closeChartMenus();draggingChartId=panel.id;suppressChartMenuClick=true;
   event.dataTransfer.setData(CHART_DRAG_TYPE,String(panel.id));
   event.dataTransfer.effectAllowed='move';article.classList.add('chart-drag-source');
  });
  menuButton.addEventListener('dragend',()=>{
   draggingChartId=null;document.querySelectorAll('.chart-slot.chart-drag-source,.chart-slot.chart-swap-target').forEach(item=>item.classList.remove('chart-drag-source','chart-swap-target'));
   setTimeout(()=>{suppressChartMenuClick=false},0);
  });
  menu.addEventListener('keydown',event=>{
   const items=[...menu.children].filter(item=>!item.disabled&&!item.hidden),current=items.indexOf(document.activeElement);
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(current+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus()}
   if(event.key==='Escape'){event.preventDefault();closeChartMenus();menuButton.focus()}
  });
  wrap.append(menuButton);document.body.append(menu);heading.append(title,controls,wrap);article.append(heading,canvas,targetWarning);host.append(article);observeChartPanelSize(panel);
  article.addEventListener('dblclick',event=>{
   if(event.target.closest('canvas,button,select,input,.chart-menu'))return;
   event.preventDefault();toggleSingleChart(panel);
  });
  article.addEventListener('dragenter',event=>{
   if(window.__viewerReadOnlyReport&&[...(event.dataTransfer?.types||[])].some(type=>type==='application/x-bcs-profile-index'||type==='application/x-bcs-profile-indices')){event.preventDefault();event.stopPropagation();return}
   if(event.dataTransfer?.types.includes(CHART_DRAG_TYPE)){if(draggingChartId!==panel.id)article.classList.add('chart-swap-target');return}
   if(event.dataTransfer?.types.includes('text/plain'))article.classList.add('drop-active');
  });
  article.addEventListener('dragover',event=>{
   if(window.__viewerReadOnlyReport&&[...(event.dataTransfer?.types||[])].some(type=>type==='application/x-bcs-profile-index'||type==='application/x-bcs-profile-indices')){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='none';return}
   if(event.dataTransfer?.types.includes(CHART_DRAG_TYPE)){
    if(draggingChartId!==null&&draggingChartId!==panel.id){event.preventDefault();event.dataTransfer.dropEffect='move';article.classList.add('chart-swap-target')}
    return;
   }
   if(event.dataTransfer?.types.includes('text/plain')){event.preventDefault();event.dataTransfer.dropEffect='copy';article.classList.add('drop-active')}
  });
  article.addEventListener('dragleave',event=>{if(!article.contains(event.relatedTarget))article.classList.remove('drop-active','chart-swap-target')});
  article.addEventListener('drop',event=>{
   if(window.__viewerReadOnlyReport&&[...(event.dataTransfer?.types||[])].some(type=>type==='application/x-bcs-profile-index'||type==='application/x-bcs-profile-indices')){event.preventDefault();event.stopPropagation();return}
   if(event.dataTransfer?.types.includes(CHART_DRAG_TYPE)){
    event.preventDefault();article.classList.remove('chart-swap-target');
    if(!window.__viewerReadOnlyReport&&draggingChartId!==null&&draggingChartId!==panel.id)swapChartPanels(chartPanels[draggingChartId-1],panel);
    return;
   }
   event.preventDefault();article.classList.remove('drop-active');
   const packed=event.dataTransfer.getData('application/x-bcs-profile-indices');let indices=[];
   try{indices=packed?JSON.parse(packed):[]}catch{}
   if(!Array.isArray(indices)||!indices.length){const raw=event.dataTransfer.getData('application/x-bcs-profile-index')||event.dataTransfer.getData('text/plain');indices=[Number(raw)]}
   indices=[...new Set(indices)].filter(profileIndex=>Number.isInteger(profileIndex)&&profiles[profileIndex]&&isMeasuredProfile(profiles[profileIndex]));
   if(!indices.length||!panel.type)return;
   indices.forEach(profileIndex=>{if(hiddenProfiles.has(profileIndex))panel.localShownProfiles.add(profileIndex);else panel.localShownProfiles.delete(profileIndex);panel.selectedProfiles.add(profileIndex)});hoveredProfileIndex=-1;
   updateChartPanelControls(panel);renderChartPanel(panel);updateChartLegend();
   updateProfileChartAssignments();
  });
  updateChartPanelControls(panel);bindChartPointerEvents(panel);
 });
 applyChartPanelVisibility();
 host.addEventListener('scroll',closeChartMenus,{passive:true});
 window.addEventListener('resize',closeChartMenus);
 const isChartMenuInteraction=event=>event.target.closest('.chart-menu-wrap,.chart-menu-floating');
 document.addEventListener('pointerdown',event=>{if(!isChartMenuInteraction(event))closeChartMenus()},true);
 document.addEventListener('focusin',event=>{if(!isChartMenuInteraction(event))closeChartMenus()},true);
 document.addEventListener('contextmenu',event=>{if(!isChartMenuInteraction(event))closeChartMenus()},true);
 document.addEventListener('click',event=>{if(!event.target.closest('.chart-menu-wrap'))closeChartMenus();if(!event.target.closest('.chart-point-menu'))closeChartPointMenu()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeChartMenus();closeChartPointMenu()}});
 addEventListener('scroll',hideChartHover,true);
}
