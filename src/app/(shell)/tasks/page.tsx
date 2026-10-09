import { PageHeader } from "@/components/shared/page-header";
import { TaskLanes } from "@/features/tasks/components/task-lanes";
import { loadTaskLanes } from "@/features/tasks/queries";

export const metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default function TasksPage() {
  const { lanes } = loadTaskLanes();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader title="Tasks" description="Keep it light: what is due, what is next, what is done." />
      <TaskLanes lanes={lanes} />
    </div>
  );
}
