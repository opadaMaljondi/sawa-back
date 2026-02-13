<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('chat_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            $table->boolean('is_admin')->default(0);
            $table->integer('unread_count')->default(0);
            
            $table->timestamp('joined_at');
            $table->timestamp('last_read_at')->nullable();
            
            $table->unique(['chat_id', 'user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('chat_participants');
    }
};