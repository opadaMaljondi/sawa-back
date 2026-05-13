<?php

namespace App\Services;

use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Shared video temp-file handling for admin & instructor lesson uploads.
 */
class LessonVideoProcessingService
{
    public function __construct(protected YouTubeService $youtubeService) {}

    /**
     * @return array{0: string, 1: string, 2: string} [provider, reference, message]
     *
     * @throws \RuntimeException
     */
    public function processUploadedVideoFile(
        string $fullTempPath,
        Request $request,
        Course $course,
        string $videoProvider,
        ?string $fileExtension,
        ?string $tempRelativePath
    ): array {
        $ext = $fileExtension;
        if ($ext === null || $ext === '') {
            $ext = $request->hasFile('video')
                ? ($request->file('video')->getClientOriginalExtension() ?: 'mp4')
                : 'mp4';
        }
        $ext = $ext ?: 'mp4';

        return $this->processTempVideoForLesson(
            $fullTempPath,
            $course,
            $videoProvider,
            $ext,
            $tempRelativePath,
            $request->input('title'),
            $request->input('description'),
            $request->input('video_provider')
        );
    }

    /**
     * Same outcome as processUploadedVideoFile for an already-merged temp file on disk.
     *
     * @return array{0: string, 1: string, 2: string} [provider, reference, message]
     *
     * @throws \RuntimeException
     */
    public function processTempVideoForLesson(
        string $fullTempPath,
        Course $course,
        string $videoProvider,
        string $fileExtension,
        ?string $tempRelativePath,
        mixed $title = null,
        mixed $description = null,
        mixed $requestedVideoProvider = null,
    ): array {
        $ext = $fileExtension ?: 'mp4';

        $deleteTemp = function () use ($tempRelativePath): void {
            if ($tempRelativePath) {
                Storage::disk('local')->delete($tempRelativePath);
            }
        };

        if ($videoProvider === 'aws') {
            $s3Path = "videos/lessons/course_{$course->id}/".Str::random(40).".{$ext}";
            try {
                Storage::disk('s3')->put($s3Path, file_get_contents($fullTempPath), ['visibility' => 'public']);
            } catch (\Throwable $e) {
                throw new \RuntimeException('Failed to upload video to S3: '.$e->getMessage());
            }
            $deleteTemp();

            return ['aws', $s3Path, 'Video uploaded successfully to AWS S3.'];
        }

        if ($videoProvider === 'local') {
            $localPath = "videos/lessons/course_{$course->id}/".Str::random(40).".{$ext}";
            Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
            $deleteTemp();

            return ['local', $localPath, 'Video saved locally.'];
        }

        $titleStr = is_string($title) ? $title : (string) ($title ?? 'Video');
        $descStr = is_string($description) ? $description : ($description !== null ? (string) $description : "Course: {$course->title}");

        $uploadedUrl = $this->youtubeService->uploadVideo($fullTempPath, [
            'title' => $titleStr,
            'description' => $descStr,
            'privacy_status' => 'unlisted',
        ]);

        if ($uploadedUrl) {
            $deleteTemp();

            return ['youtube', $uploadedUrl, 'Video uploaded successfully to YouTube.'];
        }

        if ($requestedVideoProvider === 'youtube') {
            throw new \RuntimeException('Failed to upload video to YouTube: '.($this->youtubeService->getLastError() ?? 'Unauthorized/Unknown error'));
        }

        $localPath = "videos/lessons/course_{$course->id}/".Str::random(40).".{$ext}";
        Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
        $deleteTemp();

        return ['local', $localPath, 'Video saved locally.'];
    }

    /**
     * Sorted chunk indices present on disk within [0, $totalChunks - 1].
     *
     * @return list<int>
     */
    public function listReceivedChunkIndices(string $uploadId, int $totalChunks): array
    {
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);
        if (! is_dir($chunkDir)) {
            return [];
        }

        $indices = [];
        foreach (glob($chunkDir.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            if (! is_file($file)) {
                continue;
            }
            $base = basename($file);
            if (preg_match('/^(\d+)$/', $base, $m)) {
                $idx = (int) $m[1];
                if ($idx >= 0 && $idx < $totalChunks) {
                    $indices[] = $idx;
                }
            }
        }

        $indices = array_values(array_unique($indices));
        sort($indices, SORT_NUMERIC);

        return $indices;
    }

