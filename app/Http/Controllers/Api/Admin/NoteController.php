<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Note;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class NoteController extends Controller
{
    /**
     * Get notes for any course
     */
    public function index($courseId)
    {
        Course::findOrFail($courseId);

        $notes = Note::where('course_id', $courseId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($notes);
    }

    /**
     * Create note (any course)
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240',
        ]);

        $course = Course::findOrFail($request->course_id);
        $file = $request->file('file');
        $filePath = $file->store('notes', 'public');

        $note = Note::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'file_path' => $filePath,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'uploaded_by' => auth()->id(),
        ]);

        return response()->json([
            'message' => 'Note created successfully',
            'note' => $note,
        ], 201);
    }

    /**
     * Update note (any note)
     */
    public function update(Request $request, $noteId)
    {
        $note = Note::findOrFail($noteId);

        $request->validate([
            'title' => 'sometimes|string|max:255',
        ]);

        $note->update($request->only(['title']));

        return response()->json([
            'message' => 'Note updated successfully',
            'note' => $note->fresh(),
        ]);
    }

    /**
     * Delete note (any note)
     */
    public function destroy($noteId)
    {
        $note = Note::findOrFail($noteId);

        if ($note->file_path) {
            Storage::disk('public')->delete($note->file_path);
        }

        $note->delete();

        return response()->json(['message' => 'Note deleted successfully']);
    }
}
