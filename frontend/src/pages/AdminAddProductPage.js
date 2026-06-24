import { useId, useState } from 'react';

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const thaiColorOptions = [
    { name: 'ดำ', hex: '#000000', aliases: ['สีดำ'] },
    { name: 'ขาว', hex: '#ffffff', aliases: ['สีขาว'] },
    { name: 'เทา', hex: '#808080', aliases: ['สีเทา'] },
    { name: 'เทาอ่อน', hex: '#d3d3d3', aliases: [] },
    { name: 'เทาเข้ม', hex: '#4a4a4a', aliases: [] },
    { name: 'แดง', hex: '#ff0000', aliases: ['สีแดง'] },
    { name: 'แดงเข้ม', hex: '#8b0000', aliases: ['เลือดหมู'] },
    { name: 'ชมพู', hex: '#ff69b4', aliases: ['สีชมพู'] },
    { name: 'ชมพูอ่อน', hex: '#ffb6c1', aliases: [] },
    { name: 'ส้ม', hex: '#ff8c00', aliases: ['สีส้ม'] },
    { name: 'เหลือง', hex: '#ffd700', aliases: ['สีเหลือง'] },
    { name: 'ครีม', hex: '#fffdd0', aliases: ['สีครีม'] },
    { name: 'เบจ', hex: '#f5f5dc', aliases: ['สีเบจ'] },
    { name: 'น้ำตาล', hex: '#8b4513', aliases: ['สีน้ำตาล'] },
    { name: 'น้ำตาลอ่อน', hex: '#c4a484', aliases: [] },
    { name: 'เขียว', hex: '#008000', aliases: ['สีเขียว'] },
    { name: 'เขียวอ่อน', hex: '#90ee90', aliases: [] },
    { name: 'เขียวเข้ม', hex: '#006400', aliases: [] },
    { name: 'เขียวมิ้นท์', hex: '#98ff98', aliases: ['มิ้นท์', 'มินต์'] },
    { name: 'ฟ้า', hex: '#00bfff', aliases: ['สีฟ้า'] },
    { name: 'ฟ้าอ่อน', hex: '#87ceeb', aliases: [] },
    { name: 'น้ำเงิน', hex: '#0000ff', aliases: ['สีน้ำเงิน'] },
    { name: 'กรมท่า', hex: '#000080', aliases: ['น้ำเงินเข้ม', 'สีกรม'] },
    { name: 'ม่วง', hex: '#800080', aliases: ['สีม่วง'] },
    { name: 'ม่วงอ่อน', hex: '#dda0dd', aliases: ['ลาเวนเดอร์'] },
    { name: 'ทอง', hex: '#d4af37', aliases: ['สีทอง'] },
    { name: 'เงิน', hex: '#c0c0c0', aliases: ['สีเงิน'] },
];

const normalizeColorSearch = (value) => String(value || '').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, '');

const findThaiColor = (value) => {
    const keyword = normalizeColorSearch(value);
    if (!keyword) return null;

    return thaiColorOptions.find((color) => (
        [color.name, ...color.aliases].some((name) => normalizeColorSearch(name) === keyword)
    )) || null;
};

