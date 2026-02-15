<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\DownloadedLesson;
use App\Models\Lesson;
use App\Services\VideoEncryptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class VideoDownloadController extends Controller
{
    protected VideoEncryptionService $encryptionService;

    public function __construct(VideoEncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
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
            return response()->json(['message' => 'Video file not found'], 404);
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
     * Get downloaded videos
     */
    public function downloaded()
    {
        $downloaded = DownloadedLesson::where('student_id', auth()->id())
            ->with(['lesson.course'])
            ->orderBy('downloaded_at', 'desc')
            ->get();

        return response()->json($downloaded);
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
