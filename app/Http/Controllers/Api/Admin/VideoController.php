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
            'video_provider'     => 'nullable|in:youtube,local',
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

            $uploadedUrl = null;
            // Only upload to YouTube if provider is youtube
            if ($videoProvider === 'youtube') {
                $uploadedUrl = $this->youtubeService->uploadVideo($fullTempPath, [
                    'title'          => $request->title,
                    'description'    => $request->description ?? "Course: {$course->title}",
                    'privacy_status' => 'unlisted',
                ]);
            }

            if ($uploadedUrl) {
                $videoReference = $uploadedUrl;
                Storage::disk('local')->delete($tempPath);
                $message = 'Video uploaded successfully to YouTube.';
            } else {
                // If user EXPLICITLY chose youtube, and it failed, return error
                if ($request->video_provider === 'youtube') {
                    Storage::disk('local')->delete($tempPath);
                    return response()->json([
                        'message' => 'Failed to upload video to YouTube: ' . ($this->youtubeService->getLastError() ?? 'Unauthorized/Unknown error'),
                        'error' => $this->youtubeService->getLastError()
                    ], 422);
                }

                // Otherwise (they chose local OR it was a best-effort without explicit provider), save locally
                $ext           = $request->file('video')->getClientOriginalExtension() ?: 'mp4';
                $localPath     = "videos/lessons/course_{$course->id}/" . Str::random(40) . ".{$ext}";
                
                Storage::disk('public')->put($localPath, file_get_contents($fullTempPath));
                Storage::disk('local')->delete($tempPath);
                
                $videoProvider  = 'local';
                $videoReference = $localPath;
                $message        = 'Video saved locally.';
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
            'video_provider'     => 'sometimes|in:youtube,local',
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
