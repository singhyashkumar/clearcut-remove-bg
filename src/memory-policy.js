// Browser RAM hints are capped and do not describe the per-tab memory budget.
export function needsMemoryBudget(hardware = globalThis.navigator) {
 return Boolean(hardware && (/Android|iPhone|iPad|iPod|Mobile/i.test(hardware.userAgent || '') ||
  (/Macintosh/i.test(hardware.userAgent || '') && hardware.maxTouchPoints > 1) ||
  (hardware.deviceMemory && hardware.deviceMemory <= 4)));
}
export function processingDimensions(width, height, hardware = globalThis.navigator) {
 const scale = needsMemoryBudget(hardware) ? Math.min(1, 2048 / Math.max(width, height), Math.sqrt(2_000_000 / (width * height))) : 1;
 return {width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale))};
}
// Keep only compressed photo bytes alive while the model initializes and runs.
export async function prepareProcessingPhoto(file, bitmap, hardware = globalThis.navigator) {
 const size = processingDimensions(bitmap.width, bitmap.height, hardware);
 if (size.width === bitmap.width && size.height === bitmap.height) return {file, resized: false};
 const canvas = document.createElement('canvas');
 canvas.width = size.width; canvas.height = size.height;
 try {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image resizing is unavailable.');
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image resizing failed.');
  return {file: blob, resized: true};
 } finally {canvas.width = canvas.height = 0;}
}

export function useMobileProcessing(mode, hardware = globalThis.navigator) {
 return mode === 'compatible' || needsMemoryBudget(hardware);
}
