# GR-808

A web-based drum machine, step sequencer, and monosynth built on the Web Audio API and Tone.js. Inspired by the Roland TR-808.

---

## Features

- **8-channel drum kit** — kick, snare, closed hat, open hat, clap, tom, ride, crash. All synthesized; drag-drop a WAV/MP3 onto any channel to replace the synth voice with your own sample.
- **16-step sequencer** — 4 patterns (A/B/C/D), switchable pattern length (8 or 16 steps), copy and clear.
- **Velocity per step** — right-click any step to cycle soft/medium/hard. Color-coded on the grid.
- **MonoSynth** — oscillator (sine/triangle/saw/square), lowpass filter with cutoff and resonance, full ADSR envelope, arpeggiator (up/down/up-down/random).
- **Mixer** — per-channel volume and pan knobs, mute, solo, and master volume. All via SVG rotary knobs.
- **On-screen keyboard** — 2 octaves (C3–B4). Mouse click or QWERTY keys to play the synth.
- **Save / Load** — named slots in localStorage, JSON export/import, shareable URL via location hash.
- **Sample-accurate timing** — Tone.Transport lookahead scheduler; all audio triggers use the scheduled `time` argument, never `ctx.currentTime`.

---

## Controls

### Transport

| Control | Action |
|---------|--------|
| **Space** | Play / pause |
| **Play** | Start from step 1 |
| **Pause** | Pause (resume holds position) |
| **Stop** | Stop and reset to step 1 |
| **BPM** | Type a value (40–240) or use Tap Tempo |
| **TAP** | Click rhythmically to set BPM |
| **A/B/C/D** | Switch pattern |
| **8 / 16** | Set pattern length for the active pattern |
| **Copy** | Copy active pattern to the next slot |
| **Clear** | Clear active pattern |

### Step Grid

| Action | Effect |
|--------|--------|
| Left-click step | Toggle on/off |
| Right-click step | Cycle velocity (soft → medium → hard) |
| Shift + left-click | Cycle velocity without toggling |
| Drag WAV/MP3 onto channel | Load sample for that channel |
| Click **x** on sample name | Revert to synthesized voice |
| **M** button | Mute channel |
| **S** button | Solo channel |

### Synth / Keyboard

| Key | Note |
|-----|------|
| A | C3 |
| W | C#3 |
| S | D3 |
| E | D#3 |
| D | E3 |
| F | F3 |
| T | F#3 |
| G | G3 |
| Y | G#3 |
| H | A3 |
| U | A#3 |
| J | B3 |
| K | C4 |
| O | C#4 |
| L | D4 |
| P | D#4 |
| ; | E4 |

### Knobs

| Gesture | Effect |
|---------|--------|
| Drag up/down | Adjust value |
| Shift + drag | Fine adjustment (10x slower) |
| Double-click | Reset to default |

---

## Local setup

```bash
git clone https://github.com/olukareem/GR-808.git
cd GR-808
npm install
npm run dev
```

Open `http://localhost:5173`. Click **Start** to enable the AudioContext (browsers require a user gesture before audio plays).

### Build

```bash
npm run build     # type-check + Vite build to dist/
npm run preview   # serve the built output locally
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. Framework preset auto-detects as Vite. No extra config needed (`vercel.json` is included).
4. Deploy. Takes about 30 seconds.

---

## Stack

- TypeScript (strict) — no framework
- Vite 5 — dev server and build
- Tone.js 14 — Transport scheduling and lookahead clock
- Web Audio API — raw audio nodes for all synth voices
- Custom elements — `<gr-app>`, `<gr-channel>`, `<gr-knob>`, etc.
- SCSS — dark theme, no external CSS library
