<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Year extends Model
{
    use HasFactory;

    protected $fillable = [
        'department_id',
        'name',
        'order',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function semesters()
    {
        return $this->hasMany(Semester::class);
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class);
    }
}

