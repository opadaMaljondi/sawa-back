<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->onDelete('cascade');
            
            $table->string('transaction_number')->unique();
            $table->enum('type', ['deposit', 'withdrawal', 'purchase', 'refund', 'referral']);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_before', 12, 2);
            $table->decimal('balance_after', 12, 2);
            
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('metadata')->nullable(); // JSON
            
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('transactions');
    }
};