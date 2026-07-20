import { useCallback, useEffect, useMemo, useState } from 'react';

const formatPrice = (price) => {
    const value = Number(price) || 0;
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

function StorePage({
    products,
    onAddToCart,
    onBuyNow,
    previewProductId,
    onPreviewShown,
    showStockCounts = false,
    searchText: externalSearchText,
    onSearchTextChange,
    onOpenAddMember,
}) {
    const [internalSearchText, setInternalSearchText] = useState('');
    const searchText = externalSearchText ?? internalSearchText;
    const setSearchText = onSearchTextChange || setInternalSearchText;
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const totalStock = showStockCounts ? products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0) : 0;
    const activeProducts = useMemo(
        () => products.filter((product) => Number(product.product_status ?? 1) === 1),
        [products],
    );
    const categoryOptions = useMemo(() => Array.from(new Set(
        activeProducts.map((product) => String(product.category_name || 'ทั่วไป').trim() || 'ทั่วไป'),
    )).sort((a, b) => a.localeCompare(b, 'th')), [activeProducts]);
    const visibleProducts = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return activeProducts.filter((product) => {
            const productCategory = String(product.category_name || 'ทั่วไป').trim() || 'ทั่วไป';
            const matchesCategory = selectedCategory === 'all' || productCategory === selectedCategory;
            const matchesKeyword = !keyword
                || product.name?.toLowerCase().includes(keyword)
                || product.description?.toLowerCase().includes(keyword)
                || productCategory.toLowerCase().includes(keyword);

            return matchesCategory && matchesKeyword;
        });
    }, [activeProducts, searchText, selectedCategory]);

    const handleImageError = (event) => {
        event.currentTarget.style.display = 'none';
        event.currentTarget.parentElement.classList.add('is-empty');
    };

    const openProductDetail = useCallback((product) => {
        setSelectedProduct(product);
        setSelectedQuantity(1);
    }, []);

    useEffect(() => {
        if (!previewProductId) return;

        const product = products.find((item) => String(item.id) === String(previewProductId));
        if (!product) return;

        openProductDetail(product);
        onPreviewShown?.();
    }, [previewProductId, products, onPreviewShown, openProductDetail]);

    const handleAddFromModal = (product) => {
        onAddToCart({
            ...product,
            selected_quantity: selectedQuantity,
        });
        setSelectedProduct(null);
    };

    const handleBuyNow = (product) => {
        const didStartCheckout = onBuyNow?.({
            ...product,
            selected_quantity: selectedQuantity,
        });

        if (didStartCheckout) {
            setSelectedProduct(null);
        }
    };

    return (
        <section className="store-page">
            <div className="store-hero">
                <div>
                    <span className="store-eyebrow">Clothing Collection</span>
                    <h1>หน้าร้านสินค้า</h1>
                    <p>เลือกสินค้าเข้าตะกร้าได้ทันที พร้อมดูรายละเอียดสินค้า ราคา และจำนวนที่ต้องการ</p>
                    <div className="store-hero-benefits" aria-label="จุดเด่นของร้านค้า">
                        <span><b aria-hidden="true">✓</b> สินค้าคัดสรรคุณภาพ</span>
                        <span><b aria-hidden="true">✓</b> สั่งซื้อง่ายและปลอดภัย</span>
                        <span><b aria-hidden="true">✓</b> ติดตามสถานะได้ทุกขั้นตอน</span>
                    </div>
                    {showStockCounts && onOpenAddMember && (
                        <button type="button" className="store-admin-member-button" onClick={onOpenAddMember}>
                            เพิ่มสมาชิก
                        </button>
                    )}
                </div>
                {showStockCounts && (
                    <div className="store-stats">
                        <div>
                            <strong>{products.length}</strong>
                            <span>รายการสินค้า</span>
                        </div>
                        <div>
                            <strong>{totalStock}</strong>
                            <span>ชิ้นในคลัง</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="store-toolbar">
                <div>
                    <h2>สินค้าแนะนำ</h2>
                    {showStockCounts && <span>{visibleProducts.length} รายการที่พบ</span>}
                </div>
                <div className="store-search">
                    <label className="store-filter-field">
                        <span>ประเภทสินค้า</span>
                        <select
                            value={selectedCategory}
                            onChange={(event) => setSelectedCategory(event.target.value)}
                            aria-label="เลือกประเภทสินค้า"
                        >
                            <option value="all">สินค้าทุกประเภท</option>
                            {categoryOptions.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </label>
                    <div className="store-search-field">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="m16 16 4 4" />
                        </svg>
                        <input
                            type="search"
                            value={searchText}
                            onChange={(event) => setSearchText(event.target.value)}
                            placeholder="ค้นหาชื่อสินค้า / รายละเอียด"
                            aria-label="ค้นหาสินค้า"
                        />
                    </div>
                    {(searchText || selectedCategory !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchText('');
                                setSelectedCategory('all');
                            }}
                        >
                            ล้าง
                        </button>
                    )}
                </div>
            </div>

            {products.length === 0 ? (
                <div className="store-empty">
                    <strong>ยังไม่มีสินค้าให้แสดง</strong>
                    <span>เพิ่มสินค้าใหม่จากโหมด Admin แล้วสินค้าจะมาแสดงที่หน้าร้านทันที</span>
                </div>
            ) : visibleProducts.length === 0 ? (
                <div className="store-empty">
                    <strong>ไม่พบสินค้าที่ค้นหา</strong>
                    <span>ลองเปลี่ยนประเภทสินค้า คำค้น หรือกดล้างเพื่อดูทั้งหมด</span>
                </div>
            ) : (
                <div className="store-grid">
                    {visibleProducts.map((product) => {
                        const stock = Number(product.stock) || 0;
                        const isOutOfStock = stock <= 0;

                        return (
                            <article
                                className={`store-card product-card ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                                key={product.id}
                                onClick={() => openProductDetail(product)}
                                role="button"
                                tabIndex="0"
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        openProductDetail(product);
                                    }
                                }}
                            >
                                <div className="store-card-image">
                                    {product.image_url && (
                                        <img src={product.image_url} alt={product.name} onError={handleImageError} />
                                    )}
                                    <div className="store-image-fallback">
                                        <span>{product.name?.charAt(0) || 'C'}</span>
                                    </div>
                                    {(showStockCounts || isOutOfStock) && (
                                        <span className={`store-stock-badge ${isOutOfStock ? 'is-out' : ''}`}>
                                            {isOutOfStock ? 'สินค้าหมด' : `สต็อก ${stock} ชิ้น`}
                                        </span>
                                    )}
                                </div>

                                <div className="store-card-body">
                                    <div>
                                        <h3>{product.name}</h3>
                                        <p>{product.description || 'สินค้าแฟชั่นพร้อมจำหน่าย'}</p>
                                    </div>
                                    <div className="store-card-footer">
                                        <strong>฿{formatPrice(product.price)}</strong>
                                        <button
                                            type="button"
                                            className="store-add-button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                openProductDetail(product);
                                            }}
                                            disabled={isOutOfStock}
                                            aria-label={isOutOfStock ? `${product.name} สินค้าหมด` : `เพิ่ม ${product.name} ลงตะกร้า`}
                                        >
                                            <span aria-hidden="true">{isOutOfStock ? '×' : '+'}</span>
                                            {isOutOfStock ? 'สินค้าหมด' : 'เพิ่ม'}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {selectedProduct && (() => {
                const stock = Number(selectedProduct.stock) || 0;
                const isOutOfStock = stock <= 0;

                return (
                    <div className="product-detail-modal" onClick={() => setSelectedProduct(null)}>
                        <div className="product-detail-dialog" onClick={(event) => event.stopPropagation()}>
                            <button type="button" className="product-detail-close" onClick={() => setSelectedProduct(null)} aria-label="ปิดรายละเอียดสินค้า">
                                &times;
                            </button>
                            <div className="product-detail-image">
                                {selectedProduct.image_url ? (
                                    <img src={selectedProduct.image_url} alt={selectedProduct.name} onError={handleImageError} />
                                ) : (
                                    <span>{selectedProduct.name?.charAt(0) || 'C'}</span>
                                )}
                            </div>
                            <div className="product-detail-content">
                                {(showStockCounts || isOutOfStock) && (
                                    <span className={`store-stock-badge ${isOutOfStock ? 'is-out' : ''}`}>
                                        {isOutOfStock ? 'สินค้าหมด' : `สต็อก ${stock} ชิ้น`}
                                    </span>
                                )}
                                <h2>{selectedProduct.name}</h2>
                                <p>{selectedProduct.description || 'สินค้าแฟชั่นพร้อมจำหน่าย'}</p>
                                <div className="product-detail-meta">
                                    <div>
                                        <small>ราคา</small>
                                        <strong>฿{formatPrice(selectedProduct.price)}</strong>
                                    </div>
                                    {showStockCounts && (
                                        <div>
                                            <small>จำนวนในคลัง</small>
                                            <strong>{stock} ชิ้น</strong>
                                        </div>
                                    )}
                                </div>
                                {!isOutOfStock && (
                                    <div className="product-quantity-picker">
                                        <div>
                                            <small>จำนวนสินค้า</small>
                                            <span>{showStockCounts ? `เลือกได้สูงสุด ${stock} ชิ้น` : 'เลือกจำนวนที่ต้องการ'}</span>
                                        </div>
                                        <div className="product-quantity-control">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedQuantity((quantity) => Math.max(1, quantity - 1))}
                                                disabled={selectedQuantity <= 1}
                                                aria-label="ลดจำนวนสินค้า"
                                            >
                                                −
                                            </button>
                                            <strong>{selectedQuantity}</strong>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedQuantity((quantity) => Math.min(stock, quantity + 1))}
                                                disabled={selectedQuantity >= stock}
                                                aria-label="เพิ่มจำนวนสินค้า"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="product-detail-actions">
                                    <button
                                        type="button"
                                        className="store-add-button product-detail-add product-detail-secondary"
                                        onClick={() => handleAddFromModal(selectedProduct)}
                                        disabled={isOutOfStock}
                                    >
                                        <span>+</span>
                                        เพิ่มลงตะกร้า{!isOutOfStock && selectedQuantity > 1 ? ` ${selectedQuantity} ชิ้น` : ''}
                                    </button>
                                    <button
                                        type="button"
                                        className="store-add-button product-detail-add product-detail-primary"
                                        onClick={() => handleBuyNow(selectedProduct)}
                                        disabled={isOutOfStock}
                                    >
                                        <span aria-hidden="true">→</span>
                                        สั่งซื้อเลย{!isOutOfStock && selectedQuantity > 1 ? ` ${selectedQuantity} ชิ้น` : ''}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </section>
    );
}

export default StorePage;
