<?php

namespace App\Jobs;

use App\Models\UserEmailAccount;
use App\Services\Email\EmailSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncUserEmailsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $userId = null) {}

    public function handle(EmailSyncService $syncService): void
    {
        $query = UserEmailAccount::with('user')->where('sync_enabled', true);

        if ($this->userId) {
            $query->where('user_id', $this->userId);
        }

        $query->each(fn($account) => $syncService->syncAccount($account));
    }
}
