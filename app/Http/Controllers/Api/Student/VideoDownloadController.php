<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\DownloadedLesson;
use App\Models\Lesson;
use App\Services\YouTubeService;
use App\Services\VideoEncryptionService;
use App\Services\YtDlpService;
use Illuminate\Http\Request;

class VideoDownloadController extends Controller
{
    protected VideoEncryptionService $encryptionService;
    protected YtDlpService $ytDlpService;

    public function __construct(VideoEncryptionService $encryptionService, YtDlpService $ytDlpService)
    {
        $this->encryptionService = $encryptionService;
        $this->ytDlpService = $ytDlpService;
    }

    /**
     * Download video for offline viewing
     */
    public function download(Request $request, $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);
        $student = auth()->user();

        if ($lesson->approval_status !== 'approved' || !$lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        // التحقق من الاشتراك
        if (!$student->hasAccessToLesson($lessonId)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        // التحقق من وجود الفيديو
        if (!$lesson->video_reference) {
            return response()->json(['message' => 'Video not available'], 404);
        }

        // تشفير الفيديو وحفظه
        $tempPath = storage_path('app/videos/temp/' . $lesson->video_reference);
        $encryptedPath = storage_path('app/videos/encrypted/' . $student->id . '/' . $lessonId . '.enc');

        if (!file_exists($tempPath)) {
            // No local cached file: return a direct download URL using yt-dlp
            $pageUrl = YouTubeService::playbackUrl((string) $lesson->video_reference);
            $format = $request->string('format')->toString() ?: null;
            $timeout = $request->integer('timeout');

            try {
                $directUrl = $this->ytDlpService->getDirectUrl($pageUrl, $format, $timeout > 0 ? $timeout : null);

                return response()->json([
                    'message' => 'Download URL generated',
                    'download_url' => $directUrl,
                ]);
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Failed to generate download URL',
                    'error' => $e->getMessage(),
                ], 500);
            }
        }

        $encryptionData = $this->encryptionService->encryptVideo($tempPath, $encryptedPath);

        // حفظ سجل التحميل
        DownloadedLesson::updateOrCreate(
            [
                'student_id' => $student->id,
                'lesson_id' => $lessonId,
                'device_id' => null,
            ],
            [
                'encrypted_path' => $encryptedPath,
                'token' => $encryptionData['token'],
                'encryption_key' => $encryptionData['decryption_key'],
                'quality' => '360p',
                'file_size' => $encryptionData['file_size'],
                'status' => 'completed',
                'downloaded_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Video downloaded successfully',
            'token' => $encryptionData['token'],
        ]);
    }

    /**
     * Get downloaded videos with full lesson, course, and instructor details.
     */
    public function downloaded()
    {
        $downloaded = DownloadedLesson::where('student_id', auth()->id())
            ->with([
                'lesson:id,course_id,section_id,title,thumbnail,price,duration',
                'lesson.course:id,title,image,price,instructor_id',
                'lesson.course.instructor:id,full_name,image',
            ])
            ->orderBy('downloaded_at', 'desc')
            ->get()
            ->map(function ($record) {
                $lesson = $record->lesson;
                $course = $lesson?->course;

                return [
                    'token'         => $record->token,
                    'quality'       => $record->quality,
                    'file_size'     => $record->file_size,
                    'status'        => $record->status,
                    'downloaded_at' => $record->downloaded_at,
                    'expires_at'    => $record->expires_at,
                    'lesson'        => $lesson ? [
                        'id'        => $lesson->id,
                        'title'     => $lesson->title,
                        'thumbnail' => $lesson->thumbnail,
                        'price'     => $lesson->price,
                        'duration'  => $lesson->duration,
                    ] : null,
                    'course'        => $course ? [
                        'id'         => $course->id,
                        'title'      => $course->title,
                        'image'      => $course->image,
                        'price'      => $course->price,
                        'instructor' => $course->instructor
                            ? $course->instructor->only(['id', 'full_name', 'image'])
                            : null,
                    ] : null,
                ];
            });

        return response()->json(['downloaded' => $downloaded]);
    }

    /**
     * Stream encrypted video
     */
    public function stream(Request $request, $token)
    {
        $downloaded = DownloadedLesson::where('token', $token)
            ->where('student_id', auth()->id())
            ->firstOrFail();

        $lesson = $downloaded->lesson;

        if ($lesson->approval_status !== 'approved' || !$lesson->active) {
            return response()->json(['message' => 'Lesson not available.'], 404);
        }

        // التحقق من الاشتراك
        if (!auth()->user()->hasAccessToLesson($lesson->id)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        // التحقق من التوقيع
        if (!$this->encryptionService->verifyDownloadSignature(
            $token,
            $lesson->id,
            auth()->id(),
            $request->get('signature')
        )) {
            return response()->json(['message' => 'Invalid signature'], 403);
        }

        // فك التشفير وإرسال الفيديو
        $tempOutput = storage_path('app/videos/temp/' . uniqid() . '.mp4');

        if ($this->encryptionService->decryptVideo(
            $downloaded->encrypted_path,
            $downloaded->encryption_key,
            $tempOutput
        )) {
            return response()->file($tempOutput);
        }

        return response()->json(['message' => 'Failed to decrypt video'], 500);
    }

    /**
     * Delete downloaded video
     */
    public function delete($token)
    {
        $downloaded = DownloadedLesson::where('token', $token)
            ->where('student_id', auth()->id())
            ->firstOrFail();

        // حذف الملف المشفر
        if (file_exists($downloaded->encrypted_path)) {
            unlink($downloaded->encrypted_path);
        }

        $downloaded->delete();

        return response()->json(['message' => 'Downloaded video deleted']);
    }
}
