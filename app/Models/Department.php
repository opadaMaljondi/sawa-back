<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'name_en',
        'description',
        'icon',
        'color',
        'order',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function years()
    {
        return $this->hasMany(Year::class);
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class);
    }
}

