type EncodeJpeg = (width: number, height: number, quality: number) => Promise<Blob>;

const MAX_QUALITY = 0.92;
const MIN_QUALITY = 0.4;

export async function fitJpeg(width: number, height: number, maxBytes: number, encode: EncodeJpeg, preserveDimensions = false) {
 for(let pass=0;pass<6;pass++){
  const fullQuality=await encode(width,height,MAX_QUALITY);
  if(fullQuality.size<=maxBytes)return {blob:fullQuality,width,height};

  let best=await encode(width,height,MIN_QUALITY);
  if(best.size<=maxBytes){
   let low=MIN_QUALITY, high=MAX_QUALITY;
   for(let step=0;step<5;step++){
    const quality=(low+high)/2;
    const candidate=await encode(width,height,quality);
    if(candidate.size<=maxBytes){
     low=quality;
     best=candidate;
    }else{
     high=quality;
    }
   }
   return {blob:best,width,height};
  }

  if(preserveDimensions)return undefined;

  const scale=Math.min(0.85,Math.sqrt(maxBytes/best.size)*0.9);
  width=Math.max(1,Math.floor(width*scale));
  height=Math.max(1,Math.floor(height*scale));
 }
 return undefined;
}

export function fitInside(sourceWidth: number, sourceHeight: number, width: number, height: number) {
 const scale=Math.min(width/sourceWidth,height/sourceHeight);
 const drawnWidth=Math.max(1,Math.round(sourceWidth*scale));
 const drawnHeight=Math.max(1,Math.round(sourceHeight*scale));
 return {x:Math.floor((width-drawnWidth)/2),y:Math.floor((height-drawnHeight)/2),width:drawnWidth,height:drawnHeight};
}
