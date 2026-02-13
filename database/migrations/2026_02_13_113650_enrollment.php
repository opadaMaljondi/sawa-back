<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            
            $table->enum('type', ['full_course', 'section', 'lesson']);
            $table->foreignId('section_id')->nullable()->constrained('course_sections')->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->onDelete('cascade');
            
            // السعر
            $table->decimal('original_price', 10, 2);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('final_price', 10, 2);
            
            $table->string('coupon_code')->nullable();
            
            // التقدم
            $table->integer('progress')->default(0); // 0-100
            $table->boolean('completed')->default(0);
            $table->timestamp('completed_at')->nullable();
            
            $table->boolean('active')->default(1);
            $table->timestamp('enrolled_at');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('enrollments');
    }
};