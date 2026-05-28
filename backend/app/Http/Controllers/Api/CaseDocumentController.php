<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\CaseDocument;
use App\Models\Cases;
use App\Models\DocumentAccessLog;
use App\Jobs\ConvertCaseDocumentToPdf;
use App\Services\TenantDocumentStorage;
use App\Services\WordToPdfConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use setasign\Fpdi\Fpdi;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CaseDocumentController extends Controller
{
    public function index(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $documents = CaseDocument::where('case_id', $case->id)
            ->with('uploadedBy:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->limit(500)
            ->get();

        return response()->json(['documents' => $documents]);
    }

    public function store(Request $request, int $caseId, TenantDocumentStorage $storage): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        $case = Cases::where('business_id', $businessId)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'documents' => 'required|array|min:1',
            'documents.*' => 'file|max:65536|mimes:pdf,jpg,jpeg,png,gif,doc,docx,xls,xlsx',
            'document_names' => 'nullable|array',
            'document_names.*' => 'nullable|string|max:255',
            'document_date' => 'nullable|date',
        ]);

        $business = Business::findOrFail($businessId);
        $documentNames = $request->input('document_names', []);
        $documentDate = $request->input('document_date');

        $uploaded = [];
        foreach ($request->file('documents') as $index => $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            $rawName = !empty($documentNames[$index]) ? $documentNames[$index] : $file->getClientOriginalName();

            $info = $storage->upload($business, $case->id, $file);
            $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($rawName));

            $doc = CaseDocument::create([
                'case_id'         => $case->id,
                'business_id'     => $businessId,
                'original_name'   => $safeName,
                'file_path'       => $info['file_path'],
                'disk'            => $info['disk'],
                'storage_key'     => $info['storage_key'],
                'kms_key_id'      => $info['kms_key_id'],
                'etag'            => $info['etag'],
                'checksum_sha256' => $info['checksum_sha256'],
                'file_size'       => $info['file_size'],
                'mime_type'       => $info['mime_type'],
                'uploaded_by'     => $request->user()->id,
                'document_date'   => $documentDate,
            ]);

            // Word documents convert to PDF in the background — upload returns
            // immediately, the queue worker swaps the bytes a few seconds later.
            if ($ext === 'docx' || $ext === 'doc') {
                ConvertCaseDocumentToPdf::dispatch($doc->id);
            }

            $uploaded[] = $doc;
        }

        $ids = collect($uploaded)->pluck('id');
        $result = CaseDocument::whereIn('id', $ids)
            ->with('uploadedBy:id,first_name,last_name')
            ->get();

        return response()->json(['documents' => $result], 201);
    }

    /**
     * Step 1 of the direct-upload flow. Returns a presigned POST URL + form
     * fields locking the upload to this tenant's KMS key. The browser then
     * POSTs the file straight to S3 without traversing php-fpm.
     */
    public function presignUpload(Request $request, int $caseId, TenantDocumentStorage $storage): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($storage->activeDriver() !== 's3') {
            return response()->json(['message' => 'Direct uploads require the S3 storage driver.'], 422);
        }

        $businessId = $request->user()->business_id;
        $case = Cases::where('business_id', $businessId)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'files'             => 'required|array|min:1|max:20',
            'files.*.name'      => 'required|string|max:255',
            'files.*.size'      => 'required|integer|min:1|max:33554432',
            'files.*.type'      => 'nullable|string|max:127',
        ]);

        $business = Business::findOrFail($businessId);
        $presigned = collect($validated['files'])->map(function (array $file) use ($storage, $business, $case) {
            return $storage->presignUpload($business, $case->id, $file['name']) + ['original_name' => $file['name']];
        });

        return response()->json(['uploads' => $presigned]);
    }

    /**
     * Step 2 of the direct-upload flow. Browser tells us which S3 keys it
     * successfully uploaded; we verify each, create the DB row, and (for
     * Word docs) queue the PDF conversion.
     */
    public function registerUpload(Request $request, int $caseId, TenantDocumentStorage $storage): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;
        $case = Cases::where('business_id', $businessId)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'documents'                 => 'required|array|min:1|max:20',
            'documents.*.key'           => 'required|string|max:1024',
            'documents.*.original_name' => 'required|string|max:255',
            'documents.*.display_name'  => 'nullable|string|max:255',
            'document_date'             => 'nullable|date',
        ]);

        $business = Business::findOrFail($businessId);
        $uploaded = [];

        foreach ($validated['documents'] as $entry) {
            try {
                $info = $storage->registerS3Object($business, $case->id, $entry['key']);
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Upload could not be confirmed: ' . $e->getMessage(),
                ], 422);
            }

            $rawName = !empty($entry['display_name']) ? $entry['display_name'] : $entry['original_name'];
            $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($rawName));
            $ext = strtolower(pathinfo($entry['original_name'], PATHINFO_EXTENSION));

            $doc = CaseDocument::create([
                'case_id'         => $case->id,
                'business_id'     => $businessId,
                'original_name'   => $safeName,
                'file_path'       => $info['file_path'],
                'disk'            => $info['disk'],
                'storage_key'     => $info['storage_key'],
                'kms_key_id'      => $info['kms_key_id'],
                'etag'            => $info['etag'],
                'checksum_sha256' => $info['checksum_sha256'],
                'file_size'       => $info['file_size'],
                'mime_type'       => $info['mime_type'],
                'uploaded_by'     => $request->user()->id,
                'document_date'   => $validated['document_date'] ?? null,
            ]);

            if ($ext === 'docx' || $ext === 'doc') {
                ConvertCaseDocumentToPdf::dispatch($doc->id);
            }

            $uploaded[] = $doc;
        }

        $ids = collect($uploaded)->pluck('id');
        $result = CaseDocument::whereIn('id', $ids)
            ->with('uploadedBy:id,first_name,last_name')
            ->get();

        return response()->json(['documents' => $result], 201);
    }

    public function download(Request $request, int $caseId, int $documentId, TenantDocumentStorage $storage)
    {
        $document = $this->findDocument($request, $caseId, $documentId);

        if (!$storage->exists($document)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $this->logAccess($request, $document, 'download');
        return $this->streamDocument($storage, $document, asAttachment: true);
    }

    public function view(Request $request, int $caseId, int $documentId, TenantDocumentStorage $storage)
    {
        $document = $this->findDocument($request, $caseId, $documentId);

        if (!$storage->exists($document)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $this->logAccess($request, $document, 'view');
        return $this->streamDocument($storage, $document, asAttachment: false);
    }

    public function merge(Request $request, int $caseId, TenantDocumentStorage $storage)
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $documents = CaseDocument::where('case_id', $case->id)
            ->orderBy('created_at', 'desc')
            ->get();

        if ($documents->isEmpty()) {
            return response()->json(['message' => 'No documents to merge'], 404);
        }

        $pdf = new Fpdi();
        $pdf->SetAutoPageBreak(false);
        $tmpFiles = [];

        try {
            foreach ($documents as $doc) {
                if (!$storage->exists($doc)) {
                    continue;
                }

                $local = $storage->localPath($doc);
                if ($local['is_temp']) {
                    $tmpFiles[] = $local['path'];
                }
                $filePath = $local['path'];
                $mime = strtolower($doc->mime_type ?? '');

                $name = strtolower($doc->original_name ?? '');
                $isDocx = str_contains($mime, 'wordprocessingml')
                    || str_ends_with($name, '.docx')
                    || str_ends_with($name, '.doc');

                if ($isDocx) {
                    $convertedPdf = app(WordToPdfConverter::class)->convert($filePath);
                    if ($convertedPdf === null) {
                        continue;
                    }
                    $tmpFiles[] = $convertedPdf;
                    $filePath = $convertedPdf;
                }

                if ($isDocx || str_contains($mime, 'pdf')) {
                    try {
                        $pageCount = $pdf->setSourceFile($filePath);
                        for ($i = 1; $i <= $pageCount; $i++) {
                            $tpl = $pdf->importPage($i);
                            $size = $pdf->getTemplateSize($tpl);
                            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                            $pdf->useTemplate($tpl);
                        }
                    } catch (\Exception $e) {
                        continue;
                    }
                } elseif (str_starts_with($mime, 'image/')) {
                    try {
                        $ext = match (true) {
                            str_contains($mime, 'png') => 'PNG',
                            str_contains($mime, 'gif') => 'GIF',
                            default => 'JPG',
                        };
                        $pdf->AddPage();
                        $pageW = $pdf->GetPageWidth();
                        $pageH = $pdf->GetPageHeight();
                        $margin = 10;
                        $maxW = $pageW - (2 * $margin);
                        $maxH = $pageH - (2 * $margin);

                        [$imgW, $imgH] = getimagesize($filePath);
                        $ratio = min($maxW / $imgW, $maxH / $imgH, 1);
                        $w = $imgW * $ratio;
                        $h = $imgH * $ratio;
                        $x = $margin + ($maxW - $w) / 2;
                        $y = $margin + ($maxH - $h) / 2;

                        $pdf->Image($filePath, $x, $y, $w, $h, $ext);
                    } catch (\Exception $e) {
                        continue;
                    }
                }
            }

            if ($pdf->PageNo() === 0) {
                return response()->json(['message' => 'No compatible documents to merge (PDF, Word, or images).'], 422);
            }

            $merged = $pdf->Output('S');
            $filename = $case->case_number ? "{$case->case_number}-merged.pdf" : "case-{$case->id}-merged.pdf";

            return response($merged, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
            ]);
        } finally {
            foreach ($tmpFiles as $tmp) {
                if (is_dir($tmp)) {
                    $this->rrmdir($tmp);
                } else {
                    @unlink($tmp);
                    // If this temp file came from a per-conversion dir under firmly-docx-*, clean the dir too.
                    $parent = dirname($tmp);
                    if (is_dir($parent) && str_contains($parent, 'firmly-docx-')) {
                        $this->rrmdir($parent);
                    }
                }
            }
        }
    }

    public function destroy(Request $request, int $caseId, int $documentId, TenantDocumentStorage $storage): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $document = $this->findDocument($request, $caseId, $documentId);

        // Tag for lifecycle expiry (S3 only) — local files stay until the GC cron purges.
        $storage->markForDeletion($document);

        // Soft delete the DB row; cron does forceDelete after retention window.
        $document->delete();

        return response()->json(['message' => 'Document deleted']);
    }

    // ---- internal helpers ----

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) return;
        $items = @scandir($dir) ?: [];
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->rrmdir($path) : @unlink($path);
        }
        @rmdir($dir);
    }

    private function findDocument(Request $request, int $caseId, int $documentId): CaseDocument
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            abort(403, 'Unauthorized');
        }

        return CaseDocument::where('case_id', $case->id)->findOrFail($documentId);
    }

    private function streamDocument(TenantDocumentStorage $storage, CaseDocument $document, bool $asAttachment): StreamedResponse
    {
        $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($document->original_name));
        $head = $storage->headInfo($document);
        $mime = $head['mime'] ?: ($document->mime_type ?: 'application/octet-stream');
        $disposition = $asAttachment ? 'attachment' : 'inline';

        $headers = [
            'Content-Type'        => $mime,
            'Content-Disposition' => $disposition . '; filename="' . $safeName . '"',
        ];
        if (($head['size'] ?? 0) > 0) {
            $headers['Content-Length'] = $head['size'];
        }

        return new StreamedResponse(function () use ($storage, $document) {
            $stream = $storage->readStream($document);
            try {
                while (!feof($stream)) {
                    echo fread($stream, 8192);
                    if (function_exists('ob_get_level') && ob_get_level() > 0) {
                        @ob_flush();
                    }
                    flush();
                }
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        }, 200, $headers);
    }

    private function logAccess(Request $request, CaseDocument $document, string $action): void
    {
        DocumentAccessLog::create([
            'case_document_id' => $document->id,
            'business_id'      => $request->user()->business_id,
            'user_id'          => $request->user()->id,
            'action'           => $action,
            'ip'               => $request->ip(),
            'user_agent'       => substr((string) $request->userAgent(), 0, 500),
        ]);
    }
}
