<?php

namespace App\Services;

use App\Models\Business;
use App\Models\CaseDocument;
use Aws\S3\PostObjectV4;
use Aws\S3\S3Client;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Single chokepoint for tenant-aware document storage.
 *
 * Controllers must NOT call Storage::disk('s3') directly — they pass domain
 * objects (Business, CaseDocument) into this service, and the service builds
 * S3 keys and KMS encryption context from those objects. This makes it
 * impossible for a controller to construct a foreign-tenant key by accident.
 */
class TenantDocumentStorage
{
    public function __construct(
        private readonly string $driver,
        private readonly string $localDisk = 'local',
        private readonly string $s3Disk = 's3',
        private readonly ?string $kmsAliasPrefix = null,
        private readonly string $pendingDeleteTagKey = 'firmly-pending-delete',
        private readonly string $pendingDeleteTagValue = 'true',
    ) {
        if ($this->driver === 's3' && empty($this->kmsAliasPrefix)) {
            throw new RuntimeException(
                'TenantDocumentStorage: FIRMLY_DOCUMENT_KMS_ALIAS_PREFIX is required when driver=s3'
            );
        }
    }

    public function activeDriver(): string
    {
        return $this->driver;
    }

    /**
     * Generate a presigned POST URL + form fields that lets the browser upload
     * a single file straight to S3 (skipping the php-fpm hop). The policy
     * locks the upload to this tenant's KMS key + encryption context, so the
     * client cannot rebind it to another business.
     *
     * @return array{url:string,fields:array<string,string>,key:string,disk:string,kms_key_id:string,max_size:int,expires_at:string}
     */
    public function presignUpload(Business $business, int $caseId, string $originalName, int $maxBytes = 33554432): array
    {
        if ($this->driver !== 's3') {
            throw new RuntimeException('Presigned uploads require the S3 driver.');
        }

        $slug = $this->safeFilename($originalName);
        $uuid = (string) Str::uuid();
        $key  = "tenants/{$business->id}/cases/{$caseId}/documents/{$uuid}-{$slug}";
        $kmsKeyId = $this->kmsAliasFor($business);
        $encContext = base64_encode(json_encode(['business_id' => (string) $business->id]));

        $expires = now()->addMinutes(10);

        $formInputs = [
            'key'                                           => $key,
            'x-amz-server-side-encryption'                  => 'aws:kms',
            'x-amz-server-side-encryption-aws-kms-key-id'   => $kmsKeyId,
            'x-amz-server-side-encryption-context'          => $encContext,
            'x-amz-meta-business-id'                        => (string) $business->id,
            'x-amz-meta-case-id'                            => (string) $caseId,
        ];

        $options = [
            ['bucket' => $this->s3Bucket()],
            ['eq', '$key', $key],
            ['eq', '$x-amz-server-side-encryption', 'aws:kms'],
            ['eq', '$x-amz-server-side-encryption-aws-kms-key-id', $kmsKeyId],
            ['eq', '$x-amz-server-side-encryption-context', $encContext],
            ['eq', '$x-amz-meta-business-id', (string) $business->id],
            ['eq', '$x-amz-meta-case-id', (string) $caseId],
            ['content-length-range', 1, $maxBytes],
        ];

        $postObject = new PostObjectV4(
            $this->s3Client(),
            $this->s3Bucket(),
            $formInputs,
            $options,
            $expires->toIso8601String(),
        );

        return [
            'url'        => $postObject->getFormAttributes()['action'],
            'fields'     => $postObject->getFormInputs(),
            'key'        => $key,
            'disk'       => 's3',
            'kms_key_id' => $kmsKeyId,
            'max_size'   => $maxBytes,
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    /**
     * After a presigned upload completes, the controller calls this to
     * confirm the object exists and to gather the metadata needed for the
     * CaseDocument row. Returns the same shape as upload().
     *
     * @return array{disk:string,file_path:?string,storage_key:?string,kms_key_id:string,etag:?string,checksum_sha256:string,file_size:int,mime_type:string}
     */
    public function registerS3Object(Business $business, int $caseId, string $key): array
    {
        if ($this->driver !== 's3') {
            throw new RuntimeException('registerS3Object requires the S3 driver.');
        }

        // Defense in depth: refuse any key that doesn't sit under this tenant's prefix.
        $expectedPrefix = "tenants/{$business->id}/cases/{$caseId}/documents/";
        if (!str_starts_with($key, $expectedPrefix)) {
            throw new RuntimeException("Key '{$key}' does not belong to business {$business->id} / case {$caseId}.");
        }

        $head = $this->s3Client()->headObject([
            'Bucket' => $this->s3Bucket(),
            'Key'    => $key,
        ]);

        return [
            'disk'            => 's3',
            'file_path'       => null,
            'storage_key'     => $key,
            'kms_key_id'      => $this->kmsAliasFor($business),
            'etag'            => trim((string) ($head['ETag'] ?? ''), '"'),
            // No client-side checksum yet; left empty so PurgeExpiredDocuments
            // still works (it never reads this field).
            'checksum_sha256' => '',
            'file_size'       => (int) ($head['ContentLength'] ?? 0),
            'mime_type'       => $head['ContentType'] ?? 'application/octet-stream',
        ];
    }

    /**
     * Persist an uploaded file. Returns columns to merge into the
     * case_documents row.
     *
     * @return array{disk:string,file_path:?string,storage_key:?string,kms_key_id:?string,etag:?string,checksum_sha256:string,file_size:int,mime_type:string}
     */
    public function upload(Business $business, int $caseId, UploadedFile $file): array
    {
        $checksum = hash_file('sha256', $file->getRealPath()) ?: '';
        $slug = $this->safeFilename($file->getClientOriginalName());
        $uuid = (string) Str::uuid();
        $mime = mime_content_type($file->getRealPath()) ?: 'application/octet-stream';

        return match ($this->driver) {
            'local' => $this->uploadLocal($caseId, $file, $uuid, $slug, $checksum, $mime),
            's3'    => $this->uploadS3($business, $caseId, $file, $uuid, $slug, $checksum, $mime),
            default => throw new RuntimeException("Unknown document driver: {$this->driver}"),
        };
    }

    /** @return resource */
    public function readStream(CaseDocument $doc)
    {
        return match ($doc->disk) {
            'local' => $this->readStreamLocal($doc),
            's3'    => $this->readStreamS3($doc),
            default => throw new RuntimeException("Unknown disk on document {$doc->id}: {$doc->disk}"),
        };
    }

    /** @return array{size:int,mime:?string} */
    public function headInfo(CaseDocument $doc): array
    {
        return match ($doc->disk) {
            'local' => $this->headInfoLocal($doc),
            's3'    => $this->headInfoS3($doc),
            default => throw new RuntimeException("Unknown disk: {$doc->disk}"),
        };
    }

    public function exists(CaseDocument $doc): bool
    {
        return match ($doc->disk) {
            'local' => $doc->file_path
                ? Storage::disk($this->localDisk)->exists($doc->file_path)
                : false,
            's3'    => $doc->storage_key
                ? Storage::disk($this->s3Disk)->exists($doc->storage_key)
                : false,
            default => false,
        };
    }

    /**
     * Get a filesystem path to the bytes — for tools (Fpdi, ImageMagick)
     * that require a path rather than a stream. For non-local disks this
     * downloads to a tempfile; caller must unlink when is_temp=true.
     *
     * @return array{path:string,is_temp:bool}
     */
    public function localPath(CaseDocument $doc): array
    {
        if ($doc->disk === 'local' && $doc->file_path) {
            return [
                'path' => Storage::disk($this->localDisk)->path($doc->file_path),
                'is_temp' => false,
            ];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'doc-');
        if ($tmp === false) {
            throw new RuntimeException("Failed to allocate tempfile for document {$doc->id}");
        }

        $in = $this->readStream($doc);
        $out = fopen($tmp, 'wb');
        try {
            stream_copy_to_stream($in, $out);
        } finally {
            if (is_resource($in)) {
                fclose($in);
            }
            if (is_resource($out)) {
                fclose($out);
            }
        }
        return ['path' => $tmp, 'is_temp' => true];
    }

    /**
     * Mark for soft-delete. On S3 this tags the object so the lifecycle
     * rule will expire it after the retention window. On local it's a
     * no-op — the GC cron handles purge via forceDelete().
     */
    public function copyDocument(CaseDocument $doc, int $newCaseId, Business $business): array
    {
        $uuid = (string) Str::uuid();
        $slug = $this->safeFilename($doc->original_name);

        if ($doc->disk === 'local' && $doc->file_path) {
            $newPath = "case-documents/{$newCaseId}/{$uuid}-{$slug}";
            $stream = Storage::disk($this->localDisk)->readStream($doc->file_path);
            try {
                Storage::disk($this->localDisk)->writeStream($newPath, $stream);
            } finally {
                if (is_resource($stream)) fclose($stream);
            }
            return [
                'disk'            => 'local',
                'file_path'       => $newPath,
                'storage_key'     => null,
                'kms_key_id'      => null,
                'etag'            => null,
                'checksum_sha256' => $doc->checksum_sha256,
                'file_size'       => $doc->file_size,
                'mime_type'       => $doc->mime_type,
            ];
        }

        if ($doc->disk === 's3' && $doc->storage_key) {
            $s3 = $this->s3Client();
            $bucket = $this->s3Bucket();
            $newKey = "tenants/{$business->id}/cases/{$newCaseId}/documents/{$uuid}-{$slug}";
            $kmsKeyId = $this->kmsAliasFor($business);

            $obj = $s3->getObject(['Bucket' => $bucket, 'Key' => $doc->storage_key]);
            $body = $obj['Body'];

            $result = $s3->putObject([
                'Bucket'                  => $bucket,
                'Key'                     => $newKey,
                'Body'                    => $body,
                'ContentType'             => $doc->mime_type ?: 'application/octet-stream',
                'ServerSideEncryption'    => 'aws:kms',
                'SSEKMSKeyId'             => $kmsKeyId,
                'SSEKMSEncryptionContext' => base64_encode(json_encode(['business_id' => (string) $business->id])),
                'Metadata'                => [
                    'business-id'     => (string) $business->id,
                    'case-id'         => (string) $newCaseId,
                    'checksum-sha256' => $doc->checksum_sha256 ?? '',
                ],
            ]);

            return [
                'disk'            => 's3',
                'file_path'       => null,
                'storage_key'     => $newKey,
                'kms_key_id'      => $kmsKeyId,
                'etag'            => trim((string) ($result['ETag'] ?? ''), '"'),
                'checksum_sha256' => $doc->checksum_sha256,
                'file_size'       => $doc->file_size,
                'mime_type'       => $doc->mime_type,
            ];
        }

        throw new RuntimeException("Cannot copy document {$doc->id}: unsupported disk {$doc->disk}");
    }

    public function markForDeletion(CaseDocument $doc): void
    {
        if ($doc->disk !== 's3' || !$doc->storage_key) {
            return;
        }
        $this->s3Client()->putObjectTagging([
            'Bucket'  => $this->s3Bucket(),
            'Key'     => $doc->storage_key,
            'Tagging' => [
                'TagSet' => [[
                    'Key'   => $this->pendingDeleteTagKey,
                    'Value' => $this->pendingDeleteTagValue,
                ]],
            ],
        ]);
    }

    /** Hard-delete the bytes. Called by the GC cron after the retention window. */
    public function forceDelete(CaseDocument $doc): void
    {
        if ($doc->disk === 'local' && $doc->file_path) {
            Storage::disk($this->localDisk)->delete($doc->file_path);
            return;
        }
        if ($doc->disk === 's3' && $doc->storage_key) {
            $this->s3Client()->deleteObject([
                'Bucket' => $this->s3Bucket(),
                'Key'    => $doc->storage_key,
            ]);
        }
    }

    // ----- local backend -----

    private function uploadLocal(int $caseId, UploadedFile $file, string $uuid, string $slug, string $checksum, string $mime): array
    {
        $relPath = "case-documents/{$caseId}/{$uuid}-{$slug}";
        $stream = fopen($file->getRealPath(), 'rb');
        try {
            Storage::disk($this->localDisk)->writeStream($relPath, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        return [
            'disk'            => 'local',
            'file_path'       => $relPath,
            'storage_key'     => null,
            'kms_key_id'      => null,
            'etag'            => null,
            'checksum_sha256' => $checksum,
            'file_size'       => (int) $file->getSize(),
            'mime_type'       => $mime,
        ];
    }

    private function readStreamLocal(CaseDocument $doc)
    {
        if (!$doc->file_path) {
            throw new RuntimeException("Document {$doc->id} has no file_path");
        }
        $stream = Storage::disk($this->localDisk)->readStream($doc->file_path);
        if (!$stream) {
            throw new RuntimeException("Local file missing for document {$doc->id}: {$doc->file_path}");
        }
        return $stream;
    }

    private function headInfoLocal(CaseDocument $doc): array
    {
        $disk = Storage::disk($this->localDisk);
        return [
            'size' => $doc->file_path ? (int) $disk->size($doc->file_path) : 0,
            'mime' => $doc->file_path ? $disk->mimeType($doc->file_path) : null,
        ];
    }

    // ----- s3 backend -----

    private function uploadS3(Business $business, int $caseId, UploadedFile $file, string $uuid, string $slug, string $checksum, string $mime): array
    {
        $key = "tenants/{$business->id}/cases/{$caseId}/documents/{$uuid}-{$slug}";
        $kmsKeyId = $this->kmsAliasFor($business);

        $stream = fopen($file->getRealPath(), 'rb');
        try {
            $result = $this->s3Client()->putObject([
                'Bucket'                  => $this->s3Bucket(),
                'Key'                     => $key,
                'Body'                    => $stream,
                'ContentType'             => $mime,
                'ServerSideEncryption'    => 'aws:kms',
                'SSEKMSKeyId'             => $kmsKeyId,
                'SSEKMSEncryptionContext' => base64_encode(json_encode(['business_id' => (string) $business->id])),
                'Metadata'                => [
                    'business-id'     => (string) $business->id,
                    'case-id'         => (string) $caseId,
                    'checksum-sha256' => $checksum,
                ],
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        return [
            'disk'            => 's3',
            'file_path'       => null,
            'storage_key'     => $key,
            'kms_key_id'      => $kmsKeyId,
            'etag'            => trim((string) ($result['ETag'] ?? ''), '"'),
            'checksum_sha256' => $checksum,
            'file_size'       => (int) $file->getSize(),
            'mime_type'       => $mime,
        ];
    }

    private function readStreamS3(CaseDocument $doc)
    {
        if (!$doc->storage_key) {
            throw new RuntimeException("Document {$doc->id} has no storage_key");
        }
        $result = $this->s3Client()->getObject([
            'Bucket' => $this->s3Bucket(),
            'Key'    => $doc->storage_key,
        ]);
        $stream = $result['Body']->detach();
        if (!is_resource($stream)) {
            throw new RuntimeException("Failed to obtain stream for document {$doc->id}");
        }
        return $stream;
    }

    private function headInfoS3(CaseDocument $doc): array
    {
        $head = $this->s3Client()->headObject([
            'Bucket' => $this->s3Bucket(),
            'Key'    => $doc->storage_key,
        ]);
        return [
            'size' => (int) ($head['ContentLength'] ?? 0),
            'mime' => $head['ContentType'] ?? null,
        ];
    }

    private function kmsAliasFor(Business $business): string
    {
        return rtrim((string) $this->kmsAliasPrefix, '/') . '/' . $business->id;
    }

    private function s3Bucket(): string
    {
        $bucket = config("filesystems.disks.{$this->s3Disk}.bucket");
        if (!$bucket) {
            throw new RuntimeException("S3 bucket not configured for disk '{$this->s3Disk}'");
        }
        return $bucket;
    }

    private function s3Client(): S3Client
    {
        return Storage::disk($this->s3Disk)->getClient();
    }

    private function safeFilename(string $name): string
    {
        $name = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($name)) ?? '';
        $name = preg_replace('/\s+/', '-', $name) ?? $name;
        $name = preg_replace('/[^A-Za-z0-9._-]/', '', $name) ?? $name;
        $name = trim($name, '.-_');
        return $name === '' ? 'file' : Str::limit($name, 200, '');
    }
}
