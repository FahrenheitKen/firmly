<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('client_prefix', 20)->nullable()->after('client_id');
        });

        Schema::table('business', function (Blueprint $table) {
            $table->unsignedBigInteger('case_counter')->default(0)->after('custom_labels');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('client_prefix');
        });
        Schema::table('business', function (Blueprint $table) {
            $table->dropColumn('case_counter');
        });
    }
};
