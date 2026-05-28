<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cases;
use App\Models\CourtProceeding;
use App\Rules\NotKenyaHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourtProceedingController extends Controller
{
    public function index(Request $request, int $caseId): JsonResponse
    {
        $case = $this->resolveCase($request, $caseId);

        $proceedings = $case->proceedings()
            ->with([
                'createdBy:id,first_name,last_name',
                'dueForEvent:id,event_type,event_date',
                'bringUpEvent:id,event_type,event_date',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(500)
            ->get();

        return response()->json(['proceedings' => $proceedings]);
    }

    public function store(Request $request, int $caseId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = $this->resolveCase($request, $caseId);

        $validated = $request->validate([
            'before_court_no' => 'nullable|string|max:100',
            'magistrate' => 'nullable|string|max:255',
            'instruction' => 'nullable|string',
            'directions' => 'nullable|string',
            'time_spent' => ['nullable', 'regex:/^\d{1,2}:[0-5]\d$/'],
            'due_for_type' => 'nullable|in:Mention,Hearing,Ruling,Judgement,Hearing of Application,Mention of Application',
            'due_for_date' => ['nullable', 'required_with:due_for_type', 'date', new NotKenyaHoliday()],
            'bring_up_date' => ['nullable', 'date', new NotKenyaHoliday()],
        ]);

        $userId = $request->user()->id;

        $proceeding = DB::transaction(function () use ($case, $validated, $userId) {
            $dueForEventId = null;
            if (!empty($validated['due_for_type']) && !empty($validated['due_for_date'])) {
                $dueForEventId = $case->events()->create([
                    'event_type' => $validated['due_for_type'],
                    'event_date' => $validated['due_for_date'],
                    'created_by' => $userId,
                ])->id;
            }

            $bringUpEventId = null;
            if (!empty($validated['bring_up_date'])) {
                $bringUpEventId = $case->events()->create([
                    'event_type' => 'Bring Up',
                    'event_date' => $validated['bring_up_date'],
                    'created_by' => $userId,
                ])->id;
            }

            return $case->proceedings()->create([
                'business_id' => $case->business_id,
                'before_court_no' => $validated['before_court_no'] ?? null,
                'magistrate' => $validated['magistrate'] ?? null,
                'instruction' => $validated['instruction'] ?? null,
                'directions' => $validated['directions'] ?? null,
                'time_spent' => $this->normalizeTime($validated['time_spent'] ?? null),
                'due_for_event_id' => $dueForEventId,
                'bring_up_event_id' => $bringUpEventId,
                'created_by' => $userId,
            ]);
        });

        $proceeding->load([
            'createdBy:id,first_name,last_name',
            'dueForEvent:id,event_type,event_date',
            'bringUpEvent:id,event_type,event_date',
        ]);

        return response()->json(['proceeding' => $proceeding], 201);
    }

    public function update(Request $request, int $caseId, int $proceedingId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = $this->resolveCase($request, $caseId);

        $proceeding = CourtProceeding::where('case_id', $case->id)->findOrFail($proceedingId);

        $validated = $request->validate([
            'before_court_no' => 'nullable|string|max:100',
            'magistrate' => 'nullable|string|max:255',
            'instruction' => 'nullable|string',
            'directions' => 'nullable|string',
            'time_spent' => ['nullable', 'regex:/^\d{1,2}:[0-5]\d$/'],
            'due_for_type' => 'nullable|in:Mention,Hearing,Ruling,Judgement,Hearing of Application,Mention of Application',
            'due_for_date' => ['nullable', 'required_with:due_for_type', 'date', new NotKenyaHoliday()],
            'bring_up_date' => ['nullable', 'date', new NotKenyaHoliday()],
        ]);

        $userId = $request->user()->id;

        DB::transaction(function () use ($proceeding, $case, $validated, $userId) {
            $proceeding->update([
                'before_court_no' => $validated['before_court_no'] ?? null,
                'magistrate' => $validated['magistrate'] ?? null,
                'instruction' => $validated['instruction'] ?? null,
                'directions' => $validated['directions'] ?? null,
                'time_spent' => $this->normalizeTime($validated['time_spent'] ?? null),
            ]);

            if (array_key_exists('due_for_type', $validated)) {
                if (!empty($validated['due_for_type']) && !empty($validated['due_for_date'])) {
                    if ($proceeding->due_for_event_id) {
                        $proceeding->dueForEvent()->update([
                            'event_type' => $validated['due_for_type'],
                            'event_date' => $validated['due_for_date'],
                        ]);
                    } else {
                        $event = $case->events()->create([
                            'event_type' => $validated['due_for_type'],
                            'event_date' => $validated['due_for_date'],
                            'created_by' => $userId,
                        ]);
                        $proceeding->update(['due_for_event_id' => $event->id]);
                    }
                } elseif ($proceeding->due_for_event_id) {
                    $oldId = $proceeding->due_for_event_id;
                    $proceeding->update(['due_for_event_id' => null]);
                    \App\Models\CaseEvent::where('id', $oldId)->delete();
                }
            }

            if (array_key_exists('bring_up_date', $validated)) {
                if (!empty($validated['bring_up_date'])) {
                    if ($proceeding->bring_up_event_id) {
                        $proceeding->bringUpEvent()->update([
                            'event_date' => $validated['bring_up_date'],
                        ]);
                    } else {
                        $event = $case->events()->create([
                            'event_type' => 'Bring Up',
                            'event_date' => $validated['bring_up_date'],
                            'created_by' => $userId,
                        ]);
                        $proceeding->update(['bring_up_event_id' => $event->id]);
                    }
                } elseif ($proceeding->bring_up_event_id) {
                    $oldId = $proceeding->bring_up_event_id;
                    $proceeding->update(['bring_up_event_id' => null]);
                    \App\Models\CaseEvent::where('id', $oldId)->delete();
                }
            }
        });

        $proceeding->load([
            'createdBy:id,first_name,last_name',
            'dueForEvent:id,event_type,event_date',
            'bringUpEvent:id,event_type,event_date',
        ]);

        return response()->json(['proceeding' => $proceeding]);
    }

    public function destroy(Request $request, int $caseId, int $proceedingId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = $this->resolveCase($request, $caseId);

        $proceeding = CourtProceeding::where('case_id', $case->id)->findOrFail($proceedingId);

        DB::transaction(function () use ($proceeding) {
            $dueForId = $proceeding->due_for_event_id;
            $bringUpId = $proceeding->bring_up_event_id;
            $proceeding->delete();
            if ($dueForId) {
                \App\Models\CaseEvent::where('id', $dueForId)->delete();
            }
            if ($bringUpId) {
                \App\Models\CaseEvent::where('id', $bringUpId)->delete();
            }
        });

        return response()->json(['message' => 'Proceeding deleted']);
    }

    private function resolveCase(Request $request, int $caseId): Cases
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($caseId);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            abort(403, 'Unauthorized');
        }

        return $case;
    }

    private function normalizeTime(?string $value): ?string
    {
        if (!$value) {
            return null;
        }
        [$h, $m] = explode(':', $value);
        return sprintf('%02d:%02d:00', (int) $h, (int) $m);
    }
}
