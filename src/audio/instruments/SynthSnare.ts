import type { Instrument, TriggerOptions } from '../types';
import { makeNoiseBuffer } from '../dsp/distortion';

/**
 * Synthesized snare — noise burst summed with a short tonal "body" at ~180 Hz.
 * The noise is highpass-filtered so it cuts through the mix; the body gives
 * the snare a sense of pitch without being too musical.
 */
export class SynthSnare implements Instrument {
  readonly id = 'snare';
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  private readonly noiseBuffer: AudioBuffer;

  bodyFreq = 180;
  decay = 0.18;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
    this.noiseBuffer = makeNoiseBuffer(ctx, 0.5);
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0) return;
    const end = time + this.decay + 0.05;

    // Noise path: buffer -> HPF -> gain.
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 1200;
    const noiseGain = this.ctx.createGain();
    noise.connect(hpf).connect(noiseGain).connect(this.destination);
    noiseGain.gain.setValueAtTime(0.9 * v, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + this.decay);
    noise.start(time);
    noise.stop(end);

    // Body path: triangle oscillator with short pitch drop.
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const oscGain = this.ctx.createGain();
    osc.connect(oscGain).connect(this.destination);
    osc.frequency.setValueAtTime(this.bodyFreq, time);
    osc.frequency.exponentialRampToValueAtTime(this.bodyFreq * 0.5, time + this.decay);
    oscGain.gain.setValueAtTime(0.5 * v, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + this.decay * 0.6);
    osc.start(time);
    osc.stop(end);

    osc.onended = () => {
      osc.disconnect();
      oscGain.disconnect();
      noise.disconnect();
      hpf.disconnect();
      noiseGain.disconnect();
    };
  }

  dispose(): void {}
}
