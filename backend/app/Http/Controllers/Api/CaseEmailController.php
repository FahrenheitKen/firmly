<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SyncUserEmailsJob;
use App\Models\Business;
use App\Models\CaseEmail;
use App\Models\Cases;
use App\Services\Email\ZohoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CaseEmailController extends Controller
{
    /**
     * GET /cases/{caseId}/emails
     * List all emails linked to a case, ordered by sent_at descending.
     */
    public function index(Request $request, int $caseId): JsonResponse
    {
        $businessId = $request->user()->business_id;

        $case = Cases::where('id', $caseId)
            ->where('business_id', $businessId)
            ->firstOrFail();

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $emails = CaseEmail::with('emailAccount')
            ->where('case_id', $case->id)
            ->where('business_id', $businessId)
            ->orderByDesc('sent_at')
            ->limit(200)
            ->get()
            ->map(fn($email) => [
                'id' => $email->id,
                'message_id' => $email->message_id,
                'thread_id' => $email->thread_id,
                'direction' => $email->direction,
                'from_address' => $email->from_address,
                'to_addresses' => $email->to_addresses,
                'cc_addresses' => $email->cc_addresses,
                'subject' => $email->subject,
                'snippet' => $email->snippet,
                'has_attachments' => $email->has_attachments,
                'attachment_names' => $email->attachment_names,
                'sent_at' => $email->sent_at?->toIso8601String(),
                'provider_url' => $email->provider_url,
                'created_at' => $email->created_at->toIso8601String(),
                'email_account' => $email->emailAccount
                    ? ['provider' => $email->emailAccount->provider]
                    : null,
            ]);

        return response()->json(['data' => $emails]);
    }

    /**
     * PUT /emails/{emailId}/case
     * Manually assign an email to a case (or unassign with case_id: null).
     */
    public function assignCase(Request $request, int $emailId): JsonResponse
    {
        if (!$request->user()->isOwner() && !$request->user()->hasPermissionSafe('case.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $businessId = $request->user()->business_id;

        $validated = $request->validate([
            'case_id' => ['nullable', 'integer', 'exists:cases,id'],
        ]);

        $email = CaseEmail::where('id', $emailId)
            ->where('business_id', $businessId)
            ->firstOrFail();

        // If the email is already linked to a case, the caller must be able
        // to see that case — otherwise a view_own user could pull emails away
        // from cases they have no business touching.
        if ($email->case_id) {
            $sourceCase = Cases::where('id', $email->case_id)
                ->where('business_id', $businessId)
                ->first();
            if ($sourceCase && !$request->user()->canViewCase($sourceCase->assigned_to)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        // If a case_id is provided, ensure it belongs to the same business
        // and the user can see that case.
        if (!empty($validated['case_id'])) {
            $targetCase = Cases::where('id', $validated['case_id'])
                ->where('business_id', $businessId)
                ->firstOrFail();
            if (!$request->user()->canViewCase($targetCase->assigned_to)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $email->update(['case_id' => $validated['case_id']]);

        return response()->json([
            'message' => 'Email assignment updated.',
            'data' => [
                'id' => $email->id,
                'case_id' => $email->case_id,
            ],
        ]);
    }

    /**
     * GET /emails/{emailId}/body
     * Fetch the full body (and thread) of an email from the provider.
     */
    public function body(Request $request, int $emailId): JsonResponse
    {
        $businessId = $request->user()->business_id;

        $email = CaseEmail::with('emailAccount.user')
            ->where('id', $emailId)
            ->where('business_id', $businessId)
            ->firstOrFail();

        if ($email->case_id) {
            $linkedCase = Cases::where('id', $email->case_id)
                ->where('business_id', $businessId)
                ->first();
            if ($linkedCase && !$request->user()->canViewCase($linkedCase->assigned_to)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        } elseif (!$request->user()->canViewAnyCase()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $account = $email->emailAccount;
        if (!$account) {
            return response()->json(['error' => 'Email account not found.'], 404);
        }

        if ($account->provider !== 'zoho') {
            return response()->json(['error' => 'Full body fetch is only supported for Zoho accounts currently.'], 422);
        }

        // Apply per-business OAuth credentials for token refresh
        $business = Business::find($businessId);
        $settings = $business?->email_settings ?? [];
        $clientId     = $settings['zoho_client_id']     ?? null;
        $clientSecret = $settings['zoho_client_secret'] ?? null;
        $redirectUri  = $settings['zoho_redirect_uri']  ?? null;

        $zoho = app(ZohoService::class);
        if ($clientId && $clientSecret && $redirectUri) {
            $zoho->withCredentials($clientId, $clientSecret, $redirectUri);
        }

        $body = $zoho->fetchEmailBody($account, $email->message_id, $email->provider_folder_id ?? null);

        // Build thread from sibling messages already in our DB (same thread_id)
        $thread = [];
        if ($email->thread_id) {
            $siblings = CaseEmail::where('thread_id', $email->thread_id)
                ->where('business_id', $businessId)
                ->orderBy('sent_at')
                ->get();

            foreach ($siblings as $sibling) {
                $siblingBody = $zoho->fetchEmailBody(
                    $sibling->emailAccount ?? $account,
                    $sibling->message_id,
                    $sibling->provider_folder_id ?? null,
                );
                $thread[] = [
                    'message_id'   => $sibling->message_id,
                    'from_address' => $sibling->from_address,
                    'to_addresses' => $sibling->to_addresses,
                    'subject'      => $sibling->subject,
                    'sent_at'      => $sibling->sent_at?->toIso8601String(),
                    'html'         => $siblingBody['html'],
                    'text'         => $siblingBody['text'],
                ];
            }
        }

        return response()->json([
            'data' => [
                'html'   => $body['html'],
                'text'   => $body['text'],
                'thread' => $thread,
            ],
        ]);
    }

    /**
     * POST /cases/{caseId}/emails/sync
     * Dispatch a sync job for the authenticated user (convenience endpoint).
     */
    public function syncCase(Request $request, int $caseId): JsonResponse
    {
        $businessId = $request->user()->business_id;

        // Verify the case belongs to this business
        $case = Cases::where('id', $caseId)
            ->where('business_id', $businessId)
            ->firstOrFail();

        if (!$request->user()->canViewCase($case->assigned_to)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        SyncUserEmailsJob::dispatch($request->user()->id);

        return response()->json(['message' => 'Email sync queued.']);
    }
}
