/* Etude Looper · capture-worklet.js
   Records the live audio passing through it into Float32 chunks and posts them to the
   main thread, while passing the audio through to its output so the prepare pass stays
   audible. Used to pull PCM out of a file the browser can PLAY but decodeAudioData
   cannot demux (notably iPhone .mov video on Safari), so that audio can then run through
   the same high-quality Signalsmith buffer engine as decoded files.

   Batches ~0.5s per postMessage (transferables, zero-copy) to keep messaging cheap.
   The main thread sends 'flush' when playback ends to drain the tail. */
class EtudeRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this._L = []; this._R = []; this._n = 0;
    this._flushAt = Math.max(4096, sampleRate >> 1);   // ~0.5s worth of frames
    this.port.onmessage = (e) => { if (e.data === 'flush') this._flush(); };
  }
  _flush() {
    if (!this._n) { this.port.postMessage({ len: 0 }); return; }
    const L = new Float32Array(this._n), R = new Float32Array(this._n);
    let o = 0;
    for (let k = 0; k < this._L.length; k++) { L.set(this._L[k], o); R.set(this._R[k], o); o += this._L[k].length; }
    this.port.postMessage({ L: L.buffer, R: R.buffer, len: this._n }, [L.buffer, R.buffer]);
    this._L = []; this._R = []; this._n = 0;
  }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    if (inp && inp.length) {
      for (let c = 0; c < out.length; c++) { const oc = out[c], ic = inp[c] || inp[0]; if (ic) oc.set(ic); }
      this._L.push(inp[0].slice(0));
      this._R.push((inp[1] || inp[0]).slice(0));
      this._n += inp[0].length;
      if (this._n >= this._flushAt) this._flush();
    }
    return true;   // keep the processor alive for the whole prepare pass
  }
}
registerProcessor('etude-recorder', EtudeRecorder);
