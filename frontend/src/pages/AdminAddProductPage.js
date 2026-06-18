import { useState } from 'react';

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

function AdminAddProductPage({
    newProduct,
    setNewProduct,
    onSubmit,
    products,
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
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const activeCategories = categories.filter((category) => Number(category.status_category ?? 1) === 1);
    const categoryOptions = Array.from(new Set(
        [
            ...activeCategories.map((category) => category.category_name),
            ...products.map((product) => product.category_name || 'ทั่วไป'),
        ].filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'th'));
    const visibleProducts = categoryFilter === 'all'
        ? products
        : products.filter((product) => (product.category_name || 'ทั่วไป') === categoryFilter);

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

        setCategoryError(result?.message || 'เพิ่มประเภทสินค้าไม่สำเร็จ');
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

        setCategoryError(result?.message || 'บันทึกประเภทสินค้าไม่สำเร็จ');
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
            <datalist id="product-category-options">
                {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                ))}
            </datalist>

            <div className="card border-0 shadow-sm rounded-4 p-5 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h3 className="fw-bold mb-1">{productAdminView === 'products' ? 'จัดการสินค้า' : 'จัดการประเภทสินค้า'}</h3>
                        <p className="text-muted mb-0">
                            {productAdminView === 'products'
                                ? 'เพิ่มสินค้า ปรับข้อมูล และดูรายการสินค้าในคลัง'
                                : 'เพิ่ม แก้ไข เปิดหรือปิดใช้งานประเภทสินค้า'}
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
                            จัดการประเภท
                        </button>
                    </div>
                </div>

                {productAdminView === 'products' && (
                    <div className="text-end mt-4">
                        <button type="button" className="btn btn-primary rounded-pill fw-bold px-4" onClick={() => setShowAddForm((current) => !current)}>
                            {showAddForm ? 'ซ่อนฟอร์ม' : 'เพิ่มสินค้า'}
                        </button>
                    </div>
                )}

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
                            <input
                                type="text"
                                className="form-control"
                                list="product-category-options"
                                value={newProduct.category_name}
                                onChange={(e) => setNewProduct({ ...newProduct, category_name: e.target.value })}
                                placeholder="เช่น เสื้อ, กางเกง, เครื่องประดับ"
                                required
                            />
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
                        <p>ปรับสต็อก แก้ไขรายละเอียด และยกเลิกสินค้า</p>
                    </div>
                    <div className="admin-panel-tools">
                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                        >
                            <option value="all">ทุกประเภทสินค้า</option>
                            {categoryOptions.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                        <span>{visibleProducts.length} สินค้า</span>
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
                                                    {isCancelled ? 'ล็อกสินค้า' : lowStock ? 'ใกล้หมด' : 'พร้อมขาย'}
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
                                                            category_name: product.category_name || 'ทั่วไป',
                                                            description: product.description || '',
                                                            image_url: product.image_url || '',
                                                            image_data: '',
                                                            image_preview: product.image_url || '',
                                                            image_name: '',
                                                            has_size: Number(product.has_size ?? 1),
                                                            has_color: Number(product.has_color ?? 0),
                                                        })}
                                                    >
                                                        แก้ไข
                                                    </button>
                                                    <button className="admin-action danger" onClick={() => onDeleteProduct(product)} disabled={isCancelled}>
                                                        {isCancelled ? 'ยกเลิกแล้ว' : 'ยกเลิก'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5">
                                        <div className="admin-empty">ไม่พบสินค้าในประเภทนี้</div>
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
                            <h2>จัดการประเภทสินค้า</h2>
                            <p>เพิ่ม แก้ไข หรือปิดใช้งานประเภทสินค้า</p>
                        </div>
                        <span>{categories.length} ประเภท</span>
                    </div>
                    <div className="p-4">
                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    <input
                                        className="form-control"
                                        style={{ minWidth: '220px', flex: '1 1 220px' }}
                                        value={newCategoryName}
                                        onChange={(event) => {
                                            setCategoryError('');
                                            setNewCategoryName(event.target.value);
                                        }}
                                        placeholder="ชื่อประเภทสินค้าใหม่"
                                    />
                                    <button type="button" className="admin-action success" onClick={submitNewCategory}>
                                        เพิ่มประเภท
                                    </button>
                                </div>

                                {categoryError && (
                                    <div className="alert alert-danger py-2 small fw-bold">
                                        {categoryError}
                                    </div>
                                )}

                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>ประเภทสินค้า</th>
                                                <th>สถานะ</th>
                                                <th className="text-center">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categories.length > 0 ? (
                                                categories.map((category) => {
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
                                                        <div className="admin-empty">ยังไม่มีประเภทสินค้า</div>
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
                                        <input
                                            className="form-control"
                                            list="product-category-options"
                                            value={editProduct.category_name || ''}
                                            onChange={(e) => setEditProduct({ ...editProduct, category_name: e.target.value })}
                                            placeholder="เช่น เสื้อ, กางเกง, เครื่องประดับ"
                                        />
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
