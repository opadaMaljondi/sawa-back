<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * قائمة إشعاراتي (عامة + محادثات + قسم + كورس).
     */
    public function index(Request $request)
    {
        $query = UserNotification::where('user_id', auth()->id())
            ->orderBy('created_at', 'desc');

        if ($request->boolean('unread_only')) {
            $query->where('read', false);
        }

        if ($request->has('scope')) {
            $query->where('scope', $request->scope);
        }

        $notifications = $query->paginate(20);

        return response()->json($notifications);
    }

    /**
     * عدد الإشعارات غير المقروءة.
     */
    public function unreadCount()
    {
        $count = UserNotification::where('user_id', auth()->id())
            ->where('read', false)
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * تعليم إشعار كمقروء.
     */
    public function markAsRead($id)
    {
        $notification = UserNotification::where('user_id', auth()->id())->findOrFail($id);
        $notification->update(['read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'Marked as read', 'notification' => $notification->fresh()]);
    }

    /**
     * تعليم كل إشعاراتي كمقروءة.
     */
    public function markAllAsRead()
    {
        UserNotification::where('user_id', auth()->id())
            ->where('read', false)
            ->update(['read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read']);
    }
}
