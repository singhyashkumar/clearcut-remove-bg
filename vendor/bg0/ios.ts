import { BackgroundRemovalError } from './errors'
export function clearIosModel() {}
export async function prepareIosModel(..._args: unknown[]): Promise<never> { throw new BackgroundRemovalError('model-load-failed', 'This release supports desktop Chrome and Edge. Please try on a desktop device.') }
export async function removeIosBackground(..._args: unknown[]): Promise<never> { return prepareIosModel() }
