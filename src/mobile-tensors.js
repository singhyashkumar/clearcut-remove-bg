// Match rembg's U2Netp preprocessing: stretch to 320px, divide RGB by
// the brightest RGB value, apply ImageNet normalization, and pack NCHW.
export const MOBILE_INPUT_SIZE = 320;
export function mobileInput(rgba) {
 const pixels = rgba.length / 4, result = new Float32Array(pixels * 3);
 let maximum = 1;
 for(let i=0;i<pixels;i++)for(let c=0;c<3;c++)maximum=Math.max(maximum,rgba[i*4+c]);
 const means=[.485,.456,.406],stds=[.229,.224,.225];
 for(let c=0;c<3;c++)for(let i=0;i<pixels;i++)result[c*pixels+i]=(rgba[i*4+c]/maximum-means[c])/stds[c];
 return result;
}
export function mobileMask(values) {
 let min=Infinity,max=-Infinity;
 for(const value of values){if(!Number.isFinite(value))throw new Error('The mobile model returned an invalid mask.');min=Math.min(min,value);max=Math.max(max,value);}
 const range=max-min,result=new Float32Array(values.length);
 for(let i=0;i<values.length;i++)result[i]=range>1e-7?(values[i]-min)/range:Math.max(0,Math.min(1,values[i]));
 return result;
}
