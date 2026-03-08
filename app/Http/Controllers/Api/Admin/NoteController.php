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
     * Get all notes (for admin list)
     */
    public function indexAll()
    {
        $notes = Note::with('course:id,title')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($notes);
    }

    /**
     * Get notes for a specific course
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
            'description' => 'nullable|string',
            'file' => 'required|file|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx|max:20480',
            'price' => 'nullable|numeric|min:0',
            'is_free' => 'nullable|boolean',
            'prevent_download' => 'nullable|boolean',
        ]);

        $course = Course::findOrFail($request->course_id);
        $file = $request->file('file');
        $filePath = $file->store('notes', 'public');

        $note = Note::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->description,
            'file_path' => $filePath,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'price' => $request->input('price', 0),
            'is_free' => $request->boolean('is_free'),
            'prevent_download' => $request->boolean('prevent_download'),
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
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'is_free' => 'nullable|boolean',
            'prevent_download' => 'nullable|boolean',
            'active' => 'nullable|boolean',
        ]);

        $data = $request->only(['title', 'description', 'price']);
        
        if ($request->has('is_free')) $data['is_free'] = $request->boolean('is_free');
        if ($request->has('prevent_download')) $data['prevent_download'] = $request->boolean('prevent_download');
        if ($request->has('active')) $data['active'] = $request->boolean('active');

        $note->update($data);

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
