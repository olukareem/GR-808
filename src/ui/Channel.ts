import type { AudioEngine } from '../audio/AudioEngine';
import type { ProjectStore } from '../state/ProjectStore';
import type { ChannelId } from '../audio/types';
import type { ChannelConfig, StepState } from '../state/types';

const STEP_COUNT = 16;

/**
 * <gr-channel> — a single drum machine channel row:
 *   [label + controls] [16 step buttons] [drag-drop sample zone]
 *
 * Each step button:
 *   - Left-click: toggle on/off
 *   - Right-click: cycle velocity (soft → medium → hard)
 *   - Shift+click: set velocity without toggling active
 */
export class GrChannel extends HTMLElement {
  private engine!: AudioEngine;
  private store!: ProjectStore;
  private channelId!: ChannelId;
  private stepBtns: HTMLButtonElement[] = [];
  private unsubs: (() => void)[] = [];
  private config!: ChannelConfig;

  init(id: ChannelId, engine: AudioEngine, store: ProjectStore): void {
    this.channelId = id;
    this.engine = engine;
    this.store = store;
    this.config = store.getChannel(id);
    this.dataset['channel'] = id;
    this._build();
    this._wire();
    this._syncSteps();
  }

  disconnectedCallback(): void {
    for (const u of this.unsubs) u();
  }

  /** Highlight or un-highlight the current playhead step. */
  setActiveStep(step: number | null, flash = false): void {
    for (let i = 0; i < this.stepBtns.length; i++) {
      const btn = this.stepBtns[i]!;
      const isActive = i === step;
      btn.classList.toggle('is-playing', isActive);
      if (isActive && flash && btn.classList.contains('is-on')) {
        btn.classList.add('is-flash');
        setTimeout(() => btn.classList.remove('is-flash'), 80);
      }
    }
  }

  private _build(): void {
    const ch = this.config;
    this.className = 'channel';
    this.innerHTML = `
      <div class="channel__head">
        <div class="channel__name">${ch.label}</div>
        <div class="channel__ctrls">
          <button class="btn btn--xs channel__mute ${ch.mute ? 'is-active' : ''}" title="Mute">M</button>
          <button class="btn btn--xs channel__solo" title="Solo">S</button>
        </div>
        <div class="channel__drop" title="Drop WAV/MP3 here to replace synth voice">
          ${ch.source.kind === 'sample' ? `<span class="channel__sample-name">${ch.source.filename}</span><button class="btn btn--xs channel__revert" title="Revert to synth">✕</button>` : '<span class="channel__drop-hint">drop sample</span>'}
        </div>
      </div>
      <div class="channel__steps"></div>
    `;

    const stepsEl = this.querySelector('.channel__steps')!;
    for (let i = 0; i < STEP_COUNT; i++) {
      const btn = document.createElement('button');
      btn.className = 'step-btn';
      btn.dataset['step'] = String(i);
      btn.setAttribute('aria-label', `Step ${i + 1}`);
      // Group visual separator every 4 steps.
      if (i % 4 === 0) btn.classList.add('step-btn--group-start');
      stepsEl.appendChild(btn);
      this.stepBtns.push(btn);
    }
  }

  private _wire(): void {
    const stepsEl = this.querySelector('.channel__steps')!;

    stepsEl.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('.step-btn');
      if (!btn) return;
      const step = parseInt(btn.dataset['step']!, 10);
      if ((e as MouseEvent).shiftKey) {
        // Cycle velocity without toggling.
        const cur = this.store.activePattern.channels[this.channelId]![step]!;
        const next: import('../audio/types').VelocityLabel =
          cur.velocity === 'soft' ? 'medium' : cur.velocity === 'medium' ? 'hard' : 'soft';
        this.store.setStepVelocity(this.channelId, step, next);
      } else {
        this.store.toggleStep(this.channelId, step);
      }
    });

    stepsEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const btn = (e.target as Element).closest<HTMLButtonElement>('.step-btn');
      if (!btn) return;
      const step = parseInt(btn.dataset['step']!, 10);
      const cur = this.store.activePattern.channels[this.channelId]![step]!;
      const next: import('../audio/types').VelocityLabel =
        cur.velocity === 'soft' ? 'medium' : cur.velocity === 'medium' ? 'hard' : 'soft';
      this.store.setStepVelocity(this.channelId, step, next);
    });

    // Mute / Solo.
    this.querySelector('.channel__mute')?.addEventListener('click', () => {
      const ch = this.store.getChannel(this.channelId);
      const next = !ch.mute;
      this.store.setChannelMute(this.channelId, next);
      this.engine.getBus(this.channelId).setMute(next);
    });

    this.querySelector('.channel__solo')?.addEventListener('click', () => {
      const next = !this.engine.isSoloed(this.channelId);
      this.engine.setSolo(this.channelId, next);
      this.store.setChannelSolo(this.channelId, next);
    });

    // Sample drop zone.
    const drop = this.querySelector('.channel__drop') as HTMLElement;
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      try {
        const loader = this.engine.sampleLoader;
        const { key, buffer } = await loader.load(file);
        this.engine.useSample(this.channelId, buffer);
        this.store.setChannelSample(this.channelId, file.name, key);
      } catch (err) {
        console.error('Sample load failed', err);
      }
    });

    // Revert button (created only when sample is loaded).
    this.addEventListener('click', (e) => {
      if ((e.target as Element).classList.contains('channel__revert')) {
        this.engine.revertToSynth(this.channelId);
        this.store.revertChannelToSynth(this.channelId);
      }
    });

    // Store subscriptions.
    this.unsubs.push(
      this.store.on('step-changed', ({ channel, step, state }) => {
        if (channel !== this.channelId) return;
        this._renderStep(step, state);
      }),
      this.store.on('pattern-switched', () => this._syncSteps()),
      this.store.on('pattern-cleared', () => this._syncSteps()),
      this.store.on('channel-updated', ({ channel }) => {
        if (channel.id !== this.channelId) return;
        this.config = channel;
        this._syncControls();
      }),
    );
  }

  private _syncSteps(): void {
    const rows = this.store.activePattern.channels[this.channelId] ?? [];
    for (let i = 0; i < this.stepBtns.length; i++) {
      this._renderStep(i, rows[i] ?? { active: false, velocity: 'medium' });
    }
  }

  private _renderStep(i: number, state: StepState): void {
    const btn = this.stepBtns[i];
    if (!btn) return;
    btn.classList.toggle('is-on', state.active);
    btn.dataset['velocity'] = state.velocity;
    btn.setAttribute('aria-pressed', String(state.active));
  }

  private _syncControls(): void {
    const ch = this.config;
    this.querySelector('.channel__mute')?.classList.toggle('is-active', ch.mute);
    this.querySelector('.channel__solo')?.classList.toggle('is-active', ch.solo);
    // Refresh drop zone display.
    const drop = this.querySelector('.channel__drop')!;
    if (ch.source.kind === 'sample') {
      drop.innerHTML = `<span class="channel__sample-name">${ch.source.filename}</span><button class="btn btn--xs channel__revert" title="Revert to synth">✕</button>`;
    } else {
      drop.innerHTML = '<span class="channel__drop-hint">drop sample</span>';
    }
  }
}

customElements.define('gr-channel', GrChannel);
