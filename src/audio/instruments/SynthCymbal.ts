import type { Instrument, TriggerOptions } from '../types';
import { makeNoiseBuffer } from '../dsp/distortion';

/**
 * Synthesized cymbal (ride / crash).
 * Long-tail HP-filtered noise with a subtle shimmer. The two variants differ
 * only in decay length and filter focus.
 */
export class SynthCymbal implements Instrument {
  readonly id: string;
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly decay: number;
  private readonly filterFreq: number;

  constructor(ctx: BaseAudioContext, destination: AudioNode, variant: 'ride' | 'crash') {
    this.ctx = ctx;
    this.destination = destination;
    this.id = variant;
    this.decay = variant === 'crash' ? 1.2 : 0.7;
    this.filterFreq = variant === 'crash' ? 6000 : 8500;
    this.noiseBuffer = makeNoiseBuffer(ctx, 2);
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0) return;
    const end = time + this.decay + 0.05;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = this.filterFreq;
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = this.filterFreq * 1.5;
    bpf.Q.value = 0.7;
    const gain = this.ctx.createGain();
    noise.connect(hpf).connect(bpf).connect(gain).connect(this.destination);

    gain.gain.setValueAtTime(0.55 * v, time);
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
