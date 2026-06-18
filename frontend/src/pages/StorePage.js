import { useCallback, useEffect, useMemo, useState } from 'react';

const formatPrice = (price) => {
    const value = Number(price) || 0;
    return value.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const productSizes = ['S', 'M', 'L', 'XL', '2XL'];
const productColors = ['ดำ', 'ขาว', 'เทา', 'แดง', 'น้ำเงิน', 'เขียว'];

function StorePage({ products, onAddToCart, previewProductId, onPreviewShown }) {
    const [searchText, setSearchText] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedSize, setSelectedSize] = useState('M');
    const [selectedColor, setSelectedColor] = useState('ดำ');
    const totalStock = products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0);
    const visibleProducts = useMemo(() => {
        const activeProducts = products.filter((product) => Number(product.product_status ?? 1) === 1);
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return activeProducts;

        return activeProducts.filter((product) => (
            product.name?.toLowerCase().includes(keyword)
            || product.description?.toLowerCase().includes(keyword)
        ));
    }, [products, searchText]);

    const handleImageError = (event) => {
        event.currentTarget.style.display = 'none';
        event.currentTarget.parentElement.classList.add('is-empty');
    };

    const openProductDetail = useCallback((product) => {
        setSelectedProduct(product);
        setSelectedSize('M');
        setSelectedColor('ดำ');
    }, []);

    useEffect(() => {
        if (!previewProductId) return;

        const product = products.find((item) => String(item.id) === String(previewProductId));
        if (!product) return;

        openProductDetail(product);
        onPreviewShown?.();
    }, [previewProductId, products, onPreviewShown, openProductDetail]);

    const handleAddFromModal = (product) => {
        const hasSize = Number(product.has_size ?? 1) === 1;
        const hasColor = Number(product.has_color ?? 0) === 1;
        onAddToCart({
            ...product,
            selected_size: hasSize ? selectedSize : '',
            selected_color: hasColor ? selectedColor : '',
        });
        setSelectedProduct(null);
    };

    return (
        <section className="store-page">
            <div className="store-hero">
                <div>
                    <span className="store-eyebrow">Clothing Collection</span>
                    <h1>หน้าร้านสินค้า</h1>
                    <p>เลือกสินค้าเข้าตะกร้าได้ทันที พร้อมดูราคาและจำนวนสินค้าในคลังแบบรวดเร็ว</p>
                </div>
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
            </div>

            <div className="store-toolbar">
                <div>
                    <h2>สินค้าแนะนำ</h2>
                    <span>{visibleProducts.length} รายการที่พบ</span>
                </div>
                <div className="store-search">
                    <input
                        type="search"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="ค้นหาชื่อสินค้า / รายละเอียด"
                        aria-label="ค้นหาสินค้า"
                    />
                    {searchText && (
                        <button type="button" onClick={() => setSearchText('')}>
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
                    <span>ลองค้นด้วยชื่อสินค้า คำอธิบาย หรือกดล้างคำค้นเพื่อดูทั้งหมด</span>
                </div>
            ) : (
                <div className="store-grid">
                    {visibleProducts.map((product) => {
                        const stock = Number(product.stock) || 0;
                        const isOutOfStock = stock <= 0;

                        return (
                            <article
                                className="store-card product-card"
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
                                    <span className={`store-stock-badge ${isOutOfStock ? 'is-out' : ''}`}>
                                        {isOutOfStock ? 'สินค้าหมด' : `คงเหลือ ${stock}`}
                                    </span>
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
                                            aria-label={`เพิ่ม ${product.name} ลงตะกร้า`}
                                        >
                                            <span>+</span>
                                            เพิ่ม
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
                const hasSize = Number(selectedProduct.has_size ?? 1) === 1;
                const hasColor = Number(selectedProduct.has_color ?? 0) === 1;

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
                                <span className={`store-stock-badge ${isOutOfStock ? 'is-out' : ''}`}>
                                    {isOutOfStock ? 'สินค้าหมด' : `คงเหลือ ${stock}`}
                                </span>
                                <h2>{selectedProduct.name}</h2>
                                <p>{selectedProduct.description || 'สินค้าแฟชั่นพร้อมจำหน่าย'}</p>
                                <div className="product-detail-meta">
                                    <div>
                                        <small>ราคา</small>
                                        <strong>฿{formatPrice(selectedProduct.price)}</strong>
                                    </div>
                                    <div>
                                        <small>จำนวนในคลัง</small>
                                        <strong>{stock} ชิ้น</strong>
                                    </div>
                                </div>
                                {(hasSize || hasColor) && (
                                    <div className="product-option-stack">
                                        {hasSize && (
                                            <div className="product-size-picker">
                                                <small>เลือกไซซ์สินค้า</small>
                                                <div>
                                                    {productSizes.map((size) => (
                                                        <button
                                                            key={size}
                                                            type="button"
                                                            className={selectedSize === size ? 'active' : ''}
                                                            onClick={() => setSelectedSize(size)}
                                                        >
                                                            {size}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {hasColor && (
                                            <div className="product-size-picker">
                                                <small>เลือกสีสินค้า</small>
                                                <div>
                                                    {productColors.map((color) => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            className={selectedColor === color ? 'active' : ''}
                                                            onClick={() => setSelectedColor(color)}
                                                        >
                                                            {color}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="store-add-button product-detail-add"
                                    onClick={() => handleAddFromModal(selectedProduct)}
                                    disabled={isOutOfStock}
                                >
                                    <span>+</span>
                                    เพิ่มลงตะกร้า
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </section>
    );
}

export default StorePage;
