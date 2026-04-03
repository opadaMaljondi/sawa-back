<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\YouTubeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoController extends Controller
{
    protected YouTubeService $youtubeService;

    public function __construct(YouTubeService $youtubeService)
    {
        $this->youtubeService = $youtubeService;
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
}
