import type { Instrument, TriggerOptions } from '../types';

/**
 * Synthesized tom — sine oscillator with a medium pitch drop.
 * Slightly longer decay than the kick, lower starting frequency, and a gentler
 * ramp to keep the "drum" rather than "bass" quality.
 */
export class SynthTom implements Instrument {
  readonly id = 'tom';
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  tone = 120;
  decay = 0.4;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain).connect(this.destination);

    const end = time + this.decay + 0.05;
    osc.frequency.setValueAtTime(this.tone, time);
    osc.frequency.exponentialRampToValueAtTime(this.tone * 0.4, time + this.decay);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(v, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + this.decay);

    osc.start(time);
    osc.stop(end);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {}
}
