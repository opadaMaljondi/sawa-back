<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Banner extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'image_path',
        'link_type',
        'link_id',
        'link_url',
        'order',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}

