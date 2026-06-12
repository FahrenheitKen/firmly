<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('activity_log.view')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = ActivityLog::with(['causer:id,first_name,last_name'])
            ->where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id);

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->filled('subject_type')) {
            $query->where('subject_type', $request->query('subject_type'));
        }

        if ($request->filled('causer_id')) {
            $query->where('causer_id', (int) $request->query('causer_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('subject_label', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%");
            });
        }

        $logs = $query->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 50), 100));

        return response()->json([
            'logs' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }
}
