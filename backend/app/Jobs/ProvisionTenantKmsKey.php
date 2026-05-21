<?php

namespace App\Jobs;

use App\Models\Business;
use App\Services\TenantKmsProvisioner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProvisionTenantKmsKey implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;
    public int $timeout = 120;

    public function __construct(public readonly Business $business)
    {
        $this->onQueue('kms');
    }

    public function backoff(): array
    {
        return [60, 300, 900, 3600, 10800];
    }

    public function handle(TenantKmsProvisioner $provisioner): void
    {
        if (config('documents.driver') !== 's3') {
            Log::info('ProvisionTenantKmsKey: skipped — document driver is not s3', [
                'business_id' => $this->business->id,
                'driver' => config('documents.driver'),
            ]);
            return;
        }

        $provisioner->provision($this->business);
    }

    public function failed(Throwable $e): void
    {
        Log::error('ProvisionTenantKmsKey: permanently failed after retries', [
            'business_id' => $this->business->id,
            'error' => $e->getMessage(),
        ]);
    }
}
