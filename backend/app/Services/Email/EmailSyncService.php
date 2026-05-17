<?php

namespace App\Services\Email;

use App\Models\Business;
use App\Models\CaseEmail;
use App\Models\Cases;
use App\Models\Client;
use App\Models\UserEmailAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class EmailSyncService
{
    private array $providers;

    public function __construct(GmailService $gmail, OutlookService $outlook, ZohoService $zoho)
    {
        $this->providers = [
            'gmail' => $gmail,
            'outlook' => $outlook,
            'zoho' => $zoho,
        ];
    }

    /**
     * Sync emails for the given account.
     *
     * @return int Number of new emails persisted
     */
    public function syncAccount(UserEmailAccount $account): int
    {
        try {
            $provider = $this->providers[$account->provider] ?? null;
            if (!$provider) {
                return 0;
            }

            // Apply per-business OAuth credentials so token refresh uses the correct client
            $businessId = $account->user->business_id;
            if ($businessId) {
                $business = Business::find($businessId);
                $settings = $business?->email_settings ?? [];
                $providerKey = $account->provider;
                $clientId    = $settings["{$providerKey}_client_id"]     ?? null;
                $clientSecret= $settings["{$providerKey}_client_secret"] ?? null;
                $redirectUri = $settings["{$providerKey}_redirect_uri"]  ?? null;
                if ($clientId && $clientSecret && $redirectUri) {
                    $provider->withCredentials($clientId, $clientSecret, $redirectUri);
                }
            }

            // On first sync (no last_synced_at), look back 30 days to catch recent emails
            $since = $account->last_synced_at ?? Carbon::now()->subDays(30);
            $emails = $provider->fetchEmails($account, $since);

            $newCount = 0;
            foreach ($emails as $emailData) {
                $existing = CaseEmail::where('email_account_id', $account->id)
                    ->where('message_id', $emailData['message_id'])
                    ->exists();

                if ($existing) {
                    continue;
                }

                $caseId = $this->matchEmailToCase($emailData, $account->user->business_id);

                CaseEmail::create([
                    'case_id' => $caseId,
                    'business_id' => $account->user->business_id,
                    'email_account_id' => $account->id,
                    ...$emailData,
                ]);

                $newCount++;
            }

            $account->update(['last_synced_at' => now()]);

            return $newCount;
        } catch (\Exception $e) {
            Log::error("Email sync failed for account {$account->id}: " . $e->getMessage());
            return 0;
        }
    }

    private function matchEmailToCase(array $emailData, int $businessId): ?int
    {
        // 1. Check subject for case reference pattern like [REF-001] or our_reference value
        $subject = $emailData['subject'] ?? '';
        if (preg_match('/\[([A-Z0-9\/\-]+)\]/', $subject, $matches)) {
            $ref = $matches[1];
            $case = Cases::where('business_id', $businessId)
                ->where(function ($q) use ($ref) {
                    $q->where('our_reference', $ref)->orWhere('case_number', $ref);
                })
                ->first();

            if ($case) {
                return $case->id;
            }
        }

        // 2. Match by client email — check from_address and to_addresses
        $toAddresses = $emailData['to_addresses'] ?? [];
        if (!is_array($toAddresses)) {
            $toAddresses = [];
        }

        $addresses = array_merge([$emailData['from_address']], $toAddresses);

        foreach ($addresses as $addr) {
            $addr = strtolower(trim($addr));
            if (empty($addr)) {
                continue;
            }

            $client = Client::where('business_id', $businessId)
                ->where('email', $addr)
                ->first();

            if ($client) {
                $case = Cases::where('business_id', $businessId)
                    ->where('client_id', $client->id)
                    ->whereIn('status', ['Open', 'In Progress'])
                    ->orderByDesc('created_at')
                    ->first();

                if ($case) {
                    return $case->id;
                }
            }
        }

        return null;
    }
}
