<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cases;
use App\Models\CaseEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseEventController extends Controller
{
    public function index(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $events = $case->events()->orderBy('event_date', 'asc')->orderBy('created_at', 'asc')->limit(500)->get();

        return response()->json(['events' => $events]);
    }

    public function store(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        $validated = $request->validate([
            'event_type' => 'required|in:Bring Up,Mention,Hearing,Ruling,Judgement',
            'event_date' => 'required|date',
        ]);

        $event = $case->events()->create([
            'event_type' => $validated['event_type'],
            'event_date' => $validated['event_date'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['event' => $event], 201);
    }
}
