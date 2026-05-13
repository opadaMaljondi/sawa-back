<?php

namespace App\Jobs;

use App\Models\Course;
use App\Models\Lesson;
use App\Services\LessonVideoProcessingService;
use App\Support\FullCourseContentNotifier;
use App\Support\InstructorAdminNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class FinalizeChunkedVideoUpload implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public function __construct(public string $mergeToken) {}

    public function handle(LessonVideoProcessingService $lessonVideoProcessing): void
    {
        $cacheKey = $this->mergeCacheKey();
        $state = Cache::get($cacheKey);
        if (! is_array($state)) {
            return;
        }
        if (($state['status'] ?? '') === 'completed') {
            return;
        }

        Cache::put($cacheKey, array_merge($state, ['status' => 'processing']), now()->addDay());

        $uploadId = (string) ($state['upload_id'] ?? '');
        $total = (int) ($state['total_chunks'] ?? 0);
        $ext = (string) ($state['extension'] ?? 'mp4');
        $videoProvider = (string) ($state['video_provider'] ?? 'local');
        $context = (string) ($state['context'] ?? 'admin');
        $lessonRow = $state['lesson_row'] ?? null;
        $thumbRel = isset($state['thumbnail_local_relative']) ? (string) $state['thumbnail_local_relative'] : null;

        if ($uploadId === '' || $total < 1 || ! is_array($lessonRow)) {
            $this->markFailed($cacheKey, $state, 'Invalid merge payload.');

            return;
        }

        $maxTotalKb = max(1, (int) config('video.max_video_kb', 512000));
        $maxBytes = $maxTotalKb * 1024;

        $merged = null;
        try {
            $course = Course::findOrFail((int) ($lessonRow['course_id'] ?? 0));

            if ($context === 'instructor') {
                $uid = (int) ($state['instructor_user_id'] ?? 0);
                if ($uid < 1 || (int) $course->instructor_id !== $uid) {
                    throw new \RuntimeException('Course does not belong to this instructor.');
                }
            }

            $merged = $lessonVideoProcessing->mergeChunkDirectoryToTempFile($uploadId, $total, $ext);
            if ($merged['bytes'] > $maxBytes) {
                Storage::disk('local')->delete($merged['relative']);
                $lessonVideoProcessing->deleteChunkDirectory($uploadId);
                throw new \RuntimeException('Video exceeds maximum allowed size ('.$maxTotalKb.' KB).');
            }
            if ($merged['bytes'] === 0) {
                Storage::disk('local')->delete($merged['relative']);
                $lessonVideoProcessing->deleteChunkDirectory($uploadId);
                throw new \RuntimeException('Merged file is empty.');
            }

            [$videoProvider, $videoReference, $message] = $lessonVideoProcessing->processTempVideoForLesson(
                $merged['full_path'],
                $course,
                $videoProvider,
                $ext,
                $merged['relative'],
                $lessonRow['title'] ?? null,
                $lessonRow['description'] ?? null,
                null
            );

            $thumbnailPath = null;
            if ($thumbRel && Storage::disk('local')->exists($thumbRel)) {
                $binary = Storage::disk('local')->get($thumbRel);
                $thumbExt = pathinfo($thumbRel, PATHINFO_EXTENSION) ?: 'jpg';
                $dir = (string) ($state['thumbnail_public_dir'] ?? 'thumbnails/lessons');
                $thumbnailPath = $dir.'/'.uniqid('thumb_', true).'.'.$thumbExt;
                Storage::disk('public')->put($thumbnailPath, $binary);
                Storage::disk('local')->delete($thumbRel);
            }

            $lessonRow['video_provider'] = $videoProvider;
            $lessonRow['video_reference'] = $videoReference;
            if ($thumbnailPath !== null) {
                $lessonRow['thumbnail'] = $thumbnailPath;
            }

            $lesson = Lesson::create($lessonRow);

            $lessonVideoProcessing->deleteChunkDirectory($uploadId);
            Cache::forget('chunk_merge_active:'.$uploadId);

            if ($context === 'admin') {
                FullCourseContentNotifier::lessonPublished($lesson->fresh());
            } else {
                $publishInstantly = (bool) ($state['publish_instantly'] ?? false);
                if ($publishInstantly) {
                    FullCourseContentNotifier::lessonPublished($lesson->fresh());
                    InstructorAdminNotifier::notify(
                        $course,
                        'تم نشر درس فيديو (رفع جزئي) فوراً (لا يوجد انتظار موافقة إدارية)',
                        'إطلاع أمني: درس تم نشره',
                        [
                            'type' => 'instructor_lesson_auto_published',
                            'lesson_id' => $lesson->id,
                        ]
                    );
                } else {
                    InstructorAdminNotifier::notify($course, 'تم رفع درس (جزئي) يحتاج مراجعة', null, [
                        'type' => 'instructor_lesson_pending',
                        'lesson_id' => $lesson->id,
                    ]);
                }
            }

            Cache::put($cacheKey, [
                'status' => 'completed',
                'context' => $context,
                'upload_id' => $uploadId,
                'lesson_id' => $lesson->id,
                'message' => $message,
                'video_provider' => $videoProvider,
            ], now()->addDay());
        } catch (\Throwable $e) {
            if (is_array($merged) && isset($merged['relative'])) {
                Storage::disk('local')->delete($merged['relative']);
            }
            Log::error('FinalizeChunkedVideoUpload failed', [
                'merge_token' => $this->mergeToken,
                'error' => $e->getMessage(),
            ]);
            $this->markFailed($cacheKey, $state, $e->getMessage());
        }
    }

    public function failed(?\Throwable $e): void
    {
        $cacheKey = $this->mergeCacheKey();
        $state = Cache::get($cacheKey);
        if (! is_array($state)) {
            return;
        }
        $msg = $e ? $e->getMessage() : 'Job failed.';
        $this->markFailed($cacheKey, $state, $msg);
    }

    private function mergeCacheKey(): string
    {
        return 'video_chunk_merge:'.$this->mergeToken;
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function markFailed(string $cacheKey, array $state, string $message): void
    {
        $uploadId = (string) ($state['upload_id'] ?? '');
        if ($uploadId !== '') {
            Cache::forget('chunk_merge_active:'.$uploadId);
        }
        Cache::put($cacheKey, array_merge($state, [
            'status' => 'failed',
            'error_message' => $message,
        ]), now()->addDay());
    }
}
