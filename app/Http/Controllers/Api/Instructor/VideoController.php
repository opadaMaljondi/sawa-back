<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Services\YouTubeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

        // حفظ الفيديو مؤقتاً
        $videoPath = $request->file('video')->store('videos/temp', 'local');

        // رفع الفيديو على YouTube
        $videoId = $this->youtubeService->uploadVideo(
            storage_path('app/' . $videoPath),
            [
                'title' => $request->title,
                'description' => "Course: {$course->title}",
                'privacy_status' => 'unlisted',
            ]
        );

        if (!$videoId) {
            return response()->json(['message' => 'Failed to upload video'], 500);
        }

        // إنشاء الدرس
        $lesson = Lesson::create([
            'course_id' => $course->id,
            'course_section_id' => $request->section_id,
            'title' => $request->title,
            'video_provider' => 'youtube',
            'video_reference' => $videoId,
            'is_free' => $request->is_free ?? false,
            'is_active' => false, // يحتاج موافقة الأدمن
            'order' => $request->order ?? 1,
        ]);

        // حذف الملف المؤقت
        Storage::delete($videoPath);

        return response()->json([
            'message' => 'Video uploaded successfully. Waiting for admin approval.',
            'lesson' => $lesson,
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
