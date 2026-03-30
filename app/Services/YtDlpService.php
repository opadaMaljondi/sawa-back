<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

class YtDlpService
{
    /**
     * Extract a direct downloadable media URL using yt-dlp without downloading.
     *
     * Returns the first URL line from yt-dlp output. Some formats may output
     * multiple lines (e.g., separate video/audio); the API can decide what to do.
     */
    public function getDirectUrl(string $pageUrl, ?string $format = null, ?int $timeout = null): string
    {
        $bin = (string) config('yt_dlp.bin', 'yt-dlp');
        $defaultFormat = (string) config('yt_dlp.format', 'best[ext=mp4]/best');
        $format = $format ?: $defaultFormat;
        $timeout = $timeout ?: (int) config('yt_dlp.timeout', 90);
        $cookies = config('yt_dlp.cookies');

        $formatsToTry = array_values(array_unique(array_filter([
            $format,
            'best',
        ])));

        $lastException = null;
        foreach ($formatsToTry as $formatToTry) {
            try {
                $cmd = [$bin, '--no-playlist', '--no-warnings', '-f', $formatToTry, '-g'];
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
                        'format' => $formatToTry,
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
            } catch (ProcessTimedOutException $e) {
                Log::warning('yt-dlp timed out', [
                    'format' => $formatToTry,
                    'timeout' => $timeout,
                    'url' => $pageUrl,
                ]);
                $lastException = $e;
                continue;
            } catch (\Throwable $e) {
                $lastException = $e;
                continue;
            }
        }

        if ($lastException) {
            throw $lastException;
        }

        throw new \RuntimeException('yt-dlp could not extract a direct URL');
    }
}

