<?php

namespace App\Services\Email;

use App\Models\UserEmailAccount;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

class ZohoService implements EmailProviderInterface
{
    private ?string $clientId;
    private ?string $clientSecret;
    private ?string $redirectUri;

    private const AUTH_URL = 'https://accounts.zoho.com/oauth/v2/auth';
    private const TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
    private const ACCOUNTS_URL = 'https://mail.zoho.com/api/accounts';
    private const SCOPES = 'ZohoMail.messages.READ,ZohoMail.accounts.READ,ZohoMail.folders.READ';

    public function __construct()
    {
        $this->clientId = config('services.zoho.client_id');
        $this->clientSecret = config('services.zoho.client_secret');
        $this->redirectUri = config('services.zoho.redirect_uri');
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
        ]);

        return self::AUTH_URL . '?' . $params;
    }

    public function exchangeCode(string $code): array
    {
        $response = Http::asForm()->post(self::TOKEN_URL, [
            'code'          => $code,
            'client_id'     => $this->clientId,
            'client_secret' => $this->clientSecret,
            'redirect_uri'  => $this->redirectUri,
            'grant_type'    => 'authorization_code',
        ])->throw()->json();

        // Zoho returns HTTP 200 even on errors — check the body explicitly.
        if (!empty($response['error'])) {
            throw new \RuntimeException('Zoho token error: ' . $response['error']);
        }

        if (empty($response['access_token'])) {
            throw new \RuntimeException('Zoho token response missing access_token');
        }

        $accountsResponse = Http::withToken($response['access_token'])
            ->get(self::ACCOUNTS_URL)
            ->throw()
            ->json();

        if (!empty($accountsResponse['errorCode'])) {
            throw new \RuntimeException('Zoho accounts error: ' . $accountsResponse['errorCode']);
        }

        $raw = $accountsResponse['data'][0]['emailAddress']
            ?? $accountsResponse['data'][0]['incomingUserName']
            ?? '';

        // Zoho may return emailAddress as an array of strings or objects — extract a flat string.
        if (is_array($raw)) {
            $first = $raw[0] ?? '';
            $emailAddress = is_array($first)
                ? (string) ($first['value'] ?? $first['address'] ?? $first['mailId'] ?? reset($first) ?? '')
                : (string) $first;
        } else {
            $emailAddress = (string) $raw;
        }

        return [
            'access_token'  => $response['access_token'],
            'refresh_token' => $response['refresh_token'] ?? null,
            'expires_in'    => $response['expires_in'] ?? 3600,
            'email'         => $emailAddress,
        ];
    }

    public function refreshToken(UserEmailAccount $account): void
    {
        $response = Http::asForm()->post(self::TOKEN_URL, [
            'client_id'     => $this->clientId,
            'client_secret' => $this->clientSecret,
            'refresh_token' => $account->refresh_token,
            'grant_type'    => 'refresh_token',
        ])->throw()->json();

        // Zoho returns HTTP 200 even on errors
        if (!empty($response['error'])) {
            throw new \RuntimeException('Zoho token refresh error: ' . $response['error']);
        }

        if (empty($response['access_token'])) {
            throw new \RuntimeException('Zoho token refresh returned no access_token');
        }

        $account->update([
            'access_token'     => $response['access_token'],
            'token_expires_at' => Carbon::now()->addSeconds($response['expires_in'] ?? 3600),
        ]);
    }

    public function fetchEmails(UserEmailAccount $account, ?Carbon $since = null): array
    {
        if ($account->token_expires_at && $account->token_expires_at->isPast()) {
            $this->refreshToken($account);
            $account->refresh();
        }

        $accountId = $this->resolveAccountId($account);
        if (!$accountId) {
            return [];
        }

        $sinceMs = $since ? ($since->timestamp * 1000) : null;

        // Build a set of allowed folder IDs (inbox + sent) for filtering.
        // The folder-specific messages/view URL is restricted on some Zoho plans,
        // so we always use the general endpoint and filter by folderId locally.
        $folders = $this->listFolders($account, $accountId);
        $allowedFolderIds = [];
        $folderNameById   = [];
        foreach ($folders as $f) {
            $name = strtolower($f['folderName'] ?? '');
            if (in_array($name, ['inbox', 'sent'], true)) {
                $allowedFolderIds[] = (string) $f['folderId'];
                $folderNameById[(string) $f['folderId']] = $f['folderName'];
            }
        }

        $baseUrl  = self::ACCOUNTS_URL . '/' . $accountId . '/messages/view';
        $start    = 0;
        $pageSize = 100;
        $emails   = [];

        do {
            $response = Http::withToken($account->access_token)
                ->get($baseUrl, ['limit' => $pageSize, 'start' => $start, 'sortorder' => 'false'])
                ->throw()
                ->json();

            $messages = $response['data'] ?? [];
            if (empty($messages)) {
                break;
            }

            foreach ($messages as $message) {
                if ($sinceMs !== null) {
                    $msgTime = (int) ($message['sentDateInGMT'] ?? $message['receivedTime'] ?? 0);
                    if ($msgTime > 0 && $msgTime < $sinceMs) {
                        break 2; // messages are newest-first; stop when we pass the since boundary
                    }
                }

                // Skip messages not in inbox or sent (spam, trash, etc.)
                // If folder listing was unavailable, allow everything.
                $msgFolderId = (string) ($message['folderId'] ?? '');
                if (!empty($allowedFolderIds) && !in_array($msgFolderId, $allowedFolderIds, true)) {
                    continue;
                }

                // Inject the resolved folder name so normalizeMessage can derive direction.
                if (empty($message['folderName']) && isset($folderNameById[$msgFolderId])) {
                    $message['folderName'] = $folderNameById[$msgFolderId];
                }

                $emails[] = $this->normalizeMessage($message, $accountId);
            }

            $start += $pageSize;
        } while (count($messages) === $pageSize && $start < 1000);

        return $emails;
    }

    /**
     * List all folders for the account. Returns [] if scope not granted.
     */
    private function listFolders(UserEmailAccount $account, string $accountId): array
    {
        $response = Http::withToken($account->access_token)
            ->get(self::ACCOUNTS_URL . '/' . $accountId . '/folders')
            ->json();

        if (!empty($response['errorCode']) || !empty($response[1]['errorCode'])) {
            return [];
        }

        return $response['data'] ?? [];
    }

    /**
     * Fetch the full body of a single email message.
     * Zoho requires a folder-scoped URL: /accounts/{id}/folders/{folderId}/messages/{msgId}/content
     *
     * @return array{html: string|null, text: string|null}
     */
    public function fetchEmailBody(UserEmailAccount $account, string $messageId, ?string $folderId = null): array
    {
        if ($account->token_expires_at && $account->token_expires_at->isPast()) {
            $this->refreshToken($account);
            $account->refresh();
        }

        $accountId = $this->resolveAccountId($account);
        if (!$accountId) {
            return ['html' => null, 'text' => null];
        }

        // If we don't have the folderId, search the message listing to find it
        if (!$folderId) {
            $listResp = Http::withToken($account->access_token)
                ->get(self::ACCOUNTS_URL . '/' . $accountId . '/messages/view', [
                    'searchKey'    => $messageId,
                    'searchColumn' => 'messageId',
                    'limit'        => 10,
                ])
                ->json();

            foreach ($listResp['data'] ?? [] as $msg) {
                if ((string) ($msg['messageId'] ?? '') === $messageId) {
                    $folderId = (string) ($msg['folderId'] ?? '');
                    break;
                }
            }
        }

        if (!$folderId) {
            return ['html' => null, 'text' => null];
        }

        $response = Http::withToken($account->access_token)
            ->get(self::ACCOUNTS_URL . '/' . $accountId . '/folders/' . $folderId . '/messages/' . $messageId . '/content')
            ->json();

        $html = $response['data']['content'] ?? null;
        $text = $html ? strip_tags($html) : null;

        return ['html' => $html, 'text' => $text];
    }

    private function parseAddressList(string $raw): array
    {
        if (empty($raw) || strtolower(trim($raw)) === 'not provided') {
            return [];
        }
        $result = [];
        foreach (explode(',', $raw) as $addr) {
            $email = $this->extractEmail($addr);
            if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $result[] = $email;
            }
        }
        return $result;
    }

    private function resolveAccountId(UserEmailAccount $account): ?string
    {
        $response = Http::withToken($account->access_token)
            ->get(self::ACCOUNTS_URL)
            ->json();

        return $response['data'][0]['accountId'] ?? null;
    }

    private function extractEmail(string $address): string
    {
        // Zoho API HTML-encodes angle brackets and quotes in address strings
        $address = html_entity_decode($address, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        // Handle "Display Name <email@domain.com>" format
        if (preg_match('/<([^>]+)>/', $address, $matches)) {
            return strtolower(trim($matches[1]));
        }
        return strtolower(trim($address));
    }

    private function normalizeMessage(array $message, string $accountId): array
    {
        $toAddresses = [];
        $rawTo = $message['toAddress'] ?? '';
        if (!empty($rawTo) && strtolower(trim($rawTo)) !== 'not provided') {
            foreach (explode(',', $rawTo) as $addr) {
                $email = $this->extractEmail($addr);
                if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $toAddresses[] = $email;
                }
            }
        }

        $ccAddresses = [];
        $rawCc = $message['ccAddress'] ?? '';
        if (!empty($rawCc) && strtolower(trim($rawCc)) !== 'not provided') {
            foreach (explode(',', $rawCc) as $addr) {
                $email = $this->extractEmail($addr);
                if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $ccAddresses[] = $email;
                }
            }
        }

        // Zoho folderId is a numeric ID, not a string — use folderName when available
        $folderName = strtolower($message['folderName'] ?? $message['foldername'] ?? '');
        $direction = $folderName === 'sent' ? 'outbound' : 'inbound';

        $sentAt = null;
        if (!empty($message['sentDateInGMT'])) {
            try {
                $sentAt = Carbon::createFromTimestampMs((int) $message['sentDateInGMT']);
            } catch (\Exception $e) {
                $sentAt = null;
            }
        }

        $messageId = $message['messageId'] ?? $message['msgId'] ?? '';

        $folderId = (string) ($message['folderId'] ?? '');

        return [
            'message_id'        => (string) $messageId,
            'thread_id'         => $message['threadId'] ?? null,
            'direction'         => $direction,
            'from_address'      => $this->extractEmail($message['fromAddress'] ?? ''),
            'to_addresses'      => $toAddresses,
            'cc_addresses'      => $ccAddresses,
            'subject'           => $message['subject'] ?? null,
            'snippet'           => isset($message['summary'])
                ? substr($message['summary'], 0, 300)
                : null,
            'has_attachments'   => !empty($message['hasAttachment']) && $message['hasAttachment'] === '1',
            'attachment_names'  => [],
            'sent_at'           => $sentAt,
            'provider_url'      => 'https://mail.zoho.com/zm/#mail/folder/inbox/p/0/d/' . $messageId,
            'provider_folder_id' => $folderId ?: null,
        ];
    }
}
