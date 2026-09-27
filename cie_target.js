// Target XYZ model rebuilt from the target colour-space definition.
// No BCS-specific measured XYZ values are used here.
// Preserve target chromaticity while mapping relative Y to this profile's luma range.
// Validated against two independent BCS screenshot sets; no fitted primary values.
function targetXYZ(q,p){
  if(!targetConfigurationIsValid(p))return[NaN,NaN,NaN];
  const {min:lmin,max:lmax}=targetLuminanceRange(p);
  if(!Number.isFinite(lmin)||!Number.isFinite(lmax)||lmin<0||lmax<=lmin)
    throw new Error('Invalid BCS target luminance range');
  const rgb=[q.r,q.g,q.b];
  if(!rgb.every(v=>Number.isFinite(v)&&v>=0&&v<=1))
    throw new Error('Invalid normalized BCS stimulus');
  const neutral=luma=>targetNeutralXYZ(luma,p);
  if(rgb.every(v=>v===0))return neutral(lmin);
  if(rgb.every(v=>v===1))return neutral(lmax);
  const linear=rgb.map(value=>targetEncodedToLinear(value,lmin,lmax));
  const whitePoint=targetWhitePointForProfile(p),{rgbToXyz}=safeTargetMatrices(TARGET_CONFIG.gamut,whitePoint);
  if(!rgbToXyz)return[NaN,NaN,NaN];
  const base=rgbToXyz.map(row=>row.reduce((sum,v,i)=>sum+v*linear[i],0));
  const Y=lmin+(lmax-lmin)*base[1],scale=Y/base[1];
  return [base[0]*scale,Y,base[2]*scale];
}
