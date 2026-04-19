import type { AudioEngine } from '../audio/AudioEngine';
import type { Scheduler } from '../audio/Scheduler';
import type { ProjectStore } from '../state/ProjectStore';
import type { Persistence } from '../state/Persistence';
import type { GrTransport } from './TransportBar';
import type { GrStepGrid } from './StepGrid';
import type { GrMixer } from './Mixer';
import type { GrSynthPanel } from './SynthPanel';
import type { GrKeyboard } from './Keyboard';
import type { GrSaveLoad } from './SaveLoad';

/**
 * <gr-app> — root shell. Renders the layout and kicks off all sub-elements.
 *
 * The AudioContext must start from a user gesture; we gate the first play
 * behind a click on the "Start audio" overlay.
 */
export class GrApp extends HTMLElement {
  private engine!: AudioEngine;
  private scheduler!: Scheduler;
  private store!: ProjectStore;
  private persistence!: Persistence;

  private transport!: GrTransport;

  boot(engine: AudioEngine, scheduler: Scheduler, store: ProjectStore, persistence: Persistence): void {
    this.engine = engine;
    this.scheduler = scheduler;
    this.store = store;
    this.persistence = persistence;
    this._render();
    this._wireGlobalKeys();
    this._checkUrlHash();
  }

  private _render(): void {
    this.innerHTML = `
      <div class="overlay" id="audio-overlay">
        <div class="overlay__inner">
          <h1 class="overlay__title">GR-808</h1>
          <p class="overlay__sub">Drum machine / Sequencer / Synthesizer</p>
          <button class="btn btn--start" id="start-btn">Start</button>
        </div>
      </div>

      <div class="app-layout" id="app-layout" hidden>
        <header class="app-header">
          <div class="app-header__brand">GR-808</div>
          <gr-transport class="app-header__transport"></gr-transport>
          <gr-save-load class="app-header__save"></gr-save-load>
        </header>

        <main class="app-main">
          <section class="app-main__drums">
            <gr-step-grid></gr-step-grid>
          </section>
          <aside class="app-main__right">
            <gr-synth></gr-synth>
            <gr-mixer></gr-mixer>
          </aside>
        </main>

        <footer class="app-footer">
          <gr-keyboard class="app-footer__keyboard"></gr-keyboard>
          <div class="app-footer__hints">
            <span>SPACE play/pause</span>
            <span>Right-click step = cycle velocity</span>
            <span>Shift+drag knob = fine</span>
            <span>Dbl-click knob = reset</span>
          </div>
        </footer>
      </div>
    `;

    document.getElementById('start-btn')?.addEventListener('click', () => this._start());
  }

  private async _start(): Promise<void> {
    await this.engine.resume();

    const layout = document.getElementById('app-layout');
    const overlay = document.getElementById('audio-overlay');
    if (overlay) overlay.remove();
    if (layout) layout.hidden = false;

    this._initComponents();
  }

  private _initComponents(): void {
    this.transport = this.querySelector<GrTransport>('gr-transport')!;
    this.transport.init(this.scheduler, this.store);

    const grid = this.querySelector<GrStepGrid>('gr-step-grid')!;
    grid.init(this.engine, this.scheduler, this.store);

    const mixer = this.querySelector<GrMixer>('gr-mixer')!;
    mixer.init(this.engine, this.store);

    const synthPanel = this.querySelector<GrSynthPanel>('gr-synth')!;
    synthPanel.init(this.engine.synth, this.store);

    const keyboard = this.querySelector<GrKeyboard>('gr-keyboard')!;
    keyboard.init(this.engine.synth, this.store, this.engine.ctx);

    const saveLoad = this.querySelector<GrSaveLoad>('gr-save-load')!;
    saveLoad.init(this.store, this.persistence);

    // When a full state is replaced (load / URL import), re-sync the engine.
    this.store.on('state-replaced', (state) => {
      this.scheduler.setBpm(state.bpm);
      for (const ch of state.channels) {
        this.engine.getBus(ch.id).setVolume(ch.volume);
        this.engine.getBus(ch.id).setPan(ch.pan);
        this.engine.getBus(ch.id).setMute(ch.mute);
      }
      this.engine.setMasterVolume(state.master.volume);
    });
  }

  private _wireGlobalKeys(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        this.transport?.handleSpaceKey();
      }
    });
  }

  private _checkUrlHash(): void {
    const hash = window.location.hash;
    if (hash.startsWith('#p=')) {
      const state = this.persistence.fromHash(hash);
      if (state) this.store.replace(state);
    }
  }
}

customElements.define('gr-app', GrApp);
