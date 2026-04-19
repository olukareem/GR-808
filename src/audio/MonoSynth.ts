import type { Instrument, OscType, TriggerOptions } from './types';

/**
 * Single-voice subtractive monosynth: oscillator -> lowpass -> VCA with ADSR.
 *
 * Monophonic by design — a new trigger cancels the current envelope and
 * re-gates the amp. This matches classic analog monosynth behavior
 * (Minimoog, TB-303) and keeps CPU predictable.
 */
export class MonoSynth implements Instrument {
  readonly id = 'synth';
  private readonly ctx: BaseAudioContext;

  private osc: OscillatorNode | null = null;
  private readonly filter: BiquadFilterNode;
  private readonly vca: GainNode;

  // Patch parameters — mutated in place by the UI.
  oscType: OscType = 'sawtooth';
  cutoff = 1200;
  resonance = 2;
  attack = 0.01;
  decay = 0.15;
  sustain = 0.6;
  release = 0.25;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.cutoff;
    this.filter.Q.value = this.resonance;

    this.vca = ctx.createGain();
    this.vca.gain.value = 0;

    this.filter.connect(this.vca).connect(destination);
  }

  /** Convert note name ("C4", "F#3") to frequency in Hz. */
  noteToFreq(note: string): number {
    const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
    if (!match) return 440;
    const [, letter, accidental, octaveStr] = match;
    const semitoneFromC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let semitone = semitoneFromC[letter!]!;
    if (accidental === '#') semitone += 1;
    if (accidental === 'b') semitone -= 1;
    const octave = Number.parseInt(octaveStr!, 10);
    const midi = 12 * (octave + 1) + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    const note = opts.note ?? 'C4';
    const freq = this.noteToFreq(note);

    // Tear down previous voice (mono steal).
    this.osc?.stop(time);
    this.osc?.disconnect();

    const osc = this.ctx.createOscillator();
    osc.type = this.oscType;
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(this.filter);
    this.osc = osc;

    // Sync filter params to current patch values (live knob updates).
    this.filter.frequency.setValueAtTime(this.cutoff, time);
    this.filter.Q.setValueAtTime(this.resonance, time);

    const peak = v;
    const sus = peak * this.sustain;

    this.vca.gain.cancelScheduledValues(time);
    this.vca.gain.setValueAtTime(this.vca.gain.value, time);
    this.vca.gain.linearRampToValueAtTime(peak, time + this.attack);
    this.vca.gain.linearRampToValueAtTime(sus, time + this.attack + this.decay);

    osc.start(time);
  }

  /** Release the currently held note. */
  release_(time: number): void {
    if (!this.osc) return;
    const stopAt = time + this.release + 0.01;
    this.vca.gain.cancelScheduledValues(time);
    this.vca.gain.setValueAtTime(this.vca.gain.value, time);
    this.vca.gain.linearRampToValueAtTime(0, time + this.release);
    this.osc.stop(stopAt);
    const osc = this.osc;
    this.osc = null;
    osc.onended = () => osc.disconnect();
  }

  dispose(): void {
    this.osc?.stop();
    this.osc?.disconnect();
    this.filter.disconnect();
    this.vca.disconnect();
  }
}
