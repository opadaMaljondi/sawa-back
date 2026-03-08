<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Setting;

class AppController extends Controller
{
    /**
     * Get Terms & Conditions content.
     */
    public function terms()
    {
        return response()->json([
            'terms_and_conditions' => Setting::get('terms_and_conditions', ''),
        ]);
    }

    /**
     * Get Privacy Policy content.
     */
    public function privacy()
    {
        return response()->json([
            'privacy_policy' => Setting::get('privacy_policy', ''),
        ]);
    }

    /**
     * Get general app settings (version, social links, etc.).
     */
    public function settings()
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
        ]);
    }
}
