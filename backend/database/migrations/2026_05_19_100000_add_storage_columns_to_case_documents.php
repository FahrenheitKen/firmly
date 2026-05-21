<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_documents', function (Blueprint $table) {
            $table->string('file_path')->nullable()->change();
            $table->string('disk', 16)->default('local')->after('file_path');
            $table->string('storage_key', 512)->nullable()->after('disk');
            $table->string('kms_key_id', 256)->nullable()->after('storage_key');
            $table->string('etag', 128)->nullable()->after('kms_key_id');
            $table->string('checksum_sha256', 64)->nullable()->after('etag');
            $table->softDeletes()->after('updated_at');
            $table->index(['disk', 'deleted_at'], 'case_documents_disk_deleted_idx');
        });
    }

    public function down(): void
    {
        Schema::table('case_documents', function (Blueprint $table) {
            $table->dropIndex('case_documents_disk_deleted_idx');
            $table->dropSoftDeletes();
            $table->dropColumn(['disk', 'storage_key', 'kms_key_id', 'etag', 'checksum_sha256']);
            // file_path stays nullable on rollback — restoring NOT NULL would
            // fail if any S3-only rows exist (file_path=NULL by design there).
        });
    }
};
