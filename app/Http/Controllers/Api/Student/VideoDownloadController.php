<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\DownloadedLesson;
use App\Models\Lesson;
use App\Services\VideoEncryptionService;
use App\Services\YouTubeService;
use App\Support\VideoCloudDisk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoDownloadController extends Controller
{
    public function __construct(protected VideoEncryptionService $encryptionService)
    {
    }

    /**
     * Start offline encrypted download (local / S3 source files only).
     * YouTube lessons: returns playback URLs only (no packaged file).
     */
    public function download(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);
        $student = auth()->user();

        if ($lesson->approval_status !== 'approved' || ! $lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        if (! $student->hasAccessToLesson((int) $lessonId)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        if (! $lesson->can_download) {
            return response()->json(['message' => 'Download is not enabled for this lesson'], 403);
        }

        if (! $lesson->video_reference) {
            return response()->json(['message' => 'Video not available'], 404);
        }

        $quality = (string) $request->input('quality', 'source');

        if ($lesson->video_provider === 'youtube') {
            return response()->json([
                'message'        => 'This lesson is hosted on YouTube. Use playback_url in your player; offline file packaging is only for hosted videos (local/S3/R2).',
                'video_provider' => 'youtube',
                'playback_url'   => YouTubeService::playbackUrl((string) $lesson->video_reference),
                'embed_url'      => YouTubeService::embedUrl((string) $lesson->video_reference),
                'download_available' => false,
                'ready' => true,
                'status' => 'completed',
            ]);
        }

        // Cloud: never pull/encrypt on PHP (that froze the student app on "preparing").
        if (VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
            $objectKey = $lesson->storedPathForQuality($quality);
            $url = $this->signedCloudUrl($lesson, $objectKey);
            if (! $url) {
                return response()->json(['message' => 'Could not generate download URL'], 500);
            }

            $token = Str::random(64);
            $fileSize = 0;
            try {
                $fileSize = (int) Storage::disk(VideoCloudDisk::diskName($lesson->video_provider))->size($objectKey);
            } catch (\Throwable) {
                $fileSize = 0;
            }

            DownloadedLesson::updateOrCreate(
                [
                    'student_id' => $student->id,
                    'lesson_id'  => $lessonId,
                    'device_id'  => null,
                ],
                [
                    'encrypted_path'  => '',
                    'token'           => $token,
                    'encryption_key'  => '',
                    'quality'         => $quality !== '' ? $quality : 'source',
                    'file_size'       => $fileSize,
                    'status'          => 'completed',
                    'downloaded_at'   => now(),
                ]
            );

            $signature = $this->encryptionService->generateDownloadSignature(
                $token,
                (int) $lessonId,
                (int) $student->id
            );

            return response()->json([
                'message' => 'Download ready',
                'ready' => true,
                'status' => 'completed',
                'preparing' => false,
                'download_mode' => 'direct',
                'token' => $token,
                'signature' => $signature,
                'stream_url' => $url,
                'download_url' => $url,
                'video_provider' => $lesson->video_provider,
                'quality' => $quality !== '' ? $quality : 'source',
                'quality_urls' => $lesson->video_quality_urls,
                'file_size' => $fileSize,
                'supports_http_range' => true,
                'expires_in_minutes' => 120,
            ]);
        }

        $encryptedPath = storage_path('app/videos/encrypted/'.$student->id.'/'.$lessonId.'.enc');
        $sourcePath    = $this->resolveSourceFileForEncryption($lesson, $quality);

        if (! $sourcePath) {
            return response()->json(['message' => 'Video file not found on server'], 404);
        }

        $encryptionData = $this->encryptionService->encryptVideo($sourcePath, $encryptedPath);

        DownloadedLesson::updateOrCreate(
            [
                'student_id' => $student->id,
                'lesson_id'  => $lessonId,
                'device_id'  => null,
            ],
            [
                'encrypted_path'  => $encryptedPath,
                'token'           => $encryptionData['token'],
                'encryption_key'  => $encryptionData['decryption_key'],
                'quality'         => $quality !== '' ? $quality : 'source',
                'file_size'       => $encryptionData['file_size'],
                'status'          => 'completed',
                'downloaded_at'   => now(),
            ]
        );

        $signature = $this->encryptionService->generateDownloadSignature(
            $encryptionData['token'],
            (int) $lessonId,
            (int) $student->id
        );

        return response()->json([
            'message'   => 'Video downloaded successfully',
            'ready' => true,
            'status' => 'completed',
            'preparing' => false,
            'download_mode' => 'encrypted',
            'token'     => $encryptionData['token'],
            'signature' => $signature,
            'file_size' => $encryptionData['file_size'],
        ]);
    }

    /**
     * Playback URLs for the in-app player, including quality variants when transcoded.
     */
    public function playback(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);
        $student = auth()->user();

        if ($lesson->approval_status !== 'approved' || ! $lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        if (! $student->hasAccessToLesson((int) $lessonId)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        $quality = (string) $request->query('quality', 'source');
        $selectedPath = $lesson->storedPathForQuality($quality);
        $selectedUrl = $selectedPath ? $lesson->urlForStoredVideoPath($selectedPath) : $lesson->video_playback_url;

        return response()->json([
            'lesson_id' => $lesson->id,
            'video_provider' => $lesson->video_provider,
            'quality' => $quality !== '' ? $quality : 'source',
            'video_playback_url' => $selectedUrl,
            'available_qualities' => $lesson->availableQualityLabels(),
            'video_quality_urls' => $lesson->video_quality_urls,
            'can_change_quality' => count($lesson->availableQualityLabels()) > 1,
        ]);
    }

    /**
     * Chunk-friendly access: local files are streamed with HTTP Range support.
     * AWS: returns a time-limited URL (S3 supports Range requests for resumable/chunked downloads).
     * YouTube: JSON with playback URLs only.
     */
    public function streamLessonFile(Request $request, int $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);
        $student = auth()->user();

        if ($lesson->approval_status !== 'approved' || ! $lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        if (! $student->hasAccessToLesson($lessonId)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        if (! $lesson->can_download) {
            return response()->json(['message' => 'Download is not enabled for this lesson'], 403);
        }

        if (! $lesson->video_reference) {
            return response()->json(['message' => 'Video not available'], 404);
        }

        if ($lesson->video_provider === 'youtube') {
            return response()->json([
                'message'        => 'Use playback_url with a YouTube-capable player.',
                'video_provider' => 'youtube',
                'playback_url'   => YouTubeService::playbackUrl((string) $lesson->video_reference),
                'embed_url'      => YouTubeService::embedUrl((string) $lesson->video_reference),
                'supports_http_range' => false,
            ], 422);
        }

        $quality = (string) $request->query('quality', 'source');
        $objectKey = $lesson->storedPathForQuality($quality);

        if ($lesson->video_provider === 'local') {
            $absolute = $this->resolveLocalVideoAbsolutePath($lesson, $objectKey);
            if (! $absolute || ! is_readable($absolute)) {
                return response()->json(['message' => 'Video file not found'], 404);
            }

            $mime = mime_content_type($absolute) ?: 'video/mp4';

            return response()->file($absolute, [
                'Content-Type' => $mime,
            ]);
        }

        if (VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
            $url = $this->signedCloudUrl($lesson, $objectKey);
            if (! $url) {
                return response()->json(['message' => 'Could not generate download URL'], 500);
            }

            if ($request->query('format') === 'json') {
                return response()->json([
                    'message'              => 'Use stream_url with Range requests for chunked download.',
                    'ready'                => true,
                    'status'               => 'completed',
                    'preparing'            => false,
                    'video_provider'       => $lesson->video_provider,
                    'stream_url'           => $url,
                    'download_url'         => $url,
                    'supports_http_range'  => true,
                    'expires_in_minutes'   => 120,
                    'quality'              => $quality !== '' ? $quality : 'source',
                    'quality_urls'         => $lesson->video_quality_urls,
                ]);
            }

            return redirect()->away($url);
        }

        return response()->json(['message' => 'Unsupported video provider'], 422);
    }

    /**
     * Absolute path to a local video file for this lesson, or temp path after pulling from S3.
     */
    protected function signedCloudUrl(Lesson $lesson, ?string $objectKey): ?string
    {
        if (! $objectKey || ! VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
            return null;
        }
        try {
            return Storage::disk(VideoCloudDisk::diskName($lesson->video_provider))->temporaryUrl(
                $objectKey,
                now()->addMinutes(120),
                [
                    'ResponseContentType' => 'video/mp4',
                ]
            );
        } catch (\Throwable) {
            return $lesson->urlForStoredVideoPath($objectKey);
        }
    }

    protected function resolveSourceFileForEncryption(Lesson $lesson, ?string $quality = null): ?string
    {
        if ($lesson->video_provider === 'local') {
            return $this->resolveLocalVideoAbsolutePath($lesson, $lesson->storedPathForQuality($quality));
        }

        if (VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
            $tmpRelative = 'videos/temp/enc_'.Str::uuid().'_'.preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($lesson->video_reference));
            $full        = storage_path('app/'.$tmpRelative);
            $dir         = dirname($full);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            try {
                $stream = Storage::disk(VideoCloudDisk::diskName($lesson->video_provider))->readStream($lesson->video_reference);
                if (! $stream) {
                    return null;
                }
                $out = fopen($full, 'wb');
                if (! $out) {
                    fclose($stream);

                    return null;
                }
                stream_copy_to_stream($stream, $out);
                fclose($stream);
                fclose($out);
            } catch (\Throwable) {
                @unlink($full);

                return null;
            }

            return is_readable($full) ? $full : null;
        }

        return null;
    }

    protected function resolveLocalVideoAbsolutePath(Lesson $lesson, ?string $relative = null): ?string
    {
        $relative = $relative ?: $lesson->video_reference;
        if ($lesson->video_provider !== 'local' || empty($relative)) {
            return null;
        }
        if (Storage::disk('public')->exists($relative)) {
            return Storage::disk('public')->path($relative);
        }
        if (Storage::disk('local')->exists($relative)) {
            return Storage::disk('local')->path($relative);
        }

        return null;
    }

    /**
     * Downloaded lessons list (encrypted packages).
     */
    public function downloaded()
    {
        $downloaded = DownloadedLesson::where('student_id', auth()->id())
            ->with([
                'lesson:id,course_id,section_id,title,thumbnail,price,duration',
                'lesson.course:id,title,image,price,instructor_id',
                'lesson.course.instructor:id,full_name,image',
            ])
            ->orderBy('downloaded_at', 'desc')
            ->get()
            ->map(function ($record) {
                $lesson = $record->lesson;
                $course = $lesson?->course;

                return [
                    'token'         => $record->token,
                    'quality'       => $record->quality,
                    'file_size'     => $record->file_size,
                    'status'        => $record->status,
                    'downloaded_at' => $record->downloaded_at,
                    'expires_at'    => $record->expires_at,
                    'lesson'        => $lesson ? [
                        'id'        => $lesson->id,
                        'title'     => $lesson->title,
                        'thumbnail' => $lesson->thumbnail_url,
                        'price'     => $lesson->price,
                        'duration'  => $lesson->duration,
                    ] : null,
                    'course'        => $course ? [
                        'id'         => $course->id,
                        'title'      => $course->title,
                        'image'      => $course->image,
                        'price'      => $course->price,
                        'instructor' => $course->instructor
                            ? $course->instructor->only(['id', 'full_name', 'image'])
                            : null,
                    ] : null,
                ];
            });

        return response()->json(['downloaded' => $downloaded]);
    }

    /**
     * Stream encrypted offline package (decrypts to temp; supports HTTP Range on the temp file).
     */
    public function stream(Request $request, $token)
    {
        $downloaded = DownloadedLesson::where('token', $token)
            ->where('student_id', auth()->id())
            ->firstOrFail();

        $lesson = $downloaded->lesson;

        if ($lesson->approval_status !== 'approved' || ! $lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        if (! auth()->user()->hasAccessToLesson($lesson->id)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        // Signature is optional: row is already scoped to auth user + token. If provided, it must match.
        $sig = $request->query('signature');
        if ($sig !== null && $sig !== '') {
            if (! $this->encryptionService->verifyDownloadSignature(
                $token,
                (int) $lesson->id,
                (int) auth()->id(),
                $sig
            )) {
                return response()->json(['message' => 'Invalid signature'], 403);
            }
        }

        if (! is_string($downloaded->encrypted_path) || ! is_file($downloaded->encrypted_path)) {
            $quality = (string) ($downloaded->quality ?: 'source');
            $objectKey = $lesson->storedPathForQuality($quality);
            if (VideoCloudDisk::isCloudProvider($lesson->video_provider)) {
                $url = $this->signedCloudUrl($lesson, $objectKey);
                if ($url) {
                    return redirect()->away($url);
                }
            }
            if ($lesson->video_provider === 'local') {
                $absolute = $this->resolveLocalVideoAbsolutePath($lesson, $objectKey);
                if ($absolute && is_readable($absolute)) {
                    return response()->file($absolute, [
                        'Content-Type' => mime_content_type($absolute) ?: 'video/mp4',
                    ]);
                }
            }

            return response()->json(['message' => 'Download file not found'], 404);
        }

        $tempOutput = storage_path('app/videos/temp/'.uniqid('stream_', true).'.mp4');

        if ($this->encryptionService->decryptVideo(
            $downloaded->encrypted_path,
            $downloaded->encryption_key,
            $tempOutput
        )) {
            register_shutdown_function(static function () use ($tempOutput): void {
                if (is_file($tempOutput)) {
                    @unlink($tempOutput);
                }
            });

            return response()->file($tempOutput);
        }

        return response()->json(['message' => 'Failed to decrypt video'], 500);
    }

    /**
     * Delete downloaded encrypted package.
     */
    public function delete($token)
    {
        $downloaded = DownloadedLesson::where('token', $token)
            ->where('student_id', auth()->id())
            ->firstOrFail();

        if (file_exists($downloaded->encrypted_path)) {
            unlink($downloaded->encrypted_path);
        }

        $downloaded->delete();

        return response()->json(['message' => 'Downloaded video deleted']);
    }
}
