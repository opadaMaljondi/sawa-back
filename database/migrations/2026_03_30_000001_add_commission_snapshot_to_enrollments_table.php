<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->decimal('admin_commission_percent', 5, 2)->nullable()->after('final_price');
            $table->decimal('platform_amount', 10, 2)->nullable()->after('admin_commission_percent');
            $table->decimal('instructor_amount', 10, 2)->nullable()->after('platform_amount');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn(['admin_commission_percent', 'platform_amount', 'instructor_amount']);
        });
    }
};
