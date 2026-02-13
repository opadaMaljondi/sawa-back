<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use App\Models\Course;
use Illuminate\Http\Request;

class ChatGroupController extends Controller
{
    /**
     * Create chat group
     */
    public function store(Request $request)
    {
        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('create chat group')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'name' => 'required|string|max:255',
            'student_ids' => 'required|array',
            'student_ids.*' => 'exists:users,id',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        // إنشاء المجموعة
        $chat = Chat::create([
            'course_id' => $course->id,
            'type' => 'group',
            'name' => $request->name,
            'created_by' => auth()->id(),
        ]);

        // إضافة الأستاذ
        $chat->participants()->create([
            'user_id' => auth()->id(),
            'role' => 'admin',
        ]);

        // إضافة الطلاب
        foreach ($request->student_ids as $studentId) {
            $chat->participants()->create([
                'user_id' => $studentId,
                'role' => 'member',
            ]);
        }

        return response()->json([
            'message' => 'Chat group created successfully',
            'chat' => $chat->load('participants.user'),
        ], 201);
    }

    /**
     * Get my chat groups
     */
    public function index()
    {
        $chats = Chat::where('created_by', auth()->id())
            ->where('type', 'group')
            ->with(['participants.user', 'course'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($chats);
    }

    /**
     * Update chat group
     */
    public function update(Request $request, $chatId)
    {
        $chat = Chat::where('created_by', auth()->id())
            ->findOrFail($chatId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('edit chat group')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
        ]);

        $chat->update($request->only(['name']));

        return response()->json([
            'message' => 'Chat group updated successfully',
            'chat' => $chat,
        ]);
    }

    /**
     * Delete chat group
     */
    public function destroy($chatId)
    {
        $chat = Chat::where('created_by', auth()->id())
            ->findOrFail($chatId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('delete chat group')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $chat->delete();

        return response()->json(['message' => 'Chat group deleted successfully']);
    }

    /**
     * Get enrollments report
     */
    public function enrollmentsReport($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        $enrollments = \App\Models\Enrollment::where('course_id', $courseId)
            ->where('active', true)
            ->with(['student', 'section', 'lesson'])
            ->get();

        $report = [
            'course' => $course,
            'total_enrollments' => $enrollments->count(),
            'total_revenue' => $enrollments->sum('final_price'),
            'total_discounts' => $enrollments->sum('discount'),
            'enrollments' => $enrollments,
        ];

        return response()->json($report);
    }
}
