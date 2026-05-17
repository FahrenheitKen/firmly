<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('case_emails', function (Blueprint $table) {
            $table->string('provider_folder_id')->nullable()->after('provider_url');
        });
    }

    public function down(): void
    {
        Schema::table('case_emails', function (Blueprint $table) {
            $table->dropColumn('provider_folder_id');
        });
    }
};
