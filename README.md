# GR-808

A browser-based drum machine, step sequencer, and monosynth — built from scratch on the Web Audio API and Tone.js. No framework. No UI library. Fully sample-accurate timing.

**[Live demo → gr-808.vercel.app](https://gr-808.vercel.app)**

---

## What it does

- **8 synthesized drum channels** — kick, snare, closed hat, open hat, clap, tom, ride, crash. Each uses a purpose-built Web Audio synthesis chain (oscillators, noise generators, waveshapers, envelope-controlled gain). Drag a WAV or MP3 onto any channel to swap the synth voice with your own sample — decoded via `decodeAudioData`, cached, and routed through the same mix bus.
- **16-step sequencer** — 4 patterns (A–D), switchable between 8 and 16 steps per pattern, copy and clear. Velocity per step (soft / medium / hard) set by right-click or Shift+click.
- **MonoSynth** — sine / triangle / saw / square oscillator, lowpass filter with cutoff and resonance, full ADSR envelope, arpeggiator (up / down / up-down / random). Triggered by on-screen keyboard or QWERTY keys.
- **Mixer** — per-channel volume and pan (SVG rotary knobs with fine-control mode), mute, solo, master volume, and a `DynamicsCompressorNode` limiter on the master bus.
- **Save / Load** — named slots in `localStorage`, JSON export/import, shareable URL via `location.hash` (full project state base64url-encoded into the hash).
- **Responsive** — works at tablet width (768px+); the step grid always gets full width.

---

## How the timing works

Getting a drum machine timing-tight in a browser is the hard part. The approach here follows the Chris Wilson lookahead scheduler pattern, via Tone.js Transport:

```ts
Tone.getTransport().scheduleRepeat((audioTime) => {
  // audioTime is a sample-accurate future timestamp from
  // the AudioContext clock — never ctx.currentTime
  instruments[ch].trigger(audioTime, { velocity });
}, '16n');
```

Every instrument trigger receives the scheduled `audioTime` and passes it directly to `AudioNode.start(time)` or `AudioParam.setValueAtTime(value, time)`. This keeps drum hits sample-accurate regardless of JavaScript event loop jitter or GC pauses.

DOM updates (playhead highlight) use `Tone.getDraw().schedule()` — Tone's `requestAnimationFrame`-aligned bridge that fires as close to the audio event as the display refresh allows, without blocking the audio thread.

One non-obvious Tone.js v14 detail: after `Tone.setContext(myCtx)`, the static `Tone.Transport` property still points to the old default-context singleton. `Tone.getTransport()` is required to get the active-context-aware instance. Same for `Tone.getDraw()`.

---

## Audio graph

```
Kick  ──────────────────────────────────┐
Snare ──────────────────────────────────┤
Hat (closed) ───────────────────────────┤
Hat (open) ─────────────────────────────┤──► per-channel GainNode
Clap  ──────────────────────────────────┤         │
Tom   ──────────────────────────────────┤         ▼
Ride  ──────────────────────────────────┤    StereoPannerNode
Crash ──────────────────────────────────┤         │
                                        │         ▼
MonoSynth ──────────────────────────────┘    masterBus (GainNode)
  osc → BiquadFilter → VCA (ADSR)                  │
                                                    ▼
                                          DynamicsCompressor
                                                    │
                                                    ▼
                                           ctx.destination
```

The compressor acts as a soft limiter — prevents clipping when multiple channels hit on the same step.

---

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict) | Type safety on audio params and state shape |
| Build | Vite 5 | Sub-second HMR, native ESM, manual chunk split for Tone.js |
| Scheduling | Tone.js 14 | Lookahead Transport + Draw API |
| Audio | Web Audio API | Direct node graph — no abstraction over oscillators/filters |
| UI | Vanilla custom elements | Zero framework overhead for a single-page audio tool |
| CSS | SCSS + CSS custom properties | Dark theme, no external library |
| State | Plain EventTarget-based store | Typed event maps, no reactive framework |
| Deploy | Vercel | Git-connected, auto-deploy on push |

---

## Controls

### Transport

| Control | Action |
|---------|--------|
| Space | Play / pause |
| Play button | Start from step 1 |
| Pause button | Pause (resume holds position) |
| Stop button | Stop and reset to step 1 |
| BPM field | Type a value (40–240) |
| TAP | Click rhythmically to set BPM |
| A / B / C / D | Switch pattern |
| 8 / 16 | Set step count for the active pattern |
| Copy | Duplicate active pattern to the next slot |
| Clear | Zero out the active pattern |

### Step grid

| Action | Effect |
|--------|--------|
| Left-click step | Toggle on / off |
| Right-click step | Cycle velocity (soft → medium → hard) |
| Shift + left-click | Cycle velocity without toggling |
| Drag WAV / MP3 onto channel strip | Load sample for that channel |
| Click ✕ on sample name | Revert to synthesized voice |
| M button | Mute channel |
| S button | Solo channel |

### QWERTY keyboard map

```
White keys:  A  S  D  F  G  H  J  K  L  ;
             C3 D3 E3 F3 G3 A3 B3 C4 D4 E4

Black keys:  W  E     T  Y  U     O  P
             C# D#    F# G# A#    C# D#
```

### Knobs

| Gesture | Effect |
|---------|--------|
| Drag up / down | Adjust value |
| Shift + drag | Fine mode (10× slower) |
| Double-click | Reset to default |

---

## Local setup

```bash
git clone https://github.com/olukareem/GR-808.git
cd GR-808
npm install
npm run dev
```

Open `http://localhost:5173` and click **Start** — browsers require a user gesture before `AudioContext` can run.

```bash
npm run build    # tsc --noEmit + Vite production build → dist/
npm run preview  # serve the built output at localhost:4173
```

---

## Project structure

```
src/
├── audio/
│   ├── AudioEngine.ts        # AudioContext, master bus, compressor
│   ├── Scheduler.ts          # Tone.Transport wrapper
│   ├── MonoSynth.ts          # Subtractive monosynth (osc → filter → VCA)
│   ├── MixBus.ts             # Per-channel gain + panner
│   ├── SampleLoader.ts       # decodeAudioData + buffer cache
│   ├── Arpeggiator.ts        # Note sequence generator
│   └── instruments/          # SynthKick, SynthSnare, SynthHat, SynthClap, etc.
├── state/
│   ├── ProjectStore.ts       # Typed EventTarget store, all app state
│   ├── Persistence.ts        # localStorage slots + URL hash codec
│   └── types.ts              # StepState, ChannelConfig, Pattern, ProjectState
└── ui/
    ├── App.ts                # Root custom element, bootstrap
    ├── StepGrid.ts           # 8ch × 16-step grid, playhead wiring
    ├── Channel.ts            # Channel row: label, mute/solo, steps, drop zone
    ├── Knob.ts               # SVG rotary knob custom element
    ├── Mixer.ts              # Master + per-channel faders
    ├── SynthPanel.ts         # Osc selector, filter/ADSR knobs, arp mode
    ├── Keyboard.ts           # On-screen piano + QWERTY handler
    ├── TransportBar.ts       # Play/pause/stop, BPM, tap tempo, pattern select
    └── SaveLoad.ts           # Slot UI, export/import, share URL
```
