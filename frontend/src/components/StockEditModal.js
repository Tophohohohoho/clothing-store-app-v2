const sanitizeAmountInput = (value) => String(value || '').replace(/[^\d]/g, '');
const formatAmountInput = (value) => {
    const sanitized = sanitizeAmountInput(value);
    return sanitized ? Number(sanitized).toLocaleString('th-TH') : '';
};

function StockEditModal({ stockEdit, setStockEdit, onSave }) {
    if (!stockEdit?.id) return null;

    const resetStockEdit = () => setStockEdit({
        id: null,
        amount: '',
        reason: '',
        changeType: 'รับสินค้าเข้า',
        adjustmentMode: 'increase',
        currentStock: 0,
        name: '',
    });

    const isAdjustment = stockEdit.changeType === 'ปรับยอด';
    const isDecreaseMode = ['สินค้าชำรุด', 'สูญหาย'].includes(stockEdit.changeType)
        || (isAdjustment && stockEdit.adjustmentMode === 'decrease');
    const stockPreview = Number(stockEdit.amount) || 0;
    const signedPreview = isDecreaseMode
        ? -stockPreview
        : stockPreview;
    const projectedStock = Math.max(0, (Number(stockEdit.currentStock) || 0) + signedPreview);
    const maxDecreaseAmount = Math.max(0, Number(stockEdit.currentStock) || 0);
    const exceedsAvailableStock = isDecreaseMode && stockPreview > maxDecreaseAmount;

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 rounded-4 p-3 shadow-lg">
                    <div className="modal-header border-0 pb-0">
                        <h5 className="fw-bold">ปรับสต็อก: {stockEdit.name}</h5>
                        <button className="btn-close" onClick={resetStockEdit}></button>
                    </div>
                    <div className="modal-body">
                        <div className="mb-3">
                            <label className="small fw-bold">ประเภทการเปลี่ยนแปลง</label>
                            <select
                                className="form-select"
                                value={stockEdit.changeType || 'รับสินค้าเข้า'}
                                onChange={(e) => setStockEdit({ ...stockEdit, changeType: e.target.value })}
                            >
                                <option value="รับสินค้าเข้า">รับสินค้าเข้า</option>
                                <option value="คืนสินค้า">คืนสินค้า</option>
                                <option value="สินค้าชำรุด">สินค้าชำรุด</option>
                                <option value="สูญหาย">สูญหาย</option>
                                <option value="ปรับยอด">ปรับยอด</option>
                            </select>
                        </div>
                        {isAdjustment && (
                            <div className="mb-3">
                                <label className="small fw-bold d-block">ทิศทางการปรับยอด</label>
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className={`btn ${stockEdit.adjustmentMode === 'increase' ? 'btn-dark' : 'btn-outline-secondary'} flex-fill`}
                                        onClick={() => setStockEdit({ ...stockEdit, adjustmentMode: 'increase' })}
                                    >
                                        เพิ่มสต็อก
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${stockEdit.adjustmentMode === 'decrease' ? 'btn-dark' : 'btn-outline-secondary'} flex-fill`}
                                        onClick={() => setStockEdit({ ...stockEdit, adjustmentMode: 'decrease' })}
                                    >
                                        ลดสต็อก
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="mb-3 rounded-4 bg-light px-3 py-2">
                            <div className="small text-muted">คงเหลือปัจจุบัน</div>
                            <div className="fw-bold">{Number(stockEdit.currentStock || 0).toLocaleString('th-TH')} ชิ้น</div>
                            <div className="small text-muted mt-2">คงเหลือหลังบันทึก</div>
                            <div className="fw-bold">{projectedStock.toLocaleString('th-TH')} ชิ้น</div>
                        </div>
                        <label className="small fw-bold">จำนวนที่เปลี่ยน</label>
                        <input
                            type="text"
                            className="form-control mb-3"
                            inputMode="numeric"
                            autoComplete="off"
                            value={formatAmountInput(stockEdit.amount)}
                            onChange={(e) => {
                                const nextAmount = sanitizeAmountInput(e.target.value);
                                if (isDecreaseMode && Number(nextAmount || 0) > maxDecreaseAmount) {
                                    return;
                                }
                                setStockEdit({ ...stockEdit, amount: nextAmount });
                            }}
                            onKeyDown={(e) => ['-', '+', '.', ',', 'e', 'E', ' '].includes(e.key) && e.preventDefault()}
                            placeholder={isDecreaseMode ? `กรอกจำนวนได้สูงสุด ${maxDecreaseAmount.toLocaleString('th-TH')}` : 'กรอกจำนวนเต็มตั้งแต่ 1 ขึ้นไป'}
                            aria-label="จำนวนที่เปลี่ยน"
                        />
                        {isDecreaseMode && (
                            <small className={`d-block mb-3 ${exceedsAvailableStock ? 'text-danger' : 'text-muted'}`}>
                                {exceedsAvailableStock
                                    ? `จำนวนที่ลดต้องไม่เกินสต็อกคงเหลือ ${maxDecreaseAmount.toLocaleString('th-TH')} ชิ้น`
                                    : `ลดได้ไม่เกิน ${maxDecreaseAmount.toLocaleString('th-TH')} ชิ้น`}
                            </small>
                        )}
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-primary w-100 fw-bold py-2 rounded-pill" disabled={exceedsAvailableStock} onClick={onSave}>บันทึกการปรับปรุง</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StockEditModal;
