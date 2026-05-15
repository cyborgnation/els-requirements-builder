import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db/index";
import { customers, documents, requirements } from "../src/lib/db/schema";
import { like, or, eq } from "drizzle-orm";
import { extractRequirementsFromText, buildRequirementInserts } from "../src/lib/ai/extract-requirements";

const PAGE_TEXT = `
Kentucky Department of Fish & Wildlife Resources — License Fees (2025-26)

License Year: March 1 through February 28/29
Purchase: Online at app.fw.ky.gov/Solar/, licensed vendors, or by phone 1-800-858-1549

RESIDENCY DEFINITION
Resident = KY domicile for at least 30 consecutive days immediately preceding purchase.
Nonresident = any person who does not qualify as a resident.

AGE / EXEMPTION RULES
- Under age 12: No hunting license required (elk lottery application still requires fee)
- Age 15 and under: No fishing license required
- Age 65 and over: Eligible for Senior License and Senior Lifetime Sportsman's License
- Disabled residents: Eligible for Disabled License
- Youth ages 12–15: Eligible for Youth Hunting License and Youth Sportsman's License
- Active military / veterans: Eligible for special discounted licenses

HUNTING LICENSES
Annual Hunting License: $28.54 resident / $169.12 nonresident
  - Required for all hunters age 12+ unless covered by sportsman's package
  - Valid March 1 through last day of February
  - Does not include deer, turkey, or elk permits

1-Day Hunting License: $7.40 resident / $26.43 nonresident
  - Valid for one calendar day only

Youth Hunting License (ages 12–15): $11.00 resident
  - Covers all hunting privileges for youth; no nonresident equivalent at discounted rate

Senior Hunting License (age 65+): Discounted rate available
  - Covers same privileges as Annual Hunting License

Disabled Hunting License: Available to qualifying KY residents with documented disability

FISHING LICENSES
Annual Fishing License: $23.00 resident / $55.00 nonresident
  - Required for all anglers age 16+
  - Valid March 1 through last day of February

1-Day Fishing License: $7.40 resident / $15.00 nonresident
  - Valid for one calendar day

7-Day Fishing License: $33.00 nonresident only
  - Valid for 7 consecutive days

Youth Fishing License (ages 12–15): $5.00 resident
  - Optional; not required for anglers 15 and under

Senior Fishing License (age 65+): Discounted rate available

Trout Permit: $10.00 resident / $10.00 nonresident
  - Required in addition to fishing license to fish designated trout waters
  - Available as add-on or included in some sportsman packages

SPORTSMAN'S PACKAGE LICENSES
Annual Sportsman's License: $95.00 resident
  - Includes: Annual Hunting License, Annual Fishing License, Statewide Deer Permit, Spring Turkey Permit, Trout Permit, Kentucky Migratory Bird/Waterfowl Permit
  - Does not include: Elk permit, Additional Deer Permit, Federal Duck Stamp

Youth Sportsman's License (ages 12–15): $25.00 resident
  - Includes: Youth Hunting License, Annual Fishing License, Statewide Deer Permit, Spring Turkey Permit
  - A tremendous value for young hunters/anglers

Senior Sportsman's License (age 65+): Discounted rate
  - Covers hunting and fishing privileges; does not include Additional Deer Permit

Senior Lifetime Sportsman's License (age 65+): One-time fee, lifetime validity
  - Covers all hunting and fishing privileges for life
  - Does not include species-specific permits (elk, quota hunts)

Disabled Sportsman's License: Available to qualifying KY residents

DEER PERMITS
Statewide Deer Permit: $37.00 resident / $248.40 nonresident
  - Required for all deer hunters in addition to hunting license
  - Allows harvest of up to 4 deer total per season (1 antlered limit statewide)
  - Included in most Sportsman's packages

Additional Deer Permit: $15.86 resident / $15.86 nonresident
  - Required to harvest a 5th or additional deer
  - Not included in any package

Youth Deer Permit (ages 12–15): $10.57 resident / $15.86 nonresident

All deer must be telechecked immediately after harvest via app, phone, or online.
One antlered deer per hunter per season statewide.

TURKEY PERMITS
Spring Turkey Permit: $22.00 resident / $95.00 nonresident
  - Required for spring turkey season
  - Included in Sportsman's packages

Fall Turkey Permit: $22.00 resident / $95.00 nonresident
  - Required for fall turkey season; purchased separately

ELK PERMITS
Elk Hunt Drawing Application: $10.00 (resident and nonresident)
  - Required to enter the annual elk quota drawing
  - Application window: August 1 – April 30 for the following season's drawing
  - Youth under 12 are not exempt from elk application fee

Bull Elk Permit: $105.70 resident / $581.35 nonresident
  - Issued to successful draw applicants only
  - Valid for bull firearm seasons: Sep 26–30 and Oct 3–7, 2026

Cow Elk Permit: $63.42 resident / $422.80 nonresident
  - Valid for cow firearm seasons: Nov 28–Dec 2, 2026 and Jan 2–6, 2027

Archery/Crossbow Elk Permit: $105.70 resident / $581.35 nonresident
  - Valid for either-sex archery/crossbow: Sep 12–25 and Dec 5–11, 2026

Youth Elk Permit: $31.71 resident / $211.40 nonresident

Out-of-Zone Elk Permit: $31.71 resident / $422.80 nonresident
  - For hunters who wish to pursue elk outside the 16-county elk zone using deer season rules

Drawn hunters must purchase permit by June 15 and confirm unit assignment by June 30.

BEAR PERMITS
Bear Permit: $31.71 resident / $264.25 nonresident
  - Required for bear hunting in zones 1, 2, and 3
  - Zone 1: Chase Jun 1–Aug 31 and Sep 9–30; Hunt with Dogs Oct 19–23; Archery/Crossbow Oct 24–26; Firearms Dec 12–14
  - Zone 2: Chase Jun 1–Aug 31 and Sep 9–30; Hunt with Dogs Oct 19–23 and Oct 29–Nov 6; Archery/Crossbow Oct 24–28; Firearms Dec 12–16
  - Zone 3: Chase Jun 1–Aug 31 and Sep 9–30; Hunt with Dogs Oct 19–23 and Oct 29–Nov 6; Archery/Crossbow Sep 19–Oct 2 and Oct 24–28; Firearms Dec 12–16

Bear Chase Permit: $31.71 resident / $52.85 nonresident
  - Required for chase-only activity; does not allow harvest

Combo Bear Permit: $52.85 resident only
  - Covers both bear hunting and chase privileges

Youth Bear Permit: $10.57 resident / $105.70 nonresident
Youth Bear Chase Permit: $10.57 resident / $15.86 nonresident

Bear chase not permitted on WMAs until 3rd Saturday in August.
Hunter orange required during firearms bear seasons.

MIGRATORY BIRD & WATERFOWL PERMITS
Kentucky Migratory Bird/Waterfowl Permit: $15.86 resident and nonresident
  - Required in addition to hunting license for dove, duck, goose, woodcock, snipe, rail, gallinule, teal
  - HIP Survey must be completed before hunting any migratory bird
  - Crow is exempt from this permit and from HIP

Federal Duck Stamp: $25.00
  - Required for all waterfowl hunters age 16+
  - Available at post offices, USFWS vendors, and online

Sandhill Crane Permit: $3.00
  - Required for quota sandhill crane season: Dec 7, 2026–Jan 31, 2027
  - Drawn hunters must pass identification exam
  - Post-season survey required within 14 days of season close
  - Application window: September 1–30

TRAPPING LICENSE
Annual Trapping License: $25.00 resident / $200.00 nonresident
  - Required for all trappers

QUOTA / LOTTERY HUNTS
General Quota Hunt Application Window: September 1–30 for most quota species
  - Deer quota hunts (specific areas): separate area calendar published annually
  - Dove quota hunts: application window TBD for 2026
  - All quota hunt applications submitted via fw.ky.gov/Hunt/Pages/Quota-Hunts.aspx
  - Preference/bonus point system applies to deer quota hunts
  - Post-draw: permit must be purchased within 14 days of notification

REPORTING REQUIREMENTS
- All deer must be telechecked immediately after harvest
- Sandhill crane hunters must complete post-season survey within 14 days of close
- HIP Survey required annually before first migratory bird hunt of the season

VENDOR / AGENT RULES
- Licensed vendors may sell all standard licenses and permits
- Vendor commission set by KDFWR
- Gift certificates valid 5 years, redeemable online only
- MyProfile account allows license reprinting and authorization number retrieval

DATA / SYSTEM REQUIREMENTS
- Online sales via app.fw.ky.gov/Solar/
- Authorization numbers issued at point of sale for field use
- Telecheck system: mandatory for all deer harvests; available via mobile app, web, or phone
- HIP Survey integrated into license purchase workflow for migratory bird hunters
`;

