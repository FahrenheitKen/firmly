<?php

namespace App\Services\Email;

use App\Models\UserEmailAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class GmailService implements EmailProviderInterface
{
    private ?string $clientId;
    private ?string $clientSecret;
    private ?string $redirectUri;

    private const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';
    private const MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    private const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email';

    public function __construct()
    {
        $this->clientId = config('services.gmail.client_id');
        $this->clientSecret = config('services.gmail.client_secret');
        $this->redirectUri = config('services.gmail.redirect_uri');
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
            'access_type' => 'offline',
            'prompt' => 'consent',
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
            ->get(self::USERINFO_URL)
            ->throw()
            ->json();

        return [
            'access_token' => $response['access_token'],
            'refresh_token' => $response['refresh_token'] ?? null,
            'expires_in' => $response['expires_in'] ?? 3600,
            'email' => $userInfo['email'],
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

        $query = $since
            ? 'after:' . $since->timestamp
            : 'newer_than:1d';

        $listResponse = Http::withToken($account->access_token)
            ->get(self::MESSAGES_URL, ['maxResults' => 100, 'q' => $query])
            ->throw()
            ->json();

        $messages = $listResponse['messages'] ?? [];
        $emails = [];

        foreach ($messages as $message) {
            $detail = Http::withToken($account->access_token)
                ->get(self::MESSAGES_URL . '/' . $message['id'], [
                    'format' => 'metadata',
                    'metadataHeaders' => 'From,To,Cc,Subject,Date',
                ])
                ->throw()
                ->json();

            $emails[] = $this->normalizeMessage($detail);
        }

        return $emails;
    }

    private function normalizeMessage(array $message): array
    {
        $headers = $this->parseHeaders($message['payload']['headers'] ?? []);
        $labelIds = $message['labelIds'] ?? [];
        $direction = in_array('SENT', $labelIds) ? 'outbound' : 'inbound';

        $toAddresses = $this->parseAddressList($headers['To'] ?? '');
        $ccAddresses = $this->parseAddressList($headers['Cc'] ?? '');

        $hasAttachments = false;
        $attachmentNames = [];

        $parts = $message['payload']['parts'] ?? [];
        foreach ($parts as $part) {
            if (!empty($part['filename']) && !in_array($part['mimeType'], ['text/plain', 'text/html'])) {
                $hasAttachments = true;
                $attachmentNames[] = $part['filename'];
            }
        }

        $sentAt = null;
        if (!empty($headers['Date'])) {
            try {
                $sentAt = Carbon::parse($headers['Date']);
            } catch (\Exception $e) {
                $sentAt = null;
            }
        }

        return [
            'message_id' => $message['id'],
            'thread_id' => $message['threadId'] ?? null,
            'direction' => $direction,
            'from_address' => $this->extractEmail($headers['From'] ?? ''),
            'to_addresses' => $toAddresses,
            'cc_addresses' => $ccAddresses,
            'subject' => $headers['Subject'] ?? null,
            'snippet' => $message['snippet'] ?? null,
            'has_attachments' => $hasAttachments,
            'attachment_names' => $attachmentNames,
            'sent_at' => $sentAt,
            'provider_url' => 'https://mail.google.com/mail/u/0/#inbox/' . $message['id'],
        ];
    }

    private function parseHeaders(array $headers): array
    {
        $result = [];
        foreach ($headers as $header) {
            $result[$header['name']] = $header['value'];
        }
        return $result;
    }

    private function parseAddressList(string $addressString): array
    {
        if (empty($addressString)) {
            return [];
        }

        return array_map(
            fn($addr) => $this->extractEmail(trim($addr)),
            array_filter(explode(',', $addressString))
        );
    }

    private function extractEmail(string $address): string
    {
        if (preg_match('/<(.+?)>/', $address, $matches)) {
            return strtolower(trim($matches[1]));
        }
        return strtolower(trim($address));
    }
}
