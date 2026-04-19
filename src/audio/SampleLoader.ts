/**
 * Small cache around AudioContext.decodeAudioData.
 *
 * Sample drops: a user drops a WAV onto a channel → we read it as ArrayBuffer
 * → decode asynchronously → cache by key → swap the channel's instrument to
 * a SampleInstrument pointed at the buffer.
 */
export class SampleLoader {
  private readonly ctx: BaseAudioContext;
  private readonly cache = new Map<string, AudioBuffer>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  async load(file: File): Promise<{ key: string; buffer: AudioBuffer }> {
    const arrayBuffer = await file.arrayBuffer();
    // `decodeAudioData` mutates the ArrayBuffer on some engines, so we clone
    // for the hash to keep the raw bytes stable.
    const hashInput = arrayBuffer.slice(0);
    const hash = await this.hash(hashInput);
    const key = `local:${file.name}:${hash}`;

    const existing = this.cache.get(key);
    if (existing) return { key, buffer: existing };

    const buffer = await this.decode(arrayBuffer);
    this.cache.set(key, buffer);
    return { key, buffer };
  }

  get(key: string): AudioBuffer | null {
    return this.cache.get(key) ?? null;
  }

  private async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // decodeAudioData supports both promise + callback signatures; always await.
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  private async hash(buf: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
