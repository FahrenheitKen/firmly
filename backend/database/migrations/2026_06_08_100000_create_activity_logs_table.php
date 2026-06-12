<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('business_id')->index();
            $table->unsignedBigInteger('location_id')->nullable()->index();
            $table->unsignedBigInteger('causer_id')->nullable()->index();
            $table->string('action', 50);           // created, updated, deleted, duplicated, login, etc.
            $table->string('subject_type', 100);     // case, task, client, expense, user, series, etc.
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable(); // Human-readable: case number, client name, etc.
            $table->json('properties')->nullable();  // { old: {...}, new: {...} }
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['subject_type', 'subject_id']);
            $table->index('created_at');

            $table->foreign('business_id')->references('id')->on('business')->cascadeOnDelete();
            $table->foreign('causer_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
