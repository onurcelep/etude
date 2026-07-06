/* Extract Signalsmith's worklet-processor code into a standalone .js file, so the
   extension can addModule() it from a chrome-extension:// URL (exempt from page CSP)
   instead of a blob: URL (blocked by YouTube CSP). Run once with node. */
import fs from 'fs';

let captured = null;
globalThis.AudioWorkletNode = class { constructor() { throw new Error('force-catch'); } };
globalThis.Blob = class { constructor(parts) { this._code = parts.join(''); } };
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = (b) => { captured = b._code; return 'blob:captured'; };

const mod = await import('./signalsmith-stretch.mjs');
const factory = mod.default;
const fakeCtx = { audioWorklet: { addModule: async () => {} } };
try {
  await factory(fakeCtx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
} catch (e) { /* expected: AudioWorkletNode throws, blob is captured on the way */ }

if (!captured) { console.error('FAILED to capture worklet code'); process.exit(1); }
fs.writeFileSync(new URL('./signalsmith-worklet.js', import.meta.url), captured);
console.log('wrote signalsmith-worklet.js:', captured.length, 'bytes');
