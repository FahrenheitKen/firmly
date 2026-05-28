<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = ExpenseCategory::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->with('subCategories:id,parent_id,name,code')
            ->onlyParents()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json(['categories' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'parent_id' => 'nullable|exists:expense_categories,id',
        ]);

        $validated['business_id'] = $request->user()->business_id;
        $validated['location_id'] = $request->user()->active_location_id;

        $category = ExpenseCategory::create($validated);

        return response()->json(['category' => $category->load('subCategories:id,parent_id,name,code')], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $category = ExpenseCategory::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
        ]);

        $category->update($validated);

        return response()->json(['category' => $category->fresh()->load('subCategories:id,parent_id,name,code')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('business_settings.access')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $category = ExpenseCategory::where('business_id', $request->user()->business_id)
            ->where('location_id', $request->user()->active_location_id)
            ->findOrFail($id);
        $category->subCategories()->delete();
        $category->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
