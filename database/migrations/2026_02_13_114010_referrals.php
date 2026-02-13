<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('referred_id')->constrained('users')->onDelete('cascade');
            
            $table->string('referral_code');
            
            $table->decimal('bonus_amount', 10, 2)->default(0);
            $table->enum('bonus_status', ['pending', 'earned', 'paid'])->default('pending');
            
            $table->foreignId('enrollment_id')->nullable()->constrained();
            $table->decimal('purchase_amount', 10, 2)->nullable();
            
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            
            $table->unique(['referrer_id', 'referred_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('referrals');
    }
};