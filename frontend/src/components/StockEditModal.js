function StockEditModal({ stockEdit, setStockEdit, onSave }) {
    if (!stockEdit?.id) return null;

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 rounded-4 p-3 shadow-lg">
                    <div className="modal-header border-0 pb-0">
                        <h5 className="fw-bold">ปรับสต็อก: {stockEdit.name}</h5>
                        <button className="btn-close" onClick={() => setStockEdit({ id: null, amount: 0, remark: '', name: '' })}></button>
                    </div>
                    <div className="modal-body">
                        <label className="small fw-bold">จำนวนที่เพิ่มเข้าคลัง</label>
                        <input
                            type="number"
                            className="form-control mb-3"
                            min="1"
                            step="1"
                            value={stockEdit.amount || ''}
                            onChange={(e) => setStockEdit({ ...stockEdit, amount: e.target.value })}
                            onKeyDown={(e) => ['-', '+', '.', 'e', 'E'].includes(e.key) && e.preventDefault()}
                            placeholder="กรอกจำนวนเต็มตั้งแต่ 1 ขึ้นไป"
                        />
                        <label className="small fw-bold">หมายเหตุ</label>
                        <input
                            type="text"
                            className="form-control"
                            value={stockEdit.remark || ''}
                            onChange={(e) => setStockEdit({ ...stockEdit, remark: e.target.value })}
                            placeholder="เช่น รับเข้าสินค้ารอบใหม่"
                            required
                        />
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-primary w-100 fw-bold py-2 rounded-pill" onClick={onSave}>บันทึกการปรับปรุง</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StockEditModal;
