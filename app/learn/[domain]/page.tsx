import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackPath } from "@/components/TrackPath";
import { getAllTopics, getCurriculum, getWorkspaces } from "@/lib/content";
import { DOMAIN_LABELS, DOMAINS, type Domain } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOMAINS.map((domain) => ({ domain }));
}

export async function generateMetadata(props: PageProps<"/learn/[domain]">): Promise<Metadata> {
  const { domain } = await props.params;
  return { title: `${DOMAIN_LABELS[domain as Domain] ?? "Track"} · Fundamentals` };
}

export default async function TrackPage(props: PageProps<"/learn/[domain]">) {
  const { domain } = await props.params;
  if (!(DOMAINS as readonly string[]).includes(domain)) notFound();
  return <TrackPath domain={domain as Domain} curriculum={getCurriculum()} topics={getAllTopics()} workspaces={getWorkspaces()} />;
}
