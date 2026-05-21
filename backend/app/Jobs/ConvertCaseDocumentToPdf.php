<?php

namespace App\Jobs;

use App\Models\CaseDocument;
use App\Services\DocumentConverter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ConvertCaseDocumentToPdf implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function __construct(public readonly int $documentId) {}

    public function handle(DocumentConverter $converter): void
    {
        $doc = CaseDocument::find($this->documentId);
        if (!$doc) {
            return; // deleted between dispatch and processing
        }

        // Idempotent — if already converted, no-op.
        if (str_contains((string) $doc->mime_type, 'pdf')) {
            return;
        }

        $converter->convertInPlace($doc);
    }
}
