import type { Instrument, TriggerOptions } from '../types';
import { makeNoiseBuffer } from '../dsp/distortion';

/**
 * Synthesized clap.
 * Four quick bandpassed noise bursts — three tight claps followed by a longer
 * decaying "air" tail. This is the classic TR-909 clap recipe applied to noise.
 */
export class SynthClap implements Instrument {
  readonly id = 'clap';
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  private readonly noiseBuffer: AudioBuffer;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
    this.noiseBuffer = makeNoiseBuffer(ctx, 1);
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1200;
    bpf.Q.value = 3;
    const gain = this.ctx.createGain();
    noise.connect(bpf).connect(gain).connect(this.destination);

    const bursts = [0, 0.01, 0.02, 0.03];
    const burstLen = 0.012;
    gain.gain.setValueAtTime(0, time);
    for (const offset of bursts) {
      const t = time + offset;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8 * v, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, t + burstLen);
    }
    // Long tail after the last burst.
    const tailStart = time + bursts[bursts.length - 1] + burstLen;
    gain.gain.setValueAtTime(0.4 * v, tailStart);
    gain.gain.exponentialRampToValueAtTime(0.001, tailStart + 0.2);

    const end = tailStart + 0.25;
    noise.start(time);
    noise.stop(end);

    noise.onended = () => {
      noise.disconnect();
      bpf.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {}
}
