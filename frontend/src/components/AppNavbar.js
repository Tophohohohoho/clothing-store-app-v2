import { useEffect, useMemo, useState } from 'react';
import { getCartCount } from '../utils/cart';

function AppNavbar({
    user,
    cart,
    isAdminView,
    authView,
    isCartOpen,
    isOrderHistoryOpen,
    isSalesHistoryOpen,
    isProfileOpen,
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const cartCount = getCartCount(cart);
    const displayName = user?.full_name || user?.username || 'Guest';
    const userInitials = String(displayName)
        .trim()
        .split(/\s+/)
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'G';
    const activeMenu = authView
        ? 'login'
        : isProfileOpen
            ? 'profile'
            : isSalesHistoryOpen
                ? 'sales'
                : isOrderHistoryOpen
                    ? 'orders'
                    : isCartOpen
                        ? 'cart'
                        : isAdminView
                            ? 'admin'
                            : 'store';

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') setIsMobileMenuOpen(false);
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        if (!isMobileMenuOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileMenuOpen]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [activeMenu]);

    const iconMap = {
        store: (
            <>
                <path d="M4 10.5 12 4l8 6.5" />
                <path d="M6.5 9.5V20h11V9.5" />
            </>
        ),
        admin: (
            <>
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13" y="4" width="7" height="4.5" rx="1.5" />
                <rect x="13" y="10.5" width="7" height="9.5" rx="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1.5" />
            </>
        ),
        cart: (
            <>
                <circle cx="9" cy="19" r="1.35" />
                <circle cx="17" cy="19" r="1.35" />
                <path d="M3.5 5h2l1.8 8.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.74L20 8H7.1" />
            </>
        ),
        orders: (
            <>
                <path d="M7 5.5h10" />
                <path d="M7 10.5h10" />
                <path d="M7 15.5h6" />
                <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
            </>
        ),
        sales: (
            <>
                <path d="M5 18h14" />
                <path d="M7.5 15V9.5" />
                <path d="M12 15V6" />
                <path d="M16.5 15v-3.5" />
            </>
        ),
        profile: (
            <>
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
            </>
        ),
        login: (
            <>
                <path d="M10 7V4.75A1.75 1.75 0 0 1 11.75 3h6.5A1.75 1.75 0 0 1 20 4.75v14.5A1.75 1.75 0 0 1 18.25 21h-6.5A1.75 1.75 0 0 1 10 19.25V17" />
                <path d="m13 8 4 4-4 4" />
                <path d="M4 12h13" />
            </>
        ),
        logout: (
            <>
                <path d="M10 7V4.75A1.75 1.75 0 0 1 11.75 3h6.5A1.75 1.75 0 0 1 20 4.75v14.5A1.75 1.75 0 0 1 18.25 21h-6.5A1.75 1.75 0 0 1 10 19.25V17" />
                <path d="m8 8-4 4 4 4" />
                <path d="M17 12H4" />
            </>
        ),
    };

    const navItems = useMemo(() => {
        const items = [{
            key: 'cart',
            label: 'ตะกร้า',
            icon: 'cart',
            onClick: onOpenCart,
            isActive: activeMenu === 'cart',
            badge: cartCount,
            show: true,
        }];

        if (isAdmin) {
            items.unshift({
                key: 'admin',
                label: isAdminView ? 'กลับหน้าร้าน' : 'Dashboard',
                icon: 'admin',
                onClick: isAdminView ? onOpenStore : onOpenAdmin,
                isActive: activeMenu === 'admin',
                show: true,
            });
        }

        if (isMember) {
            items.push({
                key: 'orders',
                label: 'คำสั่งซื้อ',
                icon: 'orders',
                onClick: onOpenOrderHistory,
                isActive: activeMenu === 'orders',
                show: true,
            });
        }

        if (isAdmin) {
            items.push({
                key: 'sales',
                label: 'ประวัติการขาย',
                icon: 'sales',
                onClick: onOpenSalesHistory,
                isActive: activeMenu === 'sales',
                show: true,
            });
        }

        if (!user) {
            items.push({
                key: 'login',
                label: 'เข้าสู่ระบบ',
                icon: 'login',
                onClick: onOpenLogin,
                isActive: activeMenu === 'login',
                show: true,
            });
        }

        return items.filter((item) => item.show);
    }, [
        activeMenu,
        cartCount,
        isAdmin,
        isAdminView,
        isMember,
        onOpenAdmin,
        onOpenCart,
        onOpenLogin,
        onOpenOrderHistory,
        onOpenSalesHistory,
        onOpenStore,
        user,
    ]);

    const renderIcon = (name) => (
        <span className="nav-pill-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                {iconMap[name]}
            </svg>
        </span>
    );

    const renderNavButton = (item) => (
        <button
            key={item.key}
            type="button"
            className={`nav-pill ${item.isActive ? 'is-active' : ''} is-light`}
            onClick={item.onClick}
            aria-current={item.isActive ? 'page' : undefined}
        >
            {renderIcon(item.icon)}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="nav-badge" aria-label={`${item.badge} รายการ`}>
                    {item.badge > 99 ? '99+' : item.badge}
                </span>
            )}
        </button>
    );

    return (
        <nav className="app-navbar sticky-top" aria-label="เมนูหลักของเว็บไซต์">
            <div className="app-navbar-inner">
                <div className="app-navbar-toprow">
                    <button type="button" className="app-brand" onClick={onOpenStore} aria-label="กลับไปหน้าร้าน">
                        <span className="app-brand-mark" aria-hidden="true">SL</span>
                        <span className="app-brand-copy">
                            <strong>SHOP LRU</strong>
                            <small>ร้านค้าตราสัญลักษณ์</small>
                        </span>
                    </button>

                    <div className={`app-navbar-panel ${isMobileMenuOpen ? 'is-open' : ''}`} id="app-navbar-panel">
                        <div className="app-nav-actions">
                            {navItems.map(renderNavButton)}

                            {user && (
                                <button type="button" className="nav-user-card" onClick={onOpenProfile}>
                                    <span className="nav-user-avatar" aria-hidden="true">{userInitials}</span>
                                    <span className="nav-user-meta">
                                        <strong>{displayName}</strong>
                                        <small>{isAdmin ? 'Administrator' : 'Member account'}</small>
                                    </span>
                                </button>
                            )}

                            {user && (
                                <button type="button" className="nav-pill is-danger" onClick={onLogout}>
                                    {renderIcon('logout')}
                                    <span>ออกจากระบบ</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        className={`nav-menu-toggle ${isMobileMenuOpen ? 'is-open' : ''}`}
                        onClick={() => setIsMobileMenuOpen((current) => !current)}
                        aria-expanded={isMobileMenuOpen}
                        aria-controls="app-navbar-panel"
                        aria-label={isMobileMenuOpen ? 'ปิดเมนูนำทาง' : 'เปิดเมนูนำทาง'}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>
            </div>
        </nav>
    );
}

export default AppNavbar;
