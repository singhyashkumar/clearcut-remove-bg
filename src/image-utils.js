export const MAX_BYTES = 20_000_000;
export const MAX_PIXELS = 25_000_000;
export async function validateFile(file) {
 if (!file || !file.size) throw new Error('Choose a non-empty JPG, PNG or WebP image.');
 if (file.size > MAX_BYTES) throw new Error('That photo is too large. Please choose a file under 20 MB.');
 const b = new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png = [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
 const jpg = b[0]===255 && b[1]===216 && b[2]===255;
 const webp = String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP';
 if (!(png || jpg || webp)) throw new Error('Unsupported file. Choose a real JPG, PNG or WebP image.');
}
export function alphaBounds(data,width,height) {
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(data[(y*width+x)*4+3]>4){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 return right<0?{x:0,y:0,width,height}:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}
export function brushAlpha(alpha, original, width, height, x, y, radius, restore) {
 for(let py=Math.max(0,Math.floor(y-radius));py<Math.min(height,Math.ceil(y+radius));py++)
  for(let px=Math.max(0,Math.floor(x-radius));px<Math.min(width,Math.ceil(x+radius));px++){
   const distance=Math.hypot(px-x,py-y);if(distance>radius)continue;
   const i=py*width+px, strength=Math.min(1,(radius-distance)/Math.max(1,radius*.15));
   alpha[i]=Math.round(alpha[i]+((restore?original[i]:0)-alpha[i])*strength);
  }
}
