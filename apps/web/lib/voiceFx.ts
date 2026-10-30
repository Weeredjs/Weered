// Voice effects (James 2026-10-30: "Voice masking. Like become morgan freeman
// or something"). Done in the browser with Web Audio, between the microphone
// and LiveKit, so everyone in the room hears the changed voice and the server
// does no work at all. A real person's voice is not on offer: copying one
// needs their say-so (and an AI model on a server); "Narrator" gives the deep
// movie-trailer feel instead.
//
// Plugged in as a LiveKit audio processor (LocalAudioTrack.setProcessor):
// LiveKit hands over the mic track, and sends `processedTrack` in its place.
import type { AudioProcessorOptions, Track, TrackProcessor } from "livekit-client";

export type VoiceFx =
  | "off"
  | "deep"
  | "narrator"
  | "monster"
  | "helium"
  | "robot"
  | "radio"
  | "echo";

export const VOICE_FX: { id: VoiceFx; name: string; blurb: string }[] = [
  { id: "off", name: "Off", blurb: "Your own voice" },
  { id: "deep", name: "Deep", blurb: "A few notes lower" },
  { id: "narrator", name: "Narrator", blurb: "Deep, warm, movie-trailer" },
  { id: "monster", name: "Monster", blurb: "Very low, a little growl" },
  { id: "helium", name: "Helium", blurb: "High and squeaky" },
  { id: "robot", name: "Robot", blurb: "Metallic, like a droid" },
  { id: "radio", name: "Radio", blurb: "Over a walkie-talkie" },
  { id: "echo", name: "Echo", blurb: "In a big cave" },
];

export const VOICE_FX_KEY = "weered:voiceFx";

export function isVoiceFx(v: unknown): v is VoiceFx {
  return typeof v === "string" && VOICE_FX.some((f) => f.id === v);
}

export function savedVoiceFx(): VoiceFx {
  try {
    const v = localStorage.getItem(VOICE_FX_KEY);
    return isVoiceFx(v) ? v : "off";
  } catch {
    return "off";
  }
}

// ── Pitch shifting ─────────────────────────────────────────────────────────
// The delay-line shifter used by most browser voice changers: two delays
// whose delay time ramps continuously (a ramp up lowers the pitch, a ramp
// down raises it), cross-faded so neither ramp's jump back is heard.
const BUFFER_TIME = 0.1;
const FADE_TIME = 0.05;
const MAX_DELAY = 0.1;

function rampBuffer(ctx: AudioContext, up: boolean): AudioBuffer {
  const active = Math.round(BUFFER_TIME * ctx.sampleRate);
  const rest = Math.round((BUFFER_TIME - 2 * FADE_TIME) * ctx.sampleRate);
  const buf = ctx.createBuffer(1, active + rest, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < active; i++) d[i] = up ? (active - i) / (active + rest) : i / active;
  return buf;
}

function fadeBuffer(ctx: AudioContext): AudioBuffer {
  const active = Math.round(BUFFER_TIME * ctx.sampleRate);
  const rest = Math.round((BUFFER_TIME - 2 * FADE_TIME) * ctx.sampleRate);
  const fade = Math.round(FADE_TIME * ctx.sampleRate);
  const buf = ctx.createBuffer(1, active + rest, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < active; i++) {
    d[i] =
      i < fade
        ? Math.sqrt(i / fade)
        : i >= active - fade
          ? Math.sqrt(1 - (i - (active - fade)) / fade)
          : 1;
  }
  return buf;
}

/** `shift` from -1 to 1. The delay ramps by 0.05 × |shift| seconds every
 *  0.1 s, so the pitch moves by a factor of 1 ± shift/2: -0.4 is about four
 *  semitones down, 0.8 about six up. */
function pitchShifter(ctx: AudioContext, shift: number, starts: AudioScheduledSourceNode[]) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const up = shift > 0;
  const ramp = rampBuffer(ctx, up);
  const fades = fadeBuffer(ctx);
  const t1 = ctx.currentTime + 0.05;
  const t2 = t1 + BUFFER_TIME - FADE_TIME;
  for (const start of [t1, t2]) {
    const mod = ctx.createBufferSource();
    mod.buffer = ramp;
    mod.loop = true;
    const depth = ctx.createGain();
    depth.gain.value = 0.5 * MAX_DELAY * Math.min(1, Math.abs(shift));
    const delay = ctx.createDelay(1);
    mod.connect(depth).connect(delay.delayTime);
    const fade = ctx.createBufferSource();
    fade.buffer = fades;
    fade.loop = true;
    const mix = ctx.createGain();
    mix.gain.value = 0;
    fade.connect(mix.gain);
    input.connect(delay).connect(mix).connect(output);
    mod.start(start);
    fade.start(start);
    starts.push(mod, fade);
  }
  return { input, output };
}

