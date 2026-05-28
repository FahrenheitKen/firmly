<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_series', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained('business')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('business_locations')->cascadeOnDelete();
            $table->foreignId('parent_series_id')->nullable()->constrained('case_series')->nullOnDelete();
            $table->string('reference');
            $table->string('name');
            $table->json('common_parties')->nullable();
            $table->text('notes')->nullable();
            $table->string('last_suffix')->default('');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['business_id', 'location_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_series');
    }
};
