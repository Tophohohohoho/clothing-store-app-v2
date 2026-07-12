import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZES = [10, 20, 50, 100];
const DATE_PRESETS = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'today', label: 'วันนี้' },
    { value: '7', label: '7 วันล่าสุด' },
    { value: '30', label: '30 วันล่าสุด' },
    { value: 'month', label: 'เดือนนี้' },
    { value: 'year', label: 'ปีนี้' },
    { value: 'custom', label: 'กำหนดช่วงวันที่' },
];

const DEFAULT_FILTERS = {
    search: '',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    userFilter: 'all',
    typeFilter: 'all',
};

const getActivityType = (log, view) => {
    if (view === 'stock') {
        const quantity = Number(log.change_quantity ?? log.amount ?? log.quantity ?? 0);
        return quantity < 0 ? 'stock-out' : 'stock-in';
    }
    const text = `${log.action || ''}`.toLowerCase();
    if (text.includes('logout') || text.includes('ออกจากระบบ')) return 'logout';
    if (text.includes('login') || text.includes('เข้าสู่ระบบ')) return 'login';
    if (text.includes('ลบ') || text.includes('delete')) return 'delete';
    if (text.includes('เพิ่ม') || text.includes('สร้าง') || text.includes('create')) return 'create';
    if (text.includes('แก้') || text.includes('ปรับ') || text.includes('อัปเดต') || text.includes('update')) return 'update';
    return 'general';
};

const ACTIVITY_LABELS = {
    login: 'Login',
    logout: 'Logout',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    'stock-in': 'Stock In',
    'stock-out': 'Stock Out',
    general: 'ทั่วไป',
};

const formatDate = (value) => (value ? new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
}) : '-');

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const AUDIT_FIELD_LABELS = {
    product_id: 'รหัสสินค้า',
    before_quantity: 'จำนวนก่อนแก้ไข',
    change_type: 'ประเภทการเคลื่อนไหว',
    change_quantity: 'จำนวนที่เปลี่ยน',
    after_quantity: 'จำนวนหลังแก้ไข',
    reason: 'เหตุผล',
    order_id: 'รหัสคำสั่งซื้อ',
    order_detail_id: 'รหัสรายการสั่งซื้อ',
    user_id: 'รหัสผู้ใช้งาน',
    status: 'สถานะ',
    payment_status: 'สถานะการชำระเงิน',
    tracking_no: 'เลขพัสดุ',
    note: 'หมายเหตุ',
};

const formatAuditFieldValue = (key, value) => {
    if (value === null || value === undefined || String(value).trim() === '') return 'ไม่มีข้อมูล';
    if (typeof value === 'number') return value.toLocaleString('th-TH');
    if (key.includes('date') || key.includes('time')) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return formatDate(date);
    }
    return String(value);
};

const formatAuditJson = (value, fallback) => {
    if (!value) return fallback;

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return String(value);

        const lines = Object.entries(parsed)
            .filter(([key, item]) => !(key === 'reason' && String(item ?? '').trim() === ''))
            .map(([key, item]) => `${AUDIT_FIELD_LABELS[key] || key}: ${formatAuditFieldValue(key, item)}`);

        return lines.length > 0 ? lines.join('\n') : fallback;
    } catch {
        return String(value);
    }
};