    /**
     * Merge chunk files 0..N-1 into a new temp file under storage/app/videos/temp/.
     *
     * @return array{full_path: string, relative: string, bytes: int}
     *
     * @throws \RuntimeException
     */
    public function mergeChunkDirectoryToTempFile(string $uploadId, int $totalChunks, string $extension): array
    {
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);
        if (! is_dir($chunkDir)) {
            throw new \RuntimeException('Upload session not found.');
        }

        $ext = ltrim($extension, '.') ?: 'mp4';
        $outName = Str::random(40).'.'.$ext;
        $tempRelative = 'videos/temp/'.$outName;
        $fullTempPath = storage_path('app/'.$tempRelative);

        $useShell = (bool) config('video.merge_chunks_via_shell', false)
            && PHP_OS_FAMILY === 'Linux'
            && function_exists('shell_exec');

        if ($useShell) {
            $escaped = [];
            for ($i = 0; $i < $totalChunks; $i++) {
                $part = $chunkDir.DIRECTORY_SEPARATOR.$i;
                if (! is_file($part)) {
                    throw new \RuntimeException("Missing chunk {$i} of {$totalChunks}.");
                }
                $escaped[] = escapeshellarg($part);
            }
            @unlink($fullTempPath);
            $cmd = 'cat '.implode(' ', $escaped).' > '.escapeshellarg($fullTempPath);
            shell_exec($cmd);
            if (! is_file($fullTempPath)) {
                throw new \RuntimeException('Could not merge chunks (shell).');
            }
        } else {
            $outHandle = fopen($fullTempPath, 'wb');
            if ($outHandle === false) {
                throw new \RuntimeException('Could not create merged file.');
            }

            $totalBytes = 0;
            for ($i = 0; $i < $totalChunks; $i++) {
                $part = $chunkDir.DIRECTORY_SEPARATOR.$i;
                if (! is_file($part)) {
                    fclose($outHandle);
                    @unlink($fullTempPath);

                    throw new \RuntimeException("Missing chunk {$i} of {$totalChunks}.");
                }
                $in = fopen($part, 'rb');
                if ($in === false) {
                    fclose($outHandle);
                    @unlink($fullTempPath);

                    throw new \RuntimeException("Could not read chunk {$i}.");
                }
                $totalBytes += (int) stream_copy_to_stream($in, $outHandle);
                fclose($in);
            }
            fclose($outHandle);
        }

        $bytes = (int) (filesize($fullTempPath) ?: 0);

        return [
            'full_path' => $fullTempPath,
            'relative' => $tempRelative,
            'bytes' => $bytes,
        ];
    }

    public function deleteChunkDirectory(string $uploadId): void
    {
        $dir = storage_path('app/videos/chunks/'.$uploadId);
        if (! is_dir($dir)) {
            return;
        }
        foreach (glob($dir.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
        @rmdir($dir);
    }

    /**
     * أول فهرس مفقود من 0..totalChunks-1، أو totalChunks إذا اكتملت كل الأجزاء على القرص.
     *
     * @return array{
     *     next_chunk_index: int,
     *     chunks_on_disk: int,
     *     all_chunks_received: bool,
     *     received_chunk_indices: list<int>,
     *     received_chunks_count: int
     * }
     */
    public function getChunkUploadStatus(string $uploadId, int $totalChunks): array
    {
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);

        $received = $this->listReceivedChunkIndices($uploadId, $totalChunks);
        $receivedCount = count($received);

        if (! is_dir($chunkDir)) {
            return [
                'next_chunk_index' => 0,
                'chunks_on_disk' => 0,
                'all_chunks_received' => false,
                'received_chunk_indices' => [],
                'received_chunks_count' => 0,
            ];
        }

        for ($i = 0; $i < $totalChunks; $i++) {
            if (! is_file($chunkDir.DIRECTORY_SEPARATOR.$i)) {
                return [
                    'next_chunk_index' => $i,
                    'chunks_on_disk' => $i,
                    'all_chunks_received' => false,
                    'received_chunk_indices' => $received,
                    'received_chunks_count' => $receivedCount,
                ];
            }
        }

        return [
            'next_chunk_index' => $totalChunks,
            'chunks_on_disk' => $totalChunks,
            'all_chunks_received' => true,
            'received_chunk_indices' => $received,
            'received_chunks_count' => $receivedCount,
        ];
    }
}
