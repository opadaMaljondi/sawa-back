<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // إعادة تعيين الكاش
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $guardName = config('auth.defaults.guard', 'web');

        // ==================== إنشاء الصلاحيات ====================

        $permissions = [
            // فيديو
            'create video',
            'edit video',
            'delete video',
            // ملاحظات
            'publish note',
            'edit note',
            'delete note',
            // امتحانات
            'publish exam',
            'edit exam',
            'delete exam',
            // كورسات
            'create course',
            'edit course',
            'delete course',
            // مجموعات الدردشة
            'create chat group',
            'edit chat group',
            'delete chat group',
            // صلاحيات الأدمن
            'manage students',
            'manage instructors',
            'manage courses',
            'manage banners',
            'view reports',
            'manage settings',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(
                ['name' => $name, 'guard_name' => $guardName]
            );
        }

        // ==================== دور الأدمن - كامل الصلاحيات ====================

        $adminRole = Role::firstOrCreate(
            ['name' => 'admin', 'guard_name' => $guardName]
        );
        $adminRole->syncPermissions(Permission::all());

        // ==================== دور الاستاذ - صلاحيات محددة ====================

        $instructorPermissions = [
            'create video',
            'edit video',
            'delete video',
            'publish note',
            'edit note',
            'delete note',
            'publish exam',
            'edit exam',
            'delete exam',
            'create course',
            'edit course',
            'create chat group',
            'edit chat group',
            'delete chat group',
        ];

        $instructorRole = Role::firstOrCreate(
            ['name' => 'instructor', 'guard_name' => $guardName]
        );
        $instructorRole->syncPermissions($instructorPermissions);

        // ==================== دور الطالب ====================

        Role::firstOrCreate(
            ['name' => 'student', 'guard_name' => $guardName]
        );
    }
}
