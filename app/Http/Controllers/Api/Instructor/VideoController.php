<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\LessonVideoProcessingService;
use App\Services\YouTubeService;
use App\Support\InstructorAdminNotifier;
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
     * Upload video
     */
    public function upload(Request $request)
    {
        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('create video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'section_id' => 'nullable|exists:course_sections,id',
            'title' => 'required|string|max:255',
            'video' => 'required|file|mimes:mp4,avi,mov|max:10240', // 10GB max
            'is_free' => 'boolean',
            'order' => 'nullable|integer',
            'video_provider' => 'nullable|in:youtube,local,aws',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $videoProvider = $request->input('video_provider', 'youtube');

        $tempPath = $request->file('video')->store('videos/temp', 'local');
        $fullTempPath = storage_path('app/' . $tempPath);

        $videoReference = null;

        if ($videoProvider === 'aws') {
            $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
            $s3Path = "videos/lessons/course_{$course->id}/" . Str::random(40) . '.' . $extension;
            try {
                Storage::disk('s3')->put($s3Path, file_get_contents($fullTempPath), ['visibility' => 'public']);
            } catch (\Throwable $e) {
                Storage::disk('local')->delete($tempPath);

                return response()->json([
                    'message' => 'Failed to upload video to S3: ' . $e->getMessage(),
                ], 422);
            }
            Storage::disk('local')->delete($tempPath);
            $videoReference = $s3Path;
        } elseif ($videoProvider === 'local') {
            $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
            $localPath = "videos/lessons/course_{$course->id}/" . Str::random(40) . '.' . $extension;
            Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
            Storage::disk('local')->delete($tempPath);
            $videoReference = $localPath;
        } else {
            $videoId = $this->youtubeService->uploadVideo($fullTempPath, [
                'title' => $request->title,
                'description' => "Course: {$course->title}",
                'privacy_status' => 'unlisted',
            ]);

            if ($videoId) {
                $videoReference = $videoId;
                Storage::disk('local')->delete($tempPath);
            } else {
                $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
                $localPath = "videos/lessons/course_{$course->id}/" . Str::random(40) . '.' . $extension;
                Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
                Storage::disk('local')->delete($tempPath);
                $videoProvider = 'local';
                $videoReference = $localPath;
            }
        }

        $lesson = Lesson::create([
            'course_id' => $course->id,
            'section_id' => $request->section_id,
            'title' => $request->title,
            'video_provider' => $videoProvider,
            'video_reference' => $videoReference,
            'is_free' => $request->boolean('is_free', false),
            'active' => false,
            'order' => (int) ($request->order ?? 1),
        ]);

        InstructorAdminNotifier::notify($course, 'تم رفع درس فيديو جديد يحتاج مراجعة');

        if ($videoProvider === 'youtube') {
            $message = 'Video uploaded successfully. Waiting for admin approval.';
        } elseif ($videoProvider === 'aws') {
            $message = 'Video uploaded to S3. Waiting for admin approval.';
        } else {
            $message = 'Video saved locally. Waiting for admin approval.';
            if ($request->input('video_provider') === 'youtube') {
                $message .= ' (YouTube: ' . ($this->youtubeService->getLastError() ?? 'not configured') . ')';
            }
        }

        return response()->json([
            'message' => $message,
            'lesson' => $lesson,
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
        if (!auth()->user()->hasPermissionTo('edit video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'is_free' => 'boolean',
            'order' => 'nullable|integer',
        ]);

        $lesson->update($request->only(['title', 'is_free', 'order']));

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
        if ($request->has('title') && $lesson->video_provider === 'youtube') {
            $this->youtubeService->updateVideo($lesson->video_reference, [
                'title' => $request->title,
            ]);
        }

        return response()->json([
            'message' => 'Video updated successfully',
            'lesson' => $lesson,
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
        if (!auth()->user()->hasPermissionTo('delete video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

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
     * Merge chunks and create lesson (instructor: pending approval).
     */
    public function completeChunkUpload(Request $request)
    {
        if (! auth()->user()->hasPermissionTo('create video')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $maxTotalKb = max(1, (int) config('video.max_video_kb', 512000));

        $request->validate([
            'upload_id'     => 'required|uuid',
            'total_chunks'  => 'required|integer|min:1|max:10000',
            'original_name' => 'required|string|max:255',
            'video_provider'=> 'required|in:local,aws',
            'course_id'     => 'required|exists:courses,id',
            'section_id'    => 'nullable|exists:course_sections,id',
            'title'         => 'required|string|max:255',
            'is_free'       => 'boolean',
            'order'         => 'nullable|integer',
        ]);

        $course = Course::where('instructor_id', auth()->id())->findOrFail($request->course_id);

        $ext = strtolower((string) pathinfo($request->original_name, PATHINFO_EXTENSION));
        if (! in_array($ext, ['mp4', 'avi', 'mov'], true)) {
            return response()->json(['message' => 'Invalid video type. Allowed: mp4, avi, mov.'], 422);
        }

        $uploadId = $request->upload_id;
        $total    = $request->integer('total_chunks');
        $chunkDir = storage_path('app/videos/chunks/'.$uploadId);

        if (! is_dir($chunkDir)) {
            return response()->json(['message' => 'Upload session not found. Upload chunks first.'], 422);
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
                    'message' => "Missing chunk {$i} of {$total}.",
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

        $lesson = Lesson::create([
            'course_id'       => $course->id,
            'section_id'      => $request->section_id,
            'title'           => $request->title,
            'video_provider'  => $videoProvider,
            'video_reference' => $videoReference,
            'is_free'         => $request->boolean('is_free', false),
            'active'          => false,
            'order'           => (int) ($request->order ?? 1),
        ]);

        InstructorAdminNotifier::notify($course, 'تم رفع درس (جزئي) يحتاج مراجعة');

        return response()->json([
            'message'            => $message,
            'lesson'             => $lesson,
            'video_provider'     => $videoProvider,
            'video_playback_url' => $lesson->video_playback_url,
        ], 201);
    }
}

