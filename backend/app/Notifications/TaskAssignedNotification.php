<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskAssignedNotification extends Notification
{
    public function __construct(public Task $task, public ?User $actor = null)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'task.assigned',
            'task_id' => $this->task->id,
            'title' => $this->task->title,
            'case_id' => $this->task->case_id,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor ? $this->actorName() : null,
            'url' => '/dashboard/tasks',
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/') . '/dashboard/tasks';
        $msg = (new MailMessage)
            ->subject("New task assigned: {$this->task->title}")
            ->greeting('Hi ' . $notifiable->first_name . ',')
            ->line(($this->actor ? $this->actorName() . ' assigned' : 'You have been assigned') . " a new task: {$this->task->title}");

        if ($this->task->description) {
            $msg->line($this->task->description);
        }

        return $msg->action('View Task', $url)
            ->line('You can review and update the task in Firmly.');
    }

    private function actorName(): string
    {
        return trim(($this->actor->first_name ?? '') . ' ' . ($this->actor->last_name ?? ''));
    }
}
