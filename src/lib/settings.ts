import { db } from "./db";
import { appSettings } from "./db/schema";
import { eq } from "drizzle-orm";

export interface AISettings {
  provider: "gemini" | "claude";
  model: string;
}

const DEFAULTS: AISettings = {
  provider: "gemini",
  model: "gemini-2.5-flash",
};

export const MODEL_OPTIONS: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  claude: ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
};

export async function getAISettings(): Promise<AISettings> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "ai_settings"));

  if (rows.length === 0) return DEFAULTS;

  try {
    const parsed = JSON.parse(rows[0].value);
    return {
      provider: parsed.provider ?? DEFAULTS.provider,
      model: parsed.model ?? DEFAULTS.model,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function setAISettings(settings: AISettings): Promise<void> {
  const value = JSON.stringify(settings);
  await db
    .insert(appSettings)
    .values({ key: "ai_settings", value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
