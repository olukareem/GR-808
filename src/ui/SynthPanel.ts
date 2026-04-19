import type { MonoSynth } from '../audio/MonoSynth';
import type { ProjectStore } from '../state/ProjectStore';
import type { OscType } from '../audio/types';
import type { ArpMode } from '../audio/Arpeggiator';
import { GrKnob } from './Knob';

/**
 * <gr-synth> — oscillator selector, filter knobs (cutoff/resonance),
 * ADSR envelope knobs, and arpeggiator mode selector.
 */
export class GrSynthPanel extends HTMLElement {
  private synth!: MonoSynth;
  private store!: ProjectStore;
  private unsubs: (() => void)[] = [];

  init(synth: MonoSynth, store: ProjectStore): void {
    this.synth = synth;
    this.store = store;
    this._build();
    this._wire();
  }

  disconnectedCallback(): void {
    for (const u of this.unsubs) u();
  }

  private _build(): void {
    const p = this.store.snapshot.synth;
    this.className = 'synth-panel';
    this.innerHTML = `
      <div class="synth-panel__header">
        <span class="synth-panel__title">SYNTH</span>
      </div>

      <section class="synth-panel__section">
        <label class="synth-panel__section-label">OSC</label>
        <div class="synth-panel__osc-btns">
          ${(['sine', 'triangle', 'sawtooth', 'square'] as OscType[]).map((t) =>
            `<button class="btn btn--sm synth-panel__osc-btn ${t === p.osc ? 'is-active' : ''}" data-osc="${t}">${t === 'sawtooth' ? 'saw' : t === 'triangle' ? 'tri' : t}</button>`
          ).join('')}
        </div>
      </section>

      <section class="synth-panel__section">
        <label class="synth-panel__section-label">FILTER</label>
        <div class="synth-panel__knobs">
          <gr-knob label="Cutoff" min="80" max="18000" value="${p.cutoff}" default="1400" unit="Hz" size="md"></gr-knob>
          <gr-knob label="Res" min="0.5" max="20" value="${p.resonance}" default="2" size="md"></gr-knob>
        </div>
      </section>

      <section class="synth-panel__section">
        <label class="synth-panel__section-label">ENVELOPE</label>
        <div class="synth-panel__knobs">
          <gr-knob label="Attack" min="0.001" max="2" value="${p.attack}" default="0.01" unit="s" size="md"></gr-knob>
          <gr-knob label="Decay" min="0.01" max="2" value="${p.decay}" default="0.15" unit="s" size="md"></gr-knob>
          <gr-knob label="Sustain" min="0" max="1" value="${p.sustain}" default="0.6" unit="%" size="md"></gr-knob>
          <gr-knob label="Release" min="0.01" max="4" value="${p.release}" default="0.25" unit="s" size="md"></gr-knob>
        </div>
      </section>

      <section class="synth-panel__section">
        <label class="synth-panel__section-label">ARP</label>
        <div class="synth-panel__arp-btns">
          ${(['off', 'up', 'down', 'updown', 'random'] as ArpMode[]).map((m) =>
            `<button class="btn btn--sm synth-panel__arp-btn ${m === p.arp ? 'is-active' : ''}" data-arp="${m}">${m}</button>`
          ).join('')}
        </div>
      </section>
    `;
  }

  private _wire(): void {
    // Oscillator type.
    for (const btn of this.querySelectorAll<HTMLButtonElement>('.synth-panel__osc-btn')) {
      btn.addEventListener('click', () => {
        const osc = btn.dataset['osc'] as OscType;
        this.synth.oscType = osc;
        this.store.updateSynth({ osc });
        this.querySelectorAll('.synth-panel__osc-btn').forEach((b) =>
          b.classList.toggle('is-active', b === btn)
        );
      });
    }

    // Arpeggiator mode.
    for (const btn of this.querySelectorAll<HTMLButtonElement>('.synth-panel__arp-btn')) {
      btn.addEventListener('click', () => {
        const mode = btn.dataset['arp'] as ArpMode;
        this.store.setArp(mode);
        this.querySelectorAll('.synth-panel__arp-btn').forEach((b) =>
          b.classList.toggle('is-active', b === btn)
        );
      });
    }

    // Filter knobs.
    const [cutoffKnob, resKnob] = this.querySelectorAll<GrKnob>('.synth-panel__section:nth-child(3) gr-knob');
    cutoffKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.cutoff = v;
      this.store.updateSynth({ cutoff: v });
    });
    resKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.resonance = v;
      this.store.updateSynth({ resonance: v });
    });

    // ADSR knobs — 4th section.
    const [atkKnob, decKnob, susKnob, relKnob] = this.querySelectorAll<GrKnob>('.synth-panel__section:nth-child(4) gr-knob');
    atkKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.attack = v;
      this.store.updateSynth({ attack: v });
    });
    decKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.decay = v;
      this.store.updateSynth({ decay: v });
    });
    susKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.sustain = v;
      this.store.updateSynth({ sustain: v });
    });
    relKnob?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.synth.release = v;
      this.store.updateSynth({ release: v });
    });

    // Sync from state-replaced (load/URL import).
    this.unsubs.push(
      this.store.on('synth-changed', (patch) => {
        this.synth.oscType = patch.osc;
        this.synth.cutoff = patch.cutoff;
        this.synth.resonance = patch.resonance;
        this.synth.attack = patch.attack;
        this.synth.decay = patch.decay;
        this.synth.sustain = patch.sustain;
        this.synth.release = patch.release;
      }),
    );
  }
}

customElements.define('gr-synth', GrSynthPanel);
