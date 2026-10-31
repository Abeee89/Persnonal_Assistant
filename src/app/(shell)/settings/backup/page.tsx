import { PageHeader } from "@/components/shared/page-header";
import { parseEnv } from "@/config/env";
import { BackupPanel } from "@/features/backup/components/backup-panel";
import { listAutoBackups } from "@/features/backup/service";

export const metadata = { title: "Backup" };
export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupPage() {
  const env = parseEnv(process.env);
  const backups = listAutoBackups(env.DATA_DIR);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8">
      <PageHeader title="Backup" description="Your whole database and attachments, in one file you own." />
      <BackupPanel />

      <section aria-labelledby="history-heading" className="mt-8 space-y-3">
        <h2 id="history-heading" className="text-sm font-medium">
          Automatic safety copies
        </h2>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. A copy is taken automatically right before a restore.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {backups.slice(0, 10).map((backup) => (
              <li key={backup.name} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate font-mono text-xs">{backup.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{formatBytes(backup.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">They live in the backups/auto folder inside your data directory.</p>
      </section>
    </div>
  );
}
