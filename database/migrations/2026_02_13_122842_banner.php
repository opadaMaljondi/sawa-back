<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('banners', function (Blueprint $table) {
            $table->id();
            
            $table->string('title');
            $table->text('description')->nullable();
            
            $table->string('image');
            $table->string('link_url')->nullable();
            
            $table->integer('order')->default(0);
            
            $table->boolean('active')->default(1);
            $table->timestamp('start_date');
            $table->timestamp('end_date');
            
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('banners');
    }
};