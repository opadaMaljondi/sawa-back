<?php

namespace App\Services;

use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Database;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

class FirebaseService
{
    protected ?Messaging $messaging = null;
    protected ?Database $database = null;

    public function isConfigured(): bool
    {
        $credentials = config('firebase.credentials');
        return !empty($credentials) && file_exists($credentials);
    }

    public function isRealtimeEnabled(): bool
    {
        return config('firebase.realtime_chat_enabled', true) && $this->getDatabase() !== null;
    }

    public function isFcmEnabled(): bool
    {
        return config('firebase.fcm_enabled', true) && $this->getMessaging() !== null;
    }

    protected function getFactory(): ?Factory
    {
        if (!$this->isConfigured()) {
            return null;
        }
        $credentials = config('firebase.credentials');
        $factory = (new Factory)->withServiceAccount($credentials);
        $databaseUrl = config('firebase.database_url');
        if (!empty($databaseUrl)) {
            $factory = $factory->withDatabaseUri($databaseUrl);
        }
        return $factory;
    }

    public function getMessaging(): ?Messaging
    {
        if ($this->messaging !== null) {
            return $this->messaging;
        }
        try {
            $factory = $this->getFactory();
            if (!$factory) {
                return null;
            }
            $this->messaging = $factory->createMessaging();
            return $this->messaging;
        } catch (\Throwable $e) {
            Log::warning('Firebase Messaging init failed: ' . $e->getMessage());
            return null;
        }
    }

    public function getDatabase(): ?Database
    {
        if ($this->database !== null) {
            return $this->database;
        }
        try {
            $factory = $this->getFactory();
            if (!$factory || !config('firebase.database_url')) {
                return null;
            }
            $this->database = $factory->createDatabase();
            return $this->database;
        } catch (\Throwable $e) {
            Log::warning('Firebase Database init failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Push a new message to Firebase Realtime Database so clients can listen in real-time.
     */
    public function pushMessageToRealtime(Message $message): void
    {
        if (!$this->isRealtimeEnabled()) {
            return;
        }
        try {
            $db = $this->getDatabase();
            if (!$db) {
                return;
            }
            $prefix = config('firebase.realtime_prefix', 'sawa');
            $path = sprintf('%s/chats/%s/messages/%s', $prefix, $message->chat_id, $message->id);
            $payload = [
                'id' => $message->id,
                'chat_id' => $message->chat_id,
                'sender_id' => $message->sender_id,
                'sender_name' => $message->sender?->full_name ?? '',
                'content' => $message->content,
                'type' => $message->type,
                'sent_at' => $message->sent_at?->toIso8601String() ?? now()->toIso8601String(),
                'created_at' => $message->created_at->toIso8601String(),
            ];
            $db->getReference($path)->set($payload);
        } catch (\Throwable $e) {
            Log::warning('Firebase Realtime push failed: ' . $e->getMessage());
        }
    }

    /**
     * Send FCM notification to user's devices (by FCM tokens).
     *
     * @param int[] $userIds User IDs to notify (will collect FCM tokens from devices table)
     * @param array{title: string, body: string, data?: array} $notification
     */
    public function sendNotificationToUsers(array $userIds, string $title, string $body, array $data = []): void
    {
        if (!$this->isFcmEnabled()) {
            return;
        }
        $tokens = \App\Models\Device::whereIn('user_id', $userIds)
            ->where('active', true)
            ->whereNotNull('fcm_token')
            ->pluck('fcm_token')
            ->unique()
            ->filter()
            ->values()
            ->all();

        if (empty($tokens)) {
            return;
        }

        try {
            $messaging = $this->getMessaging();
            if (!$messaging) {
                return;
            }
            $notification = Notification::create($title, $body);
            $message = CloudMessage::new()
                ->withNotification($notification)
                ->withDefaultSounds();

            if (!empty($data)) {
                $stringData = array_map(fn ($v) => (string) $v, $data);
                $message = $message->withData($stringData);
            }

            $report = $messaging->sendMulticast($message, $tokens);
            if ($report->failures()->count() > 0) {
                Log::debug('FCM multicast had failures: ' . $report->failures()->count());
            }
        } catch (\Throwable $e) {
            Log::warning('FCM send failed: ' . $e->getMessage());
        }
    }

    /**
     * Notify chat participants (except sender) about a new message.
     */
    public function notifyChatNewMessage(Message $message): void
    {
        $participantUserIds = $message->chat->participants()
            ->where('user_id', '!=', $message->sender_id)
            ->pluck('user_id')
            ->all();

        if (empty($participantUserIds)) {
            return;
        }

        $message->load('sender');
        $senderName = $message->sender?->full_name ?? 'Someone';
        $title = 'New message';
        $body = $senderName . ': ' . \Str::limit($message->content, 80);
        $data = [
            'type' => 'chat_message',
            'chat_id' => (string) $message->chat_id,
            'message_id' => (string) $message->id,
        ];

        $this->sendNotificationToUsers($participantUserIds, $title, $body, $data);
    }
}
