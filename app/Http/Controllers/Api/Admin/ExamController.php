<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    /**
     * Get exams for any course
     */
    public function index($courseId)
    {
        Course::findOrFail($courseId);

        $exams = Exam::where('course_id', $courseId)
            ->with(['questions'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($exams);
    }

    /**
     * Create exam (any course)
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration' => 'required|integer|min:1',
            'questions' => 'required|array|min:1',
            'questions.*.question' => 'required|string',
            'questions.*.type' => 'required|in:multiple_choice,true_false,short_answer',
            'questions.*.options' => 'required_if:questions.*.type,multiple_choice|array',
            'questions.*.correct_answer' => 'required|string',
            'questions.*.points' => 'required|integer|min:1',
        ]);

        $course = Course::findOrFail($request->course_id);

        $exam = Exam::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'duration' => $request->duration,
            'is_active' => true,
            'created_by' => auth()->id(),
        ]);

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
            'message' => 'Exam created successfully',
            'exam' => $exam->load('questions'),
        ], 201);
    }

    /**
     * Update exam (any exam)
     */
    public function update(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'duration' => 'sometimes|integer|min:1',
        ]);

        $exam->update($request->only(['title', 'description', 'duration']));

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Delete exam (any exam)
     */
    public function destroy($examId)
    {
        $exam = Exam::findOrFail($examId);
        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
    }
}
