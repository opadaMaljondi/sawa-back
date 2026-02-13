<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained()->onDelete('cascade');
            $table->foreignId('instructor_id')->constrained('users')->onDelete('cascade');
            
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            
            // التسعير
            $table->decimal('price', 10, 2)->default(0);
            $table->boolean('allow_section_purchase')->default(0);
            $table->boolean('allow_lesson_purchase')->default(0);
            $table->boolean('free_first_lesson')->default(0);
            
            // الحالة
            $table->enum('status', ['draft', 'pending', 'published'])->default('draft');
            $table->boolean('active')->default(1);
            
            // إحصائيات
            $table->integer('students_count')->default(0);
            $table->decimal('rating', 3, 2)->default(0);
            $table->integer('reviews_count')->default(0);
            
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('courses');
    }
};