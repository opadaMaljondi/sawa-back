<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

/**
 * Public app legal & settings (students, instructors, guests).
 */
class AppInfoController extends Controller
{
    public function terms()
    {
        return response()->json([
            'terms_and_conditions' => Setting::get('terms_and_conditions', ''),
        ]);
    }

    public function privacy()
    {
        return response()->json([
            'privacy_policy' => Setting::get('privacy_policy', ''),
        ]);
    }

    /**
     * حدود رفع الفيديو المجزأ (للمزامنة مع الواجهة دون بناء يدوي لـ VITE).
     */
    public function videoUploadLimits()
    {
        $maxKb = max(1024, (int) config('video.chunk_max_kb', 32768));

        return response()->json([
            'chunk_max_kb'    => $maxKb,
            'chunk_max_bytes' => $maxKb * 1024,
        ]);
    }

    public function settings(Request $request)
    {
        return response()->json([
            'app_name'             => Setting::get('app_name', 'Sawa'),
            'app_version'          => Setting::get('app_version'),
            'support_phone'        => Setting::get('support_phone'),
            'support_email'        => Setting::get('support_email'),
            'support_whatsapp'     => Setting::get('support_whatsapp'),
            'support_telegram'     => Setting::get('support_telegram'),
            'terms_and_conditions' => Setting::get('terms_and_conditions', ''),
            'privacy_policy'       => Setting::get('privacy_policy', ''),
            'expired_course_re_enrollment_discount_percent' => (float) Setting::get('expired_course_re_enrollment_discount_percent', 0),
        ]);
    }
}
