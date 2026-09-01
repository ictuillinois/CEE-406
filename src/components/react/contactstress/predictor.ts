// Reader for the precomputed 3-D tire-pavement contact-stress fields.
//
// The fields come from phyContactGAN, the physics-informed conditional GAN of
//
//   Lang, H., Villamil, W. D., & Al-Qadi, I. L. (2026). 3D tire-pavement contact
//   stresses: physics-informed prediction approach. International Journal of
//   Pavement Engineering, 27(1), 2621970. doi:10.1080/10298436.2026.2621970
//
// trained at the Illinois Center for Transportation on 1,852 validated FE cases
// for a 275/80R22.5 truck tire. The network is NOT shipped. What ships is a
// precomputed sample of its output over the whole of its training domain,
// compressed to a shared PCA basis per tire and stress component:
//
//     sigma(x, y | load, pressure, slip, speed, condition)
//         = mean(x, y) + SUM_k  c_k(load, pressure, slip) * phi_k(x, y)
//
// so the browser interpolates ~100 numbers and does one matrix-vector product
// instead of running a 33-million-parameter generator. Held-out error against
// the generator itself is 0.007 MPa rms on the vertical component (0.4% of
// peak) -- below the 0.0086 MPa RMSE the model itself carries against FEA.
//
// Because the reconstruction is linear in the stored coefficients,
// interpolating coefficients is exactly interpolating fields. The axes are
// cubic-interpolated (4-point Lagrange), which measured 1.2-1.6x better than
// linear on the same nodes for no extra bytes.
//
// pipeline/artifact.py in the (gitignored) model archive is the reference
// implementation of everything below; predictor.test.mjs asserts the two agree.

export type Channel = 'vertical' | 'longitudinal' | 'transverse';
export type TireType = 'DTA' | 'WBT';
export type Speed = '5mph' | '70mph';
export type Condition = 'FR' | 'Brake' | 'Acc';

export const CHANNELS: Channel[] = ['vertical', 'longitudinal', 'transverse'];

interface Section {
  offset: number;
  count: number;
  dtype: 'i8' | 'i16' | 'f32';
  scale?: number;
  filter?: 'deltaRows' | 'deltaAxis0';
  shape?: number[];
}

export interface TireSpec {
  height: number;
  width: number;
  nativeHeight: number;
  nativeWidth: number;
  /** Millimeters per stored pixel, transverse (rows) and longitudinal (cols). */
  mmPerPixelY: number;
  mmPerPixelX: number;
  loads: number[];
  pressures: number[];
  groups: { speed: Speed; condition: Condition; slips: number[] }[];
  rank: Record<Channel, number>;
  file: string;
  bytes: number;
  gzipBytes: number;
  nodes: number;
  sections: Record<string, Section>;
  domain: { load: [number, number]; pressure: [number, number]; slip: [number, number] };
}

export interface Manifest {
  version: number;
  source: { citation: string; doi: string; model: string; tire: string; note: string };
  channels: Channel[];
  interpolation: string;
  tires: Record<TireType, TireSpec>;
}

/** One tire's decoded, dequantized tables — held for the life of the page. */
export interface TirePack {
  tire: TireType;
  spec: TireSpec;
  /** Per channel: the mean field, H*W, in MPa. */
  mean: Record<Channel, Float32Array>;
  /** Per channel: K basis fields laid out K x (H*W), already scaled. */
  basis: Record<Channel, Float32Array>;
  /** Per channel, per "speed|condition": nL x nP x nS x K coefficients, scaled. */
  coeff: Record<Channel, Record<string, Float32Array>>;
}

export interface Inputs {
  tire: TireType;
  /** Wheel load on the tire, newtons. */
  load: number;
  /** Inflation pressure, MPa. */
  pressure: number;
  /** Slip ratio, 0-1. Zero whenever the condition is free rolling. */
  slip: number;
  speed: Speed;
  condition: Condition;
}

/* ─────────────────────────────── loading ─────────────────────────────── */

export const artifactBase = (base: string) => `${base}tools/contact-stress/`;

