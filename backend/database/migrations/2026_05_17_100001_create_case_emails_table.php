<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('case_emails', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('case_id')->nullable()->index();
            $table->unsignedBigInteger('business_id')->index();
            $table->unsignedBigInteger('email_account_id')->index();
            $table->string('message_id'); // provider's unique message ID
            $table->string('thread_id')->nullable();
            $table->enum('direction', ['inbound', 'outbound'])->default('inbound');
            $table->string('from_address');
            $table->json('to_addresses');
            $table->json('cc_addresses')->nullable();
            $table->string('subject')->nullable();
            $table->text('snippet')->nullable(); // first ~300 chars of body, plain text
            $table->boolean('has_attachments')->default(false);
            $table->json('attachment_names')->nullable(); // just filenames, no files stored
            $table->timestamp('sent_at')->nullable();
            $table->string('provider_url')->nullable(); // link to view email in provider
            $table->timestamps();

            $table->foreign('case_id')->references('id')->on('cases')->onDelete('set null');
            $table->foreign('business_id')->references('id')->on('business')->onDelete('cascade');
            $table->foreign('email_account_id')->references('id')->on('user_email_accounts')->onDelete('cascade');
            $table->unique(['email_account_id', 'message_id']); // prevent duplicates
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('case_emails');
    }
};
