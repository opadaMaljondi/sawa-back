<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Exam;
use App\Models\Course;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    /**
     * Get exams for a course
     */
    public function index($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        $exams = Exam::where('course_id', $courseId)
            ->with(['questions'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($exams);
    }

    /**
     * Create exam
     */
    public function store(Request $request)
    {
        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('publish exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration' => 'required|integer|min:1', // بالدقائق
            'questions' => 'required|array|min:1',
            'questions.*.question' => 'required|string',
            'questions.*.type' => 'required|in:multiple_choice,true_false,short_answer',
            'questions.*.options' => 'required_if:questions.*.type,multiple_choice|array',
            'questions.*.correct_answer' => 'required|string',
            'questions.*.points' => 'required|integer|min:1',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $exam = Exam::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'duration' => $request->duration,
            'is_active' => false, // يحتاج موافقة الأدمن
        ]);

        // إنشاء الأسئلة
        foreach ($request->questions as $questionData) {
            $exam->questions()->create([
                'question' => $questionData['question'],
                'type' => $questionData['type'],
                'options' => $questionData['options'] ?? null,
                'correct_answer' => $questionData['correct_answer'],
                'points' => $questionData['points'],
            ]);
        }

        return response()->json([
            'message' => 'Exam created successfully. Waiting for admin approval.',
            'exam' => $exam->load('questions'),
        ], 201);
    }

    /**
     * Update exam
     */
    public function update(Request $request, $examId)
    {
        $exam = Exam::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($examId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('edit exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'duration' => 'sometimes|integer|min:1',
        ]);

        $exam->update($request->only(['title', 'description', 'duration']));

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam,
        ]);
    }

    /**
     * Delete exam
     */
    public function destroy($examId)
    {
        $exam = Exam::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($examId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('delete exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
    }
}
