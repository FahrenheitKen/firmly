<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes covering the actual hot paths observed in CaseEventController,
 * CaseController, and CaseDocumentController. Filed separately from the
 * earlier add_performance_indexes migration so we can audit and roll back
 * these specific additions if MySQL picks a bad plan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_events', function (Blueprint $table) {
            // Per-case events listing on the case detail page.
            $table->index(['case_id', 'event_date'], 'case_events_case_id_event_date_index');
            // Global calendar /events?from=&to= range scan on the dashboard.
            $table->index('event_date', 'case_events_event_date_index');
        });

        Schema::table('cases', function (Blueprint $table) {
            // Staff users with case.view_own filter by assigned_to within their
            // location. The existing (business_id, location_id, status) index
            // doesn't help that predicate.
            $table->index(
                ['business_id', 'location_id', 'assigned_to'],
                'cases_business_location_assigned_index'
            );
            // /cases?client_id=... filter on the cases list.
            $table->index(['business_id', 'client_id'], 'cases_business_client_index');
        });

        Schema::table('case_documents', function (Blueprint $table) {
            // Files tab sorts by document_date desc per case.
            $table->index(['case_id', 'document_date'], 'case_documents_case_id_document_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('case_events', function (Blueprint $table) {
            $table->dropIndex('case_events_case_id_event_date_index');
            $table->dropIndex('case_events_event_date_index');
        });

        Schema::table('cases', function (Blueprint $table) {
            $table->dropIndex('cases_business_location_assigned_index');
            $table->dropIndex('cases_business_client_index');
        });

        Schema::table('case_documents', function (Blueprint $table) {
            $table->dropIndex('case_documents_case_id_document_date_index');
        });
    }
};
