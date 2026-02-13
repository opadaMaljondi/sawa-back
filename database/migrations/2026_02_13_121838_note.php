<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            $table->foreignId('lesson_id')->nullable()->constrained();
            
            $table->string('title');
            $table->text('description')->nullable();
            
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_type'); // pdf, doc, ppt
            $table->bigInteger('file_size');
            
            $table->decimal('price', 10, 2)->default(0);
            $table->boolean('is_free')->default(0);
            
            $table->foreignId('department_id')->nullable()->constrained();
            $table->foreignId('subject_id')->nullable()->constrained();
            
            $table->boolean('prevent_download')->default(0);
            $table->boolean('active')->default(1);
            
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('notes');
    }
};