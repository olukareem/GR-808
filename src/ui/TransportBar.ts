import type { Scheduler } from '../audio/Scheduler';
import type { ProjectStore } from '../state/ProjectStore';

/**
 * <gr-transport> — play/pause/stop, BPM input, tap tempo, pattern select,
 * pattern length toggle, copy/clear pattern buttons.
 */
export class GrTransport extends HTMLElement {
  private scheduler!: Scheduler;
  private store!: ProjectStore;
  private unsubs: (() => void)[] = [];

  private playBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private bpmInput!: HTMLInputElement;
  private tapBtn!: HTMLButtonElement;
  private patternBtns: HTMLButtonElement[] = [];
  private lenBtns: HTMLButtonElement[] = [];

  private tapTimes: number[] = [];

  init(scheduler: Scheduler, store: ProjectStore): void {
    this.scheduler = scheduler;
    this.store = store;
    this._build();
    this._wire();
  }

  disconnectedCallback(): void {
    for (const u of this.unsubs) u();
  }

  private _build(): void {
    this.innerHTML = `
      <div class="transport">
        <div class="transport__section transport__transport-btns">
          <button class="btn btn--icon transport__btn" data-action="play" aria-label="Play" title="Play (Space)">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l10 6-10 6z"/></svg>
          </button>
          <button class="btn btn--icon transport__btn" data-action="pause" aria-label="Pause" title="Pause (Space)">
            <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12"/><rect x="9" y="2" width="4" height="12"/></svg>
          </button>
          <button class="btn btn--icon transport__btn" data-action="stop" aria-label="Stop" title="Stop">
            <svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12"/></svg>
          </button>
        </div>

        <div class="transport__section transport__bpm">
          <label class="transport__label">BPM</label>
          <input class="transport__bpm-input" type="number" min="40" max="240" value="120" aria-label="BPM" />
          <button class="btn transport__tap" title="Tap Tempo">TAP</button>
        </div>

        <div class="transport__section transport__patterns">
          <label class="transport__label">PATTERN</label>
          <div class="transport__pattern-btns">
            ${['A', 'B', 'C', 'D'].map((l, i) =>
              `<button class="btn transport__pattern-btn${i === 0 ? ' is-active' : ''}" data-pattern="${i}">${l}</button>`
            ).join('')}
          </div>
        </div>

        <div class="transport__section transport__length">
          <label class="transport__label">STEPS</label>
          <div class="transport__len-btns">
            <button class="btn transport__len-btn" data-len="8">8</button>
            <button class="btn transport__len-btn is-active" data-len="16">16</button>
          </div>
        </div>

        <div class="transport__section transport__actions">
          <label class="transport__label">EDIT</label>
          <button class="btn btn--sm" data-action="copy" title="Copy active pattern">Copy</button>
          <button class="btn btn--sm btn--danger" data-action="clear" title="Clear active pattern">Clear</button>
        </div>
      </div>
    `;

    this.playBtn = this.querySelector('[data-action="play"]')!;
    this.pauseBtn = this.querySelector('[data-action="pause"]')!;
    this.stopBtn = this.querySelector('[data-action="stop"]')!;
    this.bpmInput = this.querySelector('.transport__bpm-input')!;
    this.tapBtn = this.querySelector('.transport__tap')!;
    this.patternBtns = [...this.querySelectorAll<HTMLButtonElement>('[data-pattern]')];
    this.lenBtns = [...this.querySelectorAll<HTMLButtonElement>('[data-len]')];
  }

  private _wire(): void {
    this.playBtn.addEventListener('click', () => this._play());
    this.pauseBtn.addEventListener('click', () => this._pause());
    this.stopBtn.addEventListener('click', () => this._stop());

    this.bpmInput.addEventListener('input', () => {
      const v = parseInt(this.bpmInput.value, 10);
      if (v >= 40 && v <= 240) {
        this.store.setBpm(v);
        this.scheduler.setBpm(v);
      }
    });

    this.tapBtn.addEventListener('click', () => this._tapTempo());

    for (const btn of this.patternBtns) {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset['pattern']!, 10);
        this.store.switchPattern(idx);
      });
    }

    for (const btn of this.lenBtns) {
      btn.addEventListener('click', () => {
        const len = parseInt(btn.dataset['len']!, 10) as 8 | 16;
        this.store.setPatternLength(len);
        this.scheduler.setStepCount(len);
        this.lenBtns.forEach((b) =>
          b.classList.toggle('is-active', b.dataset['len'] === String(len))
        );
      });
    }

    this.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      const active = this.store.snapshot.activePatternIndex;
      const target = (active + 1) % 4;
      this.store.copyPattern(active, target);
    });

    this.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
      if (confirm('Clear active pattern?')) this.store.clearPattern();
    });

    // Store subscriptions.
    this.unsubs.push(
      this.store.on('bpm-changed', ({ bpm }) => {
        this.bpmInput.value = String(bpm);
      }),
      this.store.on('pattern-switched', ({ index }) => {
        this.patternBtns.forEach((b) =>
          b.classList.toggle('is-active', b.dataset['pattern'] === String(index))
        );
      }),
    );
  }

  private _play(): void {
    if (this.scheduler.isRunning) {
      // Already running — restart from top.
      this.scheduler.stop();
    }
    this.scheduler.start();
    this._setPlayState('playing');
  }

  private _pause(): void {
    if (this.scheduler.isRunning) {
      this.scheduler.pause();
      this._setPlayState('paused');
    } else {
      this.scheduler.resume();
      this._setPlayState('playing');
    }
  }

  private _stop(): void {
    this.scheduler.stop();
    this._setPlayState('stopped');
  }

  private _setPlayState(state: 'playing' | 'paused' | 'stopped'): void {
    this.playBtn.classList.toggle('is-active', state === 'playing');
    this.pauseBtn.classList.toggle('is-active', state === 'paused');
    this.setAttribute('data-playstate', state);
  }

  private _tapTempo(): void {
    const now = performance.now();
    this.tapTimes.push(now);
    // Keep last 8 taps for averaging.
    if (this.tapTimes.length > 8) this.tapTimes.shift();
    if (this.tapTimes.length < 2) return;
    const gaps: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      gaps.push(this.tapTimes[i]! - this.tapTimes[i - 1]!);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const bpm = Math.round(60_000 / avgGap);
    const clamped = Math.max(40, Math.min(240, bpm));
    this.store.setBpm(clamped);
    this.scheduler.setBpm(clamped);
    this.bpmInput.value = String(clamped);
  }

  /** Called by App when space bar is pressed. */
  handleSpaceKey(): void {
    if (this.scheduler.isRunning) this._pause();
    else this._play();
  }
}

customElements.define('gr-transport', GrTransport);
