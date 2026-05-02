<?php

namespace App\Support;

use App\Models\SupportMessage;
use App\Models\User;
use App\Services\FirebaseService;
use App\Services\NotificationService;

class SupportAdminNotifier
{
    public static function notify(SupportMessage $message): void
    {
        $notificationService = app(NotificationService::class);
        $firebase = app(FirebaseService::class);
        $adminIds = User::where('type', 'admin')->pluck('id')->toArray();

        $subjectLabel = $message->subject ?: 'رسالة دعم';
        $title = 'رسالة دعم جديدة';
        $preview = mb_strlen($message->message) > 140
            ? mb_substr($message->message, 0, 140).'…'
            : $message->message;
        $body = "{$subjectLabel} — {$message->name}: {$preview}";

        $payload = [
            'type' => 'support_message',
            'admin_nav' => 'support',
            'support_message_id' => (string) $message->id,
        ];

        foreach ($adminIds as $adminId) {
            $notificationService->sendToUser($adminId, $title, $body, $payload);
        }

        $firebase->pushAdminPendingReview($title, $body, $payload);
    }
}
