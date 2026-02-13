<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('chats', function (Blueprint $table) {
            $table->id();
            
            $table->enum('type', ['private', 'group'])->default('private');
            
            $table->string('name')->nullable(); // للمجموعات
            $table->text('description')->nullable();
            $table->foreignId('course_id')->nullable()->constrained();
            
            $table->boolean('active')->default(1);
            
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('chats');
    }
};