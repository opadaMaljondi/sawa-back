<?php

return [
    /*
    | Default enrollment bonus for the referrer (paid when referred student first purchases).
    | Admin can override via Settings: referral_enrollment_bonus
    */
    'bonus_amount' => (float) env('REFERRAL_BONUS_AMOUNT', 0),
];
