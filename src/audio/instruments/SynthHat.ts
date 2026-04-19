import type { Instrument, TriggerOptions } from '../types';
import { makeNoiseBuffer } from '../dsp/distortion';

/**
 * Synthesized hi-hat.
 * Classic white-noise-through-HPF approach (the real 808 uses six square-wave
 * oscillators summed, then bandpassed; we approximate with noise + BPF + HPF
 * which is cheaper and close enough for a web app).
 */
export class SynthHat implements Instrument {
  readonly id: string;
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  private readonly noiseBuffer: AudioBuffer;
  /** Long decay = open hat; short decay = closed hat. */
  decay: number;

  constructor(ctx: BaseAudioContext, destination: AudioNode, variant: 'closed' | 'open') {
    this.ctx = ctx;
    this.destination = destination;
    this.id = variant === 'open' ? 'hatOpen' : 'hatClosed';
    this.decay = variant === 'open' ? 0.35 : 0.05;
    this.noiseBuffer = makeNoiseBuffer(ctx, 1);
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0) return;
    const end = time + this.decay + 0.05;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 7000;
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 10_000;
    bpf.Q.value = 1.2;
    const gain = this.ctx.createGain();

    noise.connect(hpf).connect(bpf).connect(gain).connect(this.destination);

    gain.gain.setValueAtTime(0.5 * v, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + this.decay);

    noise.start(time);
    noise.stop(end);

    noise.onended = () => {
      noise.disconnect();
      hpf.disconnect();
      bpf.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {}
}
