export async function prepareAvatar(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP picture.');
  if (file.size > 5 * 1024 * 1024) throw Error('Choose a picture smaller than 5 MB.');
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const side = Math.min(image.width, image.height);
    ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,160,160);
    const result = canvas.toDataURL('image/webp',0.8);
    if (result.length > 80000) throw Error('That picture is too detailed. Try a smaller one.');
    return result;
  } finally { image.close(); }
}
