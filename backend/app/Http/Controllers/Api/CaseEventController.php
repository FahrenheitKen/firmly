<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cases;
use App\Models\CaseEvent;
use App\Models\CourtProceeding;
use App\Rules\NotKenyaHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseEventController extends Controller
{
    public function all(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->canViewAnyCase()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = CaseEvent::query()
            ->select('case_events.id', 'case_events.case_id', 'case_events.event_type', 'case_events.event_date', 'case_events.created_at')
            ->join('cases', 'cases.id', '=', 'case_events.case_id')
            ->where('cases.business_id', $user->business_id)
            ->where('cases.location_id', $user->active_location_id)
            ->whereNull('cases.deleted_at')
            ->when($user->restrictedToOwnCases(), fn($q) => $q->where(function ($q) use ($user) {
                $q->where('cases.assigned_to', $user->id)
                  ->orWhereExists(function ($sub) use ($user) {
                      $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                          ->from('case_collaborators')
                          ->whereColumn('case_collaborators.case_id', 'cases.id')
                          ->where('case_collaborators.user_id', $user->id);
                  });
            }))
            ->with([
                'case:id,case_number,title,assigned_to,case_series_id,our_reference,series_suffix',
                'case.assignedTo:id,first_name,last_name',
                'case.series:id,reference',
            ]);

        if ($request->filled('from')) {
            $query->where('case_events.event_date', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('case_events.event_date', '<=', $request->query('to'));
        }

        $events = $query->orderBy('case_events.event_date', 'asc')->limit(2000)->get();

        return response()->json(['events' => $events]);
    }

    public function index(Request $request, int $caseId): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to, $case->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $events = $case->events()->with('createdBy:id,first_name,last_name')->orderBy('event_date', 'asc')->orderBy('created_at', 'asc')->limit(500)->get();

        return response()->json(['events' => $events]);
    }

    public function store(Request $request, int $caseId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to, $case->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'event_type' => 'required|in:Bring Up,Mention,Hearing,Ruling,Judgement,Hearing of Application,Mention of Application',
            'event_date' => ['required', 'date', new NotKenyaHoliday()],
        ]);

        $duplicate = $case->events()
            ->where('event_type', $validated['event_type'])
            ->whereDate('event_date', $validated['event_date'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => "A {$validated['event_type']} event already exists on this date for this case.",
                'errors' => ['event_date' => ["A {$validated['event_type']} event already exists on this date."]],
            ], 422);
        }

        $event = $case->events()->create([
            'event_type' => $validated['event_type'],
            'event_date' => $validated['event_date'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['event' => $event->load('createdBy:id,first_name,last_name')], 201);
    }

    public function update(Request $request, int $caseId, int $eventId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to, $case->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $event = $case->events()->findOrFail($eventId);

        $validated = $request->validate([
            'event_type' => 'required|in:Bring Up,Mention,Hearing,Ruling,Judgement,Hearing of Application,Mention of Application',
            'event_date' => ['required', 'date', new NotKenyaHoliday()],
        ]);

        $duplicate = $case->events()
            ->where('id', '!=', $event->id)
            ->where('event_type', $validated['event_type'])
            ->whereDate('event_date', $validated['event_date'])
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => "A {$validated['event_type']} event already exists on this date for this case.",
                'errors' => ['event_date' => ["A {$validated['event_type']} event already exists on this date."]],
            ], 422);
        }

        $event->update($validated);

        return response()->json(['event' => $event->fresh()->load('createdBy:id,first_name,last_name')]);
    }

    public function destroy(Request $request, int $caseId, int $eventId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to, $case->id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $event = $case->events()->findOrFail($eventId);

        $linkedToProceeding = CourtProceeding::where('case_id', $case->id)
            ->where(function ($q) use ($event) {
                $q->where('due_for_event_id', $event->id)
                  ->orWhere('bring_up_event_id', $event->id);
            })
            ->exists();

        if ($linkedToProceeding) {
            return response()->json([
                'message' => 'This event is linked to a court proceeding. Delete the proceeding to remove its events.',
            ], 422);
        }

        $event->delete();

        return response()->json(['message' => 'Event deleted']);
    }
}
