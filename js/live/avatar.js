export async function prepareAvatar(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP picture.');
  let image;
  try { image = await createImageBitmap(file); }
  catch { throw Error('We couldn’t open that picture. Try another JPEG, PNG or WebP file.'); }
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 160 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/webp',0.8);
    if (result.length > 80000) throw Error('That picture is too detailed. Try a smaller one.');
    return result;
  } finally { image.close(); }
}
