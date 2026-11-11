import { Today } from "@/components/Today";
import { getAllTopics, getCurriculum, getWorkspaces } from "@/lib/content";

export default function HomeRoute() {
  return <Today curriculum={getCurriculum()} topics={getAllTopics()} workspaces={getWorkspaces()} />;
}
