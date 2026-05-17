<?php

namespace App\Console\Commands;

use App\Models\UserEmailAccount;
use App\Services\Email\EmailSyncService;
use Illuminate\Console\Command;

class SyncEmailsCommand extends Command
{
    protected $signature = 'emails:sync {--user= : Sync only this user ID}';

    protected $description = 'Sync emails for all connected email accounts';

    public function handle(EmailSyncService $syncService): int
    {
        $query = UserEmailAccount::with('user')->where('sync_enabled', true);

        if ($userId = $this->option('user')) {
            $query->where('user_id', (int) $userId);
        }

        $accounts = $query->get();

        if ($accounts->isEmpty()) {
            $this->info('No enabled email accounts to sync.');
            return self::SUCCESS;
        }

        $total = 0;
        foreach ($accounts as $account) {
            $this->line("Syncing {$account->email_address} ({$account->provider})...");
            $count = $syncService->syncAccount($account);
            $this->info("  → {$count} new email(s)");
            $total += $count;
        }

        $this->info("Done. {$total} total new email(s) synced.");

        return self::SUCCESS;
    }
}
