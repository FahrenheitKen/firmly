<?php

namespace App\Observers;

use App\Jobs\ProvisionTenantKmsKey;
use App\Models\Business;

class BusinessObserver
{
    public function created(Business $business): void
    {
        ProvisionTenantKmsKey::dispatch($business)->afterCommit();
    }
}
