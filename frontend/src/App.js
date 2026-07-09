import React, { useCallback, useEffect, useRef, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import * as authApi from './api/authApi';
import * as productsApi from './api/productsApi';
import * as adminApi from './api/adminApi';
import * as ordersApi from './api/ordersApi';
import AppNavbar from './components/AppNavbar';
import CartModal from './components/CartModal';
import CheckoutModal from './components/CheckoutModal';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import PosCheckoutModal from './components/PosCheckoutModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import ProfileModal from './components/ProfileModal';
import StockEditModal from './components/StockEditModal';
import AppNotificationHost, { confirmNotification, notify } from './components/AppNotification';
import AdminPage from './pages/AdminPage';
import AdminOrderPrintPage from './pages/AdminOrderPrintPage';
import AuthPage from './pages/AuthPage';
import StorePage from './pages/StorePage';
import { getCartItemKey, getCartTotal } from './utils/cart';

const AUTH_STORAGE_KEY = 'clothingStoreUser';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:0[689]\d{8}|\+66[689]\d{8})$/;

const getStoredUser = () => {
    const savedUser = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
};

const emptyProduct = {
    name: '',
    description: '',
    price: '',
    image_url: '',
    image_data: '',
    image_preview: '',
    image_name: '',
    stock: '',
    stock_remark: 'สต็อกเริ่มต้น',
    category_id: '',
    category_name: 'ทั่วไป',
};

const emptyAddress = {
    address_id: null,
    receiver_name: '',
    phone: '',
    address_detail: '',
    subdistrict: '',
    district: '',
    province: '',
    postal_code: '',
    address_type: 'บ้าน',
    is_default: 1,
};

const DELIVERY_FEE = 50;
const PUBLIC_PAGES = ['home', 'products', 'product-detail', 'cart', 'login', 'register'];
const MEMBER_PAGES = ['checkout', 'payment', 'orders', 'order-detail', 'profile'];
const ADMIN_PAGES = ['admin-dashboard', 'admin-products', 'admin-categories', 'admin-stock', 'admin-orders', 'pos', 'sales-report', 'admin-users', 'admin-logs'];
const MEMBER_ROLES = ['member', 'customer', 'user'];

const isAdminUser = (currentUser) => currentUser?.role === 'admin';
const isMemberUser = (currentUser) => MEMBER_ROLES.includes(currentUser?.role);
const cleanPhone = (value) => String(value || '').trim().replace(/[\s-]/g, '');

const getRegisterValidationMessage = (form) => {
    if (!form.username.trim()) return 'กรุณากรอกชื่อผู้ใช้';
    if (!form.full_name.trim()) return 'กรุณากรอกชื่อ-นามสกุล';
    if (!form.email.trim()) return 'กรุณากรอกอีเมล';
    if (!EMAIL_REGEX.test(form.email.trim())) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (!form.phone.trim()) return 'กรุณากรอกเบอร์โทร';
    if (!PHONE_REGEX.test(cleanPhone(form.phone))) return 'รูปแบบเบอร์โทรไม่ถูกต้อง';
    if (!form.password) return 'กรุณากรอกรหัสผ่าน';
    if (form.password.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    if (!form.confirmPassword) return 'กรุณากรอกยืนยันรหัสผ่าน';
    if (form.password !== form.confirmPassword) return 'รหัสผ่านไม่ตรงกัน';
    return '';
};

const getAddressValidationMessage = (address) => {
    if (!address.receiver_name.trim()) return 'กรุณากรอกชื่อผู้รับ';
    if (!address.phone.trim()) return 'กรุณากรอกเบอร์โทรผู้รับ';
    if (!PHONE_REGEX.test(cleanPhone(address.phone))) return 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง';
    if (!address.address_detail.trim()) return 'กรุณากรอกที่อยู่';
    if (!address.province.trim()) return 'กรุณาเลือกจังหวัด';
    if (!address.district.trim()) return 'กรุณาเลือกอำเภอ/เขต';
    if (!address.subdistrict.trim()) return 'กรุณาเลือกตำบล/แขวง';
    if (!String(address.postal_code || '').trim()) return 'กรุณาเลือกรหัสไปรษณีย์';
    if (!address.address_type.trim()) return 'กรุณากรอกประเภทที่อยู่';
    return '';
};

const canAccessPage = (page, currentUser) => {
    if (PUBLIC_PAGES.includes(page)) return true;
    if (page === 'profile') return Boolean(currentUser);
    if (MEMBER_PAGES.includes(page)) return Boolean(currentUser) && isMemberUser(currentUser);
    if (ADMIN_PAGES.includes(page)) return Boolean(currentUser) && isAdminUser(currentUser);
    return false;
};

const getPrintOrderIdsFromLocation = () => {
    const batchMatch = window.location.pathname.match(/^\/admin\/orders\/print\/?$/);
    if (batchMatch) {
        return new URLSearchParams(window.location.search)
            .get('ids')
            ?.split(',')
            .map((id) => id.trim())
            .filter(Boolean) || [];
    }

    const match = window.location.pathname.match(/^\/admin\/orders\/([^/]+)\/print\/?$/);
    return match ? [decodeURIComponent(match[1])] : [];
};

function SiteFooter({ contact, onOpenStore }) {
    const phone = contact?.phone || 'ยังไม่ได้ระบุ';
    const email = contact?.email || 'ยังไม่ได้ระบุ';

    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <div className="site-footer-grid">
                    <section className="site-footer-section" aria-labelledby="footer-contact">
                        <h2 id="footer-contact">ติดต่อเรา</h2>
                        <p>โทร {phone}</p>
                        <p>อีเมล {email}</p>
                    </section>

                    <section className="site-footer-section" aria-labelledby="footer-menu">
                        <h2 id="footer-menu">เมนูสำคัญ</h2>
                        <button type="button" onClick={onOpenStore}>หน้าแรก</button>
                        <button type="button" onClick={onOpenStore}>สินค้า</button>
                    </section>

                    <section className="site-footer-section" aria-labelledby="footer-social">
                        <h2 id="footer-social">โซเชียล</h2>
                        <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a>
                        <a href="https://line.me/" target="_blank" rel="noreferrer">LINE</a>
                    </section>

                    <section className="site-footer-section" aria-labelledby="footer-info">
                        <h2 id="footer-info">ข้อมูลเพิ่มเติม</h2>
                        <button type="button">นโยบายความเป็นส่วนตัว</button>
                    </section>
                </div>

                <div className="site-footer-bottom">
                    © 2026 CLOTHING SHOP All rights reserved.
                </div>
            </div>
        </footer>
    );
}

const formatOrderCode = (orderId) => {
    const year = new Date().getFullYear();
    const cleanId = Number(orderId) || 0;
    return `#ORD-${year}-${String(cleanId).padStart(4, '0')}`;
};

function OrderSuccessModal({ orderId, onViewOrder, onContinueShopping }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onContinueShopping();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onContinueShopping]);

    return (
        <div className="order-success-backdrop" role="presentation" onMouseDown={onContinueShopping}>
            <section
                className="order-success-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-success-title"
                aria-describedby="order-success-description"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="order-success-icon" aria-hidden="true">✓</div>
                <h2 id="order-success-title">สั่งซื้อสำเร็จ</h2>
                <p id="order-success-description">ขอบคุณสำหรับการสั่งซื้อ ระบบได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว</p>
                <div className="order-success-code">
                    <span>เลขคำสั่งซื้อ</span>
                    <strong>{formatOrderCode(orderId)}</strong>
                </div>
                <div className="order-success-actions">
                    <button type="button" className="order-success-button primary" onClick={onViewOrder}>
                        ดูคำสั่งซื้อ
                    </button>
                    <button type="button" className="order-success-button secondary" onClick={onContinueShopping}>
                        เลือกซื้อสินค้าต่อ
                    </button>
                </div>
            </section>
        </div>
    );
}

