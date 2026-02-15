<?php

namespace App\Listeners;

use App\Events\MessageSent;
use App\Services\FirebaseService;
use Illuminate\Contracts\Queue\ShouldQueue;

class PushMessageToFirebase implements ShouldQueue
{
    public function handle(MessageSent $event): void
    {
        $message = $event->message->load(['sender', 'chat.participants']);
        $firebase = app(FirebaseService::class);
        $firebase->pushMessageToRealtime($message);
        $firebase->notifyChatNewMessage($message);
    }
}
