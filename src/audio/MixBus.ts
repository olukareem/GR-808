/**
 * Per-channel mix strip: input -> gain -> pan -> masterBus.
 * Mute/solo logic lives here; the engine coordinates solo-across-channels.
 */
export class MixBus {
  private readonly ctx: BaseAudioContext;
  /** Public input node — instruments connect to this. */
  readonly input: GainNode;
  private readonly volumeNode: GainNode;
  private readonly pannerNode: StereoPannerNode;

  private _volume = 0.8;
  private _pan = 0;
  private _mute = false;
  /** Applied by engine when any other channel is soloed. */
  private _forceMute = false;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.volumeNode = ctx.createGain();
    this.pannerNode = ctx.createStereoPanner();
    this.input.connect(this.volumeNode).connect(this.pannerNode).connect(destination);
    this.applyGain();
    this.pannerNode.pan.value = this._pan;
  }

  get volume(): number {
    return this._volume;
  }
  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  get pan(): number {
    return this._pan;
  }
  setPan(p: number): void {
    this._pan = Math.max(-1, Math.min(1, p));
    this.pannerNode.pan.setTargetAtTime(this._pan, this.ctx.currentTime, 0.01);
  }

  get mute(): boolean {
    return this._mute;
  }
  setMute(m: boolean): void {
    this._mute = m;
    this.applyGain();
  }

  setForceMute(f: boolean): void {
    this._forceMute = f;
    this.applyGain();
  }

  private applyGain(): void {
    const target = this._mute || this._forceMute ? 0 : this._volume;
    this.volumeNode.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
  }

  dispose(): void {
    this.input.disconnect();
    this.volumeNode.disconnect();
    this.pannerNode.disconnect();
  }
}
