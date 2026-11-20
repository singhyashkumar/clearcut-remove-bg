const MAX_STEPS = 12;
const MAX_BYTES = 48 * 1024 * 1024;

export class AlphaHistory {
 private snapshots: Uint8Array[] = [];
 private bytes = 0;

 get canUndo(): boolean {
  return this.snapshots.length > 0;
 }

 capture(alpha: Uint8Array): void {
  if (alpha.byteLength > MAX_BYTES) {
   this.clear();
   return;
  }

  while (this.snapshots.length >= MAX_STEPS || this.bytes + alpha.byteLength > MAX_BYTES) {
   this.bytes -= this.snapshots.shift()!.byteLength;
  }
  this.snapshots.push(alpha.slice());
  this.bytes += alpha.byteLength;
 }

 undo(): Uint8Array | undefined {
  const snapshot = this.snapshots.pop();
  if (snapshot) this.bytes -= snapshot.byteLength;
  return snapshot;
 }

 clear(): void {
  this.snapshots = [];
  this.bytes = 0;
 }
}
