import { useEffect, useRef, useState } from 'react';

const EMPTY_EDIT = { id: null, username: '', password: '', full_name: '', email: '', phone: '' };
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

function AdminCustomersPage({
    customers,
    customersLoading,
    customersMeta,
    currentUser,
    userEdit,
    setUserEdit,
    onUpdateUser,
    onDeleteUser,
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
    const loadRef = useRef(onLoadCustomers);

    useEffect(() => { loadRef.current = onLoadCustomers; }, [onLoadCustomers]);
    useEffect(() => {
        const timer = setTimeout(() => loadRef.current({
            page,
            limit: pageSize,
            search: searchText.trim() || undefined,
            role: roleFilter === 'all' ? undefined : roleFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
        }), 250);
        return () => clearTimeout(timer);
    }, [page, pageSize, roleFilter, searchText, statusFilter]);
    useEffect(() => { setPage(1); }, [searchText, roleFilter, statusFilter, pageSize]);

    const pagination = customersMeta?.pagination || {};
    const summary = customersMeta?.summary || {};
    const totalPages = Math.max(1, Number(pagination.total_pages || 1));
    const firstPage = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4));
    const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
    const currentQuery = {
        page, limit: pageSize, search: searchText.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
    };

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
        const result = confirmAction.type === 'role'
            ? await onChangeRole(confirmAction.customer)
            : await onDeleteUser(confirmAction.customer.id);
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

    return (
        <section className="member-dashboard">
            <header className="member-heading">
                <div>
                    <span>MEMBER MANAGEMENT</span>
                    <h4>ระบบจัดการสมาชิก</h4>
                    <p>ดูแลบัญชี สิทธิ์การเข้าถึง และข้อมูลลูกค้าทั้งหมดในที่เดียว</p>
                </div>
                <div className="member-sync"><i /> อัปเดตจากข้อมูลจริง</div>
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
                    <div>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="all">สิทธิ์ทั้งหมด</option><option value="admin">Admin</option><option value="user">User</option>
                        </select>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">สถานะทั้งหมด</option><option value="1">ใช้งาน</option><option value="0">ระงับการใช้งาน</option><option value="2">รอการยืนยัน</option>
                        </select>
                    </div>
                </div>

                <div className="member-table-wrap">
                    <table className="member-table">
                        <thead><tr><th>สมาชิก</th><th>สิทธิ์</th><th>สถานะบัญชี</th><th>ออเดอร์</th><th>ยอดสะสม</th><th>วันที่สมัคร</th><th>จัดการ</th></tr></thead>
                        <tbody>
                            {customersLoading ? Array.from({ length: 5 }, (_, index) => (
                                <tr className="member-loading-row" key={index}><td colSpan="7"><i /></td></tr>
                            )) : customers.length ? customers.map((customer) => {
                                const status = STATUS[Number(customer.status_user)] || STATUS[2];
                                const protectedAdmin = Boolean(Number(customer.is_main_admin));
                                return (
                                    <tr key={customer.id}>
                                        <td data-label="สมาชิก"><div className="member-person">
                                            <div className={`member-avatar ${customer.role}`}>{initials(customer)}</div>
                                            <div><div className="member-name"><strong>{customer.full_name || customer.username}</strong>{protectedAdmin && <em>Admin หลัก</em>}{Number(currentUser?.id) === Number(customer.id) && <small>คุณ</small>}</div>
                                                <span>@{customer.username} · ID #{customer.id}</span>
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
                                                <button className="danger" disabled={protectedAdmin} onClick={() => askConfirm('delete', customer)}>⌫ ระงับบัญชี</button>
                                                {protectedAdmin && <small>บัญชีหลักได้รับการป้องกัน</small>}
                                            </div>}
                                        </div></td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="7"><div className="member-empty"><b>◎</b><h5>ไม่พบข้อมูลสมาชิก</h5><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p><button onClick={() => { setSearchText(''); setRoleFilter('all'); setStatusFilter('all'); }}>ล้างตัวกรอง</button></div></td></tr>}
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
                    <label><span>Username</span><input value={userEdit.username} onChange={(e) => setUserEdit({ ...userEdit, username: e.target.value })} /></label>
                    <label><span>ชื่อ-นามสกุล</span><input value={userEdit.full_name} onChange={(e) => setUserEdit({ ...userEdit, full_name: e.target.value })} /></label>
                    <label><span>อีเมล</span><input type="email" value={userEdit.email} onChange={(e) => setUserEdit({ ...userEdit, email: e.target.value })} /></label>
                    <label><span>เบอร์โทร</span><input value={userEdit.phone} onChange={(e) => setUserEdit({ ...userEdit, phone: e.target.value })} /></label>
                    <label className="wide"><span>รหัสผ่านใหม่</span><input type="password" placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน" value={userEdit.password} onChange={(e) => setUserEdit({ ...userEdit, password: e.target.value })} /></label>
                </div>
                <footer><button onClick={() => setUserEdit(EMPTY_EDIT)}>ยกเลิก</button><button className="primary" onClick={saveEdit}>บันทึกการเปลี่ยนแปลง</button></footer>
            </div></div>}

            {confirmAction && <div className="member-modal-backdrop"><div className="member-confirm-modal">
                <b className={confirmAction.type}>{confirmAction.type === 'delete' ? '!' : '⇄'}</b>
                <h5>{confirmAction.type === 'delete' ? 'ยืนยันการระงับบัญชี?' : 'ยืนยันการเปลี่ยนสิทธิ์?'}</h5>
                <p>{confirmAction.type === 'delete'
                    ? <>บัญชี <strong>{confirmAction.customer.username}</strong> จะไม่สามารถเข้าสู่ระบบได้</>
                    : <>เปลี่ยน <strong>{confirmAction.customer.username}</strong> เป็น {confirmAction.customer.role === 'admin' ? 'User' : 'Admin'}</>}</p>
                {actionError && <div className="member-action-error">{actionError}</div>}
                <footer><button disabled={actionLoading} onClick={() => setConfirmAction(null)}>ยกเลิก</button><button disabled={actionLoading} className={confirmAction.type} onClick={runAction}>{actionLoading ? 'กำลังดำเนินการ...' : 'ยืนยันดำเนินการ'}</button></footer>
            </div></div>}
        </section>
    );
}

export default AdminCustomersPage;
