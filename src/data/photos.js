import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

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

// Uploads the photo to Firebase Storage and returns its download URL.
// Each user's photos go in their own folder: listingPhotos/{uid}/...
export async function uploadListingPhoto(file, ownerId) {
  const path = `listingPhotos/${ownerId}/${Date.now()}-${file.name}`;
  const photoRef = ref(storage, path);
  await uploadBytes(photoRef, file, { contentType: file.type });
  return getDownloadURL(photoRef);
}
