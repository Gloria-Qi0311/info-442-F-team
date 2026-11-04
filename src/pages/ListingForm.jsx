import { useState } from 'react';
import {
  CATEGORIES,
  CONDITIONS,
  PICKUP_AREAS,
  TIME_SLOTS,
} from '../data/listingOptions';
import { todayString, validateListing } from '../data/listingValidation';

// Lend (L1), Sell (S1), and Give (G1) forms.
const FORM_TEXT = {
  lend: { title: 'Lend an Item', button: 'Continue' },
  sell: { title: 'Sell an Item', button: 'Continue' },
  give: { title: 'Give Away an Item', button: 'Next' },
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

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateListing(values, type);
    setErrors(nextErrors);
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

        {/* Photo upload area. Preview and upload errors are Issue #7 (PH1–PH4). */}
        <label htmlFor="photo">Photo</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={(event) => setField('photo', event.target.files?.[0] || null)}
        />
        <FieldError message={errors.photo} />

        <button type="submit" className="listing-submit">{text.button}</button>
      </form>
    </main>
  );
}
