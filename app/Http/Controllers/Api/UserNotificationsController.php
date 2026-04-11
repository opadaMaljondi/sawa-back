<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use Illuminate\Http\Request;

class UserNotificationsController extends Controller
{
    public function index(Request $request)
    {
        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        return response()->json(
            UserNotification::where('user_id', auth()->id())
                ->orderByDesc('id')
                ->paginate($perPage)
        );
    }

    public function unreadCount()
    {
        $count = UserNotification::where('user_id', auth()->id())
            ->where('read', false)
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    public function markAsRead(int $id)
    {
        $n = UserNotification::where('user_id', auth()->id())->findOrFail($id);
        $n->update([
            'read'    => true,
            'read_at' => now(),
        ]);

        return response()->json(['message' => 'OK', 'notification' => $n->fresh()]);
    }

    /**
     * Mark all notifications as read for the authenticated user.
     */
    public function markAllAsRead()
    {
        $now = now();
        $updated = UserNotification::where('user_id', auth()->id())
            ->where('read', false)
            ->update([
                'read'    => true,
                'read_at' => $now,
            ]);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'updated_count' => $updated,
        ]);
    }
}
