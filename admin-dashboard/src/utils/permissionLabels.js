/**
 * يحويل اسم الصلاحية من الخادم (مثل "create video") إلى مفتاح i18n تحت permissions.permissionNames.*
 */
export function permissionNameToTranslationKey(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  return name.trim().replace(/\s+/g, '_');
}

/**
 * @param {string} name — اسم الصلاحية كما في قاعدة البيانات
 * @param {(key: string, opts?: object) => string} t — من useTranslation()
 */
export function translatePermissionName(name, t) {
  const slug = permissionNameToTranslationKey(name);
  if (!slug) {
    return name;
  }
  return t(`permissions.permissionNames.${slug}`, { defaultValue: name });
}
