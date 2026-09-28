// The single source of truth for the active measurement target.
// Target gamut, white point and EOTF are independently selectable.
const TARGET_GAMUTS=Object.freeze({
  srgbRec709:Object.freeze({name:'sRGB / Rec.709',primaries:Object.freeze({R:Object.freeze([.64,.33]),G:Object.freeze([.30,.60]),B:Object.freeze([.15,.06])})}),
  adobeRgb:Object.freeze({
    name:'Adobe RGB',
    // Adobe RGB (1998) chromaticities: adobe.com/digitalimag/pdfs/AdobeRGB1998.pdf
    primaries:Object.freeze({R:Object.freeze([.64,.33]),G:Object.freeze([.21,.71]),B:Object.freeze([.15,.06])})
  }),
  p3:Object.freeze({name:'P3',primaries:Object.freeze({R:Object.freeze([.68,.32]),G:Object.freeze([.265,.69]),B:Object.freeze([.15,.06])})}),
  rec2020:Object.freeze({name:'Rec. 2020',primaries:Object.freeze({R:Object.freeze([.708,.292]),G:Object.freeze([.170,.797]),B:Object.freeze([.131,.046])})})
});
const TARGET_WHITE_POINTS=Object.freeze({
  d50:Object.freeze({name:'D50',x:.3457,y:.3585}),
  d65:Object.freeze({name:'D65',x:.3127,y:.3290}),
  dci:Object.freeze({name:'DCI',x:.314,y:.351})
});
const DEFAULT_CUSTOM_GAMUT=Object.freeze({name:'Custom',primaries:Object.freeze({R:Object.freeze([.64,.33]),G:Object.freeze([.30,.60]),B:Object.freeze([.15,.06])})});
const DEFAULT_CUSTOM_WHITE_POINT=Object.freeze({name:'Custom',x:.3127,y:.3290});
const TARGET_EOTFS=Object.freeze({
  gamma22:Object.freeze({type:'gamma',gamma:2.2,label:'Gamma 2.2'}),
  gamma24:Object.freeze({type:'gamma',gamma:2.4,label:'Gamma 2.4'}),
  gamma26:Object.freeze({type:'gamma',gamma:2.6,label:'Gamma 2.6'}),
  srgb:Object.freeze({type:'srgb',label:'sRGB'}),
  bt1886:Object.freeze({type:'bt1886',gamma:2.404,label:'BT.1886'})
});
const DEFAULT_CUSTOM_EOTF=Object.freeze({type:'gamma',gamma:2.2,label:'Custom Gamma'});
let TARGET_CONFIG=Object.freeze({
  gamutId:'srgbRec709',
  gamut:TARGET_GAMUTS.srgbRec709,
  customGamut:DEFAULT_CUSTOM_GAMUT,
  whitePointId:'d65',
  whitePoint:TARGET_WHITE_POINTS.d65,
  customWhitePoint:DEFAULT_CUSTOM_WHITE_POINT,
  eotfId:'gamma22',
  eotf:TARGET_EOTFS.gamma22,
  customEotf:DEFAULT_CUSTOM_EOTF,
  luminance:Object.freeze({
    ymax:Object.freeze({mode:'measured',value:null}),
    ymin:Object.freeze({mode:'measured',value:null})
  })
});