function ProductColorEditor({ colors = [], onChange }) {
    const colorListId = useId();
    const [colorName, setColorName] = useState('');
    const [colorHex, setColorHex] = useState('#000000');
    const matchedColor = findThaiColor(colorName);

    const handleColorNameChange = (event) => {
        const nextName = event.target.value;
        const match = findThaiColor(nextName);
        setColorName(nextName);
        if (match) setColorHex(match.hex);
    };

    const addColor = () => {
        const name = colorName.trim();
        if (!name) {
            alert('กรุณากรอกชื่อสี');
            return;
        }
        if (colors.some((color) => color.name.trim().toLocaleLowerCase('th-TH') === name.toLocaleLowerCase('th-TH'))) {
            alert('มีสีชื่อนี้อยู่แล้ว');
            return;
        }

        onChange([...colors, { name, hex: colorHex }]);
        setColorName('');
    };

    return (
        <div className="product-color-editor">
            <label className="small fw-bold">สีสินค้า</label>
            <div className="product-color-add-row">
                <input
                    type="color"
                    className="form-control form-control-color"
                    value={colorHex}
                    onChange={(event) => setColorHex(event.target.value)}
                    aria-label="เลือกสี"
                />
                <input
                    type="text"
                    className="form-control"
                    list={colorListId}
                    placeholder="ค้นหาสีภาษาไทย เช่น กรมท่า, ครีม, ฟ้าอ่อน"
                    value={colorName}
                    onChange={handleColorNameChange}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            addColor();
                        }
                    }}
                />
                <datalist id={colorListId}>
                    {thaiColorOptions.map((color) => (
                        <option key={color.name} value={color.name}>{color.hex}</option>
                    ))}
                </datalist>
                <button type="button" className="btn btn-outline-primary" onClick={addColor}>เพิ่มสี</button>
            </div>
            {colorName.trim() && (
                <small className={matchedColor ? 'product-color-match' : 'text-muted'}>
                    {matchedColor
                        ? `พบสี “${matchedColor.name}” ระบบเลือกเฉดให้อัตโนมัติ`
                        : 'ไม่พบชื่อสีในรายการ สามารถกดช่องสีด้านซ้ายเพื่อเลือกเฉดเองได้'}
                </small>
            )}
            {colors.length > 0 ? (
                <div className="product-color-list">
                    {colors.map((color, index) => (
                        <div className="product-color-chip" key={`${color.name}-${index}`}>
                            <span className="product-color-swatch" style={{ backgroundColor: color.hex }} />
                            <span>{color.name}</span>
                            <button
                                type="button"
                                onClick={() => onChange(colors.filter((_, colorIndex) => colorIndex !== index))}
                                aria-label={`ลบสี ${color.name}`}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <small className="text-muted">ยังไม่มีสี พิมพ์ชื่อสีภาษาไทย แล้วกด “เพิ่มสี” ได้เลย</small>
            )}
        </div>
    );
}

function AdminAddProductPage({
    newProduct,
    setNewProduct,
    onSubmit,
    products = [],
    editProduct,
    setEditProduct,
    onSaveEditProduct,
    onDeleteProduct,
    onOpenStockEdit,
    categories = [],
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
}) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [productAdminView, setProductAdminView] = useState('products');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active');
    const [categoryStatusFilter, setCategoryStatusFilter] = useState('active');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const activeCategories = categories.filter((category) => Number(category.status_category ?? 1) === 1);
    const visibleCategories = categories.filter((category) => {
        const isActive = Number(category.status_category ?? 1) === 1;
        return categoryStatusFilter === 'all'
            || (categoryStatusFilter === 'active' ? isActive : !isActive);
    });
    const productCategoryOptions = [...activeCategories].sort((a, b) => a.category_name.localeCompare(b.category_name, 'th'));
    const categoryFilterOptions = Array.from(new Set(
        [
            ...productCategoryOptions.map((category) => category.category_name),
            ...products.map((product) => product.category_name || 'ทั่วไป'),
        ].filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'th'));
    const visibleProducts = products.filter((product) => {
        const matchesCategory = categoryFilter === 'all'
            || (product.category_name || 'ทั่วไป') === categoryFilter;
        const isActive = Number(product.product_status ?? 1) === 1;
        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'active' ? isActive : !isActive);
        return matchesCategory && matchesStatus;
    });
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
            alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
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
            alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
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
        const result = nextStatus === 0
            ? await onDeleteCategory?.(category.category_id)
            : await onUpdateCategory?.(category.category_id, {
                category_name: category.category_name,
                status_category: 1,
            });

        if (!result?.success && result?.message) {
            setCategoryError(result.message);
        }
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

                {productAdminView === 'products' && showAddForm && (
                    <form onSubmit={onSubmit} className="row g-4 mt-1">
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
                        <div className="col-md-6">
                            <div className="form-check form-switch fw-bold">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="product-has-size"
                                    checked={Number(newProduct.has_size) === 1}
                                    onChange={(e) => setNewProduct({ ...newProduct, has_size: e.target.checked ? 1 : 0 })}
                                />
                                <label className="form-check-label" htmlFor="product-has-size">สินค้านี้มีไซซ์</label>
                            </div>
                            <small className="text-muted">ปิดถ้าสินค้านี้ไม่ต้องเลือก S/M/L</small>
                        </div>
                        <div className="col-md-6">
                            <div className="form-check form-switch fw-bold">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="product-has-color"
                                    checked={Number(newProduct.has_color) === 1}
                                    onChange={(e) => setNewProduct({ ...newProduct, has_color: e.target.checked ? 1 : 0 })}
                                />
                                <label className="form-check-label" htmlFor="product-has-color">สินค้านี้มีสี</label>
                            </div>
                            <small className="text-muted">เปิดถ้าต้องให้ลูกค้าเลือกสี</small>
                        </div>
                        {Number(newProduct.has_color) === 1 && (
                            <div className="col-md-12">
                                <ProductColorEditor
                                    colors={newProduct.colors || []}
                                    onChange={(colors) => setNewProduct({ ...newProduct, colors })}
                                />
                            </div>
                        )}
                        <div className="col-md-12">
                            <label className="small fw-bold text-primary">หมายเหตุสต็อกเริ่มต้น</label>
                            <input type="text" className="form-control border-primary" value={newProduct.stock_remark} onChange={(e) => setNewProduct({ ...newProduct, stock_remark: e.target.value })} />
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
            <section className="admin-panel">
                <div className="admin-panel-header">
                    <div>
                        <h2>จัดการคลังสินค้า</h2>
                        <p>ปรับสต็อก แก้ไขรายละเอียด และเปิดหรือปิดใช้งานสินค้า</p>
                    </div>
                    <div className="admin-panel-tools inventory-panel-tools">
                        <div className="admin-panel-filter-row">
                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                            >
                                <option value="all">ทุกหมวดหมู่สินค้า</option>
                                {categoryFilterOptions.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                aria-label="กรองตามสถานะสินค้า"
                            >
                                <option value="active">เปิดใช้งาน</option>
                                <option value="inactive">ปิดใช้งาน</option>
                                <option value="all">ทุกสถานะ</option>
                            </select>
                            <span>{visibleProducts.length} สินค้า</span>
                        </div>
                        <button type="button" className="btn btn-primary rounded-pill fw-bold px-4 inventory-add-button" onClick={() => setShowAddForm((current) => !current)}>
                            {showAddForm ? 'ซ่อนฟอร์ม' : 'เพิ่มสินค้า'}
                        </button>
                    </div>
                </div>

                <div className="admin-table-wrap">
                    <table className="admin-table inventory-table">
                        <thead>
                            <tr>
                                <th>สินค้า</th>
                                <th>คลัง</th>
                                <th>ราคา</th>
                                <th>สถานะ</th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleProducts.length > 0 ? (
                                visibleProducts.map((product) => {
                                    const stock = Number(product.stock) || 0;
                                    const lowStock = stock < 5;
                                    const isCancelled = Number(product.product_status) === 0;

                                    return (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="admin-product-cell">
                                                    <div className="admin-product-thumb">
                                                        {product.image_url ? <img src={product.image_url} alt={product.name} /> : <span>{product.name?.charAt(0) || 'P'}</span>}
                                                    </div>
                                                    <div>
                                                        <strong>{product.name}</strong>
                                                        <small>{product.category_name || 'ทั่วไป'}</small>
                                                        <small>{product.description || 'ไม่มีรายละเอียดสินค้า'}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <strong>{stock}</strong> ชิ้น
                                            </td>
                                            <td className="admin-money">฿{formatMoney(product.price)}</td>
                                            <td>
                                                <span className={`admin-status ${isCancelled ? 'locked' : lowStock ? 'low' : 'paid'}`}>
                                                    {isCancelled ? 'ปิดใช้งาน' : lowStock ? 'ใกล้หมด' : 'เปิดใช้งาน'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="admin-action-row left">
                                                    <button className="admin-action primary" onClick={() => onOpenStockEdit(product)} disabled={isCancelled}>ปรับสต็อก</button>
                                                    <button
                                                        className="admin-action warning"
                                                        onClick={() => setEditProduct({
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
                                                            has_size: Number(product.has_size ?? 1),
                                                            has_color: Number(product.has_color ?? 0),
                                                            colors: Array.isArray(product.colors) ? product.colors : [],
                                                        })}
                                                    >
                                                        แก้ไข
                                                    </button>
                                                    <button
                                                        className={`admin-action ${isCancelled ? 'success' : 'danger'}`}
                                                        onClick={() => onDeleteProduct(product)}
                                                    >
                                                        {isCancelled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        <div className="admin-empty">ไม่พบสินค้าตามตัวกรองที่เลือก</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            )}

            {productAdminView === 'categories' && (
                <section className="admin-panel">
                    <div className="admin-panel-header">
                        <div>
                            <h2>จัดการหมวดหมู่สินค้า</h2>
                            <p>เพิ่ม แก้ไข หรือปิดใช้งานหมวดหมู่สินค้า</p>
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
                                    เพิ่มหมวดหมู่
                                </button>
                            </div>
                            <div className="category-filter-row">
                                <select
                                    value={categoryStatusFilter}
                                    onChange={(event) => setCategoryStatusFilter(event.target.value)}
                                    aria-label="กรองสถานะหมวดหมู่สินค้า"
                                >
                                    <option value="active">เปิดใช้งาน</option>
                                    <option value="inactive">ปิดใช้งาน</option>
                                    <option value="all">ทุกสถานะ</option>
                                </select>
                                <span className="category-count-badge">{visibleCategories.length} หมวดหมู่</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                                {categoryError && (
                                    <div className="alert alert-danger py-2 small fw-bold">
                                        {categoryError}
                                    </div>
                                )}

                                <div className="admin-table-wrap">
                                    <table className="admin-table category-table">
                                        <colgroup>
                                            <col className="category-name-col" />
                                            <col className="category-status-col" />
                                            <col className="category-actions-col" />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>หมวดหมู่สินค้า</th>
                                                <th>สถานะ</th>
                                                <th>จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleCategories.length > 0 ? (
                                                visibleCategories.map((category) => {
                                                    const isActive = Number(category.status_category ?? 1) === 1;
                                                    const isEditing = editingCategoryId === category.category_id;

                                                    return (
                                                        <tr key={category.category_id}>
                                                            <td>
                                                                {isEditing ? (
                                                                    <input
                                                                        className="form-control"
                                                                        value={editingCategoryName}
                                                                        onChange={(event) => setEditingCategoryName(event.target.value)}
                                                                    />
                                                                ) : (
                                                                    <strong>{category.category_name}</strong>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`admin-status ${isActive ? 'paid' : 'locked'}`}>
                                                                    {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="admin-action-row">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <button type="button" className="admin-action primary" onClick={() => saveCategory(category)}>
                                                                                บันทึก
                                                                            </button>
                                                                            <button type="button" className="admin-action" onClick={() => setEditingCategoryId(null)}>
                                                                                ยกเลิก
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button type="button" className="admin-action warning" onClick={() => startEditCategory(category)}>
                                                                                แก้ไข
                                                                            </button>
                                                                            <button type="button" className={isActive ? 'admin-action danger' : 'admin-action primary'} onClick={() => toggleCategoryStatus(category)}>
                                                                                {isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
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
                                                    <td colSpan="3">
                                                        <div className="admin-empty">ไม่พบหมวดหมู่ตามสถานะที่เลือก</div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                    </div>
                </section>
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
                                    <div className="col-md-3">
                                        <div className="form-check form-switch fw-bold pt-4">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="edit-product-has-size"
                                                checked={Number(editProduct.has_size ?? 1) === 1}
                                                onChange={(e) => setEditProduct({ ...editProduct, has_size: e.target.checked ? 1 : 0 })}
                                            />
                                            <label className="form-check-label" htmlFor="edit-product-has-size">มีไซซ์</label>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="form-check form-switch fw-bold pt-4">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                role="switch"
                                                id="edit-product-has-color"
                                                checked={Number(editProduct.has_color ?? 0) === 1}
                                                onChange={(e) => setEditProduct({ ...editProduct, has_color: e.target.checked ? 1 : 0 })}
                                            />
                                            <label className="form-check-label" htmlFor="edit-product-has-color">มีสี</label>
                                        </div>
                                    </div>
                                    {Number(editProduct.has_color ?? 0) === 1 && (
                                        <div className="col-12">
                                            <ProductColorEditor
                                                colors={editProduct.colors || []}
                                                onChange={(colors) => setEditProduct({ ...editProduct, colors })}
                                            />
                                        </div>
                                    )}
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
