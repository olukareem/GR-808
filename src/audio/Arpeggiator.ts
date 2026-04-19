/**
 * Arpeggiator — converts a set of held notes into a scheduled sequence
 * of single-note triggers following a pattern (up / down / up-down / random).
 *
 * Runs on the sequencer clock: the sequencer calls `noteAtStep(step)` to ask
 * which note (if any) to play on this 16th-note step. This keeps arp timing
 * locked to the transport rather than a separate clock source.
 */
export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random';

export class Arpeggiator {
  mode: ArpMode = 'off';
  /** The chord currently held — usually the notes enabled in the synth row. */
  private notes: string[] = [];
  private cursor = 0;
  private direction: 1 | -1 = 1;

  setNotes(notes: string[]): void {
    // Sort ascending by MIDI pitch so "up"/"down" are predictable.
    this.notes = [...notes].sort((a, b) => this.pitch(a) - this.pitch(b));
    this.cursor = 0;
    this.direction = 1;
  }

  /** Called each 16th-note step. Returns `null` if the arp is off or no notes. */
  tick(): string | null {
    if (this.mode === 'off' || this.notes.length === 0) return null;

    let note: string;
    switch (this.mode) {
      case 'up':
        note = this.notes[this.cursor % this.notes.length]!;
        this.cursor = (this.cursor + 1) % this.notes.length;
        break;
      case 'down':
        note = this.notes[this.notes.length - 1 - (this.cursor % this.notes.length)]!;
        this.cursor = (this.cursor + 1) % this.notes.length;
        break;
      case 'updown':
        note = this.notes[this.cursor]!;
        this.cursor += this.direction;
        if (this.cursor >= this.notes.length - 1) this.direction = -1;
        if (this.cursor <= 0) this.direction = 1;
        this.cursor = Math.max(0, Math.min(this.notes.length - 1, this.cursor));
        break;
      case 'random':
        note = this.notes[Math.floor(Math.random() * this.notes.length)]!;
        break;
      default:
        return null;
    }
    return note;
  }

  private pitch(note: string): number {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
    if (!m) return 0;
    const semi: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let s = semi[m[1]!]!;
    if (m[2] === '#') s += 1;
    if (m[2] === 'b') s -= 1;
    return 12 * (Number.parseInt(m[3]!, 10) + 1) + s;
  }
}
