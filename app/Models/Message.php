<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'chat_id',
        'sender_id',
        'content',
        'type',
        'media_url',
        'media_name',
        'media_size',
        'reply_to_id',
        'read',
        'read_by',
        'sent_at',
        'edited_at',
    ];

    protected $casts = [
        'read' => 'boolean',
        'sent_at' => 'datetime',
        'edited_at' => 'datetime',
    ];

    public function chat()
    {
        return $this->belongsTo(Chat::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyTo()
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }
}
