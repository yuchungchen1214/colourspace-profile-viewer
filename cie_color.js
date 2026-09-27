function cieLab(xyz,p){
  const white=targetWhiteXyzAtLuma(targetLuminanceRange(p).max,p);
  // Legacy rounded Lab constants for ColourSpace display compatibility.
  // Empirical: matches all 24 supplied official samples across two BCS files.
  // This is not a claim about ColourSpace's unpublished implementation.
  // Rounded form is documented in US8103491B2, equation 15.
  const f=xyz.map((v,i)=>{const t=v/white[i];return t>0.008856?Math.cbrt(t):7.787*t+0.13793});
  return [116*f[1]-16,500*(f[0]-f[1]),200*(f[1]-f[2])];
}
// CIEDE2000, kL=kC=kH=1. Reference: Sharma, Wu & Dalal (2005).
function cieDE2000(a,b){
  const rad=Math.PI/180,cos=d=>Math.cos(d*rad),sin=d=>Math.sin(d*rad);
  const c1=Math.hypot(a[1],a[2]),c2=Math.hypot(b[1],b[2]),cb=(c1+c2)/2;
  const g=.5*(1-Math.sqrt(cb**7/(cb**7+25**7)));
  const ap1=(1+g)*a[1],ap2=(1+g)*b[1],cp1=Math.hypot(ap1,a[2]),cp2=Math.hypot(ap2,b[2]);
  const hue=(aa,bb)=>aa===0&&bb===0?0:(Math.atan2(bb,aa)/rad+360)%360;
  const h1=hue(ap1,a[2]),h2=hue(ap2,b[2]),dl=b[0]-a[0],dc=cp2-cp1;
  let dh=h2-h1;
  if(cp1*cp2===0)dh=0;else if(dh>180)dh-=360;else if(dh< -180)dh+=360;
  const dH=2*Math.sqrt(cp1*cp2)*sin(dh/2),lb=(a[0]+b[0])/2,cp=(cp1+cp2)/2;
  let hb=h1+h2;
  if(cp1*cp2!==0)hb=Math.abs(h1-h2)<=180?hb/2:hb<360?(hb+360)/2:(hb-360)/2;
  const t=1-.17*cos(hb-30)+.24*cos(2*hb)+.32*cos(3*hb+6)-.20*cos(4*hb-63);
  const sl=1+.015*(lb-50)**2/Math.sqrt(20+(lb-50)**2),sc=1+.045*cp,sh=1+.015*cp*t;
  const rt=-2*Math.sqrt(cp**7/(cp**7+25**7))*sin(60*Math.exp(-(((hb-275)/25)**2)));
  const l=dl/sl,c=dc/sc,h=dH/sh;
  return Math.sqrt(Math.max(0,l*l+c*c+h*h+rt*c*h));
}
const cieMetricsCache=new WeakMap();
function cieMetrics(q,p){
  let cache=cieMetricsCache.get(p);
  if(!cache||cache.target!==TARGET_CONFIG){cache={target:TARGET_CONFIG,points:new WeakMap()};cieMetricsCache.set(p,cache)}
  if(cache.points.has(q))return cache.points.get(q);
  const target=targetXYZ(q,p);
  const de=cieDE2000(cieLab([q.X,q.Y,q.Z],p),cieLab(target,p));
  const result={target,de,color:!Number.isFinite(de)?'#777':de<1?'#35c759':de<2.3?'#ff9500':'#ff3b30'};
  cache.points.set(q,result);return result;
}
