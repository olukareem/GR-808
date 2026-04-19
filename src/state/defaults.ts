import { CHANNEL_ORDER, CHANNEL_LABELS } from '../audio/types';
import type { ChannelId } from '../audio/types';
import type { ChannelConfig, Pattern, ProjectState, StepState } from './types';

const PATTERN_LENGTH = 16;

function blankSteps(n = PATTERN_LENGTH): StepState[] {
  return Array.from({ length: n }, () => ({ active: false, velocity: 'medium' as const }));
}

function blankChannels(): Record<ChannelId, StepState[]> {
  const out = {} as Record<ChannelId, StepState[]>;
  for (const id of CHANNEL_ORDER) out[id] = blankSteps();
  return out;
}

/** Preloaded demo pattern so the app isn't silent on first load. */
function demoChannels(): Record<ChannelId, StepState[]> {
  const out = blankChannels();
  // Four-on-the-floor kick.
  for (const i of [0, 4, 8, 12]) out.kick[i]!.active = true;
  // Backbeat snare on 2 and 4.
  for (const i of [4, 12]) out.snare[i]!.active = true;
  // Closed hats on offbeats.
  for (let i = 2; i < 16; i += 2) out.hatClosed[i]!.active = true;
  // Clap on 4.
  out.clap[12]!.active = true;
  return out;
}

export function makePattern(name: string, withDemo = false): Pattern {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    length: PATTERN_LENGTH,
    channels: withDemo ? demoChannels() : blankChannels(),
    synthNotes: Array.from({ length: PATTERN_LENGTH }, () => null),
  };
}

export function defaultChannels(): ChannelConfig[] {
  return CHANNEL_ORDER.map<ChannelConfig>((id) => ({
    id,
    label: CHANNEL_LABELS[id],
    source: { kind: 'synth', synthId: id },
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
  }));
}

export function defaultProject(): ProjectState {
  return {
    version: 1,
    bpm: 120,
    master: { volume: 0.8, swing: 0 },
    patterns: [makePattern('A', true), makePattern('B'), makePattern('C'), makePattern('D')],
    activePatternIndex: 0,
    chain: [],
    channels: defaultChannels(),
    synth: {
      osc: 'sawtooth',
      cutoff: 1400,
      resonance: 2,
      attack: 0.01,
      decay: 0.15,
      sustain: 0.6,
      release: 0.25,
      arp: 'off',
    },
  };
}
