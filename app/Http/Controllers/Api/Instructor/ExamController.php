<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Exam;
use App\Support\InstructorAdminNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExamController extends Controller
{
    /**
     * Get exams for a course.
     */
    public function index($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        $exams = Exam::where('course_id', $course->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($exams);
    }

    /**
     * Create exam (file + title + description).
     */
    public function store(Request $request)
    {
        if (! auth()->user()->hasPermissionTo('publish exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'attachment' => 'required|file|mimes:pdf,doc,docx,ppt,pptx,zip|max:10240',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $path = $request->file('attachment')->store('exams', 'public');

        $exam = Exam::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'attachment' => $path,
            'active' => false,
            'created_by' => auth()->id(),
        ]);

        InstructorAdminNotifier::notify($course, 'تمت إضافة امتحان جديد يحتاج مراجعة', null, [
            'type' => 'instructor_exam_created',
            'exam_id' => $exam->id,
        ]);

        return response()->json([
            'message' => 'Exam created successfully. Waiting for admin approval.',
            'exam' => $exam,
        ], 201);
    }

    /**
     * Update exam.
     */
    public function update(Request $request, $examId)
    {
        $exam = Exam::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($examId);

        if (! auth()->user()->hasPermissionTo('edit exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

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

        $exam->loadMissing('course');
        if ($exam->course) {
            InstructorAdminNotifier::notify(
                $exam->course,
                'تم تعديل امتحان «'.$exam->title.'» (مرفق أو وصف).',
                null,
                ['type' => 'instructor_exam_updated', 'exam_id' => $exam->id]
            );
        }

        return response()->json([
            'message' => 'Exam updated successfully',
            'exam' => $exam->fresh(),
        ]);
    }

    /**
     * Delete exam.
     */
    public function destroy($examId)
    {
        $exam = Exam::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($examId);

        if (! auth()->user()->hasPermissionTo('delete exam')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        if ($exam->attachment && ! filter_var($exam->attachment, FILTER_VALIDATE_URL)) {
            Storage::disk('public')->delete($exam->attachment);
        }

        $exam->delete();

        return response()->json(['message' => 'Exam deleted successfully']);
    }
}
