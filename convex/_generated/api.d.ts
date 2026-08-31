/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as customers from "../customers.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as estimate from "../estimate.js";
import type * as ics from "../ics.js";
import type * as invoiceLogo from "../invoiceLogo.js";
import type * as invoiceMath from "../invoiceMath.js";
import type * as invoicePdf from "../invoicePdf.js";
import type * as invoicePdfAction from "../invoicePdfAction.js";
import type * as invoicePdfData from "../invoicePdfData.js";
import type * as invoices from "../invoices.js";
import type * as market from "../market.js";
import type * as pdfText from "../pdfText.js";
import type * as quotes from "../quotes.js";
import type * as rateLimits from "../rateLimits.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as turnstile from "../turnstile.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chat: typeof chat;
  customers: typeof customers;
  emailTemplates: typeof emailTemplates;
  estimate: typeof estimate;
  ics: typeof ics;
  invoiceLogo: typeof invoiceLogo;
  invoiceMath: typeof invoiceMath;
  invoicePdf: typeof invoicePdf;
  invoicePdfAction: typeof invoicePdfAction;
  invoicePdfData: typeof invoicePdfData;
  invoices: typeof invoices;
  market: typeof market;
  pdfText: typeof pdfText;
  quotes: typeof quotes;
  rateLimits: typeof rateLimits;
  sessions: typeof sessions;
  settings: typeof settings;
  turnstile: typeof turnstile;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
