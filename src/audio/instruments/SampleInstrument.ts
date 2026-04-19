import type { Instrument, TriggerOptions } from '../types';

/**
 * Instrument backed by an AudioBuffer (user-dropped WAV/MP3).
 * The buffer can be swapped at runtime; each trigger spawns a fresh
 * AudioBufferSourceNode (per Web Audio spec — sources are one-shot).
 */
export class SampleInstrument implements Instrument {
  readonly id: string;
  private readonly ctx: BaseAudioContext;
  private readonly destination: AudioNode;
  private buffer: AudioBuffer | null = null;

  constructor(id: string, ctx: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer | null = null) {
    this.id = id;
    this.ctx = ctx;
    this.destination = destination;
    this.buffer = buffer;
  }

  setBuffer(buffer: AudioBuffer | null): void {
    this.buffer = buffer;
  }

  trigger(time: number, opts: TriggerOptions = {}): void {
    const v = opts.velocity ?? 1;
    if (v <= 0 || !this.buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(v, time);
    src.connect(gain).connect(this.destination);

    src.start(time);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  }

  dispose(): void {
    this.buffer = null;
  }
}
