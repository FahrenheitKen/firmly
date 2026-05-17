<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->load('business')]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'surname' => 'nullable|string|max:10',
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'email' => 'nullable|email|unique:users,email,' . $user->id,
            'current_password' => 'required_with:email|string',
            'language' => 'nullable|string|max:7',
            'dob' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'marital_status' => 'nullable|in:married,unmarried,divorced',
            'blood_group' => 'nullable|string|max:10',
            'contact_no' => 'nullable|string|max:20',
            'alt_number' => 'nullable|string',
            'family_number' => 'nullable|string',
            'fb_link' => 'nullable|string|url',
            'twitter_link' => 'nullable|string|url',
            'social_media_1' => 'nullable|string|url',
            'social_media_2' => 'nullable|string|url',
            'permanent_address' => 'nullable|string',
            'current_address' => 'nullable|string',
            'guardian_name' => 'nullable|string',
            'id_proof_name' => 'nullable|string',
            'id_proof_number' => 'nullable|string',
            'bank_details' => 'nullable|array',
            'custom_field_1' => 'nullable|string',
            'custom_field_2' => 'nullable|string',
            'custom_field_3' => 'nullable|string',
            'custom_field_4' => 'nullable|string',
        ]);

        if (array_key_exists('email', $validated) && $validated['email'] !== null && $validated['email'] !== $user->email) {
            if (!Hash::check($request->current_password ?? '', $user->password)) {
                return response()->json(['message' => 'Current password is required to change email.'], 422);
            }
        }

        unset($validated['current_password']);
        $user->update($validated);

        return response()->json(['user' => $user->fresh()]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->update(['password' => $request->password]);

        return response()->json(['message' => 'Password updated successfully']);
    }
}
