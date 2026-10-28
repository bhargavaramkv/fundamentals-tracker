import type { Metadata } from "next";
import { SettingsPanel } from "@/components/SettingsPanel";

export const metadata: Metadata = { title: "Systems · BHARGAVA.DEV" };

export default function SettingsPage() {
  return <SettingsPanel />;
}
