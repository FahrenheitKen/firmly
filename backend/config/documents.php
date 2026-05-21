<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Document Storage Driver
    |--------------------------------------------------------------------------
    |
    | Where case documents are persisted. Switching this controls *new*
    | uploads only — existing rows are read from whichever disk is recorded
    | on each row (case_documents.disk), so flipping the flag is safe and
    | reversible without a backfill.
    |
    | Supported: "local", "s3"
    */

    'driver' => env('FIRMLY_DOCUMENT_DRIVER', 'local'),

    's3' => [
        'disk' => env('FIRMLY_DOCUMENT_S3_DISK', 's3'),

        // Per-tenant CMK alias prefix. Each tenant's key alias is built as
        // "{prefix}/{business_id}", e.g. "alias/firmly/prod/tenant/7".
        'kms_alias_prefix' => env('FIRMLY_DOCUMENT_KMS_ALIAS_PREFIX'),

        // S3 object tag applied on soft-delete. A bucket lifecycle rule
        // expires tagged objects after the retention window.
        'pending_delete_tag_key' => env('FIRMLY_DOCUMENT_PENDING_DELETE_TAG_KEY', 'firmly-pending-delete'),
        'pending_delete_tag_value' => env('FIRMLY_DOCUMENT_PENDING_DELETE_TAG_VALUE', 'true'),
    ],

    // Days to retain a soft-deleted document before the GC cron force-deletes
    // it from storage and the DB.
    'soft_delete_retention_days' => (int) env('FIRMLY_DOCUMENT_RETENTION_DAYS', 30),

    'kms' => [
        // AWS account ID — used to build IAM ARNs in the per-tenant key policy.
        'account_id' => env('AWS_ACCOUNT_ID'),

        // KMS region. Falls back to AWS_DEFAULT_REGION.
        'region' => env('FIRMLY_DOCUMENT_KMS_REGION', env('AWS_DEFAULT_REGION', 'ap-south-1')),

        // The IAM user the Laravel app authenticates as. Becomes the
        // restricted principal in every tenant key's policy.
        'app_iam_user' => env('FIRMLY_DOCUMENT_KMS_APP_USER', 'firmly-app-prod'),
    ],
];
