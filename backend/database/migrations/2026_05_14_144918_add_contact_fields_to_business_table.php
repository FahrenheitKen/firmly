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
        Schema::table('business', function (Blueprint $table) {
            $table->string('website')->nullable()->after('logo');
            $table->string('mobile')->nullable()->after('website');
            $table->string('alternate_number')->nullable()->after('mobile');
        });
    }

    public function down(): void
    {
        Schema::table('business', function (Blueprint $table) {
            $table->dropColumn(['website', 'mobile', 'alternate_number']);
        });
    }
};
