"use client";

import { useSearchParams } from "next/navigation";

export default function SettingsClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "geral";

  return (
    <div>
      <h1>Settings</h1>
      <p>Tab: {tab}</p>
    </div>
  );
}
