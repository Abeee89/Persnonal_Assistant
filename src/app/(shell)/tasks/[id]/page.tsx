import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TaskDetailActions } from "@/features/tasks/components/task-detail-actions";
import { loadTask } from "@/features/tasks/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: loadTask(id)?.title ?? "Task" };
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = loadTask(id);
  if (!task) {
    notFound();
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/tasks" className="hover:underline">
          Tasks
        </Link>
      </nav>
      <PageHeader title={task.title} description={task.dueDate ? `Due ${task.dueDate}` : "No due date"} />
      <div className="space-y-6">
        <TaskDetailActions task={task} />
        <dl className="grid gap-3 rounded-lg border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="capitalize">{task.status.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="capitalize">{task.priority}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Goal</dt>
            <dd>
              {task.goalId && task.goalTitle ? (
                <Link href={`/goals/${task.goalId}`} className="hover:underline">
                  {task.goalTitle}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Linked activity</dt>
            <dd>
              {task.activityId ? (
                <Link href={`/activities/${task.activityId}`} className="hover:underline">
                  Open activity
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Tags</dt>
            <dd>{task.tags.length > 0 ? task.tags.map((tag) => `#${tag}`).join(" ") : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap">{task.description ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