export async function loadManifest(base: string): Promise<Manifest> {
  const res = await fetch(`${artifactBase(base)}manifest.json`);
  if (!res.ok) throw new Error(`contact-stress manifest: HTTP ${res.status}`);
  return (await res.json()) as Manifest;
}

/**
 * The payload is gzip. It is served with a `.bin` extension precisely so that
 * no host sets `Content-Encoding: gzip` on it and decompresses it behind our
 * back — but if one ever does, the magic-number check below still does the
 * right thing rather than handing the decoder noise.
 */
export async function fetchBlob(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`contact-stress payload: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'This browser cannot decompress the contact-stress data (no DecompressionStream). ' +
        'Chrome 80+, Firefox 113+ or Safari 16.4+ is needed.'
    );
  }
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

function view(buf: ArrayBuffer, s: Section) {
  if (s.dtype === 'i8') return new Int8Array(buf, s.offset, s.count);
  if (s.dtype === 'i16') return new Int16Array(buf, s.offset, s.count);
  return new Float32Array(buf, s.offset, s.count);
}

/** Undo the previous-row delta the basis is stored with. Wraps in int8. */
function undeltaRows(src: Int8Array, K: number, H: number, W: number): Int8Array {
  const out = new Int8Array(src.length);
  for (let k = 0; k < K; k++) {
    const base = k * H * W;
    for (let c = 0; c < W; c++) out[base + c] = src[base + c];
    for (let r = 1; r < H; r++) {
      const row = base + r * W;
      const prev = row - W;
      for (let c = 0; c < W; c++) out[row + c] = ((out[prev + c] + src[row + c]) << 24) >> 24;
    }
  }
  return out;
}

/** Undo the delta along the first (load) axis of a coefficient block. */
function undeltaAxis0(src: Int16Array, n0: number): Int16Array {
  const out = new Int16Array(src.length);
  const stride = src.length / n0;
  for (let j = 0; j < stride; j++) out[j] = src[j];
  for (let i = 1; i < n0; i++) {
    const off = i * stride;
    const prev = off - stride;
    for (let j = 0; j < stride; j++) out[off + j] = ((out[prev + j] + src[off + j]) << 16) >> 16;
  }
  return out;
}

export async function loadTire(base: string, m: Manifest, tire: TireType): Promise<TirePack> {
  const spec = m.tires[tire];
  const buf = await fetchBlob(`${artifactBase(base)}${spec.file}`);
  const S = (key: string) => spec.sections[key];

  const mean = {} as Record<Channel, Float32Array>;
  const basis = {} as Record<Channel, Float32Array>;
  const coeff = {} as Record<Channel, Record<string, Float32Array>>;
  const HW = spec.height * spec.width;

  for (const ch of CHANNELS) {
    const ms = S(`${ch}.mean`);
    const q = view(buf, ms) as Int16Array;
    const mu = new Float32Array(HW);
    for (let i = 0; i < HW; i++) mu[i] = q[i] * (ms.scale as number);
    mean[ch] = mu;

    const K = spec.rank[ch];
    const bScale = view(buf, S(`${ch}.basisScale`)) as Float32Array;
    const bq = undeltaRows(view(buf, S(`${ch}.basis`)) as Int8Array, K, spec.height, spec.width);
    const b = new Float32Array(K * HW);
    for (let k = 0; k < K; k++) {
      const s = bScale[k];
      const off = k * HW;
      for (let i = 0; i < HW; i++) b[off + i] = bq[off + i] * s;
    }
    basis[ch] = b;

    const cScale = view(buf, S(`${ch}.coeffScale`)) as Float32Array;
    coeff[ch] = {};
    for (const g of spec.groups) {
      const sec = S(`${ch}.coeff.${g.speed}.${g.condition}`);
      const raw = undeltaAxis0(view(buf, sec) as Int16Array, (sec.shape as number[])[0]);
      const out = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw[i] * cScale[i % K];
      coeff[ch][`${g.speed}|${g.condition}`] = out;
    }
  }
  return { tire, spec, mean, basis, coeff };
}

/* ───────────────────────────── interpolation ──────────────────────────── */

/**
 * 4-point Lagrange weights on an arbitrary (non-uniform) axis, falling back to
 * linear where fewer than four nodes exist. Linear in the stored data, so
 * interpolating PCA coefficients is identical to interpolating the fields.
 * Must stay byte-for-byte equivalent to cubic_weights() in artifact.py.
 */
export function cubicWeights(axis: number[], x: number): { i: number; w: number }[] {
  const n = axis.length;
  if (n === 1) return [{ i: 0, w: 1 }];
  const xc = Math.min(Math.max(x, axis[0]), axis[n - 1]);
  let i = 0;
  while (i < n - 1 && axis[i + 1] <= xc) i++;
  i = Math.max(0, Math.min(n - 2, i));
  if (n < 4) {
    const t = (xc - axis[i]) / (axis[i + 1] - axis[i]);
    return [
      { i, w: 1 - t },
      { i: i + 1, w: t },
    ];
  }
  const s = Math.max(0, Math.min(i - 1, n - 4));
  const out: { i: number; w: number }[] = [];
  for (let a = 0; a < 4; a++) {
    let num = 1;
    for (let b = 0; b < 4; b++) if (a !== b) num *= (xc - axis[s + b]) / (axis[s + a] - axis[s + b]);
    out.push({ i: s + a, w: num });
  }
  return out;
}

/** Is this (speed, condition) pair present in the baked grid for this tire? */
export const hasGroup = (spec: TireSpec, speed: Speed, condition: Condition) =>
  spec.groups.some((g) => g.speed === speed && g.condition === condition);

export function coefficients(pack: TirePack, ch: Channel, inp: Inputs): Float32Array {
  const { spec } = pack;
  const g = spec.groups.find((x) => x.speed === inp.speed && x.condition === inp.condition);
  if (!g) throw new Error(`no baked block for ${inp.speed}/${inp.condition} on ${pack.tire}`);
  const K = spec.rank[ch];
  const C = pack.coeff[ch][`${g.speed}|${g.condition}`];
  const nP = spec.pressures.length;
  const nS = g.slips.length;

  const wl = cubicWeights(spec.loads, inp.load);
  const wp = cubicWeights(spec.pressures, inp.pressure);
  const ws = cubicWeights(g.slips, inp.condition === 'FR' ? 0 : inp.slip);

  const out = new Float32Array(K);
  for (const a of wl) {
    for (const b of wp) {
      const wab = a.w * b.w;
      if (wab === 0) continue;
      for (const c of ws) {
        const w = wab * c.w;
        if (w === 0) continue;
        const off = ((a.i * nP + b.i) * nS + c.i) * K;
        for (let k = 0; k < K; k++) out[k] += w * C[off + k];
      }
    }
  }
  return out;
}

/**
 * Reconstruct one stress field, in MPa, row-major over (transverse,
 * longitudinal). Optionally writes into a caller-owned buffer so a slider drag
 * does not allocate 18k floats per frame per channel.
 */
export function predict(
  pack: TirePack,
  ch: Channel,
  inp: Inputs,
  into?: Float32Array
): Float32Array {
  const HW = pack.spec.height * pack.spec.width;
  const out = into && into.length === HW ? into : new Float32Array(HW);
  const mu = pack.mean[ch];
  out.set(mu);
  const c = coefficients(pack, ch, inp);
  const B = pack.basis[ch];
  for (let k = 0; k < c.length; k++) {
    const ck = c[k];
    if (ck === 0) continue;
    const off = k * HW;
    for (let i = 0; i < HW; i++) out[i] += ck * B[off + i];
  }
  return out;
}

/** All three components at once, reusing buffers between frames. */
export function predictAll(
  pack: TirePack,
  inp: Inputs,
  into?: Record<Channel, Float32Array>
): Record<Channel, Float32Array> {
  const out = {} as Record<Channel, Float32Array>;
  for (const ch of CHANNELS) out[ch] = predict(pack, ch, inp, into?.[ch]);
  return out;
}
