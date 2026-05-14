import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  agencyName: text("agency_name"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  storagePath: text("storage_path").notNull(),
  sourceUrl: text("source_url"),
  rawText: text("raw_text"),
  status: text("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const requirements = pgTable("requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rawSourceText: text("raw_source_text"),
  confidence: real("confidence"),
  status: text("status").default("pending").notNull(),
  reviewerNotes: text("reviewer_notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scrapeTargets = pgTable("scrape_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  label: text("label"),
  scrapeDepth: integer("scrape_depth").default(1).notNull(),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  status: text("status").default("queued").notNull(),
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  payload: jsonb("payload"),
  result: jsonb("result"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Requirement = typeof requirements.$inferSelect;
export type NewRequirement = typeof requirements.$inferInsert;
export type ScrapeTarget = typeof scrapeTargets.$inferSelect;
export type NewScrapeTarget = typeof scrapeTargets.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
