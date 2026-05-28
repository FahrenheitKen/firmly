<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeUserNotification extends Notification
{
    public function __construct(
        public string $temporaryPassword,
        public string $businessName,
    ) {}

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $loginUrl = rtrim(config('app.frontend_url'), '/') . '/login';

        return (new MailMessage)
            ->subject("Welcome to {$this->businessName} on Firmly")
            ->greeting('Hi ' . $notifiable->first_name . ',')
            ->line("Your account has been created on Firmly for **{$this->businessName}**.")
            ->line('Use the credentials below to sign in:')
            ->line("**Email:** {$notifiable->email}")
            ->line("**Temporary Password:** {$this->temporaryPassword}")
            ->action('Sign In to Firmly', $loginUrl)
            ->line('You will be prompted to set a new password on your first login.')
            ->line('If you did not expect this invitation, please ignore this email.');
    }
}
