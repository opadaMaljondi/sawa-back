<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Referral extends Model
{
    protected $fillable = [
        'referrer_id',
        'referred_id',
        'referral_code',
        'bonus_amount',
        'bonus_status',
        'enrollment_id',
        'purchase_amount',
        'paid_at',
    ];

    protected $casts = [
        'bonus_amount' => 'decimal:2',
        'purchase_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    public function referred()
    {
        return $this->belongsTo(User::class, 'referred_id');
    }

    public function enrollment()
    {
        return $this->belongsTo(Enrollment::class);
    }
}
