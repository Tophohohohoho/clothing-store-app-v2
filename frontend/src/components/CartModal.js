import { getCartTotal, getItemPrice } from '../utils/cart';

function CartModal({ cart, setCart, onClose, onCheckout }) {
    const isSameCartItem = (cartItem, item) => (
        cartItem.id === item.id
        && (cartItem.selected_size || '') === (item.selected_size || '')
        && (cartItem.selected_color || '') === (item.selected_color || '')
    );

    const decreaseQty = (item) => {
        if (item.qty <= 1) {
            if (window.confirm(`ลบ ${item.name} ออกจากตะกร้า?`)) {
                setCart(cart.filter((cartItem) => !isSameCartItem(cartItem, item)));
            }
            return;
        }

        setCart(cart.map((cartItem) => (
            isSameCartItem(cartItem, item) ? { ...cartItem, qty: cartItem.qty - 1 } : cartItem
        )));
    };

    const increaseQty = (item) => {
        if (item.stock && item.qty >= item.stock) {
            alert(`สินค้าในคลังมีเพียง ${item.stock} ชิ้น`);
            return;
        }

        setCart(cart.map((cartItem) => (
            isSameCartItem(cartItem, item) ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem
        )));
    };

    const removeItem = (item) => {
        if (window.confirm(`ลบ ${item.name} ออกจากตะกร้า?`)) {
            setCart(cart.filter((cartItem) => !isSameCartItem(cartItem, item)));
        }
    };

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 rounded-4 shadow">
                    <div className="modal-header border-0 pb-0">
                        <h5 className="fw-bold m-0">ตะกร้าสินค้า</h5>
                        <button className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body overflow-auto" style={{ maxHeight: '400px' }}>
                        {cart.length === 0 ? (
                            <p className="text-center py-4 text-muted">ตะกร้าว่างเปล่า</p>
                        ) : (
                            cart.map((item) => {
                                const price = getItemPrice(item);

                                return (
                                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3" key={item.id}>
                                        <div style={{ flex: '1', minWidth: '0' }}>
                                            <h6 className="fw-bold mb-1 text-truncate text-dark" style={{ maxWidth: '180px' }}>
                                                {item.name}
                                            </h6>
                                            {item.selected_size && <small className="text-muted d-block">ไซซ์: {item.selected_size}</small>}
                                            {item.selected_color && <small className="text-muted d-block">สี: {item.selected_color}</small>}
                                            <span className="small text-success fw-semibold">฿{price.toLocaleString()}</span>
                                        </div>
                                        <div className="d-flex align-items-center bg-light rounded-pill p-1 mx-2">
                                            <button className="btn btn-sm btn-white rounded-circle shadow-sm fw-bold border-0" style={{ width: 28, height: 28 }} onClick={() => decreaseQty(item)}>-</button>
                                            <span className="fw-bold px-3 text-dark text-center" style={{ minWidth: 35 }}>{item.qty}</span>
                                            <button className="btn btn-sm btn-white rounded-circle shadow-sm fw-bold border-0" style={{ width: 28, height: 28 }} onClick={() => increaseQty(item)}>+</button>
                                        </div>
                                        <div className="text-end d-flex align-items-center gap-2" style={{ minWidth: 90 }}>
                                            <span className="fw-bold text-dark flex-grow-1">฿{(price * item.qty).toLocaleString()}</span>
                                            <button className="btn btn-sm text-danger p-1 border-0" title="ลบสินค้า" onClick={() => removeItem(item)}>ลบ</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div className="text-end fw-bold mt-4 fs-5 border-top pt-2">
                            ยอดรวม: <span className="text-primary">฿{getCartTotal(cart).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="modal-footer border-0 pt-0">
                        <button className="btn btn-success w-100 rounded-pill py-2 fw-bold shadow-sm" onClick={onCheckout}>
                            ชำระเงินทันที
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CartModal;
