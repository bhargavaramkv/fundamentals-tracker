import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TopicWorkspaceView } from "@/components/TopicWorkspaceView";
import { getAllQuestions, getAllTopics, getLesson, getResources, getWorkspaces } from "@/lib/content";
import { resourcesForTopic } from "@/lib/resources";
import { DOMAINS, type Domain } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTopics().map((t) => ({ domain: t.domain, topic: t.topic }));
}

function load(domain: string, topic: string) {
  if (!(DOMAINS as readonly string[]).includes(domain)) return null;
  return getLesson(domain as Domain, topic);
}

export async function generateMetadata(props: PageProps<"/learn/[domain]/[topic]">): Promise<Metadata> {
  const { domain, topic } = await props.params;
  const lesson = load(domain, topic);
  return { title: lesson ? `${lesson.title} · Fundamentals` : "Topic" };
}

export default async function TopicPage(props: PageProps<"/learn/[domain]/[topic]">) {
  const { domain, topic } = await props.params;
  const lesson = load(domain, topic);
  if (!lesson) notFound();
  const key = `${lesson.domain}/${lesson.topic}`;
  const workspace = getWorkspaces()[key];
  if (!workspace) notFound();
  const topics = getAllTopics();
  const prerequisites = workspace.prerequisites.flatMap((p) => {
    const t = topics.find((x) => `${x.domain}/${x.topic}` === p);
    return t ? [{ key: p, title: t.title }] : [];
  });

  return (
    <Suspense fallback={<p className="text-ink-2">Loading {lesson.title}…</p>}>
      <TopicWorkspaceView
        lesson={lesson}
        workspace={workspace}
        questions={getAllQuestions().filter((q) => q.domain === lesson.domain && q.topic === lesson.topic)}
        resources={resourcesForTopic(getResources(), key)}
        prerequisites={prerequisites}
      />
    </Suspense>
  );
}
