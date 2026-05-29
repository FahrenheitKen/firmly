<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\CaseDocument;
use App\Models\CaseEvent;
use App\Models\Cases;
use App\Models\CaseSeries;
use App\Models\CourtProceeding;
use App\Models\User;
use App\Notifications\CaseAssignedNotification;
use App\Rules\NotKenyaHoliday;
use App\Services\TenantDocumentStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CaseSeriesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->canViewAnyCase()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $viewOwnOnly = $user->restrictedToOwnCases();

        $query = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->when($viewOwnOnly, fn($q) => $q->whereHas('activeCases', fn($c) => $c->where('assigned_to', $user->id)))
            ->when($viewOwnOnly,
                fn($q) => $q->withCount(['activeCases' => fn($c) => $c->where('assigned_to', $user->id)]),
                fn($q) => $q->withCount('activeCases')
            )
            ->with(['parentSeries:id,reference,name', 'childSeries:id,parent_series_id,reference,name', 'createdByUser:id,first_name,last_name']);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $series = $query->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 25), 100));

        return response()->json([
            'series' => $series->items(),
            'pagination' => [
                'current_page' => $series->currentPage(),
                'last_page' => $series->lastPage(),
                'per_page' => $series->perPage(),
                'total' => $series->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'reference' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'common_parties' => 'nullable|string|max:1000',
            'notes' => 'nullable|string',
            'parent_series_id' => 'nullable|exists:case_series,id',
        ]);

        if (!empty($validated['parent_series_id'])) {
            $parent = CaseSeries::where('business_id', $user->business_id)->find($validated['parent_series_id']);
            if (!$parent) {
                return response()->json(['message' => 'Parent series not found.'], 422);
            }
        }

        $series = CaseSeries::create([
            'business_id' => $user->business_id,
            'location_id' => $user->active_location_id,
            'parent_series_id' => $validated['parent_series_id'] ?? null,
            'reference' => $validated['reference'],
            'name' => $validated['name'],
            'common_parties' => $validated['common_parties'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'series' => $series->load(['parentSeries:id,reference,name', 'createdByUser:id,first_name,last_name']),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $viewOwnOnly = $user->restrictedToOwnCases();

        $query = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->when($viewOwnOnly, fn($q) => $q->whereHas('activeCases', fn($c) => $c->where('assigned_to', $user->id)));

        $casesEagerLoad = fn($q) => $q->select('id', 'case_series_id', 'series_suffix', 'case_number', 'title', 'our_reference', 'status', 'assigned_to', 'client_id')
            ->when($viewOwnOnly, fn($c) => $c->where('assigned_to', $user->id))
            ->with(['assignedTo:id,first_name,last_name', 'client:id,first_name,last_name,business_name'])
            ->orderByRaw("FIELD(series_suffix, '') DESC, series_suffix ASC");

        $series = $query
            ->when($viewOwnOnly,
                fn($q) => $q->withCount(['activeCases' => fn($c) => $c->where('assigned_to', $user->id)]),
                fn($q) => $q->withCount('activeCases')
            )
            ->with([
                'parentSeries:id,reference,name',
                'childSeries:id,parent_series_id,reference,name',
                'createdByUser:id,first_name,last_name',
                'activeCases' => $casesEagerLoad,
            ])
            ->findOrFail($id);

        return response()->json(['series' => $series]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'reference' => 'sometimes|string|max:255',
            'name' => 'sometimes|string|max:255',
            'common_parties' => 'nullable|string|max:1000',
            'notes' => 'nullable|string',
            'parent_series_id' => 'nullable|exists:case_series,id',
        ]);

        if (isset($validated['parent_series_id']) && $validated['parent_series_id'] == $id) {
            return response()->json(['message' => 'A series cannot be its own parent.'], 422);
        }

        $series->update($validated);

        return response()->json(['series' => $series->fresh()->load(['parentSeries:id,reference,name', 'createdByUser:id,first_name,last_name'])]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        Cases::where('case_series_id', $series->id)->update(['case_series_id' => null, 'series_suffix' => null]);

        $series->delete();

        return response()->json(['message' => 'Series deleted. Cases have been detached.']);
    }

    public function createCase(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $businessId = $user->business_id;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'client_id' => "nullable|exists:clients,id,business_id,{$businessId}",
            'client_reference' => 'nullable|string|max:255',
            'opposing_counsel_id' => "nullable|exists:opposing_counsels,id,business_id,{$businessId}",
            'assigned_to' => "nullable|exists:users,id,business_id,{$businessId}",
            'case_number' => 'nullable|string|max:50|unique:cases,case_number',
            'court' => 'nullable|string|max:255',
            'court_number_filed' => 'nullable|string|max:255',
            'judge' => 'nullable|string|max:255',
            'case_type' => 'nullable|in:Plaintiff,Defendant',
            'filed_date' => 'nullable|date',
            'description' => 'nullable|string',
        ]);

        $suffix = $series->nextSuffix();
        $ourRef = $series->reference . '-' . $suffix . '/' . substr($series->reference, -2);

        $refParts = explode('/', $series->reference);
        $yearPart = end($refParts);
        $basePart = implode('/', array_slice($refParts, 0, -1));
        $ourRef = $basePart . '-' . $suffix . '/' . $yearPart;

        // Inherit shared fields from existing case in series if not provided
        $firstCase = $series->activeCases()->first();
        $clientId = $validated['client_id'] ?? ($firstCase?->client_id);
        $assignedTo = $validated['assigned_to'] ?? ($firstCase?->assigned_to);
        $court = $validated['court'] ?? ($firstCase?->court);
        $courtNumberFiled = $validated['court_number_filed'] ?? ($firstCase?->court_number_filed);
        $judge = $validated['judge'] ?? ($firstCase?->judge);

        $case = Cases::create([
            'business_id' => $businessId,
            'location_id' => $user->active_location_id,
            'case_series_id' => $series->id,
            'series_suffix' => $suffix,
            'title' => $validated['title'],
            'our_reference' => $ourRef,
            'client_id' => $clientId,
            'client_reference' => $validated['client_reference'] ?? null,
            'opposing_counsel_id' => $validated['opposing_counsel_id'] ?? null,
            'assigned_to' => $assignedTo,
            'case_number' => $validated['case_number'] ?? null,
            'court' => $court,
            'court_number_filed' => $courtNumberFiled,
            'judge' => $judge,
            'case_type' => $validated['case_type'] ?? null,
            'filed_date' => $validated['filed_date'] ?? null,
            'description' => $validated['description'] ?? null,
            'created_by' => $user->id,
        ]);

        $series->update(['last_suffix' => $suffix]);

        if ($case->assigned_to && $case->assigned_to !== $user->id) {
            $assignee = User::find($case->assigned_to);
            if ($assignee) {
                $assignee->notify(new CaseAssignedNotification($case, $user));
            }
        }

        return response()->json([
            'case' => $case->load(['assignedTo:id,first_name,last_name', 'client:id,first_name,last_name,business_name']),
        ], 201);
    }

    public function detachCase(Request $request, int $id, int $caseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)->findOrFail($id);
        $case = Cases::where('case_series_id', $series->id)->findOrFail($caseId);

        $case->update(['case_series_id' => null, 'series_suffix' => null]);

        return response()->json(['message' => 'Case detached from series.']);
    }

    public function linkCase(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'case_id' => 'required|exists:cases,id',
        ]);

        $case = Cases::where('business_id', $user->business_id)->findOrFail($validated['case_id']);

        if ($case->case_series_id) {
            return response()->json(['message' => 'Case already belongs to a series. Detach it first.'], 422);
        }

        $suffix = $series->nextSuffix();
        $case->update(['case_series_id' => $series->id, 'series_suffix' => $suffix]);
        $series->update(['last_suffix' => $suffix]);

        return response()->json(['message' => 'Case linked to series.', 'suffix' => $suffix]);
    }

    public function bulkAddEvent(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'event_type' => 'required|in:Bring Up,Mention,Hearing,Ruling,Judgement,Hearing of Application,Mention of Application',
            'event_date' => ['required', 'date', new NotKenyaHoliday()],
            'exclude_case_ids' => 'nullable|array',
            'exclude_case_ids.*' => 'integer',
        ]);

        $excludeIds = $validated['exclude_case_ids'] ?? [];
        $cases = $series->activeCases()->whereNotIn('id', $excludeIds)->get();

        $created = 0;
        $skipped = 0;
        foreach ($cases as $case) {
            $exists = CaseEvent::where('case_id', $case->id)
                ->where('event_type', $validated['event_type'])
                ->whereDate('event_date', $validated['event_date'])
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            CaseEvent::create([
                'case_id' => $case->id,
                'event_type' => $validated['event_type'],
                'event_date' => $validated['event_date'],
                'created_by' => $user->id,
            ]);
            $created++;
        }

        return response()->json([
            'message' => "Event added to {$created} case(s)." . ($skipped ? " Skipped {$skipped} (duplicate)." : ''),
            'created' => $created,
            'skipped' => $skipped,
        ]);
    }

    public function bulkAddProceeding(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'before_court_no' => 'nullable|string|max:255',
            'magistrate' => 'nullable|string|max:255',
            'instruction' => 'nullable|string',
            'directions' => 'nullable|string',
            'time_spent' => 'nullable|string|max:100',
            'exclude_case_ids' => 'nullable|array',
            'exclude_case_ids.*' => 'integer',
        ]);

        $excludeIds = $validated['exclude_case_ids'] ?? [];
        unset($validated['exclude_case_ids']);
        $cases = $series->activeCases()->whereNotIn('id', $excludeIds)->get();

        $created = 0;
        foreach ($cases as $case) {
            CourtProceeding::create(array_merge($validated, [
                'case_id' => $case->id,
                'created_by' => $user->id,
            ]));
            $created++;
        }

        return response()->json([
            'message' => "Proceeding added to {$created} case(s).",
            'created' => $created,
        ]);
    }

    public function bulkUploadDocument(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $series = CaseSeries::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $request->validate([
            'documents' => 'required|array|min:1',
            'documents.*' => 'file|max:65536',
            'exclude_case_ids' => 'nullable|array',
            'exclude_case_ids.*' => 'integer',
        ]);

        $excludeIds = $request->input('exclude_case_ids', []);
        $cases = $series->activeCases()->whereNotIn('id', $excludeIds)->get();

        if ($cases->isEmpty()) {
            return response()->json(['message' => 'No cases to upload to.'], 422);
        }

        $storage = app(TenantDocumentStorage::class);
        $business = Business::findOrFail($user->business_id);
        $uploaded = 0;

        foreach ($request->file('documents') as $file) {
            $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($file->getClientOriginalName()));
            $fileContent = file_get_contents($file->getRealPath());

            foreach ($cases as $case) {
                $tempPath = tempnam(sys_get_temp_dir(), 'series_');
                file_put_contents($tempPath, $fileContent);
                $tempFile = new \Illuminate\Http\UploadedFile($tempPath, $file->getClientOriginalName(), $file->getMimeType(), null, true);

                $info = $storage->upload($business, $case->id, $tempFile);
                CaseDocument::create([
                    'case_id' => $case->id,
                    'business_id' => $user->business_id,
                    'original_name' => $safeName,
                    'file_path' => $info['file_path'],
                    'disk' => $info['disk'],
                    'storage_key' => $info['storage_key'],
                    'kms_key_id' => $info['kms_key_id'],
                    'etag' => $info['etag'],
                    'checksum_sha256' => $info['checksum_sha256'],
                    'file_size' => $info['file_size'],
                    'mime_type' => $file->getMimeType(),
                    'uploaded_by' => $user->id,
                ]);
                $uploaded++;

                @unlink($tempPath);
            }
        }

        return response()->json([
            'message' => "Uploaded to {$cases->count()} case(s). {$uploaded} total document(s) created.",
            'uploaded' => $uploaded,
        ]);
    }
}
