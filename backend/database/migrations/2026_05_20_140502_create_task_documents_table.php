<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('case_document_id')->constrained('case_documents')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['task_id', 'case_document_id']);
            $table->index('case_document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_documents');
    }
};
