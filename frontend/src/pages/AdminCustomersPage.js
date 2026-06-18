import { useState } from 'react';

function AdminCustomersPage({
    customers,
    userEdit,
    setUserEdit,
    onUpdateUser,
    onDeleteUser,
    onChangeRole,
}) {
    const [searchText, setSearchText] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const normalizedSearch = searchText.trim().toLowerCase();
    const visibleCustomers = customers.filter((customer) => {
        const matchesRole = roleFilter === 'all' || customer.role === roleFilter;
        const matchesSearch = !normalizedSearch || [
            customer.id,
            customer.username,
            customer.full_name,
            customer.email,
            customer.phone,
            customer.role,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));

        return matchesRole && matchesSearch;
    });

    return (
        <div className="card border-0 shadow-sm rounded-4 p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <div>
                    <h4 className="fw-bold mb-1">ระบบจัดการสมาชิก</h4>
                    <small className="text-muted">ค้นหา แก้ไขข้อมูล และจัดการสิทธิ์สมาชิก</small>
                </div>
                <div className="admin-customer-tools">
                    <div className="admin-panel-tools">
                        <select
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                        </select>
                        <span>{visibleCustomers.length} สมาชิก</span>
                    </div>
                    <input
                        type="search"
                        className="form-control"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="ค้นหาสมาชิก"
                    />
                </div>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle">
                    <thead className="table-light text-muted small">
                        <tr>
                            <th>สมาชิก</th>
                            <th>สิทธิ์</th>
                            <th className="text-center">ออเดอร์</th>
                            <th className="text-end">ยอดสะสม</th>
                            <th className="text-center">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleCustomers.length > 0 ? (
                            visibleCustomers.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="fw-bold">{customer.full_name || customer.username}</div>
                                        <small className="text-muted d-block">บัญชี: {customer.username}</small>
                                        <small className="text-muted d-block">ID: #{customer.id}</small>
                                        {(customer.email || customer.phone) && (
                                            <small className="text-muted d-block">{customer.email || '-'} / {customer.phone || '-'}</small>
                                        )}
                                    </td>
                                    <td><span className={`badge ${customer.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>{customer.role}</span></td>
                                    <td className="text-center">{customer.total_orders}</td>
                                    <td className="text-end text-success fw-bold">฿{parseFloat(customer.total_spent || 0).toLocaleString()}</td>
                                    <td className="text-center">
                                        <button
                                            className="btn btn-sm btn-outline-primary me-2"
                                            onClick={() => setUserEdit({
                                                id: customer.id,
                                                username: customer.username,
                                                password: '',
                                                full_name: customer.full_name || customer.username,
                                                email: customer.email || '',
                                                phone: customer.phone || '',
                                            })}
                                        >
                                            แก้ไข
                                        </button>
                                        <button className="btn btn-sm btn-outline-warning me-2" onClick={() => onChangeRole(customer)}>สลับสิทธิ์</button>
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => onDeleteUser(customer.id, customer.username)}>ลบ</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="text-center text-muted py-4">
                                    ไม่พบสมาชิกที่ตรงกับคำค้นหา
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {userEdit.id && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 rounded-4 p-3 shadow-lg">
                            <div className="modal-header border-0">
                                <h5 className="fw-bold">แก้ไขข้อมูล: {userEdit.username}</h5>
                                <button className="btn-close" onClick={() => setUserEdit({ id: null, username: '', password: '', full_name: '', email: '', phone: '' })}></button>
                            </div>
                            <div className="modal-body">
                                <label className="small fw-bold">ชื่อผู้ใช้ใหม่</label>
                                <input type="text" className="form-control mb-3" value={userEdit.username} onChange={(e) => setUserEdit({ ...userEdit, username: e.target.value })} />
                                <label className="small fw-bold">ชื่อ-นามสกุล</label>
                                <input type="text" className="form-control mb-3" value={userEdit.full_name} onChange={(e) => setUserEdit({ ...userEdit, full_name: e.target.value })} />
                                <label className="small fw-bold">อีเมล</label>
                                <input type="email" className="form-control mb-3" value={userEdit.email} onChange={(e) => setUserEdit({ ...userEdit, email: e.target.value })} />
                                <label className="small fw-bold">เบอร์โทร</label>
                                <input type="tel" className="form-control mb-3" value={userEdit.phone} onChange={(e) => setUserEdit({ ...userEdit, phone: e.target.value })} />
                                <label className="small fw-bold">รหัสผ่านใหม่</label>
                                <input type="password" className="form-control" placeholder="ปล่อยว่างถ้าไม่ต้องการเปลี่ยน" onChange={(e) => setUserEdit({ ...userEdit, password: e.target.value })} />
                            </div>
                            <div className="modal-footer border-0">
                                <button className="btn btn-primary w-100 fw-bold py-2 rounded-pill" onClick={onUpdateUser}>บันทึกการเปลี่ยนแปลง</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminCustomersPage;
