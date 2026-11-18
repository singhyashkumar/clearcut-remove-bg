// Yield a task, not a microtask, so input and paint can run between batches.
export function yieldToBrowser() {
 const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield(): Promise<void> } }).scheduler;
 if (scheduler?.yield) return scheduler.yield();
 return new Promise<void>(resolve => setTimeout(resolve, 0));
}

export async function readAlphaChannels(result: ArrayLike<number>, original: ArrayLike<number>, signal?: AbortSignal) {
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
