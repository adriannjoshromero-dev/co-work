import { Dashboard } from "@/components/dashboard";
import { requirePageUser } from "@/lib/auth";
import { listInterviews } from "@/lib/interviews";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requirePageUser();
  const interviews = await listInterviews(user.workspaceId);
  return <Dashboard initialData={{ user, interviews }} />;
}
