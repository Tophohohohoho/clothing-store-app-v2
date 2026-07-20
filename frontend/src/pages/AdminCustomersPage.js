import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../api/adminApi';
import { notify } from '../components/AppNotification';

const EMPTY_EDIT = { id: null, username: '', password: '', full_name: '', email: '', phone: '' };
const EMPTY_CREATE = { username: '', password: '', confirmPassword: '', full_name: '', email: '', phone: '', role: 'user' };
const STATUS = {
    0: ['ระงับการใช้งาน', 'suspended'],
    1: ['ใช้งาน', 'active'],
    2: ['รอการยืนยัน', 'pending'],
};
const money = (value) => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
const shortDate = (value) => value ? new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value)) : '-';
const initials = (customer) => String(customer.full_name || customer.username || 'U')
    .trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
const SORT_LABELS = {
    id: 'ID',
    name: 'ชื่อ',
    created_at: 'วันที่สมัคร',
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadFile = (content, fileName, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

function AdminCustomersPage({
    customers,
    customersLoading,
    customersMeta,
    currentUser,
    adminUserCreate,
    setAdminUserCreate,
    userEdit,
    setUserEdit,
    onCreateUser,
    onOpenCreateUser,
    onCloseCreateUser,
    onUpdateUser,
    onDeleteUser,
    onReactivateUser,
    onChangeRole,
    onLoadCustomers,
}) {
    const [searchText, setSearchText] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
    const loadRef = useRef(onLoadCustomers);

    useEffect(() => { loadRef.current = onLoadCustomers; }, [onLoadCustomers]);
    useEffect(() => {
        const timer = setTimeout(() => loadRef.current({
            page,
            limit: pageSize,
            search: searchText.trim() || undefined,
            role: roleFilter === 'all' ? undefined : roleFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            sort: sortConfig.key || undefined,
            order: sortConfig.key ? sortConfig.direction : undefined,
        }), 250);
        return () => clearTimeout(timer);
    }, [page, pageSize, roleFilter, searchText, sortConfig.direction, sortConfig.key, statusFilter]);
    useEffect(() => { setPage(1); }, [searchText, roleFilter, statusFilter, pageSize, sortConfig.direction, sortConfig.key]);

    const pagination = customersMeta?.pagination || {};
    const summary = customersMeta?.summary || {};
    const totalPages = Math.max(1, Number(pagination.total_pages || 1));
    const firstPage = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4));
    const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
    const currentQuery = {
        page, limit: pageSize, search: searchText.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        sort: sortConfig.key || undefined,
        order: sortConfig.key ? sortConfig.direction : undefined,
    };
    const toggleSort = (key) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };
    const sortHeader = (key) => (
        <button
            type="button"
            className={`member-sort-button ${sortConfig.key === key ? 'active' : ''}`}
            onClick={() => toggleSort(key)}
            aria-label={`เรียงตาม${SORT_LABELS[key]} ${sortConfig.key === key && sortConfig.direction === 'asc' ? 'จากมากไปน้อย' : 'จากน้อยไปมาก'}`}
        >
            {SORT_LABELS[key]} <span aria-hidden="true">{sortConfig.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
    );

    const editCustomer = (customer) => {
        setOpenMenuId(null);
        setUserEdit({
            id: customer.id,
            username: customer.username,
            password: '',
            full_name: customer.full_name || customer.username,
            email: customer.email || '',
            phone: customer.phone || '',
        });
    };

    const askConfirm = (type, customer) => {
        setOpenMenuId(null);
        setActionError('');
        setConfirmAction({ type, customer });
    };

    const runAction = async () => {
        setActionLoading(true);
        setActionError('');
        let result;
        if (confirmAction.type === 'role') {
            result = await onChangeRole(confirmAction.customer);
        } else if (confirmAction.type === 'reactivate') {
            result = await onReactivateUser(confirmAction.customer.id);
        } else {
            result = await onDeleteUser(confirmAction.customer.id);
        }
        if (result?.success) {
            setConfirmAction(null);
            await loadRef.current(currentQuery);
        } else {
            setActionError(result?.error || 'ดำเนินการไม่สำเร็จ');
        }
        setActionLoading(false);
    };

    const saveEdit = async () => {
        await onUpdateUser();
        await loadRef.current(currentQuery);
    };

    const exportCustomersReport = async (format) => {
        try {
            const response = await adminApi.getCustomers({
                ...currentQuery,
                page: 1,
                limit: 100,
            });
            const payload = response.data || {};
            const rows = Array.isArray(payload.items) ? payload.items : [];
            const total = Number(payload.pagination?.total || rows.length || 0);

            if (!rows.length) {
                notify({ type: 'warning', title: 'ไม่มีข้อมูล', message: 'ยังไม่มีผู้ใช้งานตามตัวกรองสำหรับพิมพ์รายงาน' });
                return;
            }

            if (total > rows.length) {
                notify({
                    type: 'warning',
                    title: 'รายงานบางส่วน',
                    message: `ระบบส่งออกรายงานสูงสุด ${rows.length} รายการต่อครั้ง จากทั้งหมด ${total.toLocaleString('th-TH')} รายการ`,
                });
            }

            const preparedRows = rows.map((customer) => {
                const status = STATUS[Number(customer.status_user)] || STATUS[2];
                return {
                    id: customer.id,
                    name: customer.full_name || customer.username || '-',
                    username: customer.username || '-',
                    email: customer.email || '-',
                    phone: customer.phone || '-',
                    role: customer.role === 'admin' ? 'Admin' : 'User',
                    status: status[0],
                    orders: Number(customer.total_orders || 0),
                    spent: Number(customer.total_spent || 0),
                    createdAt: shortDate(customer.created_at),
                };
            });

            const fileBase = `customers-report-${new Date().toISOString().slice(0, 10)}`;

            if (format === 'csv') {
                const csv = [
                    ['ID', 'ชื่อ', 'Username', 'อีเมล', 'เบอร์โทร', 'สิทธิ์', 'สถานะ', 'ออเดอร์', 'ยอดสะสม', 'วันที่สมัคร'],
                    ...preparedRows.map((row) => [
                        row.id,
                        row.name,
                        row.username,
                        row.email,
                        row.phone,
                        row.role,
                        row.status,
                        row.orders,
                        row.spent,
                        row.createdAt,
                    ]),
                ].map((line) => line.map(escapeCsv).join(',')).join('\n');
                downloadFile(`\uFEFF${csv}`, `${fileBase}.csv`, 'text/csv;charset=utf-8;');
                return;
            }

            if (format === 'excel') {
                const tableRows = preparedRows.map((row) => `
                    <tr>
                        <td>${escapeHtml(row.id)}</td>
                        <td>${escapeHtml(row.name)}</td>
                        <td>${escapeHtml(row.username)}</td>
                        <td>${escapeHtml(row.email)}</td>
                        <td>${escapeHtml(row.phone)}</td>
                        <td>${escapeHtml(row.role)}</td>
                        <td>${escapeHtml(row.status)}</td>
                        <td>${escapeHtml(row.orders)}</td>
                        <td>${escapeHtml(money(row.spent))}</td>
                        <td>${escapeHtml(row.createdAt)}</td>
                    </tr>
                `).join('');
                const html = `
                    <html>
                        <head><meta charset="utf-8" /></head>
                        <body>
                            <table border="1">
                                <thead>
                                    <tr><th>ID</th><th>ชื่อ</th><th>Username</th><th>อีเมล</th><th>เบอร์โทร</th><th>สิทธิ์</th><th>สถานะ</th><th>ออเดอร์</th><th>ยอดสะสม</th><th>วันที่สมัคร</th></tr>
                                </thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                        </body>
                    </html>
                `;
                downloadFile(`\uFEFF${html}`, `${fileBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
                return;
            }

            const popup = window.open('', '_blank', 'width=1200,height=820');
            if (!popup) {
                notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
                return;
            }
            const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
            const tableRows = preparedRows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.id)}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.username)}</td>
                    <td>${escapeHtml(row.email)}</td>
                    <td>${escapeHtml(row.phone)}</td>
                    <td>${escapeHtml(row.role)}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td>${escapeHtml(row.orders)}</td>
                    <td>${escapeHtml(money(row.spent))}</td>
                    <td>${escapeHtml(row.createdAt)}</td>
                </tr>
            `).join('');
            popup.document.write(`
                <!doctype html>
                <html lang="th">
                    <head>
                        <meta charset="utf-8" />
                        <title>รายงานผู้ใช้งาน</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                            h1 { margin: 0 0 8px; font-size: 24px; }
                            p { margin: 0 0 18px; color: #4b5563; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                            th { background: #f3f4f6; }
                            .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                            .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                            .primary { background: #111827; color: #fff; }
                            .secondary { background: #e5e7eb; color: #111827; }
                            @media print { .actions { display: none; } body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        <div class="actions">
                            <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                            <button class="secondary" onclick="window.close()">ปิด</button>
                        </div>
                        <h1>รายงานผู้ใช้งาน</h1>
                        <p>จำนวน ${escapeHtml(preparedRows.length)} รายการ • พิมพ์เมื่อ ${escapeHtml(printedAt)}</p>
                        <table>
                            <thead>
                                <tr><th>ID</th><th>ชื่อ</th><th>Username</th><th>อีเมล</th><th>เบอร์โทร</th><th>สิทธิ์</th><th>สถานะ</th><th>ออเดอร์</th><th>ยอดสะสม</th><th>วันที่สมัคร</th></tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </body>
                </html>
            `);
            popup.document.close();
        } catch (error) {
            notify({ type: 'error', title: 'ส่งออกรายงานไม่สำเร็จ', message: error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด' });
        }
    };

    return (
        <section className="member-dashboard">
            <header className="member-heading">
                <div>
                    <span>MEMBER MANAGEMENT</span>
                    <h4>จัดการผู้ใช้งาน</h4>
                    <p>ดูแลบัญชี สิทธิ์การเข้าถึง และข้อมูลผู้ใช้งานทั้งหมดในที่เดียว</p>
                </div>
                <div className="panel-export-buttons">
                    <button type="button" onClick={() => exportCustomersReport('csv')}>CSV</button>
                    <button type="button" onClick={() => exportCustomersReport('excel')}>Excel</button>
                    <button type="button" className="primary" onClick={() => exportCustomersReport('pdf')}>PDF</button>
                </div>
            </header>

            <div className="member-summary-grid">
                <article><b className="blue">👥</b><div><span>สมาชิกทั้งหมด</span><strong>{Number(summary.total_members || 0).toLocaleString()}</strong></div></article>
                <article><b className="red">A</b><div><span>Admin</span><strong>{Number(summary.total_admins || 0).toLocaleString()}</strong></div></article>
                <article><b className="cyan">U</b><div><span>User</span><strong>{Number(summary.total_users || 0).toLocaleString()}</strong></div></article>
                <article><b className="green">฿</b><div><span>ยอดซื้อรวมทั้งหมด</span><strong>{money(summary.total_spent)}</strong></div></article>
            </div>

            <div className="member-panel">
                <div className="member-toolbar">
                    <label className="member-search"><span>⌕</span><input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="ค้นหาชื่อ Username Email หรือเบอร์โทร" /></label>
                    <div className="member-toolbar-actions">
                        <button type="button" className="member-add-button" onClick={onOpenCreateUser}>เพิ่มสมาชิก</button>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="all">สิทธิ์ทั้งหมด</option><option value="admin">Admin</option><option value="user">User</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">สถานะทั้งหมด</option><option value="1">ใช้งาน</option><option value="0">ระงับการใช้งาน</option>
                        </select>
                    </div>
                </div>

                <div className="member-table-wrap">
                    <table className="member-table">
                        <thead><tr><th>{sortHeader('id')}</th><th>{sortHeader('name')}</th><th>สิทธิ์</th><th>สถานะบัญชี</th><th>ออเดอร์</th><th>ยอดสะสม</th><th>{sortHeader('created_at')}</th><th>จัดการ</th></tr></thead>
                        <tbody>
                            {customersLoading ? Array.from({ length: 5 }, (_, index) => (
                                <tr className="member-loading-row" key={index}><td colSpan="8"><i /></td></tr>
                            )) : customers.length ? customers.map((customer) => {
                                const status = STATUS[Number(customer.status_user)] || STATUS[2];
                                const protectedAdmin = Boolean(Number(customer.is_main_admin));
                                return (
                                    <tr key={customer.id}>
                                        <td data-label="ID"><strong>#{customer.id}</strong></td>
                                        <td data-label="ชื่อ"><div className="member-person">
                                            <div className={`member-avatar ${customer.role}`}>{initials(customer)}</div>
                                            <div><div className="member-name"><strong>{customer.full_name || customer.username}</strong>{protectedAdmin && <em>Admin หลัก</em>}{Number(currentUser?.id) === Number(customer.id) && <small>คุณ</small>}</div>
                                                <span>@{customer.username}</span>
                                                <small>{customer.email || 'ไม่มีอีเมล'} · {customer.phone || 'ไม่มีเบอร์โทร'}</small>
                                            </div>
                                        </div></td>
                                        <td data-label="สิทธิ์"><span className={`member-role ${customer.role}`}>{customer.role === 'admin' ? 'Admin' : 'User'}</span></td>
                                        <td data-label="สถานะ"><span className={`member-status ${status[1]}`}><i />{status[0]}</span></td>
                                        <td data-label="ออเดอร์"><strong>{Number(customer.total_orders || 0).toLocaleString()}</strong></td>
                                        <td data-label="ยอดสะสม" className="member-money">{money(customer.total_spent)}</td>
                                        <td data-label="วันที่สมัคร">{shortDate(customer.created_at)}</td>
                                        <td data-label="จัดการ"><div className="member-actions">
                                            <button className="member-dots" onClick={() => setOpenMenuId(openMenuId === customer.id ? null : customer.id)}>⋮</button>
                                            {openMenuId === customer.id && <div className="member-menu">
                                                <button onClick={() => editCustomer(customer)}>✎ แก้ไขข้อมูล</button>
                                                <button className="warning" disabled={protectedAdmin} onClick={() => askConfirm('role', customer)}>⇄ เปลี่ยนสิทธิ์</button>
                                                {Number(customer.status_user) === 0
                                                    ? <button className="success" disabled={protectedAdmin} onClick={() => askConfirm('reactivate', customer)}>✓ ยกเลิกการระงับ</button>
                                                    : <button className="danger" disabled={protectedAdmin} onClick={() => askConfirm('delete', customer)}>⌫ ระงับบัญชี</button>}
                                                {protectedAdmin && <small>บัญชีหลักได้รับการป้องกัน</small>}
                                            </div>}
                                        </div></td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="8"><div className="member-empty"><b>◎</b><h5>ไม่พบข้อมูลสมาชิก</h5><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p><button onClick={() => { setSearchText(''); setRoleFilter('all'); setStatusFilter('all'); }}>ล้างตัวกรอง</button></div></td></tr>}
                        </tbody>
                    </table>
                </div>

                <footer className="member-pagination-bar">
                    <label>แสดง <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option>10</option><option>20</option><option>50</option></select> รายการ จาก {Number(pagination.total || 0).toLocaleString()} รายการ</label>
                    <div><button disabled={page <= 1 || customersLoading} onClick={() => setPage(page - 1)}>‹</button>{pageNumbers.map((number) => <button className={number === page ? 'active' : ''} key={number} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page >= totalPages || customersLoading} onClick={() => setPage(page + 1)}>›</button></div>
                </footer>
            </div>

            {userEdit.id && <div className="member-modal-backdrop"><div className="member-edit-modal">
                <header><div><span>แก้ไขสมาชิก</span><h5>{userEdit.full_name || userEdit.username}</h5></div><button onClick={() => setUserEdit(EMPTY_EDIT)}>×</button></header>
                <div className="member-form">
                    <label><span>Username</span><input value={userEdit.username} disabled readOnly /></label>
                    <label><span>ชื่อ-นามสกุล</span><input value={userEdit.full_name} disabled readOnly /></label>
                    <label><span>อีเมล</span><input type="email" value={userEdit.email} onChange={(e) => setUserEdit({ ...userEdit, email: e.target.value })} /></label>
                    <label><span>เบอร์โทร</span><input value={userEdit.phone} onChange={(e) => setUserEdit({ ...userEdit, phone: e.target.value })} /></label>
                    <label className="wide"><span>รหัสผ่านใหม่</span><input type="password" placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน" value={userEdit.password} onChange={(e) => setUserEdit({ ...userEdit, password: e.target.value })} /></label>
                </div>
                <footer><button onClick={() => setUserEdit(EMPTY_EDIT)}>ยกเลิก</button><button className="primary" onClick={saveEdit}>บันทึกการเปลี่ยนแปลง</button></footer>
            </div></div>}

            {adminUserCreate?.isOpen && <div className="member-modal-backdrop"><div className="member-edit-modal">
                <header><div><span>เพิ่มสมาชิกใหม่</span><h5>สร้างบัญชีผู้ใช้งานจากแอดมิน</h5></div><button onClick={onCloseCreateUser}>×</button></header>
                <div className="member-form">
                    <label><span>Username</span><input value={adminUserCreate.form?.username || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), username: e.target.value } }))} /></label>
                    <label><span>ชื่อ-นามสกุล</span><input value={adminUserCreate.form?.full_name || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), full_name: e.target.value } }))} /></label>
                    <label><span>อีเมล</span><input type="email" value={adminUserCreate.form?.email || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), email: e.target.value } }))} /></label>
                    <label><span>เบอร์โทร</span><input value={adminUserCreate.form?.phone || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), phone: e.target.value } }))} /></label>
                    <label><span>รหัสผ่าน</span><input type="password" value={adminUserCreate.form?.password || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), password: e.target.value } }))} /></label>
                    <label><span>ยืนยันรหัสผ่าน</span><input type="password" value={adminUserCreate.form?.confirmPassword || ''} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), confirmPassword: e.target.value } }))} /></label>
                    <label className="wide"><span>สิทธิ์การใช้งาน</span><select value={adminUserCreate.form?.role || 'user'} onChange={(e) => setAdminUserCreate((current) => ({ ...current, form: { ...(current.form || EMPTY_CREATE), role: e.target.value } }))}><option value="user">User</option><option value="admin">Admin</option></select></label>
                </div>
                <footer><button onClick={onCloseCreateUser}>ยกเลิก</button><button className="primary" onClick={onCreateUser}>เพิ่มสมาชิก</button></footer>
            </div></div>}

            {confirmAction && <div className="member-modal-backdrop"><div className="member-confirm-modal">
                <b className={confirmAction.type}>{confirmAction.type === 'delete' ? '!' : confirmAction.type === 'reactivate' ? '✓' : '⇄'}</b>
                <h5>{confirmAction.type === 'delete'
                    ? 'ยืนยันการระงับบัญชี?'
                    : confirmAction.type === 'reactivate'
                        ? 'ยืนยันยกเลิกการระงับ?'
                        : 'ยืนยันการเปลี่ยนสิทธิ์?'}</h5>
                <p>{confirmAction.type === 'delete'
                    ? <>บัญชี <strong>{confirmAction.customer.username}</strong> จะไม่สามารถเข้าสู่ระบบได้</>
                    : confirmAction.type === 'reactivate'
                        ? <>บัญชี <strong>{confirmAction.customer.username}</strong> จะกลับมาเข้าสู่ระบบและใช้งานได้ตามปกติ</>
                        : <>User <strong>{confirmAction.customer.full_name || confirmAction.customer.username}</strong> จาก {confirmAction.customer.role === 'admin' ? 'Admin' : 'User'} เป็น {confirmAction.customer.role === 'admin' ? 'User' : 'Admin'}</>}</p>
                {actionError && <div className="member-action-error">{actionError}</div>}
                <footer><button disabled={actionLoading} onClick={() => setConfirmAction(null)}>ยกเลิก</button><button disabled={actionLoading} className={confirmAction.type} onClick={runAction}>{actionLoading ? 'กำลังดำเนินการ...' : 'ยืนยันดำเนินการ'}</button></footer>
            </div></div>}
        </section>
    );
}

export default AdminCustomersPage;
