import { useState } from 'react';

function OrderHistoryModal({
    orders,
    username,
    mode = 'customer',
    title = 'ประวัติการสั่งซื้อของคุณ',
    eyebrow = 'Order History',
    description = 'ตรวจสอบคำสั่งซื้อ สถานะชำระเงิน และแนบสลิปได้ในที่เดียว',
    activeTabLabel = 'คำสั่งซื้อ',
    historyTabLabel = 'ประวัติคำสั่งซื้อ',
    onClose,
    onUploadReceipt,
    onCancelOrder,
}) {
    const [uploadingOrderId, setUploadingOrderId] = useState(null);
    const [uploadError, setUploadError] = useState({ orderId: null, message: '' });
    const [activeView, setActiveView] = useState('active');
    const [activePaymentView, setActivePaymentView] = useState('pending');
    const cancelableStatuses = ['รอจัดการ', 'เตรียมสินค้า'];
    const historyStatuses = ['สำเร็จ', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น', 'ยกเลิก', 'ยกเลิกคำสั่งซื้อ'];
    const completedSaleStatuses = ['สำเร็จ', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น'];
    const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
    const reuploadPaymentStatuses = ['รอชำระ', 'หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม'];
    const orderList = Array.isArray(orders) ? orders : [];
    const isSalesMode = mode === 'sales';
    const isHistoryOrder = (order) => historyStatuses.includes(order.status);
    const isPendingPaymentOrder = (order) => reuploadPaymentStatuses.includes(order.payment_status) || order.status === 'รอจัดการ';
    const isStoreSale = (order) => (order.shipping_method || order.delivery_type) === 'ขายหน้าร้าน';
    const activeOrders = isSalesMode
        ? orderList.filter((order) => isStoreSale(order))
        : orderList.filter((order) => !isHistoryOrder(order));
    const pendingPaymentOrders = activeOrders.filter((order) => isPendingPaymentOrder(order));
    const reviewPaymentOrders = activeOrders.filter((order) => order.payment_status === 'รอตรวจสอบ');
    const paidActiveOrders = activeOrders.filter((order) => ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status));
    const historyOrders = isSalesMode
        ? orderList.filter((order) => !isStoreSale(order) && completedSaleStatuses.includes(order.status))
        : orderList.filter((order) => isHistoryOrder(order));
    const visibleOrders = activeView === 'active'
        ? (isSalesMode ? activeOrders : (activePaymentView === 'pending' ? pendingPaymentOrders : activePaymentView === 'review' ? reviewPaymentOrders : paidActiveOrders))
        : historyOrders;
    const canUploadReceipt = !isSalesMode && Boolean(onUploadReceipt);
    const canCancelOrder = !isSalesMode && Boolean(onCancelOrder);

    const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const formatPaymentStatus = (status) => (status === 'ชำระแล้ว' ? 'ชำระเงินแล้ว' : status);

    const getOrderItems = (order) => {
        if (Array.isArray(order.items) && order.items.length > 0) return order.items;
        if (order.product_id || order.product_name || order.name) {
            return [{
                product_id: order.product_id,
                product_name: order.product_name || order.name,
                quantity: order.qty || order.quantity || 1,
                price: order.price || 0,
                selected_size: order.selected_size,
                selected_color: order.selected_color,
            }];
        }
        return [];
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleReceiptChange = async (orderId, file) => {
        if (!file || !onUploadReceipt) return;

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            setUploadError({ orderId, message: 'รองรับเฉพาะไฟล์ JPG และ PNG เท่านั้น' });
            return;
        }

        if (file.size > MAX_RECEIPT_SIZE) {
            setUploadError({ orderId, message: 'ขนาดไฟล์ต้องไม่เกิน 5MB' });
            return;
        }

        try {
            setUploadError({ orderId: null, message: '' });
            setUploadingOrderId(orderId);
            const imageData = await readFileAsDataUrl(file);
            await onUploadReceipt(orderId, {
                receipt_image_data: imageData,
                receipt_file_name: file.name,
            });
        } finally {
            setUploadingOrderId(null);
        }
    };

    return (
        <div className="order-history-backdrop" onMouseDown={onClose}>
            <section
                className="order-history-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-history-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="order-history-header">
                    <div>
                        <span>{eyebrow}</span>
                        <h2 id="order-history-title">{title}</h2>
                        <p>{description}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={`ปิดหน้าต่าง${title}`}>
                        &times;
                    </button>
                </header>

                <div className="order-history-body">
                    <div className="order-history-tabs" role="tablist" aria-label="ประเภทคำสั่งซื้อ">
                        <button
                            type="button"
                            className={activeView === 'active' ? 'is-active' : ''}
                            onClick={() => setActiveView('active')}
                            role="tab"
                            aria-selected={activeView === 'active'}
                        >
                            {activeTabLabel}
                            <span>{activeOrders.length}</span>
                        </button>
                        <button
                            type="button"
                            className={activeView === 'history' ? 'is-active' : ''}
                            onClick={() => setActiveView('history')}
                            role="tab"
                            aria-selected={activeView === 'history'}
                        >
                            {historyTabLabel}
                            <span>{historyOrders.length}</span>
                        </button>
                    </div>

                    {!isSalesMode && activeView === 'active' && (
                        <div className="order-history-payment-tabs" role="tablist" aria-label="สถานะชำระเงิน">
                            <button
                                type="button"
                                className={activePaymentView === 'pending' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('pending')}
                                role="tab"
                                aria-selected={activePaymentView === 'pending'}
                            >
                                รอชำระ
                                <span>{pendingPaymentOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activePaymentView === 'review' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('review')}
                                role="tab"
                                aria-selected={activePaymentView === 'review'}
                            >
                                รอตรวจสอบ
                                <span>{reviewPaymentOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activePaymentView === 'paid' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('paid')}
                                role="tab"
                                aria-selected={activePaymentView === 'paid'}
                            >
                                ชำระแล้ว
                                <span>{paidActiveOrders.length}</span>
                            </button>
                        </div>
                    )}

                    {orderList.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>{isSalesMode ? 'ยังไม่มีประวัติการขาย' : 'ยังไม่มีประวัติคำสั่งซื้อ'}</strong>
                            <span>{isSalesMode ? 'ยังไม่พบรายการขายในระบบ' : `ไม่พบรายการของบัญชี: ${username}`}</span>
                        </div>
                    ) : visibleOrders.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>
                                {activeView === 'active'
                                    ? (isSalesMode ? 'ยังไม่มีประวัติการขายหน้าร้าน' : (activePaymentView === 'pending' ? 'ยังไม่มีออเดอร์รอชำระ' : activePaymentView === 'review' ? 'ยังไม่มีออเดอร์รอตรวจสอบ' : 'ยังไม่มีออเดอร์ที่ชำระแล้วและกำลังดำเนินการ'))
                                    : (isSalesMode ? 'ยังไม่มีรายการขายออนไลน์' : 'ยังไม่มีประวัติคำสั่งซื้อย้อนหลัง')}
                            </strong>
                            <span>
                                {activeView === 'active'
                                    ? (isSalesMode ? 'รายการ POS หรือรายการที่ขายผ่านหน้าร้านจะแสดงที่นี่' : (activePaymentView === 'pending' ? 'ออเดอร์ที่ยังไม่แนบสลิปหรือยังไม่ชำระจะแสดงที่นี่' : activePaymentView === 'review' ? 'ออเดอร์ที่แนบสลิปแล้วและรอแอดมินยืนยันจะแสดงที่นี่' : 'ออเดอร์ที่ชำระแล้วแต่ยังไม่จบกระบวนการจะแสดงที่นี่'))
                                    : (isSalesMode ? 'รายการที่ลูกค้าสั่งผ่านหน้าร้านออนไลน์จะแสดงที่นี่' : 'ออเดอร์ที่จบกระบวนการแล้วจะแสดงในแท็บนี้')}
                            </span>
                        </div>
                    ) : (
                        visibleOrders.map((item, index) => {
                            const orderItems = getOrderItems(item);
                            const itemCount = orderItems.reduce((sum, orderItem) => sum + Number(orderItem.qty || orderItem.quantity || 0), 0);
                            const productTotal = Number(item.total_price ?? orderItems.reduce((sum, orderItem) => {
                                const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                const price = Number(orderItem.price || 0);
                                return sum + (qty * price);
                            }, 0));
                            const shippingFee = Number(item.shipping_fee || 0);
                            const discount = Number(item.discount || 0);
                            const finalPrice = Number(item.final_price ?? (productTotal + shippingFee - discount));
                            const canCancel = canCancelOrder && cancelableStatuses.includes(item.status);
                            const uploadInputId = `receipt-upload-${item.id || index}`;
                            const orderTitle = isSalesMode
                                ? `คำสั่งซื้อของ ${item.full_name || item.username || 'ลูกค้าทั่วไป'}`
                                : (orderItems.length > 1 ? `สินค้า ${orderItems.length} รายการ` : (item.name || item.product_name || 'สินค้าแฟชั่น'));

                            return (
                                <article className="order-history-card" key={item.id || index}>
                                    <div className="order-history-card-header">
                                        <div>
                                            <span>รหัสคำสั่งซื้อ</span>
                                            <strong>#{item.id}</strong>
                                        </div>
                                        <span className="order-history-status">{item.status || 'สำเร็จ'}</span>
                                    </div>

                                    <div className="order-history-product">
                                        <div className="order-history-product-main">
                                            <h3>{orderTitle}</h3>
                                            {item.detail && <p>{item.detail}</p>}
                                            <div className="order-history-tags">
                                                {isSalesMode && item.username && <span>ลูกค้า {item.username}</span>}
                                                {isSalesMode && item.payment_method && <span>{item.payment_method}</span>}
                                                <span>สินค้า {orderItems.length || 1} รายการ</span>
                                                <span>จำนวน {itemCount || Number(item.qty || item.quantity || 1)} ชิ้น</span>
                                            </div>
                                        </div>
                                        <div className="order-history-price">
                                            <span>{isSalesMode ? 'ยอดขาย' : 'รวมสินค้า'}</span>
                                            <strong>฿{formatMoney(isSalesMode ? finalPrice : productTotal)}</strong>
                                        </div>
                                    </div>

                                    {orderItems.length > 0 && (
                                        <div className="order-history-item-list">
                                            {orderItems.map((orderItem, itemIndex) => {
                                                const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                                const unitPrice = Number(orderItem.price || 0);
                                                return (
                                                    <div className="order-history-item-row" key={`${item.id || index}-${orderItem.product_id || itemIndex}`}>
                                                        <div>
                                                            <strong>{orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'}</strong>
                                                            <span>
                                                                {[
                                                                    orderItem.selected_size ? `ไซซ์ ${orderItem.selected_size}` : '',
                                                                    orderItem.selected_color ? `สี ${orderItem.selected_color}` : '',
                                                                    `จำนวน ${qty} ชิ้น`,
                                                                ].filter(Boolean).join(' / ')}
                                                            </span>
                                                        </div>
                                                        <b>฿{formatMoney(unitPrice * qty)}</b>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {(item.tracking_no || item.payment_status) && (
                                        <div className="order-history-meta">
                                            {item.tracking_no && (
                                                <div>
                                                    <span>เลขพัสดุ</span>
                                                    <strong>{item.tracking_no}</strong>
                                                </div>
                                            )}
                                            {item.payment_status && (
                                                <div>
                                                    <span>สถานะชำระเงิน</span>
                                                    <strong>{formatPaymentStatus(item.payment_status)}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {canUploadReceipt && (reuploadPaymentStatuses.includes(item.payment_status) || item.status === 'รอจัดการ') && (
                                        <div className="order-history-upload-panel">
                                            <input
                                                id={uploadInputId}
                                                className="order-history-upload-input"
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg"
                                                disabled={uploadingOrderId === item.id}
                                                onChange={(event) => {
                                                    handleReceiptChange(item.id, event.target.files?.[0]);
                                                    event.target.value = '';
                                                }}
                                            />
                                            <label className="order-history-upload-box" htmlFor={uploadInputId}>
                                                <span className="order-history-upload-icon" aria-hidden="true">
                                                    <svg viewBox="0 0 24 24">
                                                        <path d="M12 16V4" />
                                                        <path d="m7 9 5-5 5 5" />
                                                        <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
                                                    </svg>
                                                </span>
                                                <span>
                                                    <strong>{uploadingOrderId === item.id ? 'กำลังอัปโหลดสลิป...' : 'อัปโหลดสลิปโอนเงิน'}</strong>
                                                    <small>รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB</small>
                                                </span>
                                            </label>
                                            {uploadError.orderId === item.id && uploadError.message && (
                                                <div className="order-history-upload-error">{uploadError.message}</div>
                                            )}
                                        </div>
                                    )}

                                    <div className="order-history-summary">
                                        <div>
                                            <span>ยอดสินค้า</span>
                                            <strong>฿{formatMoney(productTotal)}</strong>
                                        </div>
                                        <div>
                                            <span>ค่าส่ง</span>
                                            <strong>฿{formatMoney(shippingFee)}</strong>
                                        </div>
                                        <div>
                                            <span>ส่วนลด</span>
                                            <strong className="is-discount">-฿{formatMoney(discount)}</strong>
                                        </div>
                                        <div className="is-total">
                                            <span>ยอดสุทธิ</span>
                                            <strong>฿{formatMoney(finalPrice)}</strong>
                                        </div>
                                    </div>

                                    {canCancel && (
                                        <button
                                            type="button"
                                            className="order-history-cancel"
                                            onClick={() => onCancelOrder?.(item.id)}
                                        >
                                            ยกเลิกคำสั่งซื้อ
                                        </button>
                                    )}
                                </article>
                            );
                        })
                    )}
                </div>

                <footer className="order-history-footer">
                    <button type="button" onClick={onClose}>ปิดหน้าต่าง</button>
                </footer>
            </section>
        </div>
    );
}

export default OrderHistoryModal;
