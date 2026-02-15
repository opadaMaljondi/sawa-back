<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\YouTube;
use Illuminate\Support\Facades\Log;

class YouTubeService
{
    protected ?YouTube $youtube = null;

    /** Last error message when upload/update/delete fails */
    protected ?string $lastError = null;

    public const PLAYBACK_URL_PREFIX = 'https://www.youtube.com/watch?v=';

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    /**
     * Get full playback URL from video ID.
     */
    public static function playbackUrl(string $videoId): string
    {
        return self::PLAYBACK_URL_PREFIX . self::extractVideoId($videoId);
    }

    /**
     * Extract YouTube video ID from full URL or return as-is if already an ID.
     */
    public static function extractVideoId(string $videoReference): string
    {
        if (str_contains($videoReference, 'youtube.com/watch?v=')) {
            parse_str(parse_url($videoReference, PHP_URL_QUERY) ?? '', $q);
            return (string) ($q['v'] ?? $videoReference);
        }
        if (str_contains($videoReference, 'youtu.be/')) {
            return (string) trim(parse_url($videoReference, PHP_URL_PATH), '/');
        }
        return $videoReference;
    }

    protected function getClient(): GoogleClient
    {
        $client = new GoogleClient();
        $client->setClientId(config('youtube.client_id'));
        $client->setClientSecret(config('youtube.client_secret'));
        $client->setRedirectUri(config('youtube.redirect_uri'));
        $client->setScopes(config('youtube.scopes'));
        $client->setAccessType('offline');
        $client->setPrompt('consent');
        return $client;
    }

    /**
     * Upload video to YouTube. Requires valid OAuth token to be set.
     * @param array{title: string, description?: string, privacy_status?: string} $options
     */
    public function uploadVideo(string $localPath, array $options = []): ?string
    {
        try {
            $client = $this->getClient();
            $tokenPath = storage_path('app/youtube-token.json');
            if (!file_exists($tokenPath)) {
                $this->lastError = 'YouTube OAuth token not found. Save a valid token to storage/app/youtube-token.json or use local storage.';
                Log::warning($this->lastError);
                return null;
            }
            $client->setAccessToken(json_decode(file_get_contents($tokenPath), true));
            if ($client->isAccessTokenExpired()) {
                if ($client->getRefreshToken()) {
                    $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                    file_put_contents($tokenPath, json_encode($client->getAccessToken()));
                } else {
                    $this->lastError = 'YouTube access token expired and no refresh token.';
                    Log::warning($this->lastError);
                    return null;
                }
            }

            $youtube = new YouTube($client);
            $snippet = new \Google\Service\YouTube\VideoSnippet();
            $snippet->setTitle($options['title'] ?? 'Video');
            $snippet->setDescription($options['description'] ?? '');
            $snippet->setCategoryId(config('youtube.upload_settings.category_id', '27'));

            $status = new \Google\Service\YouTube\VideoStatus();
            $status->setPrivacyStatus($options['privacy_status'] ?? config('youtube.upload_settings.privacy_status', 'unlisted'));

            $video = new \Google\Service\YouTube\Video();
            $video->setSnippet($snippet);
            $video->setStatus($status);

            $response = $youtube->videos->insert('snippet,status', $video, [
                'data' => file_get_contents($localPath),
                'mimeType' => 'video/mp4',
                'uploadType' => 'media',
            ]);

            $this->lastError = null;
            return self::playbackUrl($response->getId());
        } catch (\Throwable $e) {
            $this->lastError = $e->getMessage();
            Log::error('YouTube upload failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Update video metadata on YouTube.
     * @param array{title?: string, description?: string} $options
     */
    public function updateVideo(string $videoId, array $options = []): bool
    {
        try {
            $client = $this->getClient();
            $tokenPath = storage_path('app/youtube-token.json');
            if (!file_exists($tokenPath)) {
                return false;
            }
            $client->setAccessToken(json_decode(file_get_contents($tokenPath), true));
            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                file_put_contents($tokenPath, json_encode($client->getAccessToken()));
            }

            $youtube = new YouTube($client);
            $id = self::extractVideoId($videoId);
            $video = $youtube->videos->listVideo('snippet,status', ['id' => $id])->getItems()[0] ?? null;
            if (!$video) {
                return false;
            }
            if (!empty($options['title'])) {
                $video->getSnippet()->setTitle($options['title']);
            }
            if (!empty($options['description'])) {
                $video->getSnippet()->setDescription($options['description']);
            }
            $youtube->videos->update('snippet,status', $video);
            return true;
        } catch (\Throwable $e) {
            Log::error('YouTube update failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete video from YouTube.
     */
    public function deleteVideo(string $videoId): bool
    {
        try {
            $client = $this->getClient();
            $tokenPath = storage_path('app/youtube-token.json');
            if (!file_exists($tokenPath)) {
                return false;
            }
            $client->setAccessToken(json_decode(file_get_contents($tokenPath), true));
            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
            }
            $youtube = new YouTube($client);
            $youtube->videos->delete(self::extractVideoId($videoId));
            return true;
        } catch (\Throwable $e) {
            Log::error('YouTube delete failed: ' . $e->getMessage());
            return false;
        }
    }
}
