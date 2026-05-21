<?php

namespace App\Notifications;

use App\Models\Cases;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CaseAssignedNotification extends Notification
{
    public function __construct(public Cases $case, public ?User $actor = null)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'case.assigned',
            'case_id' => $this->case->id,
            'case_number' => $this->case->case_number,
            'title' => $this->case->title,
            'actor_id' => $this->actor?->id,
            'actor_name' => $this->actor ? $this->actorName() : null,
            'url' => "/dashboard/cases/{$this->case->id}",
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/') . "/dashboard/cases/{$this->case->id}";
        $caseLabel = $this->case->case_number ? "{$this->case->case_number} — {$this->case->title}" : $this->case->title;

        return (new MailMessage)
            ->subject("New case assigned: {$caseLabel}")
            ->greeting('Hi ' . $notifiable->first_name . ',')
            ->line(($this->actor ? $this->actorName() . ' assigned' : 'You have been assigned') . " a new case: {$caseLabel}.")
            ->action('View Case', $url)
            ->line('You can review the case file, court proceedings, and tasks in Firmly.');
    }

    private function actorName(): string
    {
        return trim(($this->actor->first_name ?? '') . ' ' . ($this->actor->last_name ?? ''));
    }
}
