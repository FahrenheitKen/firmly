<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Currency;
use App\Models\User;
use App\Models\UserEmailAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ZohoConnectFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();

        config([
            'services.gmail.client_id'       => 'test-gmail-id',
            'services.gmail.client_secret'   => 'test-gmail-secret',
            'services.gmail.redirect_uri'    => 'http://localhost/api/email-accounts/oauth/gmail/callback',
            'services.outlook.client_id'     => 'test-outlook-id',
            'services.outlook.client_secret' => 'test-outlook-secret',
            'services.outlook.redirect_uri'  => 'http://localhost/api/email-accounts/oauth/outlook/callback',
            'services.zoho.client_id'        => 'test-zoho-id',
            'services.zoho.client_secret'    => 'test-zoho-secret',
            'services.zoho.redirect_uri'     => 'http://localhost/api/email-accounts/oauth/zoho/callback',
        ]);
    }

    private function makeBusiness(array $extra = []): Business
    {
        $currency = Currency::firstOrCreate(
            ['code' => 'USD'],
            [
                'country'           => 'United States',
                'currency'          => 'US Dollar',
                'symbol'            => '$',
                'thousand_separator'=> ',',
                'decimal_separator' => '.',
            ]
        );

        return Business::create(array_merge([
            'name'        => 'Test Business',
            'currency_id' => $currency->id,
            'owner_id'    => $this->user->id,
        ], $extra));
    }

    private function buildState(?int $userId = null, ?int $businessId = null): string
    {
        return base64_encode(json_encode([
            'user_id'     => $userId ?? $this->user->id,
            'business_id' => $businessId ?? $this->user->business_id,
            'ts'          => now()->timestamp,
        ]));
    }

    // -------------------------------------------------------------------------
    // Redirect URL
    // -------------------------------------------------------------------------

    public function test_oauth_redirect_returns_zoho_auth_url(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth/zoho');

        $response->assertOk()->assertJsonStructure(['url']);

        $url = $response->json('url');
        $this->assertStringContainsString('accounts.zoho.com/oauth/v2/auth', $url);
        $this->assertStringContainsString('client_id=test-zoho-id', $url);
        $this->assertStringContainsString('response_type=code', $url);
        $this->assertStringContainsString('access_type=offline', $url);
        $this->assertStringContainsString('ZohoMail.messages.READ', $url);
        $this->assertStringContainsString('ZohoMail.accounts.READ', $url);
    }

    public function test_redirect_state_encodes_user_and_business_id(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth/zoho');

        parse_str(parse_url($response->json('url'), PHP_URL_QUERY), $params);
        $state = json_decode(base64_decode($params['state']), true);

        $this->assertEquals($this->user->id, $state['user_id']);
        $this->assertArrayHasKey('ts', $state);
    }

    // -------------------------------------------------------------------------
    // Callback — email as plain string
    // -------------------------------------------------------------------------

    public function test_callback_stores_account_when_email_is_string(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'access_token'  => 'zoho-access-token',
                'refresh_token' => 'zoho-refresh-token',
                'expires_in'    => 3600,
            ]),
            'mail.zoho.com/api/accounts' => Http::response([
                'data' => [['emailAddress' => 'user@zoho.com']],
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('connected=1');

        $account = UserEmailAccount::where('user_id', $this->user->id)->first();
        $this->assertNotNull($account);
        $this->assertEquals('zoho', $account->provider);
        $this->assertEquals('user@zoho.com', $account->email_address);
        $this->assertTrue($account->sync_enabled);
    }

    // -------------------------------------------------------------------------
    // Callback — email as array (the bug that was fixed)
    // -------------------------------------------------------------------------

    public function test_callback_handles_email_address_returned_as_array(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'access_token'  => 'zoho-access-token',
                'refresh_token' => 'zoho-refresh-token',
                'expires_in'    => 3600,
            ]),
            'mail.zoho.com/api/accounts' => Http::response([
                'data' => [['emailAddress' => ['user@zoho.com', 'alias@zoho.com']]],
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('connected=1');

        $account = UserEmailAccount::where('user_id', $this->user->id)->first();
        $this->assertEquals('user@zoho.com', $account->email_address);
    }

    // -------------------------------------------------------------------------
    // Callback — falls back to incomingUserName
    // -------------------------------------------------------------------------

    public function test_callback_falls_back_to_incoming_username(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'access_token' => 'tok',
                'expires_in'   => 3600,
            ]),
            'mail.zoho.com/api/accounts' => Http::response([
                'data' => [['incomingUserName' => 'user@zoho.com']],
            ]),
        ]);

        $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $this->assertDatabaseHas('user_email_accounts', [
            'user_id'       => $this->user->id,
            'email_address' => 'user@zoho.com',
        ]);
    }

    // -------------------------------------------------------------------------
    // Callback — Zoho API-level errors (HTTP 200 with error body)
    // -------------------------------------------------------------------------

    public function test_callback_fails_gracefully_when_zoho_returns_invalid_code_error(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'error' => 'invalid_code',
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'expired-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=auth_failed');
        $this->assertDatabaseEmpty('user_email_accounts');
    }

    public function test_callback_fails_gracefully_when_zoho_returns_invalid_client_error(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'error' => 'invalid_client',
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=auth_failed');
        $this->assertDatabaseEmpty('user_email_accounts');
    }

    public function test_callback_fails_gracefully_when_access_token_missing(): void
    {
        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => Http::response([
                'message' => 'some unexpected response',
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState(),
        ]));

        $response->assertRedirectContains('error=auth_failed');
    }

    // -------------------------------------------------------------------------
    // Callback — missing parameters
    // -------------------------------------------------------------------------

    public function test_callback_fails_when_code_missing(): void
    {
        $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'state' => $this->buildState(),
        ]))->assertRedirectContains('error=auth_failed');
    }

    public function test_callback_fails_when_state_missing(): void
    {
        $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code' => 'valid-code',
        ]))->assertRedirectContains('error=auth_failed');
    }

    // -------------------------------------------------------------------------
    // Per-business credentials override
    // -------------------------------------------------------------------------

    public function test_callback_uses_business_credentials_from_email_settings(): void
    {
        $business = $this->makeBusiness([
            'email_settings' => [
                'zoho_client_id'     => 'biz-client-id',
                'zoho_client_secret' => 'biz-client-secret',
                'zoho_redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ],
        ]);

        $this->user->update(['business_id' => $business->id]);

        Http::fake([
            'accounts.zoho.com/oauth/v2/token' => function ($request) {
                // Assert business credentials were used in the exchange
                $body = $request->body();
                $this->assertStringContainsString('client_id=biz-client-id', $body);
                $this->assertStringContainsString('client_secret=biz-client-secret', $body);

                return Http::response([
                    'access_token'  => 'biz-token',
                    'refresh_token' => 'biz-refresh',
                    'expires_in'    => 3600,
                ]);
            },
            'mail.zoho.com/api/accounts' => Http::response([
                'data' => [['emailAddress' => 'biz@zoho.com']],
            ]),
        ]);

        $response = $this->get('/api/email-accounts/oauth/zoho/callback?' . http_build_query([
            'code'  => 'valid-code',
            'state' => $this->buildState($this->user->id, $business->id),
        ]));

        $response->assertRedirectContains('connected=1');
        $this->assertDatabaseHas('user_email_accounts', [
            'user_id'       => $this->user->id,
            'email_address' => 'biz@zoho.com',
        ]);
    }

    // -------------------------------------------------------------------------
    // OAuth settings CRUD
    // -------------------------------------------------------------------------

    public function test_can_save_zoho_oauth_settings(): void
    {
        $business = $this->makeBusiness();
        $this->user->update(['business_id' => $business->id]);

        $this->actingAs($this->user)
            ->putJson('/api/email-accounts/oauth-settings/zoho', [
                'client_id'     => 'my-client-id',
                'client_secret' => 'my-secret',
                'redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ])
            ->assertOk();

        $business->refresh();
        $this->assertEquals('my-client-id', $business->email_settings['zoho_client_id']);
    }

    public function test_can_update_zoho_credentials_without_resending_secret(): void
    {
        $business = $this->makeBusiness([
            'email_settings' => [
                'zoho_client_id'     => 'old-id',
                'zoho_client_secret' => 'kept-secret',
                'zoho_redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ],
        ]);
        $this->user->update(['business_id' => $business->id]);

        $this->actingAs($this->user)
            ->putJson('/api/email-accounts/oauth-settings/zoho', [
                'client_id'     => 'new-id',
                'client_secret' => '',   // blank — keep existing
                'redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ])
            ->assertOk();

        $business->refresh();
        $this->assertEquals('new-id', $business->email_settings['zoho_client_id']);
        $this->assertEquals('kept-secret', $business->email_settings['zoho_client_secret']);
    }

    public function test_can_read_zoho_oauth_settings_without_exposing_secret(): void
    {
        $business = $this->makeBusiness([
            'email_settings' => [
                'zoho_client_id'     => 'my-client-id',
                'zoho_client_secret' => 'super-secret',
                'zoho_redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ],
        ]);
        $this->user->update(['business_id' => $business->id]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/email-accounts/oauth-settings')
            ->assertOk();

        $zoho = $response->json('data.zoho');
        $this->assertEquals('my-client-id', $zoho['client_id']);
        $this->assertTrue($zoho['configured']);
        $this->assertArrayNotHasKey('client_secret', $zoho);
    }

    public function test_can_remove_zoho_oauth_settings(): void
    {
        $business = $this->makeBusiness([
            'email_settings' => [
                'zoho_client_id'     => 'my-client-id',
                'zoho_client_secret' => 'my-secret',
                'zoho_redirect_uri'  => 'http://localhost/api/email-accounts/oauth/zoho/callback',
            ],
        ]);
        $this->user->update(['business_id' => $business->id]);

        $this->actingAs($this->user)
            ->deleteJson('/api/email-accounts/oauth-settings/zoho')
            ->assertOk();

        $business->refresh();
        $this->assertArrayNotHasKey('zoho_client_id', $business->email_settings ?? []);
    }
}
