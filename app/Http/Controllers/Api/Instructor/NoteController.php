<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Models\Course;
use App\Support\FullCourseContentNotifier;
use App\Support\InstructorAdminNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'is_free' => 'nullable|boolean',
            'prevent_download' => 'nullable|boolean',
            'file_name' => 'nullable|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx,ppt,pptx,xls,xlsx|max:20480',
        ]);

        $course = Course::where('instructor_id', auth()->id())
            ->findOrFail($request->course_id);

        $file = $request->file('file');
        $filePath = $file->store('notes', 'public');

        $clientOriginal = $file->getClientOriginalName();
        $customName = trim((string) $request->input('file_name', ''));
        $storedFileName = $customName !== ''
            ? Str::limit(basename($customName), 255, '')
            : $clientOriginal;

        $isFree = $request->boolean('is_free');

        $note = Note::create([
            'course_id' => $course->id,
            'title' => $request->title,
            'description' => $request->input('description'),
            'file_path' => $filePath,
            'file_name' => $storedFileName,
            'file_type' => strtolower($file->getClientOriginalExtension() ?: 'pdf'),
            'file_size' => $file->getSize(),
            'price' => $isFree ? 0 : (float) $request->input('price', 0),
            'is_free' => $isFree,
            'prevent_download' => $request->boolean('prevent_download'),
            'uploaded_by' => auth()->id(),
            'active' => true,
        ]);

        FullCourseContentNotifier::notePublished($note->fresh());

        return response()->json([
            'message' => 'Note created successfully.',
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
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'is_free' => 'nullable|boolean',
            'prevent_download' => 'nullable|boolean',
            'file_name' => 'nullable|string|max:255',
        ]);

        $data = $request->only(['title', 'description', 'price']);
        if ($request->has('is_free')) {
            $data['is_free'] = $request->boolean('is_free');
            if ($data['is_free']) {
                $data['price'] = 0;
            }
        }
        if ($request->has('prevent_download')) {
            $data['prevent_download'] = $request->boolean('prevent_download');
        }
        if ($request->filled('file_name')) {
            $data['file_name'] = Str::limit(basename(trim($request->input('file_name'))), 255, '');
        }

        $note->update($data);

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