function AdminStockLogsPage({ stockLogs = [], systemLogs = [], activityLogsLoading = false }) {
    const [activityView, setActivityView] = useState('stock');
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedLog, setSelectedLog] = useState(null);

    useEffect(() => {
        const storedView = sessionStorage.getItem('adminStockLogsView');
        if (storedView && ['stock', 'system'].includes(storedView)) {
            setActivityView(storedView);
            sessionStorage.removeItem('adminStockLogsView');
        }
    }, []);

    const rows = useMemo(() => (
        (activityView === 'stock' ? stockLogs : systemLogs).map((log) => ({
            ...log,
            auditType: getActivityType(log, activityView),
            auditDate: log.created_at || log.log_date,
            auditUser: log.actor_name || log.admin_name || log.full_name || log.username || 'ระบบ',
            auditProduct: log.product_name || '-',
            auditNote: log.reason || log.remark || '-',
            auditAmount: Number(log.change_quantity ?? log.amount ?? log.quantity ?? 0),
        }))
    ), [activityView, stockLogs, systemLogs]);

    const users = useMemo(() => [...new Set(rows.map((row) => row.auditUser))].sort((a, b) => a.localeCompare(b, 'th')), [rows]);
    const availableTypes = useMemo(() => [...new Set(rows.map((row) => row.auditType))], [rows]);

    const filteredRows = useMemo(() => {
        const { search, datePreset, dateFrom, dateTo, userFilter, typeFilter } = filters;
        const keyword = search.trim().toLowerCase();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let startDate = null;
        let endDate = null;

        if (datePreset === 'today') {
            startDate = startOfToday;
            endDate = endOfToday;
        }
        if (datePreset === '7' || datePreset === '30') {
            startDate = new Date(startOfToday);
            startDate.setDate(startDate.getDate() - Number(datePreset) + 1);
            endDate = endOfToday;
        }
        if (datePreset === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = endOfToday;
        }
        if (datePreset === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = endOfToday;
        }
        if (datePreset === 'custom') {
            startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
            endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
        }

        return rows.filter((row) => {
            const rowDate = row.auditDate ? new Date(row.auditDate) : null;
            const searchable = [
                row.auditUser,
                row.username,
                row.auditProduct,
                row.auditNote,
                row.action,
                row.change_type,
                ACTIVITY_LABELS[row.auditType],
            ].join(' ').toLowerCase();
            return (!keyword || searchable.includes(keyword))
                && (userFilter === 'all' || row.auditUser === userFilter)
                && (typeFilter === 'all' || row.auditType === typeFilter)
                && (!startDate || (rowDate && rowDate >= startDate))
                && (!endDate || (rowDate && rowDate <= endDate));
        }).sort((a, b) => {
            const direction = sort.direction === 'asc' ? 1 : -1;
            let left;
            let right;
            if (sort.key === 'date') {
                left = new Date(a.auditDate || 0).getTime();
                right = new Date(b.auditDate || 0).getTime();
            } else if (sort.key === 'user') {
                left = a.auditUser;
                right = b.auditUser;
            } else if (sort.key === 'amount') {
                left = a.auditAmount;
                right = b.auditAmount;
            } else {
                left = ACTIVITY_LABELS[a.auditType];
                right = ACTIVITY_LABELS[b.auditType];
            }
            return typeof left === 'string'
                ? left.localeCompare(right, 'th') * direction
                : (left - right) * direction;
        });
    }, [rows, filters, sort]);

    const summary = useMemo(() => {
        const today = new Date().toDateString();
        return {
            total: rows.length,
            stockIn: rows.filter((row) => row.auditType === 'stock-in').length,
            stockOut: rows.filter((row) => row.auditType === 'stock-out').length,
            users: new Set(rows.map((row) => row.auditUser)).size,
            today: rows.filter((row) => row.auditDate && new Date(row.auditDate).toDateString() === today).length,
        };
    }, [rows]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => setPage(1), [activityView, filters, pageSize]);
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const changeSort = (key) => {
        setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const sortMarker = (key) => (sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕');

    const exportRows = (format) => {
        const headers = activityView === 'stock'
            ? ['วันที่/เวลา', 'ผู้ใช้งาน', 'สินค้า', 'ประเภทกิจกรรม', 'จำนวนที่เปลี่ยน', 'เหตุผล']
            : ['วันที่/เวลา', 'ผู้ใช้งาน', 'บัญชี', 'สิทธิ์', 'ประเภทกิจกรรม', 'การทำงาน', 'หมายเหตุ'];
        const data = filteredRows.map((row) => (activityView === 'stock'
            ? [formatDate(row.auditDate), row.auditUser, row.auditProduct, ACTIVITY_LABELS[row.auditType], row.auditAmount, row.auditNote]
            : [formatDate(row.auditDate), row.auditUser, row.username || '-', row.role || '-', ACTIVITY_LABELS[row.auditType], row.action || '-', row.auditNote]));
        const filename = `${activityView === 'stock' ? 'stock-audit-log' : 'admin-audit-log'}-${new Date().toISOString().slice(0, 10)}`;

        if (format === 'pdf') {
            const popup = window.open('', '_blank', 'width=1100,height=750');
            if (!popup) return;
            popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${filename}</title>
                <style>body{font-family:Arial,sans-serif;padding:28px;color:#17202e}h2{margin:0 0 6px}p{color:#667085}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border:1px solid #dfe4ea;text-align:left}th{background:#f2f4f7}@page{size:landscape;margin:12mm}</style>
                </head><body><h2>Audit Log Report</h2><p>จำนวน ${data.length.toLocaleString('th-TH')} รายการ · ${new Date().toLocaleString('th-TH')}</p>
                <table><thead><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody>
                ${data.map((row) => `<tr>${row.map((item) => `<td>${String(item ?? '-').replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}
                </tbody></table></body></html>`);
            popup.document.close();
            popup.focus();
            popup.setTimeout(() => popup.print(), 100);
            return;
        }

        let blob;
        let extension;
        if (format === 'excel') {
            const html = `<html><head><meta charset="utf-8"></head><body><table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${data.map((row) => `<tr>${row.map((item) => `<td>${item ?? ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
            blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
            extension = 'xls';
        } else {
            const csv = [headers, ...data].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
            blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
            extension = 'csv';
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS);
    };

    const updateFilter = (key, value) => {
        setFilters((current) => ({
            ...current,
            [key]: value,
            ...(key === 'datePreset' && value !== 'custom' ? { dateFrom: '', dateTo: '' } : {}),
        }));
    };

    return (
        <section className="audit-dashboard">
            <header className="audit-heading">
                <div>
                    <span className="audit-eyebrow">AUDIT & COMPLIANCE</span>
                    <h4>ประวัติการเคลื่อนไหว</h4>
                    <p>ตรวจสอบประวัติการเปลี่ยนแปลงสต๊อกแบบถาวร พร้อมข้อมูลผู้ดำเนินการ ประเภทการเคลื่อนไหว เหตุผล วันที่เวลา และยอดก่อน-หลังการแก้ไข</p>
                </div>
                <div className="audit-export">
                    <button type="button" onClick={() => exportRows('csv')}>CSV</button>
                    <button type="button" onClick={() => exportRows('excel')}>Excel</button>
                    <button type="button" className="primary" onClick={() => exportRows('pdf')}>PDF</button>
                </div>
            </header>

            <div className="audit-summary-grid">
                <article><b className="purple">Σ</b><div><span>กิจกรรมทั้งหมด</span><strong>{summary.total.toLocaleString('th-TH')}</strong></div></article>
                <article><b className="green">↓</b><div><span>การรับเข้า</span><strong>{summary.stockIn.toLocaleString('th-TH')}</strong></div></article>
                <article><b className="red">↑</b><div><span>การขายออก</span><strong>{summary.stockOut.toLocaleString('th-TH')}</strong></div></article>
                <article><b className="blue">♙</b><div><span>ผู้ใช้งานที่เคลื่อนไหว</span><strong>{summary.users.toLocaleString('th-TH')}</strong></div></article>
                <article><b className="amber">◷</b><div><span>กิจกรรมวันนี้</span><strong>{summary.today.toLocaleString('th-TH')}</strong></div></article>
            </div>

            <div className="audit-panel">
                <div className="audit-panel-top">
                    <div className="admin-subtabs">
                        <button type="button" className={activityView === 'stock' ? 'active' : ''} onClick={() => setActivityView('stock')}>ประวัติสต็อก</button>
                        <button type="button" className={activityView === 'system' ? 'active' : ''} onClick={() => setActivityView('system')}>บันทึกแอดมิน</button>
                    </div>
                    <span className="audit-result-count">พบ {filteredRows.length.toLocaleString('th-TH')} รายการ</span>
                </div>

                <div className="audit-filters">
                    <label className="audit-search">
                        <span>⌕</span>
                        <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="ค้นหาผู้ใช้งาน สินค้า หมายเหตุ หรือกิจกรรม..." />
                    </label>
                    <select value={filters.datePreset} onChange={(event) => updateFilter('datePreset', event.target.value)} aria-label="เลือกช่วงวันที่">
                        {DATE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    {filters.datePreset === 'custom' && (
                        <div className="audit-custom-date">
                            <label>ตั้งแต่ <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
                            <label>ถึง <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
                        </div>
                    )}
                    <select value={filters.userFilter} onChange={(event) => updateFilter('userFilter', event.target.value)}>
                        <option value="all">ผู้ใช้งานทั้งหมด</option>
                        {users.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <select value={filters.typeFilter} onChange={(event) => updateFilter('typeFilter', event.target.value)}>
                        <option value="all">กิจกรรมทั้งหมด</option>
                        {availableTypes.map((type) => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}
                    </select>
                    <div className="audit-filter-actions">
                        <button type="button" className="audit-clear" onClick={clearFilters}>ล้างค่า</button>
                    </div>
                </div>

                <div className="audit-table-wrap">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th><button type="button" onClick={() => changeSort('date')}>วันที่/เวลา{sortMarker('date')}</button></th>
                                <th><button type="button" onClick={() => changeSort('user')}>ผู้ใช้งาน{sortMarker('user')}</button></th>
                                {activityView === 'stock' && <th>สินค้า</th>}
                                <th><button type="button" onClick={() => changeSort('type')}>ประเภทกิจกรรม{sortMarker('type')}</button></th>
                                {activityView === 'stock' && <th className="text-center"><button type="button" onClick={() => changeSort('amount')}>จำนวน{sortMarker('amount')}</button></th>}
                                {activityView === 'system' && <th>การทำงาน</th>}
                                <th>หมายเหตุ</th>
                                <th aria-label="รายละเอียด" />
                            </tr>
                        </thead>
                        <tbody>
                            {activityLogsLoading ? (
                                [...Array(6)].map((_, index) => (
                                    <tr key={`skeleton-${index}`} className="audit-skeleton-row">
                                        <td colSpan={activityView === 'stock' ? 7 : 6}><i /></td>
                                    </tr>
                                ))
                            ) : paginatedRows.length > 0 ? paginatedRows.map((log) => {
                                const outgoing = log.auditType === 'stock-out';
                                return (
                                    <tr key={`${activityView}-${log.id}`} onClick={() => setSelectedLog(log)}>
                                        <td><span className="audit-date">{formatDate(log.auditDate)}</span></td>
                                        <td>
                                            <strong>{log.auditUser}</strong>
                                            {log.username && log.username !== log.auditUser && <small>@{log.username}</small>}
                                        </td>
                                        {activityView === 'stock' && <td><strong>{log.auditProduct}</strong></td>}
                                        <td><span className={`audit-badge ${log.auditType}`}>{ACTIVITY_LABELS[log.auditType]}</span></td>
                                        {activityView === 'stock' && <td className={`audit-amount ${outgoing ? 'out' : 'in'}`}>{outgoing ? '-' : '+'}{Math.abs(log.auditAmount).toLocaleString('th-TH')}</td>}
                                        {activityView === 'system' && <td><strong>{log.action || '-'}</strong></td>}
                                        <td><span className="audit-note">{log.auditNote}</span></td>
                                        <td><button type="button" className="audit-detail-button" onClick={(event) => { event.stopPropagation(); setSelectedLog(log); }}>›</button></td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={activityView === 'stock' ? 7 : 6}>
                                        <div className="audit-empty">
                                            <b>⌕</b>
                                            <strong>ไม่พบประวัติการเคลื่อนไหวในช่วงวันที่นี้</strong>
                                            <span>ลองเปลี่ยนคำค้นหา ช่วงวันที่ หรือตัวกรองกิจกรรม</span>
                                            <button type="button" onClick={clearFilters}>ล้างค่า</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <footer className="audit-pagination">
                    <label>แสดง
                        <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                        รายการ
                    </label>
                    <span>
                        {filteredRows.length ? ((page - 1) * pageSize) + 1 : 0}–{Math.min(page * pageSize, filteredRows.length)} จาก {filteredRows.length.toLocaleString('th-TH')}
                    </span>
                    <div>
                        <button type="button" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                        <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>
                        <b>{page} / {totalPages}</b>
                        <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>›</button>
                        <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                    </div>
                </footer>
            </div>

            {selectedLog && (
                <div className="audit-modal-backdrop" role="presentation" onMouseDown={() => setSelectedLog(null)}>
                    <div className="audit-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
                        <header>
                            <div>
                                <span className={`audit-badge ${selectedLog.auditType}`}>{ACTIVITY_LABELS[selectedLog.auditType]}</span>
                                <h5>รายละเอียด Audit Log #{selectedLog.id}</h5>
                            </div>
                            <button type="button" onClick={() => setSelectedLog(null)}>×</button>
                        </header>
                        <div className="audit-modal-grid">
                            <div><span>ผู้ใช้งาน</span><strong>{selectedLog.auditUser}</strong></div>
                            <div><span>วันที่และเวลา</span><strong>{formatDate(selectedLog.auditDate)}</strong></div>
                            <div><span>IP Address</span><strong>{selectedLog.ip_address || 'ไม่มีข้อมูล'}</strong></div>
                            <div><span>เวลาใช้งาน</span><strong>{selectedLog.duration || selectedLog.session_duration || 'ไม่มีข้อมูล'}</strong></div>
                            <div><span>Device</span><strong>{selectedLog.device || 'ไม่มีข้อมูล'}</strong></div>
                            <div><span>Browser</span><strong>{selectedLog.browser || 'ไม่มีข้อมูล'}</strong></div>
                        </div>
                        {activityView === 'stock' && (
                            <>
                                <div className="audit-modal-highlight">
                                    <span>สินค้า</span>
                                    <strong>{selectedLog.auditProduct}</strong>
                                    <b className={selectedLog.auditType === 'stock-out' ? 'out' : 'in'}>
                                        {selectedLog.auditAmount < 0 ? '-' : '+'}
                                        {Math.abs(selectedLog.auditAmount).toLocaleString('th-TH')}
                                    </b>
                                </div>
                                <div className="audit-modal-grid">
                                    <div><span>ประเภท</span><strong>{selectedLog.change_type || '-'}</strong></div>
                                    <div><span>จำนวนก่อนแก้ไข</span><strong>{selectedLog.before_quantity ?? '-'}</strong></div>
                                    <div><span>จำนวนที่เปลี่ยน</span><strong>{selectedLog.change_quantity ?? selectedLog.auditAmount}</strong></div>
                                    <div><span>จำนวนหลังแก้ไข</span><strong>{selectedLog.after_quantity ?? '-'}</strong></div>
                                </div>
                            </>
                        )}
                        <div className="audit-change-grid">
                            <section><span>ข้อมูลก่อนแก้ไข</span><pre>{activityView === 'stock' ? (selectedLog.before_quantity ?? 'ไม่มีข้อมูลก่อนแก้ไข') : formatAuditJson(selectedLog.before_data || selectedLog.old_data, 'ไม่มีข้อมูลก่อนแก้ไข')}</pre></section>
                            <section><span>ข้อมูลหลังแก้ไข</span><pre>{activityView === 'stock' ? (selectedLog.after_quantity ?? 'ไม่มีข้อมูลหลังแก้ไข') : formatAuditJson(selectedLog.after_data || selectedLog.new_data, 'ไม่มีข้อมูลหลังแก้ไข')}</pre></section>
                        </div>
                        <div className="audit-modal-note"><span>หมายเหตุ</span><p>{selectedLog.auditNote}</p></div>
                        <footer><button type="button" onClick={() => setSelectedLog(null)}>ปิดหน้าต่าง</button></footer>
                    </div>
                </div>
            )}
        </section>
    );
}

export default AdminStockLogsPage;
