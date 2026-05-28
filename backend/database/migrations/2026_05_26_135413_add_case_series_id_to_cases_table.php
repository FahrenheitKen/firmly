<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->foreignId('case_series_id')->nullable()->after('location_id')->constrained('case_series')->nullOnDelete();
            $table->string('series_suffix', 10)->nullable()->after('case_series_id');
        });
    }

    public function down(): void
    {
        Schema::table('cases', function (Blueprint $table) {
            $table->dropForeign(['case_series_id']);
            $table->dropColumn(['case_series_id', 'series_suffix']);
        });
    }
};
