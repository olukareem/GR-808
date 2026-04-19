import { Store } from './Store';
import type { ChannelId, VelocityLabel } from '../audio/types';
import type { ArpMode } from '../audio/Arpeggiator';
import type { ChannelConfig, Pattern, PatternLength, ProjectState, StepState } from './types';
import { defaultProject, makePattern } from './defaults';

export interface ProjectEvents {
  'bpm-changed': { bpm: number };
  'master-volume-changed': { volume: number };
  'swing-changed': { swing: number };
  'step-changed': { channel: ChannelId; step: number; state: StepState };
  'synth-step-changed': { step: number; note: string | null };
  'pattern-switched': { index: number };
  'pattern-cleared': { index: number };
  'pattern-copied': { fromIndex: number; toIndex: number };
  'channel-updated': { channel: ChannelConfig };
  'synth-changed': ProjectState['synth'];
  'arp-changed': { arp: ArpMode };
  'state-replaced': ProjectState;
}

/**
 * Single source of truth for pattern + mixer + synth state.
 * UI mutates through named methods; scheduler reads stepsAt() synchronously
 * inside the step callback (so it must never await).
 */
export class ProjectStore extends Store<ProjectEvents> {
  private state: ProjectState = defaultProject();

  // ── read ───────────────────────────────────────────────────────────────

  get snapshot(): ProjectState {
    return this.state;
  }

  get activePattern(): Pattern {
    return this.state.patterns[this.state.activePatternIndex]!;
  }

  getChannel(id: ChannelId): ChannelConfig {
    return this.state.channels.find((c) => c.id === id)!;
  }

  /** Returns true if this channel should fire on this step — checked in the audio callback. */
  stepsAt(step: number): {
    drums: { channel: ChannelId; velocity: VelocityLabel }[];
    synthNote: string | null;
  } {
    const p = this.activePattern;
    const drums: { channel: ChannelId; velocity: VelocityLabel }[] = [];
    for (const channel of this.state.channels) {
      const s = p.channels[channel.id]?.[step];
      if (s?.active) {
        drums.push({ channel: channel.id, velocity: s.velocity });
      }
    }
    return { drums, synthNote: p.synthNotes[step] ?? null };
  }

  // ── write ──────────────────────────────────────────────────────────────

  setBpm(bpm: number): void {
    this.state.bpm = Math.max(40, Math.min(240, bpm));
    this.emit('bpm-changed', { bpm: this.state.bpm });
  }

  setMasterVolume(volume: number): void {
    this.state.master.volume = Math.max(0, Math.min(1, volume));
    this.emit('master-volume-changed', { volume: this.state.master.volume });
  }

  setSwing(swing: number): void {
    this.state.master.swing = Math.max(0, Math.min(0.5, swing));
    this.emit('swing-changed', { swing: this.state.master.swing });
  }

  toggleStep(channel: ChannelId, step: number): void {
    const row = this.activePattern.channels[channel]!;
    const cur = row[step]!;
    cur.active = !cur.active;
    this.emit('step-changed', { channel, step, state: { ...cur } });
  }

  setStepVelocity(channel: ChannelId, step: number, velocity: VelocityLabel): void {
    const cur = this.activePattern.channels[channel]![step]!;
    cur.velocity = velocity;
    if (!cur.active) cur.active = true;
    this.emit('step-changed', { channel, step, state: { ...cur } });
  }

  setSynthStep(step: number, note: string | null): void {
    this.activePattern.synthNotes[step] = note;
    this.emit('synth-step-changed', { step, note });
  }

  switchPattern(index: number): void {
    if (index < 0 || index >= this.state.patterns.length) return;
    this.state.activePatternIndex = index;
    this.emit('pattern-switched', { index });
  }

  clearPattern(index = this.state.activePatternIndex): void {
    const old = this.state.patterns[index]!;
    this.state.patterns[index] = { ...makePattern(old.name), id: old.id };
    this.emit('pattern-cleared', { index });
  }

  copyPattern(fromIndex: number, toIndex: number): void {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= this.state.patterns.length ||
      toIndex >= this.state.patterns.length
    ) {
      return;
    }
    const src = this.state.patterns[fromIndex]!;
    const dst = this.state.patterns[toIndex]!;
    dst.length = src.length;
    dst.synthNotes = [...src.synthNotes];
    for (const ch of Object.keys(src.channels) as ChannelId[]) {
      dst.channels[ch] = src.channels[ch].map((s) => ({ ...s }));
    }
    this.emit('pattern-copied', { fromIndex, toIndex });
  }

  setPatternLength(length: PatternLength): void {
    this.activePattern.length = length;
    this.emit('pattern-switched', { index: this.state.activePatternIndex });
  }

  setChannelVolume(id: ChannelId, v: number): void {
    const ch = this.getChannel(id);
    ch.volume = Math.max(0, Math.min(1, v));
    this.emit('channel-updated', { channel: { ...ch } });
  }

  setChannelPan(id: ChannelId, p: number): void {
    const ch = this.getChannel(id);
    ch.pan = Math.max(-1, Math.min(1, p));
    this.emit('channel-updated', { channel: { ...ch } });
  }

  setChannelMute(id: ChannelId, m: boolean): void {
    const ch = this.getChannel(id);
    ch.mute = m;
    this.emit('channel-updated', { channel: { ...ch } });
  }

  setChannelSolo(id: ChannelId, s: boolean): void {
    const ch = this.getChannel(id);
    ch.solo = s;
    this.emit('channel-updated', { channel: { ...ch } });
  }

  setChannelSample(id: ChannelId, filename: string, bufferKey: string): void {
    const ch = this.getChannel(id);
    ch.source = { kind: 'sample', filename, bufferKey };
    this.emit('channel-updated', { channel: { ...ch } });
  }

  revertChannelToSynth(id: ChannelId): void {
    const ch = this.getChannel(id);
    ch.source = { kind: 'synth', synthId: id };
    this.emit('channel-updated', { channel: { ...ch } });
  }

  updateSynth(patch: Partial<ProjectState['synth']>): void {
    this.state.synth = { ...this.state.synth, ...patch };
    this.emit('synth-changed', this.state.synth);
  }

  setArp(mode: ArpMode): void {
    this.state.synth.arp = mode;
    this.emit('arp-changed', { arp: mode });
  }

  /** Whole-state replace (used by load / URL hash import). */
  replace(next: ProjectState): void {
    this.state = next;
    this.emit('state-replaced', next);
  }
}
