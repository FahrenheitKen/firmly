<?php

namespace App\Services\Email;

use App\Models\UserEmailAccount;
use Illuminate\Support\Carbon;

interface EmailProviderInterface
{
    /**
     * Override the OAuth credentials for this request (per-business config).
     * Returns the same instance for chaining.
     */
    public function withCredentials(string $clientId, string $clientSecret, string $redirectUri): static;

    /**
     * Return the OAuth authorization URL for this provider.
     */
    public function getAuthUrl(string $state): string;

    /**
     * Exchange an authorization code for tokens.
     *
     * @return array{access_token: string, refresh_token: string, expires_in: int, email: string}
     */
    public function exchangeCode(string $code): array;

    /**
     * Refresh the access token for the given account and persist the changes.
     */
    public function refreshToken(UserEmailAccount $account): void;

    /**
     * Fetch emails from the provider since the given timestamp.
     *
     * Each item in the returned array must contain:
     *   message_id, thread_id, direction, from_address, to_addresses,
     *   cc_addresses, subject, snippet, has_attachments, attachment_names,
     *   sent_at, provider_url
     *
     * @return array<int, array<string, mixed>>
     */
    public function fetchEmails(UserEmailAccount $account, ?Carbon $since = null): array;
}
