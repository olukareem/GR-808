import type { ChannelId, VelocityLabel, OscType } from '../audio/types';
import type { ArpMode } from '../audio/Arpeggiator';

export interface StepState {
  active: boolean;
  velocity: VelocityLabel;
}

export type VoiceSource =
  | { kind: 'synth'; synthId: ChannelId }
  | { kind: 'sample'; filename: string; bufferKey: string };

export interface ChannelConfig {
  id: ChannelId;
  label: string;
  source: VoiceSource;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export type PatternLength = 8 | 16;

export interface Pattern {
  id: string;
  name: string;
  length: PatternLength;
  channels: Record<ChannelId, StepState[]>;
  /** Synth row notes — one per step, or `null` for no trigger. */
  synthNotes: (string | null)[];
}

export interface SynthPatch {
  osc: OscType;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  arp: ArpMode;
}

export interface MasterState {
  volume: number;
  swing: number;
}

export interface ProjectState {
  version: 1;
  bpm: number;
  master: MasterState;
  patterns: Pattern[];
  activePatternIndex: number;
  chain: number[];
  channels: ChannelConfig[];
  synth: SynthPatch;
}
