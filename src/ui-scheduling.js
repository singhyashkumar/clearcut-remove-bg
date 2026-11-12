// Yield a task, not a microtask, so input and paint can run between batches.
export function yieldToBrowser() {
 if (globalThis.scheduler?.yield) return globalThis.scheduler.yield();
 return new Promise(resolve => setTimeout(resolve, 0));
}

export async function readAlphaChannels(result, original, signal) {
 const alpha = new Uint8Array(result.length / 4);
 const sourceAlpha = new Uint8Array(alpha.length);
 for (let start=0; start<alpha.length; start+=131072) {
  signal?.throwIfAborted();
  const end=Math.min(start+131072,alpha.length);
  for(let i=start;i<end;i++) {
   alpha[i]=result[i*4+3];
   sourceAlpha[i]=original[i*4+3];
  }
  if(end<alpha.length) await yieldToBrowser();
 }
 signal?.throwIfAborted();
 return {alpha,sourceAlpha};
}
