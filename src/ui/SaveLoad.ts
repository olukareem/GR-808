import type { ProjectStore } from '../state/ProjectStore';
import type { Persistence } from '../state/Persistence';

/**
 * <gr-save-load> — named save slots, JSON export/import, URL share.
 */
export class GrSaveLoad extends HTMLElement {
  private store!: ProjectStore;
  private persistence!: Persistence;
  private slotList!: HTMLUListElement;
  private slotNameInput!: HTMLInputElement;

  init(store: ProjectStore, persistence: Persistence): void {
    this.store = store;
    this.persistence = persistence;
    this._build();
    this._wire();
  }

  private _build(): void {
    this.className = 'save-load';
    this.innerHTML = `
      <div class="save-load__header">
        <span class="save-load__title">SAVE / LOAD</span>
      </div>
      <div class="save-load__row">
        <input class="save-load__name-input" type="text" placeholder="Slot name..." maxlength="32" />
        <button class="btn btn--sm" data-action="save">Save</button>
        <button class="btn btn--sm" data-action="share" title="Copy shareable URL to clipboard">Share URL</button>
      </div>
      <ul class="save-load__slots"></ul>
      <div class="save-load__row save-load__row--import">
        <button class="btn btn--sm" data-action="export-json">Export JSON</button>
        <button class="btn btn--sm" data-action="import-json">Import JSON</button>
      </div>
      <div class="save-load__toast" aria-live="polite"></div>
    `;
    this.slotList = this.querySelector('.save-load__slots')!;
    this.slotNameInput = this.querySelector('.save-load__name-input')!;
    this._refreshSlots();
  }

  private _wire(): void {
    this.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const name = this.slotNameInput.value.trim() || 'untitled';
      this.persistence.saveSlot(name, this.store.snapshot);
      this.slotNameInput.value = '';
      this._refreshSlots();
      this._toast(`Saved "${name}"`);
    });

    this.querySelector('[data-action="share"]')?.addEventListener('click', () => {
      const hash = this.persistence.toHash(this.store.snapshot);
      window.location.hash = hash;
      navigator.clipboard.writeText(window.location.href).then(
        () => this._toast('URL copied to clipboard'),
        () => this._toast('URL updated in address bar'),
      );
    });

    this.querySelector('[data-action="export-json"]')?.addEventListener('click', () => {
      const json = this.persistence.exportJson(this.store.snapshot);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gr808-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    this.querySelector('[data-action="import-json"]')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const state = this.persistence.importJson(reader.result as string);
          if (state) {
            this.store.replace(state);
            this._toast('Project loaded');
          } else {
            this._toast('Failed to load project — invalid file');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }

  private _refreshSlots(): void {
    const slots = this.persistence.listSlots();
    this.slotList.innerHTML = slots.length
      ? slots.map((s) => `
          <li class="save-load__slot" data-slot="${s}">
            <span class="save-load__slot-name">${s}</span>
            <button class="btn btn--xs" data-load="${s}">Load</button>
            <button class="btn btn--xs btn--danger" data-delete="${s}">Del</button>
          </li>`).join('')
      : '<li class="save-load__slot save-load__slot--empty">No saved slots</li>';

    this.slotList.querySelectorAll<HTMLButtonElement>('[data-load]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset['load']!;
        const state = this.persistence.loadSlot(name);
        if (state) { this.store.replace(state); this._toast(`Loaded "${name}"`); }
        else this._toast(`Could not load "${name}"`);
      });
    });
    this.slotList.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset['delete']!;
        if (confirm(`Delete slot "${name}"?`)) {
          this.persistence.deleteSlot(name);
          this._refreshSlots();
        }
      });
    });
  }

  private _toast(msg: string): void {
    const el = this.querySelector<HTMLElement>('.save-load__toast')!;
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(() => el.classList.remove('is-visible'), 2500);
  }
}

customElements.define('gr-save-load', GrSaveLoad);
