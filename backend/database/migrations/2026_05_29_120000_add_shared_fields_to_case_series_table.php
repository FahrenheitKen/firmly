<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('case_series', function (Blueprint $table) {
            $table->unsignedBigInteger('client_id')->nullable()->after('name');
            $table->unsignedBigInteger('assigned_to')->nullable()->after('client_id');
            $table->string('client_reference', 255)->nullable()->after('assigned_to');
            $table->string('station', 255)->nullable()->after('common_parties');
            $table->string('court_number_filed', 255)->nullable()->after('station');
            $table->string('judge', 255)->nullable()->after('court_number_filed');

            $table->foreign('client_id')->references('id')->on('clients')->onDelete('set null');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('case_series', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
            $table->dropForeign(['assigned_to']);
            $table->dropColumn(['client_id', 'assigned_to', 'client_reference', 'station', 'court_number_filed', 'judge']);
        });
    }
};
