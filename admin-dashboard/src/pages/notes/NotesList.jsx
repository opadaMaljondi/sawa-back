import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Search, Trash2, ExternalLink, Filter, Edit, Plus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { notesAPI, coursesAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const NotesList = () => {
    const { t } = useTranslation();
    const [notes, setNotes] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCourse, setFilterCourse] = useState('');
    const [error, setError] = useState('');

    // Add Modal State
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        course_id: '',
        title: '',
        description: '',
        price: 0,
        is_free: false,
        prevent_download: false
    });
    const [noteFile, setNoteFile] = useState(null);
    const [addLoading, setAddLoading] = useState(false);

    // Edit Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        price: 0,
        is_free: false,
        prevent_download: false,
        active: true
    });
    const [updateLoading, setUpdateLoading] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            setError('');
            const [notesData, coursesData] = await Promise.all([
                notesAPI.listAll(),
                coursesAPI.getAll({ per_page: 500 }) // Fetching many courses for selection
            ]);
            setNotes(notesData);
            setAllCourses(coursesData.data || []); // Assuming Paginated Response
        } catch (e) {
            console.error(e);
            setError('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) return;
        try {
            await notesAPI.delete(id);
            setNotes(notes.filter(n => n.id !== id));
        } catch (e) {
            console.error(e);
            alert('فشل حذف الملف');
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!noteFile) return alert('يرجى اختيار ملف');
        if (!addForm.course_id) return alert('يرجى اختيار الكورس');

        setAddLoading(true);
        try {
            const fd = new FormData();
            fd.append('course_id', addForm.course_id);
            fd.append('title', addForm.title);
            fd.append('description', addForm.description);
            fd.append('price', addForm.price);
            fd.append('is_free', addForm.is_free ? '1' : '0');
            fd.append('prevent_download', addForm.prevent_download ? '1' : '0');
            fd.append('file', noteFile);

            await notesAPI.create(fd);
            setAddModalOpen(false);
            setAddForm({ course_id: '', title: '', description: '', price: 0, is_free: false, prevent_download: false });
            setNoteFile(null);
            loadData();
        } catch (err) {
            console.error(err);
            alert('فشل رفع الملف');
        } finally {
            setAddLoading(false);
        }
    };

    const openEditModal = (note) => {
        setEditingNote(note);
        setEditForm({
            title: note.title,
            description: note.description || '',
            price: note.price || 0,
            is_free: !!note.is_free,
            prevent_download: !!note.prevent_download,
            active: !!note.active
        });
        setEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        try {
            await notesAPI.update(editingNote.id, editForm);
            setEditModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            alert('فشل تحديث بيانات الملف');
        } finally {
            setUpdateLoading(false);
        }
    };

    const filteredNotes = notes.filter(note => {
        const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.course?.title?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = !filterCourse || (note.course?.title || '').includes(filterCourse);
        return matchesSearch && matchesCourse;
    });

    // Extract unique course titles for filtering (existing notes)
    const existingCourseTitles = [...new Set(notes.map(n => n.course?.title).filter(Boolean))];

    return (
        <div className="students-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">إدارة الملفات المرفقة</h1>
                    <p className="page-subtitle">عرض وإدارة جميع الملفات المرفقة بالكورسات</p>
                </div>
                <Button variant="primary" onClick={() => setAddModalOpen(true)}>
                    <Plus size={18} className="ml-1" /> إضافة ملف جديد
                </Button>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <Input
                        placeholder="بحث بالعنوان أو الكورس..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        fullWidth
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>

                <div className="relative">
                    <select
                        className="input-field pr-10"
                        value={filterCourse}
                        onChange={(e) => setFilterCourse(e.target.value)}
                    >
                        <option value="">كل الكورسات</option>
                        {existingCourseTitles.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="p-8 text-center text-gray-500">جاري تحميل الملفات...</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : filteredNotes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">لا توجد ملفات مطابقة للبحث.</div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>العنوان</th>
                                    <th>الكورس</th>
                                    <th>النوع</th>
                                    <th>الحجم</th>
                                    <th>تاريخ الإضافة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNotes.map((note) => {
                                    const noteFileHref =
                                        resolveMediaUrl(note.file_url) || resolveMediaUrl(note.file_path);
                                    return (
                                    <tr key={note.id}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-blue-500" />
                                                <span className="font-medium">{note.title}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm text-gray-600">{note.course?.title || '-'}</td>
                                        <td><span className="text-xs font-bold uppercase">{note.file_type}</span></td>
                                        <td className="text-xs text-gray-500">
                                            {note.file_size ? `${(note.file_size / 1024).toFixed(1)} KB` : '-'}
                                        </td>
                                        <td className="text-xs text-gray-500">
                                            {new Date(note.created_at).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                {noteFileHref ? (
                                                <a
                                                    href={noteFileHref}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="action-btn flex items-center gap-1"
                                                    style={{ color: 'var(--color-primary-600)' }}
                                                    title="عرض الملف"
                                                >
                                                    <ExternalLink size={14} /> عرض
                                                </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                                <button
                                                    className="action-btn flex items-center gap-1"
                                                    style={{ color: 'var(--color-secondary-600)' }}
                                                    onClick={() => openEditModal(note)}
                                                    title="تعديل"
                                                >
                                                    <Edit size={14} /> تعديل
                                                </button>
                                                <button
                                                    className="action-btn flex items-center gap-1 text-red-600"
                                                    onClick={() => handleDelete(note.id)}
                                                    title="حذف"
                                                >
                                                    <Trash2 size={14} /> حذف
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Add Modal */}
            {addModalOpen && (
                <div className="modal-backdrop" onClick={() => setAddModalOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">إضافة ملف مرفق جديد</h3>
                        <form onSubmit={handleAdd} className="modal-body">
                            <div>
                                <label className="input-label">الكورس</label>
                                <select
                                    className="input-field"
                                    value={addForm.course_id}
                                    onChange={(e) => setAddForm(f => ({ ...f, course_id: e.target.value }))}
                                    required
                                >
                                    <option value="">اختر الكورس...</option>
                                    {allCourses.map(c => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                            <Input
                                label="العنوان"
                                value={addForm.title}
                                onChange={(e) => setAddForm(f => ({ ...f, title: e.target.value }))}
                                required
                                fullWidth
                            />
                            <div>
                                <label className="input-label">الوصف</label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    value={addForm.description}
                                    onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="السعر"
                                    type="number"
                                    value={addForm.price}
                                    onChange={(e) => setAddForm(f => ({ ...f, price: e.target.value }))}
                                    fullWidth
                                />
                                <div>
                                    <label className="input-label">الملف (PDF, PPT, Doc)</label>
                                    <input
                                        type="file"
                                        className="input-field"
                                        onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addForm.is_free}
                                        onChange={(e) => setAddForm(f => ({ ...f, is_free: e.target.checked }))}
                                    />
                                    <span className="text-sm">ملف مجاني</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={addForm.prevent_download}
                                        onChange={(e) => setAddForm(f => ({ ...f, prevent_download: e.target.checked }))}
                                    />
                                    <span className="text-sm">منع التحميل</span>
                                </label>
                            </div>

                            <div className="modal-actions mt-6">
                                <Button type="submit" variant="primary" loading={addLoading}>رفع الملف</Button>
                                <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>إلغاء</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModalOpen && (
                <div className="modal-backdrop" onClick={() => setEditModalOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">تعديل بيانات الملف</h3>
                        <form onSubmit={handleUpdate} className="modal-body">
                            <Input
                                label="العنوان"
                                value={editForm.title}
                                onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                                required
                                fullWidth
                            />
                            <div>
                                <label className="input-label">الوصف</label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="السعر"
                                    type="number"
                                    value={editForm.price}
                                    onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))}
                                    fullWidth
                                />
                                <div className="flex flex-col gap-2 justify-center">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.is_free}
                                            onChange={(e) => setEditForm(f => ({ ...f, is_free: e.target.checked }))}
                                        />
                                        <span className="text-sm">ملف مجاني</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.prevent_download}
                                            onChange={(e) => setEditForm(f => ({ ...f, prevent_download: e.target.checked }))}
                                        />
                                        <span className="text-sm">منع التحميل</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.active}
                                            onChange={(e) => setEditForm(f => ({ ...f, active: e.target.checked }))}
                                        />
                                        <span className="text-sm">نشط (يظهر للطلاب)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-actions mt-6">
                                <Button type="submit" variant="primary" loading={updateLoading}>حفظ التغييرات</Button>
                                <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>إلغاء</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotesList;
