import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { inviteQrSvg } from '../../js/live/invite-qr.js';
import { inviteUrl } from '../../js/live/invites.js';
test('rendered QR code decodes to the exact invitation URL', () => {
  const url = inviteUrl('https://torpisoul.github.io/hearth-social/', '11111111-1111-4111-8111-111111111111');
  const svg = inviteQrSvg(url);
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const scale = 5, width = size * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const [, xs, ys] of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    for (let y = Number(ys)*scale; y < (Number(ys)+1)*scale; y++) {
      for (let x = Number(xs)*scale; x < (Number(xs)+1)*scale; x++) {
        const i = (y*width+x)*4;
        pixels[i]=pixels[i+1]=pixels[i+2]=0;
      }
    }
  }
  assert.equal(jsQR(pixels,width,width)?.data,url);
});
