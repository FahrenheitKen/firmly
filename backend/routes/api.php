<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BusinessController;
use App\Http\Controllers\Api\BusinessLocationController;
use App\Http\Controllers\Api\CaseController;
use App\Http\Controllers\Api\CaseDocumentController;
use App\Http\Controllers\Api\CaseEmailController;
use App\Http\Controllers\Api\CaseEventController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\OpposingCounselController;
use App\Http\Controllers\Api\EmailAccountController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\UserProfileController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->middleware('throttle:2,60');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:5,1');
Route::get('/currencies', [BusinessController::class, 'currencies']);

// Authenticated routes
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // User Profile
    Route::get('/profile', [UserProfileController::class, 'show']);
    Route::put('/profile', [UserProfileController::class, 'update']);
    Route::put('/profile/password', [UserProfileController::class, 'updatePassword']);

    // Business Settings
    Route::get('/business', [BusinessController::class, 'show']);
    Route::put('/business', [BusinessController::class, 'update']);
    Route::get('/business/date-formats', [BusinessController::class, 'dateFormats']);

    // Business Locations
    Route::apiResource('locations', BusinessLocationController::class);
    Route::post('/locations/{id}/toggle-active', [BusinessLocationController::class, 'toggleActive']);
    Route::post('/locations/{id}/set-active', [BusinessLocationController::class, 'setActive']);

    // Clients
    Route::apiResource('clients', ClientController::class);
    Route::post('/clients/{id}/toggle-active', [ClientController::class, 'toggleActive']);

    // Opposing Counsel
    Route::get('/opposing-counsels', [OpposingCounselController::class, 'index']);
    Route::post('/opposing-counsels', [OpposingCounselController::class, 'store']);

    // Cases
    Route::apiResource('cases', CaseController::class);
    Route::put('/cases/{id}/status', [CaseController::class, 'toggleStatus']);

    // Case Documents
    Route::get('/cases/{caseId}/documents', [CaseDocumentController::class, 'index']);
    Route::post('/cases/{caseId}/documents', [CaseDocumentController::class, 'store']);
    Route::get('/cases/{caseId}/documents/merge', [CaseDocumentController::class, 'merge']);
    Route::get('/cases/{caseId}/documents/{documentId}/download', [CaseDocumentController::class, 'download']);
    Route::get('/cases/{caseId}/documents/{documentId}/view', [CaseDocumentController::class, 'view']);
    Route::delete('/cases/{caseId}/documents/{documentId}', [CaseDocumentController::class, 'destroy']);

    // Case Events
    Route::get('/cases/{caseId}/events', [CaseEventController::class, 'index']);
    Route::post('/cases/{caseId}/events', [CaseEventController::class, 'store']);

    // User Management
    Route::apiResource('users', UserManagementController::class);
    Route::put('/users/{id}/password', [UserManagementController::class, 'updatePassword']);

    // Roles & Permissions
    Route::get('/roles', [UserManagementController::class, 'roles']);
    Route::post('/roles', [UserManagementController::class, 'createRole']);
    Route::put('/roles/{id}', [UserManagementController::class, 'updateRole']);
    Route::delete('/roles/{id}', [UserManagementController::class, 'deleteRole']);
    Route::get('/permissions', [UserManagementController::class, 'allPermissions']);

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
