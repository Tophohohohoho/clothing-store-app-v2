import { getCartCount } from '../utils/cart';

function AppNavbar({
    user,
    cart,
    isAdminView,
    onOpenStore,
    onOpenAdmin,
    onOpenCart,
    onOpenOrderHistory,
    onOpenSalesHistory,
    onOpenProfile,
    onOpenLogin,
    onLogout,
}) {
    const isAdmin = user?.role === 'admin';
    const isMember = Boolean(user) && !isAdmin;
    const isGuest = !user;

    return (
        <nav className="app-navbar sticky-top">
            <div className="app-navbar-inner">
                <span className="app-brand">
                    CLOTHING <span>{isAdmin ? 'ADMIN' : 'SHOP'}</span>
                </span>

                <div className="app-nav-actions">
                    {isGuest && (
                        <>
                            <button className="nav-pill is-light" onClick={onOpenStore}>
                                หน้าแรก
                            </button>
                        </>
                    )}

                    {isAdmin && (
                        <button
                            className={`nav-pill ${!isAdminView ? 'is-warning' : 'is-light'}`}
                            onClick={isAdminView ? onOpenStore : onOpenAdmin}
                        >
                            {!isAdminView ? 'Dashboard' : 'ดูหน้าร้านค้า'}
                        </button>
                    )}

                    <button className="nav-pill is-light" onClick={onOpenCart}>
                        ตะกร้า ({getCartCount(cart)})
                    </button>

                    {isMember && (
                        <button className="nav-pill is-info" onClick={onOpenOrderHistory}>
                            คำสั่งซื้อของฉัน
                        </button>
                    )}

                    {isAdmin && (
                        <button className="nav-pill is-info" onClick={onOpenSalesHistory}>
                            ประวัติการขาย
                        </button>
                    )}

                    {user ? (
                        <button className="nav-pill is-light" onClick={onOpenProfile}>
                            ข้อมูลส่วนตัว
                        </button>
                    ) : (
                        <>
                            <button className="nav-pill is-info" onClick={onOpenLogin}>
                                เข้าสู่ระบบ
                            </button>
                        </>
                    )}

                    {user && (
                        <button className="nav-pill is-danger" onClick={onLogout}>
                            ออกจากระบบ
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default AppNavbar;
