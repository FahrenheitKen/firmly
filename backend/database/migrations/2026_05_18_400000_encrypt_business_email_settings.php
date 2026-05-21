<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('business')
            ->whereNotNull('email_settings')
            ->orderBy('id')
            ->each(function ($row) {
                $value = $row->email_settings;
                if (!is_string($value) || $value === '') {
                    return;
                }

                $decoded = json_decode($value, true);
                if ($decoded === null || json_last_error() !== JSON_ERROR_NONE) {
                    // Already encrypted (or otherwise not plain JSON) — leave as-is.
                    return;
                }

                DB::table('business')->where('id', $row->id)->update([
                    'email_settings' => Crypt::encryptString(json_encode($decoded)),
                ]);
            });
    }

    public function down(): void
    {
        DB::table('business')
            ->whereNotNull('email_settings')
            ->orderBy('id')
            ->each(function ($row) {
                $value = $row->email_settings;
                if (!is_string($value) || $value === '') {
                    return;
                }

                try {
                    $plain = Crypt::decryptString($value);
                } catch (\Throwable $e) {
                    return;
                }

                $decoded = json_decode($plain, true);
                if ($decoded === null || json_last_error() !== JSON_ERROR_NONE) {
                    return;
                }

                DB::table('business')->where('id', $row->id)->update([
                    'email_settings' => json_encode($decoded),
                ]);
            });
    }
};
