<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            
            $table->string('code')->unique();
            $table->text('description')->nullable();
            
            $table->enum('type', ['percentage', 'fixed']); // نسبة أو مبلغ ثابت
            $table->decimal('value', 10, 2);
            
            $table->decimal('min_purchase', 10, 2)->nullable();
            $table->decimal('max_discount', 10, 2)->nullable();
            
            $table->integer('usage_limit')->nullable();
            $table->integer('usage_per_user')->default(1);
            $table->integer('used_count')->default(0);
            
            $table->boolean('active')->default(1);
            $table->timestamp('valid_from');
            $table->timestamp('valid_until');
            
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('coupons');
    }
};
