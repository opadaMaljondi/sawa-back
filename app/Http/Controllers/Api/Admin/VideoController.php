<?php

namespace App\Http\Controllers\Api\Admin;

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
     * Upload video (أي كورس)
     */
    public function upload(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'section_id' => 'nullable|exists:course_sections,id',
            'title' => 'required|string|max:255',
            'video' => 'required|file|mimes:mp4,avi,mov|max:10240',
            'is_free' => 'boolean',
            'order' => 'nullable|integer',
        ]);

        $course = Course::findOrFail($request->course_id);
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
            // Fallback: save video locally when YouTube is not configured or fails
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
            'active' => true,
            'order' => (int) ($request->order ?? 1),
        ]);

        $message = $videoProvider === 'youtube'
            ? 'Video uploaded successfully to YouTube.'
            : 'Video saved locally. (YouTube upload skipped: ' . ($this->youtubeService->getLastError() ?? 'not configured') . ')';

        return response()->json([
            'message' => $message,
            'lesson' => $lesson,
            'video_provider' => $videoProvider,
            'video_playback_url' => $videoProvider === 'youtube' ? $lesson->video_reference : null,
        ], 201);
    }

    /**
     * Update video (any lesson) – including approval_status (pending, approved, rejected).
     */
    public function update(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'is_free' => 'boolean',
            'order' => 'nullable|integer',
            'approval_status' => 'sometimes|in:pending,approved,rejected',
            'active' => 'boolean',
        ]);

        $lesson->update($request->only([
            'title', 'description', 'is_free', 'order',
            'approval_status', 'active',
        ]));

        if ($request->has('title') && $lesson->video_provider === 'youtube') {
            $this->youtubeService->updateVideo($lesson->video_reference, [
                'title' => $request->title,
            ]);
        }

        return response()->json([
            'message' => 'Video updated successfully',
            'lesson' => $lesson->fresh(),
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
