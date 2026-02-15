# لوحة تحكم ساوى – Admin Dashboard

واجهة إدارة أمامية بـ **React** و **Tailwind CSS** تتصل بـ Laravel API.

## المتطلبات

- Node.js 18+
- تشغيل الـ Backend (Laravel) على `http://localhost:8000`

## التثبيت والتشغيل

```bash
cd admin-dashboard
npm install
npm run dev
```

ثم افتح المتصفح على: **http://localhost:3000**

## تسجيل الدخول

- استخدم حساب **أدمن** من قاعدة البيانات (نوع المستخدم `admin`).
- الـ API: `POST /api/auth/login` بالحقول `login` (بريد أو هاتف) و `password`.

## المتغيرات البيئية

أنشئ ملف `.env` في مجلد `admin-dashboard` (اختياري):

```env
# إذا كان الـ API على عنوان آخر
VITE_API_URL=http://localhost:8000/api
```

بدون هذا المتغير، الطلبات ستذهب إلى `/api` وسيعمل الـ proxy في Vite إلى `http://localhost:8000`.

## البناء للإنتاج

```bash
npm run build
```

الملفات الناتجة في `dist/` يمكن رفعها على أي خادم ثابت أو داخل مجلد `public` في Laravel.

## الصفحات الحالية

- **لوحة التحكم**: إحصائيات، أفضل الكورسات، آخر التسجيلات.
- **تسجيل الدخول**: للأسمن فقط.
- باقي الروابط (طلاب، معلمون، كورسات، أقسام، إشعارات): صفحات placeholder جاهزة للتوسيع.
