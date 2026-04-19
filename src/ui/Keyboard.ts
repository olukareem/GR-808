import type { MonoSynth } from '../audio/MonoSynth';
import type { ProjectStore } from '../state/ProjectStore';

const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** QWERTY layout: two octaves, C3-B4 mapped across A-Z keys. */
const QWERTY_MAP: Record<string, string> = {
  a: 'C3', w: 'C#3', s: 'D3', e: 'D#3', d: 'E3',
  f: 'F3', t: 'F#3', g: 'G3', y: 'G#3', h: 'A3', u: 'A#3', j: 'B3',
  k: 'C4', o: 'C#4', l: 'D4', p: 'D#4', ';': 'E4',
};

/**
 * <gr-keyboard> — 2-octave on-screen piano keyboard for synth preview.
 * Supports mouse clicks + QWERTY key mapping.
 */
export class GrKeyboard extends HTMLElement {
  private synth!: MonoSynth;
  private store!: ProjectStore;
  private ctx!: AudioContext;
  private heldKeys = new Set<string>();
  private noteEls = new Map<string, HTMLElement>();

  private readonly _onKeyDown: (e: KeyboardEvent) => void;
  private readonly _onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
  }

  init(synth: MonoSynth, store: ProjectStore, ctx: AudioContext): void {
    this.synth = synth;
    this.store = store;
    this.ctx = ctx;
    this._build();
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  private _build(): void {
    this.className = 'keyboard';
    this.innerHTML = '';
    const octaves = [3, 4];
    for (const oct of octaves) {
      const group = document.createElement('div');
      group.className = 'keyboard__octave';
      group.dataset['octave'] = String(oct);
      for (const note of OCTAVE_NOTES) {
        const full = `${note}${oct}`;
        const isBlack = note.includes('#');
        const key = document.createElement('div');
        key.className = `keyboard__key ${isBlack ? 'keyboard__key--black' : 'keyboard__key--white'}`;
        key.dataset['note'] = full;
        key.setAttribute('role', 'button');
        key.setAttribute('aria-label', full);
        group.appendChild(key);
        this.noteEls.set(full, key);
      }
      this.appendChild(group);
    }

    this.addEventListener('mousedown', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('.keyboard__key');
      if (!el) return;
      this._noteOn(el.dataset['note']!);
    });
    this.addEventListener('mouseup', () => this._noteOff());
    this.addEventListener('mouseleave', () => this._noteOff());
  }

  private _noteOn(note: string): void {
    const patch = this.store.snapshot.synth;
    this.synth.oscType = patch.osc;
    this.synth.cutoff = patch.cutoff;
    this.synth.resonance = patch.resonance;
    this.synth.attack = patch.attack;
    this.synth.decay = patch.decay;
    this.synth.sustain = patch.sustain;
    this.synth.release = patch.release;
    this.synth.trigger(this.ctx.currentTime, { note, velocity: 0.85 });
    this.noteEls.get(note)?.classList.add('is-active');
  }

  private _noteOff(): void {
    this.synth.release_(this.ctx.currentTime);
    for (const el of this.noteEls.values()) el.classList.remove('is-active');
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    // Don't steal input focus if user is typing in an input.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const note = QWERTY_MAP[e.key.toLowerCase()];
    if (!note || this.heldKeys.has(e.key)) return;
    this.heldKeys.add(e.key);
    this._noteOn(note);
  }

  private _handleKeyUp(e: KeyboardEvent): void {
    if (!this.heldKeys.has(e.key)) return;
    this.heldKeys.delete(e.key);
    if (this.heldKeys.size === 0) this._noteOff();
  }
}

customElements.define('gr-keyboard', GrKeyboard);