async function main() {
  // Find Kentucky customer
  const kyCusts = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(or(like(customers.name, "%entucky%"), eq(customers.state, "KY")));

  if (kyCusts.length === 0) {
    console.error("No Kentucky customer found. Create one in the app first.");
    process.exit(1);
  }

  const customer = kyCusts[0];
  console.log(`Seeding requirements for: ${customer.name} (${customer.id})`);

  // Create a document record for this seed data
  const [doc] = await db
    .insert(documents)
    .values({
      customerId: customer.id,
      filename: "ky-license-fees-seed.txt",
      fileType: "txt",
      storagePath: "",
      sourceUrl: "https://fw.ky.gov/Licenses/Pages/default.aspx",
      rawText: PAGE_TEXT,
      status: "processing",
    })
    .returning();

  console.log(`Created document: ${doc.id}`);
  console.log("Extracting requirements via Claude...");

  const extracted = await extractRequirementsFromText(PAGE_TEXT);
  console.log(`Extracted ${extracted.length} requirements`);

  if (extracted.length > 0) {
    await db
      .insert(requirements)
      .values(buildRequirementInserts(extracted, customer.id, doc.id));
    console.log("Saved to database.");
  }

  await db
    .update(documents)
    .set({ status: "extracted" })
    .where(eq(documents.id, doc.id));

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
