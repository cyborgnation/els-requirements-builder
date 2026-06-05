"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AISettings {
  provider: string;
  model: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [modelOptions, setModelOptions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setModelOptions(data.modelOptions);
      })
      .catch(() => toast.error("Failed to load settings"));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-500">
        Loading settings…
      </div>
    );
  }

  const models = modelOptions[settings.provider] ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure which AI provider and model is used for requirement extraction.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <Label>AI Provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(value) => {
              if (!value) return;
              const defaultModel = modelOptions[value]?.[0] ?? "";
              setSettings({ provider: value, model: defaultModel });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="claude">Anthropic Claude</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <Select
            value={settings.model}
            onValueChange={(model) => {
              if (!model) return;
              setSettings((prev) => (prev ? { ...prev, model } : prev));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
