import { useState } from 'react';

function OrderHistoryModal({ orders, username, onClose, onUploadReceipt, onCancelOrder }) {
    const [uploadingOrderId, setUploadingOrderId] = useState(null);
    const cancelableStatuses = ['รอชำระ', 'รอตรวจสอบ'];

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

        try {
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
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1500 }}>
            <div className="modal-dialog modal-dialog-centered modal-md">
                <div className="modal-content border-0 shadow-lg rounded-3">
                    <div className="modal-header bg-dark text-white py-3">
                        <h5 className="modal-title fw-bold">ประวัติการสั่งซื้อของคุณ</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                        {!Array.isArray(orders) || orders.length === 0 ? (
                            <div className="text-center py-5 bg-white rounded-3 border shadow-sm">
                                <h6 className="fw-bold text-dark mb-1">ยังไม่มีประวัติคำสั่งซื้อ</h6>
                                <p className="text-muted small mb-0">ไม่พบรายการของบัญชี: {username}</p>
                            </div>
                        ) : (
                            orders.map((item, index) => {
                                const price = Number(item.price || item.total_price || 0);
                                const qty = Number(item.qty || item.quantity || 1);
                                const finalPrice = Number(item.final_price ?? item.total_price ?? 0);
                                const canCancel = cancelableStatuses.includes(item.status);

                                return (
                                    <div className="card border-0 shadow-sm rounded-3 mb-3" key={item.id || index}>
                                        <div className="card-body p-3">
                                            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                                                <div>
                                                    <span className="text-muted small d-block">รหัสคำสั่งซื้อ</span>
                                                    <span className="fw-bold text-dark">#{item.id}</span>
                                                </div>
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-bold">
                                                    {item.status || 'สำเร็จ'}
                                                </span>
                                            </div>
                                            <h6 className="fw-bold text-dark mb-1">{item.name || item.product_name || 'สินค้าแฟชั่น'}</h6>
                                            <small className="text-muted d-block mb-2">{item.detail}</small>
                                            {item.selected_size && (
                                                <small className="text-muted d-block mb-2">ไซซ์: {item.selected_size}</small>
                                            )}
                                            {item.selected_color && (
                                                <small className="text-muted d-block mb-2">สี: {item.selected_color}</small>
                                            )}
                                            {item.tracking_no && (
                                                <small className="text-dark d-block mb-2">
                                                    <strong>เลขพัสดุ:</strong> {item.tracking_no}
                                                </small>
                                            )}
                                            {item.payment_status && (
                                                <small className="text-muted d-block mb-2">
                                                    สถานะชำระเงิน: {item.payment_status}
                                                </small>
                                            )}
                                            {item.status === 'รอชำระ' && (
                                                <div className="bg-white border rounded-3 p-2 mb-2">
                                                    <label className="small fw-bold text-dark mb-1 d-block">แนบสลิปโอนเงิน</label>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                        disabled={uploadingOrderId === item.id}
                                                        onChange={(event) => handleReceiptChange(item.id, event.target.files?.[0])}
                                                    />
                                                    {uploadingOrderId === item.id && (
                                                        <small className="text-muted d-block mt-1">กำลังอัปโหลดสลิป...</small>
                                                    )}
                                                </div>
                                            )}
                                            <div className="bg-light border rounded-3 p-2 mb-2 small">
                                                <div className="d-flex justify-content-between">
                                                    <span className="text-muted">ยอดสินค้า</span>
                                                    <strong>฿{formatMoney(item.total_price)}</strong>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span className="text-muted">ค่าส่ง</span>
                                                    <strong>฿{formatMoney(item.shipping_fee)}</strong>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span className="text-muted">ส่วนลด</span>
                                                    <strong className="text-danger">-฿{formatMoney(item.discount)}</strong>
                                                </div>
                                                <div className="d-flex justify-content-between border-top mt-1 pt-1">
                                                    <span className="fw-bold">ยอดสุทธิ</span>
                                                    <strong className="text-success">฿{formatMoney(finalPrice)}</strong>
                                                </div>
                                            </div>
                                            <div className="d-flex justify-content-between">
                                                <span className="fw-bold text-primary">฿{formatMoney(price)}</span>
                                                <span className="badge bg-secondary text-white rounded-pill px-2">จำนวน: {qty} ชิ้น</span>
                                            </div>
                                            {canCancel && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm w-100 fw-bold rounded-2 mt-3"
                                                    onClick={() => onCancelOrder?.(item.id)}
                                                >
                                                    ยกเลิกคำสั่งซื้อ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="modal-footer border-0 bg-light py-2">
                        <button type="button" className="btn btn-dark w-100 fw-bold rounded-2 py-2" onClick={onClose}>
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrderHistoryModal;
