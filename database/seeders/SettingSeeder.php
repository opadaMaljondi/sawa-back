<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            // General
            ['key' => 'site_name', 'value' => 'Sawa Academy', 'type' => 'string', 'description' => 'اسم الموقع'],
            ['key' => 'site_description', 'value' => 'أكاديمية سوا للتعليم الإلكتروني', 'type' => 'string', 'description' => 'وصف الموقع'],
            
            // Contact
            ['key' => 'contact_email', 'value' => 'contact@sawa.com', 'type' => 'string', 'description' => 'بريد التواصل'],
            ['key' => 'contact_phone', 'value' => '0999999999', 'type' => 'string', 'description' => 'رقم التواصل'],
            ['key' => 'address', 'value' => 'دمشق، سوريا', 'type' => 'string', 'description' => 'العنوان'],
            
            // System
            ['key' => 'maintenance_mode', 'value' => 'false', 'type' => 'boolean', 'description' => 'وضع الصيانة'],
            ['key' => 'allow_registration', 'value' => 'true', 'type' => 'boolean', 'description' => 'السماح بالتسجيل الجديد'],
        ];

        foreach ($settings as $s) {
            Setting::updateOrCreate(['key' => $s['key']], $s);
        }
    }
}
