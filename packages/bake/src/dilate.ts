/**
 * Fills the gutters round each chart: every empty texel next to filled ones takes their average,
 * pass after pass, out to `reach` texels, so bilinear filtering and the first mip levels never
 * reach the background. Each image holds `channels` floats per texel; they share one coverage,
 * `filled`, which marks the texels the charts cover and is updated as the gutters fill.
 */
export function dilate(
  images: readonly { readonly data: Float32Array; readonly channels: number }[],
  size: number,
  filled: Uint8Array,
  reach: number,
): void {
  // All the images as one, so the neighbourhoods are walked once.
  let channels = 0;
  for (const im of images) channels += im.channels;
  const image = new Float32Array(size * size * channels);
  let offset = 0;
  for (const im of images) {
    for (let k = 0; k < size * size; k++)
      for (let c = 0; c < im.channels; c++)
        image[k * channels + offset + c] = im.data[k * im.channels + c] as number;
    offset += im.channels;
  }
  spread(image, channels, size, filled, reach);
  offset = 0;
  for (const im of images) {
    for (let k = 0; k < size * size; k++)
      for (let c = 0; c < im.channels; c++)
        im.data[k * im.channels + c] = image[k * channels + offset + c] as number;
    offset += im.channels;
  }
}

function spread(
  image: Float32Array,
  channels: number,
  size: number,
  filled: Uint8Array,
  reach: number,
): void {
  // 0 empty, 1 filled, 2 queued for this pass.
  const state = filled;
  let front = new Int32Array(size * 4);
  let count = 0;
  const push = (k: number) => {
    if (count === front.length) {
      const grown = new Int32Array(front.length * 2);
      grown.set(front);
      front = grown;
    }
    front[count++] = k;
  };
  const queueAround = (k: number) => {
    const x = k % size;
    const y = (k - x) / size;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= size) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= size) continue;
        const j = ny * size + nx;
        if (state[j] === 0) {
          state[j] = 2;
          push(j);
        }
      }
    }
  };
  for (let k = 0; k < size * size; k++) if (state[k] === 1) queueAround(k);
  const values = new Float32Array(channels);
  let next = new Float32Array(0);
  for (let pass = 0; pass < reach && count > 0; pass++) {
    if (next.length < count * channels) next = new Float32Array(count * channels * 2);
    const written = new Uint8Array(count);
    // Read every queued texel's filled neighbours before writing any, so a pass grows the charts
    // by exactly one texel.
    for (let i = 0; i < count; i++) {
      const k = front[i] as number;
      const x = k % size;
      const y = (k - x) / size;
      values.fill(0);
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= size || (dx === 0 && dy === 0)) continue;
          const j = ny * size + nx;
          if (state[j] !== 1) continue;
          for (let c = 0; c < channels; c++)
            values[c] = (values[c] as number) + (image[j * channels + c] as number);
          n++;
        }
      }
      if (n === 0) continue;
      written[i] = 1;
      for (let c = 0; c < channels; c++) next[i * channels + c] = (values[c] as number) / n;
    }
    const done = front.subarray(0, count).slice();
    count = 0;
    for (let i = 0; i < done.length; i++) {
      const k = done[i] as number;
      if (!written[i]) {
        state[k] = 0;
        continue;
      }
      for (let c = 0; c < channels; c++) image[k * channels + c] = next[i * channels + c] as number;
      state[k] = 1;
    }
    for (let i = 0; i < done.length; i++) if (written[i]) queueAround(done[i] as number);
  }
  // Texels queued but never reached stay empty.
  for (let i = 0; i < count; i++)
    if (state[front[i] as number] === 2) state[front[i] as number] = 0;
}
