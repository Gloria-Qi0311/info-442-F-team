// Photo upload for listings (PH1–PH4).
// We don't use Firebase Storage (it needs a paid plan). Instead, the photo is
// shrunk in the browser and saved as a small JPEG "data URL" right inside the
// listing document in Firestore. A Firestore document can hold up to 1 MB, and
// the compressed photo is usually 50–200 KB.

export const MAX_PHOTO_MB = 20;   // the photo gets compressed anyway, so big phone photos are fine

// Longest side of the saved photo, in pixels.
const MAX_SIDE = 900;
// Keep the saved photo well under Firestore's 1 MB document limit.
const MAX_DATA_URL_LENGTH = 700 * 1024;

export const PHOTO_ERRORS = {
  notImage: 'Please choose an image file (for example JPG or PNG).',
  tooLarge: `Please choose an image smaller than ${MAX_PHOTO_MB} MB.`,
  uploadFailed: 'Your photo could not be uploaded. Please try again.',
};

// Returns an error message for a bad file, or '' if the file is OK.
export function checkPhotoFile(file) {
  if (!file.type.startsWith('image/')) {
    return PHOTO_ERRORS.notImage;
  }
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
    return PHOTO_ERRORS.tooLarge;
  }
  return '';
}

// Loads the file into an <img> so we can draw it on a canvas.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image file.'));
    };
    img.src = url;
  });
}

// Shrinks the photo and returns it as a JPEG data URL to save in Firestore.
// Throws if the photo can't be read or is still too big (PH4 shows an error).
export async function compressListingPhoto(file) {
  const img = await loadImage(file);

  let width = img.naturalWidth;
  let height = img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // White background so transparent PNGs don't turn black as JPEGs.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Lower the quality step by step until the photo is small enough.
  let quality = 0.8;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('Photo is still too large after compression.');
  }
  return dataUrl;
}
