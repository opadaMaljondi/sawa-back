<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\LessonVideoProcessingService;
use App\Services\YouTubeService;
use App\Support\FullCourseContentNotifier;
use App\Support\InstructorAdminNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class VideoController extends Controller
{
    /** مفاتيح يُسمح بدمجها من حقل metadata (JSON) مع multipart */
    private const LESSON_METADATA_JSON_KEYS = [
        'course_id', 'section_id', 'title', 'description', 'duration', 'price',
        'is_free', 'can_download', 'can_purchase_alone', 'order', 'video_provider',
    ];

    public function __construct(
        protected YouTubeService $youtubeService,
        protected LessonVideoProcessingService $lessonVideoProcessing
    ) {}

    /**
     * Upload video
     */
    public function upload(Request $request)
    {
        // التحقق من الصلاحيات
        if (! auth()->user()->hasPermissionTo('create video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        if ($err = $this->mergeLessonMetadataJson($request)) {
            return $err;
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'video' => 'required|file|mimes:mp4,avi,mov|max:10240', // KB — راجع config للملفات الكبيرة
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'order' => 'nullable|integer',
            'video_provider' => 'nullable|in:youtube,local,aws',
            'metadata' => 'nullable|string|max:65535',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $request->validate([
            'section_id' => [
                'required',
                Rule::exists('course_sections', 'id')->where(fn ($q) => $q->where('course_id', $course->id)),
            ],
            'description' => 'nullable|string',
            'duration' => 'required|integer|min:1|max:864000',
            'price' => 'nullable|numeric|min:0',
            'can_purchase_alone' => 'boolean',
            'thumbnail' => 'nullable|image|max:2048',
        ]);

        $videoProvider = $request->input('video_provider', 'youtube');

        $tempPath = $request->file('video')->store('videos/temp', 'local');
        $fullTempPath = storage_path('app/'.$tempPath);

        $videoReference = null;

        if ($videoProvider === 'aws') {
            $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
            $s3Path = "videos/lessons/course_{$course->id}/".Str::random(40).'.'.$extension;
            try {
                Storage::disk('s3')->put($s3Path, file_get_contents($fullTempPath), ['visibility' => 'public']);
            } catch (\Throwable $e) {
                Storage::disk('local')->delete($tempPath);

                return response()->json([
                    'message' => 'Failed to upload video to S3: '.$e->getMessage(),
                ], 422);
            }
            Storage::disk('local')->delete($tempPath);
            $videoReference = $s3Path;
        } elseif ($videoProvider === 'local') {
            $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
            $localPath = "videos/lessons/course_{$course->id}/".Str::random(40).'.'.$extension;
            Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
            Storage::disk('local')->delete($tempPath);
            $videoReference = $localPath;
        } else {
            $videoId = $this->youtubeService->uploadVideo($fullTempPath, [
                'title' => $request->title,
                'description' => $request->filled('description')
                    ? (string) $request->description
                    : "Course: {$course->title}",
                'privacy_status' => 'unlisted',
            ]);

            if ($videoId) {
                $videoReference = $videoId;
                Storage::disk('local')->delete($tempPath);
            } else {
                $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
                $localPath = "videos/lessons/course_{$course->id}/".Str::random(40).'.'.$extension;
                Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
                Storage::disk('local')->delete($tempPath);
                $videoProvider = 'local';
                $videoReference = $localPath;
            }
        }

        $thumbnailPath = $this->storeLessonThumbnail($request, $course);

        $isFree = $request->boolean('is_free', false);

        $publishInstantly = $this->instructorMayPublishLessonInstantly();

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'section_id' => $request->section_id,
            'title' => $request->title,
            'description' => $this->normalizedLessonDescription($request),
            'duration' => (int) $request->duration,
            'thumbnail' => $thumbnailPath,
            'price' => $this->resolvedLessonPrice($request, $isFree),
            'video_provider' => $videoProvider,
            'video_reference' => $videoReference,
            'is_free' => $isFree,
            'can_download' => $request->boolean('can_download', true),
            'can_purchase_alone' => $this->resolvedCanPurchaseAlone($request, $course),
            'approval_status' => $publishInstantly ? 'approved' : 'pending',
            'active' => $publishInstantly,
            'order' => (int) ($request->order ?? 1),
        ]);

        if ($publishInstantly) {
            FullCourseContentNotifier::lessonPublished($lesson->fresh());
            InstructorAdminNotifier::notify(
                $course,
                'تم نشر درس فيديو جديد فوراً (لا يوجد انتظار موافقة إدارية)',
                'إطلاع أمني: درس تم نشره',
                [
                    'type' => 'instructor_lesson_auto_published',
                    'lesson_id' => $lesson->id,
                ]
            );
        } else {
            InstructorAdminNotifier::notify($course, 'تم رفع درس فيديو جديد يحتاج مراجعة', null, [
                'type' => 'instructor_lesson_pending',
                'lesson_id' => $lesson->id,
            ]);
        }

        if ($publishInstantly) {
            $message = 'Video uploaded and published successfully.';
        } elseif ($videoProvider === 'youtube') {
            $message = 'Video uploaded successfully. Waiting for admin approval.';
        } elseif ($videoProvider === 'aws') {
            $message = 'Video uploaded to S3. Waiting for admin approval.';
        } else {
            $message = 'Video saved locally. Waiting for admin approval.';
            if ($request->input('video_provider') === 'youtube') {
                $message .= ' (YouTube: '.($this->youtubeService->getLastError() ?? 'not configured').')';
            }
        }

        return response()->json([
            'message' => $message,
            'lesson' => $lesson->fresh(),
            'video_provider' => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }

    /**
     * Update video
     */
    public function update(Request $request, $lessonId)
    {
        $lesson = Lesson::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($lessonId);

        // التحقق من الصلاحيات
        if (! auth()->user()->hasPermissionTo('edit video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'duration' => 'sometimes|integer|min:1|max:864000',
            'section_id' => [
                'sometimes',
                Rule::exists('course_sections', 'id')->where(fn ($q) => $q->where('course_id', $lesson->course_id)),
            ],
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'can_purchase_alone' => 'boolean',
            'price' => 'nullable|numeric|min:0',
            'order' => 'nullable|integer',
            'thumbnail' => 'nullable|image|max:2048',
        ]);

        $data = $request->only(['title', 'description', 'duration', 'section_id', 'order', 'price']);
        if ($request->has('is_free')) {
            $data['is_free'] = $request->boolean('is_free');
            if ($data['is_free']) {
                $data['price'] = 0;
            }
        }
        if ($request->has('can_download')) {
            $data['can_download'] = $request->boolean('can_download');
        }
        if ($request->has('can_purchase_alone')) {
            $data['can_purchase_alone'] = $request->boolean('can_purchase_alone');
        }

        if ($request->hasFile('thumbnail')) {
            $this->deleteStoredThumbnailIfRelative($lesson->getRawOriginal('thumbnail'));
            $data['thumbnail'] = $request->file('thumbnail')->store(
                'thumbnails/lessons/course_'.$lesson->course_id,
                'public'
            );
        }

        $lesson->update($data);

        $lesson->loadMissing('course');
        if ($lesson->course) {
            InstructorAdminNotifier::notify(
                $lesson->course,
                'تم تعديل معلومات درس فيديو «'.$lesson->title.'».',
                null,
                ['type' => 'instructor_lesson_updated', 'lesson_id' => $lesson->id]
            );
        }

        // تحديث معلومات YouTube إن لزم
        if ($lesson->video_provider === 'youtube' && ($request->filled('title') || $request->filled('description'))) {
            $this->youtubeService->updateVideo($lesson->video_reference, array_filter([
                'title' => $request->input('title', $lesson->title),
                'description' => $request->has('description') ? $request->input('description') : null,
            ], fn ($v) => $v !== null));
        }

        return response()->json([
            'message' => 'Video updated successfully',
            'lesson' => $lesson->fresh(),
        ]);
    }

    /**
     * Delete video
     */
    public function destroy($lessonId)
    {
        $lesson = Lesson::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($lessonId);

        // التحقق من الصلاحيات
        if (! auth()->user()->hasPermissionTo('delete video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        if ($lesson->video_provider === 'youtube') {
            $this->youtubeService->deleteVideo($lesson->video_reference);
        } elseif ($lesson->video_provider === 'local' && $lesson->video_reference) {
            Storage::disk('public')->delete($lesson->video_reference);
        } elseif ($lesson->video_provider === 'aws' && $lesson->video_reference) {
            Storage::disk('s3')->delete($lesson->video_reference);
        }

        $this->deleteStoredThumbnailIfRelative($lesson->getRawOriginal('thumbnail'));

        $lesson->delete();

        return response()->json(['message' => 'Video deleted successfully']);
    }

    /**
     * Make first lesson free
     */
    public function makeFirstFree(Request $request, $courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        $firstLesson = Lesson::where('course_id', $courseId)
            ->orderBy('order')
            ->first();

        if ($firstLesson) {
            $firstLesson->update(['is_free' => true]);
        }

        return response()->json(['message' => 'First lesson set as free']);
    }

    /**
     * Chunk upload (same as admin). Upload chunks then POST complete-chunk.
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

        $dir = 'videos/chunks/'.$request->upload_id;
        $request->file('chunk')->storeAs($dir, (string) $request->chunk_index, 'local');

        return response()->json([
            'received' => true,
            'chunk_index' => $request->integer('chunk_index'),
        ]);
    }

    /**
     * جلسة الرفع المجزأ: موضع الاستئناف (أول جزء مفقود).
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
     * إلغاء جلسة الرفع المجزأ وحذف الأجزاء من التخزين المؤقت.
     */
    public function abandonChunkUpload(Request $request)
    {
        $request->validate([
            'upload_id' => 'required|uuid',
        ]);
        $this->lessonVideoProcessing->deleteChunkDirectory($request->input('upload_id'));

        return response()->json(['message' => 'تم إلغاء جلسة الرفع وحذف الأجزاء المؤقتة.']);
    }

    /**
     * Merge chunks and create lesson (instructor: pending approval).
     */
    public function completeChunkUpload(Request $request)
    {
        if (! auth()->user()->hasPermissionTo('create video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        if ($err = $this->mergeLessonMetadataJson($request)) {
            return $err;
        }

        $maxTotalKb = max(1, (int) config('video.max_video_kb', 512000));

        $request->validate([
            'upload_id' => 'required|uuid',
            'total_chunks' => 'required|integer|min:1|max:10000',
            'original_name' => 'required|string|max:255',
            'video_provider' => 'required|in:local,aws',
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'is_free' => 'boolean',
            'can_download' => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order' => 'nullable|integer',
            'metadata' => 'nullable|string|max:65535',
        ]);

        $course = Course::where('instructor_id', auth()->id())->findOrFail($request->course_id);

        $request->validate([
            'section_id' => [
                'required',
                Rule::exists('course_sections', 'id')->where(fn ($q) => $q->where('course_id', $course->id)),
            ],
            'description' => 'nullable|string',
            'duration' => 'required|integer|min:1|max:864000',
            'price' => 'nullable|numeric|min:0',
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
            return response()->json(['message' => 'Upload session not found. Upload chunks first.'], 422);
        }

        $outName = Str::random(40).'.'.$ext;
        $tempRelative = 'videos/temp/'.$outName;
        $fullTempPath = storage_path('app/'.$tempRelative);

        $outHandle = fopen($fullTempPath, 'wb');
        if ($outHandle === false) {
            return response()->json(['message' => 'Could not create merged file.'], 500);
        }

        $totalBytes = 0;
        for ($i = 0; $i < $total; $i++) {
            $part = $chunkDir.DIRECTORY_SEPARATOR.$i;
            if (! is_file($part)) {
                fclose($outHandle);
                @unlink($fullTempPath);

                return response()->json([
                    'message' => "Missing chunk {$i} of {$total}. Re-upload all parts in order.",
                ], 422);
            }
            $in = fopen($part, 'rb');
            if ($in === false) {
                fclose($outHandle);
                @unlink($fullTempPath);

                return response()->json(['message' => "Could not read chunk {$i}."], 500);
            }
            $totalBytes += stream_copy_to_stream($in, $outHandle);
            fclose($in);
        }
        fclose($outHandle);

        $maxBytes = $maxTotalKb * 1024;
        if ($totalBytes > $maxBytes) {
            Storage::disk('local')->delete($tempRelative);
            $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

            return response()->json(['message' => 'Video exceeds maximum allowed size ('.$maxTotalKb.' KB).'], 422);
        }

        if ($totalBytes === 0) {
            Storage::disk('local')->delete($tempRelative);
            $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

            return response()->json(['message' => 'Merged file is empty.'], 422);
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

            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

        $thumbnailPath = $this->storeLessonThumbnail($request, $course);

        $isFree = $request->boolean('is_free', false);

        $publishInstantly = $this->instructorMayPublishLessonInstantly();

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'section_id' => $request->section_id,
            'title' => $request->title,
            'description' => $this->normalizedLessonDescription($request),
            'duration' => (int) $request->duration,
            'thumbnail' => $thumbnailPath,
            'price' => $this->resolvedLessonPrice($request, $isFree),
            'video_provider' => $videoProvider,
            'video_reference' => $videoReference,
            'is_free' => $isFree,
            'can_download' => $request->boolean('can_download', true),
            'can_purchase_alone' => $this->resolvedCanPurchaseAlone($request, $course),
            'approval_status' => $publishInstantly ? 'approved' : 'pending',
            'active' => $publishInstantly,
            'order' => (int) ($request->order ?? 1),
        ]);

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

        return response()->json([
            'message' => $publishInstantly ? 'Video uploaded and published successfully.' : $message,
            'lesson' => $lesson->fresh(),
            'video_provider' => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }

    private function storeLessonThumbnail(Request $request, Course $course): ?string
    {
        if (! $request->hasFile('thumbnail')) {
            return null;
        }

        return $request->file('thumbnail')->store(
            'thumbnails/lessons/course_'.$course->id,
            'public'
        );
    }

    private function deleteStoredThumbnailIfRelative(?string $path): void
    {
        if ($path === null || $path === '') {
            return;
        }
        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return;
        }
        Storage::disk('public')->delete($path);
    }

    /**
     * دمج حقول النموذج المرسلة كسلسلة JSON في حقل metadata (مفيد مع multipart / chunk).
     */
    private function mergeLessonMetadataJson(Request $request): ?JsonResponse
    {
        if (! $request->filled('metadata')) {
            return null;
        }
        $decoded = json_decode((string) $request->input('metadata'), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return response()->json(['message' => 'Invalid JSON in metadata field.'], 422);
        }
        if (! is_array($decoded)) {
            return response()->json(['message' => 'metadata must be a JSON object.'], 422);
        }
        $subset = array_intersect_key($decoded, array_flip(self::LESSON_METADATA_JSON_KEYS));
        if ($subset !== []) {
            $request->merge($subset);
        }

        return null;
    }

    private function resolvedCanPurchaseAlone(Request $request, Course $course): bool
    {
        if ($request->has('can_purchase_alone')) {
            return $request->boolean('can_purchase_alone');
        }

        return $course->defaultLessonCanPurchaseAlone();
    }

    private function normalizedLessonDescription(Request $request): ?string
    {
        if (! $request->exists('description')) {
            return null;
        }
        $d = $request->input('description');
        if ($d === null || $d === '') {
            return null;
        }

        return is_string($d) ? $d : (string) $d;
    }

    private function instructorMayPublishLessonInstantly(): bool
    {
        $user = auth()->user();

        return $user && $user->hasPermissionTo('publish video instantly');
    }

    private function resolvedLessonPrice(Request $request, bool $isFree): ?float
    {
        if ($isFree) {
            return 0.0;
        }
        if ($request->exists('price') && $request->input('price') !== '' && $request->input('price') !== null) {
            return (float) $request->input('price');
        }

        return null;
    }
}
