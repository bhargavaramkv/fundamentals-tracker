import { LegacyRedirect } from "@/components/LegacyRedirect";
import { getAllTopics } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTopics().map((t) => ({ domain: t.domain, topic: t.topic }));
}

export default async function LessonRedirect(props: PageProps<"/lessons/[domain]/[topic]">) {
  const { domain, topic } = await props.params;
  return <LegacyRedirect to={`/learn/${domain}/${topic}/`} />;
}
