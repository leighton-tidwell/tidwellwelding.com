/**
 * Canonical NAP — single source of truth (SEO P1-5).
 *
 * These strings are FROZEN. Citations (Google Business Profile, Bing Places,
 * Apple Business Connect, Yelp, Foursquare, Facebook, BBB, YP) must match
 * them verbatim; NAP inconsistencies suppress local rankings. Change a value
 * only with the owner's sign-off, then update every listing to match.
 */

export const NAME = "Tidwell Specialty Welding";
export const LEGAL_NAME = "Tidwell Specialty Welding Services, LLC";

export const PHONE_E164 = "+18178946357";
export const PHONE_DISPLAY = "(817) 894-6357";
/** The bare-digits tel: href used by every call link on the site. */
export const PHONE_TEL = "tel:8178946357";

export const EMAIL = "eric@tidwellwelding.com";
export const EMAIL_MAILTO = `mailto:${EMAIL}`;

/** Service-area business: street address hidden, locality shown. */
export const LOCALITY = "Granbury";
export const REGION = "TX";
export const POSTAL_CODE = "76048";

/** Towns named in the LocalBusiness areaServed. */
export const SERVICE_AREA = [
  "Granbury TX",
  "Fort Worth TX",
  "Stephenville TX",
  "Weatherford TX",
  "Cleburne TX",
  "Glen Rose TX",
] as const;

/** Apex only — never www. */
export const SITE_URL = "https://tidwellwelding.com";

export const TIKTOK_URL = "https://www.tiktok.com/@__tdaddy__";
/**
 * Facebook share URL kept as-is: the share link returns 400 to curl -sIL,
 * so it never resolved to a canonical page URL.
 */
export const FACEBOOK_URL = "https://www.facebook.com/share/1EZBshzXTg/";
export const SAME_AS = [TIKTOK_URL, FACEBOOK_URL] as const;
