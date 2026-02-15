<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('scope', 32)->default('general')->after('type'); // general, department, course, chat
            $table->unsignedBigInteger('target_id')->nullable()->after('scope'); // department_id or course_id
        });
    }

    public function down()
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['scope', 'target_id']);
        });
    }
};
