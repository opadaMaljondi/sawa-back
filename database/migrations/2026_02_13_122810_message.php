<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_id')->constrained()->onDelete('cascade');
            $table->foreignId('sender_id')->constrained('users')->onDelete('cascade');
            
            $table->text('content')->nullable();
            $table->enum('type', ['text', 'image', 'file', 'voice'])->default('text');
            
            $table->string('media_url')->nullable();
            $table->string('media_name')->nullable();
            $table->bigInteger('media_size')->nullable();
            
            $table->foreignId('reply_to_id')->nullable()->constrained('messages');
            
            $table->boolean('read')->default(0);
            $table->text('read_by')->nullable(); // JSON
            
            $table->timestamp('sent_at');
            $table->timestamp('edited_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down()
    {
        Schema::dropIfExists('messages');
    }
};