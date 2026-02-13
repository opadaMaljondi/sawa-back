<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained('course_sections')->onDelete('cascade');
            
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('order')->default(0);
            $table->integer('duration')->default(0); // بالثواني
            
            // معلومات YouTube
            $table->string('youtube_id')->nullable();
            $table->string('youtube_url')->nullable();
            $table->string('thumbnail')->nullable();
            
            // للتحميل Offline
            $table->text('encrypted_data')->nullable(); // JSON
            
            // التسعير
            $table->decimal('price', 10, 2)->nullable();
            $table->boolean('is_free')->default(0);
            $table->boolean('can_download')->default(1);
            
            // الحالة
            $table->enum('upload_status', ['uploading', 'completed', 'failed'])->default('completed');
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->boolean('active')->default(1);
            
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('lessons');
    }
};