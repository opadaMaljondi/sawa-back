<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    /**
     * Get all roles with their permissions
     */
    public function index()
    {
        $roles = Role::with('permissions')->get();
        return response()->json($roles);
    }

    /**
     * Create a new role
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:roles,name',
            'guard_name' => 'nullable|string'
        ]);

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => $data['guard_name'] ?? 'web'
        ]);

        return response()->json([
            'message' => 'Role created successfully',
            'role' => $role
        ], 201);
    }

    /**
     * Update role name
     */
    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        
        $data = $request->validate([
            'name' => 'required|string|unique:roles,name,' . $id
        ]);

        $role->update($data);

        return response()->json([
            'message' => 'Role updated successfully',
            'role' => $role
        ]);
    }

    /**
     * Delete a role
     */
    public function destroy($id)
    {
        $role = Role::findOrFail($id);
        
        // منع حذف الأدوار الأساسية
        if (in_array($role->name, ['admin', 'instructor', 'student'])) {
            return response()->json([
                'message' => 'Cannot delete system-defined roles'
            ], 403);
        }

        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully'
        ]);
    }

    /**
     * Sync permissions for a role
     */
    public function syncPermissions(Request $request, $id)
    {
        $role = Role::findOrFail($id);
        
        $data = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string'
        ]);

        $role->syncPermissions($data['permissions']);

        return response()->json([
            'message' => 'Permissions synced successfully',
            'role' => $role->load('permissions')
        ]);
    }
}
