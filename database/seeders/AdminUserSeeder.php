<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * إنشاء مستخدم الأدمن.
     * البيانات من .env أو قيم افتراضية للتطوير.
     */
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@sawa.com');
        $phone = env('ADMIN_PHONE', '07501234567');
        $name = env('ADMIN_NAME', 'مدير النظام');
        $password = env('ADMIN_PASSWORD', 'password'); // غيّر في الإنتاج

        $admin = User::updateOrCreate(
            ['email' => $email],
            [
                'full_name' => $name,
                'phone' => $phone,
                'password' => Hash::make($password),
                'type' => 'admin',
                'active' => true,
            ]
        );

        $admin->assignRole('admin');

        $this->command->info('تم إنشاء الأدمن: ' . $admin->email);
    }
}
