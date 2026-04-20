import * as Tone from 'tone';

/**
 * Wrapper around Tone.Transport for step-based sequencer scheduling.
 *
 * Tone.Transport internally runs a 25ms lookahead loop (the Chris Wilson
 * scheduler pattern) and hands each scheduled callback a sample-accurate
 * `time` argument. The golden rule: inside the callback, only trigger with
 * that `time` value — never ctx.currentTime, never setTimeout, never a DOM
 * event handler — or you break sample-accuracy.
 */
export type StepCallback = (stepIndex: number, audioTime: number) => void;

export class Scheduler {
  private stepId: number | null = null;
  private currentStep = 0;
  private stepCount = 16;
  private onStep: StepCallback | null = null;

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = Math.max(40, Math.min(240, bpm));
  }

  get bpm(): number {
    return Tone.getTransport().bpm.value;
  }

  /** Register the step callback — fires on every 16th note while running. */
  setStepCallback(cb: StepCallback): void {
    this.onStep = cb;
  }

  setStepCount(n: 8 | 16): void {
    this.stepCount = n;
    this.currentStep = 0;
  }

  start(): void {
    if (this.stepId !== null) this.stop(false);
    this.currentStep = 0;
    this.stepId = Tone.getTransport().scheduleRepeat((audioTime) => {
      const idx = this.currentStep;
      this.onStep?.(idx, audioTime);
      this.currentStep = (idx + 1) % this.stepCount;
    }, '16n');
    Tone.getTransport().start('+0.05');
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  resume(): void {
    Tone.getTransport().start('+0.05');
  }

  stop(resetStep = true): void {
    Tone.getTransport().stop();
    if (this.stepId !== null) {
      Tone.getTransport().clear(this.stepId);
      this.stepId = null;
    }
    if (resetStep) this.currentStep = 0;
  }

  get isRunning(): boolean {
    return Tone.getTransport().state === 'started';
  }

  /**
   * Schedule a DOM callback to fire at a specific audio time — used to keep
   * the playhead highlight tight against the actual hit, not the JS event
   * loop.
   */
  draw(time: number, cb: () => void): void {
    Tone.getDraw().schedule(cb, time);
  }
}
