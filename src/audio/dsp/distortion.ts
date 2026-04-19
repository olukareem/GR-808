/**
 * Waveshaper distortion curve.
 *
 * Ported from the original GR-808 `kick.ts`. The curve bends the input signal
 * asymmetrically — small `amount` values add warmth, larger values crunch.
 *
 * @param amount 0 = bypass, 50 = aggressive.
 * @param samples Number of curve samples (default 44_100 for smoothness).
 */
export function makeDistortionCurve(amount: number, samples = 44_100): Float32Array {
  const curve = new Float32Array(samples);
  const k = amount / 4;
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Generate a white-noise AudioBuffer. Used by snare/hat/clap as their noise source.
 * Regenerating on demand gives every instance its own sample sequence.
 */
export function makeNoiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}
