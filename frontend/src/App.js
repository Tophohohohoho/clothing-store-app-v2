import React, { useCallback, useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import * as authApi from './api/authApi';
import * as productsApi from './api/productsApi';
import * as adminApi from './api/adminApi';
import * as ordersApi from './api/ordersApi';
import AppNavbar from './components/AppNavbar';
import CartModal from './components/CartModal';
import CheckoutModal from './components/CheckoutModal';
import OrderHistoryModal from './components/OrderHistoryModal';
import ProfileModal from './components/ProfileModal';
import StockEditModal from './components/StockEditModal';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import StorePage from './pages/StorePage';
import { getCartTotal } from './utils/cart';

const AUTH_STORAGE_KEY = 'clothingStoreUser';

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
    has_size: 1,
    has_color: 0,
    colors: [],
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

function App() {
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem(AUTH_STORAGE_KEY);
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (err) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
        }
    });
    const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem(AUTH_STORAGE_KEY)));
    const [isRegisterView, setIsRegisterView] = useState(false);
    const [isAdminView, setIsAdminView] = useState(false);
    const [adminPage, setAdminPage] = useState('dashboard');
    const [previewProductId, setPreviewProductId] = useState(null);
    const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());

    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [registerForm, setRegisterForm] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        email: '',
        phone: '',
    });
    const [loginError, setLoginError] = useState('');
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
    const [stockEdit, setStockEdit] = useState({ id: null, amount: 0, remark: '', name: '' });
    const [userEdit, setUserEdit] = useState({ id: null, username: '', password: '', full_name: '', email: '', phone: '' });

    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileUsername, setProfileUsername] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [profileFullName, setProfileFullName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [addresses, setAddresses] = useState([]);
    const [addressForm, setAddressForm] = useState(emptyAddress);
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
    });

    const total = getCartTotal(cart);
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
            setAdminOrders(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
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
        fetchProducts(isAdminView);
        fetchCategories(isAdminView);
    }, [fetchProducts, fetchCategories, isAdminView]);

    useEffect(() => {
        if (!isAdminView) return;

        if (adminPage === 'dashboard') fetchAdminOrders();
        if (adminPage === 'customers') fetchCustomers();
        if (adminPage === 'stock-logs') {
            setActivityLogsLoading(true);
            Promise.all([fetchStockLogs(), fetchSystemLogs()])
                .finally(() => setActivityLogsLoading(false));
        }
    }, [isAdminView, adminPage]);

    const handleLogin = async (event) => {
        event.preventDefault();

        try {
            const res = await authApi.login(loginForm);
            if (res.data.success) {
                setIsLoggedIn(true);
                setUser(res.data.user);
                setSessionStartedAt(Date.now());
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.data.user));
                setLoginError('');
            }
        } catch (err) {
            setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();

        if (registerForm.password !== registerForm.confirmPassword) {
            setRegisterMsg({ type: 'error', text: 'รหัสผ่านไม่ตรงกัน' });
            return;
        }

        try {
            const res = await authApi.register({
                username: registerForm.username,
                password: registerForm.password,
                full_name: registerForm.full_name,
                email: registerForm.email,
                phone: registerForm.phone,
            });

            if (res.data.success) {
                setRegisterMsg({ type: 'success', text: 'สมัครสมาชิกสำเร็จ กำลังกลับไปหน้า Login...' });
                setTimeout(() => {
                    setIsRegisterView(false);
                    setRegisterMsg({ type: '', text: '' });
                    setRegisterForm({ username: '', password: '', confirmPassword: '', full_name: '', email: '', phone: '' });
                }, 1200);
            }
        } catch (err) {
            setRegisterMsg({
                type: 'error',
                text: err.response?.data?.message || err.response?.data?.error || 'สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง',
            });
        }
    };

    const fetchAddresses = async () => {
        if (!user?.id) return [];

        try {
            const res = await authApi.getAddresses(user.id);
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

    const addToCart = (product) => {
        const selectedSize = product.selected_size || product.size || '';
        const selectedColor = product.selected_color || product.color || '';
        const requestedQuantity = Math.max(1, Number.parseInt(product.selected_quantity, 10) || 1);
        const availableStock = Math.max(0, Number(product.stock) || 0);
        const nextProduct = { ...product, selected_size: selectedSize, selected_color: selectedColor };
        const existing = cart.find((item) => (
            item.id === product.id
            && (item.selected_size || '') === selectedSize
            && (item.selected_color || '') === selectedColor
        ));

        if (existing) {
            setCart(cart.map((item) => (
                item.id === product.id
                    && (item.selected_size || '') === selectedSize
                    && (item.selected_color || '') === selectedColor
                    ? { ...item, qty: Math.min(availableStock, item.qty + requestedQuantity) }
                    : item
            )));
            return;
        }

        setCart([...cart, { ...nextProduct, qty: Math.min(availableStock, requestedQuantity) }]);
    };

    const handleAddProduct = async (event) => {
        event.preventDefault();

        try {
            const stockAmount = Number(newProduct.stock);
            if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
                alert('กรุณากรอกสต็อกเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
                return;
            }
            const selectedCategory = findActiveCategory(newProduct.category_id, newProduct.category_name);
            if (!selectedCategory) {
                alert('กรุณาเลือกหมวดหมู่สินค้า');
                return;
            }
            if (Number(newProduct.has_color) === 1 && (!Array.isArray(newProduct.colors) || newProduct.colors.length === 0)) {
                alert('กรุณาเพิ่มสีสินค้าอย่างน้อย 1 สี');
                return;
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
            delete productData.image_data;
            delete productData.image_preview;
            delete productData.image_name;

            const res = await productsApi.createProduct({
                ...productData,
                image_url: imageUrl,
                user_id: user?.id,
            });
            const productId = res.data.insertId || res.data.id;

            alert('เพิ่มสินค้าสำเร็จ');
            setNewProduct(emptyProduct);
            await fetchProducts(false);
            setPreviewProductId(productId);
            setIsAdminView(false);
        } catch (err) {
            alert('เพิ่มสินค้าล้มเหลว');
        }
    };

    const handleUpdateStock = async () => {
        try {
            const stockAmount = Number(stockEdit.amount);
            if (!Number.isInteger(stockAmount) || stockAmount <= 0) {
                alert('กรุณากรอกจำนวนสต็อกเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
                return;
            }
            if (!stockEdit.remark.trim()) {
                alert('กรุณากรอกหมายเหตุทุกครั้งเมื่อรับสต็อก');
                return;
            }

            await productsApi.updateStock({
                product_id: stockEdit.id,
                amount: stockAmount,
                remark: stockEdit.remark.trim(),
                user_id: user?.id,
            });

            alert('ปรับปรุงสต็อกสำเร็จ');
            setStockEdit({ id: null, amount: 0, remark: '', name: '' });
            await fetchProducts(true);
            await fetchStockLogs();
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการปรับสต็อก');
        }
    };

    const handleSaveEditProduct = async () => {
        try {
            const selectedCategory = findActiveCategory(editProduct.category_id, editProduct.category_name);
            if (!selectedCategory) {
                alert('กรุณาเลือกหมวดหมู่สินค้า');
                return;
            }
            if (Number(editProduct.has_color) === 1 && (!Array.isArray(editProduct.colors) || editProduct.colors.length === 0)) {
                alert('กรุณาเพิ่มสีสินค้าอย่างน้อย 1 สี');
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
                alert('แก้ไขข้อมูลสินค้าสำเร็จ');
                setEditProduct({ id: null, name: '', price: 0, description: '' });
                await fetchProducts(true);
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการแก้ไขสินค้า');
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
            alert('ไม่มีสินค้าในตะกร้า');
            return;
        }

        const list = await fetchAddresses();
        const defaultAddress = list.find((address) => Number(address.is_default) === 1) || list[0];
        applyAddressToCheckout(defaultAddress);
        setShowCheckout(true);
    };

    const handleConfirmPayment = async () => {
        if (shippingInfo.shipping_method === 'ส่งสินค้า' && !shippingInfo.address.trim()) {
            alert('กรุณากรอกที่อยู่จัดส่ง');
            return;
        }

        if (shippingInfo.shipping_method === 'ส่งสินค้า') {
            if (!shippingInfo.subdistrict.trim() || !shippingInfo.district.trim() || !shippingInfo.province.trim() || !shippingInfo.postal_code.trim()) {
                alert('กรุณากรอกตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์');
                return;
            }
        }

        if (!shippingInfo.phone.trim()) {
            alert('กรุณากรอกเบอร์โทรศัพท์');
            return;
        }

        try {
            const shippingFee = shippingInfo.shipping_method === 'รับหน้าร้าน' ? 0 : DELIVERY_FEE;
            const discount = Math.min(Math.max(Number(shippingInfo.discount) || 0, 0), total + shippingFee);
            const orderData = {
                user_id: user?.id || null,
                username: user?.username || 'ลูกค้าทั่วไป',
                total_price: total,
                shipping_fee: shippingFee,
                discount,
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
                cart_items: cart,
            };

            const res = await ordersApi.checkoutOrder(orderData);
            if (res.data.success) {
                alert('สั่งซื้อสำเร็จ');
                setCart([]);
                setShowCheckout(false);
                setIsCartOpen(false);
                setShippingInfo({ address_id: null, receiver_name: '', address: '', phone: '', subdistrict: '', district: '', province: '', postal_code: '', shipping_fee: DELIVERY_FEE, discount: 0, payment_method: 'โอนเงินผ่านธนาคาร', shipping_method: 'ส่งสินค้า', receipt_image_data: '', receipt_file_name: '' });
                await fetchProducts();
            }
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการส่งข้อมูล');
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm(`ยืนยันการลบคำสั่งซื้อ #${orderId}?`)) return;

        try {
            await adminApi.deleteAdminOrder(orderId, user?.id);
            alert('ลบคำสั่งซื้อสำเร็จ');
            await fetchAdminOrders();
            await fetchSystemLogs();
        } catch (err) {
            alert('ไม่สามารถลบคำสั่งซื้อได้');
        }
    };

    const handleUpdateOrderStatus = async (orderId, trackingNo = '', status = 'รอตรวจสอบ') => {
        if (status === 'จัดส่งแล้ว' && !String(trackingNo || '').trim()) {
            return {
                success: false,
                field: 'tracking_no',
                message: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นจัดส่งแล้ว',
            };
        }

        const confirmText = `ยืนยันเปลี่ยนสถานะออเดอร์ #${orderId} เป็น "${status}"?`;
        if (!window.confirm(confirmText)) {
            return { success: false };
        }

        try {
            await adminApi.updateOrderStatus(orderId, status, trackingNo, user?.id);
            await fetchAdminOrders();
            await fetchSystemLogs();
            return { success: true };
        } catch (err) {
            return {
                success: false,
                field: err.response?.data?.field || 'form',
                message: err.response?.data?.error || 'ไม่สามารถอัปเดตสถานะได้',
            };
        }
    };

    const handleUploadOrderReceipt = async (orderId, payload) => {
        try {
            await ordersApi.uploadReceipt(orderId, payload);
            alert('แนบสลิปเรียบร้อยแล้ว รอแอดมินตรวจสอบ');
            await fetchOrderHistory();
        } catch (err) {
            alert(err.response?.data?.error || 'ไม่สามารถแนบสลิปได้');
        }
    };

    const handleCancelCustomerOrder = async (orderId) => {
        if (!window.confirm(`ยืนยันยกเลิกคำสั่งซื้อ #${orderId}? สินค้าจะถูกคืนเข้าสต็อก`)) return;

        try {
            await ordersApi.cancelOrder(orderId, {
                user_id: user?.id,
                username: user?.username,
            });
            alert('ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว');
            await fetchOrderHistory();
            await fetchProducts(isAdminView);
            if (isAdminView) await fetchAdminOrders();
        } catch (err) {
            alert(err.response?.data?.error || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
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
            alert('อัปเดตข้อมูลสมาชิกสำเร็จ');
            await fetchCustomers();
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการแก้ไขสมาชิก');
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
        await fetchOrderHistory();
        setIsOrderHistoryOpen(true);
    };

    const openProfile = () => {
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

    const handleSaveProfile = async (event) => {
        event.preventDefault();

        if (!profileUsername.trim()) {
            alert('กรุณากรอกชื่อผู้ใช้');
            return;
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
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
            alert('อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว');
            setIsProfileOpen(false);
        } catch (err) {
            alert(err.response?.data?.error || 'อัปเดตข้อมูลโปรไฟล์ไม่สำเร็จ');
        }
    };

    const handleSaveAddress = async (event) => {
        event.preventDefault();

        if (!addressForm.receiver_name.trim() || !addressForm.address_detail.trim()) {
            alert('กรุณากรอกชื่อผู้รับและที่อยู่');
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
            alert('บันทึกที่อยู่สำเร็จ');
        } catch (err) {
            alert(err.response?.data?.error || 'บันทึกที่อยู่ไม่สำเร็จ');
        }
    };

    const handleSaveCheckoutAddress = async (payload) => {
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
            alert('ตั้งเป็นที่อยู่หลักแล้ว');
        } catch (err) {
            alert(err.response?.data?.error || 'ตั้งที่อยู่หลักไม่สำเร็จ');
        }
    };

    const handleDeleteAddress = async (address) => {
        if (!window.confirm(`ยืนยันลบที่อยู่ของ ${address.receiver_name || 'ผู้รับ'}?`)) return;

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

            alert('ลบที่อยู่สำเร็จ');
        } catch (err) {
            alert(err.response?.data?.error || 'ลบที่อยู่ไม่สำเร็จ');
        }
    };

    const handleLogout = async () => {
        if (window.confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
            const sessionSeconds = Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000));
            const hours = Math.floor(sessionSeconds / 3600);
            const minutes = Math.floor((sessionSeconds % 3600) / 60);
            const seconds = sessionSeconds % 60;
            try {
                await authApi.logout(user?.id, `${hours}ชม. ${minutes}น. ${seconds}ว.`);
            } catch (err) {
                console.error('บันทึก Logout log ไม่สำเร็จ', err);
            }
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setUser(null);
            setIsLoggedIn(false);
            setIsAdminView(false);
            setCart([]);
            setLoginForm({ username: '', password: '' });
        }
    };

    if (!isLoggedIn) {
        return (
            <AuthPage
                isRegisterView={isRegisterView}
                setIsRegisterView={setIsRegisterView}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                registerForm={registerForm}
                setRegisterForm={setRegisterForm}
                loginError={loginError}
                registerMsg={registerMsg}
                onLogin={handleLogin}
                onRegister={handleRegister}
            />
        );
    }

    return (
        <div className="bg-light min-vh-100">
            <AppNavbar
                user={user}
                cart={cart}
                isAdminView={isAdminView}
                setIsAdminView={setIsAdminView}
                adminPage={adminPage}
                setAdminPage={setAdminPage}
                onOpenCart={() => setIsCartOpen(true)}
                onOpenOrderHistory={openOrderHistory}
                onOpenProfile={openProfile}
                onLogout={handleLogout}
            />

            <div className="container mt-4 pb-5">
                {isAdminView ? (
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
                        onOpenStockEdit={(product) => setStockEdit({ id: product.id, amount: 0, remark: '', name: product.name })}
                        onUpdateUser={handleUpdateUser}
                        onDeleteUser={handleDeleteUser}
                        onChangeRole={handleChangeRole}
                    />
                ) : (
                    <StorePage
                        products={products}
                        onAddToCart={addToCart}
                        previewProductId={previewProductId}
                        onPreviewShown={() => setPreviewProductId(null)}
                    />
                )}
            </div>

            <StockEditModal stockEdit={stockEdit} setStockEdit={setStockEdit} onSave={handleUpdateStock} />

            {isCartOpen && (
                <CartModal
                    cart={cart}
                    setCart={setCart}
                    onClose={() => setIsCartOpen(false)}
                    onCheckout={handleCheckout}
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

            {isOrderHistoryOpen && (
                <OrderHistoryModal
                    orders={orderHistory}
                    username={user?.username}
                    onClose={() => setIsOrderHistoryOpen(false)}
                    onUploadReceipt={handleUploadOrderReceipt}
                    onCancelOrder={handleCancelCustomerOrder}
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
        </div>
    );
}

export default App;
