<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\LessonVideoProcessingService;
use App\Services\YouTubeService;
use App\Jobs\FinalizeChunkedVideoUpload;
use App\Support\FullCourseContentNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoController extends Controller
{
    public function __construct(
        protected YouTubeService $youtubeService,
        protected LessonVideoProcessingService $lessonVideoProcessing
    ) {}

    /**
     * Create lesson with video.
     *
     * Two modes (mutually exclusive):
     *   A) youtube_url — store an existing YouTube link directly (no upload)
     *   B) video file  — upload file to YouTube; falls back to local storage on failure
     *
     * POST /admin/videos
     * Fields: course_id, title, section_id?, price?, duration?, is_free?, order?,
     *         youtube_url  OR  video (file)
     */
    public function upload(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'section_id' => 'nullable|exists:course_sections,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'duration' => 'nullable|integer|min:0',
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order' => 'nullable|integer',
            'video_provider' => 'nullable|in:youtube,local,aws',
            'thumbnail' => 'nullable|image|max:2048',
            // One of these is required (youtube_url and video_url are aliases):
            'youtube_url' => 'required_without_all:video_url,video|nullable|url',
            'video_url' => 'required_without_all:youtube_url,video|nullable|url',
            'video' => 'required_without_all:youtube_url,video_url|nullable|file|mimes:mp4,avi,mov|max:512000',
        ]);

        $course = Course::findOrFail($request->course_id);

        // ── Mode A: YouTube URL provided directly ─────────────────────────────
        $youtubeUrl = $request->filled('youtube_url') ? $request->youtube_url : $request->video_url;
        $videoProvider = $request->input('video_provider', 'youtube');

        if ($youtubeUrl) {
            $videoProvider = 'youtube';
            $videoReference = $youtubeUrl;
            $message = 'Lesson created with YouTube URL.';

            // ── Mode B: File upload ───────────────────────────────────────────────
        } else {
            $tempPath = $request->file('video')->store('videos/temp', 'local');
            $fullTempPath = storage_path('app/'.$tempPath);

            try {
                [$videoProvider, $videoReference, $message] = $this->lessonVideoProcessing->processUploadedVideoFile(
                    $fullTempPath,
                    $request,
                    $course,
                    $videoProvider,
                    null,
                    $tempPath
                );
            } catch (\RuntimeException $e) {
                Storage::disk('local')->delete($tempPath);

                return response()->json([
                    'message' => $e->getMessage(),
                    'error' => $e->getMessage(),
                ], 422);
            }
        }

        $thumbnailPath = null;
        if ($request->hasFile('thumbnail')) {
            $thumbnailPath = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'section_id' => $request->section_id,
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->filled('price') ? (float) $request->price : null,
            'duration' => $request->filled('duration') ? (int) $request->duration : 0,
            'video_provider' => $videoProvider,
            'video_reference' => $videoReference,
            'is_free' => $request->boolean('is_free', false),
            'can_download' => $request->boolean('can_download', true),
            'can_purchase_alone' => $this->resolvedCanPurchaseAlone($request, $course),
            'thumbnail' => $thumbnailPath,
            'active' => true,
            'order' => (int) ($request->order ?? 1),
        ]);

        FullCourseContentNotifier::lessonPublished($lesson->fresh());

        return response()->json([
            'message' => $message,
            'lesson' => $lesson,
            'video_provider' => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }

    /**
     * Receive one chunk of a chunked video upload (local / aws only). Call completeChunkUpload when done.
     */
    public function uploadChunk(Request $request)
    {
        $maxKb = max(1, (int) config('video.chunk_max_kb', 5120));
        $request->validate([
            'upload_id' => 'required|uuid',
            'chunk_index' => 'required|integer|min:0',
            'total_chunks' => 'required|integer|min:1|max:10000',
            'chunk' => ['required', 'file', 'max:'.$maxKb],
            'original_name' => 'required|string|max:255',
        ]);

        $ext = strtolower((string) pathinfo($request->original_name, PATHINFO_EXTENSION));
        if (! in_array($ext, ['mp4', 'avi', 'mov'], true)) {
            return response()->json(['message' => 'Invalid video type. Allowed: mp4, avi, mov.'], 422);
        }

        if ($request->integer('chunk_index') >= $request->integer('total_chunks')) {
            return response()->json(['message' => 'chunk_index must be less than total_chunks.'], 422);
        }

        $this->lessonVideoProcessing->storeReceivedChunk(
            $request->file('chunk'),
            (string) $request->upload_id,
            $request->chunk_index
        );

        return response()->json([
            'received' => true,
            'chunk_index' => $request->integer('chunk_index'),
        ]);
    }

    /**
     * جلسة الرفع: أول جزء غير موجود على الخادم (للاستئناف بعد فشل الشبكة أو إعادة فتح الصفحة).
     */
    public function chunkUploadStatus(Request $request)
    {
        $request->validate([
            'upload_id' => 'required|uuid',
            'total_chunks' => 'required|integer|min:1|max:10000',
        ]);

        $status = $this->lessonVideoProcessing->getChunkUploadStatus(
            $request->input('upload_id'),
            $request->integer('total_chunks')
        );

        return response()->json($status);
    }

    /**
     * تتبع دمج الأجزاء بعد POST chunk/complete مع async_merge=1.
     */
    public function chunkMergeStatus(Request $request): JsonResponse
    {
        $request->validate([
            'merge_token' => 'required|uuid',
        ]);
        $token = (string) $request->input('merge_token');
        $data = Cache::get('video_chunk_merge:'.$token);
        if (! is_array($data)) {
            return response()->json(['message' => 'Unknown or expired merge job.'], 404);
        }

        $out = [
            'status' => (string) ($data['status'] ?? 'unknown'),
        ];
        if (($data['status'] ?? '') === 'completed' && isset($data['lesson_id'])) {
            $out['lesson'] = Lesson::find((int) $data['lesson_id']);
            $out['message'] = $data['message'] ?? null;
            $out['video_provider'] = $data['video_provider'] ?? null;
            if ($out['lesson']) {
                $out['video_playback_url'] = $out['lesson']->video_playback_url;
            }
        }
        if (($data['status'] ?? '') === 'failed') {
            $out['message'] = (string) ($data['error_message'] ?? 'Merge failed.');
        }

        return response()->json($out);
    }

    /**
     * إلغاء جلسة الرفع المجزأ وحذف الأجزاء المؤقتة من القرص.
     */
    public function abandonChunkUpload(Request $request)
    {
        $request->validate([
            'upload_id' => 'required|uuid',
        ]);
        $this->lessonVideoProcessing->deleteChunkDirectory($request->input('upload_id'));
        Cache::forget('chunk_merge_active:'.$request->input('upload_id'));

        return response()->json(['message' => 'تم إلغاء جلسة الرفع وحذف الأجزاء المؤقتة.']);
    }

    /**
     * Merge chunks and create lesson (same outcome as POST /admin/videos with a single file).
     */
    public function completeChunkUpload(Request $request)
    {
        $maxTotalKb = max(1, (int) config('video.max_video_kb', 512000));

        $request->validate([
            'upload_id' => 'required|uuid',
            'total_chunks' => 'required|integer|min:1|max:10000',
            'original_name' => 'required|string|max:255',
            'video_provider' => 'required|in:local,aws',
            'course_id' => 'required|exists:courses,id',
            'section_id' => 'nullable|exists:course_sections,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'duration' => 'nullable|integer|min:0',
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order' => 'nullable|integer',
            'thumbnail' => 'nullable|image|max:2048',
        ]);

        $ext = strtolower((string) pathinfo($request->original_name, PATHINFO_EXTENSION));
        if (! in_array($ext, ['mp4', 'avi', 'mov'], true)) {
            return response()->json(['message' => 'Invalid video type. Allowed: mp4, avi, mov.'], 422);
        }

        $uploadId = $request->upload_id;
        $total = $request->integer('total_chunks');
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);

        if (! is_dir($chunkDir)) {
            return response()->json(['message' => 'Upload session not found or expired. Upload chunks first.'], 422);
        }

        $chunkState = $this->lessonVideoProcessing->getChunkUploadStatus($uploadId, $total);
        if (! ($chunkState['all_chunks_received'] ?? false)) {
            return response()->json([
                'message' => 'Not all chunks received yet. Upload every part before completing.',
                'received_chunks_count' => $chunkState['received_chunks_count'] ?? 0,
                'total_chunks' => $total,
            ], 422);
        }

        $course = Course::findOrFail($request->course_id);

        if ($request->boolean('async_merge')) {
            $mapKey = 'chunk_merge_active:'.$uploadId;
            $existingToken = Cache::get($mapKey);
            if (is_string($existingToken) && $existingToken !== '') {
                $prev = Cache::get('video_chunk_merge:'.$existingToken);
                if (is_array($prev) && in_array($prev['status'] ?? '', ['queued', 'processing', 'completed'], true)) {
                    return response()->json([
                        'async' => true,
                        'merge_token' => $existingToken,
                        'status' => $prev['status'] ?? 'queued',
                        'message' => 'Merge already scheduled for this upload session.',
                    ], 202);
                }
            }

            $mergeToken = (string) Str::uuid();
            $thumbnailLocal = null;
            if ($request->hasFile('thumbnail')) {
                $thumbnailLocal = $request->file('thumbnail')->store('chunk_merge_stage/'.$mergeToken, 'local');
            }

            $lessonRow = [
                'course_id' => $course->id,
                'section_id' => $request->section_id,
                'title' => $request->title,
                'description' => $request->description,
                'price' => $request->filled('price') ? (float) $request->price : null,
                'duration' => $request->filled('duration') ? (int) $request->duration : 0,
                'is_free' => $request->boolean('is_free', false),
                'can_download' => $request->boolean('can_download', true),
                'can_purchase_alone' => $this->resolvedCanPurchaseAlone($request, $course),
                'active' => true,
                'order' => (int) ($request->order ?? 1),
            ];

            $cachePayload = [
                'status' => 'queued',
                'context' => 'admin',
                'upload_id' => $uploadId,
                'total_chunks' => $total,
                'extension' => $ext,
                'video_provider' => $request->input('video_provider'),
                'lesson_row' => $lessonRow,
                'thumbnail_local_relative' => $thumbnailLocal,
                'thumbnail_public_dir' => 'thumbnails/lessons',
            ];

            Cache::put('video_chunk_merge:'.$mergeToken, $cachePayload, now()->addDay());
            Cache::put($mapKey, $mergeToken, now()->addDay());
            FinalizeChunkedVideoUpload::dispatch($mergeToken);

            return response()->json([
                'async' => true,
                'merge_token' => $mergeToken,
                'status' => 'queued',
                'message' => 'جاري دمج الأجزاء ومعالجة الفيديو في الخلفية.',
            ], 202);
        }

        try {
            $merged = $this->lessonVideoProcessing->mergeChunkDirectoryToTempFile($uploadId, $total, $ext);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $tempRelative = $merged['relative'];
        $fullTempPath = $merged['full_path'];
        $totalBytes = $merged['bytes'];

        $maxBytes = $maxTotalKb * 1024;
        if ($totalBytes > $maxBytes) {
            Storage::disk('local')->delete($tempRelative);
            $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

            return response()->json([
                'message' => 'Video exceeds maximum allowed size ('.$maxTotalKb.' KB).',
            ], 422);
        }

        $videoProvider = $request->input('video_provider');

        try {
            [$videoProvider, $videoReference, $message] = $this->lessonVideoProcessing->processUploadedVideoFile(
                $fullTempPath,
                $request,
                $course,
                $videoProvider,
                $ext,
                $tempRelative
            );
        } catch (\RuntimeException $e) {
            Storage::disk('local')->delete($tempRelative);
            $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

            return response()->json([
                'message' => $e->getMessage(),
                'error' => $e->getMessage(),
            ], 422);
        }

        $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

        $thumbnailPath = null;
        if ($request->hasFile('thumbnail')) {
            $thumbnailPath = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'section_id' => $request->section_id,
            'title' => $request->title,
            'description' => $request->description,
            'price' => $request->filled('price') ? (float) $request->price : null,
            'duration' => $request->filled('duration') ? (int) $request->duration : 0,
            'video_provider' => $videoProvider,
            'video_reference' => $videoReference,
            'is_free' => $request->boolean('is_free', false),
            'can_download' => $request->boolean('can_download', true),
            'can_purchase_alone' => $this->resolvedCanPurchaseAlone($request, $course),
            'thumbnail' => $thumbnailPath,
            'active' => true,
            'order' => (int) ($request->order ?? 1),
        ]);

        FullCourseContentNotifier::lessonPublished($lesson->fresh());

        return response()->json([
            'message' => $message,
            'lesson' => $lesson,
            'video_provider' => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }

    /**
     * Update video (any lesson) – including approval_status (pending, approved, rejected).
     */
    public function update(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);
        $wasVisibleToStudents = $lesson->isApprovedForStudents();

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'duration' => 'nullable|integer|min:0',
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order' => 'nullable|integer',
            'approval_status' => 'sometimes|in:pending,approved,rejected',
            'active' => 'boolean',
            'video_provider' => 'sometimes|in:youtube,local,aws',
            'thumbnail' => 'nullable|image|max:2048',
            'youtube_url' => 'sometimes|url',
        ]);

        $data = $request->only([
            'title', 'description', 'price', 'duration', 'order',
            'approval_status', 'video_provider',
        ]);

        // لا تُعاد كتابة الحقول المنطقية إن لم تُرسل؛ وإلا boolean() يعيد false للمفقود ويُصفّر can_download عند «نشر» جزئي.
        if ($request->exists('is_free')) {
            $data['is_free'] = $request->boolean('is_free');
        }
        if ($request->exists('can_download')) {
            $data['can_download'] = $request->boolean('can_download');
        }
        if ($request->exists('can_purchase_alone')) {
            $data['can_purchase_alone'] = $request->boolean('can_purchase_alone');
        }
        if ($request->exists('active')) {
            $data['active'] = $request->boolean('active');
        }

        if ($request->has('youtube_url')) {
            $data['video_provider'] = 'youtube';
            $data['video_reference'] = $request->youtube_url;
        }

        if ($request->hasFile('thumbnail')) {
            $oldThumb = $lesson->getRawOriginal('thumbnail');
            if ($oldThumb && ! filter_var($oldThumb, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($oldThumb);
            }
            $data['thumbnail'] = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson->update($data);

        if ($request->has('title') && $lesson->video_provider === 'youtube') {
            $this->youtubeService->updateVideo($lesson->video_reference, [
                'title' => $lesson->title,
                'description' => $lesson->description,
            ]);
        }

        $lesson = $lesson->fresh();
        if (! $wasVisibleToStudents && $lesson->isApprovedForStudents()) {
            FullCourseContentNotifier::lessonPublished($lesson);
        }

        return response()->json([
            'message' => 'Video updated successfully',
            'lesson' => $lesson,
        ]);
    }

    /**
     * Delete video (any lesson)
     */
    public function destroy($lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        if ($lesson->video_provider === 'youtube') {
            $this->youtubeService->deleteVideo($lesson->video_reference);
        } elseif ($lesson->video_provider === 'local' && $lesson->video_reference) {
            Storage::disk('public')->delete($lesson->video_reference);
        } elseif ($lesson->video_provider === 'aws' && $lesson->video_reference) {
            Storage::disk('s3')->delete($lesson->video_reference);
        }

        $lesson->delete();

        return response()->json(['message' => 'Video deleted successfully']);
    }

    private function resolvedCanPurchaseAlone(Request $request, Course $course): bool
    {
        if ($request->has('can_purchase_alone')) {
            return $request->boolean('can_purchase_alone');
        }

        return $course->defaultLessonCanPurchaseAlone();
    }

    /**
     * Make first lesson free (any course)
     */
    public function makeFirstFree(Request $request, $courseId)
    {
        $course = Course::findOrFail($courseId);

        $firstLesson = Lesson::where('course_id', $courseId)
            ->orderBy('order')
            ->first();

        if ($firstLesson) {
            $firstLesson->update(['is_free' => true]);
        }

        return response()->json(['message' => 'First lesson set as free']);
    }
}
