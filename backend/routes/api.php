<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\BusinessLocationController;
use App\Http\Controllers\Api\CaseController;
use App\Http\Controllers\Api\CaseDocumentController;
use App\Http\Controllers\Api\CaseEmailController;
use App\Http\Controllers\Api\CaseEventController;
use App\Http\Controllers\Api\CourtProceedingController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpposingCounselController;
use App\Http\Controllers\Api\EmailAccountController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ExpenseCategoryController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\TaxRateController;
use App\Http\Controllers\Api\CaseSeriesController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\UserProfileController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->middleware('throttle:5,60');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/currencies', [BusinessController::class, 'currencies']);

// Authenticated routes
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/force-change-password', [AuthController::class, 'forceChangePassword']);

    // User Profile
    Route::get('/profile', [UserProfileController::class, 'show']);
    Route::put('/profile', [UserProfileController::class, 'update']);
    Route::put('/profile/password', [UserProfileController::class, 'updatePassword']);

    // ── Cached: slow-changing data (Redis, scoped per tenant+location) ──

    Route::middleware('cache.tenant:600,business')->group(function () {
        Route::get('/business', [BusinessController::class, 'show']);
        Route::get('/business/date-formats', [BusinessController::class, 'dateFormats']);
    });

    Route::middleware('cache.tenant:600,locations')->group(function () {
        Route::get('/locations', [BusinessLocationController::class, 'index']);
        Route::get('/locations/{location}', [BusinessLocationController::class, 'show']);
    });

    Route::middleware('cache.tenant:600,roles')->group(function () {
        Route::get('/roles', [UserManagementController::class, 'roles']);
        Route::get('/permissions', [UserManagementController::class, 'allPermissions']);
    });

    Route::middleware('cache.tenant:1800,holidays')->group(function () {
        Route::get('/holidays', [HolidayController::class, 'index']);
    });

    // ── Not cached: business settings writes (flush on change) ──

    Route::put('/business', [BusinessController::class, 'update']);

    // ── Not cached: locations writes ──

    Route::post('/locations', [BusinessLocationController::class, 'store']);
    Route::put('/locations/{location}', [BusinessLocationController::class, 'update']);
    Route::delete('/locations/{location}', [BusinessLocationController::class, 'destroy']);
    Route::post('/locations/{id}/toggle-active', [BusinessLocationController::class, 'toggleActive']);
    Route::post('/locations/{id}/set-active', [BusinessLocationController::class, 'setActive']);

    // ── Not cached: frequently changing data ──

    // Clients
    Route::apiResource('clients', ClientController::class);
    Route::post('/clients/{id}/toggle-active', [ClientController::class, 'toggleActive']);

    // Opposing Counsel
    Route::get('/opposing-counsels', [OpposingCounselController::class, 'index']);
    Route::post('/opposing-counsels', [OpposingCounselController::class, 'store']);

    // Case Series
    Route::apiResource('case-series', CaseSeriesController::class);
    Route::post('/case-series/{id}/cases', [CaseSeriesController::class, 'createCase']);
    Route::post('/case-series/{id}/link-case', [CaseSeriesController::class, 'linkCase']);
    Route::delete('/case-series/{id}/cases/{caseId}', [CaseSeriesController::class, 'detachCase']);
    Route::post('/case-series/{id}/bulk-event', [CaseSeriesController::class, 'bulkAddEvent']);
    Route::post('/case-series/{id}/bulk-proceeding', [CaseSeriesController::class, 'bulkAddProceeding']);
    Route::post('/case-series/{id}/bulk-document', [CaseSeriesController::class, 'bulkUploadDocument']);

    // Cases
    Route::apiResource('cases', CaseController::class);
    Route::post('/cases/{id}/duplicate', [CaseController::class, 'duplicate']);
    Route::put('/cases/{id}/status', [CaseController::class, 'toggleStatus']);

    // Case Documents
    Route::get('/cases/{caseId}/documents', [CaseDocumentController::class, 'index']);
    Route::post('/cases/{caseId}/documents', [CaseDocumentController::class, 'store']);
    Route::post('/cases/{caseId}/documents/presign', [CaseDocumentController::class, 'presignUpload']);
    Route::post('/cases/{caseId}/documents/register', [CaseDocumentController::class, 'registerUpload']);
    Route::get('/cases/{caseId}/documents/merge', [CaseDocumentController::class, 'merge']);
    Route::get('/cases/{caseId}/documents/{documentId}/download', [CaseDocumentController::class, 'download']);
    Route::get('/cases/{caseId}/documents/{documentId}/view', [CaseDocumentController::class, 'view']);
    Route::delete('/cases/{caseId}/documents/{documentId}', [CaseDocumentController::class, 'destroy']);

    // Case Events
    Route::get('/events', [CaseEventController::class, 'all']);
    Route::get('/cases/{caseId}/events', [CaseEventController::class, 'index']);
    Route::post('/cases/{caseId}/events', [CaseEventController::class, 'store']);
    Route::put('/cases/{caseId}/events/{eventId}', [CaseEventController::class, 'update']);
    Route::delete('/cases/{caseId}/events/{eventId}', [CaseEventController::class, 'destroy']);

    // Court Proceedings
    Route::get('/cases/{caseId}/proceedings', [CourtProceedingController::class, 'index']);
    Route::post('/cases/{caseId}/proceedings', [CourtProceedingController::class, 'store']);
    Route::put('/cases/{caseId}/proceedings/{proceedingId}', [CourtProceedingController::class, 'update']);
    Route::delete('/cases/{caseId}/proceedings/{proceedingId}', [CourtProceedingController::class, 'destroy']);

    // Expenses
    Route::apiResource('expenses', ExpenseController::class);
    Route::get('/expense-report', [ExpenseController::class, 'report']);
    Route::apiResource('expense-categories', ExpenseCategoryController::class)->except(['show']);
    Route::apiResource('tax-rates', TaxRateController::class)->except(['show']);

    // Tasks
    Route::apiResource('tasks', TaskController::class);
    Route::get('/tasks/{id}/comments', [TaskController::class, 'comments']);
    Route::post('/tasks/{id}/comments', [TaskController::class, 'storeComment']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // User Management
    Route::apiResource('users', UserManagementController::class);
    Route::put('/users/{id}/password', [UserManagementController::class, 'updatePassword']);

    // Roles & Permissions (writes flush cache)
    Route::post('/roles', [UserManagementController::class, 'createRole']);
    Route::put('/roles/{id}', [UserManagementController::class, 'updateRole']);
    Route::delete('/roles/{id}', [UserManagementController::class, 'deleteRole']);

    // Email Integration
    Route::get('/email-account', [EmailAccountController::class, 'show']);
    Route::delete('/email-account', [EmailAccountController::class, 'disconnect']);
    Route::post('/email-account/sync', [EmailAccountController::class, 'syncNow']);
    Route::get('/email-accounts/oauth/{provider}', [EmailAccountController::class, 'oauthRedirect']);

    // Per-business OAuth credentials
    Route::get('/email-accounts/oauth-settings', [EmailAccountController::class, 'getOAuthSettings']);
    Route::put('/email-accounts/oauth-settings/{provider}', [EmailAccountController::class, 'saveOAuthSettings']);
    Route::delete('/email-accounts/oauth-settings/{provider}', [EmailAccountController::class, 'deleteOAuthSettings']);

    // Case Emails
    Route::get('/cases/{caseId}/emails', [CaseEmailController::class, 'index']);
    Route::post('/cases/{caseId}/emails/sync', [CaseEmailController::class, 'syncCase']);
    Route::get('/emails/{emailId}/body', [CaseEmailController::class, 'body']);
    Route::put('/emails/{emailId}/case', [CaseEmailController::class, 'assignCase']);
});

// OAuth callbacks (no auth — user_id is embedded in the state parameter)
Route::get('/email-accounts/oauth/{provider}/callback', [EmailAccountController::class, 'oauthCallback']);
