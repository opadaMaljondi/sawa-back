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

        $uploadedUrl = $this->youtubeService->uploadVideo($fullTempPath, [
            'title' => $request->title,
            'description' => $request->description ?? "Course: {$course->title}",
            'privacy_status' => 'unlisted',
        ]);

        if ($uploadedUrl) {
            $deleteTemp();

            return ['youtube', $uploadedUrl, 'Video uploaded successfully to YouTube.'];
        }

        if ($request->video_provider === 'youtube') {
            throw new \RuntimeException('Failed to upload video to YouTube: '.($this->youtubeService->getLastError() ?? 'Unauthorized/Unknown error'));
        }

        $localPath = "videos/lessons/course_{$course->id}/".Str::random(40).".{$ext}";
        Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
        $deleteTemp();

        return ['local', $localPath, 'Video saved locally.'];
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
     * @return array{next_chunk_index: int, chunks_on_disk: int, all_chunks_received: bool}
     */
    public function getChunkUploadStatus(string $uploadId, int $totalChunks): array
    {
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);

        if (! is_dir($chunkDir)) {
            return [
                'next_chunk_index' => 0,
                'chunks_on_disk' => 0,
                'all_chunks_received' => false,
            ];
        }

        for ($i = 0; $i < $totalChunks; $i++) {
            if (! is_file($chunkDir.DIRECTORY_SEPARATOR.$i)) {
                return [
                    'next_chunk_index' => $i,
                    'chunks_on_disk' => $i,
                    'all_chunks_received' => false,
                ];
            }
        }

        return [
            'next_chunk_index' => $totalChunks,
            'chunks_on_disk' => $totalChunks,
            'all_chunks_received' => true,
        ];
    }
}
