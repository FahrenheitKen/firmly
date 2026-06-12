<?php

namespace App\Notifications;

use App\Models\Cases;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CaseCollaboratorAddedNotification extends Notification
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
            'type' => 'case.collaborator_added',
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
        $url = rtrim(config('app.frontend_url'), '/') . "/dashboard/cases/{$this->case->id}";
        $caseLabel = $this->case->case_number ? "{$this->case->case_number} — {$this->case->title}" : $this->case->title;

        return (new MailMessage)
            ->subject("You've been added as collaborator: {$caseLabel}")
            ->greeting('Hi ' . $notifiable->first_name . ',')
            ->line(($this->actor ? $this->actorName() . ' added you as a collaborator' : 'You have been added as a collaborator') . " on case: {$caseLabel}.")
            ->action('View Case', $url)
            ->line('You now have access to the case file, documents, court proceedings, and tasks in Firmly.');
    }

    private function actorName(): string
    {
        return trim(($this->actor->first_name ?? '') . ' ' . ($this->actor->last_name ?? ''));
    }
}
