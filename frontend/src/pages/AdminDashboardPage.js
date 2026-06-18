import { Fragment, useEffect, useState } from 'react';

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const orderStatuses = ['ทั้งหมด', 'รอชำระ', 'รอตรวจสอบ', 'กำลังจัดส่ง', 'เตรียมสินค้า', 'พร้อมรับ', 'จัดส่งแล้ว', 'ยกเลิก'];
const approvedStatuses = ['กำลังจัดส่ง', 'เตรียมสินค้า', 'พร้อมรับ', 'จัดส่งแล้ว'];
const isPickupOrder = (order) => order.shipping_method === 'รับหน้าร้าน';
const isPaymentApproved = (order) => approvedStatuses.includes(order.status);
const getApproveStatus = (order) => (isPickupOrder(order) ? 'เตรียมสินค้า' : 'กำลังจัดส่ง');
const getStatusClass = (status) => {
    if (status === 'ยกเลิก') return 'locked';
    if (status === 'รอชำระ') return 'low';
    if (status === 'รอตรวจสอบ') return 'pending';
    if (['กำลังจัดส่ง', 'เตรียมสินค้า'].includes(status)) return 'shipping';
    return 'paid';
};

function AdminDashboardPage({
    orders,
    onDeleteOrder,
    onUpdateOrderStatus,
}) {
    const [trackingInputs, setTrackingInputs] = useState({});
    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
    const [trackingErrors, setTrackingErrors] = useState({});
    const [savingOrderId, setSavingOrderId] = useState(null);
    const waitingPaymentOrders = orders.filter((order) => order.status === 'รอชำระ').length;
    const waitingReviewOrders = orders.filter((order) => order.status === 'รอตรวจสอบ').length;
    const approvedOrders = orders.filter(isPaymentApproved).length;
    const activeSalesOrders = orders.filter((order) => order.status !== 'ยกเลิก');
    const activeRevenue = activeSalesOrders.reduce((sum, order) => sum + (Number(order.final_price ?? order.total_price) || 0), 0);
    const today = new Date();
    const isSameDay = (date) => date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();
    const isSameMonth = (date) => date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth();
    const isSameYear = (date) => date.getFullYear() === today.getFullYear();
    const sumRevenueByDate = (predicate) => activeSalesOrders.reduce((sum, order) => {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        if (!orderDate || Number.isNaN(orderDate.getTime()) || !predicate(orderDate)) return sum;
        return sum + (Number(order.final_price ?? order.total_price) || 0);
    }, 0);
    const dailyRevenue = sumRevenueByDate(isSameDay);
    const monthlyRevenue = sumRevenueByDate(isSameMonth);
    const yearlyRevenue = sumRevenueByDate(isSameYear);
    const visibleOrders = statusFilter === 'ทั้งหมด'
        ? orders
        : orders.filter((order) => (order.status || 'รอชำระ') === statusFilter);

    useEffect(() => {
        // เก็บเลขพัสดุแยกตามออเดอร์ เพื่อให้แก้ในตารางได้โดยไม่กระทบแถวอื่น
        setTrackingInputs((current) => orders.reduce((next, order) => ({
            ...next,
            [order.id]: current[order.id] ?? order.tracking_no ?? '',
        }), {}));
    }, [orders]);

    const updateTrackingInput = (orderId, value) => {
        setTrackingErrors((current) => ({ ...current, [orderId]: '' }));
        setTrackingInputs((current) => ({ ...current, [orderId]: value }));
    };

    const toggleOrderDetails = (orderId) => {
        setExpandedOrderId((current) => (current === orderId ? null : orderId));
    };

    const runOrderStep = async (order, nextStatus) => {
        if (savingOrderId) return;
        const trackingNo = trackingInputs[order.id] || '';

        if (nextStatus === 'จัดส่งแล้ว' && !trackingNo.trim()) {
            setExpandedOrderId(order.id);
            setTrackingErrors((current) => ({
                ...current,
                [order.id]: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นจัดส่งแล้ว',
            }));
            return;
        }

        try {
            setSavingOrderId(order.id);
            const result = await onUpdateOrderStatus(order.id, trackingNo, nextStatus);
            if (result?.success) {
                setTrackingErrors((current) => ({ ...current, [order.id]: '' }));
                return;
            }
            if (!result?.success && result?.message) {
                if (result.field === 'tracking_no') {
                    setExpandedOrderId(order.id);
                    setTrackingErrors((current) => ({ ...current, [order.id]: result.message }));
                } else {
                    alert(result.message);
                }
            }
        } finally {
            setSavingOrderId(null);
        }
    };

    return (
        <div className="admin-dashboard">
            <section className="admin-hero">
                <div>
                    <span className="admin-eyebrow">Admin Overview</span>
                    <h1>Dashboard & ออเดอร์</h1>
                    <p>ดูภาพรวมคำสั่งซื้อ ยอดขาย และคลังสินค้าในที่เดียว</p>
                </div>
                <div className="admin-hero-total">
                    <span>ยอดขายรวม</span>
                    <strong>฿{formatMoney(activeRevenue)}</strong>
                </div>
            </section>

            <section className="admin-stat-grid">
                <div className="admin-stat-card">
                    <span>คำสั่งซื้อทั้งหมด</span>
                    <strong>{orders.length}</strong>
                    <small>รายการในระบบ</small>
                </div>
                <div className="admin-stat-card warning">
                    <span>รอชำระ</span>
                    <strong>{waitingPaymentOrders}</strong>
                    <small>ยังไม่มีสลิปโอนเงิน</small>
                </div>
                <div className="admin-stat-card success">
                    <span>รอตรวจสอบ</span>
                    <strong>{waitingReviewOrders}</strong>
                    <small>มีสลิปแล้ว รอยืนยันยอด</small>
                </div>
                <div className="admin-stat-card danger">
                    <span>กำลังดำเนินการ</span>
                    <strong>{approvedOrders}</strong>
                    <small>อนุมัติแล้วหรือจบออเดอร์</small>
                </div>
            </section>

            <section className="admin-stat-grid">
                <div className="admin-stat-card success">
                    <span>ยอดขายรายวัน</span>
                    <strong>฿{formatMoney(dailyRevenue)}</strong>
                    <small>ไม่นับออเดอร์ยกเลิก</small>
                </div>
                <div className="admin-stat-card success">
                    <span>ยอดขายรายเดือน</span>
                    <strong>฿{formatMoney(monthlyRevenue)}</strong>
                    <small>ไม่นับออเดอร์ยกเลิก</small>
                </div>
                <div className="admin-stat-card success">
                    <span>ยอดขายรายปี</span>
                    <strong>฿{formatMoney(yearlyRevenue)}</strong>
                    <small>ไม่นับออเดอร์ยกเลิก</small>
                </div>
            </section>

            <section className="admin-panel">
                <div className="admin-panel-header">
                    <div>
                        <h2>รายการสั่งซื้อและแจ้งชำระเงิน</h2>
                        <p>จัดการออเดอร์ล่าสุดและยืนยันยอดชำระเงิน</p>
                    </div>
                    <div className="admin-panel-tools">
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            {orderStatuses.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <span>{visibleOrders.length} ออเดอร์</span>
                    </div>
                </div>

                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>ออเดอร์</th>
                                <th>ลูกค้า</th>
                                <th className="text-center">สถานะ</th>
                                <th>การรับสินค้า</th>
                                <th>เลขพัสดุ</th>
                                <th className="text-end">ยอดสุทธิ</th>
                                <th className="text-center">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleOrders.length > 0 ? (
                                visibleOrders.map((order) => {
                                    const expanded = expandedOrderId === order.id;
                                    const currentStatus = order.status || 'รอชำระ';
                                    const canConfirmPayment = currentStatus === 'รอตรวจสอบ' && Boolean(order.receipt_image);
                                    const canSaveTracking = currentStatus === 'กำลังจัดส่ง' && !isPickupOrder(order);
                                    const canMarkReadyForPickup = currentStatus === 'เตรียมสินค้า' && isPickupOrder(order);
                                    const showTrackingInput = !isPickupOrder(order) && !['รอชำระ', 'รอตรวจสอบ', 'ยกเลิก', 'จัดส่งแล้ว'].includes(currentStatus);
                                    const isSaving = savingOrderId === order.id;
                                    const trackingError = trackingErrors[order.id];

                                    return (
                                        <Fragment key={order.id}>
                                            <tr key={order.id} className="admin-summary-row" onClick={() => toggleOrderDetails(order.id)}>
                                                <td>
                                                    <strong className="admin-order-id">#{order.id}</strong>
                                                </td>
                                                <td>
                                                    <strong>{order.username || 'ลูกค้าทั่วไป'}</strong>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`admin-status ${getStatusClass(currentStatus)}`}>
                                                        {currentStatus}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="admin-soft-badge">
                                                        {order.shipping_method || '-'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={order.tracking_no ? 'fw-bold text-dark' : 'text-muted'}>
                                                        {order.tracking_no || '-'}
                                                    </span>
                                                </td>
                                                <td className="text-end admin-money">
                                                    ฿{formatMoney(order.final_price ?? order.total_price)}
                                                </td>
                                                <td className="text-center">
                                                    <div className="admin-action-row">
                                                        {currentStatus === 'รอชำระ' && (
                                                            <span className="admin-soft-badge">รอลูกค้าแนบสลิป</span>
                                                        )}
                                                        {currentStatus === 'รอตรวจสอบ' && !order.receipt_image && (
                                                            <span className="admin-soft-badge">ไม่มีสลิป</span>
                                                        )}
                                                        {canConfirmPayment && (
                                                            <button
                                                                type="button"
                                                                className="admin-action success"
                                                                disabled={isSaving}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    runOrderStep(order, getApproveStatus(order));
                                                                }}
                                                            >
                                                                ตรวจสอบแล้ว
                                                            </button>
                                                        )}
                                                        {canSaveTracking && (
                                                            <button
                                                                type="button"
                                                                className="admin-action primary"
                                                                disabled={isSaving}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setExpandedOrderId(order.id);
                                                                    runOrderStep(order, 'จัดส่งแล้ว');
                                                                }}
                                                            >
                                                                บันทึกเลขพัสดุ
                                                            </button>
                                                        )}
                                                        {canMarkReadyForPickup && (
                                                            <button
                                                                type="button"
                                                                className="admin-action primary"
                                                                disabled={isSaving}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    runOrderStep(order, 'พร้อมรับ');
                                                                }}
                                                            >
                                                                พร้อมรับ
                                                            </button>
                                                        )}
                                                        {['พร้อมรับ', 'จัดส่งแล้ว'].includes(currentStatus) && (
                                                            <span className="admin-soft-badge">จบออเดอร์</span>
                                                        )}
                                                        {currentStatus === 'ยกเลิก' && (
                                                            <span className="admin-soft-badge">ยกเลิกแล้ว</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <tr className="admin-detail-row">
                                                    <td colSpan="7">
                                                        <div className="admin-order-detail">
                                                            <div>
                                                                <h3>ข้อมูลจัดส่ง</h3>
                                                                <p>{order.address || '-'}</p>
                                                                <small>{order.phone || '-'}</small>
                                                            </div>
                                                            <div>
                                                                <h3>ยอดเงิน</h3>
                                                                <p>สินค้า ฿{formatMoney(order.total_price)}</p>
                                                                <p>ค่าส่ง ฿{formatMoney(order.shipping_fee)}</p>
                                                                <p>ส่วนลด ฿{formatMoney(order.discount)}</p>
                                                                <strong>สุทธิ ฿{formatMoney(order.final_price ?? order.total_price)}</strong>
                                                            </div>
                                                            <div>
                                                                <h3>สลิปโอนเงิน</h3>
                                                                {order.receipt_image ? (
                                                                    <a href={order.receipt_image} target="_blank" rel="noreferrer" className="admin-receipt-preview">
                                                                        <img src={order.receipt_image} alt={`สลิปออเดอร์ ${order.id}`} />
                                                                    </a>
                                                                ) : (
                                                                    <p className="text-muted">ไม่มีสลิป</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h3>เลขพัสดุ</h3>
                                                                {showTrackingInput ? (
                                                                    <>
                                                                        <input
                                                                            className={`form-control form-control-sm ${trackingError ? 'is-invalid' : ''}`}
                                                                            value={trackingInputs[order.id] || ''}
                                                                            onChange={(event) => updateTrackingInput(order.id, event.target.value)}
                                                                            placeholder="กรอกเลขพัสดุ"
                                                                        />
                                                                        {trackingError && (
                                                                            <small className="text-danger fw-bold d-block mt-1">
                                                                                {trackingError}
                                                                            </small>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <p className="text-muted">ยังไม่ต้องกรอกเลขพัสดุ</p>
                                                                )}
                                                            </div>
                                                            <div className="admin-order-detail-actions">
                                                                {currentStatus === 'รอชำระ' && (
                                                                    <span className="admin-soft-badge">รอลูกค้าแนบสลิป</span>
                                                                )}
                                                                {canConfirmPayment && (
                                                                    <button className="admin-action success" disabled={isSaving} onClick={() => runOrderStep(order, getApproveStatus(order))}>
                                                                        ตรวจสอบแล้ว
                                                                    </button>
                                                                )}
                                                                {canSaveTracking && (
                                                                    <button className="admin-action primary" disabled={isSaving} onClick={() => runOrderStep(order, 'จัดส่งแล้ว')}>
                                                                        บันทึกเลขพัสดุ
                                                                    </button>
                                                                )}
                                                                {canMarkReadyForPickup && (
                                                                    <button className="admin-action primary" disabled={isSaving} onClick={() => runOrderStep(order, 'พร้อมรับ')}>
                                                                        พร้อมรับ
                                                                    </button>
                                                                )}
                                                                {currentStatus === 'เตรียมสินค้า' && (
                                                                    <span className="admin-soft-badge">กำลังเตรียมสินค้าให้ลูกค้า</span>
                                                                )}
                                                                {currentStatus === 'พร้อมรับ' && (
                                                                    <span className="admin-soft-badge">พร้อมให้ลูกค้ารับหน้าร้าน</span>
                                                                )}
                                                                {currentStatus === 'จัดส่งแล้ว' && (
                                                                    <span className="admin-soft-badge">จบออเดอร์แล้ว</span>
                                                                )}
                                                                {currentStatus === 'ยกเลิก' && (
                                                                    <span className="admin-soft-badge">ยกเลิกและคืนสต็อกแล้ว</span>
                                                                )}
                                                                <button className="admin-action danger" onClick={() => onDeleteOrder(order.id)}>
                                                                    ลบออเดอร์
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7">
                                        <div className="admin-empty">ยังไม่มีประวัติการสั่งซื้อในระบบ</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

        </div>
    );
}

export default AdminDashboardPage;
