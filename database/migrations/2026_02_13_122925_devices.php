<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->string('device_id');
            $table->string('device_name')->nullable();
            $table->string('device_type')->nullable(); // mobile, tablet
            $table->string('os')->nullable(); // iOS, Android
            $table->string('app_version')->nullable();
            
            $table->string('fcm_token')->nullable();
            
            $table->boolean('active')->default(1);
            $table->boolean('trusted')->default(0);
            
            $table->timestamp('last_used_at');
            $table->timestamps();
            
            $table->unique(['user_id', 'device_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('devices');
    }
};