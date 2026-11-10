import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TopicWorkspaceView, type LessonNav } from "@/components/TopicWorkspaceView";
import { getAllQuestions, getAllTopics, getCurriculum, getLesson, getResources, getWorkspaces } from "@/lib/content";
import { allKeys } from "@/lib/curriculum";
import { resourcesForTopic } from "@/lib/resources";
import { DOMAINS, type Domain, type TopicWorkspace } from "@/lib/types";

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

const NO_WORKSPACE: TopicWorkspace = { order: 0, prerequisites: [], objectives: [], exercises: [], practical: [] };

export default async function TopicPage(props: PageProps<"/learn/[domain]/[topic]">) {
  const { domain, topic } = await props.params;
  const lesson = load(domain, topic);
  if (!lesson) notFound();
  const key = `${lesson.domain}/${lesson.topic}`;
  const workspace = getWorkspaces()[key] ?? NO_WORKSPACE;
  const topics = getAllTopics();
  const titleOf = (k: string) => topics.find((x) => `${x.domain}/${x.topic}` === k)?.title;
  const prerequisites = workspace.prerequisites.flatMap((p) => {
    const title = titleOf(p);
    return title ? [{ key: p, title }] : [];
  });

  const curriculum = getCurriculum();
  const track = curriculum.tracks.find((t) => t.domain === lesson.domain);
  const stage = track?.stages.find((s) => s.topics.includes(lesson.topic));
  const nextKey = allKeys(curriculum)[allKeys(curriculum).indexOf(key) + 1];
  const nav: LessonNav | null =
    track && stage
      ? {
          trackTitle: track.title,
          stageTitle: stage.title,
          position: stage.topics.indexOf(lesson.topic) + 1,
          count: stage.topics.length,
          next: nextKey ? { href: `/learn/${nextKey}/`, title: titleOf(nextKey) ?? nextKey } : null,
        }
      : null;

  return (
    <Suspense fallback={<p className="text-ink-2">Loading {lesson.title}…</p>}>
      <TopicWorkspaceView
        lesson={lesson}
        workspace={workspace}
        questions={getAllQuestions().filter((q) => q.domain === lesson.domain && q.topic === lesson.topic)}
        resources={resourcesForTopic(getResources(), key)}
        prerequisites={prerequisites}
        nav={nav}
      />
    </Suspense>
  );
}
