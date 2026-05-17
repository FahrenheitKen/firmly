<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CaseDocument;
use App\Models\Cases;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;

class CaseDocumentController extends Controller
{
    public function index(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $documents = CaseDocument::where('case_id', $case->id)
            ->with('uploadedBy:id,first_name,last_name')
            ->orderBy('created_at', 'desc')
            ->limit(500)
            ->get();

        return response()->json(['documents' => $documents]);
    }

    public function store(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $request->validate([
            'documents' => 'required|array|min:1',
            'documents.*' => 'file|max:10240|mimes:pdf,jpg,jpeg,png,gif,doc,docx,xls,xlsx',
            'document_names' => 'nullable|array',
            'document_names.*' => 'nullable|string|max:255',
            'document_date' => 'nullable|date',
        ]);

        $uploaded = [];
        $documentNames = $request->input('document_names', []);
        $documentDate = $request->input('document_date');

        foreach ($request->file('documents') as $index => $file) {
            $path = $file->store("case-documents/{$case->id}", 'local');
            $rawName = !empty($documentNames[$index]) ? $documentNames[$index] : $file->getClientOriginalName();
            $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($rawName));
            $serverMime = mime_content_type($file->getRealPath()) ?: 'application/octet-stream';

            $uploaded[] = CaseDocument::create([
                'case_id' => $case->id,
                'business_id' => $request->user()->business_id,
                'original_name' => $safeName,
                'file_path' => $path,
                'file_size' => $file->getSize(),
                'mime_type' => $serverMime,
                'uploaded_by' => $request->user()->id,
                'document_date' => $documentDate,
            ]);
        }

        $ids = collect($uploaded)->pluck('id');
        $result = CaseDocument::whereIn('id', $ids)
            ->with('uploadedBy:id,first_name,last_name')
            ->get();

        return response()->json(['documents' => $result], 201);
    }

    public function download(Request $request, int $caseId, int $documentId)
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $document = CaseDocument::where('case_id', $case->id)->findOrFail($documentId);

        if (!Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($document->original_name));
        return Storage::disk('local')->download($document->file_path, $safeName);
    }

    public function view(Request $request, int $caseId, int $documentId)
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $document = CaseDocument::where('case_id', $case->id)->findOrFail($documentId);

        if (!Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        $path = Storage::disk('local')->path($document->file_path);
        $mime = mime_content_type($path) ?: 'application/octet-stream';
        $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($document->original_name));

        return response()->file($path, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . $safeName . '"',
        ]);
    }

    public function merge(Request $request, int $caseId)
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $documents = CaseDocument::where('case_id', $case->id)
            ->orderBy('created_at', 'asc')
            ->get();

        if ($documents->isEmpty()) {
            return response()->json(['message' => 'No documents to merge'], 404);
        }

        $pdf = new Fpdi();
        $pdf->SetAutoPageBreak(false);

        foreach ($documents as $doc) {
            if (!Storage::disk('local')->exists($doc->file_path)) {
                continue;
            }

            $filePath = Storage::disk('local')->path($doc->file_path);
            $mime = strtolower($doc->mime_type ?? '');

            if (str_contains($mime, 'pdf')) {
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
            return response()->json(['message' => 'No compatible documents to merge (PDF/images only)'], 422);
        }

        $merged = $pdf->Output('S');
        $filename = $case->case_number ? "{$case->case_number}-merged.pdf" : "case-{$case->id}-merged.pdf";

        return response($merged, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function destroy(Request $request, int $caseId, int $documentId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $document = CaseDocument::where('case_id', $case->id)->findOrFail($documentId);

        Storage::disk('local')->delete($document->file_path);
        $document->delete();

        return response()->json(['message' => 'Document deleted']);
    }
}
