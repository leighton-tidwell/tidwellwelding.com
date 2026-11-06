// Pure field caps shared by the quote form and both quote endpoints. No
// Convex imports: the browser bundle loads this file too.
//
// One table, so a field cannot be capped at one length by draftEstimate and
// another by submitQuote. It used to: `location` was 500 at the estimate step
// and 600 at submission, so a 550-character location passed the estimate and
// then failed the submission (issue #6). The stricter value wins here.
//
// These are rejection thresholds, not the (shorter) lengths a stored quote
// clips to — those live beside the row they are written to.

export const FIELD_MAX = {
  name: 300,
  company: 300,
  phone: 100,
  email: 300,
  slot: 200,
  type: 200,
  material: 200,
  desc: 4000,
  dims: 500,
  thickness: 100,
  quantity: 100,
  timeline: 200,
  location: 500,
  compQuote: 100,
} as const;

/** Photo (or drawing) names a single request may carry. */
export const MAX_PHOTO_NAMES = 20;
/** Length of any one of those names. */
export const MAX_PHOTO_NAME_CHARS = 300;