function CancelOrderConfirmModal({ orderId, isSubmitting, onClose, onConfirm }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isSubmitting) onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSubmitting, onClose]);

    return (
        <div className="cancel-order-backdrop" role="presentation" onMouseDown={() => !isSubmitting && onClose()}>
            <section
                className="cancel-order-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-order-title"
                aria-describedby="cancel-order-description"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="cancel-order-icon" aria-hidden="true">!</div>
                <div>
                    <span className="cancel-order-eyebrow">Cancel order</span>
                    <h2 id="cancel-order-title">ยืนยันการยกเลิกคำสั่งซื้อ</h2>
                    <p id="cancel-order-description">
                        คุณต้องการยกเลิกคำสั่งซื้อ #{orderId} ใช่หรือไม่?<br />
                        การดำเนินการนี้ไม่สามารถย้อนกลับได้
                    </p>
                </div>
                <div className="cancel-order-actions">
                    <button type="button" className="cancel-order-secondary" onClick={onClose} disabled={isSubmitting}>
                        ไม่ยกเลิก
                    </button>
                    <button type="button" className="cancel-order-danger" onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function DeleteOrderConfirmModal({ orderId, isSubmitting, onClose, onConfirm }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isSubmitting) onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSubmitting, onClose]);

    return (
        <div className="cancel-order-backdrop delete-order-backdrop" role="presentation" onMouseDown={() => !isSubmitting && onClose()}>
            <section
                className="cancel-order-modal delete-order-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-order-title"
                aria-describedby="delete-order-description"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="cancel-order-icon delete-order-icon" aria-hidden="true">!</div>
                <div>
                    <span className="cancel-order-eyebrow delete-order-eyebrow">Delete order</span>
                    <h2 id="delete-order-title">ยืนยันการลบคำสั่งซื้อ</h2>
                    <p id="delete-order-description">
                        คุณต้องการลบคำสั่งซื้อ #{orderId} ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                </div>
                <div className="cancel-order-actions delete-order-actions">
                    <button type="button" className="cancel-order-secondary" onClick={onClose} disabled={isSubmitting}>
                        ยกเลิก
                    </button>
                    <button type="button" className="cancel-order-danger" onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'กำลังลบ...' : 'ลบคำสั่งซื้อ'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function OrderStatusConfirmModal({ orderId, status, isSubmitting, onClose, onConfirm }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isSubmitting) onClose();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSubmitting, onClose]);

    return (
        <div className="cancel-order-backdrop order-status-backdrop" role="presentation" onMouseDown={() => !isSubmitting && onClose()}>
            <section
                className="cancel-order-modal order-status-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-status-title"
                aria-describedby="order-status-description"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="cancel-order-icon order-status-icon" aria-hidden="true">✓</div>
                <div>
                    <span className="cancel-order-eyebrow order-status-eyebrow">Update status</span>
                    <h2 id="order-status-title">ยืนยันการเปลี่ยนสถานะ</h2>
                    <p id="order-status-description">
                        คุณต้องการเปลี่ยนสถานะออเดอร์ #{orderId} เป็น "{status}" ใช่หรือไม่?
                    </p>
                </div>
                <div className="cancel-order-actions order-status-actions">
                    <button type="button" className="cancel-order-secondary" onClick={onClose} disabled={isSubmitting}>
                        ยกเลิก
                    </button>
                    <button type="button" className="cancel-order-danger order-status-confirm" onClick={onConfirm} disabled={isSubmitting}>
                        {isSubmitting ? 'กำลังอัปเดต...' : 'ยืนยัน'}
                    </button>
                </div>
            </section>
        </div>
    );
}

