<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Run sync directly via Artisan command — no queue worker required.
Schedule::command('emails:sync')->everyTenMinutes()->withoutOverlapping();
