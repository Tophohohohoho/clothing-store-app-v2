import { useEffect } from 'react';
import { getCartCount, getCartItemKey, getCartTotal, getItemPrice, getItemQuantity } from '../utils/cart';
import { confirmNotification, notify } from './AppNotification';

const formatCurrency = (value) => Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function CartModal({
    cart,
    setCart,
    selectedCartKeys,
    onToggleItemSelection,
    onSelectAllItems,
    onClearSelection,
    onClose,
    onCheckout,
    checkoutLabel = 'ชำระเงินทันที',
}) {
    const itemCount = getCartCount(cart);
    const selectedKeySet = new Set(selectedCartKeys);
    const selectedCart = cart.filter((item) => selectedKeySet.has(getCartItemKey(item)));
    const selectedItemCount = getCartCount(selectedCart);
    const selectedCartTotal = getCartTotal(selectedCart);
    const isAllSelected = cart.length > 0 && selectedCart.length === cart.length;

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const isSameCartItem = (cartItem, item) => (
        cartItem.id === item.id
    );

    const decreaseQty = async (item) => {
        const quantity = getItemQuantity(item);
        if (quantity <= 1) {
            const shouldRemove = await confirmNotification({
                type: 'danger',
                title: 'ลบสินค้าออกจากตะกร้า?',
                message: `ต้องการลบ ${item.name} ออกจากตะกร้าหรือไม่`,
                confirmText: 'ลบสินค้า',
                cancelText: 'ยกเลิก',
            });
            if (shouldRemove) {
                setCart((currentCart) => currentCart.filter((cartItem) => !isSameCartItem(cartItem, item)));
            }
            return;
        }

        setCart((currentCart) => currentCart.map((cartItem) => (
            isSameCartItem(cartItem, item) ? { ...cartItem, qty: getItemQuantity(cartItem) - 1 } : cartItem
        )));
    };

    const increaseQty = (item) => {
        const stock = Number(item.stock);
        const quantity = getItemQuantity(item);
        if (Number.isFinite(stock) && stock >= 0 && quantity >= stock) {
            notify({ type: 'warning', title: 'สินค้าไม่พอ', message: `สินค้าในคลังมีเพียง ${stock} ชิ้น` });
            return;
        }

        setCart((currentCart) => currentCart.map((cartItem) => (
            isSameCartItem(cartItem, item) ? { ...cartItem, qty: getItemQuantity(cartItem) + 1 } : cartItem
        )));
    };

    const removeItem = async (item) => {
        const shouldRemove = await confirmNotification({
            type: 'danger',
            title: 'ลบสินค้าออกจากตะกร้า?',
            message: `ต้องการลบ ${item.name} ออกจากตะกร้าหรือไม่`,
            confirmText: 'ลบสินค้า',
            cancelText: 'ยกเลิก',
        });
        if (shouldRemove) {
            setCart((currentCart) => currentCart.filter((cartItem) => !isSameCartItem(cartItem, item)));
        }
    };

    return (
        <div className="cart-modal-backdrop" onMouseDown={onClose}>
            <section
                className={`cart-modal-dialog ${cart.length === 0 ? 'is-empty' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-modal-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="cart-modal-header">
                    <div>
                        <span className="cart-modal-eyebrow">YOUR CART</span>
                        <h2 id="cart-modal-title">ตะกร้าสินค้า</h2>
                        {itemCount > 0 && <p>สินค้าทั้งหมด {itemCount} ชิ้น</p>}
                    </div>
                    <button type="button" className="cart-modal-close" onClick={onClose} aria-label="ปิดตะกร้าสินค้า">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </header>

                {cart.length === 0 ? (
                    <div className="cart-empty-state">
                        <div className="cart-empty-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                                <path d="M3.5 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H7" />
                                <circle cx="10" cy="19" r="1.2" />
                                <circle cx="18" cy="19" r="1.2" />
                            </svg>
                        </div>
                        <h3>ตะกร้าของคุณยังว่างอยู่</h3>
                        <p>เลือกสินค้าที่ชอบ แล้วกลับมาดำเนินการสั่งซื้อได้ทันที</p>
                        <button type="button" className="cart-continue-button" onClick={onClose}>เลือกซื้อสินค้า</button>
                    </div>
                ) : (
                    <>
                        <div className="cart-selection-bar">
                            <label className="cart-select-all">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={(event) => (event.target.checked ? onSelectAllItems() : onClearSelection())}
                                />
                                <span>เลือกทั้งหมด</span>
                            </label>
                            <span>เลือกชำระ {selectedItemCount} จาก {itemCount} ชิ้น</span>
                        </div>

                        <div className="cart-items" aria-live="polite">
                            {cart.map((item, index) => {
                                const price = getItemPrice(item);
                                const quantity = getItemQuantity(item);
                                const lineTotal = price * quantity;
                                const itemKey = getCartItemKey(item);
                                const isSelected = selectedKeySet.has(itemKey);
                                const stock = Number(item.stock);
                                const isAtStockLimit = Number.isFinite(stock) && stock >= 0 && quantity >= stock;

                                return (
                                    <article
                                        className={`cart-item ${isSelected ? 'is-selected' : ''}`}
                                        key={itemKey}
                                        style={{ '--cart-item-delay': `${Math.min(index * 45, 180)}ms` }}
                                    >
                                        <label className="cart-item-select" aria-label={`เลือก ${item.name} เพื่อชำระเงิน`}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggleItemSelection(itemKey)}
                                            />
                                            <span aria-hidden="true" />
                                        </label>

                                        <div className="cart-item-image">
                                            <span aria-hidden="true">{item.name?.charAt(0) || 'C'}</span>
                                            {item.image_url && (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.name || 'สินค้า'}
                                                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                        </div>

                                        <div className="cart-item-content">
                                            <div className="cart-item-heading">
                                                <div>
                                                    <h3>{item.name}</h3>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="cart-remove-button"
                                                    onClick={() => removeItem(item)}
                                                    aria-label={`ลบ ${item.name} ออกจากตะกร้า`}
                                                >
                                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                                                    </svg>
                                                    <span>ลบ</span>
                                                </button>
                                            </div>

                                            <div className="cart-item-footer">
                                                <div className="cart-price-breakdown">
                                                    <span>฿{formatCurrency(price)} × {quantity}</span>
                                                    <strong>= ฿{formatCurrency(lineTotal)}</strong>
                                                </div>
                                                <div className="cart-quantity-control" aria-label={`จำนวน ${item.name}`}>
                                                    <button type="button" onClick={() => decreaseQty(item)} aria-label="ลดจำนวนสินค้า">−</button>
                                                    <span key={quantity} className="cart-quantity-value">{quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => increaseQty(item)}
                                                        disabled={isAtStockLimit}
                                                        aria-label="เพิ่มจำนวนสินค้า"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <footer className="cart-modal-footer">
                            <div className="cart-summary">
                                <div>
                                    <span>จำนวนสินค้าที่เลือก</span>
                                    <strong>{selectedItemCount} ชิ้น</strong>
                                </div>
                                <div className="cart-summary-total">
                                    <span>ยอดรวมที่ต้องชำระ</span>
                                    <strong>฿{formatCurrency(selectedCartTotal)}</strong>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="cart-checkout-button"
                                onClick={onCheckout}
                                disabled={selectedItemCount === 0}
                            >
                                <span>{checkoutLabel}</span>
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                            </button>
                            <p className="cart-checkout-note">เลือกสินค้าที่ต้องการ แล้วตรวจสอบจำนวนให้เรียบร้อยก่อนชำระเงิน</p>
                        </footer>
                    </>
                )}
            </section>
        </div>
    );
}

export default CartModal;
