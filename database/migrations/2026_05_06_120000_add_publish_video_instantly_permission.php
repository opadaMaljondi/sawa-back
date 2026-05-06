<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $guard = config('auth.defaults.guard', 'web');
        Permission::firstOrCreate(
            ['name' => 'publish video instantly', 'guard_name' => $guard],
            []
        );
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
        $guard = config('auth.defaults.guard', 'web');
        Permission::where('name', 'publish video instantly')
            ->where('guard_name', $guard)
            ->delete();
    }
};
