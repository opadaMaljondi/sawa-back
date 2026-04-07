<?php

namespace App\Http\Controllers\Api\Instructor;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use Illuminate\Http\Request;

class SupportController extends Controller
{
    /**
     * Message to admins (same storage as student support).
     */
    public function send(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|max:5000',
        ]);

        SupportMessage::create([
            'user_id' => $user->id,
            'name'    => $user->full_name,
            'email'   => $user->email,
            'subject' => $data['subject'] ?? 'Instructor support',
            'message' => $data['message'],
            'status'  => 'new',
        ]);

        return response()->json([
            'message' => 'Your message has been sent to the administration.',
        ], 201);
    }
}
