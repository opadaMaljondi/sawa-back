<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\LessonVideoProcessingService;
use App\Services\YouTubeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoController extends Controller
{
    public function __construct(
        protected YouTubeService $youtubeService,
        protected LessonVideoProcessingService $lessonVideoProcessing
    ) {
    }

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
            'course_id'          => 'required|exists:courses,id',
            'section_id'         => 'nullable|exists:course_sections,id',
            'title'              => 'required|string|max:255',
            'description'        => 'nullable|string',
            'price'              => 'nullable|numeric|min:0',
            'duration'           => 'nullable|integer|min:0',
            'is_free'            => 'boolean',
            'can_download'       => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order'              => 'nullable|integer',
            'video_provider'     => 'nullable|in:youtube,local,aws',
            'thumbnail'          => 'nullable|image|max:2048',
            // One of these is required (youtube_url and video_url are aliases):
            'youtube_url'  => 'required_without_all:video_url,video|nullable|url',
            'video_url'    => 'required_without_all:youtube_url,video|nullable|url',
            'video'        => 'required_without_all:youtube_url,video_url|nullable|file|mimes:mp4,avi,mov|max:512000',
        ]);

        $course = Course::findOrFail($request->course_id);

        // ── Mode A: YouTube URL provided directly ─────────────────────────────
        $youtubeUrl = $request->filled('youtube_url') ? $request->youtube_url : $request->video_url;
        $videoProvider = $request->input('video_provider', 'youtube');

        if ($youtubeUrl) {
            $videoProvider  = 'youtube';
            $videoReference = $youtubeUrl;
            $message        = 'Lesson created with YouTube URL.';

        // ── Mode B: File upload ───────────────────────────────────────────────
        } else {
            $tempPath     = $request->file('video')->store('videos/temp', 'local');
            $fullTempPath = storage_path('app/' . $tempPath);

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
                    'error'   => $e->getMessage(),
                ], 422);
            }
        }

        $thumbnailPath = null;
        if ($request->hasFile('thumbnail')) {
            $thumbnailPath = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson = Lesson::create([
            'course_id'          => $course->id,
            'section_id'         => $request->section_id,
            'title'              => $request->title,
            'description'        => $request->description,
            'price'              => $request->filled('price') ? (float) $request->price : null,
            'duration'           => $request->filled('duration') ? (int) $request->duration : 0,
            'video_provider'     => $videoProvider,
            'video_reference'    => $videoReference,
            'is_free'            => $request->boolean('is_free', false),
            'can_download'       => $request->boolean('can_download', true),
            'can_purchase_alone' => $request->boolean('can_purchase_alone', false),
            'thumbnail'          => $thumbnailPath,
            'active'             => true,
            'order'              => (int) ($request->order ?? 1),
        ]);

        return response()->json([
            'message'           => $message,
            'lesson'            => $lesson,
            'video_provider'    => $videoProvider,
            'video_playback_url'=> $lesson->video_playback_url,
        ], 201);
    }

    /**
     * Receive one chunk of a chunked video upload (local / aws only). Call completeChunkUpload when done.
     */
    public function uploadChunk(Request $request)
    {
        $maxKb = max(1, (int) config('video.chunk_max_kb', 5120));
        $request->validate([
            'upload_id'    => 'required|uuid',
            'chunk_index'  => 'required|integer|min:0',
            'total_chunks' => 'required|integer|min:1|max:10000',
            'chunk'        => ['required', 'file', 'max:'.$maxKb],
            'original_name'=> 'required|string|max:255',
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
            'received'    => true,
            'chunk_index' => $request->integer('chunk_index'),
        ]);
    }

    /**
     * Merge chunks and create lesson (same outcome as POST /admin/videos with a single file).
     */
    public function completeChunkUpload(Request $request)
    {
        $maxTotalKb = max(1, (int) config('video.max_video_kb', 512000));

        $request->validate([
            'upload_id'          => 'required|uuid',
            'total_chunks'       => 'required|integer|min:1|max:10000',
            'original_name'      => 'required|string|max:255',
            'video_provider'     => 'required|in:local,aws',
            'course_id'          => 'required|exists:courses,id',
            'section_id'         => 'nullable|exists:course_sections,id',
            'title'              => 'required|string|max:255',
            'description'        => 'nullable|string',
            'price'              => 'nullable|numeric|min:0',
            'duration'           => 'nullable|integer|min:0',
            'is_free'            => 'boolean',
            'can_download'       => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order'              => 'nullable|integer',
            'thumbnail'          => 'nullable|image|max:2048',
        ]);

        $ext = strtolower((string) pathinfo($request->original_name, PATHINFO_EXTENSION));
        if (! in_array($ext, ['mp4', 'avi', 'mov'], true)) {
            return response()->json(['message' => 'Invalid video type. Allowed: mp4, avi, mov.'], 422);
        }

        $uploadId = $request->upload_id;
        $total    = $request->integer('total_chunks');
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);

        if (! is_dir($chunkDir)) {
            return response()->json(['message' => 'Upload session not found or expired. Upload chunks first.'], 422);
        }

        $outName      = Str::random(40).'.'.$ext;
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

            return response()->json([
                'message' => 'Video exceeds maximum allowed size ('.$maxTotalKb.' KB).',
            ], 422);
        }

        if ($totalBytes === 0) {
            Storage::disk('local')->delete($tempRelative);
            $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

            return response()->json(['message' => 'Merged file is empty.'], 422);
        }

        $course        = Course::findOrFail($request->course_id);
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
                'error'   => $e->getMessage(),
            ], 422);
        }

        $this->lessonVideoProcessing->deleteChunkDirectory($uploadId);

        $thumbnailPath = null;
        if ($request->hasFile('thumbnail')) {
            $thumbnailPath = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson = Lesson::create([
            'course_id'          => $course->id,
            'section_id'         => $request->section_id,
            'title'              => $request->title,
            'description'        => $request->description,
            'price'              => $request->filled('price') ? (float) $request->price : null,
            'duration'           => $request->filled('duration') ? (int) $request->duration : 0,
            'video_provider'     => $videoProvider,
            'video_reference'    => $videoReference,
            'is_free'            => $request->boolean('is_free', false),
            'can_download'       => $request->boolean('can_download', true),
            'can_purchase_alone' => $request->boolean('can_purchase_alone', false),
            'thumbnail'          => $thumbnailPath,
            'active'             => true,
            'order'              => (int) ($request->order ?? 1),
        ]);

        return response()->json([
            'message'            => $message,
            'lesson'             => $lesson,
            'video_provider'     => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }

    /**
     * Update video (any lesson) – including approval_status (pending, approved, rejected).
     */
    public function update(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        $request->validate([
            'title'              => 'sometimes|string|max:255',
            'description'        => 'nullable|string',
            'price'              => 'nullable|numeric|min:0',
            'duration'           => 'nullable|integer|min:0',
            'is_free'            => 'boolean',
            'can_download'       => 'boolean',
            'can_purchase_alone' => 'boolean',
            'order'              => 'nullable|integer',
            'approval_status'    => 'sometimes|in:pending,approved,rejected',
            'active'             => 'boolean',
            'video_provider'     => 'sometimes|in:youtube,local,aws',
            'thumbnail'          => 'nullable|image|max:2048',
            'youtube_url'        => 'sometimes|url',
        ]);

        $data = $request->only([
            'title', 'description', 'price', 'duration', 'order',
            'approval_status', 'video_provider',
        ]);

        $data['is_free'] = $request->boolean('is_free');
        $data['can_download'] = $request->boolean('can_download');
        $data['can_purchase_alone'] = $request->boolean('can_purchase_alone');
        $data['active'] = $request->boolean('active');

        if ($request->has('youtube_url')) {
            $data['video_provider'] = 'youtube';
            $data['video_reference'] = $request->youtube_url;
        }

        if ($request->hasFile('thumbnail')) {
            if ($lesson->thumbnail) {
                Storage::disk('public')->delete($lesson->thumbnail);
            }
            $data['thumbnail'] = $request->file('thumbnail')->store('thumbnails/lessons', 'public');
        }

        $lesson->update($data);

        if ($request->has('title') && $lesson->video_provider === 'youtube') {
            $this->youtubeService->updateVideo($lesson->video_reference, [
                'title'       => $lesson->title,
                'description' => $lesson->description,
            ]);
        }

        return response()->json([
            'message' => 'Video updated successfully',
            'lesson'  => $lesson->fresh(),
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
