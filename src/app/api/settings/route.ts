import { NextRequest, NextResponse } from "next/server";
import { getAISettings, setAISettings, MODEL_OPTIONS } from "@/lib/settings";
import type { AISettings } from "@/lib/settings";

export async function GET() {
  const settings = await getAISettings();
  return NextResponse.json({ settings, modelOptions: MODEL_OPTIONS });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { provider, model } = body as AISettings;

  if (!provider || !model) {
    return NextResponse.json(
      { error: "provider and model are required" },
      { status: 400 }
    );
  }

  const validModels = MODEL_OPTIONS[provider];
  if (!validModels?.includes(model)) {
    return NextResponse.json(
      { error: `Invalid model "${model}" for provider "${provider}"` },
      { status: 400 }
    );
  }

  await setAISettings({ provider, model });
  return NextResponse.json({ settings: { provider, model } });
}
