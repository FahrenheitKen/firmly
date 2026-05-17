<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('business_id');
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('case_number')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('case_type', ['Civil', 'Criminal', 'Corporate', 'Family', 'Other'])->default('Other');
            $table->enum('status', ['Open', 'In Progress', 'Closed', 'On Hold'])->default('Open');
            $table->enum('priority', ['Low', 'Medium', 'High', 'Urgent'])->default('Medium');
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->string('court')->nullable();
            $table->string('judge')->nullable();
            $table->date('filed_date')->nullable();
            $table->date('closed_date')->nullable();
            $table->text('outcome')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->softDeletes();
            $table->timestamps();

            $table->foreign('business_id')->references('id')->on('business')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('clients')->onDelete('set null');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cases');
    }
};
