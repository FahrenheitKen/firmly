<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('court_proceedings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('case_id')->constrained('cases')->cascadeOnDelete();
            $table->foreignId('business_id')->constrained('business')->cascadeOnDelete();
            $table->string('before_court_no')->nullable();
            $table->string('magistrate')->nullable();
            $table->text('instruction')->nullable();
            $table->text('directions')->nullable();
            $table->time('time_spent')->nullable();
            $table->foreignId('due_for_event_id')->nullable()->constrained('case_events')->nullOnDelete();
            $table->foreignId('bring_up_event_id')->nullable()->constrained('case_events')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['case_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('court_proceedings');
    }
};
