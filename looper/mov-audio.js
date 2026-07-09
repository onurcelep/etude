/* Etude Looper · mov-audio.js
   Pulls the AAC audio track out of an .mp4/.mov the browser can PLAY but decodeAudioData
   cannot demux (notably iPhone .mov on Safari), and decodes it to PCM with WebCodecs —
   fast (seconds for a multi-minute clip), so the audio can run through the same
   high-quality Signalsmith buffer engine as decoded files.

   Deliberately scoped to the common case: AAC-LC in a progressive (non-fragmented) moov,
   including the QuickTime quirks a real iPhone recording has (mp4a sample-entry version 1,
   esds nested inside a `wave` atom, a second non-AAC `apac` spatial-audio track to skip).
   Throws on anything it can't handle so the caller can fall back to live capture.

   Vanilla, no build step, no dependencies. Requires WebCodecs AudioDecoder (iOS 16.4+). */

const FRAME = 1024;   // AAC-LC samples per access unit

// ---- box walking -------------------------------------------------------------
function boxIter(dv, start, end) {
  const out = [];
  let o = start;
  while (o + 8 <= end) {
    let size = dv.getUint32(o);
    const type = str(dv, o + 4, 4);
    let hdr = 8;
    if (size === 1) { size = Number(dv.getBigUint64(o + 8)); hdr = 16; }
    else if (size === 0) { size = end - o; }
    if (size < 8 || o + size > end) break;
    out.push({ type, start: o, end: o + size, body: o + hdr });
    o += size;
  }
  return out;
}
const str = (dv, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint8(o + i)); return s; };
const find = (boxes, type) => boxes.find(b => b.type === type);
const findAll = (boxes, type) => boxes.filter(b => b.type === type);

// ---- AAC AudioSpecificConfig (from esds → DecoderSpecificInfo) ----------------
function parseEsdsAsc(dv, esdsBody, esdsEnd) {
  // esds is a FullBox: skip 4 bytes (version+flags), then descriptor tree.
  let o = esdsBody + 4;
  const readTag = () => {
    const tag = dv.getUint8(o++); let len = 0, b;
    do { b = dv.getUint8(o++); len = (len << 7) | (b & 0x7f); } while (b & 0x80);
    return { tag, len, body: o };
  };
  const es = readTag();                 // 0x03 ES_Descriptor
  o = es.body + 3;                      // ES_ID(2) + flags(1)  (assumes no stream-dependence/URL/OCR)
  const dc = readTag();                 // 0x04 DecoderConfigDescriptor
  const objTypeInd = dv.getUint8(dc.body);
  o = dc.body + 13;                    // objType(1)+streamType/bufSize(4)... 1+1+3+4+4 = 13
  const dsi = readTag();               // 0x05 DecoderSpecificInfo == AudioSpecificConfig
  const asc = new Uint8Array(dsi.len);
  for (let i = 0; i < dsi.len; i++) asc[i] = dv.getUint8(dsi.body + i);
  return { objTypeInd, asc };
}

const SFI = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
function readAsc(asc) {
  const v = (asc[0] << 8) | asc[1];
  return { aot: (v >> 11) & 0x1f, sampleRate: SFI[(v >> 7) & 0xf], channels: (v >> 3) & 0xf };
}

