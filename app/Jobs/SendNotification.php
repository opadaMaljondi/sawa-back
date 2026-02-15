<?php

namespace App\Jobs;

use App\Services\FirebaseService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param int[] $userIds User IDs to send FCM notification to (their devices' fcm_token will be used)
     * @param array<string, string> $data Optional data payload (values must be strings for FCM)
     */
    public function __construct(
        public string $title,
        public string $body,
        public array $userIds = [],
        public array $data = []
    ) {}

    public function handle(FirebaseService $firebase): void
    {
        if (empty($this->userIds)) {
            return;
        }
        $firebase->sendNotificationToUsers($this->userIds, $this->title, $this->body, $this->data);
    }
}
