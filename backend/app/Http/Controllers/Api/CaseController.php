<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Cases;
use App\Models\CaseDocument;
use App\Models\Client;
use App\Models\User;
use App\Jobs\ConvertCaseDocumentToPdf;
use App\Notifications\CaseAssignedNotification;
use App\Services\TenantDocumentStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->canViewAnyCase()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $user->business_id;
        $activeLocationId = $user->active_location_id;

        $cases = Cases::where('business_id', $businessId)
            ->where('location_id', $activeLocationId)
            ->when($user->restrictedToOwnCases(), fn($q) => $q->where('assigned_to', $user->id))
            ->with(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'createdBy:id,first_name,last_name', 'opposingCounsel:id,name,firm'])
            ->when($request->client_id, fn($q, $cid) => $q->where('client_id', $cid))
            ->when($request->assigned_to, fn($q, $uid) => $q->where('assigned_to', $uid))
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('case_number', 'like', "%{$s}%")
                  ->orWhere('our_reference', 'like', "%{$s}%")
                  ->orWhere('status', 'like', "%{$s}%");
            }))
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 25), 500));

        return response()->json([
            'cases' => $cases->items(),
            'pagination' => [
                'current_page' => $cases->currentPage(),
                'last_page' => $cases->lastPage(),
                'per_page' => $cases->perPage(),
                'total' => $cases->total(),
            ],
        ]);
    }

    private function getInitials(?string $name): string
    {
        if (!$name) return '';
        $skip = ['&', 'and', 'company', 'advocates', 'ltd', 'limited', 'inc', 'llc', 'plc', 'corporation', 'corp', 'co'];
        return collect(explode(' ', preg_replace('/\s+/', ' ', trim($name))))
            ->reject(fn($w) => in_array(strtolower($w), $skip))
            ->map(fn($w) => strtoupper($w[0] ?? ''))
            ->implode('');
    }

    private function getCityAbbreviation(?string $city): string
    {
        if (!$city) return '';
        $city = strtoupper(trim($city));
        $common = [
            'NAIROBI' => 'NRB', 'MOMBASA' => 'MSA', 'KISUMU' => 'KSM',
            'NAKURU' => 'NKU', 'ELDORET' => 'ELD', 'THIKA' => 'THK',
            'MACHAKOS' => 'MCK', 'MALINDI' => 'MYD', 'NANYUKI' => 'NYK',
            'NYERI' => 'NYR', 'KAKAMEGA' => 'KKM', 'KITALE' => 'KTL',
            'MERU' => 'MRU', 'EMBU' => 'EMB', 'KISII' => 'KSI',
        ];
        return $common[$city] ?? substr($city, 0, 3);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        if ($request->has('is_recovery')) {
            $request->merge(['is_recovery' => filter_var($request->is_recovery, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)]);
        }

        $validated = $request->validate([
            'client_id' => "nullable|exists:clients,id,business_id,{$businessId}",
            'client_reference' => 'nullable|string|max:255',
            'opposing_counsel_id' => "nullable|exists:opposing_counsels,id,business_id,{$businessId}",
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'our_reference' => 'nullable|string|max:255',
            'case_number' => 'nullable|string|max:50|unique:cases,case_number',
            'assigned_to' => "nullable|exists:users,id,business_id,{$businessId}",
            'court' => 'nullable|string|max:255',
            'court_number_filed' => 'nullable|string|max:255',
            'judge' => 'nullable|string|max:255',
            'is_recovery' => 'nullable|boolean',
            'case_type' => 'nullable|in:Plaintiff,Defendant',
            'filed_date' => 'nullable|date',
        ]);

        $validated['business_id'] = $businessId;
        $validated['created_by'] = $request->user()->id;
        $validated['location_id'] = $request->user()->active_location_id;

        $case = Cases::create($validated);

        // Notify the assignee (skip self-assignment).
        if ($case->assigned_to && $case->assigned_to !== $request->user()->id) {
            $assignee = User::find($case->assigned_to);
            if ($assignee) {
                $assignee->notify(new CaseAssignedNotification($case, $request->user()));
            }
        }

        if ($request->hasFile('documents')) {
            $storage = app(TenantDocumentStorage::class);
            $business = Business::findOrFail($businessId);
            foreach ($request->file('documents') as $file) {
                $info = $storage->upload($business, $case->id, $file);
                $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($file->getClientOriginalName()));
                $doc = CaseDocument::create([
                    'case_id'         => $case->id,
                    'business_id'     => $businessId,
                    'original_name'   => $safeName,
                    'file_path'       => $info['file_path'],
                    'disk'            => $info['disk'],
                    'storage_key'     => $info['storage_key'],
                    'kms_key_id'      => $info['kms_key_id'],
                    'etag'            => $info['etag'],
                    'checksum_sha256' => $info['checksum_sha256'],
                    'file_size'       => $info['file_size'],
                    'mime_type'       => $info['mime_type'],
                    'uploaded_by'     => $request->user()->id,
                ]);

                $ext = strtolower($file->getClientOriginalExtension());
                if ($ext === 'doc' || $ext === 'docx') {
                    ConvertCaseDocumentToPdf::dispatch($doc->id);
                }
            }
        }

        return response()->json(['case' => $case->load(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'opposingCounsel:id,name,firm'])], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->with(['client', 'assignedTo', 'createdBy', 'opposingCounsel', 'series:id,reference,name'])
            ->findOrFail($id);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(['case' => $case]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($request->has('is_recovery')) {
            $request->merge(['is_recovery' => filter_var($request->is_recovery, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)]);
        }

        $validated = $request->validate([
            'client_id' => "nullable|exists:clients,id,business_id,{$case->business_id}",
            'client_reference' => 'nullable|string|max:255',
            'opposing_counsel_id' => "nullable|exists:opposing_counsels,id,business_id,{$case->business_id}",
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'case_type' => 'nullable|in:Plaintiff,Defendant',
            'status' => 'nullable|in:Open,In Progress,Closed,On Hold',
            'priority' => 'nullable|in:Low,Medium,High,Urgent',
            'assigned_to' => "nullable|exists:users,id,business_id,{$case->business_id}",
            'our_reference' => 'nullable|string|max:255',
            'case_number' => "nullable|string|max:50|unique:cases,case_number,{$case->id}",
            'court' => 'nullable|string|max:255',
            'court_number_filed' => 'nullable|string|max:255',
            'judge' => 'nullable|string|max:255',
            'is_recovery' => 'nullable|boolean',
            'filed_date' => 'nullable|date',
            'closed_date' => 'nullable|date',
            'outcome' => 'nullable|string',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'Closed' && !$case->closed_date && empty($validated['closed_date'])) {
            $validated['closed_date'] = now();
        }

        $previousAssignee = $case->assigned_to;
        $case->update($validated);

        if (array_key_exists('assigned_to', $validated)
            && $case->assigned_to
            && $case->assigned_to !== $previousAssignee
            && $case->assigned_to !== $request->user()->id
        ) {
            $assignee = User::find($case->assigned_to);
            if ($assignee) {
                $assignee->notify(new CaseAssignedNotification($case, $request->user()));
            }
        }

        return response()->json(['case' => $case->fresh()->load(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'opposingCounsel:id,name,firm'])]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case->delete();

        return response()->json(['message' => 'Case deleted']);
    }

    public function duplicate(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('case.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $original = Cases::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        if (!$user->canViewCase($original->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ref = $original->our_reference;
        if ($ref) {
            $ref = preg_match('/-D\d*$/', $ref) ? preg_replace_callback('/-D(\d*)$/', fn($m) => '-D' . (((int) ($m[1] ?: 1)) + 1), $ref) : $ref . '-D';
        }

        $newCase = $original->replicate(['id', 'case_number', 'created_at', 'updated_at', 'closed_date', 'outcome']);
        $newCase->our_reference = $ref;
        $newCase->status = 'Open';
        $newCase->created_by = $user->id;
        $newCase->save();

        $storage = app(TenantDocumentStorage::class);
        $business = Business::findOrFail($user->business_id);
        $docs = CaseDocument::where('case_id', $original->id)
            ->where('business_id', $user->business_id)
            ->get();

        foreach ($docs as $doc) {
            try {
                $info = $storage->copyDocument($doc, $newCase->id, $business);
                CaseDocument::create([
                    'case_id'         => $newCase->id,
                    'business_id'     => $user->business_id,
                    'original_name'   => $doc->original_name,
                    'file_path'       => $info['file_path'],
                    'disk'            => $info['disk'],
                    'storage_key'     => $info['storage_key'],
                    'kms_key_id'      => $info['kms_key_id'],
                    'etag'            => $info['etag'],
                    'checksum_sha256' => $info['checksum_sha256'],
                    'file_size'       => $info['file_size'],
                    'mime_type'       => $info['mime_type'],
                    'uploaded_by'     => $user->id,
                ]);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'case' => $newCase->load(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'opposingCounsel:id,name,firm']),
        ], 201);
    }

    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:Open,In Progress,Closed,On Hold',
        ]);

        $update = ['status' => $validated['status']];
        if ($validated['status'] === 'Closed' && !$case->closed_date) {
            $update['closed_date'] = now();
        } elseif ($validated['status'] !== 'Closed') {
            $update['closed_date'] = null;
        }
        $case->update($update);

        return response()->json(['case' => $case->fresh()]);
    }
}
