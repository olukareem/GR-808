import * as Tone from 'tone';
import type { ChannelId, Instrument } from './types';
import { CHANNEL_ORDER } from './types';
import { MixBus } from './MixBus';
import { SynthKick } from './instruments/SynthKick';
import { SynthSnare } from './instruments/SynthSnare';
import { SynthHat } from './instruments/SynthHat';
import { SynthClap } from './instruments/SynthClap';
import { SynthTom } from './instruments/SynthTom';
import { SynthCymbal } from './instruments/SynthCymbal';
import { SampleInstrument } from './instruments/SampleInstrument';
import { SampleLoader } from './SampleLoader';
import { MonoSynth } from './MonoSynth';

/**
 * Top-level audio graph owner.
 *
 * One AudioContext (shared with Tone.js — we set it via Tone.setContext). Each
 * channel has a MixBus; instruments are attached to their bus.input. All buses
 * route into a master gain -> peak limiter -> destination.
 */
export class AudioEngine {
  readonly ctx: AudioContext;
  readonly masterBus: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly synthBus: MixBus;
  readonly synth: MonoSynth;
  readonly sampleLoader: SampleLoader;

  private readonly buses = new Map<ChannelId, MixBus>();
  private readonly instruments = new Map<ChannelId, Instrument>();
  private readonly defaultSynthInstruments = new Map<ChannelId, Instrument>();
  private soloChannels = new Set<ChannelId>();

  constructor() {
    // Use a shared context so Tone.Transport and our direct Web Audio nodes
    // run on the same clock.
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    Tone.setContext(this.ctx);

    this.masterBus = this.ctx.createGain();
    this.masterBus.gain.value = 0.8;

    // Peak limiter prevents clipping when many channels fire together.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;

    this.masterBus.connect(this.limiter).connect(this.ctx.destination);

    // Per-channel buses + default synth instruments.
    for (const id of CHANNEL_ORDER) {
      const bus = new MixBus(this.ctx, this.masterBus);
      this.buses.set(id, bus);
      const inst = this.buildDefaultSynth(id, bus.input);
      this.instruments.set(id, inst);
      this.defaultSynthInstruments.set(id, inst);
    }

    // Mono synth on its own bus.
    this.synthBus = new MixBus(this.ctx, this.masterBus);
    this.synthBus.setVolume(0.7);
    this.synth = new MonoSynth(this.ctx, this.synthBus.input);

    this.sampleLoader = new SampleLoader(this.ctx);
  }

  /** The AudioContext is created in suspended state; user gesture required to resume. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    await Tone.start();
  }

  getBus(id: ChannelId): MixBus {
    const bus = this.buses.get(id);
    if (!bus) throw new Error(`No bus for channel ${id}`);
    return bus;
  }

  getInstrument(id: ChannelId): Instrument {
    const inst = this.instruments.get(id);
    if (!inst) throw new Error(`No instrument for channel ${id}`);
    return inst;
  }

  /** Swap a channel's instrument to a user-dropped sample. */
  useSample(id: ChannelId, buffer: AudioBuffer): void {
    const bus = this.getBus(id);
    const existing = this.instruments.get(id);
    // If it's already a SampleInstrument, just update the buffer.
    if (existing instanceof SampleInstrument) {
      existing.setBuffer(buffer);
      return;
    }
    // Replace with a new sample instrument.
    existing?.dispose();
    const sample = new SampleInstrument(id, this.ctx, bus.input, buffer);
    this.instruments.set(id, sample);
  }

  /** Revert a channel back to its default synthesized voice. */
  revertToSynth(id: ChannelId): void {
    const current = this.instruments.get(id);
    if (current instanceof SampleInstrument) {
      current.dispose();
      const def = this.defaultSynthInstruments.get(id);
      if (def) this.instruments.set(id, def);
    }
  }

  setMasterVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.masterBus.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.01);
  }

  /** Maintain the solo set and push the force-mute flag onto all buses. */
  setSolo(id: ChannelId, solo: boolean): void {
    if (solo) this.soloChannels.add(id);
    else this.soloChannels.delete(id);
    const anySolo = this.soloChannels.size > 0;
    for (const [cid, bus] of this.buses) {
      bus.setForceMute(anySolo && !this.soloChannels.has(cid));
    }
  }

  isSoloed(id: ChannelId): boolean {
    return this.soloChannels.has(id);
  }

  private buildDefaultSynth(id: ChannelId, destination: AudioNode): Instrument {
    switch (id) {
      case 'kick':
        return new SynthKick(this.ctx, destination);
      case 'snare':
        return new SynthSnare(this.ctx, destination);
      case 'hatClosed':
        return new SynthHat(this.ctx, destination, 'closed');
      case 'hatOpen':
        return new SynthHat(this.ctx, destination, 'open');
      case 'clap':
        return new SynthClap(this.ctx, destination);
      case 'tom':
        return new SynthTom(this.ctx, destination);
      case 'ride':
        return new SynthCymbal(this.ctx, destination, 'ride');
      case 'crash':
        return new SynthCymbal(this.ctx, destination, 'crash');
    }
  }
}
