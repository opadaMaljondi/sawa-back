<?php

namespace App\Http\Controllers\Api\Student;

use App\Http\Controllers\Controller;
use App\Models\Chat;
use App\Models\Message;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    /**
     * Get my chats
     */
    public function index()
    {
        $chats = Chat::whereHas('participants', function ($query) {
            $query->where('user_id', auth()->id());
        })
            ->with(['participants.user', 'lastMessage'])
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($chats);
    }

    /**
     * Get chat messages
     */
    public function messages($chatId)
    {
        $chat = Chat::whereHas('participants', function ($query) {
            $query->where('user_id', auth()->id());
        })->findOrFail($chatId);

        $messages = Message::where('chat_id', $chatId)
            ->with('sender')
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        return response()->json($messages);
    }

    /**
     * Send message
     */
    public function sendMessage(Request $request, $chatId)
    {
        $request->validate([
            'message' => 'required|string',
            'type' => 'nullable|in:text,file',
        ]);

        $chat = Chat::whereHas('participants', function ($query) {
            $query->where('user_id', auth()->id());
        })->findOrFail($chatId);

        $message = Message::create([
            'chat_id' => $chatId,
            'sender_id' => auth()->id(),
            'message' => $request->message,
            'type' => $request->type ?? 'text',
        ]);

        $chat->touch(); // تحديث updated_at

        return response()->json([
            'message' => $message->load('sender'),
        ], 201);
    }
}
