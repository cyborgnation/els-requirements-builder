export const EXTRACTION_SYSTEM_PROMPT = `You are an expert analyst building an Electronic Licensing System (ELS) requirements matrix for state fish & wildlife agencies.

Your task: extract every distinct species/opportunity combination from regulatory text and produce one structured matrix row per combination. Each row must capture all available information across these dimensions:

- **category**: Top-level activity type — one of: Hunting, Fishing, Trapping, Licensing, General
- **species_opportunity**: The specific species or license opportunity (e.g., "White-tailed Deer", "Elk", "Largemouth Bass", "Annual Hunting License")
- **season_type**: The season or activity sub-type (e.g., "Archery Season", "Modern Gun Season", "Youth-only Season", "All Seasons")
- **dates**: All open/closed season dates, application windows, deadlines. Be specific with month/day/year.
- **eligibility**: Who may participate — age requirements, exemptions, draw requirements
- **residency_age_rule**: Residency definition + age tiers and their rules (youth, senior, disabled, military, etc.)
- **required_licenses**: All licenses, permits, stamps, and tags required to participate
- **fees**: All fees with resident vs. nonresident breakdown. Include license fee, permit fee, application fee, stamps, etc.
- **lottery_window**: Application window dates, draw system type, preference/bonus points, post-draw deadlines
- **key_restrictions**: Bag limits, weapon restrictions, harvest reporting, zone rules, shot type, tagging requirements
- **source_urls**: Source URLs from the document where this information came from
- **notes**: Any ambiguities, gaps, year-label inconsistencies, or stakeholder questions

Rules:
- Create ONE row per species + season type combination (e.g., White-tailed Deer Archery and White-tailed Deer Modern Gun are separate rows)
- If the same fee/residency rule applies across multiple rows, still include it in each row — don't omit it
- Use "None" or "Not applicable" for dimensions with no information — never leave a field empty
- Be thorough — extract every species, every season variant, every fee tier`;

export const CRAWL_SYSTEM_PROMPT = `You are an agent crawling a U.S. state fish & wildlife agency website to build an Electronic Licensing System (ELS) requirements matrix.

You navigate the site by calling \`fetch_page\` with URLs you want to read. You will be given a starting URL. From there, decide which links to follow based on whether they look likely to contain regulations, seasons, fees, licenses, species rules, lottery applications, or related licensing information. Avoid news, press releases, photo galleries, calendars, and unrelated content.

As you find complete species/opportunity rows, call \`record_matrix_rows\` to record them. You may call this tool multiple times across the crawl as you uncover more. The schema and fields are identical to the single-document extraction — one row per species + season type combination, every field populated (use "None" or "Not applicable" when there is no information), include \`source_urls\` listing the page(s) the row was derived from.

You operate under a hard budget:
- A maximum of 20 pages may be fetched in total.
- A maximum of 40 tool-use turns.
- The system will refuse additional \`fetch_page\` calls once the page budget is exhausted.

Strategy:
- Start broad: fetch the starting page, scan the links for high-signal navigation (e.g. "Hunting", "Fishing", "Regulations", "Licenses & Permits", "Seasons & Dates", "Lotteries", "Fees").
- Prioritize index/landing pages that branch to multiple species or seasons.
- Visit specific regulation pages once you have a sense of structure.
- Don't re-fetch URLs you've already seen.
- Track what you've covered; once you believe you have full coverage of the relevant material — or you are clearly hitting irrelevant pages — call \`finish\` with a brief reason.

Output rules for \`record_matrix_rows\` (same as base extraction):
- ONE row per species + season type combination.
- Every dimension populated, "None"/"Not applicable" when missing — never empty.
- Be thorough across species, season variants, fee tiers, residency categories.
- Set \`confidence\` honestly — lower it for rows assembled from incomplete or conflicting pages.

You should call \`finish\` exactly once when you are done. Do not narrate or explain in free-form text; act through tools.`;

export const FETCH_PAGE_TOOL_SCHEMA = {
  name: "fetch_page",
  description:
    "Fetch a single page on the target site. Returns the page's main text content, extracted tables, and a filtered list of links (same host only). Use this to navigate the site.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string" as const,
        description: "Absolute URL on the same host as the starting URL.",
      },
      reason: {
        type: "string" as const,
        description: "Brief note on why you're fetching this page (one short phrase).",
      },
    },
    required: ["url"],
  },
};

export const FINISH_TOOL_SCHEMA = {
  name: "finish",
  description:
    "Signal that the crawl is complete. Call this exactly once when you believe you have full coverage of the relevant licensing material or are clearly hitting irrelevant pages.",
  input_schema: {
    type: "object" as const,
    properties: {
      reason: {
        type: "string" as const,
        description: "Short summary of why the crawl is stopping (1-2 sentences).",
      },
    },
    required: ["reason"],
  },
};

export const EXTRACTION_TOOL_SCHEMA = {
  name: "record_matrix_rows",
  description: "Record structured ELS requirements matrix rows extracted from regulatory text",
  input_schema: {
    type: "object" as const,
    properties: {
      rows: {
        type: "array" as const,
        description: "One entry per species/opportunity + season type combination",
        items: {
          type: "object" as const,
          properties: {
            category: {
              type: "string" as const,
              enum: ["Hunting", "Fishing", "Trapping", "Licensing", "General"],
              description: "Top-level activity type",
            },
            species_opportunity: {
              type: "string" as const,
              description: "Species or license opportunity name (e.g., 'White-tailed Deer', 'Elk', 'Largemouth Bass')",
            },
            season_type: {
              type: "string" as const,
              description: "Season or activity sub-type (e.g., 'Archery Season', 'Modern Gun Season', 'Youth-only')",
            },
            dates: {
              type: "string" as const,
              description: "All open/closed season dates and deadlines with specific month/day/year",
            },
            eligibility: {
              type: "string" as const,
              description: "Who may participate, age exemptions, draw requirements",
            },
            residency_age_rule: {
              type: "string" as const,
              description: "Residency definition and all age-tier rules (youth, senior, disabled, military)",
            },
            required_licenses: {
              type: "string" as const,
              description: "All licenses, permits, stamps, and tags required",
            },
            fees: {
              type: "string" as const,
              description: "All fees with resident vs nonresident breakdown",
            },
            lottery_window: {
              type: "string" as const,
              description: "Application window, draw system, preference points, post-draw deadlines",
            },
            key_restrictions: {
              type: "string" as const,
              description: "Bag limits, weapon rules, harvest reporting, zone rules, tagging requirements",
            },
            source_urls: {
              type: "string" as const,
              description: "Source URLs where this information was found",
            },
            notes: {
              type: "string" as const,
              description: "Ambiguities, gaps, year-label issues, or stakeholder questions",
            },
            confidence: {
              type: "number" as const,
              minimum: 0,
              maximum: 1,
              description: "Confidence that this row is complete and accurate (0.0-1.0)",
            },
          },
          required: [
            "category",
            "species_opportunity",
            "season_type",
            "dates",
            "eligibility",
            "residency_age_rule",
            "required_licenses",
            "fees",
            "lottery_window",
            "key_restrictions",
            "source_urls",
            "notes",
            "confidence",
          ],
        },
      },
    },
    required: ["rows"],
  },
};
