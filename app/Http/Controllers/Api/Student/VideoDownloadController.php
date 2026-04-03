<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\DownloadedLesson;
use App\Models\Lesson;
use App\Services\VideoEncryptionService;
use App\Services\YouTubeService;
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

        if ($lesson->video_provider === 'youtube') {
            return response()->json([
                'message'        => 'This lesson is hosted on YouTube. Use playback_url in your player; offline file packaging is only for hosted videos (local/S3).',
                'video_provider' => 'youtube',
                'playback_url'   => YouTubeService::playbackUrl((string) $lesson->video_reference),
                'embed_url'      => YouTubeService::embedUrl((string) $lesson->video_reference),
                'download_available' => false,
            ]);
        }

        $encryptedPath = storage_path('app/videos/encrypted/'.$student->id.'/'.$lessonId.'.enc');
        $sourcePath    = $this->resolveSourceFileForEncryption($lesson);

        if (! $sourcePath) {
            return response()->json(['message' => 'Video file not found on server'], 404);
        }

        $encryptionData = $this->encryptionService->encryptVideo($sourcePath, $encryptedPath);

        if ($lesson->video_provider === 'aws' && str_starts_with($sourcePath, storage_path('app/videos/temp'))) {
            @unlink($sourcePath);
        }

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
                'quality'         => '360p',
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
            'token'     => $encryptionData['token'],
            'signature' => $signature,
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

        if ($lesson->video_provider === 'local') {
            $absolute = $this->resolveLocalVideoAbsolutePath($lesson);
            if (! $absolute || ! is_readable($absolute)) {
                return response()->json(['message' => 'Video file not found'], 404);
            }

            $mime = mime_content_type($absolute) ?: 'video/mp4';

            return response()->file($absolute, [
                'Content-Type' => $mime,
            ]);
        }

        if ($lesson->video_provider === 'aws') {
            try {
                $url = Storage::disk('s3')->temporaryUrl(
                    $lesson->video_reference,
                    now()->addMinutes(120),
                    [
                        'ResponseContent-Type' => 'video/mp4',
                    ]
                );
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Could not generate download URL: '.$e->getMessage(),
                ], 500);
            }

            return response()->json([
                'message'              => 'Use stream_url with Range requests for chunked download.',
                'video_provider'       => 'aws',
                'stream_url'           => $url,
                'supports_http_range'  => true,
                'expires_in_minutes'   => 120,
            ]);
        }

        return response()->json(['message' => 'Unsupported video provider'], 422);
    }

    /**
     * Absolute path to a local video file for this lesson, or temp path after pulling from S3.
     */
    protected function resolveSourceFileForEncryption(Lesson $lesson): ?string
    {
        if ($lesson->video_provider === 'local') {
            return $this->resolveLocalVideoAbsolutePath($lesson);
        }

        if ($lesson->video_provider === 'aws') {
            $tmpRelative = 'videos/temp/enc_'.Str::uuid().'_'.preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($lesson->video_reference));
            $full        = storage_path('app/'.$tmpRelative);
            $dir         = dirname($full);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            try {
                $stream = Storage::disk('s3')->readStream($lesson->video_reference);
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

    protected function resolveLocalVideoAbsolutePath(Lesson $lesson): ?string
    {
        if ($lesson->video_provider !== 'local' || empty($lesson->video_reference)) {
            return null;
        }
        if (Storage::disk('public')->exists($lesson->video_reference)) {
            return Storage::disk('public')->path($lesson->video_reference);
        }
        if (Storage::disk('local')->exists($lesson->video_reference)) {
            return Storage::disk('local')->path($lesson->video_reference);
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
                        'thumbnail' => $lesson->thumbnail,
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
