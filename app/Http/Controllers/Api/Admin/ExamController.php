<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExamController extends Controller
{
    /**
     * Get exams for any course (title, description, attachment path).
     */
    public function index($courseId)
    {
        Course::findOrFail($courseId);

        $exams = Exam::where('course_id', $courseId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($exams);
    }

    /**
     * Create exam: title, description, file (stored on public disk).
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'attachment' => 'required|file|mimes:pdf,doc,docx,ppt,pptx,zip|max:10240',
        ]);

        $course = Course::findOrFail($request->course_id);

        $path = $request->file('attachment')->store('exams', 'public');

        $exam = Exam::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'attachment' => $path,
            'active' => true,
            'created_by' => auth()->id(),
        ]);

        return response()->json([
            'message' => 'Exam created successfully',
            'exam' => $exam,
        ], 201);
    }

    /**
     * Update exam metadata and optionally replace file.
     */
    public function update(Request $request, $examId)
    {
        $exam = Exam::findOrFail($examId);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,zip|max:10240',
        ]);

        $data = $request->only(['title', 'description']);

        if ($request->hasFile('attachment')) {
            if ($exam->attachment && ! filter_var($exam->attachment, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($exam->attachment);
            }
            $data['attachment'] = $request->file('attachment')->store('exams', 'public');
        }

        $exam->update($data);

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Delete exam and its file.
     */
    public function destroy($examId)
    {
        $exam = Exam::findOrFail($examId);

        if ($exam->attachment && ! filter_var($exam->attachment, FILTER_VALIDATE_URL)) {
            Storage::disk('public')->delete($exam->attachment);
        }

        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
    }
}
