import { useEffect, useMemo, useState } from 'react';
import { notify } from '../components/AppNotification';

const AdminIcon = ({ name, size = 16 }) => {
    const paths = {
        add: <path d="M12 5v14M5 12h14" />,
        edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
        delete: <><path d="M3 6h18" /><path d="M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        save: <><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8V3M8 17h8" /></>,
        close: <path d="m6 6 12 12M18 6 6 18" />,
        sort: <path d="m8 9 4-4 4 4M16 15l-4 4-4-4" />,
        status: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
        menu: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
        stock: <><path d="M3 7h18v13H3Z" /><path d="m3 7 3-4h12l3 4M9 11h6" /></>,
    };

    return (
        <svg
            aria-hidden="true"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {paths[name]}
        </svg>
    );
};

const formatCategoryDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const PRODUCT_SORT_LABELS = {
    name: 'สินค้า',
    stock: 'คลัง',
    price: 'ราคา',
    updated_at: 'แก้ไขล่าสุด',
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadFile = (content, fileName, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

function AdminAddProductPage({
    newProduct,
    setNewProduct,
    onSubmit,
    products = [],
    productsLoading = false,
    editProduct,
    setEditProduct,
    onSaveEditProduct,
    onDeleteProduct,
    onToggleProductStatus,
    onOpenStockEdit,
    categories = [],
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
}) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [productAdminView, setProductAdminView] = useState(() => {
        const requestedView = sessionStorage.getItem('adminProductView');
        sessionStorage.removeItem('adminProductView');
        return requestedView === 'categories' ? 'categories' : 'products';
    });
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [productSearch, setProductSearch] = useState('');
    const [productSort, setProductSort] = useState({ key: 'name', direction: 'asc' });
    const [productPage, setProductPage] = useState(1);
    const [productPageSize, setProductPageSize] = useState(10);
    const [productToDelete, setProductToDelete] = useState(null);
    const [productActionId, setProductActionId] = useState(null);
    const [productError, setProductError] = useState('');
    const [openProductMenuId, setOpenProductMenuId] = useState(null);
    const [categoryStatusFilter, setCategoryStatusFilter] = useState('all');
    const [categorySearch, setCategorySearch] = useState('');
    const [categorySort, setCategorySort] = useState({ key: 'created_at', direction: 'desc' });
    const [categoryPage, setCategoryPage] = useState(1);
    const [categoryPageSize, setCategoryPageSize] = useState(10);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [categoryActionId, setCategoryActionId] = useState(null);
    const activeCategories = categories.filter((category) => Number(category.status_category ?? 1) === 1);
    const filteredCategories = useMemo(() => {
        const keyword = categorySearch.trim().toLocaleLowerCase('th');
        return categories.filter((category) => {
            const isActive = Number(category.status_category ?? 1) === 1;
            const matchesStatus = categoryStatusFilter === 'all'
                || (categoryStatusFilter === 'active' ? isActive : !isActive);
            const matchesSearch = !keyword
                || String(category.category_name || '').toLocaleLowerCase('th').includes(keyword);
            return matchesStatus && matchesSearch;
        }).sort((a, b) => {
            let result = 0;
            if (categorySort.key === 'category_name') {
                result = String(a.category_name || '').localeCompare(String(b.category_name || ''), 'th');
            } else if (categorySort.key === 'status_category') {
                result = Number(a.status_category ?? 1) - Number(b.status_category ?? 1);
            } else {
                const aDate = new Date(a.created_at || 0).getTime();
                const bDate = new Date(b.created_at || 0).getTime();
                result = aDate - bDate;
            }
            return categorySort.direction === 'asc' ? result : -result;
        });
    }, [categories, categorySearch, categorySort, categoryStatusFilter]);
    const categoryTotalPages = Math.max(1, Math.ceil(filteredCategories.length / categoryPageSize));
    const paginatedCategories = filteredCategories.slice(
        (categoryPage - 1) * categoryPageSize,
        categoryPage * categoryPageSize,
    );

    useEffect(() => {
        setCategoryPage((current) => Math.min(current, categoryTotalPages));
    }, [categoryTotalPages]);

    useEffect(() => {
        setCategoryPage(1);
    }, [categorySearch, categoryStatusFilter, categoryPageSize]);
    const productCategoryOptions = [...activeCategories].sort((a, b) => a.category_name.localeCompare(b.category_name, 'th'));
    const categoryFilterOptions = Array.from(new Set(
        [
            ...productCategoryOptions.map((category) => category.category_name),
            ...products.map((product) => product.category_name || 'ทั่วไป'),
        ].filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'th'));
    const filteredProducts = useMemo(() => {
        const keyword = productSearch.trim().toLocaleLowerCase('th');
        return products.filter((product) => {
            const matchesCategory = categoryFilter === 'all'
                || (product.category_name || 'ทั่วไป') === categoryFilter;
            const isActive = Number(product.product_status ?? 1) === 1;
            const stock = Number(product.stock) || 0;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' ? isActive : !isActive);
            const matchesStock = stockFilter === 'all'
                || (stockFilter === 'low' && stock < 10)
                || (stockFilter === 'out' && stock === 0);
            const sku = `PRD-${String(product.id || '').padStart(6, '0')}`.toLocaleLowerCase('th');
            const matchesSearch = !keyword
                || String(product.name || '').toLocaleLowerCase('th').includes(keyword)
                || String(product.category_name || '').toLocaleLowerCase('th').includes(keyword)
                || sku.includes(keyword);
            return matchesCategory && matchesStatus && matchesStock && matchesSearch;
        }).sort((a, b) => {
            let result = 0;
            if (productSort.key === 'name') {
                result = String(a.name || '').localeCompare(String(b.name || ''), 'th');
            } else if (productSort.key === 'price') {
                result = Number(a.price) - Number(b.price);
            } else if (productSort.key === 'stock') {
                result = Number(a.stock) - Number(b.stock);
            } else {
                result = new Date(a.updated_at || a.created_at || 0).getTime()
                    - new Date(b.updated_at || b.created_at || 0).getTime();
            }
            return productSort.direction === 'asc' ? result : -result;
        });
    }, [products, productSearch, categoryFilter, statusFilter, stockFilter, productSort]);
    const productTotalPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
    const paginatedProducts = filteredProducts.slice(
        (productPage - 1) * productPageSize,
        productPage * productPageSize,
    );

    useEffect(() => {
        setProductPage((current) => Math.min(current, productTotalPages));
    }, [productTotalPages]);

    useEffect(() => {
        setProductPage(1);
    }, [productSearch, categoryFilter, statusFilter, stockFilter, productPageSize]);
    const findCategoryById = (categoryId) => productCategoryOptions.find((category) => String(category.category_id) === String(categoryId));
    const selectedNewCategoryId = String(
        newProduct.category_id || productCategoryOptions.find((category) => category.category_name === newProduct.category_name)?.category_id || '',
    );
    const selectedEditCategoryId = String(
        editProduct.category_id || productCategoryOptions.find((category) => category.category_name === editProduct.category_name)?.category_id || '',
    );
    const getCategorySelection = (categoryId) => {
        const selectedCategory = findCategoryById(categoryId);
        return {
            category_id: selectedCategory?.category_id || '',
            category_name: selectedCategory?.category_name || '',
        };
    };

    const handleImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            notify({ type: 'warning', title: 'ไฟล์ไม่ถูกต้อง', message: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' });
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setNewProduct({
                ...newProduct,
                image_data: reader.result,
                image_preview: reader.result,
                image_name: file.name,
                image_url: '',
            });
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setNewProduct({
            ...newProduct,
            image_data: '',
            image_preview: '',
            image_name: '',
            image_url: '',
        });
    };

    const handleEditImageChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            notify({ type: 'warning', title: 'ไฟล์ไม่ถูกต้อง', message: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' });
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setEditProduct({
                ...editProduct,
                image_data: reader.result,
                image_preview: reader.result,
                image_name: file.name,
            });
        };
        reader.readAsDataURL(file);
    };

    const removeEditImage = () => {
        setEditProduct({
            ...editProduct,
            image_url: '',
            image_data: '',
            image_preview: '',
            image_name: '',
        });
    };

    const submitNewCategory = async () => {
        setCategoryError('');
        const result = await onAddCategory?.(newCategoryName);

        if (result?.success) {
            setNewCategoryName('');
            return;
        }

        setCategoryError(result?.message || 'เพิ่มหมวดหมู่สินค้าไม่สำเร็จ');
    };

    const startEditCategory = (category) => {
        setCategoryError('');
        setEditingCategoryId(category.category_id);
        setEditingCategoryName(category.category_name);
    };

    const saveCategory = async (category) => {
        setCategoryError('');
        const result = await onUpdateCategory?.(category.category_id, {
            category_name: editingCategoryName,
            status_category: category.status_category,
        });

        if (result?.success) {
            setEditingCategoryId(null);
            setEditingCategoryName('');
            return;
        }

        setCategoryError(result?.message || 'บันทึกหมวดหมู่สินค้าไม่สำเร็จ');
    };

    const toggleCategoryStatus = async (category) => {
        setCategoryError('');
        const nextStatus = Number(category.status_category ?? 1) === 1 ? 0 : 1;
        setCategoryActionId(category.category_id);
        const result = await onUpdateCategory?.(category.category_id, {
            category_name: category.category_name,
            status_category: nextStatus,
        });
        setCategoryActionId(null);

        if (!result?.success && result?.message) {
            setCategoryError(result.message);
        }
    };

    const requestCategorySort = (key) => {
        setCategorySort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
        setCategoryPage(1);
    };

    const confirmDeleteCategory = async () => {
        if (!categoryToDelete) return;
        setCategoryError('');
        setCategoryActionId(categoryToDelete.category_id);
        const result = await onDeleteCategory?.(categoryToDelete.category_id);
        setCategoryActionId(null);

        if (result?.success) {
            setCategoryToDelete(null);
            return;
        }
        setCategoryError(result?.message || 'ลบหมวดหมู่สินค้าไม่สำเร็จ');
        setCategoryToDelete(null);
    };

    const requestProductSort = (key) => {
        setProductSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
        setProductPage(1);
    };

    const productSortHeader = (key) => (
        <button
            type="button"
            className={`category-sort-button ${productSort.key === key ? 'active' : ''}`}
            onClick={() => requestProductSort(key)}
            aria-label={`เรียงตาม${PRODUCT_SORT_LABELS[key]} ${productSort.key === key && productSort.direction === 'asc' ? 'จากมากไปน้อย' : 'จากน้อยไปมาก'}`}
        >
            {PRODUCT_SORT_LABELS[key]} <span aria-hidden="true">{productSort.key === key ? (productSort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
    );

    const openProductEditor = (product) => {
        setOpenProductMenuId(null);
        setEditProduct({
            id: product.id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            category_id: product.category_id || '',
            category_name: product.category_name || 'ทั่วไป',
            description: product.description || '',
            image_url: product.image_url || '',
            image_data: '',
            image_preview: product.image_url || '',
            image_name: '',
        });
    };

    const toggleProductStatus = async (product) => {
        setProductError('');
        setProductActionId(product.id);
        const result = await onToggleProductStatus?.(product);
        setProductActionId(null);
        if (!result?.success) {
            setProductError(result?.message || 'เปลี่ยนสถานะสินค้าไม่สำเร็จ');
        }
    };

    const confirmDeleteProduct = async () => {
        if (!productToDelete) return;
        setProductError('');
        setProductActionId(productToDelete.id);
        const result = await onDeleteProduct?.(productToDelete);
        setProductActionId(null);

        if (result?.success) {
            setProductToDelete(null);
            return;
        }
        setProductError(result?.message || 'ลบสินค้าไม่สำเร็จ');
        setProductToDelete(null);
    };

    const exportProductsReport = (format) => {
        const rows = filteredProducts.map((product) => {
            const stock = Number(product.stock) || 0;
            const isInactive = Number(product.product_status ?? 1) === 0;
            return {
                sku: `PRD-${String(product.id || '').padStart(6, '0')}`,
                name: product.name || '-',
                category: product.category_name || 'ทั่วไป',
                stock,
                price: Number(product.price) || 0,
                status: isInactive ? 'ปิดใช้งาน' : 'เปิดใช้งาน',
                updatedAt: formatCategoryDate(product.updated_at || product.created_at),
            };
        });

        if (!rows.length) {
            notify({ type: 'warning', title: 'ไม่มีข้อมูล', message: 'ยังไม่มีสินค้าตามตัวกรองสำหรับพิมพ์รายงาน' });
            return;
        }

        const fileBase = `products-report-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'csv') {
            const csv = [
                ['SKU', 'ชื่อสินค้า', 'หมวดหมู่', 'สต็อก', 'ราคา', 'สถานะ', 'แก้ไขล่าสุด'],
                ...rows.map((row) => [row.sku, row.name, row.category, row.stock, row.price, row.status, row.updatedAt]),
            ].map((line) => line.map(escapeCsv).join(',')).join('\n');
            downloadFile(`\uFEFF${csv}`, `${fileBase}.csv`, 'text/csv;charset=utf-8;');
            return;
        }

        if (format === 'excel') {
            const tableRows = rows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.sku)}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.category)}</td>
                    <td>${escapeHtml(row.stock)}</td>
                    <td>${escapeHtml(formatMoney(row.price))}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td>${escapeHtml(row.updatedAt)}</td>
                </tr>
            `).join('');
            const html = `
                <html>
                    <head><meta charset="utf-8" /></head>
                    <body>
                        <table border="1">
                            <thead>
                                <tr><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สต็อก</th><th>ราคา</th><th>สถานะ</th><th>แก้ไขล่าสุด</th></tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </body>
                </html>
            `;
            downloadFile(`\uFEFF${html}`, `${fileBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
            return;
        }

        const popup = window.open('', '_blank', 'width=1100,height=820');
        if (!popup) {
            notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
            return;
        }
        const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
        const tableRows = rows.map((row) => `
            <tr>
                <td>${escapeHtml(row.sku)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.stock)}</td>
                <td>${escapeHtml(formatMoney(row.price))}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${escapeHtml(row.updatedAt)}</td>
            </tr>
        `).join('');
        popup.document.write(`
            <!doctype html>
            <html lang="th">
                <head>
                    <meta charset="utf-8" />
                    <title>รายงานสินค้า</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                        h1 { margin: 0 0 8px; font-size: 24px; }
                        p { margin: 0 0 18px; color: #4b5563; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                        th { background: #f3f4f6; }
                        .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                        .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                        .primary { background: #111827; color: #fff; }
                        .secondary { background: #e5e7eb; color: #111827; }
                        @media print { .actions { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="actions">
                        <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                        <button class="secondary" onclick="window.close()">ปิด</button>
                    </div>
                    <h1>รายงานสินค้า</h1>
                    <p>จำนวน ${escapeHtml(rows.length)} รายการ • พิมพ์เมื่อ ${escapeHtml(printedAt)}</p>
                    <table>
                        <thead>
                            <tr><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สต็อก</th><th>ราคา</th><th>สถานะ</th><th>แก้ไขล่าสุด</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
    };

    const exportCategoriesReport = (format) => {
        const rows = filteredCategories.map((category) => ({
            id: category.category_id,
            name: category.category_name || '-',
            status: Number(category.status_category ?? 1) === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            createdAt: formatCategoryDate(category.created_at),
        }));

        if (!rows.length) {
            notify({ type: 'warning', title: 'ไม่มีข้อมูล', message: 'ยังไม่มีหมวดหมู่ตามตัวกรองสำหรับพิมพ์รายงาน' });
            return;
        }

        const fileBase = `categories-report-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'csv') {
            const csv = [
                ['รหัสหมวดหมู่', 'ชื่อหมวดหมู่', 'สถานะ', 'วันที่สร้าง'],
                ...rows.map((row) => [row.id, row.name, row.status, row.createdAt]),
            ].map((line) => line.map(escapeCsv).join(',')).join('\n');
            downloadFile(`\uFEFF${csv}`, `${fileBase}.csv`, 'text/csv;charset=utf-8;');
            return;
        }

        if (format === 'excel') {
            const tableRows = rows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.id)}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td>${escapeHtml(row.createdAt)}</td>
                </tr>
            `).join('');
            const html = `
                <html>
                    <head><meta charset="utf-8" /></head>
                    <body>
                        <table border="1">
                            <thead>
                                <tr><th>รหัสหมวดหมู่</th><th>ชื่อหมวดหมู่</th><th>สถานะ</th><th>วันที่สร้าง</th></tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </body>
                </html>
            `;
            downloadFile(`\uFEFF${html}`, `${fileBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
            return;
        }

        const popup = window.open('', '_blank', 'width=900,height=760');
        if (!popup) {
            notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
            return;
        }
        const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
        const tableRows = rows.map((row) => `
            <tr>
                <td>${escapeHtml(row.id)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${escapeHtml(row.createdAt)}</td>
            </tr>
        `).join('');
        popup.document.write(`
            <!doctype html>
            <html lang="th">
                <head>
                    <meta charset="utf-8" />
                    <title>รายงานหมวดหมู่สินค้า</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                        h1 { margin: 0 0 8px; font-size: 24px; }
                        p { margin: 0 0 18px; color: #4b5563; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                        th { background: #f3f4f6; }
                        .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                        .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                        .primary { background: #111827; color: #fff; }
                        .secondary { background: #e5e7eb; color: #111827; }
                        @media print { .actions { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="actions">
                        <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                        <button class="secondary" onclick="window.close()">ปิด</button>
                    </div>
                    <h1>รายงานหมวดหมู่สินค้า</h1>
                    <p>จำนวน ${escapeHtml(rows.length)} รายการ • พิมพ์เมื่อ ${escapeHtml(printedAt)}</p>
                    <table>
                        <thead>
                            <tr><th>รหัสหมวดหมู่</th><th>ชื่อหมวดหมู่</th><th>สถานะ</th><th>วันที่สร้าง</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
    };

    const exportCurrentReport = (format) => {
        if (productAdminView === 'categories') {
            exportCategoriesReport(format);
            return;
        }
        exportProductsReport(format);
    };

    return (
        <>
            <div className="card border-0 shadow-sm rounded-4 p-5 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h3 className="fw-bold mb-1">{productAdminView === 'products' ? 'จัดการสินค้า' : 'จัดการหมวดหมู่สินค้า'}</h3>
                        <p className="text-muted mb-0">
                            {productAdminView === 'products'
                                ? 'เพิ่มสินค้า ปรับข้อมูล และดูรายการสินค้าในคลัง'
                                : 'เพิ่ม แก้ไข เปิดหรือปิดใช้งานหมวดหมู่สินค้า'}
                        </p>
                    </div>
                    <div className="admin-subtabs-wrap">
                        <div className="panel-export-buttons">
                            <button type="button" onClick={() => exportCurrentReport('csv')}>CSV</button>
                            <button type="button" onClick={() => exportCurrentReport('excel')}>Excel</button>
                            <button type="button" className="primary" onClick={() => exportCurrentReport('pdf')}>PDF</button>
                        </div>
                        <div className="admin-subtabs">
                            <button
                                type="button"
                                className={productAdminView === 'products' ? 'active' : ''}
                                onClick={() => setProductAdminView('products')}
                            >
                                จัดการสินค้า
                            </button>
                            <button
                                type="button"
                                className={productAdminView === 'categories' ? 'active' : ''}
                                onClick={() => setProductAdminView('categories')}
                            >
                                จัดการหมวดหมู่
                            </button>
                        </div>
                    </div>
                </div>

                {productAdminView === 'products' && showAddForm && (
                    <form
                        onSubmit={async (event) => {
                            const isSaved = await onSubmit(event);
                            if (isSaved) setShowAddForm(false);
                        }}
                        className="row g-4 mt-1"
                    >
                        <div className="col-md-8">
                            <label className="small fw-bold">ชื่อสินค้า</label>
                            <input type="text" className="form-control" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
                        </div>
                        <div className="col-md-4">
                            <label className="small fw-bold">ราคา (฿)</label>
                            <input type="number" className="form-control" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold">สต็อกเริ่มต้น</label>
                            <input
                                type="number"
                                className="form-control"
                                min="1"
                                step="1"
                                value={newProduct.stock}
                                onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                                onKeyDown={(e) => ['-', '+', '.', 'e', 'E'].includes(e.key) && e.preventDefault()}
                                required
                            />
                        </div>
                        <div className="col-md-6">
                            <label className="small fw-bold">หมวดหมู่สินค้า</label>
                            <select
                                className="form-control"
                                value={selectedNewCategoryId}
                                onChange={(e) => setNewProduct({ ...newProduct, ...getCategorySelection(e.target.value) })}
                                required
                                disabled={productCategoryOptions.length === 0}
                            >
                                <option value="">เลือกหมวดหมู่สินค้า</option>
                                {productCategoryOptions.map((category) => (
                                    <option key={category.category_id} value={category.category_id}>
                                        {category.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-12">
                            <label className="small fw-bold">รูปภาพสินค้า</label>
                            <div className="product-upload">
                                <div className="product-upload-preview">
                                    {newProduct.image_preview ? (
                                        <img src={newProduct.image_preview} alt="ตัวอย่างรูปสินค้า" />
                                    ) : (
                                        <div className="product-upload-empty">
                                            <span>เลือกรูปภาพสินค้า</span>
                                            <small>รองรับ PNG, JPG, WEBP หรือ GIF</small>
                                        </div>
                                    )}
                                </div>
                                <div className="product-upload-control">
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                        onChange={handleImageChange}
                                        required={!newProduct.image_preview}
                                    />
                                    {newProduct.image_name && <div className="small text-muted mt-2">{newProduct.image_name}</div>}
                                    {newProduct.image_preview && (
                                        <button type="button" className="btn btn-outline-danger btn-sm mt-3" onClick={removeImage}>
                                            ลบรูป
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-md-12">
                            <label className="small fw-bold">รายละเอียดสินค้า</label>
                            <textarea className="form-control" rows="3" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}></textarea>
                        </div>
                        <div className="col-12 text-end">
                            <button className="btn btn-primary btn-lg px-5 rounded-pill fw-bold mt-3">บันทึกสินค้า</button>
                        </div>
                    </form>
                )}
            </div>

            {productAdminView === 'products' && (
                <section className="admin-panel inventory-admin-panel">
                    <div className="admin-panel-header inventory-panel-header">
                        <div>
                            <h2>จัดการคลังสินค้า</h2>
                            <p>ดูภาพรวมสินค้า สต็อก ราคา และสถานะการขายในที่เดียว</p>
                        </div>
                        <button type="button" className="admin-action primary inventory-add-button" onClick={() => setShowAddForm((current) => !current)}>
                            <AdminIcon name={showAddForm ? 'close' : 'add'} />
                            {showAddForm ? 'ซ่อนฟอร์ม' : 'เพิ่มสินค้า'}
                        </button>
                    </div>

                    <div className="inventory-panel-body">
                        <div className="inventory-toolbar">
                            <label className="inventory-search">
                                <AdminIcon name="search" size={18} />
                                <input
                                    value={productSearch}
                                    onChange={(event) => setProductSearch(event.target.value)}
                                    placeholder="ค้นหาชื่อสินค้า หมวดหมู่ หรือ SKU..."
                                    aria-label="ค้นหาสินค้า"
                                />
                            </label>
                            <div className="inventory-filters">
                                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                                    <option value="all">ทุกหมวดหมู่</option>
                                    {categoryFilterOptions.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="กรองตามสถานะสินค้า">
                                    <option value="all">ทุกสถานะ</option>
                                    <option value="active">เปิดใช้งาน</option>
                                    <option value="inactive">ปิดใช้งาน</option>
                                </select>
                                <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} aria-label="กรองตามจำนวนสินค้า">
                                    <option value="all">ทุกระดับสต็อก</option>
                                    <option value="low">ใกล้หมด (&lt; 10)</option>
                                    <option value="out">สินค้าหมด</option>
                                </select>
                                <span className="inventory-count-badge">{filteredProducts.length} สินค้า</span>
                            </div>
                        </div>

                        {productError && (
                            <div className="alert alert-danger py-2 small fw-bold">
                                {productError}
                            </div>
                        )}

                        <div className="admin-table-wrap inventory-table-wrap">
                            <table className="admin-table inventory-table">
                                <colgroup>
                                    <col className="inventory-product-col" />
                                    <col className="inventory-sku-col" />
                                    <col className="inventory-stock-col" />
                                    <col className="inventory-price-col" />
                                    <col className="inventory-status-col" />
                                    <col className="inventory-date-col" />
                                    <col className="inventory-actions-col" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>{productSortHeader('name')}</th>
                                        <th>SKU</th>
                                        <th>{productSortHeader('stock')}</th>
                                        <th>{productSortHeader('price')}</th>
                                        <th>สถานะ</th>
                                        <th>{productSortHeader('updated_at')}</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productsLoading ? (
                                        Array.from({ length: 5 }).map((_, index) => (
                                            <tr key={`loading-${index}`} className="inventory-loading-row">
                                                <td><div className="inventory-skeleton product" /></td>
                                                <td><div className="inventory-skeleton short" /></td>
                                                <td><div className="inventory-skeleton short" /></td>
                                                <td><div className="inventory-skeleton medium" /></td>
                                                <td><div className="inventory-skeleton medium" /></td>
                                                <td><div className="inventory-skeleton medium" /></td>
                                                <td><div className="inventory-skeleton short" /></td>
                                            </tr>
                                        ))
                                    ) : paginatedProducts.length > 0 ? (
                                        paginatedProducts.map((product) => {
                                            const stock = Number(product.stock) || 0;
                                            const lowStock = stock < 10;
                                            const outOfStock = stock === 0;
                                            const isInactive = Number(product.product_status) === 0;
                                            const isBusy = productActionId === product.id;

                                            return (
                                                <tr key={product.id}>
                                                    <td>
                                                        <div className="admin-product-cell inventory-product-cell">
                                                            <div className="admin-product-thumb inventory-product-thumb">
                                                                {product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>{product.name?.charAt(0) || 'P'}</span>}
                                                            </div>
                                                            <div className="inventory-product-info">
                                                                <strong>{product.name}</strong>
                                                                <span className="inventory-category">{product.category_name || 'ทั่วไป'}</span>
                                                                <small className={!product.description ? 'inventory-description empty' : 'inventory-description'}>
                                                                    {product.description || 'ยังไม่มีรายละเอียด'}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><code className="inventory-sku">PRD-{String(product.id).padStart(6, '0')}</code></td>
                                                    <td>
                                                        <div className={`inventory-stock ${lowStock ? 'low' : ''}`}>
                                                            <strong>{stock}</strong><span>ชิ้น</span>
                                                        </div>
                                                        {lowStock && (
                                                            <span className={`inventory-low-stock ${outOfStock ? 'out' : ''}`}>
                                                                {outOfStock ? 'สินค้าหมด' : 'ใกล้หมด'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="admin-money">฿{formatMoney(product.price)}</td>
                                                    <td>
                                                        <div className="category-toggle-wrap">
                                                            <button
                                                                type="button"
                                                                className={`category-toggle ${isInactive ? 'inactive' : 'active'}`}
                                                                role="switch"
                                                                aria-checked={!isInactive}
                                                                aria-label={`${isInactive ? 'เปิด' : 'ปิด'}ใช้งาน ${product.name}`}
                                                                disabled={isBusy}
                                                                onClick={() => toggleProductStatus(product)}
                                                            >
                                                                <span />
                                                            </button>
                                                            <span className={isInactive ? 'category-status-text inactive' : 'category-status-text active'}>
                                                                {isInactive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td><span className="category-date">{formatCategoryDate(product.updated_at || product.created_at)}</span></td>
                                                    <td>
                                                        <div className="inventory-action-menu">
                                                            <button
                                                                type="button"
                                                                className="inventory-menu-trigger"
                                                                aria-label={`เปิดเมนูจัดการ ${product.name}`}
                                                                aria-expanded={openProductMenuId === product.id}
                                                                onClick={() => setOpenProductMenuId((current) => current === product.id ? null : product.id)}
                                                            >
                                                                <AdminIcon name="menu" size={20} />
                                                            </button>
                                                            {openProductMenuId === product.id && (
                                                                <div className="inventory-menu-dropdown">
                                                                    <button type="button" className="stock" disabled={isInactive} onClick={() => { setOpenProductMenuId(null); onOpenStockEdit(product); }}>
                                                                        <AdminIcon name="stock" /> ปรับสต็อก
                                                                    </button>
                                                                    <button type="button" className="edit" onClick={() => openProductEditor(product)}>
                                                                        <AdminIcon name="edit" /> แก้ไขสินค้า
                                                                    </button>
                                                                    <button type="button" className="delete" onClick={() => { setOpenProductMenuId(null); setProductToDelete(product); }}>
                                                                        <AdminIcon name="delete" /> ลบสินค้า
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="7">
                                                <div className="inventory-empty-state">
                                                    <div><AdminIcon name="stock" size={30} /></div>
                                                    <strong>ไม่พบสินค้า</strong>
                                                    <p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง แล้วตรวจสอบอีกครั้ง</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!productsLoading && (
                            <div className="category-pagination inventory-pagination">
                                <div className="category-page-size">
                                    แสดง
                                    <select value={productPageSize} onChange={(event) => setProductPageSize(Number(event.target.value))}>
                                        <option value="5">5</option>
                                        <option value="10">10</option>
                                        <option value="20">20</option>
                                    </select>
                                    รายการ
                                </div>
                                <span>
                                    {filteredProducts.length > 0
                                        ? `${(productPage - 1) * productPageSize + 1}-${Math.min(productPage * productPageSize, filteredProducts.length)} จาก ${filteredProducts.length}`
                                        : '0 รายการ'}
                                </span>
                                <div className="category-page-buttons">
                                    <button type="button" disabled={productPage === 1} onClick={() => setProductPage((page) => page - 1)}>ก่อนหน้า</button>
                                    <strong>{productPage} / {productTotalPages}</strong>
                                    <button type="button" disabled={productPage === productTotalPages} onClick={() => setProductPage((page) => page + 1)}>ถัดไป</button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {productAdminView === 'categories' && (
                <section className="admin-panel category-admin-panel">
                    <div className="admin-panel-header category-panel-header">
                        <div>
                            <h2>จัดการหมวดหมู่สินค้า</h2>
                            <p>จัดระเบียบหมวดหมู่ สถานะ และข้อมูลสินค้าภายในระบบ</p>
                        </div>
                        <div className="category-header-tools">
                            <div className="category-create-row">
                                <input
                                    className="form-control category-create-input"
                                    value={newCategoryName}
                                    onChange={(event) => {
                                        setCategoryError('');
                                        setNewCategoryName(event.target.value);
                                    }}
                                    placeholder="ชื่อหมวดหมู่สินค้าใหม่"
                                />
                                <button type="button" className="admin-action success" onClick={submitNewCategory}>
                                    <AdminIcon name="add" /> เพิ่มหมวดหมู่
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="category-panel-body">
                        <div className="category-toolbar">
                            <label className="category-search">
                                <AdminIcon name="search" size={18} />
                                <input
                                    value={categorySearch}
                                    onChange={(event) => setCategorySearch(event.target.value)}
                                    placeholder="ค้นหาชื่อหมวดหมู่..."
                                    aria-label="ค้นหาหมวดหมู่สินค้า"
                                />
                            </label>
                            <div className="category-filter-row">
                                <select
                                    value={categoryStatusFilter}
                                    onChange={(event) => setCategoryStatusFilter(event.target.value)}
                                    aria-label="กรองสถานะหมวดหมู่สินค้า"
                                >
                                    <option value="all">ทุกสถานะ</option>
                                    <option value="active">เปิดใช้งาน</option>
                                    <option value="inactive">ปิดใช้งาน</option>
                                </select>
                                <span className="category-count-badge">{filteredCategories.length} หมวดหมู่</span>
                            </div>
                        </div>

                        {categoryError && (
                            <div className="alert alert-danger py-2 small fw-bold">
                                {categoryError}
                            </div>
                        )}

                        <div className="admin-table-wrap">
                            <table className="admin-table category-table">
                                <colgroup>
                                    <col className="category-name-col" />
                                    <col className="category-count-col" />
                                    <col className="category-status-col" />
                                    <col className="category-date-col" />
                                    <col className="category-actions-col" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>
                                            <button type="button" className="category-sort-button" onClick={() => requestCategorySort('category_name')}>
                                                หมวดหมู่สินค้า <AdminIcon name="sort" />
                                            </button>
                                        </th>
                                        <th>จำนวนสินค้า</th>
                                        <th>
                                            <button type="button" className="category-sort-button" onClick={() => requestCategorySort('status_category')}>
                                                สถานะ <AdminIcon name="sort" />
                                            </button>
                                        </th>
                                        <th>
                                            <button type="button" className="category-sort-button" onClick={() => requestCategorySort('created_at')}>
                                                วันที่สร้าง <AdminIcon name="sort" />
                                            </button>
                                        </th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCategories.length > 0 ? (
                                        paginatedCategories.map((category) => {
                                            const isActive = Number(category.status_category ?? 1) === 1;
                                            const isEditing = editingCategoryId === category.category_id;
                                            const isBusy = categoryActionId === category.category_id;

                                            return (
                                                <tr key={category.category_id}>
                                                    <td>
                                                        {isEditing ? (
                                                            <input
                                                                className="form-control category-edit-input"
                                                                value={editingCategoryName}
                                                                onChange={(event) => setEditingCategoryName(event.target.value)}
                                                            />
                                                        ) : (
                                                            <div className="category-name-cell">
                                                                <span className="category-name-icon">{String(category.category_name || '?').charAt(0)}</span>
                                                                <strong>{category.category_name}</strong>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="category-product-count">{Number(category.product_count) || 0}</span>
                                                    </td>
                                                    <td>
                                                        <div className="category-toggle-wrap">
                                                            <button
                                                                type="button"
                                                                className={`category-toggle ${isActive ? 'active' : 'inactive'}`}
                                                                role="switch"
                                                                aria-checked={isActive}
                                                                aria-label={`${isActive ? 'ปิด' : 'เปิด'}ใช้งาน ${category.category_name}`}
                                                                disabled={isBusy}
                                                                onClick={() => toggleCategoryStatus(category)}
                                                            >
                                                                <span />
                                                            </button>
                                                            <span className={isActive ? 'category-status-text active' : 'category-status-text inactive'}>
                                                                {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="category-date">{formatCategoryDate(category.created_at)}</span>
                                                    </td>
                                                    <td>
                                                        <div className="admin-action-row category-actions">
                                                            {isEditing ? (
                                                                <>
                                                                    <button type="button" className="admin-action primary" onClick={() => saveCategory(category)}>
                                                                        <AdminIcon name="save" /> บันทึก
                                                                    </button>
                                                                    <button type="button" className="admin-action" onClick={() => setEditingCategoryId(null)}>
                                                                        <AdminIcon name="close" /> ยกเลิก
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button type="button" className="admin-action warning" onClick={() => startEditCategory(category)}>
                                                                        <AdminIcon name="edit" /> แก้ไข
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="admin-action danger"
                                                                        disabled={isBusy}
                                                                        onClick={() => setCategoryToDelete(category)}
                                                                    >
                                                                        <AdminIcon name="delete" /> ลบ
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5">
                                                <div className="admin-empty">ไม่พบหมวดหมู่ที่ตรงกับการค้นหา</div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="category-pagination">
                            <div className="category-page-size">
                                แสดง
                                <select value={categoryPageSize} onChange={(event) => setCategoryPageSize(Number(event.target.value))}>
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                </select>
                                รายการ
                            </div>
                            <span>
                                {filteredCategories.length > 0
                                    ? `${(categoryPage - 1) * categoryPageSize + 1}-${Math.min(categoryPage * categoryPageSize, filteredCategories.length)} จาก ${filteredCategories.length}`
                                    : '0 รายการ'}
                            </span>
                            <div className="category-page-buttons">
                                <button type="button" disabled={categoryPage === 1} onClick={() => setCategoryPage((page) => page - 1)}>ก่อนหน้า</button>
                                <strong>{categoryPage} / {categoryTotalPages}</strong>
                                <button type="button" disabled={categoryPage === categoryTotalPages} onClick={() => setCategoryPage((page) => page + 1)}>ถัดไป</button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {productToDelete && (
                <div className="modal d-block admin-modal-backdrop product-delete-modal" role="dialog" aria-modal="true">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="category-delete-content">
                                <div className="category-delete-icon"><AdminIcon name="delete" size={26} /></div>
                                <h4>ยืนยันการลบสินค้า</h4>
                                <p>
                                    คุณกำลังจะลบ <strong>“{productToDelete.name}”</strong> ออกจากคลังอย่างถาวร
                                    หากสินค้านี้มีประวัติคำสั่งซื้อ ระบบจะไม่อนุญาตให้ลบและควรปิดใช้งานแทน
                                </p>
                                <div className="product-delete-summary">
                                    <span>SKU: PRD-{String(productToDelete.id).padStart(6, '0')}</span>
                                    <span>คงเหลือ: {Number(productToDelete.stock) || 0} ชิ้น</span>
                                </div>
                                <div className="category-delete-actions">
                                    <button type="button" className="admin-action" onClick={() => setProductToDelete(null)}>
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="button"
                                        className="admin-action danger solid"
                                        disabled={productActionId === productToDelete.id}
                                        onClick={confirmDeleteProduct}
                                    >
                                        <AdminIcon name="delete" /> ยืนยันการลบ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {categoryToDelete && (
                <div className="modal d-block admin-modal-backdrop category-delete-modal" role="dialog" aria-modal="true">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg">
                            <div className="category-delete-content">
                                <div className="category-delete-icon"><AdminIcon name="delete" size={26} /></div>
                                <h4>ลบหมวดหมู่นี้หรือไม่?</h4>
                                <p>
                                    คุณกำลังจะลบ <strong>“{categoryToDelete.category_name}”</strong> ออกจากระบบ
                                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                                </p>
                                {Number(categoryToDelete.product_count) > 0 && (
                                    <div className="category-delete-warning">
                                        หมวดหมู่นี้มีสินค้า {Number(categoryToDelete.product_count)} รายการ จึงยังไม่สามารถลบได้
                                    </div>
                                )}
                                <div className="category-delete-actions">
                                    <button type="button" className="admin-action" onClick={() => setCategoryToDelete(null)}>
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="button"
                                        className="admin-action danger solid"
                                        disabled={Number(categoryToDelete.product_count) > 0 || categoryActionId === categoryToDelete.category_id}
                                        onClick={confirmDeleteCategory}
                                    >
                                        <AdminIcon name="delete" /> ยืนยันการลบ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editProduct.id && (
                <div className="modal d-block admin-modal-backdrop">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 rounded-4 p-3 shadow-lg">
                            <div className="modal-header border-0">
                                <h5 className="fw-bold">แก้ไขสินค้า</h5>
                                <button className="btn-close" onClick={() => setEditProduct({ id: null, name: '', price: 0, description: '' })}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row g-3">
                                    <div className="col-md-8">
                                        <label className="small fw-bold">ชื่อสินค้า</label>
                                        <input className="form-control" value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="small fw-bold">ราคา (฿)</label>
                                        <input type="number" className="form-control" value={editProduct.price} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="small fw-bold">หมวดหมู่สินค้า</label>
                                        <select
                                            className="form-control"
                                            value={selectedEditCategoryId}
                                            onChange={(e) => setEditProduct({ ...editProduct, ...getCategorySelection(e.target.value) })}
                                            required
                                            disabled={productCategoryOptions.length === 0}
                                        >
                                            <option value="">เลือกหมวดหมู่สินค้า</option>
                                            {productCategoryOptions.map((category) => (
                                                <option key={category.category_id} value={category.category_id}>
                                                    {category.category_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="small fw-bold">รูปภาพสินค้า</label>
                                        <div className="product-upload">
                                            <div className="product-upload-preview">
                                                {editProduct.image_preview ? (
                                                    <img src={editProduct.image_preview} alt="ตัวอย่างรูปสินค้า" />
                                                ) : (
                                                    <div className="product-upload-empty">
                                                        <span>เลือกรูปภาพสินค้า</span>
                                                        <small>รองรับ PNG, JPG, WEBP หรือ GIF</small>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="product-upload-control">
                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                    onChange={handleEditImageChange}
                                                />
                                                {editProduct.image_name && <div className="small text-muted mt-2">{editProduct.image_name}</div>}
                                                {editProduct.image_preview && (
                                                    <button type="button" className="btn btn-outline-danger btn-sm mt-3" onClick={removeEditImage}>
                                                        ลบรูป
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <label className="small fw-bold">รายละเอียดสินค้า</label>
                                        <textarea className="form-control" rows="3" value={editProduct.description} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0">
                                <button className="btn btn-primary w-100 fw-bold py-2 rounded-pill" onClick={onSaveEditProduct}>บันทึกสินค้า</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AdminAddProductPage;

