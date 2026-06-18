import { getCartCount } from '../utils/cart';

function AppNavbar({
    user,
    cart,
    isAdminView,
    setIsAdminView,
    adminPage,
    setAdminPage,
    onOpenCart,
    onOpenOrderHistory,
    onOpenProfile,
    onLogout,
}) {
    return (
        <nav className="app-navbar sticky-top">
            <div className="app-navbar-inner">
                <span className="app-brand">
                    CLOTHING <span>{user?.role === 'admin' ? 'ADMIN' : 'SHOP'}</span>
                </span>

                <div className="app-nav-actions">
                    {user?.role === 'admin' && (
                        <button
                            className={`nav-pill ${!isAdminView ? 'is-warning' : 'is-light'}`}
                            onClick={() => setIsAdminView(!isAdminView)}
                        >
                            {!isAdminView ? 'เข้าโหมด Admin' : 'ดูหน้าร้านค้า'}
                        </button>
                    )}

                    <button className="nav-pill is-light" onClick={onOpenCart}>
                        ตะกร้า ({getCartCount(cart)})
                    </button>

                    {user?.role !== 'admin' && (
                        <button className="nav-pill is-info" onClick={onOpenOrderHistory}>
                            ประวัติคำสั่งซื้อ
                        </button>
                    )}

                    {user?.role === 'admin' && isAdminView && (
                        <select className="nav-select" value={adminPage} onChange={(e) => setAdminPage(e.target.value)}>
                            <option value="dashboard">Dashboard</option>
                            <option value="add-product">เพิ่มสินค้า</option>
                            <option value="customers">ลูกค้า</option>
                            <option value="stock-logs">ประวัติสต็อก</option>
                        </select>
                    )}

                    <button className="nav-pill is-light" onClick={onOpenProfile}>
                        {user?.username || 'Guest'}
                    </button>

                    <button className="nav-pill is-danger" onClick={onLogout}>
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </nav>
    );
}

export default AppNavbar;
