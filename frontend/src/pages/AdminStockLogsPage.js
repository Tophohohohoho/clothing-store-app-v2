import { useState } from 'react';

function AdminStockLogsPage({ stockLogs, systemLogs = [], deleteLogTarget, setDeleteLogTarget, onDeleteLog }) {
    const [activityView, setActivityView] = useState('stock');
    const formatDate = (value) => (value ? new Date(value).toLocaleString('th-TH') : '-');

    return (
        <div className="card border-0 shadow-sm rounded-4 p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h4 className="fw-bold mb-1">ประวัติการเคลื่อนไหว</h4>
                    <small className="text-muted">ตรวจสอบประวัติสต็อกและบันทึกการทำงานของแอดมิน</small>
                </div>
                <div className="admin-subtabs">
                    <button
                        type="button"
                        className={activityView === 'stock' ? 'active' : ''}
                        onClick={() => setActivityView('stock')}
                    >
                        ประวัติสต็อก
                    </button>
                    <button
                        type="button"
                        className={activityView === 'system' ? 'active' : ''}
                        onClick={() => setActivityView('system')}
                    >
                        บันทึกแอดมิน
                    </button>
                </div>
            </div>

            {activityView === 'stock' && (
                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light text-muted small">
                            <tr>
                                <th>วันที่/เวลา</th>
                                <th>สินค้า</th>
                                <th>ผู้ทำรายการ</th>
                                <th className="text-center">จำนวน</th>
                                <th>หมายเหตุ</th>
                                <th className="text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockLogs.length > 0 ? (
                                stockLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="small">{formatDate(log.created_at)}</td>
                                        <td><strong>{log.product_name}</strong></td>
                                        <td><span className="badge bg-light text-dark border">{log.admin_name || 'ระบบ'}</span></td>
                                        <td className="text-center fw-bold">
                                            <span className={log.amount >= 0 ? 'text-success' : 'text-danger'}>{log.amount > 0 ? `+${log.amount}` : log.amount}</span>
                                        </td>
                                        <td className="small text-muted">{log.remark}</td>
                                        <td className="text-center">
                                            {!String(log.remark || '').includes('[รายการถูกลบ]') && (
                                                <button className="btn btn-sm btn-outline-danger border-0" onClick={() => setDeleteLogTarget({ id: log.id, remark: '' })}>ลบ</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center text-muted py-4">ยังไม่มีประวัติสต็อก</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activityView === 'system' && (
                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light text-muted small">
                            <tr>
                                <th>วันที่/เวลา</th>
                                <th>ผู้ทำรายการ</th>
                                <th>สิทธิ์</th>
                                <th>การทำงาน</th>
                                <th>หมายเหตุ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {systemLogs.length > 0 ? (
                                systemLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="small">{formatDate(log.log_date)}</td>
                                        <td>
                                            <strong>{log.full_name || log.username || 'ระบบ'}</strong>
                                            {log.username && <small className="text-muted d-block">บัญชี: {log.username}</small>}
                                        </td>
                                        <td><span className="badge bg-light text-dark border">{log.role || '-'}</span></td>
                                        <td className="fw-bold">{log.action}</td>
                                        <td className="small text-muted">{log.remark || '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center text-muted py-4">ยังไม่มีบันทึกแอดมิน</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {deleteLogTarget.id && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1300 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 shadow-lg p-3">
                            <div className="modal-header border-0 pb-0">
                                <h5 className="fw-bold text-danger">ยืนยันการลบรายการประวัติ</h5>
                            </div>
                            <div className="modal-body">
                                <p className="text-muted small">รายการจะถูกลบออกจากตาราง และบันทึกหมายเหตุการลบไว้แทน</p>
                                <label className="small fw-bold mb-2">ระบุเหตุผลที่ต้องการลบ *</label>
                                <textarea className="form-control border-danger-subtle" rows="3" value={deleteLogTarget.remark} onChange={(e) => setDeleteLogTarget({ ...deleteLogTarget, remark: e.target.value })}></textarea>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button className="btn btn-light rounded-pill px-4" onClick={() => setDeleteLogTarget({ id: null, remark: '' })}>ยกเลิก</button>
                                <button className="btn btn-danger rounded-pill px-4 fw-bold" onClick={onDeleteLog}>ยืนยันการลบ</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminStockLogsPage;
