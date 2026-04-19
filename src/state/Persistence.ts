import type { ProjectState } from './types';
import { defaultProject } from './defaults';

const SLOT_PREFIX = 'gr808:slot:';
const SLOT_INDEX_KEY = 'gr808:slots';
const HASH_PREFIX = '#p=';

/**
 * localStorage slot management + URL-hash share serialization.
 *
 * Slots: named user-saved projects (`gr808:slot:<name>`). Hash: whole project
 * JSON base64-urlencoded into location.hash for shareable URLs.
 *
 * We don't persist sample buffers (they can be large and browsers don't let
 * you serialize AudioBuffer). The channel source remembers the filename so
 * users know what to drop back in.
 */
export class Persistence {
  listSlots(): string[] {
    try {
      const raw = localStorage.getItem(SLOT_INDEX_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  saveSlot(name: string, state: ProjectState): void {
    const stripped = this.stripSampleBuffers(state);
    localStorage.setItem(SLOT_PREFIX + name, JSON.stringify(stripped));
    const slots = new Set(this.listSlots());
    slots.add(name);
    localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify([...slots].sort()));
  }

  loadSlot(name: string): ProjectState | null {
    const raw = localStorage.getItem(SLOT_PREFIX + name);
    if (!raw) return null;
    try {
      return this.validate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  deleteSlot(name: string): void {
    localStorage.removeItem(SLOT_PREFIX + name);
    const slots = this.listSlots().filter((s) => s !== name);
    localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(slots));
  }

  exportJson(state: ProjectState): string {
    return JSON.stringify(this.stripSampleBuffers(state), null, 2);
  }

  importJson(raw: string): ProjectState | null {
    try {
      return this.validate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  toHash(state: ProjectState): string {
    const json = JSON.stringify(this.stripSampleBuffers(state));
    // base64url-encode so the URL stays clean.
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return HASH_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  fromHash(hash: string): ProjectState | null {
    if (!hash.startsWith(HASH_PREFIX)) return null;
    const b64 = hash.slice(HASH_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      return this.validate(JSON.parse(json));
    } catch {
      return null;
    }
  }

  /** Basic shape check. Falls back to defaults if the project is a different version. */
  private validate(raw: unknown): ProjectState | null {
    if (!raw || typeof raw !== 'object') return null;
    const candidate = raw as Partial<ProjectState>;
    if (candidate.version !== 1) {
      console.warn('[persistence] unknown project version', candidate.version);
      return null;
    }
    // Merge over defaults so missing fields don't crash the app.
    return { ...defaultProject(), ...candidate } as ProjectState;
  }

  /** Samples can't round-trip through JSON; replace sample sources with synth. */
  private stripSampleBuffers(state: ProjectState): ProjectState {
    return {
      ...state,
      channels: state.channels.map((ch) =>
        ch.source.kind === 'sample' ? { ...ch, source: { kind: 'synth', synthId: ch.id } } : ch,
      ),
    };
  }
}
