<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('case_id');
            $table->enum('event_type', ['Bring Up', 'Mention', 'Hearing', 'Ruling', 'Judgement']);
            $table->date('event_date');
            $table->unsignedBigInteger('created_by');
            $table->timestamps();

            $table->foreign('case_id')->references('id')->on('cases')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_events');
    }
};