function targetInvertMatrix3(a){
  const d=a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
  if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw new Error('Target primaries do not define an invertible colour space');
  return [[(a[1][1]*a[2][2]-a[1][2]*a[2][1])/d,(a[0][2]*a[2][1]-a[0][1]*a[2][2])/d,(a[0][1]*a[1][2]-a[0][2]*a[1][1])/d],[(a[1][2]*a[2][0]-a[1][0]*a[2][2])/d,(a[0][0]*a[2][2]-a[0][2]*a[2][0])/d,(a[0][2]*a[1][0]-a[0][0]*a[1][2])/d],[(a[1][0]*a[2][1]-a[1][1]*a[2][0])/d,(a[0][1]*a[2][0]-a[0][0]*a[2][1])/d,(a[0][0]*a[1][1]-a[0][1]*a[1][0])/d]];
}
function targetRgbToXyzMatrix(gamut=TARGET_CONFIG.gamut,whitePoint=TARGET_CONFIG.whitePoint){
  const {R,G,B}=gamut.primaries,{x,y}=whitePoint,z=xy=>1-xy[0]-xy[1];
  const p=[[R[0]/R[1],G[0]/G[1],B[0]/B[1]],[1,1,1],[z(R)/R[1],z(G)/G[1],z(B)/B[1]]];
  const white=[x/y,1,(1-x-y)/y],inv=targetInvertMatrix3(p);
  const scale=inv.map(row=>row.reduce((sum,value,index)=>sum+value*white[index],0));
  return p.map(row=>row.map((value,index)=>value*scale[index]));
}
let TARGET_RGB_TO_XYZ=targetRgbToXyzMatrix();
let TARGET_XYZ_TO_RGB=targetInvertMatrix3(TARGET_RGB_TO_XYZ);
function safeTargetMatrices(gamut,whitePoint){
  try{const rgbToXyz=targetRgbToXyzMatrix(gamut,whitePoint);return{rgbToXyz,xyzToRgb:targetInvertMatrix3(rgbToXyz)}}
  catch{return{rgbToXyz:null,xyzToRgb:null}}
}
function targetConfigurationIsValid(profile=null){
  const validPrimary=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite);
  if(!['R','G','B'].every(channel=>validPrimary(TARGET_CONFIG.gamut.primaries[channel])))return false;
  const white=TARGET_CONFIG.whitePoint;
  if(!Number.isFinite(white?.x)||!Number.isFinite(white?.y)||white.y<=0)return false;
  if(TARGET_CONFIG.eotf.type==='gamma'&&(!Number.isFinite(TARGET_CONFIG.eotf.gamma)||TARGET_CONFIG.eotf.gamma<=0))return false;
  const measured=typeof profiles!=='undefined'?profiles.filter(item=>item.points?.length):[];
  let checked;
  if(profile)checked=[profile];
  else if(TARGET_CONFIG.whitePointId==='measured'&&typeof activeChartPanels==='function'){
    const used=new Set();for(const panel of activeChartPanels())for(const index of panel.selectedProfiles||[])if(profiles[index]&&(profileVisible(index)||panel.localShownProfiles?.has(index)))used.add(index);
    checked=[...used].map(index=>profiles[index]);
  }else checked=measured.length?measured:[null];
  if(!checked.length&&['ymin','ymax'].some(kind=>TARGET_CONFIG.luminance[kind].mode==='measured'))return true;
  return checked.every(item=>(TARGET_CONFIG.whitePointId!=='measured'||Boolean(measuredProfileWhitePoint(item)))&&isValidTargetLuminanceRange(targetLuminanceRange(item)));
}
function selectTargetSettings({gamutId=TARGET_CONFIG.gamutId,whitePointId=TARGET_CONFIG.whitePointId,eotfId=TARGET_CONFIG.eotfId}={}){
  if(gamutId!=='custom'&&!Object.prototype.hasOwnProperty.call(TARGET_GAMUTS,gamutId))throw new Error('Unknown target gamut');
  if(whitePointId!=='custom'&&whitePointId!=='measured'&&!Object.prototype.hasOwnProperty.call(TARGET_WHITE_POINTS,whitePointId))throw new Error('Unknown target white point');
  if(eotfId!=='custom'&&!Object.prototype.hasOwnProperty.call(TARGET_EOTFS,eotfId))throw new Error('Unknown target EOTF');
  if(gamutId===TARGET_CONFIG.gamutId&&whitePointId===TARGET_CONFIG.whitePointId&&eotfId===TARGET_CONFIG.eotfId)return;
  const previous=TARGET_CONFIG;
  const gamut=gamutId==='custom'?
    (previous.gamutId==='custom'?previous.gamut:Object.freeze({name:'Custom',primaries:Object.freeze(Object.fromEntries(['R','G','B'].map(channel=>[channel,Object.freeze([...previous.gamut.primaries[channel]])])))})):
    TARGET_GAMUTS[gamutId];
  const whitePoint=whitePointId==='measured'?previous.whitePoint:whitePointId==='custom'?
    (previous.whitePointId==='custom'?previous.whitePoint:Object.freeze({name:'Custom',x:previous.whitePoint.x,y:previous.whitePoint.y})):
    TARGET_WHITE_POINTS[whitePointId];
  const eotf=eotfId==='custom'?
    (previous.eotfId==='custom'?previous.eotf:Object.freeze({type:'gamma',gamma:previous.eotf.gamma??2.2,label:'Custom Gamma'})):
    TARGET_EOTFS[eotfId];
  const {rgbToXyz,xyzToRgb}=safeTargetMatrices(gamut,whitePoint);
  TARGET_CONFIG=Object.freeze({...previous,gamutId,gamut,customGamut:gamut,whitePointId,whitePoint,customWhitePoint:whitePoint,eotfId,eotf,customEotf:eotf});
  TARGET_RGB_TO_XYZ=rgbToXyz;
  TARGET_XYZ_TO_RGB=xyzToRgb;
}
function selectTargetGamut(id){selectTargetSettings({gamutId:id})}
function selectTargetWhitePoint(id){selectTargetSettings({whitePointId:id})}
function selectTargetEotf(id){selectTargetSettings({eotfId:id})}
function selectCustomTargetGamma(gamma){
  if(!Number.isFinite(gamma)||gamma<=0)throw new Error('Gamma must be greater than 0');
  const customEotf=Object.freeze({type:'gamma',gamma,label:'Custom Gamma'});
  TARGET_CONFIG=Object.freeze({...TARGET_CONFIG,eotfId:'custom',eotf:customEotf,customEotf});
}
function selectCustomTargetPrimaries(primaries){
  const copy={};
  for(const channel of ['R','G','B']){const pair=primaries[channel];if(!Array.isArray(pair)||pair.length!==2||!pair.every(Number.isFinite))throw new Error(`Invalid ${channel} primary`);copy[channel]=Object.freeze([pair[0],pair[1]])}
  const customGamut=Object.freeze({name:'Custom',primaries:Object.freeze(copy)}),whitePoint=TARGET_CONFIG.whitePoint;
  const {rgbToXyz,xyzToRgb}=safeTargetMatrices(customGamut,whitePoint);
  TARGET_CONFIG=Object.freeze({...TARGET_CONFIG,gamutId:'custom',gamut:customGamut,customGamut});TARGET_RGB_TO_XYZ=rgbToXyz;TARGET_XYZ_TO_RGB=xyzToRgb;
}
function selectCustomTargetWhitePoint(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||y<=0)throw new Error('White point values must be finite and y must be greater than 0');
  const customWhitePoint=Object.freeze({name:'Custom',x,y}),{rgbToXyz,xyzToRgb}=safeTargetMatrices(TARGET_CONFIG.gamut,customWhitePoint);
  TARGET_CONFIG=Object.freeze({...TARGET_CONFIG,whitePointId:'custom',whitePoint:customWhitePoint,customWhitePoint});TARGET_RGB_TO_XYZ=rgbToXyz;TARGET_XYZ_TO_RGB=xyzToRgb;
}
function selectTargetLuminance(kind,mode,value=null){
  if(!['ymax','ymin'].includes(kind))throw new Error('Unknown target luminance setting');
  if(!['measured','custom'].includes(mode))throw new Error('Unknown target luminance mode');
  if(mode==='custom'&&(!Number.isFinite(value)||value<0))throw new Error('Target luminance must be a valid non-negative number');
  const setting=Object.freeze({mode,value:mode==='custom'?value:null});
  TARGET_CONFIG=Object.freeze({...TARGET_CONFIG,luminance:Object.freeze({...TARGET_CONFIG.luminance,[kind]:setting})});
}
function measuredProfileWhitePoint(profile){
  const valid=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&point[0]>0&&point[1]>0&&point[0]+point[1]<1;
  const headPoint=profile?.headTarget?.whitePoint;
  if(valid(headPoint))return{name:'Measured',x:headPoint[0],y:headPoint[1]};
  const whites=(profile?.points||[]).filter(q=>Number.isFinite(q.r)&&Number.isFinite(q.g)&&Number.isFinite(q.b)&&Number.isFinite(q.X)&&Number.isFinite(q.Y)&&Number.isFinite(q.Z)&&q.r>=.999&&Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002&&q.X+q.Y+q.Z>1e-12).sort((a,b)=>b.r-a.r||b.Y-a.Y);
  const q=whites[0];if(!q)return null;
  const sum=q.X+q.Y+q.Z,x=q.X/sum,y=q.Y/sum;
  return Number.isFinite(x)&&Number.isFinite(y)&&x>0&&y>0&&x+y<1?{name:'Measured',x,y}:null;
}
function targetWhitePointForProfile(profile=null){
  if(TARGET_CONFIG.whitePointId!=='measured')return TARGET_CONFIG.whitePoint;
  return measuredProfileWhitePoint(profile);
}
function measuredProfileLuminanceRange(profile){
  const gray=(profile?.points||[]).filter(q=>Number.isFinite(q.r)&&Number.isFinite(q.g)&&Number.isFinite(q.b)&&Number.isFinite(q.Y)&&q.Y>=0&&Math.abs(q.r-q.g)<.002&&Math.abs(q.g-q.b)<.002).sort((a,b)=>a.r-b.r);
  if(!gray.length)return null;
  const black=gray.find(q=>q.r<=1e-6&&q.g<=1e-6&&q.b<=1e-6),white=[...gray].reverse().find(q=>q.r>=1-1e-6)||gray[gray.length-1];
  return{min:black?.Y??0,hasMin:Boolean(black),max:white.Y};
}
function targetLuminanceRange(profile,settings=TARGET_CONFIG.luminance){
  const measured=measuredProfileLuminanceRange(profile)||{min:0,max:1};
  return{
    min:settings.ymin.mode==='custom'?settings.ymin.value:measured.min,
    max:settings.ymax.mode==='custom'?settings.ymax.value:measured.max
  };
}
function isValidTargetLuminanceRange(range){return Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min>=0&&range.max>range.min}
function targetEncodedToLinear(value,min=0,max=1){
  const eotf=TARGET_CONFIG.eotf;
  if(eotf.type==='gamma')return eotf.gamma>0?value**eotf.gamma:NaN;
  if(eotf.type==='srgb')return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
  if(eotf.type==='bt1886'){
    const blackRatio=max>0?Math.max(0,Math.min(1,min/max)):0;
    const r=blackRatio**(1/eotf.gamma);
    return blackRatio>=1?value:Math.max(0,Math.min(1,(((1-r)*value+r)**eotf.gamma-blackRatio)/(1-blackRatio)));
  }
  throw new Error(`Unsupported target transfer function: ${eotf.type}`);
}
function targetNeutralXYZ(luma,profile=null){
  const whitePoint=targetWhitePointForProfile(profile);if(!whitePoint)return[NaN,NaN,NaN];
  const {x,y}=whitePoint;
  if(!(y>0))return[NaN,NaN,NaN];
  return [luma*x/y,luma,luma*(1-x-y)/y];
}
function targetEotf(value,min=0,max=1,relative=false){
  // Relative plots encoded stimulus; Absolute plots the already-linearized stimulus.
  return relative?targetEncodedToLinear(value,min,max):min/max+(1-min/max)*value;
}
function targetWhiteXyzAtLuma(luma,profile=null){return targetNeutralXYZ(luma,profile)}