// ---- locate the AAC track and build its sample list --------------------------
export function demuxAacTrack(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  const top = boxIter(dv, 0, dv.byteLength);
  const moov = find(top, 'moov');
  if (!moov) throw new Error('no moov (fragmented or non-mp4?)');
  const moovBoxes = boxIter(dv, moov.body, moov.end);

  for (const trak of findAll(moovBoxes, 'trak')) {
    const trakB = boxIter(dv, trak.body, trak.end);
    const mdia = find(trakB, 'mdia'); if (!mdia) continue;
    const mdiaB = boxIter(dv, mdia.body, mdia.end);
    const hdlr = find(mdiaB, 'hdlr');
    if (!hdlr || str(dv, hdlr.body + 8, 4) !== 'soun') continue;   // audio tracks only

    const minf = find(mdiaB, 'minf'); if (!minf) continue;
    const stbl = find(boxIter(dv, minf.body, minf.end), 'stbl'); if (!stbl) continue;
    const stblB = boxIter(dv, stbl.body, stbl.end);
    const stsd = find(stblB, 'stsd'); if (!stsd) continue;

    // sample entry starts after stsd fullbox(8) + entry_count(4)
    const seStart = stsd.body + 8;
    const seType = str(dv, seStart + 4, 4);
    if (seType !== 'mp4a') continue;   // skip 'apac' spatial audio and anything non-AAC

    // AudioSampleEntry: 16 header + v(2)rev(2)vendor(4)ch(2)size(2)cid(2)pkt(2)rate(4)=20, then
    // version-1 adds 16 bytes, version-2 adds 36. esds may be a direct child OR inside `wave`.
    const version = dv.getUint16(seStart + 16);
    const childStart = seStart + 36 + (version === 1 ? 16 : version === 2 ? 36 : 0);
    const seEnd = stsd.body + 8 + dv.getUint32(seStart);
    let entryBoxes = boxIter(dv, childStart, seEnd);
    let esds = find(entryBoxes, 'esds');
    if (!esds) {
      const wave = find(entryBoxes, 'wave');
      if (wave) esds = find(boxIter(dv, wave.body, wave.end), 'esds');
    }
    if (!esds) throw new Error('AAC track has no esds');
    const { objTypeInd, asc } = parseEsdsAsc(dv, esds.body, esds.end);
    if (objTypeInd !== 0x40) throw new Error('not MPEG-4 audio (objType 0x' + objTypeInd.toString(16) + ')');
    const { aot, sampleRate, channels } = readAsc(asc);

    // sample tables → absolute file offset + size of every AAC access unit
    const stsz = find(stblB, 'stsz'), stsc = find(stblB, 'stsc');
    const stco = find(stblB, 'stco'), co64 = find(stblB, 'co64');
    if (!stsz || !stsc || !(stco || co64)) throw new Error('missing sample tables');

    const uniform = dv.getUint32(stsz.body + 4);
    const nSamples = dv.getUint32(stsz.body + 8);
    const sizeAt = (i) => uniform || dv.getUint32(stsz.body + 12 + i * 4);

    const nChunks = dv.getUint32((stco || co64).body + 4);
    const chunkOffset = (i) => stco ? dv.getUint32(stco.body + 8 + i * 4) : Number(dv.getBigUint64(co64.body + 8 + i * 8));

    // stsc: runs of (first_chunk, samples_per_chunk). Expand to samples-per-chunk[].
    const nStsc = dv.getUint32(stsc.body + 4);
    const runs = [];
    for (let i = 0; i < nStsc; i++) {
      const b = stsc.body + 8 + i * 12;
      runs.push({ first: dv.getUint32(b), spc: dv.getUint32(b + 4) });
    }
    const samplesPerChunk = (chunkIdx1) => {   // chunkIdx1 is 1-based
      let spc = runs[0] ? runs[0].spc : 0;
      for (let i = 0; i < runs.length; i++) { if (chunkIdx1 >= runs[i].first) spc = runs[i].spc; else break; }
      return spc;
    };

    const samples = [];
    let si = 0;
    for (let c = 0; c < nChunks && si < nSamples; c++) {
      let off = chunkOffset(c);
      const spc = samplesPerChunk(c + 1);
      for (let k = 0; k < spc && si < nSamples; k++) {
        const sz = sizeAt(si);
        samples.push({ offset: off, size: sz });
        off += sz; si++;
      }
    }
    if (!samples.length) throw new Error('no audio samples');
    return { codec: 'mp4a.40.' + aot, sampleRate, channels: channels || 2, asc, samples };
  }
  throw new Error('no AAC (mp4a) audio track');
}

// ---- WebCodecs decode → planar Float32 PCM -----------------------------------
async function webcodecDecode(track, arrayBuffer, onProgress) {
  if (typeof AudioDecoder === 'undefined') throw new Error('WebCodecs AudioDecoder unavailable');
  const support = await AudioDecoder.isConfigSupported({
    codec: track.codec, sampleRate: track.sampleRate, numberOfChannels: track.channels
  });
  if (!support || !support.supported) throw new Error('AAC decode not supported here');

  const u8 = new Uint8Array(arrayBuffer);
  const collected = [];
  let err = null;
  const dec = new AudioDecoder({
    output: (ad) => {
      const nCh = ad.numberOfChannels, n = ad.numberOfFrames, chans = [];
      for (let c = 0; c < nCh; c++) { const f = new Float32Array(n); ad.copyTo(f, { planeIndex: c, format: 'f32-planar' }); chans.push(f); }
      collected.push({ chans, n });
      ad.close();
    },
    error: (e) => { err = e; }
  });
  dec.configure({ codec: track.codec, sampleRate: track.sampleRate, numberOfChannels: track.channels, description: track.asc });

  const usPerFrame = Math.round(FRAME * 1e6 / track.sampleRate);
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: i * usPerFrame, duration: usPerFrame, data: u8.subarray(s.offset, s.offset + s.size) }));
    if (onProgress && (i & 63) === 0) onProgress(0.9 * i / track.samples.length);
  }
  await dec.flush();
  dec.close();
  if (err) throw err;

  let total = 0; for (const c of collected) total += c.n;
  const nCh = collected.length ? collected[0].chans.length : track.channels;
  const channels = [];
  for (let c = 0; c < Math.max(2, nCh); c++) channels.push(new Float32Array(total));
  let o = 0;
  for (const seg of collected) {
    for (let c = 0; c < channels.length; c++) channels[c].set(seg.chans[c] || seg.chans[0], o);
    o += seg.n;
  }
  if (onProgress) onProgress(1);
  return { sampleRate: track.sampleRate, length: total, channels: channels.slice(0, 2) };
}

// Public: ArrayBuffer of an .mp4/.mov -> { sampleRate, length, channels:[L,R] }. Throws on unsupported.
export async function decodeMovAudio(arrayBuffer, opts = {}) {
  const track = demuxAacTrack(arrayBuffer);
  return webcodecDecode(track, arrayBuffer, opts.onProgress);
}
