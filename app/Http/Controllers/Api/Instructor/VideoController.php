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
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $tempPath = $request->file('video')->store('videos/temp', 'local');
        $fullTempPath = storage_path('app/' . $tempPath);

        $videoId = $this->youtubeService->uploadVideo($fullTempPath, [
            'title' => $request->title,
            'description' => "Course: {$course->title}",
            'privacy_status' => 'unlisted',
        ]);

        $videoProvider = 'youtube';
        $videoReference = null;

        if ($videoId) {
            $videoReference = $videoId;
            Storage::delete($tempPath);
        } else {
            $extension = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
            $localFileName = Str::random(40) . '.' . $extension;
            $localPath = "videos/lessons/course_{$course->id}/{$localFileName}";
            Storage::disk('local')->put($localPath, file_get_contents($fullTempPath));
            Storage::delete($tempPath);
            $videoProvider = 'local';
            $videoReference = $localPath;
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

        $message = $videoProvider === 'youtube'
            ? 'Video uploaded successfully. Waiting for admin approval.'
            : 'Video saved locally. Waiting for admin approval. (YouTube: ' . ($this->youtubeService->getLastError() ?? 'not configured') . ')';

        return response()->json([
            'message' => $message,
            'lesson' => $lesson,
            'video_provider' => $videoProvider,
            'video_playback_url' => $videoProvider === 'youtube' ? $lesson->video_reference : null,
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

        // حذف من YouTube
        if ($lesson->video_provider === 'youtube') {
            $this->youtubeService->deleteVideo($lesson->video_reference);
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
