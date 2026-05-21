<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_documents', function (Blueprint $table) {
            // Hot path: listing / merge filters by case_id and excludes soft-deletes.
            $table->index(['case_id', 'deleted_at'], 'case_documents_case_id_deleted_at_index');
        });

        Schema::table('cases', function (Blueprint $table) {
            // Hot path: tenant + branch + status filters on the cases list page.
            $table->index(['business_id', 'location_id', 'status'], 'cases_business_location_status_index');
        });

        Schema::table('task_comments', function (Blueprint $table) {
            // Tenant scoping when comments grow into the thousands per business.
            $table->index('business_id', 'task_comments_business_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('case_documents', function (Blueprint $table) {
            $table->dropIndex('case_documents_case_id_deleted_at_index');
        });

        Schema::table('cases', function (Blueprint $table) {
            $table->dropIndex('cases_business_location_status_index');
        });

        Schema::table('task_comments', function (Blueprint $table) {
            $table->dropIndex('task_comments_business_id_index');
        });
    }
};
