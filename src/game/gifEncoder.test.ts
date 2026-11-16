import { GifEncoder } from './gifEncoder.ts';

console.log('Testing GIF Encoder...');

// Create a 20x20 2-frame animated test GIF
const w = 20;
const h = 20;
const encoder = new GifEncoder(w, h);

// Frame 1: Red box
const f1 = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) {
  f1[i * 4] = 255;     // R
  f1[i * 4 + 1] = 0;   // G
  f1[i * 4 + 2] = 0;   // B
  f1[i * 4 + 3] = 255; // A
}
encoder.addFrame({ data: f1, width: w, height: h }, 100);

// Frame 2: Blue box
const f2 = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) {
  f2[i * 4] = 0;       // R
  f2[i * 4 + 1] = 0;   // G
  f2[i * 4 + 2] = 255; // B
  f2[i * 4 + 3] = 255; // A
}
encoder.addFrame({ data: f2, width: w, height: h }, 100);

const bytes = encoder.render();
console.log('Rendered GIF bytes length:', bytes.length);

// Verify signature GIF89a
const header = String.fromCharCode(...bytes.slice(0, 6));
console.log('GIF Header:', header);
if (header !== 'GIF89a') {
  throw new Error(`Expected GIF89a, got ${header}`);
}

// Verify trailer 0x3B
if (bytes[bytes.length - 1] !== 0x3b) {
  throw new Error('GIF does not end with 0x3B trailer');
}

console.log('GIF Encoder verification successful! 🎉');
