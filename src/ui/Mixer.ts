import type { AudioEngine } from '../audio/AudioEngine';
import type { ProjectStore } from '../state/ProjectStore';
import { CHANNEL_ORDER, CHANNEL_LABELS } from '../audio/types';
import type { ChannelId } from '../audio/types';
import { GrKnob } from './Knob';

/**
 * <gr-mixer> — per-channel volume fader + pan knob + master volume.
 */
export class GrMixer extends HTMLElement {
  private engine!: AudioEngine;
  private store!: ProjectStore;
  private unsubs: (() => void)[] = [];

  init(engine: AudioEngine, store: ProjectStore): void {
    this.engine = engine;
    this.store = store;
    this._build();
    this._wire();
  }

  disconnectedCallback(): void {
    for (const u of this.unsubs) u();
  }

  private _build(): void {
    this.className = 'mixer';
    this.innerHTML = `
      <div class="mixer__header">
        <span class="mixer__title">MIXER</span>
      </div>
      <div class="mixer__channels"></div>
      <div class="mixer__master">
        <span class="mixer__master-label">MASTER</span>
        <gr-knob label="Volume" min="0" max="1" value="0.8" default="0.8" size="md" class="mixer__master-vol"></gr-knob>
      </div>
    `;

    const chArea = this.querySelector('.mixer__channels')!;
    for (const id of CHANNEL_ORDER) {
      const cfg = this.store.getChannel(id);
      const strip = document.createElement('div');
      strip.className = 'mixer__strip';
      strip.dataset['channel'] = id;
      strip.innerHTML = `
        <span class="mixer__strip-label">${CHANNEL_LABELS[id]}</span>
        <gr-knob label="Pan" min="-1" max="1" value="0" default="0" size="sm" class="mixer__pan"></gr-knob>
        <gr-knob label="Vol" min="0" max="1" value="${cfg.volume}" default="0.8" size="sm" class="mixer__vol"></gr-knob>
      `;
      chArea.appendChild(strip);
    }
  }

  private _wire(): void {
    // Per-channel knobs.
    for (const strip of this.querySelectorAll<HTMLElement>('.mixer__strip')) {
      const id = strip.dataset['channel'] as ChannelId;
      strip.querySelector<GrKnob>('.mixer__vol')?.addEventListener('change', (e) => {
        const v = (e as CustomEvent<{ value: number }>).detail.value;
        this.store.setChannelVolume(id, v);
        this.engine.getBus(id).setVolume(v);
      });
      strip.querySelector<GrKnob>('.mixer__pan')?.addEventListener('change', (e) => {
        const v = (e as CustomEvent<{ value: number }>).detail.value;
        this.store.setChannelPan(id, v);
        this.engine.getBus(id).setPan(v);
      });
    }

    // Master volume.
    this.querySelector<GrKnob>('.mixer__master-vol')?.addEventListener('change', (e) => {
      const v = (e as CustomEvent<{ value: number }>).detail.value;
      this.store.setMasterVolume(v);
      this.engine.setMasterVolume(v);
    });

    // Sync from store events.
    this.unsubs.push(
      this.store.on('channel-updated', ({ channel }) => {
        const strip = this.querySelector<HTMLElement>(`[data-channel="${channel.id}"]`);
        const vol = strip?.querySelector<GrKnob>('.mixer__vol');
        const pan = strip?.querySelector<GrKnob>('.mixer__pan');
        if (vol) vol.value = channel.volume;
        if (pan) pan.value = channel.pan;
      }),
      this.store.on('master-volume-changed', ({ volume }) => {
        const knob = this.querySelector<GrKnob>('.mixer__master-vol');
        if (knob) knob.value = volume;
      }),
    );
  }
}

customElements.define('gr-mixer', GrMixer);
