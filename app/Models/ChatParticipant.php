<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatParticipant extends Model
{
    protected $table = 'chat_participants';

    public $timestamps = false;

    protected $fillable = [
        'chat_id',
        'user_id',
        'is_admin',
        'unread_count',
        'joined_at',
        'last_read_at',
    ];

    protected $casts = [
        'is_admin' => 'boolean',
        'unread_count' => 'integer',
        'joined_at' => 'datetime',
        'last_read_at' => 'datetime',
    ];

    public function chat()
    {
        return $this->belongsTo(Chat::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
