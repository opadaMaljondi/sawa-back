<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class YtDlpService
{
    /**
     * Extract a direct downloadable media URL using yt-dlp without downloading.
     *
     * Returns the first URL line from yt-dlp output. Some formats may output
     * multiple lines (e.g., separate video/audio); the API can decide what to do.
     */
    public function getDirectUrl(string $pageUrl, ?string $format = null): string
    {
        $bin = (string) config('yt_dlp.bin', 'yt-dlp');
        $format = $format ?: (string) config('yt_dlp.format', 'best[ext=mp4]/best');
        $timeout = (int) config('yt_dlp.timeout', 20);
        $cookies = config('yt_dlp.cookies');

        $cmd = [$bin, '--no-playlist', '-f', $format, '-g'];
        if (is_string($cookies) && $cookies !== '') {
            $cmd[] = '--cookies';
            $cmd[] = $cookies;
        }
        $cmd[] = $pageUrl;

        $process = new Process($cmd);
        $process->setTimeout($timeout);
        $process->run();

        if (! $process->isSuccessful()) {
            Log::warning('yt-dlp failed', [
                'exit_code' => $process->getExitCode(),
                'error' => $process->getErrorOutput(),
                'output' => $process->getOutput(),
            ]);
            throw new ProcessFailedException($process);
        }

        $out = trim((string) $process->getOutput());
        if ($out === '') {
            throw new \RuntimeException('yt-dlp returned empty output');
        }

        $lines = preg_split("/\r\n|\n|\r/", $out) ?: [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line !== '' && str_starts_with($line, 'http')) {
                return $line;
            }
        }

        throw new \RuntimeException('yt-dlp output did not contain a URL');
    }
}

