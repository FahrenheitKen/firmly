<?php

namespace App\Services\Email;

use App\Models\UserEmailAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class OutlookService implements EmailProviderInterface
{
    private ?string $clientId;
    private ?string $clientSecret;
    private ?string $redirectUri;

    private const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    private const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    private const INBOX_URL = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages';
    private const SENT_URL = 'https://graph.microsoft.com/v1.0/me/mailFolders/sentItems/messages';
    private const SCOPES = 'https://graph.microsoft.com/Mail.Read offline_access email openid';
    private const SELECT_FIELDS = 'id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,hasAttachments,sentDateTime,webLink';

    public function __construct()
    {
        $this->clientId = config('services.outlook.client_id');
        $this->clientSecret = config('services.outlook.client_secret');
        $this->redirectUri = config('services.outlook.redirect_uri');
    }

    public function withCredentials(string $clientId, string $clientSecret, string $redirectUri): static
    {
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->redirectUri = $redirectUri;
        return $this;
    }

    public function getAuthUrl(string $state): string
    {
        $params = http_build_query([
            'response_type' => 'code',
            'client_id' => $this->clientId,
            'redirect_uri' => $this->redirectUri,
            'scope' => self::SCOPES,
            'state' => $state,
            'response_mode' => 'query',
        ]);

        return self::AUTH_URL . '?' . $params;
    }

    public function exchangeCode(string $code): array
    {
        $response = Http::asForm()->post(self::TOKEN_URL, [
            'code' => $code,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'redirect_uri' => $this->redirectUri,
            'grant_type' => 'authorization_code',
        ])->throw()->json();

        $userInfo = Http::withToken($response['access_token'])
            ->get('https://graph.microsoft.com/v1.0/me')
            ->throw()
            ->json();

        return [
            'access_token' => $response['access_token'],
            'refresh_token' => $response['refresh_token'] ?? null,
            'expires_in' => $response['expires_in'] ?? 3600,
            'email' => $userInfo['mail'] ?? $userInfo['userPrincipalName'],
        ];
    }

    public function refreshToken(UserEmailAccount $account): void
    {
        $response = Http::asForm()->post(self::TOKEN_URL, [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'refresh_token' => $account->refresh_token,
            'grant_type' => 'refresh_token',
        ])->throw()->json();

        $account->update([
            'access_token' => $response['access_token'],
            'token_expires_at' => Carbon::now()->addSeconds($response['expires_in'] ?? 3600),
        ]);
    }

    public function fetchEmails(UserEmailAccount $account, ?Carbon $since = null): array
    {
        if ($account->token_expires_at && $account->token_expires_at->isPast()) {
            $this->refreshToken($account);
            $account->refresh();
        }

        $params = ['$select' => self::SELECT_FIELDS, '$top' => 50];

        if ($since) {
            $params['$filter'] = 'sentDateTime ge ' . $since->toIso8601String();
        }

        $inboxMessages = Http::withToken($account->access_token)
            ->get(self::INBOX_URL, $params)
            ->throw()
            ->json()['value'] ?? [];

        $sentMessages = Http::withToken($account->access_token)
            ->get(self::SENT_URL, $params)
            ->throw()
            ->json()['value'] ?? [];

        $emails = [];

        foreach ($inboxMessages as $message) {
            $emails[] = $this->normalizeMessage($message, 'inbound');
        }

        foreach ($sentMessages as $message) {
            $emails[] = $this->normalizeMessage($message, 'outbound');
        }

        return $emails;
    }

    private function normalizeMessage(array $message, string $direction): array
    {
        $toAddresses = array_map(
            fn($r) => strtolower($r['emailAddress']['address'] ?? ''),
            $message['toRecipients'] ?? []
        );

        $ccAddresses = array_map(
            fn($r) => strtolower($r['emailAddress']['address'] ?? ''),
            $message['ccRecipients'] ?? []
        );

        $fromAddress = strtolower(
            $message['from']['emailAddress']['address'] ?? ''
        );

        $sentAt = null;
        if (!empty($message['sentDateTime'])) {
            try {
                $sentAt = Carbon::parse($message['sentDateTime']);
            } catch (\Exception $e) {
                $sentAt = null;
            }
        }

        return [
            'message_id' => $message['id'],
            'thread_id' => $message['conversationId'] ?? null,
            'direction' => $direction,
            'from_address' => $fromAddress,
            'to_addresses' => array_values(array_filter($toAddresses)),
            'cc_addresses' => array_values(array_filter($ccAddresses)),
            'subject' => $message['subject'] ?? null,
            'snippet' => $message['bodyPreview'] ?? null,
            'has_attachments' => (bool) ($message['hasAttachments'] ?? false),
            'attachment_names' => [],
            'sent_at' => $sentAt,
            'provider_url' => $message['webLink'] ?? null,
        ];
    }
}
