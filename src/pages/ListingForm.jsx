import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createListing } from '../data/listings';
import { checkPhotoFile, compressListingPhoto, PHOTO_ERRORS } from '../data/photos';
import {
  CATEGORIES,
  CONDITIONS,
  PICKUP_AREAS,
  TIME_SLOTS,
} from '../data/listingOptions';
import { todayString, validateListing } from '../data/listingValidation';

// Lend (L1), Sell (S1), and Give (G1) forms.
const FORM_TEXT = {
  lend: { title: 'Lend an Item', button: 'Continue', failed: 'This item could not be listed. Please try again.' },
  sell: { title: 'Sell an Item', button: 'Continue', failed: 'This item could not be published. Please try again.' },
  give: { title: 'Give Away an Item', button: 'Next', failed: 'This item could not be listed. Please try again.' },
};

const EMPTY_VALUES = {
  price: '',
  title: '',
  category: '',
  condition: '',
  pickupAreaId: '',
  availableFrom: '',
  availableUntil: '',
  timeSlot: '',
  photo: null,
};

function FieldError({ message }) {
  if (!message) return null;
  return <p className="error field-error" role="alert">{message}</p>;
}

function SelectField({ id, label, value, options, error, onChange }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(id, event.target.value)}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <FieldError message={error} />
    </>
  );
}

const toOptions = (list) => list.map((item) => ({ value: item, label: item }));

export default function ListingForm({ type }) {
  const text = FORM_TEXT[type];
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  // PH1–PH3: pick a photo, check it is an image, and show a preview.
  function handlePhotoChange(event) {
    const file = event.target.files[0];
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    if (!file) {
      setField('photo', null);
      setPhotoPreview('');
      return;
    }

    const photoError = checkPhotoFile(file);
    if (photoError) {
      // Not an image: clear the choice so it can't be submitted.
      event.target.value = '';
      setField('photo', null);
      setPhotoPreview('');
      setErrors((current) => ({ ...current, photo: photoError }));
      return;
    }

    setField('photo', file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, photo: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateListing(values, type);
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length > 0) return;

    // On failure, stay on the form and keep what was entered (L1.14–L1.16).
    setSubmitting(true);

    // PH4: upload the photo first. If it fails, show an error and keep the form.
    let photoUrl;
    try {
      photoUrl = await compressListingPhoto(values.photo);
    } catch (error) {
      console.error('Could not upload photo:', error);
      setSubmitError(PHOTO_ERRORS.uploadFailed);
      setSubmitting(false);
      return;
    }

    try {
      const listingId = await createListing(type, values, user, photoUrl);
      navigate(`/listings/${listingId}/confirmation`, {
        state: { photoPreview },
      });
    } catch (error) {
      console.error('Could not save listing:', error);
      setSubmitError(text.failed);
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1>{text.title}</h1>
      <form className="listing-form" onSubmit={handleSubmit} noValidate>
        {type === 'sell' && (
          <>
            <label htmlFor="price">Price ($)</label>
            <input
              id="price"
              type="text"
              inputMode="decimal"
              value={values.price}
              onChange={(event) => setField('price', event.target.value)}
            />
            <FieldError message={errors.price} />
          </>
        )}

        <label htmlFor="title">Item name</label>
        <input
          id="title"
          type="text"
          value={values.title}
          onChange={(event) => setField('title', event.target.value)}
        />
        <FieldError message={errors.title} />

        <SelectField
          id="category"
          label="Category"
          value={values.category}
          options={toOptions(CATEGORIES)}
          error={errors.category}
          onChange={setField}
        />
        <SelectField
          id="condition"
          label="Condition"
          value={values.condition}
          options={toOptions(CONDITIONS)}
          error={errors.condition}
          onChange={setField}
        />
        <SelectField
          id="pickupAreaId"
          label="Pickup area"
          value={values.pickupAreaId}
          options={PICKUP_AREAS.map((area) => ({ value: area.id, label: area.name }))}
          error={errors.pickupAreaId}
          onChange={setField}
        />

        <label htmlFor="availableFrom">Available start date</label>
        <input
          id="availableFrom"
          type="date"
          min={todayString()}
          value={values.availableFrom}
          onChange={(event) => setField('availableFrom', event.target.value)}
        />
        <FieldError message={errors.availableFrom} />

        <label htmlFor="availableUntil">Available end date</label>
        <input
          id="availableUntil"
          type="date"
          min={values.availableFrom || todayString()}
          value={values.availableUntil}
          onChange={(event) => setField('availableUntil', event.target.value)}
        />
        <FieldError message={errors.availableUntil} />

        <SelectField
          id="timeSlot"
          label="Available time slot"
          value={values.timeSlot}
          options={toOptions(TIME_SLOTS)}
          error={errors.timeSlot}
          onChange={setField}
        />

        {/* Photo upload (Issue #7, PH1–PH4) */}
        <label htmlFor="photo">Photo</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
        />
        <FieldError message={errors.photo} />
        {photoPreview && (
          <img className="photo-preview" src={photoPreview} alt="Preview of the selected item" />
        )}

        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button type="submit" className="listing-submit" disabled={submitting}>
          {submitting ? 'Saving…' : text.button}
        </button>
      </form>
    </main>
  );
}
