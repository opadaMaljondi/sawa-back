<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Http\MediaFileUpload;
use Google\Service\YouTube;
use Google\Service\YouTube\Video;
use Google\Service\YouTube\VideoSnippet;
use Google\Service\YouTube\VideoStatus;
use Illuminate\Support\Facades\Log;
use Psr\Http\Message\RequestInterface;

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
     * Human-readable hint for admins when OAuth token file is missing or invalid.
     */
    public static function oauthAuthorizeUrl(): string
    {
        return rtrim((string) config('app.url'), '/').'/youtube/auth';
    }

    /**
     * Write access token to disk, preserving refresh_token when Google omits it on refresh.
     *
     * @param  array<string, mixed>|null  $previousToken  Token JSON before refresh; omit to read from file
     */
    public static function persistAccessToken(string $tokenPath, GoogleClient $client, ?array $previousToken = null): void
    {
        $new = $client->getAccessToken();
        if (! is_array($new)) {
            return;
        }

        $old = $previousToken ?? [];
        if ($old === [] && is_readable($tokenPath)) {
            $decoded = json_decode((string) file_get_contents($tokenPath), true);
            $old = is_array($decoded) ? $decoded : [];
        }

        $merged = array_merge($old, $new);
        if (empty($merged['refresh_token']) && ! empty($old['refresh_token'])) {
            $merged['refresh_token'] = $old['refresh_token'];
        }

        file_put_contents($tokenPath, json_encode($merged, JSON_UNESCAPED_SLASHES));
    }

    /**
     * Get normalized playback URL from any YouTube URL or raw video ID.
     */
    public static function playbackUrl(string $videoId): string
    {
        return self::PLAYBACK_URL_PREFIX.self::extractVideoId($videoId);
    }

    /**
     * Get embed URL for iframe playback.
     */
    public static function embedUrl(string $videoReference): string
    {
        return 'https://www.youtube.com/embed/'.self::extractVideoId($videoReference);
    }

    /**
     * Extract YouTube video ID from full URL or return as-is if already an ID.
     */
    public static function extractVideoId(string $videoReference): string
    {
        // https://www.youtube.com/watch?v=VIDEO_ID
        if (str_contains($videoReference, 'youtube.com/watch')) {
            parse_str(parse_url($videoReference, PHP_URL_QUERY) ?? '', $q);

            return (string) ($q['v'] ?? $videoReference);
        }
        // https://youtu.be/VIDEO_ID
        if (str_contains($videoReference, 'youtu.be/')) {
            $path = parse_url($videoReference, PHP_URL_PATH);

            return (string) trim($path, '/');
        }
        // https://www.youtube.com/shorts/VIDEO_ID
        if (str_contains($videoReference, 'youtube.com/shorts/')) {
            $path = parse_url($videoReference, PHP_URL_PATH);

            return (string) basename($path);
        }

        // Already a raw video ID
        return $videoReference;
    }

    protected function getClient(): GoogleClient
    {
        $client = new GoogleClient;
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
     *
     * @param  array{title: string, description?: string, privacy_status?: string}  $options
     */
    public function uploadVideo(string $localPath, array $options = []): ?string
    {
        try {
            $client = $this->getClient();
            $tokenPath = storage_path('app/youtube-token.json');
            if (! file_exists($tokenPath)) {
                $this->lastError = 'YouTube OAuth token not found. Authorize once in the browser: '.self::oauthAuthorizeUrl()
                    .' (saves storage/app/youtube-token.json). Ensure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI match Google Cloud Console, or use "local" video storage instead of YouTube.';
                Log::warning($this->lastError);

                return null;
            }
            $previousToken = json_decode((string) file_get_contents($tokenPath), true);
            $previousToken = is_array($previousToken) ? $previousToken : [];
            $client->setAccessToken($previousToken);
            if ($client->isAccessTokenExpired()) {
                if ($client->getRefreshToken()) {
                    $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                    self::persistAccessToken($tokenPath, $client, $previousToken);
                } else {
                    $this->lastError = 'YouTube access token expired and no refresh token. Re-authorize: '.self::oauthAuthorizeUrl();
                    Log::warning($this->lastError);

                    return null;
                }
            }

            $youtube = new YouTube($client);
            $snippet = new VideoSnippet;
            $snippet->setTitle($options['title'] ?? 'Video');
            $snippet->setDescription($options['description'] ?? '');
            $snippet->setCategoryId(config('youtube.upload_settings.category_id', '27'));

            $status = new VideoStatus;
            $status->setPrivacyStatus($options['privacy_status'] ?? config('youtube.upload_settings.privacy_status', 'unlisted'));

            $video = new Video;
            $video->setSnippet($snippet);
            $video->setStatus($status);

            // Use resumable (chunked) upload — avoids loading entire file into memory
            $client->setDefer(true);
            /** @var RequestInterface $insertRequest */
            $insertRequest = $youtube->videos->insert('snippet,status', $video);

            $chunkSize = 5 * 1024 * 1024; // 5 MB per chunk
            $media = new MediaFileUpload(
                $client,
                $insertRequest,
                'video/mp4',
                null,
                true,
                $chunkSize
            );
            $media->setFileSize(filesize($localPath));
            $client->setDefer(false); // restore before chunk upload

            $response = false;
            $handle = fopen($localPath, 'rb');
            while (! $response && ! feof($handle)) {
                $chunk = fread($handle, $chunkSize);
                $response = $media->nextChunk($chunk);
            }
            fclose($handle);

            $this->lastError = null;

            return self::playbackUrl($response->getId());
        } catch (\Throwable $e) {
            $this->lastError = $e->getMessage();
            Log::error('YouTube upload failed: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Update video metadata on YouTube.
     *
     * @param  array{title?: string, description?: string}  $options
     */
    public function updateVideo(string $videoId, array $options = []): bool
    {
        try {
            $client = $this->getClient();
            $tokenPath = storage_path('app/youtube-token.json');
            if (! file_exists($tokenPath)) {
                return false;
            }
            $previousToken = json_decode((string) file_get_contents($tokenPath), true);
            $previousToken = is_array($previousToken) ? $previousToken : [];
            $client->setAccessToken($previousToken);
            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                self::persistAccessToken($tokenPath, $client, $previousToken);
            }

            $youtube = new YouTube($client);
            $id = self::extractVideoId($videoId);
            $video = $youtube->videos->listVideo('snippet,status', ['id' => $id])->getItems()[0] ?? null;
            if (! $video) {
                return false;
            }
            if (! empty($options['title'])) {
                $video->getSnippet()->setTitle($options['title']);
            }
            if (! empty($options['description'])) {
                $video->getSnippet()->setDescription($options['description']);
            }
            $youtube->videos->update('snippet,status', $video);

            return true;
        } catch (\Throwable $e) {
            Log::error('YouTube update failed: '.$e->getMessage());

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
            if (! file_exists($tokenPath)) {
                return false;
            }
            $previousToken = json_decode((string) file_get_contents($tokenPath), true);
            $previousToken = is_array($previousToken) ? $previousToken : [];
            $client->setAccessToken($previousToken);
            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                self::persistAccessToken($tokenPath, $client, $previousToken);
            }
            $youtube = new YouTube($client);
            $youtube->videos->delete(self::extractVideoId($videoId));

            return true;
        } catch (\Throwable $e) {
            Log::error('YouTube delete failed: '.$e->getMessage());

            return false;
        }
    }
}
