// Shared types for the audio layer.

export type ChannelId =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'clap'
  | 'tom'
  | 'ride'
  | 'crash';

export const CHANNEL_ORDER: readonly ChannelId[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'clap',
  'tom',
  'ride',
  'crash',
] as const;

export const CHANNEL_LABELS: Readonly<Record<ChannelId, string>> = {
  kick: 'Kick',
  snare: 'Snare',
  hatClosed: 'Hat',
  hatOpen: 'Hat Open',
  clap: 'Clap',
  tom: 'Tom',
  ride: 'Ride',
  crash: 'Crash',
};

export type VelocityLabel = 'soft' | 'medium' | 'hard';

export const VELOCITY_GAIN: Readonly<Record<VelocityLabel, number>> = {
  soft: 0.4,
  medium: 0.75,
  hard: 1.0,
};

export interface TriggerOptions {
  velocity?: number;
  note?: string;
}

export interface Instrument {
  readonly id: string;
  /**
   * Trigger the instrument at the given audio context time (seconds, sample-accurate).
   * Must never reference `ctx.currentTime` — caller provides the time.
   */
  trigger(time: number, opts?: TriggerOptions): void;
  /** Disconnect and free any held resources. */
  dispose(): void;
}

export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';
