import type { Instrument, TriggerOptions } from '../types';
import { makeDistortionCurve } from '../dsp/distortion';

/**
 * Synthesized 808-style kick drum.
 * Sine oscillator with exponential pitch + gain envelope, routed through a
 * waveshaper for body saturation. Ported from the original GR-808 kick.
 */
export class SynthKick implements Instrument {
  readonly id = 'kick';
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  tone = 167.1;
  decay = 0.5;
  fxAmount = 0;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const velocity = opts.velocity ?? 1;
    if (velocity <= 0) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const shaper = this.ctx.createWaveShaper();
    // TS5 strict ArrayBuffer/SharedArrayBuffer: cast through unknown.
    shaper.curve = makeDistortionCurve(this.fxAmount) as unknown as Float32Array<ArrayBuffer>;

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(shaper);
    shaper.connect(this.destination);

    const end = time + this.decay + 0.1;
    // Pitch sweep: start at `tone` Hz, drop to 1 Hz across the decay.
    osc.frequency.setValueAtTime(this.tone, time + 0.001);
    osc.frequency.exponentialRampToValueAtTime(1, time + this.decay);

    // Gain envelope: ramp up to velocity, then exponentially decay.
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(velocity, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01 * velocity, time + this.decay);
    gain.gain.linearRampToValueAtTime(0, end);

    osc.start(time);
    osc.stop(end);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      shaper.disconnect();
    };
  }

  dispose(): void {
    // Nothing persistent to dispose; each trigger creates its own nodes.
  }
}
