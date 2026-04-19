import type { AudioEngine } from '../audio/AudioEngine';
import type { Scheduler } from '../audio/Scheduler';
import type { ProjectStore } from '../state/ProjectStore';
import { CHANNEL_ORDER } from '../audio/types';
import type { ChannelId } from '../audio/types';
import { VELOCITY_GAIN } from '../audio/types';
import { GrChannel } from './Channel';

/**
 * <gr-step-grid> — contains all 8 GrChannel rows + manages the playhead.
 *
 * The scheduler fires stepsAt() inside the audio callback (sample-accurate)
 * and calls Tone.Draw for the DOM highlight (next animation frame).
 */
export class GrStepGrid extends HTMLElement {
  private engine!: AudioEngine;
  private scheduler!: Scheduler;
  private store!: ProjectStore;
  private channelEls = new Map<ChannelId, GrChannel>();
  private currentStep = -1;

  init(engine: AudioEngine, scheduler: Scheduler, store: ProjectStore): void {
    this.engine = engine;
    this.scheduler = scheduler;
    this.store = store;
    this._build();
    this._wireScheduler();
  }

  private _build(): void {
    this.className = 'step-grid';
    this.innerHTML = '';
    for (const id of CHANNEL_ORDER) {
      const el = document.createElement('gr-channel') as GrChannel;
      el.init(id, this.engine, this.store);
      this.channelEls.set(id, el);
      this.appendChild(el);
    }
  }

  private _wireScheduler(): void {
    this.scheduler.setStepCallback((stepIndex, audioTime) => {
      const { drums, synthNote } = this.store.stepsAt(stepIndex);

      // Trigger drums — inside audio callback, so timing is sample-accurate.
      for (const { channel, velocity } of drums) {
        const ch = this.store.getChannel(channel);
        if (ch.mute) continue;
        const gainVal = VELOCITY_GAIN[velocity];
        this.engine.getInstrument(channel).trigger(audioTime, { velocity: gainVal });
      }

      // Trigger synth note (from grid or arpeggiator).
      const noteToPlay = synthNote;
      if (noteToPlay) {
        this.engine.synth.trigger(audioTime, { note: noteToPlay, velocity: 0.8 });
      }

      // Schedule DOM update via Tone.Draw — aligned to audio time, not JS event loop.
      this.scheduler.draw(audioTime, () => {
        this._advancePlayhead(stepIndex);
      });
    });
  }

  private _advancePlayhead(step: number): void {
    // Clear previous.
    if (this.currentStep >= 0) {
      for (const el of this.channelEls.values()) el.setActiveStep(null);
    }
    this.currentStep = step;
    for (const [id, el] of this.channelEls) {
      const stepState = this.store.activePattern.channels[id]?.[step];
      el.setActiveStep(step, stepState?.active ?? false);
    }
  }

  reset(): void {
    for (const el of this.channelEls.values()) el.setActiveStep(null);
    this.currentStep = -1;
  }
}

customElements.define('gr-step-grid', GrStepGrid);
