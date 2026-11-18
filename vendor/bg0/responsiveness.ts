// ONNX's proxy flag is global and must be chosen before runtime initialization.
// Never enable it for a session that may use WebGPU (unsupported by ONNX).
export function configureCpuProxy(onnx: { wasm?: { proxy?: boolean } } | null | undefined, choices: readonly { provider: string }[], workerAvailable: boolean) {
 if (!onnx?.wasm) return;
 onnx.wasm.proxy = workerAvailable && choices.every(choice => choice.provider === 'wasm');
}
