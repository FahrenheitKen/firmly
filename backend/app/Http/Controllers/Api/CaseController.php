<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Cases;
use App\Models\CaseDocument;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $businessId = $request->user()->business_id;
        $activeLocationId = $request->user()->active_location_id;

        $cases = Cases::where('business_id', $businessId)
            ->where('location_id', $activeLocationId)
            ->with(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'createdBy:id,first_name,last_name', 'opposingCounsel:id,name,firm'])
            ->when($request->client_id, fn($q, $cid) => $q->where('client_id', $cid))
            ->when($request->search, fn($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('title', 'like', "%{$s}%")
                  ->orWhere('case_number', 'like', "%{$s}%")
                  ->orWhere('our_reference', 'like', "%{$s}%")
                  ->orWhere('status', 'like', "%{$s}%");
            }))
            ->orderBy('created_at', 'desc')
            ->paginate(20);

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
            'is_recovery' => 'nullable|boolean',
            'case_type' => 'nullable|in:Plaintiff,Defendant',
            'filed_date' => 'nullable|date',
        ]);

        $validated['business_id'] = $businessId;
        $validated['created_by'] = $request->user()->id;
        $validated['location_id'] = $request->user()->active_location_id;

        if (empty($validated['case_number'])) {
            $business = Business::findOrFail($businessId);
            $refPrefixes = $business->ref_no_prefixes ?? [];
            $format = $refPrefixes['case_number_format'] ?? '{FI}/{CP}/{CT}/{N}/{Y}';

            $firmInitials = $this->getInitials($business->name);

            $clientPrefix = '';
            if (!empty($validated['client_id'])) {
                $client = Client::find($validated['client_id']);
                if ($client) {
                    if ($client->business_name) {
                        $clientPrefix = $client->client_prefix ?: $this->getInitials($client->business_name);
                    } else {
                        $firstInitial = strtoupper(substr($client->first_name ?? '', 0, 1));
                        $lastInitial  = strtoupper(substr($client->last_name  ?? '', 0, 1));
                        $clientPrefix = $client->client_prefix ?: ($firstInitial . $lastInitial);
                    }
                }
            }

            $location = \App\Models\BusinessLocation::find($request->user()->active_location_id);
            $cityAbbrev = $this->getCityAbbreviation($location?->city);

            $business->increment('case_counter');
            $seq = str_pad($business->case_counter, 3, '0', STR_PAD_LEFT);
            $year = now()->format('Y');

            $replacements = [
                '{FI}' => $firmInitials,
                '{BI}' => $businessId,
                '{CP}' => $clientPrefix,
                '{CT}' => $cityAbbrev,
                '{N}' => $seq,
                '{Y}' => $year,
            ];
            $validated['case_number'] = str_replace(array_keys($replacements), array_values($replacements), $format);
        }

        $case = Cases::create($validated);

        if ($request->hasFile('documents')) {
            foreach ($request->file('documents') as $file) {
                $path = $file->store("case-documents/{$case->id}", 'local');
                $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($file->getClientOriginalName()));
                CaseDocument::create([
                    'case_id' => $case->id,
                    'business_id' => $businessId,
                    'original_name' => $safeName,
                    'file_path' => $path,
                    'file_size' => $file->getSize(),
                    'mime_type' => mime_content_type($file->getRealPath()) ?: 'application/octet-stream',
                    'uploaded_by' => $request->user()->id,
                ]);
            }
        }

        return response()->json(['case' => $case->load(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'opposingCounsel:id,name,firm'])], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->with(['client', 'assignedTo', 'createdBy', 'opposingCounsel'])
            ->findOrFail($id);
        return response()->json(['case' => $case]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

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
            'case_number' => "nullable|string|max:50|unique:cases,case_number,{$case->id}",
            'court' => 'nullable|string|max:255',
            'judge' => 'nullable|string|max:255',
            'is_recovery' => 'nullable|boolean',
            'filed_date' => 'nullable|date',
            'closed_date' => 'nullable|date',
            'outcome' => 'nullable|string',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'Closed' && !$case->closed_date && empty($validated['closed_date'])) {
            $validated['closed_date'] = now();
        }

        $case->update($validated);

        return response()->json(['case' => $case->fresh()->load(['client:id,first_name,last_name,business_name,client_prefix', 'assignedTo:id,first_name,last_name', 'opposingCounsel:id,name,firm'])]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        $case->delete();

        return response()->json(['message' => 'Case deleted']);
    }

    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $case = Cases::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

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
