// Photo upload for listings (PH1–PH4).

export const MAX_PHOTO_MB = 10;

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

// Firebase Storage needs a paid plan, so the photo is shrunk to a small JPEG
// and saved as a data URL in the listing's photoUrl field (Firestore docs max 1 MB).
const MAX_SIDE = 800;
const MAX_DATA_URL_LENGTH = 700 * 1024;

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
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

// Returns the compressed photo as a data URL to store in photoUrl.
export async function uploadListingPhoto(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.7, 0.5, 0.3]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }
  throw new Error('Photo is still too large after compression');
}
