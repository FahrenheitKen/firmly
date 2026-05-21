<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\User;
use App\Models\UserEmailAccount;
use App\Services\Email\EmailProviderInterface;
use App\Services\Email\EmailSyncService;
use App\Services\Email\GmailService;
use App\Services\Email\OutlookService;
use App\Services\Email\ZohoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class EmailAccountController extends Controller
{
    private array $providers;

    public function __construct(GmailService $gmail, OutlookService $outlook, ZohoService $zoho)
    {
        $this->providers = [
            'gmail'   => $gmail,
            'outlook' => $outlook,
            'zoho'    => $zoho,
        ];
    }

    /**
     * Resolve per-business OAuth credentials for a provider.
     * Applies them to the service instance if configured, otherwise the service
     * uses its global .env credentials unchanged.
     */
    private function applyBusinessCredentials(EmailProviderInterface $service, string $provider, int $businessId): void
    {
        $business = Business::find($businessId);
        $settings = $business?->email_settings ?? [];

        $clientId     = $settings["{$provider}_client_id"]     ?? null;
        $clientSecret = $settings["{$provider}_client_secret"] ?? null;
        $redirectUri  = $settings["{$provider}_redirect_uri"]  ?? null;

        if ($clientId && $clientSecret && $redirectUri) {
            $service->withCredentials($clientId, $clientSecret, $redirectUri);
        }
    }

    /**
     * GET /email-account
     */
    public function show(Request $request): JsonResponse
    {
        $account = UserEmailAccount::where('user_id', $request->user()->id)
            ->where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->first();

        if (!$account) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'id'            => $account->id,
                'provider'      => $account->provider,
                'email_address' => $account->email_address,
                'sync_enabled'  => $account->sync_enabled,
                'last_synced_at'=> $account->last_synced_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * DELETE /email-account
     */
    public function disconnect(Request $request): JsonResponse
    {
        $deleted = UserEmailAccount::where('user_id', $request->user()->id)
            ->where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->delete();

        return response()->json([
            'message' => $deleted ? 'Email account disconnected.' : 'No account found.',
        ]);
    }

    /**
     * GET /email-accounts/oauth/{provider}
     */
    public function oauthRedirect(Request $request, string $provider): JsonResponse
    {
        $service = $this->providers[$provider] ?? null;

        if (!$service) {
            return response()->json(['error' => 'Invalid provider'], 422);
        }

        $user = $request->user();

        if ($user->business_id) {
            $this->applyBusinessCredentials($service, $provider, $user->business_id);
        }

        $statePayload = json_encode([
            'user_id'     => $user->id,
            'business_id' => $user->business_id,
            'location_id' => $user->active_location_id,
            'ts'          => now()->timestamp,
        ]);
        $state = base64_encode(Crypt::encryptString($statePayload));

        return response()->json(['url' => $service->getAuthUrl($state)]);
    }

    /**
     * GET /email-accounts/oauth/{provider}/callback
     * No Sanctum auth — user_id and business_id are embedded in the state.
     */
    public function oauthCallback(Request $request, string $provider): RedirectResponse
    {
        $frontendBase = config('app.frontend_url', 'http://localhost:3000') . '/dashboard/settings/email';

        $service = $this->providers[$provider] ?? null;

        if (!$service) {
            return redirect($frontendBase . '?error=invalid_provider');
        }

        $code     = $request->query('code');
        $stateRaw = $request->query('state');

        if (!$code || !$stateRaw) {
            return redirect($frontendBase . '?error=auth_failed');
        }

        try {
            try {
                $decrypted = Crypt::decryptString(base64_decode($stateRaw));
                $state     = json_decode($decrypted, true);
            } catch (\Exception $e) {
                return redirect($frontendBase . '?error=auth_failed');
            }

            $userId     = $state['user_id']     ?? null;
            $businessId = $state['business_id'] ?? null;
            $locationId = $state['location_id'] ?? null;
            $ts         = $state['ts']           ?? 0;

            if (!$userId || now()->timestamp - $ts > 600) {
                return redirect($frontendBase . '?error=auth_failed');
            }

            if ($businessId) {
                $this->applyBusinessCredentials($service, $provider, $businessId);
            }

            $tokens = $service->exchangeCode($code);

            UserEmailAccount::updateOrCreate(
                ['user_id' => $userId, 'business_id' => $businessId, 'location_id' => $locationId],
                [
                    'provider'         => $provider,
                    'email_address'    => $tokens['email'],
                    'access_token'     => $tokens['access_token'],
                    'refresh_token'    => $tokens['refresh_token'] ?? null,
                    'token_expires_at' => Carbon::now()->addSeconds($tokens['expires_in'] ?? 3600),
                    'sync_enabled'     => true,
                ]
            );

            return redirect($frontendBase . '?connected=1');
        } catch (\Exception $e) {
            $message = $e->getMessage();
            Log::error("OAuth callback failed for provider {$provider}: {$message}");

            $detail = app()->environment('production') ? '' : '&detail=' . urlencode($message);
            return redirect($frontendBase . '?error=auth_failed' . $detail);
        }
    }

    /**
     * POST /email-account/sync
     */
    public function syncNow(Request $request, EmailSyncService $syncService): JsonResponse
    {
        $account = UserEmailAccount::with('user')
            ->where('user_id', $request->user()->id)
            ->where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->where('sync_enabled', true)
            ->first();

        if (!$account) {
            return response()->json(['message' => 'No connected email account found.'], 404);
        }

        $newCount = $syncService->syncAccount($account);

        return response()->json([
            'message'     => 'Email sync completed.',
            'new_emails'  => $newCount,
        ]);
    }

    /**
     * GET /email-accounts/oauth-settings
     * Return the current business's per-provider OAuth credentials (client_id only, never secret).
     */
    public function getOAuthSettings(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $business = Business::find($request->user()->business_id);
        $settings = $business?->email_settings ?? [];

        $result = [];
        foreach (['gmail', 'outlook', 'zoho'] as $provider) {
            $result[$provider] = [
                'client_id'    => $settings["{$provider}_client_id"]    ?? null,
                'redirect_uri' => $settings["{$provider}_redirect_uri"] ?? null,
                'configured'   => !empty($settings["{$provider}_client_id"]),
            ];
        }

        return response()->json(['data' => $result]);
    }

    /**
     * PUT /email-accounts/oauth-settings/{provider}
     * Save per-business OAuth credentials for a provider.
     */
    public function saveOAuthSettings(Request $request, string $provider): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!isset($this->providers[$provider])) {
            return response()->json(['error' => 'Invalid provider'], 422);
        }

        $validated = $request->validate([
            'client_id'     => 'required|string',
            'client_secret' => 'nullable|string',
            'redirect_uri'  => 'required|url',
        ]);

        $business = Business::find($request->user()->business_id);

        if (!$business) {
            return response()->json(['error' => 'Business not found'], 404);
        }

        $settings = $business->email_settings ?? [];
        $settings["{$provider}_client_id"]    = $validated['client_id'];
        $settings["{$provider}_redirect_uri"] = $validated['redirect_uri'];

        // Only overwrite the secret if a new one was provided
        if (!empty($validated['client_secret'])) {
            $settings["{$provider}_client_secret"] = $validated['client_secret'];
        }

        $business->update(['email_settings' => $settings]);

        return response()->json(['message' => "OAuth credentials saved for {$provider}."]);
    }

    /**
     * DELETE /email-accounts/oauth-settings/{provider}
     * Remove per-business credentials so the provider falls back to platform .env config.
     */
    public function deleteOAuthSettings(Request $request, string $provider): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!isset($this->providers[$provider])) {
            return response()->json(['error' => 'Invalid provider'], 422);
        }

        $business = Business::find($request->user()->business_id);

        if (!$business) {
            return response()->json(['error' => 'Business not found'], 404);
        }

        $settings = $business->email_settings ?? [];
        unset(
            $settings["{$provider}_client_id"],
            $settings["{$provider}_client_secret"],
            $settings["{$provider}_redirect_uri"]
        );

        $business->update(['email_settings' => $settings]);

        return response()->json(['message' => "OAuth credentials removed for {$provider}."]);
    }
}
