<?php

namespace App\Console\Commands;

use App\Jobs\ConvertCaseDocumentToPdf;
use App\Models\CaseDocument;
use App\Services\DocumentConverter;
use Illuminate\Console\Command;
use Throwable;

/**
 * One-shot migration that converts every stored .doc/.docx case document
 * into a PDF in place. Safe to re-run — already-PDF rows don't match.
 *
 * Use --queue to dispatch the conversions onto the queue worker instead of
 * running them inline.
 */
class ConvertWordDocumentsToPdf extends Command
{
    protected $signature = 'documents:convert-word-to-pdf
                            {--dry-run : List what would be converted without changing anything}
                            {--limit=0 : Maximum documents to process (0 = no limit)}
                            {--case= : Restrict to a single case_id}
                            {--business= : Restrict to a single business_id}
                            {--queue : Dispatch conversions to the queue instead of running inline}';

    protected $description = 'Convert all existing .doc/.docx case documents to PDF in place.';

    public function handle(DocumentConverter $converter): int
    {
        $dryRun  = (bool) $this->option('dry-run');
        $useQueue = (bool) $this->option('queue');
        $limit   = (int)  $this->option('limit');
        $caseId  = $this->option('case')     ? (int) $this->option('case')     : null;
        $busId   = $this->option('business') ? (int) $this->option('business') : null;

        $query = CaseDocument::query()
            ->where(function ($q) {
                $q->where('mime_type', 'like', '%wordprocessingml%')
                  ->orWhere('mime_type', 'like', '%msword%')
                  ->orWhere('original_name', 'like', '%.docx')
                  ->orWhere('original_name', 'like', '%.doc');
            })
            ->orderBy('id');

        if ($caseId)  $query->where('case_id', $caseId);
        if ($busId)   $query->where('business_id', $busId);
        if ($limit>0) $query->limit($limit);

        $total = $query->count();
        $this->info("Found {$total} Word document(s).");

        if ($total === 0) return self::SUCCESS;

        if ($dryRun) {
            $query->limit(min($total, 50))->get(['id','business_id','case_id','original_name','mime_type'])
                ->each(fn (CaseDocument $d) => $this->line(sprintf(
                    '  - id=%d case=%d biz=%d name=%s mime=%s',
                    $d->id, $d->case_id, $d->business_id, $d->original_name, $d->mime_type ?? '?'
                )));
            if ($total > 50) $this->line(sprintf('  …and %d more', $total - 50));
            return self::SUCCESS;
        }

        if ($useQueue) {
            $dispatched = 0;
            $query->cursor()->each(function (CaseDocument $doc) use (&$dispatched) {
                ConvertCaseDocumentToPdf::dispatch($doc->id);
                $dispatched++;
            });
            $this->info("Dispatched {$dispatched} conversion job(s).");
            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();
        $ok = 0; $failed = 0;

        $query->cursor()->each(function (CaseDocument $doc) use ($converter, $bar, &$ok, &$failed) {
            try {
                $converter->convertInPlace($doc) ? $ok++ : $failed++;
            } catch (Throwable $e) {
                $failed++;
                report($e);
                $this->newLine();
                $this->error("  ! id={$doc->id} failed: {$e->getMessage()}");
            } finally {
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("Converted: {$ok}");
        if ($failed > 0) $this->error("Failed: {$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
