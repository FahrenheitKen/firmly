<?php

namespace App\Console\Commands;

use App\Models\CaseDocument;
use App\Services\TenantDocumentStorage;
use Illuminate\Console\Command;
use Throwable;

/**
 * Hard-deletes soft-deleted documents whose retention window has elapsed.
 *
 * For S3-backed documents, the bucket lifecycle rule (tag:firmly-pending-delete)
 * also purges the bytes — this command is the source of truth for the DB row
 * cleanup and the belt-and-suspenders byte cleanup. Idempotent: calling
 * deleteObject on an already-gone key is a no-op on S3.
 *
 * The global tenant scope on CaseDocument applies only under
 * auth()->check() — in CLI/scheduler context it bypasses, so this command
 * sees and purges across all tenants.
 */
class PurgeExpiredDocuments extends Command
{
    protected $signature = 'documents:purge-expired
                            {--dry-run : List what would be purged without deleting}
                            {--limit=1000 : Maximum documents to process per run}';

    protected $description = 'Hard-delete soft-deleted case documents past the retention window.';

    public function handle(TenantDocumentStorage $storage): int
    {
        $days   = (int) config('documents.soft_delete_retention_days', 30);
        $cutoff = now()->subDays($days);
        $limit  = max(1, (int) $this->option('limit'));
        $dryRun = (bool) $this->option('dry-run');

        $ids = CaseDocument::onlyTrashed()
            ->where('deleted_at', '<', $cutoff)
            ->orderBy('deleted_at')
            ->limit($limit)
            ->pluck('id');

        $count = $ids->count();
        $this->info("Found {$count} document(s) past retention ({$days} days).");

        if ($count === 0) {
            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->warn('DRY RUN — no deletions performed.');
            CaseDocument::onlyTrashed()
                ->whereIn('id', $ids)
                ->get(['id', 'business_id', 'case_id', 'disk', 'storage_key', 'file_path', 'deleted_at'])
                ->each(function (CaseDocument $doc): void {
                    $this->line(sprintf(
                        '  - id=%d business=%d case=%d disk=%s key=%s deleted_at=%s',
                        $doc->id,
                        $doc->business_id,
                        $doc->case_id,
                        $doc->disk,
                        $doc->storage_key ?? $doc->file_path ?? '(none)',
                        $doc->deleted_at?->toIso8601String() ?? '(null)',
                    ));
                });
            return self::SUCCESS;
        }

        $ok = 0;
        $failed = 0;

        foreach ($ids as $id) {
            $doc = CaseDocument::onlyTrashed()->find($id);
            if (!$doc) {
                continue; // raced with another runner; ignore
            }
            try {
                $storage->forceDelete($doc);
                $doc->forceDelete();
                $ok++;
            } catch (Throwable $e) {
                $failed++;
                report($e);
                $this->error(sprintf('  ! id=%d failed: %s', $id, $e->getMessage()));
            }
        }

        $this->info("Purged: {$ok}");
        if ($failed > 0) {
            $this->warn("Failed: {$failed} (see application log)");
        }

        return self::SUCCESS;
    }
}
