import QRCode from 'qrcode';
export function inviteQrSvg(url) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const margin = 4;
  const size = modules.size + margin * 2;
  let path = '';
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) path += `M${x + margin},${y + margin}h1v1h-1z`;
    }
  }
  return `<svg class="invite-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Scan to open your Hearth invitation" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" fill="black"/></svg>`;
}
