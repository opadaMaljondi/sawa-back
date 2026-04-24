<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\Course;
use App\Support\InstructorAdminNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class NoteController extends Controller
{
    /**
     * Get notes for a course
     */
    public function index($courseId)
    {
        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($courseId);

        $notes = Note::where('course_id', $courseId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($notes);
    }

    /**
     * Create note
     */
    public function store(Request $request)
    {
        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('publish note')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240', // 10MB max
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $file = $request->file('file');
        $filePath = $file->store('notes', 'public');

        $note = Note::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'file_path' => $filePath,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => strtolower($file->getClientOriginalExtension() ?: 'pdf'),
            'file_size' => $file->getSize(),
            'uploaded_by' => auth()->id(),
            'active' => false, // يحتاج موافقة الأدمن
        ]);

        InstructorAdminNotifier::notify($course, 'تمت إضافة مرفق / ملاحظة جديدة تنتظر المراجعة');

        return response()->json([
            'message' => 'Note created successfully. Waiting for admin approval.',
            'note' => $note,
        ], 201);
    }

    /**
     * Update note
     */
    public function update(Request $request, $noteId)
    {
        $note = Note::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($noteId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('edit note')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
        ]);

        $note->update($request->only(['title']));

        $note->loadMissing('course');
        if ($note->course) {
            InstructorAdminNotifier::notify(
                $note->course,
                'تم تعديل عنوان أو بيانات مرفق «'.$note->title.'».',
                null,
                ['type' => 'instructor_note_updated', 'note_id' => $note->id]
            );
        }

        return response()->json([
            'message' => 'Note updated successfully',
            'note' => $note,
        ]);
    }

    /**
     * Delete note
     */
    public function destroy($noteId)
    {
        $note = Note::whereHas('course', function ($query) {
            $query->where('instructor_id', auth()->id());
        })->findOrFail($noteId);

        // التحقق من الصلاحيات
        if (!auth()->user()->hasPermissionTo('delete note')) {
            return response()->json(['message' => 'Permission denied'], 403);
        }

        // حذف الملف
        if ($note->file_path) {
            Storage::disk('public')->delete($note->file_path);
        }

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully']);
    }
}
