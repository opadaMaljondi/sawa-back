<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\SupportMessage;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    /**
     * Get support contact information (phone, email, WhatsApp, Telegram).
     */
    public function info()
    {
        return response()->json([
            'support_phone'     => Setting::get('support_phone'),
            'support_email'     => Setting::get('support_email'),
            'support_whatsapp'  => Setting::get('support_whatsapp'),
            'support_telegram'  => Setting::get('support_telegram'),
        ]);
    }

    /**
     * Send a support message.
     */
    public function send(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|max:2000',
        ]);

        SupportMessage::create([
            'user_id' => $user->id,
            'name'    => $user->full_name,
            'email'   => $user->email,
            'subject' => $data['subject'] ?? 'General Support',
            'message' => $data['message'],
            'status'  => 'new',
        ]);

        return response()->json([
            'message' => 'Your message has been sent. We will get back to you soon.',
        ], 201);
    }
}
