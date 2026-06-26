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
    const cancelableStatuses = ['รอชำระ', 'รอตรวจสอบ'];
    const historyStatuses = ['สำเร็จ', 'จัดส่งแล้ว', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น', 'ยกเลิก', 'ยกเลิกคำสั่งซื้อ'];
    const completedSaleStatuses = ['สำเร็จ', 'จัดส่งแล้ว', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น'];
    const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
    const orderList = Array.isArray(orders) ? orders : [];
    const isSalesMode = mode === 'sales';
    const isHistoryOrder = (order) => historyStatuses.includes(order.status);
    const isStoreSale = (order) => (order.shipping_method || order.delivery_type) === 'ขายหน้าร้าน';
    const activeOrders = isSalesMode
        ? orderList.filter((order) => isStoreSale(order))
        : orderList.filter((order) => !isHistoryOrder(order));
    const historyOrders = isSalesMode
        ? orderList.filter((order) => !isStoreSale(order) && completedSaleStatuses.includes(order.status))
        : orderList.filter((order) => isHistoryOrder(order));
    const visibleOrders = activeView === 'active' ? activeOrders : historyOrders;
    const canUploadReceipt = !isSalesMode && Boolean(onUploadReceipt);
    const canCancelOrder = !isSalesMode && Boolean(onCancelOrder);

    const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

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

                    {orderList.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>{isSalesMode ? 'ยังไม่มีประวัติการขาย' : 'ยังไม่มีประวัติคำสั่งซื้อ'}</strong>
                            <span>{isSalesMode ? 'ยังไม่พบรายการขายในระบบ' : `ไม่พบรายการของบัญชี: ${username}`}</span>
                        </div>
                    ) : visibleOrders.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>
                                {activeView === 'active'
                                    ? (isSalesMode ? 'ยังไม่มีประวัติการขายหน้าร้าน' : 'ยังไม่มีคำสั่งซื้อที่กำลังดำเนินการ')
                                    : (isSalesMode ? 'ยังไม่มีรายการขายออนไลน์' : 'ยังไม่มีประวัติคำสั่งซื้อย้อนหลัง')}
                            </strong>
                            <span>
                                {activeView === 'active'
                                    ? (isSalesMode ? 'รายการ POS หรือรายการที่ขายผ่านหน้าร้านจะแสดงที่นี่' : 'รายการที่สำเร็จหรือยกเลิกแล้วจะแสดงในประวัติคำสั่งซื้อ')
                                    : (isSalesMode ? 'รายการที่ลูกค้าสั่งผ่านหน้าร้านออนไลน์จะแสดงที่นี่' : 'คำสั่งซื้อที่ยังไม่จบจะแสดงในแท็บคำสั่งซื้อ')}
                            </span>
                        </div>
                    ) : (
                        visibleOrders.map((item, index) => {
                            const qty = Number(item.qty || item.quantity || 1);
                            const rawUnitPrice = Number(item.price || 0);
                            const productTotal = Number(item.total_price ?? (rawUnitPrice * qty));
                            const unitPrice = Number(rawUnitPrice || (qty > 0 ? productTotal / qty : productTotal) || 0);
                            const shippingFee = Number(item.shipping_fee || 0);
                            const discount = Number(item.discount || 0);
                            const finalPrice = Number(item.final_price ?? (productTotal + shippingFee - discount));
                            const canCancel = canCancelOrder && cancelableStatuses.includes(item.status);
                            const uploadInputId = `receipt-upload-${item.id || index}`;
                            const orderTitle = isSalesMode
                                ? `คำสั่งซื้อของ ${item.full_name || item.username || 'ลูกค้าทั่วไป'}`
                                : (item.name || item.product_name || 'สินค้าแฟชั่น');

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
                                                {item.selected_size && <span>ไซซ์ {item.selected_size}</span>}
                                                {item.selected_color && <span>สี {item.selected_color}</span>}
                                                {isSalesMode && item.username && <span>ลูกค้า {item.username}</span>}
                                                {isSalesMode && item.payment_method && <span>{item.payment_method}</span>}
                                                <span>จำนวน {qty} ชิ้น</span>
                                            </div>
                                        </div>
                                        <div className="order-history-price">
                                            <span>{isSalesMode ? 'ยอดขาย' : 'ราคาต่อชิ้น'}</span>
                                            <strong>฿{formatMoney(isSalesMode ? finalPrice : unitPrice)}</strong>
                                        </div>
                                    </div>

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
                                                    <strong>{item.payment_status}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {canUploadReceipt && item.status === 'รอชำระ' && (
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
