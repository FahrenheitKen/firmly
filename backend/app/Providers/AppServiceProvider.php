<?php

namespace App\Providers;

use App\Services\TenantDocumentStorage;
use App\Services\TenantKmsProvisioner;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TenantDocumentStorage::class, function ($app) {
            $cfg = $app['config']->get('documents');
            return new TenantDocumentStorage(
                driver: $cfg['driver'] ?? 'local',
                localDisk: 'local',
                s3Disk: $cfg['s3']['disk'] ?? 's3',
                kmsAliasPrefix: $cfg['s3']['kms_alias_prefix'] ?? null,
                pendingDeleteTagKey: $cfg['s3']['pending_delete_tag_key'] ?? 'firmly-pending-delete',
                pendingDeleteTagValue: $cfg['s3']['pending_delete_tag_value'] ?? 'true',
            );
        });

        $this->app->singleton(TenantKmsProvisioner::class, function ($app) {
            $cfg = $app['config']->get('documents');
            return new TenantKmsProvisioner(
                accountId: $cfg['kms']['account_id'] ?? null,
                region: $cfg['kms']['region'] ?? 'ap-south-1',
                appIamUser: $cfg['kms']['app_iam_user'] ?? 'firmly-app-prod',
                aliasPrefix: $cfg['s3']['kms_alias_prefix'] ?? null,
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (!env('FRONTEND_URL') && app()->isProduction()) {
            throw new \RuntimeException('FRONTEND_URL is not configured. Set it in .env and run `php artisan config:clear`.');
        }
    }
}
