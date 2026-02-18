<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    /**
     * Get all permissions
     */
    public function index()
    {
        $permissions = Permission::all();
        return response()->json($permissions);
    }
}
