<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

trait LogsActivity
{
    protected function logActivity(
        Request $request,
        string $action,
        string $subjectType,
        ?int $subjectId = null,
        ?string $subjectLabel = null,
        ?array $properties = null
    ): void {
        $user = $request->user();
        if (!$user) return;

        ActivityLog::create([
            'business_id'   => $user->business_id,
            'location_id'   => $user->active_location_id,
            'causer_id'     => $user->id,
            'action'        => $action,
            'subject_type'  => $subjectType,
            'subject_id'    => $subjectId,
            'subject_label' => $subjectLabel,
            'properties'    => $properties,
            'ip_address'    => $request->ip(),
        ]);
    }
}
