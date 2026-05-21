<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Run sync directly via Artisan command — no queue worker required.
Schedule::command('emails:sync')->everyTenMinutes()->withoutOverlapping();

// Hard-delete soft-deleted documents past their retention window (default 30 days).
// Runs after midnight to keep daytime traffic clean of S3/KMS calls.
Schedule::command('documents:purge-expired')->dailyAt('03:00')->withoutOverlapping();
