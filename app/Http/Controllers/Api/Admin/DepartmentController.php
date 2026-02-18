<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DepartmentController extends Controller
{
    /**
     * List departments
     */
    public function index(Request $request)
    {
        $query = Department::withCount(['years', 'subjects']);

        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }
        if ($request->has('keyword')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->keyword . '%')
                    ->orWhere('name_en', 'like', '%' . $request->keyword . '%');
            });
        }

        $departments = $query->orderBy('order')->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json($departments);
    }

    /**
     * Show department
     */
    public function show($id)
    {
        $department = Department::with(['years.semesters.subjects'])->findOrFail($id);
        return response()->json($department);
    }

    /**
     * Create department
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
            'color' => 'nullable|string|max:20',
            'order' => 'nullable|integer|min:0',
            'active' => 'sometimes|boolean',
        ]);

        $iconPath = null;
        if ($request->hasFile('icon')) {
            $iconPath = $request->file('icon')->store('departments', 'public');
        }

        $department = Department::create([
            'name' => $request->name,
            'name_en' => $request->name_en ?? $request->name,
            'description' => $request->description,
            'icon' => $iconPath,
            'color' => $request->color ?? '#000000',
            'order' => $request->order ?? 0,
            'active' => $request->boolean('active', true),
        ]);

        return response()->json([
            'message' => 'Department created successfully',
            'department' => $department,
        ], 201);
    }

    /**
     * Update department
     */
    public function update(Request $request, $id)
    {
        $department = Department::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|sometimes', // Can be file or existing path
            'color' => 'nullable|string|max:20',
            'order' => 'nullable|integer|min:0',
            'active' => 'sometimes',
        ]);

        $data = $request->only([
            'name', 'name_en', 'description', 'color', 'order'
        ]);

        if ($request->has('active')) {
            $data['active'] = $request->boolean('active');
        }

        if ($request->hasFile('icon')) {
            // Delete old icon if exists
            if ($department->icon && \Storage::disk('public')->exists($department->icon)) {
                \Storage::disk('public')->delete($department->icon);
            }
            $data['icon'] = $request->file('icon')->store('departments', 'public');
        }

        $department->update($data);

        return response()->json([
            'message' => 'Department updated successfully',
            'department' => $department->fresh(),
        ]);
    }

    /**
     * Delete department
     */
    public function destroy($id)
    {
        $department = Department::findOrFail($id);
        $department->delete();
        return response()->json(['message' => 'Department deleted successfully']);
    }
}
