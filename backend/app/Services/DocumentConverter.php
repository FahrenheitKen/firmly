<?php

namespace App\Services;

use App\Models\Business;
use App\Models\CaseDocument;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use Throwable;

/**
 * Converts a stored CaseDocument from .doc/.docx into a PDF in place. Used
 * both by the background queue job and by the documents:convert-word-to-pdf
 * artisan command — so the conversion flow lives in exactly one place.
 */
class DocumentConverter
{
    public function __construct(
        private readonly TenantDocumentStorage $storage,
        private readonly WordToPdfConverter $converter,
    ) {}

    /**
     * Convert a single document in place. Returns true on success.
     * Throws on hard failures so the caller can mark the job failed.
     */
    public function convertInPlace(CaseDocument $doc): bool
    {
        if (!$this->storage->exists($doc)) {
            return false;
        }

        $business = Business::find($doc->business_id);
        if (!$business) {
            return false;
        }

        $local = $this->storage->localPath($doc);
        $sourcePath = $local['path'];

        // soffice picks the input filter from the file extension. Stored S3
        // tempfiles have no extension, so copy under a .docx name first.
        $renamedPath = null;
        if (!preg_match('/\.(docx?|DOCX?)$/', $sourcePath)) {
            $renamedPath = $sourcePath . '.docx';
            @copy($sourcePath, $renamedPath);
            $sourceForConvert = $renamedPath;
        } else {
            $sourceForConvert = $sourcePath;
        }

        try {
            $pdfPath = $this->converter->convert($sourceForConvert);
            if ($pdfPath === null) {
                throw new RuntimeException('LibreOffice conversion failed');
            }

            try {
                $pdfName = pathinfo($doc->original_name, PATHINFO_FILENAME) . '.pdf';
                $upload  = new UploadedFile($pdfPath, $pdfName, 'application/pdf', null, true);
                $newInfo = $this->storage->upload($business, $doc->case_id, $upload);

                $oldDoc = clone $doc;

                $newName = preg_replace('/\.(docx?|DOCX?)$/', '.pdf', $doc->original_name) ?? $doc->original_name;
                if (!preg_match('/\.pdf$/i', $newName)) {
                    $newName .= '.pdf';
                }

                $doc->forceFill([
                    'original_name'   => $newName,
                    'file_path'       => $newInfo['file_path'],
                    'disk'            => $newInfo['disk'],
                    'storage_key'     => $newInfo['storage_key'],
                    'kms_key_id'      => $newInfo['kms_key_id'],
                    'etag'            => $newInfo['etag'],
                    'checksum_sha256' => $newInfo['checksum_sha256'],
                    'file_size'       => $newInfo['file_size'],
                    'mime_type'       => 'application/pdf',
                ])->save();

                try {
                    $this->storage->forceDelete($oldDoc);
                } catch (Throwable $e) {
                    // Orphaned bytes are recoverable; don't fail the conversion over them.
                    report($e);
                }
            } finally {
                $this->converter->cleanup($pdfPath);
            }
        } finally {
            if ($renamedPath && is_file($renamedPath)) {
                @unlink($renamedPath);
            }
            if ($local['is_temp'] && is_file($sourcePath)) {
                @unlink($sourcePath);
            }
        }

        return true;
    }
}
