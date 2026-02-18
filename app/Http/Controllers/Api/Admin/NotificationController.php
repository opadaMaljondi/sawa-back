<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Models\UserNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * عرض قائمة الإشعارات الواردة للآدمن
     */
    public function index(Request $request)
    {
        $notifications = UserNotification::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json($notifications);
    }

    /**
     * جلب عدد الإشعارات غير المقروءة
     */
    public function getUnreadCount(Request $request)
    {
        $count = UserNotification::where('user_id', $request->user()->id)
            ->where('read', false)
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * تحديد إشعار كمقروء
     */
    public function markAsRead(Request $request, $id)
    {
        $notification = UserNotification::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $notification->update([
            'read' => true,
            'read_at' => now(),
        ]);

        return response()->json(['message' => 'Notification marked as read']);
    }

    /**
     * إرسال إشعار حسب النوع:
     * ١ عام (general): كل المستخدمين – مثل التحديثات والتحذيرات
     * ٢ فرع (department): طلاب القسم فقط – من اشترك في أي كورس تابع لمادة من هذا القسم
     * ٣ كورس (course): المشتركون في الكورس المحدد فقط
     * (إشعارات المحادثات تُرسل تلقائياً عبر FCM عند إرسال رسالة جديدة)
     */
    public function send(Request $request, NotificationService $notificationService)
    {
        $request->validate([
            'scope' => 'required|in:general,department,course,user',
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'department_id' => 'required_if:scope,department|exists:departments,id',
            'course_id' => 'required_if:scope,course|exists:courses,id',
            'user_id' => 'required_if:scope,user|exists:users,id',
            'data' => 'nullable|array',
        ]);

        $scope = $request->scope;
        $title = $request->title;
        $message = $request->message;
        $data = $request->input('data', []);

        $result = match ($scope) {
            'general' => $notificationService->sendGeneral($title, $message, $data),
            'department' => $notificationService->sendToDepartment(
                (int) $request->department_id,
                $title,
                $message,
                $data
            ),
            'course' => $notificationService->sendToCourse(
                (int) $request->course_id,
                $title,
                $message,
                $data
            ),
            'user' => $notificationService->sendToUser(
                (int) $request->user_id,
                $title,
                $message,
                $data
            ),
        };

        return response()->json([
            'message' => 'Notification sent successfully.',
            'scope' => $scope,
            'stored_count' => $result['stored'],
            'fcm_sent' => $result['fcm_sent'] ?? false,
        ], 201);
    }
}
