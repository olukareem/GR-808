import './styles/index.scss';

// Register all custom elements before anything renders.
import './ui/Knob';
import './ui/TransportBar';
import './ui/Channel';
import './ui/StepGrid';
import './ui/Mixer';
import './ui/SynthPanel';
import './ui/Keyboard';
import './ui/SaveLoad';
import './ui/App';

import { AudioEngine } from './audio/AudioEngine';
import { Scheduler } from './audio/Scheduler';
import { ProjectStore } from './state/ProjectStore';
import { Persistence } from './state/Persistence';
import type { GrApp } from './ui/App';

const engine = new AudioEngine();
const scheduler = new Scheduler();
const store = new ProjectStore();
const persistence = new Persistence();

// Sync initial BPM.
scheduler.setBpm(store.snapshot.bpm);

// Boot the root element.
const app = document.querySelector<GrApp>('gr-app')!;
app.boot(engine, scheduler, store, persistence);
