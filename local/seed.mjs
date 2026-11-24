#!/usr/bin/env node
// Seeds the LOCAL Convex backend with a named owner account and realistic
// customers (as businesses with contacts), invoices and quotes. Goes through
// the real functions, so the data is shaped exactly like production's. Refuses any backend that isn't local.
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as fn } from "convex/server";
import { OWNER } from "./owner.mjs";

const url = process.env.CONVEX_SELF_HOSTED_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
  console.error(`seed: refusing non-local backend "${url}"`);
  process.exit(1);
}

const convex = new ConvexHttpClient(url);
convex.setAdminAuth(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY);
const mutation = (name, args) => convex.mutation(fn(name), args);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// Owner account, through the real one-time setup link.
let userId;
try {
  userId = await mutation("auth:createAdminUser", { email: OWNER.email });
} catch {
  console.log("seed: already seeded. `make reset` gives a fresh stack.");
  process.exit(0);
}
const setupToken = await mutation("auth:issueSetupToken", { userId });
await mutation("auth:setPassword", {
  token: setupToken,
  password: OWNER.password,
});
const { token } = await mutation("auth:login", OWNER);

await mutation("settings:setLaborRate", { rate: 95 });

const customers = [
  {
    name: "Dale Bishop",
    company: "Bishop Fabrication LLC",
    phone: "8175550142",
    email: "dale@bishopfab.test",
    address: "1400 Industrial Blvd, Granbury, TX 76048",
  },
  {
    name: "Rosa Martinez",
    company: "Brazos Ranch Supply",
    phone: "2545550187",
    address: "88 FM 4, Stephenville, TX 76401",
  },
  { name: "Tom Keller", phone: "8175550110", notes: "Pays on pickup." },
];
const customerIds = [];
for (const c of customers) {
  customerIds.push(await mutation("customers:create", { token, ...c }));
}

// Bishop Fabrication has two people on file, and its point of contact moved
// from Dale to the shop foreman, so the business page has history to show.
const bishopId = await convex.query(fn("businesses:forCustomer"), {
  token,
  customerId: customerIds[0],
});
const foremanId = await mutation("businesses:addContact", {
  token,
  businessId: bishopId,
  name: "Marcus Reed",
  title: "Shop foreman",
  phone: "8175550177",
  email: "marcus@bishopfab.test",
});
await mutation("businesses:setPrimaryContact", {
  token,
  businessId: bishopId,
  contactId: foremanId,
});

const invoices = [
  {
    customer: 0,
    daysAgo: 30,
    status: "paid",
    jobPo: "PO-2231",
    lineItems: [
      {
        qty: 6,
        unit: "hr",
        description: "Excavator bucket ear repair",
        rateCents: 9500,
        taxable: false,
      },
      {
        qty: 1,
        unit: "lot",
        description: "Consumables",
        rateCents: 4800,
        taxable: true,
      },
    ],
  },
  {
    customer: 1,
    daysAgo: 9,
    status: "sent",
    lineItems: [
      {
        qty: 40,
        unit: "ft",
        description: "2in sch 40 pipe gate frame",
        rateCents: 1200,
        taxable: true,
      },
      {
        qty: 8,
        unit: "hr",
        description: "Fabricate and hang ranch gate",
        rateCents: 9500,
        taxable: false,
      },
    ],
  },
  {
    customer: 2,
    daysAgo: 1,
    status: "draft",
    lineItems: [
      {
        qty: 2,
        unit: "hr",
        description: "Trailer hitch reinforcement",
        rateCents: 9500,
        taxable: false,
      },
    ],
  },
];
for (const inv of invoices) {
  const id = await mutation("invoices:create", {
    token,
    customerId: customerIds[inv.customer],
    issuedAt: now - inv.daysAgo * DAY,
    jobPo: inv.jobPo,
  });
  await mutation("invoices:update", { token, id, lineItems: inv.lineItems });
  await mutation("invoices:setStatus", { token, id, status: inv.status });
}

await mutation("quotes:insertQuote", {
  requestId: "Q-0001-001",
  name: "Jesse Ward",
  phone: "8175550199",
  job: {
    type: "Heavy equipment repair",
    desc: "Cracked bucket ear on a 320 excavator, about 8 in along the pin boss.",
    location: "Tolar, TX",
  },
  slot: "Tomorrow 9:00 AM",
});

console.log(
  `seed: owner ${OWNER.email} / ${OWNER.password}, ` +
    `${customers.length} customers (one with two contacts), ` +
    `${invoices.length} invoices, 1 quote`,
);
