<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ConvertCaseDocumentToPdf;
use App\Models\Business;
use App\Models\CaseDocument;
use App\Models\Cases;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Notifications\TaskAssignedNotification;
use App\Services\TenantDocumentStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaskController extends Controller
{
    private const VALID_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    private const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isOwner()
            && !$user->hasPermissionSafe('task.view_all')
            && !$user->hasPermissionSafe('task.view_own')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Task::with(['assignee:id,first_name,last_name', 'createdBy:id,first_name,last_name', 'case:id,case_number,title'])
            ->where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id);

        // Restrict to own tasks when user only has view_own
        if (!$user->isOwner() && !$user->hasPermissionSafe('task.view_all')) {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)->orWhere('created_by', $user->id);
            });
        }

        if ($status = $request->query('status')) {
            if (in_array($status, self::VALID_STATUSES, true)) {
                $query->where('status', $status);
            }
        }

        if ($priority = $request->query('priority')) {
            if (in_array($priority, self::VALID_PRIORITIES, true)) {
                $query->where('priority', $priority);
            }
        }

        if ($assignee = $request->query('assigned_to')) {
            $query->where('assigned_to', $assignee === 'me' ? $user->id : (int) $assignee);
        }

        if ($caseId = $request->query('case_id')) {
            $query->where('case_id', (int) $caseId);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $tasks = $query->orderByRaw("CASE status WHEN 'In Progress' THEN 1 WHEN 'Pending' THEN 2 WHEN 'Completed' THEN 3 WHEN 'Cancelled' THEN 4 END")
            ->orderByRaw("CASE priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 END")
            ->orderBy('due_date')
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->query('per_page', 25), 500));

        return response()->json([
            'tasks' => $tasks->items(),
            'pagination' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    public function store(Request $request, TenantDocumentStorage $storage): JsonResponse
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->hasPermissionSafe('task.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'nullable|in:Low,Medium,High,Urgent',
            'status' => 'nullable|in:Pending,In Progress,Completed,Cancelled',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'case_id' => 'nullable|integer|exists:cases,id',
            'due_date' => 'nullable|date',
            'documents' => 'nullable|array',
            'documents.*' => 'file|max:65536|mimes:pdf,jpg,jpeg,png,gif,doc,docx,xls,xlsx',
        ]);

        $hasFiles = $request->hasFile('documents');

        if ($hasFiles && empty($validated['case_id'])) {
            return response()->json([
                'message' => 'Attachments require a linked case.',
            ], 422);
        }

        // Verify any referenced case belongs to the same business + active location
        $case = null;
        if (!empty($validated['case_id'])) {
            $case = Cases::where('business_id', $user->business_id)
                ->where('location_id', $user->active_location_id)
                ->find($validated['case_id']);
            if (!$case) {
                return response()->json(['message' => 'Case not found in this branch'], 422);
            }
            if (!$user->canViewCase($case->assigned_to)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        // Verify assignee belongs to the same business
        if (!empty($validated['assigned_to'])) {
            $exists = User::where('id', $validated['assigned_to'])
                ->where('business_id', $user->business_id)
                ->exists();
            if (!$exists) {
                return response()->json(['message' => 'Assignee not found in this firm'], 422);
            }
        }

        $taskData = collect($validated)->except(['documents'])->all();
        $taskData['business_id'] = $user->business_id;
        $taskData['location_id'] = $user->active_location_id;
        $taskData['created_by'] = $user->id;
        $taskData['status'] = $taskData['status'] ?? 'Pending';
        $taskData['priority'] = $taskData['priority'] ?? 'Medium';

        if ($taskData['status'] === 'Completed') {
            $taskData['completed_at'] = now();
            $taskData['completed_by'] = $user->id;
        }

        $task = DB::transaction(function () use ($taskData, $request, $storage, $case, $user, $hasFiles) {
            $task = Task::create($taskData);

            if ($hasFiles && $case) {
                $business = Business::findOrFail($user->business_id);
                $documentIds = [];
                foreach ($request->file('documents') as $file) {
                    $info = $storage->upload($business, $case->id, $file);
                    $safeName = preg_replace('/[\r\n\x00-\x1F\x7F]/', '', basename($file->getClientOriginalName()));
                    $doc = CaseDocument::create([
                        'case_id'         => $case->id,
                        'business_id'     => $user->business_id,
                        'original_name'   => $safeName,
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
                    $documentIds[] = $doc->id;

                    $ext = strtolower($file->getClientOriginalExtension());
                    if ($ext === 'doc' || $ext === 'docx') {
                        ConvertCaseDocumentToPdf::dispatch($doc->id);
                    }
                }
                $task->documents()->sync($documentIds);
            }

            return $task;
        });

        // Notify the assignee (skip self-assignment).
        if ($task->assigned_to && $task->assigned_to !== $user->id) {
            $assignee = User::find($task->assigned_to);
            if ($assignee) {
                $assignee->notify(new TaskAssignedNotification($task, $user));
            }
        }

        return response()->json([
            'task' => $task->load([
                'assignee:id,first_name,last_name',
                'createdBy:id,first_name,last_name',
                'case:id,case_number,title',
                'documents:id,case_id,original_name,file_size,mime_type,created_at',
            ]),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $task = Task::with([
                'assignee:id,first_name,last_name',
                'createdBy:id,first_name,last_name',
                'completedBy:id,first_name,last_name',
                'case:id,case_number,title',
                'documents:id,case_id,original_name,file_size,mime_type,created_at',
                'comments.user:id,first_name,last_name',
            ])
            ->where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        if (!$this->userCanViewTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(['task' => $task]);
    }

    public function comments(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $task = Task::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        if (!$this->userCanViewTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $comments = TaskComment::with('user:id,first_name,last_name')
            ->where('task_id', $task->id)
            ->orderBy('created_at')
            ->get();

        return response()->json(['comments' => $comments]);
    }

    public function storeComment(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $task = Task::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        if (!$this->userCanViewTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'body' => 'required|string|max:5000',
        ]);

        $comment = TaskComment::create([
            'task_id'     => $task->id,
            'business_id' => $user->business_id,
            'user_id'     => $user->id,
            'body'        => $validated['body'],
        ]);

        return response()->json([
            'comment' => $comment->load('user:id,first_name,last_name'),
        ], 201);
    }

    private function userCanViewTask(User $user, Task $task): bool
    {
        if ($user->isOwner() || $user->hasPermissionSafe('task.view_all')) {
            return true;
        }
        if (!$user->hasPermissionSafe('task.view_own')) {
            return false;
        }
        return $task->assigned_to === $user->id || $task->created_by === $user->id;
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->hasPermissionSafe('task.update')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $task = Task::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'sometimes|in:Low,Medium,High,Urgent',
            'status' => 'sometimes|in:Pending,In Progress,Completed,Cancelled',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'case_id' => 'nullable|integer|exists:cases,id',
            'due_date' => 'nullable|date',
        ]);

        if (array_key_exists('case_id', $validated) && !empty($validated['case_id'])) {
            $case = Cases::where('business_id', $user->business_id)
                ->where('location_id', $user->active_location_id)
                ->find($validated['case_id']);
            if (!$case) {
                return response()->json(['message' => 'Case not found in this branch'], 422);
            }
        }

        if (array_key_exists('assigned_to', $validated) && !empty($validated['assigned_to'])) {
            $exists = \App\Models\User::where('id', $validated['assigned_to'])
                ->where('business_id', $user->business_id)
                ->exists();
            if (!$exists) {
                return response()->json(['message' => 'Assignee not found in this firm'], 422);
            }
        }

        // Track completion transition
        if (array_key_exists('status', $validated)) {
            $movingToCompleted = $validated['status'] === 'Completed' && $task->status !== 'Completed';
            $movingFromCompleted = $validated['status'] !== 'Completed' && $task->status === 'Completed';

            if ($movingToCompleted) {
                $validated['completed_at'] = now();
                $validated['completed_by'] = $user->id;
            } elseif ($movingFromCompleted) {
                $validated['completed_at'] = null;
                $validated['completed_by'] = null;
            }
        }

        $previousAssignee = $task->assigned_to;
        $task->update($validated);

        // Notify on assignment change (skip if recipient = actor)
        if (array_key_exists('assigned_to', $validated)
            && $task->assigned_to
            && $task->assigned_to !== $previousAssignee
            && $task->assigned_to !== $user->id
        ) {
            $assignee = User::find($task->assigned_to);
            if ($assignee) {
                $assignee->notify(new TaskAssignedNotification($task, $user));
            }
        }

        return response()->json([
            'task' => $task->fresh(['assignee:id,first_name,last_name', 'createdBy:id,first_name,last_name', 'completedBy:id,first_name,last_name', 'case:id,case_number,title']),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->isOwner() && !$user->hasPermissionSafe('task.delete')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $task = Task::where('business_id', $user->business_id)
            ->where('location_id', $user->active_location_id)
            ->findOrFail($id);

        $task->delete();

        return response()->json(['message' => 'Task deleted']);
    }
}
