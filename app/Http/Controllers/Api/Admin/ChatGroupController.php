<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\Request;

class ChatGroupController extends Controller
{
    /**
     * Get all chat groups (any)
     */
    public function index(Request $request)
    {
        $query = Chat::where('type', 'group')
            ->with(['participants.user', 'course']);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        $chats = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json($chats);
    }

    /**
     * Create chat group (any course)
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'name' => 'required|string|max:255',
            'student_ids' => 'required|array',
            'student_ids.*' => 'exists:users,id',
        ]);

        $course = Course::findOrFail($request->course_id);

        $chat = Chat::create([
            'course_id' => $course->id,
            'type' => 'group',
            'name' => $request->name,
            'created_by' => auth()->id(),
        ]);

        $chat->participants()->create([
            'user_id' => auth()->id(),
            'is_admin' => true,
            'joined_at' => now(),
        ]);

        foreach ($request->student_ids as $studentId) {
            $chat->participants()->create([
                'user_id' => $studentId,
                'is_admin' => false,
                'joined_at' => now(),
            ]);
        }

        return response()->json([
            'message' => 'Chat group created successfully',
            'chat' => $chat->load('participants.user'),
        ], 201);
    }

    /**
     * Update chat group (any)
     */
    public function update(Request $request, $chatId)
    {
        $chat = Chat::findOrFail($chatId);

        $request->validate([
            'name' => 'sometimes|string|max:255',
        ]);

        $chat->update($request->only(['name']));

        return response()->json([
            'message' => 'Chat group updated successfully',
            'chat' => $chat->fresh(),
        ]);
    }

    /**
     * Delete chat group (any)
     */
    public function destroy($chatId)
    {
        $chat = Chat::findOrFail($chatId);
        $chat->delete();

        return response()->json(['message' => 'Chat group deleted successfully']);
    }

    /**
     * Enrollments report (any course)
     */
    public function enrollmentsReport($courseId)
    {
        $course = Course::with(['instructor', 'subject'])->findOrFail($courseId);

        $enrollments = Enrollment::where('course_id', $courseId)
            ->where('active', true)
            ->with(['student', 'section', 'lesson'])
            ->get();

        return response()->json([
            'course' => $course,
            'total_enrollments' => $enrollments->count(),
            'total_revenue' => $enrollments->sum('final_price'),
            'total_discounts' => $enrollments->sum('discount'),
            'enrollments' => $enrollments,
        ]);
    }
}
