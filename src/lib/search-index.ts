/**
 * Hand-written client-side search index for /search.
 * One entry per public route, plus the /services section anchors.
 * Keep this file in sync when a public page ships or changes.
 * /crew is private — never list it here.
 */

export type SearchEntry = {
  url: string;
  title: string;
  description: string;
  keywords: string[];
};

export const SEARCH_INDEX: SearchEntry[] = [
  {
    url: "/",
    title: "Welding & fabrication in Granbury, TX",
    description:
      "Fabrication, structural, pipe and heavy equipment repair. Mobile rig, 24/7 response, free quotes.",
    keywords: [
      "home",
      "welding",
      "welder",
      "fabrication",
      "granbury",
      "mobile welder",
      "free quotes",
      "beat any quote",
      "tidwell",
      "tsws",
    ],
  },
  {
    url: "/services",
    title: "Services: the capability sheet",
    description:
      "Six service lines out of Granbury, TX. Fabrication, structural, pipe, equipment, mobile, emergency.",
    keywords: [
      "services",
      "capability sheet",
      "welding services",
      "carbon",
      "stainless",
      "aluminum",
      "inconel",
      "chrome-moly",
    ],
  },
  {
    url: "/services/fabrication",
    title: "Fabrication",
    description:
      "Custom builds from drawings, sketches or a photo of the space. Carbon, stainless, aluminum.",
    keywords: [
      "fabrication",
      "custom",
      "gates",
      "trailers",
      "frames",
      "brackets",
      "carbon steel",
      "stainless",
      "aluminum",
      "metal fabrication",
    ],
  },
  {
    url: "/services/structural",
    title: "Staircases & handrail",
    description:
      "Commercial staircase packages, handrail runs, structural steel. Plumb, square, inspection-ready.",
    keywords: [
      "structural",
      "staircase",
      "stairs",
      "handrail",
      "rail",
      "railing",
      "structural steel",
      "commercial",
      "inspection",
    ],
  },
  {
    url: "/services/pipe",
    title: "Pipe welding",
    description:
      "Process pipe, pipeline and station work. Carbon, stainless, chrome-moly, Inconel.",
    keywords: [
      "pipe",
      "pipe welding",
      "pipeline",
      "process pipe",
      "tie-in",
      "tig",
      "stainless",
      "chrome-moly",
      "inconel",
      "refinery",
      "plant",
    ],
  },
  {
    url: "/services/equipment",
    title: "Heavy equipment repair",
    description:
      "Buckets, booms, frames, frac tanks, hot oil beds. Repairs that hold under load.",
    keywords: [
      "equipment",
      "heavy equipment",
      "repair",
      "bucket",
      "boom",
      "frac tank",
      "hot oil bed",
      "dozer",
      "excavator",
      "tractor",
      "baler",
    ],
  },
  {
    url: "/services/mobile",
    title: "Mobile welding",
    description:
      "A rigged truck that meets you anywhere in the DFW to Stephenville area.",
    keywords: [
      "mobile",
      "mobile welding",
      "mobile welder",
      "truck",
      "rig",
      "on-site",
      "field",
      "roadside",
      "ranch",
      "job site",
    ],
  },
  {
    url: "/services/emergency",
    title: "Emergency & on-call welding",
    description:
      "24/7 response. Nights, weekends, holidays. Eric drops what he is doing and comes to you.",
    keywords: [
      "emergency",
      "24/7",
      "after hours",
      "on-call",
      "breakdown",
      "night",
      "weekend",
      "holiday",
      "urgent",
    ],
  },
  {
    url: "/services#fabrication",
    title: "Fabrication · services overview",
    description: "The fabrication section on the services page.",
    keywords: ["fabrication", "custom builds", "services"],
  },
  {
    url: "/services#structural",
    title: "Staircases & handrail · services overview",
    description: "The structural section on the services page.",
    keywords: ["structural", "staircase", "handrail", "services"],
  },
  {
    url: "/services#pipe",
    title: "Pipe welding · services overview",
    description: "The pipe welding section on the services page.",
    keywords: ["pipe", "pipeline", "services"],
  },
  {
    url: "/services#equipment",
    title: "Heavy equipment repair · services overview",
    description: "The equipment repair section on the services page.",
    keywords: ["equipment", "repair", "services"],
  },
  {
    url: "/services#mobile",
    title: "Mobile welding · services overview",
    description: "The mobile welding section on the services page.",
    keywords: ["mobile", "truck", "services"],
  },
  {
    url: "/services#emergency",
    title: "Emergency & on-call · services overview",
    description: "The emergency section on the services page.",
    keywords: ["emergency", "24/7", "services"],
  },
  {
    url: "/work",
    title: "Job log: photos and video",
    description:
      "Real jobs off Eric's phone. Pipe welds, gates, equipment repair, rail. Zoom in on any weld.",
    keywords: [
      "work",
      "job log",
      "photos",
      "video",
      "portfolio",
      "gallery",
      "past jobs",
      "examples",
    ],
  },
  {
    url: "/about",
    title: "About Eric Tidwell",
    description:
      "Eric started welding in 2011. He runs the shop from Granbury with one standard for every weld.",
    keywords: [
      "about",
      "eric tidwell",
      "welder since 2011",
      "experience",
      "story",
      "crew",
      "llc",
      "insured",
    ],
  },
  {
    url: "/contact",
    title: "Contact",
    description:
      "Call or text (817) 894-6357, any hour. Email eric@tidwellwelding.com. Free quotes.",
    keywords: [
      "contact",
      "phone",
      "call",
      "text",
      "email",
      "hours",
      "location",
      "faq",
      "817-894-6357",
    ],
  },
  {
    url: "/quote",
    title: "Request a quote",
    description:
      "Describe the job and attach photos. Get working numbers in minutes. Quotes are free.",
    keywords: [
      "quote",
      "estimate",
      "price",
      "cost",
      "bid",
      "free quote",
      "beat any bid",
      "estimator",
    ],
  },
  {
    url: "/welder/granbury-tx",
    title: "Welder in Granbury, TX",
    description:
      "The shop sits in Granbury, TX 76048. Fabrication, pipe, equipment repair and 24/7 mobile welding.",
    keywords: [
      "granbury",
      "hood county",
      "76048",
      "welder in granbury",
      "local welder",
      "acton",
      "tolar",
    ],
  },
  {
    url: "/welder/fort-worth-tx",
    title: "Welder in Fort Worth, TX",
    description:
      "Mobile welder for Fort Worth, about 45 minutes from the Granbury shop. Staircases, pipe repair, 24/7.",
    keywords: [
      "fort worth",
      "dfw",
      "tarrant county",
      "welder in fort worth",
      "commercial",
      "contractor",
    ],
  },
  {
    url: "/welder/stephenville-tx",
    title: "Welder in Stephenville, TX",
    description:
      "Mobile welder for Stephenville and Erath County. Baler repairs, ranch and dairy equipment, 24/7.",
    keywords: [
      "stephenville",
      "erath county",
      "welder in stephenville",
      "ranch",
      "ag",
      "dairy",
      "baler",
      "fencing",
    ],
  },
];

/**
 * Case-insensitive multi-term filter across title, description and keywords.
 * Every whitespace-separated term must match at least one field.
 * Entries whose title or keywords match rank above description-only matches.
 */
export function searchEntries(query: string): SearchEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return SEARCH_INDEX;
  const scored: Array<{ entry: SearchEntry; score: number }> = [];
  for (const entry of SEARCH_INDEX) {
    const title = entry.title.toLowerCase();
    const description = entry.description.toLowerCase();
    const keywords = entry.keywords.join(" ").toLowerCase();
    let score = 0;
    let matchesAll = true;
    for (const term of terms) {
      if (title.includes(term)) score += 3;
      else if (keywords.includes(term)) score += 2;
      else if (description.includes(term)) score += 1;
      else {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll) scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.entry);
}
