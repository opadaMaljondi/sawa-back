<?php

namespace App\Support;

/**
 * Maps video_provider values to Laravel filesystem disks for cloud storage.
 */
final class VideoCloudDisk
{
    public static function isCloudProvider(?string $provider): bool
    {
        return in_array($provider, ['aws', 'r2'], true);
    }

    public static function allowsChunkUpload(?string $provider): bool
    {
        return in_array($provider, ['local', 'aws', 'r2'], true);
    }

    /**
     * @throws \InvalidArgumentException
     */
    public static function diskName(string $provider): string
    {
        return match ($provider) {
            'aws' => 's3',
            'r2' => 'r2',
            default => throw new \InvalidArgumentException("Provider [{$provider}] is not a cloud disk."),
        };
    }

    /**
     * Instructor file uploads always go to R2 (YouTube URL lessons stay YouTube).
     */
    public static function instructorHostedProvider(?string $requested): string
    {
        if ($requested === 'youtube') {
            return 'youtube';
        }

        return 'r2';
    }
}
