<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\Course;
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

        $filePath = $request->file('file')->store('notes', 'public');

        $note = Note::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'file_path' => $filePath,
            'file_size' => $request->file('file')->getSize(),
            'is_active' => false, // يحتاج موافقة الأدمن
        ]);

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
