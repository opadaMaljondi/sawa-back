<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('downloaded_lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained()->onDelete('cascade');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('device_id')->constrained()->onDelete('cascade');
            
            $table->string('token')->unique();
            $table->string('encryption_key');
            $table->string('quality'); // 360p, 480p, 720p
            $table->bigInteger('file_size');
            
            $table->timestamp('expires_at')->nullable();
            $table->integer('max_views')->nullable();
            $table->integer('view_count')->default(0);
            
            $table->enum('status', ['pending', 'completed', 'expired'])->default('pending');
            
            $table->timestamp('downloaded_at')->nullable();
            $table->timestamp('last_accessed_at')->nullable();
            $table->timestamps();
            
            $table->unique(['lesson_id', 'student_id', 'device_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('downloaded_lessons');
    }
};