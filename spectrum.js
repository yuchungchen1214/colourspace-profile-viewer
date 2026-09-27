// CIE 1931 2° spectral locus, sampled every 5 nm from the CIE 2019 data table.
// Source: https://cie.co.at/datatable/cie-1931-chromaticity-coordinates-spectrum-loci-2-degree-observer
// The purple boundary is the straight closing segment between 700 and 360 nm.
const CIE_1931_SPECTRAL_XY=[
  [0.17556,0.00529],[0.17516,0.00526],[0.17482,0.00522],[0.17451,0.00518],
  [0.17411,0.00496],[0.17401,0.00498],[0.17380,0.00492],[0.17356,0.00492],
  [0.17334,0.00480],[0.17302,0.00478],[0.17258,0.00480],[0.17209,0.00483],
  [0.17141,0.00510],[0.17030,0.00579],[0.16888,0.00690],[0.16690,0.00855],
  [0.16441,0.01086],[0.16111,0.01379],[0.15664,0.01771],[0.15099,0.02274],
  [0.14396,0.02970],[0.13550,0.03988],[0.12412,0.05780],[0.10960,0.08684],
  [0.09129,0.13270],[0.06871,0.20072],[0.04539,0.29498],[0.02346,0.41270],
  [0.00817,0.53842],[0.00386,0.65482],[0.01387,0.75019],[0.03885,0.81202],
  [0.07430,0.83380],[0.11416,0.82621],[0.15472,0.80586],[0.19288,0.78163],
  [0.22962,0.75433],[0.26578,0.72432],[0.30160,0.69231],[0.33736,0.65885],
  [0.37310,0.62445],[0.40873,0.58961],[0.44406,0.55472],[0.47878,0.52020],
  [0.51249,0.48659],[0.54479,0.45443],[0.57515,0.42423],[0.60293,0.39650],
  [0.62704,0.37249],[0.64823,0.35140],[0.66576,0.33401],[0.68008,0.31975],
  [0.69151,0.30834],[0.70061,0.29930],[0.70792,0.29203],[0.71403,0.28593],
  [0.71903,0.28094],[0.72303,0.27695],[0.72599,0.27401],[0.72827,0.27173],
  [0.72997,0.27003],[0.73109,0.26891],[0.73199,0.26801],[0.73272,0.26728],
  [0.73342,0.26658],[0.73405,0.26595],[0.73439,0.26561],[0.73459,0.26541],
  [0.73469,0.26531]
];
const CIE_SPECTRUM_CACHE=new Map();

function cieSpectrumCoordinate([x,y],mode){
 if(mode==='xy')return{x,y};
 const denominator=-2*x+12*y+3;
 return{x:4*x/denominator,y:9*y/denominator};
}

function cieSpectrumToXy(x,y,mode){
 if(mode==='xy')return{x,y};
 const denominator=6*x-16*y+12;
 return denominator>0?{x:9*x/denominator,y:4*y/denominator}:{x:NaN,y:NaN};
}

function cieSpectrumColor(x,y,data,offset){
 if(!Number.isFinite(x)||!Number.isFinite(y)||y<=0||x<0||x+y>=1)return;
 const X=x/y,Z=(1-x-y)/y;
 const linear=[
  3.2406*X-1.5372-.4986*Z,
  -.9689*X+1.8758+.0415*Z,
  .0557*X-.2040+1.0570*Z
 ];
 const peak=Math.max(...linear);
 if(!(peak>0))return;
 const base=[52,54,56],strength=.15;
 for(let i=0;i<3;i++){
  const value=Math.max(0,linear[i])/peak;
  const encoded=value<=.0031308?12.92*value:1.055*value**(1/2.4)-.055;
  data[offset+i]=Math.round(base[i]*(1-strength)+255*encoded*strength);
 }
 data[offset+3]=255;
}

function cieSpectrumImage(mode){
 if(CIE_SPECTRUM_CACHE.has(mode))return CIE_SPECTRUM_CACHE.get(mode);
 const bounds=mode==='xy'?{xmax:.8,ymax:.9}:{xmax:.7,ymax:.6};
 const pixelsPerUnit=1000,width=Math.round(bounds.xmax*pixelsPerUnit),height=Math.round(bounds.ymax*pixelsPerUnit);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d'),image=context.createImageData(width,height),data=image.data;
 for(let row=0;row<height;row++){
  const y=bounds.ymax-(row+.5)/pixelsPerUnit;
  for(let column=0;column<width;column++){
   const x=(column+.5)/pixelsPerUnit,xy=cieSpectrumToXy(x,y,mode);
   cieSpectrumColor(xy.x,xy.y,data,(row*width+column)*4);
  }
 }
 context.putImageData(image,0,0);
 CIE_SPECTRUM_CACHE.set(mode,canvas);
 return canvas;
}