function shaper(ctx: AudioContext, amount: number): WaveShaperNode {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  const w = ctx.createWaveShaper();
  w.curve = curve;
  w.oversample = "2x";
  return w;
}

function roomReverb(ctx: AudioContext, seconds: number, wet: number) {
  const len = Math.round(seconds * ctx.sampleRate);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  input.connect(dry).connect(output);
  input.connect(conv).connect(wetGain).connect(output);
  return { input, output };
}

/** The effect's graph, from `src` to `dest`. Returns the nodes that run on
 *  their own (oscillators, looping buffers), to stop on teardown. */
function build(
  ctx: AudioContext,
  fx: VoiceFx,
  src: AudioNode,
  dest: AudioNode,
): AudioScheduledSourceNode[] {
  const starts: AudioScheduledSourceNode[] = [];
  type Stage = AudioNode | { input: AudioNode; output: AudioNode };
  const chain = (...nodes: Stage[]) => {
    let at: AudioNode = src;
    for (const n of nodes) {
      const [inN, outN] = n instanceof AudioNode ? [n, n] : [n.input, n.output];
      at.connect(inN);
      at = outN;
    }
    at.connect(dest);
  };
  const lowShelf = (gain: number, freq = 220) => {
    const f = ctx.createBiquadFilter();
    f.type = "lowshelf";
    f.frequency.value = freq;
    f.gain.value = gain;
    return f;
  };
  switch (fx) {
    case "deep":
      chain(pitchShifter(ctx, -0.4, starts), lowShelf(3));
      break;
    case "narrator": {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 4;
      const air = ctx.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 5000;
      air.gain.value = -4;
      chain(
        pitchShifter(ctx, -0.34, starts),
        lowShelf(7, 180),
        air,
        comp,
        roomReverb(ctx, 0.6, 0.12),
      );
      break;
    }
    case "monster": {
      // The growl and the low boost push past full scale; bring it back under.
      const out = ctx.createGain();
      out.gain.value = 0.45;
      chain(pitchShifter(ctx, -0.8, starts), shaper(ctx, 6), lowShelf(6, 160), out);
      break;
    }
    case "helium":
      chain(pitchShifter(ctx, 0.8, starts));
      break;
    case "robot": {
      // Ring modulation: the voice multiplied by a low hum.
      const ring = ctx.createGain();
      ring.gain.value = 0;
      const hum = ctx.createOscillator();
      hum.frequency.value = 55;
      hum.connect(ring.gain);
      hum.start();
      starts.push(hum);
      const out = ctx.createGain();
      out.gain.value = 1.6;
      chain(ring, out);
      break;
    }
    case "radio": {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 450;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2800;
      const out = ctx.createGain();
      out.gain.value = 0.9;
      chain(hp, lp, shaper(ctx, 12), out);
      break;
    }
    case "echo": {
      const input = ctx.createGain();
      const output = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.22;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      input.connect(output);
      input.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(output);
      chain({ input, output });
      break;
    }
    default:
      chain();
  }
  return starts;
}

/** A LiveKit processor that sends the mic through the effect. */
export function voiceFxProcessor(
  fx: VoiceFx,
): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let src: MediaStreamAudioSourceNode | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let starts: AudioScheduledSourceNode[] = [];
  const teardown = () => {
    for (const s of starts) {
      try {
        s.stop();
      } catch {}
    }
    starts = [];
    try {
      src?.disconnect();
    } catch {}
    src = null;
    dest = null;
  };
  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: `weered-voice-${fx}`,
    async init({ track, audioContext }) {
      teardown();
      if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});
      src = audioContext.createMediaStreamSource(new MediaStream([track]));
      dest = audioContext.createMediaStreamDestination();
      starts = build(audioContext, fx, src, dest);
      processor.processedTrack = dest.stream.getAudioTracks()[0];
    },
    async restart(opts) {
      await processor.init(opts);
    },
    async destroy() {
      teardown();
      processor.processedTrack = undefined;
    },
  };
  return processor;
}
