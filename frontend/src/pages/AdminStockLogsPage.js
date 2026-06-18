import { useState } from 'react';

function AdminStockLogsPage({ stockLogs, systemLogs = [] }) {
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
                    <table className="table table-hover align-middle activity-table stock-log-table">
                        <colgroup>
                            <col className="activity-date-col" />
                            <col className="activity-product-col" />
                            <col className="activity-user-col" />
                            <col className="activity-amount-col" />
                            <col className="activity-note-col" />
                        </colgroup>
                        <thead className="table-light text-muted small">
                            <tr>
                                <th className="activity-date-col">วันที่/เวลา</th>
                                <th className="activity-product-col">สินค้า</th>
                                <th className="activity-user-col">ผู้ทำรายการ</th>
                                <th className="activity-amount-col text-center">จำนวน</th>
                                <th className="activity-note-col">หมายเหตุ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockLogs.length > 0 ? (
                                stockLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="small">{formatDate(log.created_at)}</td>
                                        <td><strong>{log.product_name}</strong></td>
                                        <td><span className="badge bg-light text-dark border">{log.admin_name || log.username || 'ไม่ระบุ'}</span></td>
                                        <td className="text-center fw-bold">
                                            <span className={log.amount >= 0 ? 'text-success' : 'text-danger'}>{log.amount > 0 ? `+${log.amount}` : log.amount}</span>
                                        </td>
                                        <td className="small text-muted">{log.remark}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center text-muted py-4">ยังไม่มีประวัติสต็อก</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activityView === 'system' && (
                <div className="table-responsive">
                    <table className="table table-hover align-middle activity-table system-log-table">
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

        </div>
    );
}

export default AdminStockLogsPage;
