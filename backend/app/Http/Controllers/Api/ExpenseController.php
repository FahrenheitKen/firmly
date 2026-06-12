<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Business;
use App\Models\TaxRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    use \App\Traits\LogsActivity;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isOwner()
            && !$user->hasPermissionSafe('expense.view_all')
            && !$user->hasPermissionSafe('expense.view_own')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Expense::with([
                'category:id,name',
                'subCategory:id,name',
                'case:id,our_reference,title',
                'client:id,first_name,last_name,business_name',
                'createdBy:id,first_name,last_name',
                'expenseForUser:id,first_name,last_name',
                'tax:id,name,amount',
            ])
            ->where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id);

        if (!$user->isOwner() && !$user->hasPermissionSafe('expense.view_all')) {
            $query->where('created_by', $user->id);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('expense_number', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->query('category_id')) {
            $query->where('expense_category_id', $categoryId);
        }

        if ($caseId = $request->query('case_id')) {
            $query->where('case_id', $caseId);
        }

        if ($paymentStatus = $request->query('payment_status')) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('expense_date', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('expense_date', '<=', $dateTo);
        }

        $expenses = $query->orderBy('expense_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 25), 500));

        return response()->json([
            'expenses' => $expenses->items(),
            'pagination' => [
                'current_page' => $expenses->currentPage(),
                'last_page' => $expenses->lastPage(),
                'per_page' => $expenses->perPage(),
                'total' => $expenses->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('expense.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $user->business_id;

        $validated = $request->validate([
            'expense_category_id' => "nullable|exists:expense_categories,id,business_id,{$businessId}",
            'expense_sub_category_id' => 'nullable|exists:expense_categories,id',
            'case_id' => "nullable|exists:cases,id,business_id,{$businessId}",
            'client_id' => "nullable|exists:clients,id,business_id,{$businessId}",
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'required|date',
            'payment_status' => 'nullable|in:due,paid,partial',
            'payment_method' => 'nullable|string|max:50',
            'tax_id' => "nullable|exists:tax_rates,id,business_id,{$businessId}",
            'is_billable' => 'nullable|boolean',
            'description' => 'nullable|string',
            'expense_for' => 'nullable|string|max:255',
            'expense_for_user_id' => "nullable|exists:users,id,business_id,{$businessId}",
            'document' => 'nullable|file|max:65536',
            'is_recurring' => 'nullable|boolean',
            'recur_interval' => 'nullable|integer|min:1',
            'recur_interval_type' => 'nullable|in:days,months,years',
            'recur_repetitions' => 'nullable|integer|min:1',
            'recur_repeat_on' => 'nullable|integer|min:1|max:30',
        ]);

        $validated['business_id'] = $businessId;
        $validated['location_id'] = $user->active_location_id;
        $validated['created_by'] = $user->id;
        $validated['is_billable'] = filter_var($request->is_billable, FILTER_VALIDATE_BOOLEAN);
        $validated['is_recurring'] = filter_var($request->is_recurring, FILTER_VALIDATE_BOOLEAN);
        $validated['payment_status'] = $validated['payment_status'] ?? 'due';

        $this->calculateTax($validated);

        $business = Business::find($businessId);
        $counter = ($business->expense_counter ?? 0) + 1;
        $validated['expense_number'] = 'EXP-' . str_pad($counter, 4, '0', STR_PAD_LEFT);
        $business->update(['expense_counter' => $counter]);

        if ($request->hasFile('document')) {
            $validated['document'] = $request->file('document')->store("expenses/{$businessId}", 'local');
        }

        unset($validated['document_file']);

        $expense = Expense::create($validated);

        $this->logActivity($request, 'created', 'expense', $expense->id, $expense->expense_number);

        return response()->json([
            'expense' => $expense->load([
                'category:id,name',
                'subCategory:id,name',
                'case:id,our_reference,title',
                'client:id,first_name,last_name,business_name',
                'createdBy:id,first_name,last_name',
                'expenseForUser:id,first_name,last_name',
                'tax:id,name,amount',
            ]),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $expense = Expense::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->with([
                'category:id,name',
                'subCategory:id,name',
                'case:id,our_reference,title',
                'client:id,first_name,last_name,business_name',
                'createdBy:id,first_name,last_name',
                'approvedBy:id,first_name,last_name',
            ])
            ->findOrFail($id);

        return response()->json(['expense' => $expense]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $isStatusChange = $request->has('status') && count($request->all()) <= 2;
        if ($isStatusChange) {
            if (!$user->isOwner() && !$user->hasPermissionSafe('expense.approve')) {
                return response()->json(['message' => 'Unauthorized — approve permission required'], 403);
            }
        } elseif (!$user->isOwner() && !$user->hasPermissionSafe('expense.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $expense = Expense::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);
        $businessId = $user->business_id;

        $validated = $request->validate([
            'expense_category_id' => "nullable|exists:expense_categories,id,business_id,{$businessId}",
            'expense_sub_category_id' => 'nullable|exists:expense_categories,id',
            'case_id' => "nullable|exists:cases,id,business_id,{$businessId}",
            'client_id' => "nullable|exists:clients,id,business_id,{$businessId}",
            'amount' => 'sometimes|required|numeric|min:0.01',
            'expense_date' => 'sometimes|required|date',
            'payment_status' => 'nullable|in:due,paid,partial',
            'payment_method' => 'nullable|string|max:50',
            'tax_id' => "nullable|exists:tax_rates,id,business_id,{$businessId}",
            'is_billable' => 'nullable|boolean',
            'description' => 'nullable|string',
            'expense_for' => 'nullable|string|max:255',
            'expense_for_user_id' => "nullable|exists:users,id,business_id,{$businessId}",
            'status' => 'nullable|in:pending,approved,rejected',
            'rejection_reason' => 'nullable|string',
            'is_recurring' => 'nullable|boolean',
            'recur_interval' => 'nullable|integer|min:1',
            'recur_interval_type' => 'nullable|in:days,months,years',
            'recur_repetitions' => 'nullable|integer|min:1',
            'recur_repeat_on' => 'nullable|integer|min:1|max:30',
        ]);

        if (isset($validated['is_billable'])) {
            $validated['is_billable'] = filter_var($validated['is_billable'], FILTER_VALIDATE_BOOLEAN);
        }
        if (isset($validated['is_recurring'])) {
            $validated['is_recurring'] = filter_var($validated['is_recurring'], FILTER_VALIDATE_BOOLEAN);
        }

        $this->calculateTax($validated, $expense);

        if (isset($validated['status']) && $validated['status'] === 'approved' && $expense->status !== 'approved') {
            $validated['approved_by'] = $user->id;
            $validated['approved_at'] = now();
            $validated['rejected_at'] = null;
            $validated['rejection_reason'] = null;
        }

        if (isset($validated['status']) && $validated['status'] === 'rejected' && $expense->status !== 'rejected') {
            $validated['rejected_at'] = now();
            $validated['approved_by'] = null;
            $validated['approved_at'] = null;
        }

        $expense->update($validated);

        $this->logActivity($request, 'updated', 'expense', $expense->id, $expense->expense_number);

        return response()->json([
            'expense' => $expense->fresh()->load([
                'category:id,name',
                'subCategory:id,name',
                'case:id,our_reference,title',
                'client:id,first_name,last_name,business_name',
                'createdBy:id,first_name,last_name',
                'expenseForUser:id,first_name,last_name',
                'tax:id,name,amount',
            ]),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('expense.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $expense = Expense::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $label = $expense->expense_number;
        $expense->delete();

        $this->logActivity($request, 'deleted', 'expense', $id, $label);

        return response()->json(['message' => 'Deleted']);
    }

    public function report(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isOwner() && !$user->hasPermissionSafe('expense_report.view')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Expense::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id);

        if ($categoryId = $request->query('category_id')) {
            $query->where('expense_category_id', $categoryId);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('expense_date', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('expense_date', '<=', $dateTo);
        }

        $byCategory = (clone $query)
            ->selectRaw('expense_category_id, SUM(amount) as total')
            ->groupBy('expense_category_id')
            ->with('category:id,name')
            ->get();

        $byCase = (clone $query)
            ->whereNotNull('case_id')
            ->selectRaw('case_id, SUM(amount) as total')
            ->groupBy('case_id')
            ->with('case:id,our_reference,title')
            ->get();

        $totals = [
            'total' => (clone $query)->sum('amount'),
            'billable' => (clone $query)->where('is_billable', true)->sum('amount'),
            'non_billable' => (clone $query)->where('is_billable', false)->sum('amount'),
            'paid' => (clone $query)->where('payment_status', 'paid')->sum('amount'),
            'due' => (clone $query)->whereIn('payment_status', ['due', 'partial'])->sum('amount'),
        ];

        return response()->json([
            'by_category' => $byCategory,
            'by_case' => $byCase,
            'totals' => $totals,
        ]);
    }

    private function calculateTax(array &$data, ?Expense $existing = null): void
    {
        $amount = $data['amount'] ?? $existing?->amount ?? 0;
        $taxId = array_key_exists('tax_id', $data) ? $data['tax_id'] : $existing?->tax_id;

        if (!empty($taxId)) {
            $tax = TaxRate::find($taxId);
            if ($tax) {
                $data['total_before_tax'] = round(($amount * 100) / (100 + $tax->amount), 2);
                $data['tax_amount'] = round($amount - $data['total_before_tax'], 2);
                return;
            }
        }

        $data['total_before_tax'] = $amount;
        $data['tax_amount'] = 0;
        if (array_key_exists('tax_id', $data) && empty($data['tax_id'])) {
            $data['tax_id'] = null;
        }
    }
}
