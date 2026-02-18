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

    protected $appends = ['icon_url'];

    public function getIconUrlAttribute()
    {
        if ($this->icon && !filter_var($this->icon, FILTER_VALIDATE_URL)) {
            $storageUrl = rtrim(config('app.url'), '/') . '/storage/';
            return $storageUrl . $this->icon;
        }
        return $this->icon;
    }

    public function years()
    {
        return $this->hasMany(Year::class);
    }

    public function subjects()
    {
        return $this->hasMany(Subject::class);
    }
}

