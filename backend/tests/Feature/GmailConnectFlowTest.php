<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserEmailAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GmailConnectFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();

        config([
            'services.gmail.client_id'      => 'test-gmail-client-id',
            'services.gmail.client_secret'  => 'test-gmail-client-secret',
            'services.gmail.redirect_uri'   => 'http://localhost/api/email-accounts/oauth/gmail/callback',
            'services.outlook.client_id'    => 'test-outlook-client-id',
            'services.outlook.client_secret'=> 'test-outlook-client-secret',
            'services.outlook.redirect_uri' => 'http://localhost/api/email-accounts/oauth/outlook/callback',
            'services.zoho.client_id'       => 'test-zoho-client-id',
            'services.zoho.client_secret'   => 'test-zoho-client-secret',
            'services.zoho.redirect_uri'    => 'http://localhost/api/email-accounts/oauth/zoho/callback',
        ]);
    }

    // -------------------------------------------------------------------------
    // GET /email-accounts/oauth/gmail  — redirect URL generation
    // -------------------------------------------------------------------------

    public function test_oauth_redirect_returns_gmail_auth_url(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth/gmail');

        $response->assertOk()
            ->assertJsonStructure(['url']);

        $url = $response->json('url');

        $this->assertStringContainsString('accounts.google.com/o/oauth2/v2/auth', $url);
        $this->assertStringContainsString('client_id=test-gmail-client-id', $url);
        $this->assertStringContainsString('response_type=code', $url);
        $this->assertStringContainsString('access_type=offline', $url);
        $this->assertStringContainsString('state=', $url);
    }

    public function test_oauth_redirect_state_encodes_user_id(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth/gmail');

        $url = $response->json('url');
        parse_str(parse_url($url, PHP_URL_QUERY), $params);

        $state = json_decode(base64_decode($params['state']), true);

        $this->assertEquals($this->user->id, $state['user_id']);
        $this->assertArrayHasKey('ts', $state);
    }

    public function test_oauth_redirect_rejects_invalid_provider(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth/invalidprovider');

        $response->assertUnprocessable()
            ->assertJson(['error' => 'Invalid provider']);
    }

    public function test_oauth_redirect_requires_authentication(): void
    {
        $this->getJson('/api/email-accounts/oauth/gmail')
            ->assertUnauthorized();
    }

    // -------------------------------------------------------------------------
    // GET /email-accounts/oauth/gmail/callback  — OAuth callback handling
    // -------------------------------------------------------------------------

    private function buildState(?int $userId = null): string
    {
        return base64_encode(json_encode([
            'user_id' => $userId ?? $this->user->id,
            'ts'      => now()->timestamp,
        ]));
    }

    public function test_callback_stores_account_and_redirects_on_success(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token'          => Http::response([
                'access_token'  => 'acc-token-123',
                'refresh_token' => 'ref-token-456',
                'expires_in'    => 3600,
            ]),
            'www.googleapis.com/oauth2/v1/userinfo' => Http::response([
                'email' => 'user@gmail.com',
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('connected=1');

        $account = UserEmailAccount::where('user_id', $this->user->id)->first();

        $this->assertNotNull($account);
        $this->assertEquals('gmail', $account->provider);
        $this->assertEquals('user@gmail.com', $account->email_address);
        $this->assertTrue($account->sync_enabled);
    }

    public function test_callback_updates_existing_account(): void
    {
        UserEmailAccount::create([
            'user_id'       => $this->user->id,
            'provider'      => 'gmail',
            'email_address' => 'old@gmail.com',
            'access_token'  => 'old-token',
            'sync_enabled'  => true,
        ]);

        Http::fake([
            'oauth2.googleapis.com/token'          => Http::response([
                'access_token'  => 'new-token',
                'refresh_token' => 'new-refresh',
                'expires_in'    => 3600,
            ]),
            'www.googleapis.com/oauth2/v1/userinfo' => Http::response([
                'email' => 'new@gmail.com',
            ]),
        ]);

        $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $this->assertDatabaseCount('user_email_accounts', 1);
        $this->assertDatabaseHas('user_email_accounts', [
            'user_id'       => $this->user->id,
            'email_address' => 'new@gmail.com',
        ]);
    }

    public function test_callback_redirects_with_error_when_code_missing(): void
    {
        $response = $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=auth_failed');
        $this->assertDatabaseEmpty('user_email_accounts');
    }

    public function test_callback_redirects_with_error_when_state_missing(): void
    {
        $response = $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'code' => 'valid-code',
        ]));

        $response->assertRedirectContains('error=auth_failed');
    }

    public function test_callback_redirects_with_error_when_state_has_no_user_id(): void
    {
        $state = base64_encode(json_encode(['ts' => now()->timestamp]));

        $response = $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $state,
        ]));

        $response->assertRedirectContains('error=auth_failed');
    }

    public function test_callback_redirects_with_error_when_token_exchange_fails(): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response([], 400),
        ]);

        $response = $this->get('/api/email-accounts/oauth/gmail/callback?' . http_build_query([
            'code'  => 'bad-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=auth_failed');
        $this->assertDatabaseEmpty('user_email_accounts');
    }

    public function test_callback_rejects_invalid_provider(): void
    {
        $response = $this->get('/api/email-accounts/oauth/invalidprovider/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=invalid_provider');
    }

    // -------------------------------------------------------------------------
    // GET /email-account  — show connected account
    // -------------------------------------------------------------------------

    public function test_show_returns_null_when_no_account_connected(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/email-account')
            ->assertOk()
            ->assertJson(['data' => null]);
    }

    public function test_show_returns_connected_account(): void
    {
        UserEmailAccount::create([
            'user_id'        => $this->user->id,
            'provider'       => 'gmail',
            'email_address'  => 'user@gmail.com',
            'access_token'   => 'tok',
            'sync_enabled'   => true,
            'last_synced_at' => null,
        ]);

        $this->actingAs($this->user)
            ->getJson('/api/email-account')
            ->assertOk()
            ->assertJsonPath('data.provider', 'gmail')
            ->assertJsonPath('data.email_address', 'user@gmail.com')
            ->assertJsonPath('data.sync_enabled', true);
    }

    // -------------------------------------------------------------------------
    // DELETE /email-account  — disconnect
    // -------------------------------------------------------------------------

    public function test_disconnect_removes_account(): void
    {
        UserEmailAccount::create([
            'user_id'       => $this->user->id,
            'provider'      => 'gmail',
            'email_address' => 'user@gmail.com',
            'access_token'  => 'tok',
            'sync_enabled'  => true,
        ]);

        $this->actingAs($this->user)
            ->deleteJson('/api/email-account')
            ->assertOk()
            ->assertJsonPath('message', 'Email account disconnected.');

        $this->assertDatabaseEmpty('user_email_accounts');
    }

    public function test_disconnect_when_no_account_returns_graceful_message(): void
    {
        $this->actingAs($this->user)
            ->deleteJson('/api/email-account')
            ->assertOk()
            ->assertJsonPath('message', 'No account found.');
    }
}