function OrderToast({ toast, onClose }) {
    if (!toast?.message) return null;

    return (
        <div className={`order-toast ${toast.type || 'success'}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live="polite">
            <span className="order-toast-icon" aria-hidden="true">{toast.type === 'error' ? '!' : '✓'}</span>
            <strong>{toast.message}</strong>
            <button type="button" onClick={onClose} aria-label="ปิดการแจ้งเตือน">×</button>
        </div>
    );
}

function App() {
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedCartKeys, setSelectedCartKeys] = useState([]);
    const [user, setUser] = useState(() => {
        try {
            return getStoredUser();
        } catch (err) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
        }
    });
    const [isRegisterView, setIsRegisterView] = useState(false);
    const [authView, setAuthView] = useState(null);
    const [pendingAuthAction, setPendingAuthAction] = useState(null);
    const [isAdminView, setIsAdminView] = useState(false);
    const [adminPage, setAdminPage] = useState('dashboard');
    const [previewProductId, setPreviewProductId] = useState(null);
    const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
    const [storeContact, setStoreContact] = useState({ full_name: '', email: '', phone: '' });

    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [rememberLogin, setRememberLogin] = useState(() => Boolean(localStorage.getItem(AUTH_STORAGE_KEY)));
    const [registerForm, setRegisterForm] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        email: '',
        phone: '',
        privacyNoticeAcknowledged: false,
        consentAnalytics: false,
    });
    const [loginError, setLoginError] = useState('');
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [registerMsg, setRegisterMsg] = useState({ type: '', text: '' });

    const [adminOrders, setAdminOrders] = useState([]);
    const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [customersMeta, setCustomersMeta] = useState({
        pagination: { page: 1, limit: 10, total: 0, total_pages: 1 },
        summary: { total_members: 0, total_admins: 0, total_users: 0, total_spent: 0 },
    });
    const [stockLogs, setStockLogs] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [activityLogsLoading, setActivityLogsLoading] = useState(false);
    const [orderHistory, setOrderHistory] = useState([]);

    const [newProduct, setNewProduct] = useState(emptyProduct);
    const [editProduct, setEditProduct] = useState({ id: null, name: '', price: 0, description: '' });
    const [stockEdit, setStockEdit] = useState({
        id: null,
        amount: '',
        reason: '',
        changeType: 'รับสินค้าเข้า',
        adjustmentMode: 'increase',
        currentStock: 0,
        name: '',
    });
    const [userEdit, setUserEdit] = useState({ id: null, username: '', password: '', full_name: '', email: '', phone: '' });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showPosCheckout, setShowPosCheckout] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showOrderSuccess, setShowOrderSuccess] = useState(false);
    const [successOrderId, setSuccessOrderId] = useState(null);
    const [cancelOrderRequest, setCancelOrderRequest] = useState(null);
    const [isCancellingOrder, setIsCancellingOrder] = useState(false);
    const [deleteOrderRequest, setDeleteOrderRequest] = useState(null);
    const [isDeletingOrder, setIsDeletingOrder] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [pendingOrderId, setPendingOrderId] = useState(null);
    const [pendingStatus, setPendingStatus] = useState('');
    const [pendingTrackingNo, setPendingTrackingNo] = useState('');
    const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
    const [orderToast, setOrderToast] = useState({ type: '', message: '' });
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
    const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileUsername, setProfileUsername] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [profileFullName, setProfileFullName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [addresses, setAddresses] = useState([]);
    const [addressForm, setAddressForm] = useState(emptyAddress);
    const orderStatusResolverRef = useRef(null);
    const [shippingInfo, setShippingInfo] = useState({
        address_id: null,
        receiver_name: '',
        address: '',
        phone: '',
        subdistrict: '',
        district: '',
        province: '',
        postal_code: '',
        shipping_fee: DELIVERY_FEE,
        discount: 0,
        payment_method: 'โอนเงินผ่านธนาคาร',
        shipping_method: 'ส่งสินค้า',
        receipt_image_data: '',
        receipt_file_name: '',
        receipt_file_size: 0,
    });

    const selectedCartItems = cart.filter((item) => selectedCartKeys.includes(getCartItemKey(item)));
    const total = getCartTotal(selectedCartItems);
    const printOrderIds = getPrintOrderIdsFromLocation();
    const showOrderToast = useCallback((type, message) => {
        setOrderToast({ type, message });
    }, []);
    const findActiveCategory = useCallback((categoryId, categoryName) => {
        const cleanName = String(categoryName || '').trim();
        return categories.find((category) => (
            Number(category.status_category ?? 1) === 1
            && (
                (categoryId && String(category.category_id) === String(categoryId))
                || (cleanName && category.category_name === cleanName)
            )
        ));
    }, [categories]);

    const fetchProducts = useCallback(async (includeInactive = false) => {
        setProductsLoading(true);
        try {
            const res = await productsApi.getProducts('', includeInactive);
            const list = Array.isArray(res.data) ? res.data : [];
            setProducts(list);
            return list;
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setProductsLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async (includeInactive = false) => {
        try {
            const res = await productsApi.getCategories(includeInactive);
            const list = Array.isArray(res.data) ? res.data : [];
            setCategories(list);
            return list;
        } catch (err) {
            console.error(err);
            setCategories([]);
            return [];
        }
    }, []);

    const fetchAdminOrders = async () => {
        setAdminOrdersLoading(true);
        try {
            const res = await adminApi.getAdminOrders();
            const list = Array.isArray(res.data) ? res.data : [];
            setAdminOrders(list);
            return list;
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setAdminOrdersLoading(false);
        }
    };

    const fetchCustomers = async (params = {}) => {
        setCustomersLoading(true);
        try {
            const res = await adminApi.getCustomers(params);
            const payload = res.data || {};
            setCustomers(Array.isArray(payload.items) ? payload.items : []);
            setCustomersMeta({
                pagination: payload.pagination || { page: 1, limit: 10, total: 0, total_pages: 1 },
                summary: payload.summary || { total_members: 0, total_admins: 0, total_users: 0, total_spent: 0 },
            });
        } catch (err) {
            console.error(err);
            setCustomers([]);
        } finally {
            setCustomersLoading(false);
        }
    };

    const fetchStockLogs = async () => {
        try {
            const res = await adminApi.getStockLogs();
            setStockLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSystemLogs = async () => {
        try {
            const res = await adminApi.getSystemLogs();
            setSystemLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setSystemLogs([]);
        }
    };

    const fetchOrderHistory = async () => {
        if (!user?.username) return;

        try {
            const res = await ordersApi.getOrderHistory(user.username);
            setOrderHistory(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setOrderHistory([]);
        }
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, [fetchProducts, fetchCategories]);

    useEffect(() => {
        authApi.getStoreContact()
            .then((res) => setStoreContact(res.data || { full_name: '', email: '', phone: '' }))
            .catch((err) => console.error('โหลดข้อมูลติดต่อร้านไม่สำเร็จ', err));
    }, []);

    useEffect(() => {
        const cartKeys = cart.map((item) => getCartItemKey(item));
        setSelectedCartKeys((currentKeys) => {
            const currentSet = new Set(currentKeys);
            const nextKeys = currentKeys.filter((key) => cartKeys.includes(key));
            cartKeys.forEach((key) => {
                if (!currentSet.has(key)) nextKeys.push(key);
            });
            return nextKeys;
        });
    }, [cart]);

    useEffect(() => {
        if (!orderToast.message) return undefined;
        const timer = window.setTimeout(() => {
            setOrderToast({ type: '', message: '' });
        }, 3200);
        return () => window.clearTimeout(timer);
    }, [orderToast.message]);

    useEffect(() => {
        fetchProducts(isAdminView);
        fetchCategories(isAdminView);
    }, [fetchProducts, fetchCategories, isAdminView]);

    useEffect(() => {
        if (!isAdminView) return;

        if (!canAccessPage('admin-dashboard', user)) {
            if (!user) {
                setIsRegisterView(false);
                setAuthView('login');
                setPendingAuthAction('admin-dashboard');
            }
            setIsAdminView(false);
            return;
        }

        if (adminPage === 'admin-orders') fetchAdminOrders();
        if (adminPage === 'customers') fetchCustomers();
        if (adminPage === 'stock-logs') {
            setActivityLogsLoading(true);
            Promise.all([fetchStockLogs(), fetchSystemLogs()])
                .finally(() => setActivityLogsLoading(false));
        }
    }, [isAdminView, adminPage, user]);

    const handleLogin = async (event) => {
        event.preventDefault();
        if (isLoginLoading) return;

        setIsLoginLoading(true);
        setLoginError('');
        try {
            const res = await authApi.login(loginForm);
            if (res.data.success) {
                const loggedInUser = res.data.user;
                setUser(loggedInUser);
                setSessionStartedAt(Date.now());
                const storage = rememberLogin ? localStorage : sessionStorage;
                const otherStorage = rememberLogin ? sessionStorage : localStorage;
                storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
                otherStorage.removeItem(AUTH_STORAGE_KEY);
                setLoginError('');
                setAuthView(null);

                if (isAdminUser(loggedInUser)) {
                    setIsAdminView(true);
                    setAdminPage('dashboard');
                } else {
                    setIsAdminView(false);
                }

                if (pendingAuthAction === 'checkout' && !isAdminUser(loggedInUser)) {
                    setPendingAuthAction(null);
                    await openMemberCheckout(loggedInUser);
                    return;
                }

                setPendingAuthAction(null);
            }
        } catch (err) {
            setLoginError(err.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        } finally {
            setIsLoginLoading(false);
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();

        const validationMessage = getRegisterValidationMessage(registerForm);
        if (validationMessage) {
            setRegisterMsg({ type: 'error', text: validationMessage });
            return;
        }

        if (!registerForm.privacyNoticeAcknowledged) {
            setRegisterMsg({ type: 'error', text: 'กรุณาอ่าน Privacy Notice ก่อน' });
            return;
        }

        try {
            const res = await authApi.register({
                username: registerForm.username,
                password: registerForm.password,
                confirm_password: registerForm.confirmPassword,
                full_name: registerForm.full_name,
                email: registerForm.email,
                phone: registerForm.phone,
                privacy_notice_acknowledged: registerForm.privacyNoticeAcknowledged,
                consent_analytics: registerForm.consentAnalytics,
            });

            if (res.data.success) {
                setRegisterMsg({ type: 'success', text: 'สมัครสมาชิกสำเร็จ กำลังกลับไปหน้า Login...' });
                setTimeout(() => {
                    setIsRegisterView(false);
                    setAuthView('login');
                    setRegisterMsg({ type: '', text: '' });
                    setRegisterForm({
                        username: '',
                        password: '',
                        confirmPassword: '',
                        full_name: '',
                        email: '',
                        phone: '',
                        privacyNoticeAcknowledged: false,
                        consentAnalytics: false,
                    });
                }, 1200);
            }
        } catch (err) {
            setRegisterMsg({
                type: 'error',
                text: err.response?.data?.message || err.response?.data?.error || 'สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง',
            });
        }
    };

    const openAuthPage = (view = 'login', action = null) => {
        setIsRegisterView(view === 'register');
        setAuthView(view);
        setPendingAuthAction(action);
        setIsAdminView(false);
    };

    const redirectUnauthorizedPage = (page, currentUser = user, action = null) => {
        if (canAccessPage(page, currentUser)) return true;

        if (!currentUser) {
            openAuthPage('login', action || page);
            return false;
        }

        if (isAdminUser(currentUser)) {
            setIsAdminView(true);
            setAdminPage('dashboard');
            return false;
        }

        setIsAdminView(false);
        return false;
    };

    const openStore = () => {
        setAuthView(null);
        setIsAdminView(false);
    };

    const fetchAddresses = async (targetUser = user) => {
        if (!targetUser?.id) return [];

        try {
            const res = await authApi.getAddresses(targetUser.id);
            const list = Array.isArray(res.data) ? res.data : [];
            setAddresses(list);
            return list;
        } catch (err) {
            console.error(err);
            setAddresses([]);
            return [];
        }
    };

    const applyAddressToCheckout = (address) => {
        if (!address) return;

        setShippingInfo((prev) => ({
            ...prev,
            address_id: address.address_id,
            receiver_name: address.receiver_name || '',
            address: address.address_detail || '',
            phone: address.phone || '',
            subdistrict: address.subdistrict || '',
            district: address.district || '',
            province: address.province || '',
            postal_code: address.postal_code || '',
        }));
    };

    const openMemberCheckout = async (targetUser = user) => {
        if (!redirectUnauthorizedPage('checkout', targetUser, 'checkout')) {
            setIsCartOpen(false);
            setShowCheckout(false);
            return;
        }

        const list = await fetchAddresses(targetUser);
        const defaultAddress = list.find((address) => Number(address.is_default) === 1) || list[0];
        applyAddressToCheckout(defaultAddress);
        setShippingInfo((current) => ({ ...current, shipping_method: 'ส่งสินค้า', shipping_fee: DELIVERY_FEE }));
        setAuthView(null);
        setIsCartOpen(false);
        setShowCheckout(true);
    };

    const addToCart = (product) => {
        const requestedQuantity = Math.max(1, Number.parseInt(product.selected_quantity, 10) || 1);
        const availableStock = Math.max(0, Number(product.stock) || 0);
        if (availableStock <= 0) return;

        const existing = cart.find((item) => item.id === product.id);

        if (existing) {
            setCart(cart.map((item) => (
                item.id === product.id
                    ? { ...item, qty: Math.min(availableStock, item.qty + requestedQuantity) }
                    : item
            )));
            return;
        }

        setCart([...cart, { ...product, qty: Math.min(availableStock, requestedQuantity) }]);
    };

    const handleAddProduct = async (event) => {
        event.preventDefault();

        try {
            const stockAmount = Number(newProduct.stock);
            if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
                notify({ type: 'warning', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณากรอกสต็อกเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
                return false;
            }
            const selectedCategory = findActiveCategory(newProduct.category_id, newProduct.category_name);
            if (!selectedCategory) {
                notify({ type: 'warning', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาเลือกหมวดหมู่สินค้า' });
                return false;
            }
            let imageUrl = newProduct.image_url;

            if (newProduct.image_data) {
                const uploadRes = await productsApi.uploadProductImage({
                    imageData: newProduct.image_data,
                    fileName: newProduct.image_name,
                });
                imageUrl = uploadRes.data.imageUrl;
            }

            const productData = { ...newProduct };
            productData.category_id = selectedCategory.category_id;
            productData.category_name = selectedCategory.category_name;
            productData.stock_remark = 'สต็อกเริ่มต้น';
            delete productData.image_data;
            delete productData.image_preview;
            delete productData.image_name;

            await productsApi.createProduct({
                ...productData,
                image_url: imageUrl,
                user_id: user?.id,
            });

            notify({ type: 'success', title: 'เพิ่มสินค้าสำเร็จ', message: 'ระบบบันทึกสินค้าใหม่เรียบร้อยแล้ว' });
            setNewProduct(emptyProduct);
            await fetchProducts(false);
            return true;
        } catch (err) {
            notify({ type: 'error', title: 'เพิ่มสินค้าล้มเหลว', message: 'กรุณาลองใหม่อีกครั้ง' });
            return false;
        }
    };

    const handleUpdateStock = async () => {
        try {
            const stockAmount = Number(stockEdit.amount);
            if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
                notify({ type: 'warning', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณากรอกจำนวนสต็อกเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
                return;
            }
            await productsApi.updateStock({
                product_id: stockEdit.id,
                amount: stockAmount,
                reason: stockEdit.reason.trim(),
                change_type: stockEdit.changeType,
                operation: stockEdit.adjustmentMode,
                user_id: user?.id,
            });

            notify({ type: 'success', title: 'ปรับปรุงสต็อกสำเร็จ', message: 'ข้อมูลสต็อกและประวัติได้รับการอัปเดตแล้ว' });
            setStockEdit({
                id: null,
                amount: '',
                reason: '',
                changeType: 'รับสินค้าเข้า',
                adjustmentMode: 'increase',
                currentStock: 0,
                name: '',
            });
            await fetchProducts(true);
            await fetchStockLogs();
        } catch (err) {
            notify({
                type: 'error',
                title: 'ปรับสต็อกไม่สำเร็จ',
                message: err.response?.data?.error || 'เกิดข้อผิดพลาดในการปรับสต็อก',
            });
        }
    };

    const handleSaveEditProduct = async () => {
        try {
            const selectedCategory = findActiveCategory(editProduct.category_id, editProduct.category_name);
            if (!selectedCategory) {
                notify({ type: 'warning', title: 'ข้อมูลยังไม่ครบ', message: 'กรุณาเลือกหมวดหมู่สินค้า' });
                return;
            }
            let imageUrl = editProduct.image_url;

            if (editProduct.image_data) {
                const uploadRes = await productsApi.uploadProductImage({
                    imageData: editProduct.image_data,
                    fileName: editProduct.image_name,
                });
                imageUrl = uploadRes.data.imageUrl;
            }

            const productData = { ...editProduct, image_url: imageUrl };
            productData.category_id = selectedCategory.category_id;
            productData.category_name = selectedCategory.category_name;
            delete productData.image_data;
            delete productData.image_preview;
            delete productData.image_name;

            const res = await productsApi.editProduct(productData);
            if (res.data.success) {
                notify({ type: 'success', title: 'แก้ไขข้อมูลสินค้าสำเร็จ', message: 'ข้อมูลสินค้าถูกอัปเดตเรียบร้อยแล้ว' });
                setEditProduct({ id: null, name: '', price: 0, description: '' });
                await fetchProducts(true);
            }
        } catch (err) {
            notify({ type: 'error', title: 'แก้ไขสินค้าไม่สำเร็จ', message: 'เกิดข้อผิดพลาดในการแก้ไขสินค้า' });
        }
    };

    const handleToggleProductStatus = async (product) => {
        const nextStatus = Number(product.product_status) === 0 ? 1 : 0;
        try {
            await productsApi.updateProductStatus(product.id, nextStatus);
            await fetchProducts(true);
            return { success: true };
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.error || 'ไม่สามารถเปลี่ยนสถานะสินค้าได้',
            };
        }
    };

    const handleDeleteProduct = async (product) => {
        try {
            await productsApi.deleteProduct(product.id);
            await fetchProducts(true);
            return { success: true };
        } catch (err) {
            const isMissingRoute = err.response?.status === 404;
            return {
                success: false,
                message: isMissingRoute
                    ? 'ลบสินค้าไม่ได้ เพราะ Backend ยังไม่ได้รีสตาร์ทหลังอัปเดตโค้ด'
                    : err.response?.data?.error || 'ไม่สามารถลบสินค้าได้',
            };
        }
    };

    const handleAddCategory = async (categoryName) => {
        const cleanName = String(categoryName || '').trim();
        if (!cleanName) {
            return { success: false, message: 'กรุณากรอกชื่อหมวดหมู่สินค้า' };
        }

        try {
            await productsApi.createCategory(cleanName);
            await fetchCategories(true);
            return { success: true };
        } catch (err) {
            const isMissingRoute = err.response?.status === 404;
            return {
                success: false,
                message: isMissingRoute
                    ? 'เพิ่มหมวดหมู่สินค้าไม่ได้ เพราะ backend ยังไม่ได้รีสตาร์ทหลังอัปเดตโค้ด'
                    : err.response?.data?.error || 'เพิ่มหมวดหมู่สินค้าไม่สำเร็จ',
            };
        }
    };

    const handleUpdateCategory = async (categoryId, payload) => {
        const cleanName = String(payload.category_name || '').trim();
        if (!cleanName) {
            return { success: false, message: 'กรุณากรอกชื่อหมวดหมู่สินค้า' };
        }

        try {
            await productsApi.updateCategory(categoryId, {
                ...payload,
                category_name: cleanName,
            });
            await fetchCategories(true);
            await fetchProducts(true);
            return { success: true };
        } catch (err) {
            const isMissingRoute = err.response?.status === 404;
            return {
                success: false,
                message: isMissingRoute
                    ? 'อัปเดตหมวดหมู่สินค้าไม่ได้ เพราะ backend ยังไม่ได้รีสตาร์ทหลังอัปเดตโค้ด'
                    : err.response?.data?.error || 'อัปเดตหมวดหมู่สินค้าไม่สำเร็จ',
            };
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        try {
            await productsApi.deleteCategory(categoryId);
            await fetchCategories(true);
            return { success: true };
        } catch (err) {
            const isMissingRoute = err.response?.status === 404;
            return {
                success: false,
                message: isMissingRoute
                    ? 'ลบหมวดหมู่สินค้าไม่ได้ เพราะ backend ยังไม่ได้รีสตาร์ทหลังอัปเดตโค้ด'
                    : err.response?.data?.error || 'ลบหมวดหมู่สินค้าไม่สำเร็จ',
            };
        }
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            notify({ type: 'warning', title: 'ไม่มีสินค้าในตะกร้า', message: 'กรุณาเลือกสินค้าเข้าตะกร้าก่อนชำระเงิน' });
            return;
        }
        if (selectedCartItems.length === 0) {
            notify({ type: 'warning', title: 'ยังไม่ได้เลือกสินค้า', message: 'กรุณาเลือกสินค้าที่ต้องการชำระเงิน' });
            return;
        }

        if (user?.role === 'admin') {
            if (!redirectUnauthorizedPage('pos')) return;
            setIsCartOpen(false);
            setShowPosCheckout(true);
            return;
        }

        await openMemberCheckout();
    };

    const removeSelectedCartItems = () => {
        const paidKeySet = new Set(selectedCartItems.map((item) => getCartItemKey(item)));
        setCart((currentCart) => currentCart.filter((item) => !paidKeySet.has(getCartItemKey(item))));
        setSelectedCartKeys((currentKeys) => currentKeys.filter((key) => !paidKeySet.has(key)));
    };

    const handleConfirmPosPayment = async ({ payment_method, cash_received }) => {
        if (!redirectUnauthorizedPage('pos')) throw new Error('กรุณาเข้าสู่ระบบด้วยสิทธิ์แอดมิน');
        if (selectedCartItems.length === 0) throw new Error('กรุณาเลือกสินค้าที่ต้องการชำระเงิน');

        const res = await ordersApi.checkoutPosOrder({
            user_id: user?.id,
            payment_method,
            cash_received,
            cart_items: selectedCartItems,
        });

        if (!res.data.success) throw new Error(res.data.error || 'บันทึกการขายไม่สำเร็จ');

        removeSelectedCartItems();
        await Promise.all([fetchProducts(), fetchAdminOrders(), fetchSystemLogs()]);
        return res.data.receipt;
    };

    const handleConfirmPayment = async () => {
        if (!redirectUnauthorizedPage('payment')) return;
        if (selectedCartItems.length === 0) {
            notify({ type: 'warning', title: 'ยังไม่ได้เลือกสินค้า', message: 'กรุณาเลือกสินค้าที่ต้องการชำระเงิน' });
            return;
        }

        if (shippingInfo.shipping_method === 'ส่งสินค้า' && !shippingInfo.address.trim()) {
            notify({ type: 'warning', title: 'ข้อมูลจัดส่งยังไม่ครบ', message: 'กรุณากรอกที่อยู่จัดส่ง' });
            return;
        }

        if (shippingInfo.shipping_method === 'ส่งสินค้า') {
            if (!shippingInfo.subdistrict.trim() || !shippingInfo.district.trim() || !shippingInfo.province.trim() || !shippingInfo.postal_code.trim()) {
                notify({ type: 'warning', title: 'ข้อมูลจัดส่งยังไม่ครบ', message: 'กรุณากรอกตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์' });
                return;
            }
        }

        if (!shippingInfo.phone.trim()) {
            notify({ type: 'warning', title: 'ข้อมูลจัดส่งยังไม่ครบ', message: 'กรุณากรอกเบอร์โทรศัพท์' });
            return;
        }
        if (!PHONE_REGEX.test(cleanPhone(shippingInfo.phone))) {
            notify({ type: 'warning', title: 'ข้อมูลจัดส่งไม่ถูกต้อง', message: 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง' });
            return;
        }

        try {
            const shippingFee = shippingInfo.shipping_method === 'รับหน้าร้าน' ? 0 : DELIVERY_FEE;
            const orderData = {
                user_id: user?.id || null,
                username: user?.username || 'ลูกค้าทั่วไป',
                total_price: total,
                shipping_fee: shippingFee,
                discount: 0,
                receiver_name: shippingInfo.receiver_name || user?.full_name || user?.username || 'ลูกค้า',
                address_id: shippingInfo.address_id,
                address: shippingInfo.shipping_method === 'รับหน้าร้าน' ? 'รับสินค้าเองที่หน้าร้าน' : shippingInfo.address,
                phone: shippingInfo.phone,
                subdistrict: shippingInfo.subdistrict,
                district: shippingInfo.district,
                province: shippingInfo.province,
                postal_code: shippingInfo.postal_code,
                payment_method: shippingInfo.payment_method,
                shipping_method: shippingInfo.shipping_method,
                receipt_image_data: shippingInfo.receipt_image_data,
                receipt_file_name: shippingInfo.receipt_file_name,
                cart_items: selectedCartItems,
            };

            const res = await ordersApi.checkoutOrder(orderData);
            if (res.data.success) {
                removeSelectedCartItems();
                setShowCheckout(false);
                setIsCartOpen(false);
                setSuccessOrderId(res.data.order_id);
                setShowOrderSuccess(true);
                notify({
                    type: shippingInfo.receipt_image_data ? 'success' : 'info',
                    title: shippingInfo.receipt_image_data ? 'ส่งหลักฐานการชำระเงินเรียบร้อย' : 'สร้างออเดอร์เรียบร้อย',
                    message: shippingInfo.receipt_image_data
                        ? 'กรุณารอแอดมินตรวจสอบ'
                        : 'สามารถอัปโหลดสลิปได้จากประวัติคำสั่งซื้อ',
                });
                setShippingInfo({ address_id: null, receiver_name: '', address: '', phone: '', subdistrict: '', district: '', province: '', postal_code: '', shipping_fee: DELIVERY_FEE, discount: 0, payment_method: 'โอนเงินผ่านธนาคาร', shipping_method: 'ส่งสินค้า', receipt_image_data: '', receipt_file_name: '', receipt_file_size: 0 });
                await fetchProducts();
                await fetchOrderHistory();
            }
        } catch (err) {
            notify({ type: 'error', title: 'ส่งข้อมูลไม่สำเร็จ', message: 'เกิดข้อผิดพลาดในการส่งข้อมูล' });
            throw err;
        }
    };

    const handleDeleteOrder = (orderId, options = {}) => {
        setDeleteOrderRequest({ orderId, onDeleted: options.onDeleted });
    };

    const closeDeleteOrderModal = () => {
        if (isDeletingOrder) return;
        setDeleteOrderRequest(null);
    };

    const confirmDeleteOrder = async () => {
        const orderId = deleteOrderRequest?.orderId;
        if (!orderId || isDeletingOrder) return;

        setIsDeletingOrder(true);
        try {
            await adminApi.deleteAdminOrder(orderId, user?.id);
            setDeleteOrderRequest(null);
            deleteOrderRequest?.onDeleted?.();
            await fetchAdminOrders();
            await fetchSystemLogs();
            showOrderToast('success', 'ลบคำสั่งซื้อสำเร็จ');
        } catch (err) {
            showOrderToast('error', err.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsDeletingOrder(false);
        }
    };

    const closeOrderStatusModal = () => {
        if (isUpdatingOrderStatus) return;

        setConfirmModalOpen(false);
        setPendingOrderId(null);
        setPendingStatus('');
        setPendingTrackingNo('');
        orderStatusResolverRef.current?.({ success: false });
        orderStatusResolverRef.current = null;
    };

    const confirmOrderStatusUpdate = async () => {
        if (!pendingOrderId || isUpdatingOrderStatus) return;

        setIsUpdatingOrderStatus(true);
        try {
            await adminApi.updateOrderStatus(pendingOrderId, pendingStatus, pendingTrackingNo, user?.id);
            await fetchAdminOrders();
            await fetchSystemLogs();
            const result = { success: true };
            orderStatusResolverRef.current?.(result);
            orderStatusResolverRef.current = null;
            setConfirmModalOpen(false);
            setPendingOrderId(null);
            setPendingStatus('');
            setPendingTrackingNo('');
        } catch (err) {
            const result = {
                success: false,
                field: err.response?.data?.field || 'form',
                message: err.response?.data?.error || 'ไม่สามารถอัปเดตสถานะได้',
            };
            orderStatusResolverRef.current?.(result);
            orderStatusResolverRef.current = null;
            setConfirmModalOpen(false);
            setPendingOrderId(null);
            setPendingStatus('');
            setPendingTrackingNo('');
        } finally {
            setIsUpdatingOrderStatus(false);
        }
    };

    const handleUpdateOrderStatus = (orderId, trackingNo = '', status = 'เตรียมสินค้า') => {
        if (status === 'กำลังจัดส่ง' && !String(trackingNo || '').trim()) {
            return {
                success: false,
                field: 'tracking_no',
                message: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นกำลังจัดส่ง',
            };
        }

        orderStatusResolverRef.current?.({ success: false });
        setPendingOrderId(orderId);
        setPendingStatus(status);
        setPendingTrackingNo(trackingNo);
        setConfirmModalOpen(true);

        return new Promise((resolve) => {
            orderStatusResolverRef.current = resolve;
        });
    };

    const handleReviewOrderPayment = async (orderId, payload) => {
        await adminApi.reviewOrderPayment(orderId, payload);
        await fetchAdminOrders();
        await fetchSystemLogs();
    };

    const handleUploadOrderReceipt = async (orderId, payload) => {
        try {
            const response = await ordersApi.uploadReceipt(orderId, payload);
            notify({
                type: 'success',
                title: 'ส่งหลักฐานการชำระเงินเรียบร้อย',
                message: response.data?.message || 'กรุณารอแอดมินตรวจสอบ',
            });
            await fetchOrderHistory();
        } catch (err) {
            notify({ type: 'error', title: 'แนบสลิปไม่สำเร็จ', message: err.response?.data?.error || 'ไม่สามารถแนบสลิปได้' });
            throw err;
        }
    };

    const handleCancelOrderReceipt = async (orderId) => {
        try {
            const response = await ordersApi.cancelReceipt(orderId, { user_id: user?.id });
            notify({
                type: 'success',
                title: 'ยกเลิกสลิปเดิมแล้ว',
                message: response.data?.message || 'สามารถอัปโหลดสลิปใหม่ได้',
            });
            await fetchOrderHistory();
        } catch (err) {
            notify({ type: 'error', title: 'ยกเลิกสลิปไม่สำเร็จ', message: err.response?.data?.error || 'ไม่สามารถยกเลิกสลิปได้' });
            throw err;
        }
    };

    const handleCancelCustomerOrder = (orderId) => {
        setCancelOrderRequest({ orderId });
    };

    const closeCancelOrderModal = () => {
        if (isCancellingOrder) return;
        setCancelOrderRequest(null);
    };

    const confirmCancelCustomerOrder = async () => {
        const orderId = cancelOrderRequest?.orderId;
        if (!orderId || isCancellingOrder) return;

        setIsCancellingOrder(true);
        try {
            await ordersApi.cancelOrder(orderId, {
                user_id: user?.id,
                username: user?.username,
            });
            setCancelOrderRequest(null);
            showOrderToast('success', 'ยกเลิกคำสั่งซื้อสำเร็จ');
            await fetchOrderHistory();
            await fetchProducts(isAdminView);
            if (isAdminView) await fetchAdminOrders();
        } catch (err) {
            showOrderToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setIsCancellingOrder(false);
        }
    };

    const handleDeleteUser = async (id) => {
        try {
            await adminApi.deleteUser(id, user?.id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'ไม่สามารถระงับสมาชิกได้' };
        }
    };

    const handleReactivateUser = async (id) => {
        try {
            await adminApi.reactivateUser(id, user?.id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'ไม่สามารถยกเลิกการระงับสมาชิกได้' };
        }
    };

    const handleUpdateUser = async () => {
        try {
            await adminApi.updateUser(userEdit.id, {
                username: userEdit.username,
                password: userEdit.password,
                full_name: userEdit.full_name,
                email: userEdit.email,
                phone: userEdit.phone,
            });

            setUserEdit({ id: null, username: '', password: '', full_name: '', email: '', phone: '' });
            notify({ type: 'success', title: 'อัปเดตข้อมูลสมาชิกสำเร็จ', message: 'ข้อมูลสมาชิกถูกบันทึกเรียบร้อยแล้ว' });
            await fetchCustomers();
        } catch (err) {
            notify({ type: 'error', title: 'แก้ไขสมาชิกไม่สำเร็จ', message: 'เกิดข้อผิดพลาดในการแก้ไขสมาชิก' });
        }
    };

    const handleChangeRole = async (customer) => {
        try {
            const newRole = customer.role === 'admin' ? 'user' : 'admin';
            await adminApi.changeUserRole(customer.id, newRole, user?.id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'ไม่สามารถเปลี่ยนสิทธิ์ได้' };
        }
    };

    const openOrderHistory = async () => {
        if (!redirectUnauthorizedPage('orders')) return;

        await fetchOrderHistory();
        setIsOrderHistoryOpen(true);
    };

    const openSalesHistory = async () => {
        if (!redirectUnauthorizedPage('admin-orders')) return;

        await fetchAdminOrders();
        setIsSalesHistoryOpen(true);
    };

    const openProfile = () => {
        if (!redirectUnauthorizedPage('profile')) return;

        setProfileUsername(user?.username || '');
        setProfilePassword('');
        setProfileFullName(user?.full_name || user?.username || '');
        setProfileEmail(user?.email || '');
        setProfilePhone(user?.phone || '');
        fetchAddresses().then((list) => {
            const defaultAddress = list.find((address) => Number(address.is_default) === 1) || list[0];
            setAddressForm(defaultAddress ? { ...emptyAddress, ...defaultAddress } : {
                ...emptyAddress,
                receiver_name: user?.full_name || user?.username || '',
                phone: user?.phone || '',
            });
        });
        setIsProfileOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!profileUsername.trim()) {
            return { success: false, error: 'กรุณากรอกชื่อผู้ใช้' };
        }

        if (profilePassword && profilePassword.length < 8) {
            return { success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' };
        }

        try {
            const res = await authApi.updateProfile(user.id, {
                username: profileUsername,
                password: profilePassword,
                full_name: profileFullName,
                email: profileEmail,
                phone: profilePhone,
            });
            const updatedUser = res.data.user;
            setUser(updatedUser);
            const storage = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage;
            storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
            return { success: true, message: 'บันทึกข้อมูลสำเร็จ', user: updatedUser };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || 'อัปเดตข้อมูลโปรไฟล์ไม่สำเร็จ' };
        }
    };

    const handleSaveAddress = async (event) => {
        event.preventDefault();

        const validationMessage = getAddressValidationMessage(addressForm);
        if (validationMessage) {
            notify({ type: 'warning', title: 'ข้อมูลที่อยู่ยังไม่ครบ', message: validationMessage });
            return;
        }

        try {
            if (addressForm.address_id) {
                await authApi.updateAddress(user.id, addressForm.address_id, addressForm);
            } else {
                await authApi.createAddress(user.id, addressForm);
            }

            const list = await fetchAddresses();
            const defaultAddress = list.find((address) => Number(address.is_default) === 1) || list[0];
            setAddressForm(defaultAddress ? { ...emptyAddress, ...defaultAddress } : emptyAddress);
            applyAddressToCheckout(defaultAddress);
            notify({ type: 'success', title: 'บันทึกที่อยู่สำเร็จ', message: 'ข้อมูลที่อยู่ถูกอัปเดตเรียบร้อยแล้ว' });
        } catch (err) {
            notify({ type: 'error', title: 'บันทึกที่อยู่ไม่สำเร็จ', message: err.response?.data?.error || 'บันทึกที่อยู่ไม่สำเร็จ' });
        }
    };

    const handleSaveCheckoutAddress = async (payload) => {
        if (!redirectUnauthorizedPage('checkout')) return null;

        const res = await authApi.createAddress(user.id, payload);
        const list = await fetchAddresses();
        const savedAddress = list.find((address) => address.address_id === res.data.address_id)
            || list.find((address) => Number(address.is_default) === 1)
            || list[0];

        applyAddressToCheckout(savedAddress);
        return savedAddress;
    };

    const handleSelectAddress = (address) => {
        setAddressForm({ ...emptyAddress, ...address });
    };

    const handleNewAddress = () => {
        setAddressForm({
            ...emptyAddress,
            receiver_name: user?.full_name || user?.username || '',
            phone: user?.phone || '',
            is_default: addresses.length === 0 ? 1 : 0,
        });
    };

    const handleSetDefaultAddress = async (address) => {
        try {
            await authApi.setDefaultAddress(user.id, address.address_id);
            const list = await fetchAddresses();
            const selected = list.find((item) => item.address_id === address.address_id) || address;
            setAddressForm({ ...emptyAddress, ...selected, is_default: 1 });
            applyAddressToCheckout(selected);
            notify({ type: 'success', title: 'ตั้งเป็นที่อยู่หลักแล้ว', message: 'ระบบจะใช้ที่อยู่นี้เป็นค่าเริ่มต้น' });
        } catch (err) {
            notify({ type: 'error', title: 'ตั้งที่อยู่หลักไม่สำเร็จ', message: err.response?.data?.error || 'ตั้งที่อยู่หลักไม่สำเร็จ' });
        }
    };

    const handleDeleteAddress = async (address) => {
        const shouldDelete = await confirmNotification({
            type: 'danger',
            title: 'ลบที่อยู่นี้?',
            message: `ยืนยันลบที่อยู่ของ ${address.receiver_name || 'ผู้รับ'} หรือไม่`,
            confirmText: 'ลบที่อยู่',
            cancelText: 'ยกเลิก',
        });
        if (!shouldDelete) return;

        try {
            await authApi.deleteAddress(user.id, address.address_id);
            const list = await fetchAddresses();
            const defaultAddress = list.find((item) => Number(item.is_default) === 1) || list[0];

            if (addressForm.address_id === address.address_id) {
                setAddressForm(defaultAddress ? { ...emptyAddress, ...defaultAddress } : {
                    ...emptyAddress,
                    receiver_name: user?.full_name || user?.username || '',
                    phone: user?.phone || '',
                });
            }

            if (shippingInfo.address_id === address.address_id) {
                setShippingInfo({
                    address_id: null,
                    receiver_name: '',
                    address: '',
                    phone: '',
                    subdistrict: '',
                    district: '',
                    province: '',
                    postal_code: '',
                    shipping_fee: DELIVERY_FEE,
                    discount: shippingInfo.discount,
                    payment_method: shippingInfo.payment_method,
                    shipping_method: shippingInfo.shipping_method,
                    receipt_image_data: shippingInfo.receipt_image_data,
                    receipt_file_name: shippingInfo.receipt_file_name,
                });
                applyAddressToCheckout(defaultAddress);
            }

            notify({ type: 'success', title: 'ลบที่อยู่สำเร็จ', message: 'รายการที่อยู่ถูกลบเรียบร้อยแล้ว' });
        } catch (err) {
            notify({ type: 'error', title: 'ลบที่อยู่ไม่สำเร็จ', message: err.response?.data?.error || 'ลบที่อยู่ไม่สำเร็จ' });
        }
    };

    const requestLogout = () => {
        setShowLogoutConfirm(true);
    };

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        const sessionSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
        const hours = Math.floor(sessionSeconds / 3600);
        const minutes = Math.floor((sessionSeconds % 3600) / 60);
        const seconds = sessionSeconds % 60;
        try {
            await authApi.logout(user?.id, `${hours}ชม. ${minutes}น. ${seconds}ว.`);
        } catch (err) {
            console.error('บันทึก Logout log ไม่สำเร็จ', err);
        } finally {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            setUser(null);
            setIsAdminView(false);
            setAuthView(null);
            setPendingAuthAction(null);
            setCart([]);
            setLoginForm({ username: '', password: '' });
            setIsCartOpen(false);
            setShowCheckout(false);
            setShowPosCheckout(false);
            setIsOrderHistoryOpen(false);
            setIsSalesHistoryOpen(false);
            setIsProfileOpen(false);
            setShowLogoutConfirm(false);
            setIsLoggingOut(false);
        }
    };

    if (printOrderIds.length > 0 || window.location.pathname.match(/^\/admin\/orders\/print\/?$/)) {
        return <AdminOrderPrintPage orderIds={printOrderIds} />;
    }

    const shouldShowSiteFooter = !isAdminUser(user);

    return (
        <div className="bg-light min-vh-100">
            <AppNotificationHost />

            <AppNavbar
                user={user}
                cart={cart}
                isAdminView={isAdminView}
                onOpenStore={openStore}
                onOpenAdmin={() => redirectUnauthorizedPage('admin-dashboard') && setIsAdminView(true)}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenOrderHistory={openOrderHistory}
                onOpenSalesHistory={openSalesHistory}
                onOpenProfile={openProfile}
                onOpenLogin={() => openAuthPage('login')}
                onLogout={requestLogout}
            />

            <div className="container mt-4 pb-5">
                {authView ? (
                    <AuthPage
                        isRegisterView={isRegisterView}
                        setIsRegisterView={(nextView) => {
                            setIsRegisterView(nextView);
                            setAuthView(nextView ? 'register' : 'login');
                        }}
                        loginForm={loginForm}
                        setLoginForm={setLoginForm}
                        rememberLogin={rememberLogin}
                        setRememberLogin={setRememberLogin}
                        registerForm={registerForm}
                        setRegisterForm={setRegisterForm}
                        loginError={loginError}
                        isLoginLoading={isLoginLoading}
                        registerMsg={registerMsg}
                        onLogin={handleLogin}
                        onRegister={handleRegister}
                    />
                ) : isAdminView && isAdminUser(user) ? (
                    <AdminPage
                        adminPage={adminPage}
                        setAdminPage={setAdminPage}
                        setIsAdminView={setIsAdminView}
                        orders={adminOrders}
                        ordersLoading={adminOrdersLoading}
                        products={products}
                        productsLoading={productsLoading}
                        categories={categories}
                        customers={customers}
                        customersLoading={customersLoading}
                        customersMeta={customersMeta}
                        currentUser={user}
                        onLoadCustomers={fetchCustomers}
                        stockLogs={stockLogs}
                        systemLogs={systemLogs}
                        activityLogsLoading={activityLogsLoading}
                        newProduct={newProduct}
                        setNewProduct={setNewProduct}
                        editProduct={editProduct}
                        setEditProduct={setEditProduct}
                        userEdit={userEdit}
                        setUserEdit={setUserEdit}
                        onSubmit={handleAddProduct}
                        onSaveEditProduct={handleSaveEditProduct}
                        onDeleteProduct={handleDeleteProduct}
                        onToggleProductStatus={handleToggleProductStatus}
                        onAddCategory={handleAddCategory}
                        onUpdateCategory={handleUpdateCategory}
                        onDeleteCategory={handleDeleteCategory}
                        onDeleteOrder={handleDeleteOrder}
                        onUpdateOrderStatus={handleUpdateOrderStatus}
                        onReviewOrderPayment={handleReviewOrderPayment}
                        onOpenStockEdit={(product) => setStockEdit({
                            id: product.id,
                            amount: '',
                            reason: '',
                            changeType: 'รับสินค้าเข้า',
                            adjustmentMode: 'increase',
                            currentStock: Number(product.stock) || 0,
                            name: product.name,
                        })}
                        onUpdateUser={handleUpdateUser}
                        onDeleteUser={handleDeleteUser}
                        onReactivateUser={handleReactivateUser}
                        onChangeRole={handleChangeRole}
                    />
                ) : (
                    <StorePage
                        products={products}
                        onAddToCart={addToCart}
                        previewProductId={previewProductId}
                        onPreviewShown={() => setPreviewProductId(null)}
                        showStockCounts={isAdminUser(user)}
                    />
                )}
            </div>

            {shouldShowSiteFooter && <SiteFooter contact={storeContact} onOpenStore={openStore} />}

            <StockEditModal stockEdit={stockEdit} setStockEdit={setStockEdit} onSave={handleUpdateStock} />

            {isCartOpen && (
                <CartModal
                    cart={cart}
                    setCart={setCart}
                    selectedCartKeys={selectedCartKeys}
                    onToggleItemSelection={(itemKey) => setSelectedCartKeys((currentKeys) => (
                        currentKeys.includes(itemKey)
                            ? currentKeys.filter((key) => key !== itemKey)
                            : [...currentKeys, itemKey]
                    ))}
                    onSelectAllItems={() => setSelectedCartKeys(cart.map((item) => getCartItemKey(item)))}
                    onClearSelection={() => setSelectedCartKeys([])}
                    onClose={() => setIsCartOpen(false)}
                    onCheckout={handleCheckout}
                    checkoutLabel={user?.role === 'admin' ? 'ไปหน้ารับชำระ' : 'ชำระเงินทันที'}
                />
            )}

            {showCheckout && (
                <CheckoutModal
                    total={total}
                    shippingInfo={shippingInfo}
                    setShippingInfo={setShippingInfo}
                    addresses={addresses}
                    onClose={() => setShowCheckout(false)}
                    onConfirm={handleConfirmPayment}
                    onSaveNewAddress={handleSaveCheckoutAddress}
                />
            )}

            {showPosCheckout && (
                <PosCheckoutModal
                    cart={selectedCartItems}
                    cashier={user}
                    onClose={() => setShowPosCheckout(false)}
                    onConfirm={handleConfirmPosPayment}
                />
            )}

            {isOrderHistoryOpen && (
                <OrderHistoryModal
                    orders={orderHistory}
                    username={user?.username}
                    onClose={() => setIsOrderHistoryOpen(false)}
                    onUploadReceipt={handleUploadOrderReceipt}
                    onCancelReceipt={handleCancelOrderReceipt}
                    onCancelOrder={handleCancelCustomerOrder}
                />
            )}

            {cancelOrderRequest && (
                <CancelOrderConfirmModal
                    orderId={cancelOrderRequest.orderId}
                    isSubmitting={isCancellingOrder}
                    onClose={closeCancelOrderModal}
                    onConfirm={confirmCancelCustomerOrder}
                />
            )}

            {deleteOrderRequest && (
                <DeleteOrderConfirmModal
                    orderId={deleteOrderRequest.orderId}
                    isSubmitting={isDeletingOrder}
                    onClose={closeDeleteOrderModal}
                    onConfirm={confirmDeleteOrder}
                />
            )}

            {confirmModalOpen && (
                <OrderStatusConfirmModal
                    orderId={pendingOrderId}
                    status={pendingStatus}
                    isSubmitting={isUpdatingOrderStatus}
                    onClose={closeOrderStatusModal}
                    onConfirm={confirmOrderStatusUpdate}
                />
            )}

            {isSalesHistoryOpen && (
                <OrderHistoryModal
                    orders={adminOrders}
                    username={user?.username}
                    mode="sales"
                    eyebrow="Sales History"
                    title="ประวัติการขาย"
                    description="ตรวจสอบรายการขายทั้งหมด สถานะออเดอร์ และยอดขายของร้าน"
                    activeTabLabel="ประวัติการขายหน้าร้าน"
                    historyTabLabel="ออนไลน์"
                    onClose={() => setIsSalesHistoryOpen(false)}
                />
            )}

            {isProfileOpen && (
                <ProfileModal
                    user={user}
                    username={profileUsername}
                    password={profilePassword}
                    fullName={profileFullName}
                    email={profileEmail}
                    phone={profilePhone}
                    setUsername={setProfileUsername}
                    setPassword={setProfilePassword}
                    setFullName={setProfileFullName}
                    setEmail={setProfileEmail}
                    setPhone={setProfilePhone}
                    addresses={addresses}
                    addressForm={addressForm}
                    setAddressForm={setAddressForm}
                    onSaveAddress={handleSaveAddress}
                    onSelectAddress={handleSelectAddress}
                    onNewAddress={handleNewAddress}
                    onSetDefaultAddress={handleSetDefaultAddress}
                    onDeleteAddress={handleDeleteAddress}
                    onSave={handleSaveProfile}
                    onClose={() => setIsProfileOpen(false)}
                />
            )}

            {showLogoutConfirm && (
                <LogoutConfirmModal
                    user={user}
                    isSubmitting={isLoggingOut}
                    onCancel={() => setShowLogoutConfirm(false)}
                    onConfirm={handleLogout}
                />
            )}

            {showOrderSuccess && (
                <OrderSuccessModal
                    orderId={successOrderId}
                    onViewOrder={async () => {
                        setShowOrderSuccess(false);
                        await openOrderHistory();
                    }}
                    onContinueShopping={() => {
                        setShowOrderSuccess(false);
                        openStore();
                    }}
                />
            )}

            <OrderToast toast={orderToast} onClose={() => setOrderToast({ type: '', message: '' })} />
        </div>
    );
}

export default App;
