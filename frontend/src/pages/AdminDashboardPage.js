import { useEffect, useMemo, useRef, useState } from 'react';
import * as adminApi from '../api/adminApi';
import { notify } from '../components/AppNotification';

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const orderStatuses = ['ทั้งหมด', 'รอชำระเงิน', 'รอตรวจสอบการชำระเงิน', 'รอจัดการ', 'เตรียมสินค้า', 'กำลังจัดส่ง', 'พร้อมรับสินค้า', 'จัดส่งแล้ว', 'เสร็จสิ้น', 'ยกเลิก'];
const paymentStatuses = ['รอชำระ', 'รอตรวจสอบ', 'ชำระเงินแล้ว', 'ถูกปฏิเสธ', 'ยกเลิก'];
const blockedFulfillmentStatuses = ['เตรียมสินค้า', 'กำลังจัดส่ง', 'จัดส่งแล้ว', 'เสร็จสิ้น'];
const rejectionReasons = ['ยอดเงินไม่ถูกต้อง', 'รูปไม่ชัด', 'ไม่พบรายการโอน', 'หลักฐานไม่ถูกต้อง', 'อื่น ๆ'];
const isPickupOrder = (order) => order.shipping_method === 'รับหน้าร้าน';
const isPaidOrder = (order) => ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status);
const isCancelledOrder = (order) => order?.status === 'ยกเลิก' || order?.payment_status === 'ยกเลิก';
const formatPaymentStatus = (status) => (status === 'ชำระแล้ว' ? 'ชำระเงินแล้ว' : status);
const getPaymentStatusClass = (status) => {
    const normalizedStatus = formatPaymentStatus(status) || 'รอชำระ';
    if (normalizedStatus === 'ชำระเงินแล้ว') return 'paid';
    if (normalizedStatus === 'รอตรวจสอบ') return 'review';
    if (normalizedStatus === 'ยกเลิก') return 'cancelled';
    if (normalizedStatus === 'ถูกปฏิเสธ' || ['หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม'].includes(normalizedStatus)) return 'rejected';
    return 'waiting';
};
const getStatusClass = (status) => {
    if (status === 'ยกเลิก') return 'locked';
    if (status === 'รอตรวจสอบการชำระเงิน') return 'pending';
    if (['รอชำระเงิน', 'รอจัดการ'].includes(status)) return 'low';
    if (status === 'เตรียมสินค้า') return 'pending';
    if (['กำลังจัดส่ง', 'พร้อมรับสินค้า', 'จัดส่งแล้ว'].includes(status)) return 'shipping';
    return 'paid';
};

const DATE_PRESETS = [
    { value: 'today', label: 'วันนี้' },
    { value: '7', label: '7 วันล่าสุด' },
    { value: '30', label: '30 วันล่าสุด' },
    { value: 'month', label: 'เดือนนี้' },
    { value: 'year', label: 'ปีนี้' },
    { value: 'custom', label: 'กำหนดช่วงวันที่' },
];

const getDateRange = (preset, customFrom, customTo) => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    if (preset === '7' || preset === '30') from.setDate(from.getDate() - Number(preset) + 1);
    if (preset === 'month') from.setDate(1);
    if (preset === 'year') {
        from.setMonth(0);
        from.setDate(1);
    }
    if (preset === 'custom') {
        return {
            from: customFrom || now.toISOString().slice(0, 10),
            to: customTo || now.toISOString().slice(0, 10),
        };
    }
    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
};

const formatChartLabel = (value, interval) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '-');
    if (interval === 'year') return String(date.getFullYear() + 543);
    if (interval === 'month') return date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
    if (interval === 'week') return `สัปดาห์ ${date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const renderShippingSheetHtml = (payload, fallbackOrderId, printTimestamp) => {
    const order = payload?.order || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const isPickup = order.shipping_method === 'รับหน้าร้าน';
    const isPosSale = order.shipping_method === 'ขายหน้าร้าน';
    const receiverName = order.receiver_name || order.full_name || order.username || 'ลูกค้าทั่วไป';
    const phone = order.shipping_phone || order.customer_phone || order.phone || '-';
    const addressLine = [
        order.address_detail,
        order.subdistrict ? `ต.${order.subdistrict}` : '',
        order.district ? `อ.${order.district}` : '',
        order.province ? `จ.${order.province}` : '',
        order.postal_code,
    ].filter(Boolean).join(' ');

    return `<section class="sheet">
        <div class="timestamp">${escapeHtml(printTimestamp)}</div>
        <header>
            <div>
                <span>Shipping Document</span>
                <h1>ใบจัดส่งสินค้า</h1>
                <p>สำหรับแนบพัสดุและตรวจสอบก่อนส่งมอบสินค้า</p>
            </div>
            <div>
                <small>เลขที่ออเดอร์</small>
                <strong>#${escapeHtml(order.id || fallbackOrderId)}</strong>
            </div>
        </header>
        <section class="grid">
            <article>
                <h2>ข้อมูลคำสั่งซื้อ</h2>
                <dl>
                    <div><dt>วันที่สั่งซื้อ</dt><dd>${escapeHtml(formatDateTime(order.created_at))}</dd></div>
                    <div><dt>วิธีรับสินค้า</dt><dd>${escapeHtml(order.shipping_method || '-')}</dd></div>
                    <div><dt>สถานะชำระเงิน</dt><dd>${escapeHtml(formatPaymentStatus(order.payment_status) || '-')}</dd></div>
                    <div><dt>สถานะออเดอร์</dt><dd>${escapeHtml(order.status || '-')}</dd></div>
                </dl>
            </article>
            <article>
                <h2>ข้อมูลลูกค้า</h2>
                <dl>
                    <div><dt>ชื่อลูกค้า</dt><dd>${escapeHtml(order.full_name || receiverName)}</dd></div>
                    <div><dt>Username</dt><dd>${escapeHtml(order.username || '-')}</dd></div>
                    <div><dt>เบอร์โทรศัพท์</dt><dd>${escapeHtml(phone)}</dd></div>
                </dl>
            </article>
        </section>
        ${isPickup || isPosSale ? `<section class="pickup">
            <h2>วิธีรับสินค้า</h2>
            <strong>ลูกค้ารับสินค้าด้วยตนเอง</strong>
            <p>${escapeHtml(isPosSale ? 'รายการขายหน้าร้าน ไม่ต้องจัดส่งผ่านขนส่ง' : 'ออเดอร์นี้เป็นการรับสินค้าที่หน้าร้าน')}</p>
        </section>` : `<section class="shipping">
            <div>
                <h2>ที่อยู่จัดส่ง</h2>
                <p><strong>${escapeHtml(receiverName)}</strong></p>
                <p>${escapeHtml(addressLine || '-')}</p>
                <p>โทร: ${escapeHtml(phone)}</p>
            </div>
            <div>
                <h2>ข้อมูลขนส่ง</h2>
                <dl>
                    <div><dt>บริษัทขนส่ง</dt><dd>${escapeHtml(order.shipping_company || order.delivery_company || '-')}</dd></div>
                    <div><dt>เลขพัสดุ</dt><dd>${escapeHtml(order.tracking_no || '-')}</dd></div>
                </dl>
            </div>
        </section>`}
        <section class="items">
            <h2>รายการสินค้าในออเดอร์</h2>
            <table>
                <thead><tr><th>สินค้า</th><th>ตัวเลือก</th><th class="number">จำนวน</th><th class="number">ราคาต่อชิ้น</th><th class="number">ราคารวม</th></tr></thead>
                <tbody>${items.length ? items.map((item) => {
                    const qty = Number(item.quantity || 0);
                    const price = Number(item.price || 0);
                    const options = [item.selected_size && `ไซซ์ ${item.selected_size}`, item.selected_color && `สี ${item.selected_color}`].filter(Boolean).join(' / ') || '-';
                    return `<tr><td>${escapeHtml(item.product_name || '-')}</td><td>${escapeHtml(options)}</td><td class="number">${qty.toLocaleString('th-TH')}</td><td class="number">฿${formatMoney(price)}</td><td class="number">฿${formatMoney(qty * price)}</td></tr>`;
                }).join('') : '<tr><td colspan="5">ไม่มีรายการสินค้า</td></tr>'}</tbody>
            </table>
        </section>
        <section class="total">
            <div><span>ยอดสินค้า</span><strong>฿${formatMoney(order.total_price)}</strong></div>
            <div><span>ค่าส่ง</span><strong>฿${formatMoney(order.shipping_fee)}</strong></div>
            <div><span>ส่วนลด</span><strong>-฿${formatMoney(order.discount)}</strong></div>
            <div class="grand"><span>ยอดรวมทั้งหมด</span><strong>฿${formatMoney(order.final_price ?? order.total_price)}</strong></div>
        </section>
    </section>`;
};

const writeShippingPrintDocument = (popup, bodyContent, shouldPrint = true) => {
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบจัดส่งสินค้า</title>
        <style>
            @page{size:A4;margin:0}
            *{box-sizing:border-box}
            body{margin:0;background:#fff;color:#111;font-family:Arial,Tahoma,sans-serif}
            .screen-actions{display:flex;justify-content:flex-end;gap:10px;width:min(210mm,100%);margin:0 auto 14px;padding-top:18px}
            .screen-actions button{min-height:40px;padding:0 18px;border:0;border-radius:8px;background:#111827;color:#fff;font-weight:800}
            .screen-actions button.secondary{background:#6b7280}
            .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:10mm;background:#fff;break-after:page}
            .sheet:last-child{break-after:auto}
            .timestamp{margin:0 0 8px;font-size:10px;font-weight:700}
            header{display:flex;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:2px solid #111}
            header span,header small,h2{color:#111;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
            h1{margin:4px 0;color:#000;font-size:26px;font-weight:900}
            p{margin:4px 0;color:#111;font-size:12px;line-height:1.5}
            header p{margin:0;color:#333}
            header strong{display:block;margin-top:4px;font-size:24px;text-align:right}
            .grid,.shipping{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
            .grid article,.shipping,.pickup,.items,.total{break-inside:avoid}
            .grid article,.shipping,.pickup{padding:10px;border:1px solid #111}
            h2{margin:0 0 8px}
            dl{display:grid;gap:6px;margin:0}
            dl>div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px}
            dt{color:#444;font-size:11px;font-weight:700}
            dd{min-width:0;margin:0;color:#000;font-size:12px;font-weight:800;overflow-wrap:anywhere}
            .shipping{grid-template-columns:1.35fr .75fr}
            .pickup{margin-top:12px}
            .pickup strong{display:block;color:#000;font-size:18px}
            .items{margin-top:12px}
            table{width:100%;table-layout:fixed;border-collapse:collapse;color:#000;font-size:11px}
            th,td{padding:7px 6px;border:1px solid #111;vertical-align:top;overflow-wrap:anywhere}
            th{background:#f3f4f6;font-weight:900;text-align:left}
            .number{text-align:right;white-space:nowrap}
            .total{width:min(92mm,100%);display:grid;gap:6px;margin:12px 0 0 auto;padding:10px;border:1px solid #111}
            .total>div{display:flex;justify-content:space-between;gap:14px;color:#111;font-size:12px}
            .grand{padding-top:8px;border-top:2px solid #111;color:#000!important;font-size:15px!important;font-weight:900}
            .state{display:grid;min-height:180mm;place-items:center;font-size:16px;font-weight:700}
            .error{color:#991b1b}
            @media print{.screen-actions{display:none}.sheet{width:100%;margin:0;padding:10mm;box-shadow:none}}
        </style></head><body>
        <div class="screen-actions"><button type="button" onclick="window.print()">สร้าง PDF / พิมพ์</button><button type="button" class="secondary" onclick="window.close()">ปิด</button></div>
        ${bodyContent}
        ${shouldPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),150);</script>' : ''}
        </body></html>`);
    popup.document.close();
};

function AdminDashboardPage({
    orders,
    ordersLoading = false,
    onDeleteOrder,
    onUpdateOrderStatus,
    onReviewOrderPayment,
    setAdminPage,
    setIsAdminView,
    currentUser,
    view = 'dashboard',
}) {
    const showOrderManagement = view === 'orders';
    const showDashboard = !showOrderManagement;
    const [trackingInputs, setTrackingInputs] = useState({});
    const [statusFilter, setStatusFilter] = useState('ทั้งหมด');
    const [trackingErrors, setTrackingErrors] = useState({});
    const [savingOrderId, setSavingOrderId] = useState(null);
    const [datePreset, setDatePreset] = useState('30');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [chartInterval, setChartInterval] = useState('day');
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState('');
    const [dashboardData, setDashboardData] = useState({
        summary: {},
        notifications: {},
        sales_series: [],
        top_products: [],
        top_categories: [],
        top_customers: [],
    });
    const [orderSearch, setOrderSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('ทั้งหมด');
    const [deliveryFilter, setDeliveryFilter] = useState('ทั้งหมด');
    const [orderDatePreset, setOrderDatePreset] = useState('30');
    const [orderDateFrom, setOrderDateFrom] = useState('');
    const [orderDateTo, setOrderDateTo] = useState('');
    const [orderSort, setOrderSort] = useState({ key: 'date', direction: 'desc' });
    const [orderPage, setOrderPage] = useState(1);
    const [orderPageSize, setOrderPageSize] = useState(10);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);
    const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
    const [orderNote, setOrderNote] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [paymentReviewSaving, setPaymentReviewSaving] = useState('');
    const [paymentReviewError, setPaymentReviewError] = useState('');
    const [paymentReviewForm, setPaymentReviewForm] = useState({
        verified_amount: '',
        transaction_ref: '',
        review_note: '',
    });
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [selectedPrintOrderIds, setSelectedPrintOrderIds] = useState([]);
    const orderManagementRef = useRef(null);
    const paymentReviewRequestRef = useRef('');
    const scrollToOrderManagement = () => {
        setAdminPage?.('admin-orders');
    };
    const orderRange = useMemo(
        () => getDateRange(orderDatePreset, orderDateFrom, orderDateTo),
        [orderDatePreset, orderDateFrom, orderDateTo],
    );
    const filteredOrders = useMemo(() => {
        const keyword = orderSearch.trim().toLowerCase();
        const from = new Date(`${orderRange.from}T00:00:00`);
        const to = new Date(`${orderRange.to}T23:59:59`);
        return orders.filter((order) => {
            const orderDate = new Date(order.created_at || order.order_date);
            const searchable = [
                order.id,
                order.username,
                order.full_name,
                order.tracking_no,
            ].join(' ').toLowerCase();
            return (!keyword || searchable.includes(keyword))
                && (statusFilter === 'ทั้งหมด' || (order.status || 'รอจัดการ') === statusFilter)
                && (paymentFilter === 'ทั้งหมด'
                    || (paymentFilter === 'ชำระเงินแล้ว'
                        ? ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status)
                        : (order.payment_status || 'รอชำระ') === paymentFilter))
                && (deliveryFilter === 'ทั้งหมด' || (order.shipping_method || '-') === deliveryFilter)
                && (!Number.isNaN(orderDate.getTime()) && orderDate >= from && orderDate <= to);
        }).sort((a, b) => {
            const direction = orderSort.direction === 'asc' ? 1 : -1;
            if (orderSort.key === 'id') return (Number(a.id) - Number(b.id)) * direction;
            if (orderSort.key === 'amount') return ((Number(a.final_price) || 0) - (Number(b.final_price) || 0)) * direction;
            if (orderSort.key === 'status') return String(a.status || '').localeCompare(String(b.status || ''), 'th') * direction;
            return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) * direction;
        });
    }, [orders, orderSearch, statusFilter, paymentFilter, deliveryFilter, orderRange.from, orderRange.to, orderSort]);
    const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
    const visibleOrders = filteredOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);
    const pendingSlipReviewCount = orders.filter((order) => order.payment_status === 'รอตรวจสอบ').length;
    const visiblePaidOrderIds = visibleOrders.filter(isPaidOrder).map((order) => String(order.id));
    const allVisiblePaidSelected = visiblePaidOrderIds.length > 0 && visiblePaidOrderIds.every((id) => selectedPrintOrderIds.includes(id));
    const selectedRange = useMemo(
        () => getDateRange(datePreset, dateFrom, dateTo),
        [datePreset, dateFrom, dateTo],
    );
    const chartMaxRevenue = Math.max(1, ...dashboardData.sales_series.map((item) => Number(item.revenue) || 0));
    const chartMaxOrders = Math.max(1, ...dashboardData.sales_series.map((item) => Number(item.order_count) || 0));
    const chartPoints = dashboardData.sales_series.map((item, index, list) => {
        const width = 740;
        const x = list.length <= 1 ? 390 : 20 + ((index / (list.length - 1)) * width);
        const y = 210 - ((Number(item.revenue) || 0) / chartMaxRevenue) * 170;
        return { ...item, x, y };
    });
    const chartPath = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');

    useEffect(() => {
        // เก็บเลขพัสดุแยกตามออเดอร์ เพื่อให้แก้ในตารางได้โดยไม่กระทบแถวอื่น
        setTrackingInputs((current) => orders.reduce((next, order) => ({
            ...next,
            [order.id]: current[order.id] ?? order.tracking_no ?? '',
        }), {}));
    }, [orders]);

    useEffect(() => {
        setOrderPage(1);
    }, [orderSearch, statusFilter, paymentFilter, deliveryFilter, orderDatePreset, orderDateFrom, orderDateTo, orderPageSize]);

    useEffect(() => {
        if (orderPage > orderTotalPages) setOrderPage(orderTotalPages);
    }, [orderPage, orderTotalPages]);

    useEffect(() => {
        const paidIds = new Set(orders.filter(isPaidOrder).map((order) => String(order.id)));
        setSelectedPrintOrderIds((current) => current.filter((id) => paidIds.has(id)));
    }, [orders]);

    useEffect(() => {
        if (!showDashboard) return;
        let active = true;
        const loadDashboard = async () => {
            setDashboardLoading(true);
            setDashboardError('');
            try {
                const response = await adminApi.getDashboardStats({
                    date_from: selectedRange.from,
                    date_to: selectedRange.to,
                    interval: chartInterval,
                });
                if (active) setDashboardData(response.data || {});
            } catch (err) {
                if (active) setDashboardError(err.response?.data?.error || 'โหลดข้อมูล Dashboard ไม่สำเร็จ');
            } finally {
                if (active) setDashboardLoading(false);
            }
        };
        loadDashboard();
        return () => { active = false; };
    }, [selectedRange.from, selectedRange.to, chartInterval, showDashboard]);

    const navigateQuickAction = (target, view = '') => {
        if (target === 'store') {
            setIsAdminView?.(false);
            return;
        }
        if (view) sessionStorage.setItem('adminProductView', view);
        setAdminPage?.(target);
    };

    const exportReport = (format) => {
        const headers = ['ช่วงเวลา', 'ยอดขาย', 'จำนวนออเดอร์'];
        const rows = dashboardData.sales_series.map((item) => [
            formatChartLabel(item.period, chartInterval),
            Number(item.revenue) || 0,
            Number(item.order_count) || 0,
        ]);
        const fileName = `ecommerce-dashboard-${selectedRange.from}-${selectedRange.to}`;
        if (format === 'pdf') {
            const popup = window.open('', '_blank', 'width=1000,height=720');
            if (!popup) return;
            popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${fileName}</title>
                <style>body{font-family:Arial,sans-serif;padding:28px;color:#17202e}h2{margin-bottom:4px}p{color:#667085}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #dfe4ea;text-align:left}th{background:#f2f4f7}@page{margin:14mm}</style>
                </head><body><h2>E-Commerce Dashboard Report</h2><p>${selectedRange.from} ถึง ${selectedRange.to}</p>
                <table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</table>
                <script>window.onload=()=>window.print();</script></body></html>`);
            popup.document.close();
            return;
        }
        let blob;
        let extension;
        if (format === 'excel') {
            const html = `<html><head><meta charset="utf-8"></head><body><table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
            blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
            extension = 'xls';
        } else {
            blob = new Blob(['\ufeff', [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
            extension = 'csv';
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const updateTrackingInput = (orderId, value) => {
        setTrackingErrors((current) => ({ ...current, [orderId]: '' }));
        setTrackingInputs((current) => ({ ...current, [orderId]: value }));
    };

    const closeOrderDetailModal = () => {
        setSelectedOrder(null);
        setOrderDetails(null);
        setOrderDetailsLoading(false);
        setOrderNote('');
        setPaymentReviewError('');
        setPaymentReviewSaving('');
        paymentReviewRequestRef.current = '';
        setPaymentReviewForm({ verified_amount: '', transaction_ref: '', review_note: '' });
    };

    const loadOrderDetails = async (order) => {
        console.log('[OrderDetailModal] open requested', {
            selectedOrder: order || null,
            selectedData: order || null,
        });

        if (!order?.id) {
            console.log('[OrderDetailModal] blocked empty modal open', {
                selectedOrder: order || null,
                selectedData: order || null,
            });
            return;
        }

        setSelectedOrder(order);
        setOrderDetails(null);
        setOrderDetailsLoading(true);
        setPaymentReviewSaving('');
        paymentReviewRequestRef.current = '';
        try {
            const response = await adminApi.getOrderDetails(order.id);
            const payload = response.data || null;
            console.log('[OrderDetailModal] details loaded', {
                selectedOrder: order,
                selectedData: payload,
            });
            setOrderDetails(payload?.order ? payload : { error: 'ไม่พบข้อมูล' });
            setPaymentReviewError('');
            setPaymentReviewForm({
                verified_amount: payload?.order?.verified_amount ?? '',
                transaction_ref: payload?.order?.transaction_ref || '',
                review_note: payload?.order?.review_note || '',
            });
        } catch (err) {
            setOrderDetails({ error: err.response?.data?.error || 'โหลดรายละเอียดออเดอร์ไม่สำเร็จ' });
        } finally {
            setOrderDetailsLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedOrder && !orderDetails && !orderDetailsLoading) return;
        console.log('[OrderDetailModal] render state', {
            selectedOrder,
            selectedData: orderDetails,
            orderDetailsLoading,
        });
    }, [selectedOrder, orderDetails, orderDetailsLoading]);

    const openOrderPrintPage = async (orderId, order = null) => {
        if (order && !isPaidOrder(order)) {
            notify({ type: 'warning', title: 'ยังพิมพ์ใบจัดส่งไม่ได้', message: 'พิมพ์ใบจัดส่งได้เฉพาะออเดอร์ที่ชำระแล้ว' });
            return;
        }
        const popup = window.open('', '_blank', 'width=1100,height=750');
        if (!popup) return;
        writeShippingPrintDocument(popup, '<section class="sheet"><div class="state">กำลังโหลดข้อมูลใบจัดส่ง PDF...</div></section>', false);
        try {
            const response = await adminApi.getOrderDetails(orderId);
            const payload = response.data || null;
            if (!isPaidOrder(payload?.order || {})) {
                throw new Error(`ออเดอร์ #${payload?.order?.id || orderId} ยังไม่ชำระเงิน ไม่สามารถพิมพ์ใบจัดส่งได้`);
            }
            const printTimestamp = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            writeShippingPrintDocument(popup, renderShippingSheetHtml(payload, orderId, printTimestamp));
        } catch (err) {
            writeShippingPrintDocument(
                popup,
                `<section class="sheet"><div class="state error">${escapeHtml(err.response?.data?.error || err.message || 'โหลดข้อมูลใบจัดส่ง PDF ไม่สำเร็จ')}</div></section>`,
                false,
            );
        }
    };

    const togglePrintOrder = (order) => {
        if (!isPaidOrder(order)) return;

        const orderId = String(order.id);
        setSelectedPrintOrderIds((current) => (
            current.includes(orderId)
                ? current.filter((id) => id !== orderId)
                : [...current, orderId]
        ));
    };

    const toggleVisiblePaidOrders = () => {
        setSelectedPrintOrderIds((current) => {
            if (allVisiblePaidSelected) {
                return current.filter((id) => !visiblePaidOrderIds.includes(id));
            }
            return Array.from(new Set([...current, ...visiblePaidOrderIds]));
        });
    };

    const openSelectedPrintPage = async () => {
        if (selectedPrintOrderIds.length === 0) {
            notify({ type: 'warning', title: 'ยังไม่ได้เลือกออเดอร์', message: 'กรุณาเลือกออเดอร์ที่ชำระแล้วก่อนพิมพ์ใบจัดส่ง' });
            return;
        }
        const idsToPrint = [...selectedPrintOrderIds];
        const popup = window.open('', '_blank', 'width=1100,height=750');
        if (!popup) return;
        writeShippingPrintDocument(popup, '<section class="sheet"><div class="state">กำลังโหลดข้อมูลใบจัดส่ง PDF...</div></section>', false);
        try {
            const responses = await Promise.all(idsToPrint.map((orderId) => adminApi.getOrderDetails(orderId)));
            const payloads = responses.map((response) => response.data || null).filter(Boolean);
            const unpaidOrder = payloads.find((item) => !isPaidOrder(item?.order || {}));
            if (unpaidOrder) {
                throw new Error(`ออเดอร์ #${unpaidOrder.order?.id || '-'} ยังไม่ชำระเงิน ไม่สามารถพิมพ์ใบจัดส่งได้`);
            }
            const printTimestamp = new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            writeShippingPrintDocument(
                popup,
                payloads.map((payload, index) => renderShippingSheetHtml(payload, idsToPrint[index], printTimestamp)).join(''),
            );
        } catch (err) {
            writeShippingPrintDocument(
                popup,
                `<section class="sheet"><div class="state error">${escapeHtml(err.response?.data?.error || err.message || 'โหลดข้อมูลใบจัดส่ง PDF ไม่สำเร็จ')}</div></section>`,
                false,
            );
        }
    };

    const saveOrderNote = async () => {
        if (!selectedOrder || !orderNote.trim() || noteSaving) return;
        setNoteSaving(true);
        try {
            await adminApi.addOrderNote(selectedOrder.id, orderNote.trim(), currentUser?.id);
            setOrderNote('');
            const response = await adminApi.getOrderDetails(selectedOrder.id);
            setOrderDetails(response.data || null);
        } catch (err) {
            notify({ type: 'error', title: 'เพิ่มหมายเหตุไม่สำเร็จ', message: err.response?.data?.error || 'เพิ่มหมายเหตุไม่สำเร็จ' });
        } finally {
            setNoteSaving(false);
        }
    };

    const refreshSelectedOrderDetails = async (orderId) => {
        const response = await adminApi.getOrderDetails(orderId);
        const payload = response.data || null;
        setOrderDetails(payload);
        if (payload?.order) {
            setSelectedOrder((current) => current ? ({
                ...current,
                status: payload.order.status,
                payment_status: payload.order.payment_status,
                tracking_no: payload.order.tracking_no,
            }) : current);
            setPaymentReviewForm({
                verified_amount: payload.order.verified_amount ?? '',
                transaction_ref: payload.order.transaction_ref || '',
                review_note: payload.order.review_note || '',
            });
        }
        return payload;
    };

    const updatePaymentReviewForm = (field, value) => {
        setPaymentReviewError('');
        setPaymentReviewForm((current) => ({ ...current, [field]: value }));
    };

    const reviewPaymentEvidence = async (action) => {
        if (!selectedOrder || paymentReviewSaving || paymentReviewRequestRef.current) return;

        const currentPaymentStatus = formatPaymentStatus(orderDetails?.order?.payment_status || selectedOrder.payment_status);
        if (currentPaymentStatus !== 'รอตรวจสอบ') {
            setPaymentReviewError('คำสั่งซื้อนี้ตรวจสอบการชำระเงินแล้ว');
            return;
        }

        const needsReason = action === 'reject';
        if (needsReason && !paymentReviewForm.review_note.trim()) {
            setPaymentReviewError('กรุณาเลือกหรือกรอกเหตุผลการตรวจสอบ');
            return;
        }

        paymentReviewRequestRef.current = `${selectedOrder.id}:${action}`;
        setPaymentReviewSaving(action);
        setPaymentReviewError('');
        let reviewSaved = false;
        try {
            const payload = {
                action,
                user_id: currentUser?.id,
                verified_amount: paymentReviewForm.verified_amount,
                transaction_ref: paymentReviewForm.transaction_ref,
                review_note: paymentReviewForm.review_note,
            };
            if (onReviewOrderPayment) {
                await onReviewOrderPayment(selectedOrder.id, payload);
            } else {
                await adminApi.reviewOrderPayment(selectedOrder.id, payload);
            }
            reviewSaved = true;
            await refreshSelectedOrderDetails(selectedOrder.id);
            notify({
                type: 'success',
                title: action === 'approve' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธหลักฐานแล้ว',
                message: action === 'approve' ? 'อัปเดตสถานะออเดอร์เรียบร้อย' : 'ลูกค้าสามารถอัปโหลดสลิปใหม่ได้',
            });
        } catch (err) {
            if (!reviewSaved) paymentReviewRequestRef.current = '';
            setPaymentReviewError(err.response?.data?.error || 'บันทึกผลตรวจสอบการชำระเงินไม่สำเร็จ');
        } finally {
            setPaymentReviewSaving('');
        }
    };

    const changeOrderSort = (key) => {
        setOrderSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const orderSortMarker = (key) => (orderSort.key === key ? (orderSort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕');

    const clearOrderFilters = () => {
        setOrderSearch('');
        setStatusFilter('ทั้งหมด');
        setPaymentFilter('ทั้งหมด');
        setDeliveryFilter('ทั้งหมด');
        setOrderDatePreset('30');
        setOrderDateFrom('');
        setOrderDateTo('');
    };

    const exportOrders = (format) => {
        const headers = ['เลขออเดอร์', 'วันที่สั่งซื้อ', 'ลูกค้า', 'สถานะการชำระเงิน', 'วิธีรับสินค้า', 'เลขพัสดุ', 'ยอดสุทธิ', 'สถานะออเดอร์'];
        const rows = filteredOrders.map((order) => [
            `#${order.id}`,
            new Date(order.created_at).toLocaleString('th-TH'),
            order.full_name || order.username || 'ลูกค้าทั่วไป',
            formatPaymentStatus(order.payment_status) || 'รอชำระ',
            order.shipping_method || '-',
            order.tracking_no || '-',
            Number(order.final_price ?? order.total_price) || 0,
            order.status || 'รอจัดการ',
        ]);
        const fileName = `order-report-${orderRange.from}-${orderRange.to}`;
        if (format === 'pdf') {
            const popup = window.open('', '_blank', 'width=1200,height=760');
            if (!popup) return;
            popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${fileName}</title>
                <style>body{font-family:Arial,sans-serif;padding:24px;color:#17202e}h2{margin:0 0 4px}p{color:#667085}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border:1px solid #dfe4ea;text-align:left}th{background:#f2f4f7}@page{size:landscape;margin:10mm}</style>
                </head><body><h2>Order Management Report</h2><p>${filteredOrders.length} ออเดอร์ · ${orderRange.from} ถึง ${orderRange.to}</p>
                <table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</table>
                <script>window.onload=()=>window.print();</script></body></html>`);
            popup.document.close();
            return;
        }
        let blob;
        let extension;
        if (format === 'excel') {
            const html = `<html><head><meta charset="utf-8"></head><body><table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${item}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
            blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
            extension = 'xls';
        } else {
            blob = new Blob(['\ufeff', [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
            extension = 'csv';
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const runOrderStep = async (order, nextStatus) => {
        if (savingOrderId) return;
        const trackingNo = trackingInputs[order.id] || '';
        const paymentStatus = orderDetails?.order?.payment_status || order.payment_status;

        if (blockedFulfillmentStatuses.includes(nextStatus) && !isPaidOrder({ payment_status: paymentStatus })) {
            notify({ type: 'warning', title: 'ยังดำเนินการจัดส่งไม่ได้', message: 'ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง' });
            return;
        }

        if (nextStatus === 'กำลังจัดส่ง' && !trackingNo.trim()) {
            setTrackingErrors((current) => ({
                ...current,
                [order.id]: 'กรุณากรอกเลขพัสดุก่อนเปลี่ยนเป็นกำลังจัดส่ง',
            }));
            return;
        }

        try {
            setSavingOrderId(order.id);
            const result = await onUpdateOrderStatus(order.id, trackingNo, nextStatus);
            if (result?.success) {
                setTrackingErrors((current) => ({ ...current, [order.id]: '' }));
                if (selectedOrder?.id === order.id) {
                    const response = await adminApi.getOrderDetails(order.id);
                    setOrderDetails(response.data || null);
                    setSelectedOrder((current) => ({ ...current, status: nextStatus, tracking_no: trackingNo || current.tracking_no }));
                }
                return;
            }
            if (!result?.success && result?.message) {
                if (result.field === 'tracking_no') {
                    setTrackingErrors((current) => ({ ...current, [order.id]: result.message }));
                } else {
                    notify({ type: 'error', title: 'อัปเดตสถานะไม่สำเร็จ', message: result.message });
                }
            }
        } finally {
            setSavingOrderId(null);
        }
    };

    const detailOrder = orderDetails?.order || null;
    const detailItems = Array.isArray(orderDetails?.items) ? orderDetails.items : [];
    const detailHistory = Array.isArray(orderDetails?.history) ? orderDetails.history : [];
    const detailNotes = Array.isArray(orderDetails?.notes) ? orderDetails.notes : [];
    const detailPaymentStatus = formatPaymentStatus(detailOrder?.payment_status) || 'รอชำระ';
    const detailOrderIsPaid = isPaidOrder(detailOrder || selectedOrder || {});
    const paymentReviewDisabled = !detailOrder?.receipt_image || Boolean(paymentReviewSaving) || detailPaymentStatus !== 'รอตรวจสอบ';
    const shouldWarnPaymentReview = detailOrder && !detailOrderIsPaid && ['ถูกปฏิเสธ', 'หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม', 'รอตรวจสอบ'].includes(detailPaymentStatus);

    return (
        <div className="commerce-dashboard">
            {showDashboard && (
                <>
            <section className="commerce-heading">
                <div>
                    <span>STORE PERFORMANCE</span>
                    <h1>ภาพรวมร้านค้า</h1>
                    <p>ยอดขาย ออเดอร์ สต๊อก และลูกค้า — ข้อมูลสำคัญครบใน 5 วินาที</p>
                </div>
                <div className="commerce-heading-actions">
                    <div className="commerce-date-filter">
                        <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
                            {DATE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        {datePreset === 'custom' && (
                            <>
                                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                            </>
                        )}
                    </div>
                    <div className="commerce-export">
                        <button type="button" onClick={() => exportReport('csv')}>CSV</button>
                        <button type="button" onClick={() => exportReport('excel')}>Excel</button>
                        <button type="button" className="primary" onClick={() => exportReport('pdf')}>PDF</button>
                    </div>
                </div>
            </section>

            {dashboardError && <div className="commerce-error">{dashboardError}</div>}

            <section className="commerce-primary-stats">
                {dashboardLoading ? [...Array(4)].map((_, index) => <div key={index} className="commerce-stat-card skeleton"><i /></div>) : (
                    <>
                        <article className="commerce-stat-card revenue">
                            <div className="commerce-stat-icon">฿</div>
                            <div><span>ยอดขายในช่วงนี้</span><strong>฿{formatMoney(dashboardData.summary?.total_revenue)}</strong><small>ไม่รวมออเดอร์ยกเลิก</small></div>
                        </article>
                        <article
                            className="commerce-stat-card orders is-clickable"
                            role="button"
                            tabIndex={0}
                            aria-label="ไปยังรายการสั่งซื้อและแจ้งชำระเงิน"
                            onClick={scrollToOrderManagement}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    scrollToOrderManagement();
                                }
                            }}
                        >
                            <div className="commerce-stat-icon">▣</div>
                            <div><span>จำนวนออเดอร์</span><strong>{Number(dashboardData.summary?.total_orders || 0).toLocaleString('th-TH')}</strong><small>เฉลี่ย ฿{formatMoney(dashboardData.summary?.average_order_value)} / ออเดอร์</small></div>
                        </article>
                        <article className="commerce-stat-card members">
                            <div className="commerce-stat-icon">♙</div>
                            <div><span>สมาชิกทั้งหมด</span><strong>{Number(dashboardData.summary?.total_members || 0).toLocaleString('th-TH')}</strong><small>+{Number(dashboardData.summary?.new_members_today || 0).toLocaleString('th-TH')} สมาชิกใหม่วันนี้</small></div>
                        </article>
                        <article className="commerce-stat-card products">
                            <div className="commerce-stat-icon">◇</div>
                            <div><span>สินค้าทั้งหมด</span><strong>{Number(dashboardData.summary?.total_products || 0).toLocaleString('th-TH')}</strong><small>{Number(dashboardData.summary?.low_stock || 0)} ใกล้หมด · {Number(dashboardData.summary?.out_of_stock || 0)} หมดสต๊อก</small></div>
                        </article>
                    </>
                )}
            </section>

            <section className="commerce-main-grid">
                <div className="commerce-card commerce-chart-card">
                    <header className="commerce-card-header">
                        <div><span>SALES ANALYTICS</span><h2>แนวโน้มยอดขายและออเดอร์</h2></div>
                        <div className="commerce-chart-tabs">
                            {[['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'รายปี']].map(([value, label]) => (
                                <button key={value} type="button" className={chartInterval === value ? 'active' : ''} onClick={() => setChartInterval(value)}>{label}</button>
                            ))}
                        </div>
                    </header>
                    {dashboardLoading ? <div className="commerce-chart-skeleton"><i /><i /><i /><i /></div> : dashboardData.sales_series?.length ? (
                        <div className="commerce-chart">
                            <div className="commerce-chart-legend"><span><i className="revenue" /> ยอดขาย</span><span><i className="orders" /> จำนวนออเดอร์</span></div>
                            <svg viewBox="0 0 800 260" role="img" aria-label="กราฟยอดขายและจำนวนออเดอร์">
                                {[40, 82, 124, 166, 208].map((y) => <line key={y} x1="20" y1={y} x2="780" y2={y} className="commerce-grid-line" />)}
                                {chartPoints.map((point) => (
                                    <rect key={`bar-${point.period}`} x={point.x + 14} y={210 - ((Number(point.order_count) || 0) / chartMaxOrders) * 120} width="14" height={((Number(point.order_count) || 0) / chartMaxOrders) * 120} rx="5" className="commerce-order-bar" />
                                ))}
                                <path d={chartPath} className="commerce-revenue-line" />
                                {chartPoints.map((point) => <circle key={`dot-${point.period}`} cx={point.x} cy={point.y} r="5" className="commerce-revenue-dot"><title>{formatChartLabel(point.period, chartInterval)}: ฿{formatMoney(point.revenue)} · {point.order_count} ออเดอร์</title></circle>)}
                            </svg>
                            <div className="commerce-chart-labels">
                                {chartPoints.slice(-7).map((point) => <span key={point.period}>{formatChartLabel(point.period, chartInterval)}</span>)}
                            </div>
                        </div>
                    ) : <div className="commerce-empty-chart">ยังไม่มียอดขายในช่วงเวลาที่เลือก</div>}
                </div>

                <aside className="commerce-card commerce-notifications">
                    <header className="commerce-card-header"><div><span>ATTENTION NEEDED</span><h2>ศูนย์แจ้งเตือน</h2></div><b>{Object.values(dashboardData.notifications || {}).reduce((sum, value) => sum + Number(value || 0), 0)}</b></header>
                    {[
                        ['new_orders', 'ออเดอร์ใหม่วันนี้', 'blue', () => navigateQuickAction('admin-orders')],
                        ['waiting_payment', 'รอชำระเงิน', 'amber', () => navigateQuickAction('admin-orders')],
                        ['waiting_review', 'รอตรวจสอบสลิป', 'purple', () => navigateQuickAction('admin-orders')],
                        ['low_stock', 'สินค้าใกล้หมด', 'orange', () => navigateQuickAction('add-product', 'products')],
                        ['out_of_stock', 'สินค้าหมดสต๊อก', 'red', () => navigateQuickAction('add-product', 'products')],
                    ].map(([key, label, color, action]) => (
                        <button type="button" key={key} onClick={action}>
                            <i className={color} /><span>{label}</span><strong>{Number(dashboardData.notifications?.[key] || 0).toLocaleString('th-TH')}</strong><em>›</em>
                        </button>
                    ))}
                </aside>
            </section>

            <section className="commerce-card commerce-quick-actions">
                <header className="commerce-card-header"><div><span>SHORTCUTS</span><h2>เมนูใช้งานด่วน</h2></div></header>
                <div>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'products')}><b className="blue">＋</b><span>เพิ่มสินค้า<small>สร้างสินค้าใหม่</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'categories')}><b className="purple">▦</b><span>เพิ่มหมวดหมู่<small>จัดระเบียบสินค้า</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('store')}><b className="green">▣</b><span>สร้างออเดอร์<small>ไปยังหน้าร้าน</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('customers')}><b className="amber">♙</b><span>จัดการสมาชิก<small>ดูข้อมูลลูกค้า</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'products')}><b className="red">▤</b><span>จัดการสต๊อก<small>ตรวจจำนวนคงเหลือ</small></span></button>
                </div>
            </section>

            <section className="commerce-top-grid">
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>TOP PRODUCTS</span><h2>สินค้าขายดีที่สุด</h2></div></header>
                    {(dashboardData.top_products || []).length ? dashboardData.top_products.map((item, index) => (
                        <div className="commerce-rank-row" key={item.product_id}><b>{index + 1}</b><div><strong>{item.product_name}</strong><small>{Number(item.units_sold || 0).toLocaleString('th-TH')} ชิ้น</small></div><span>฿{formatMoney(item.revenue)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลสินค้า</p>}
                </div>
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>TOP CATEGORIES</span><h2>หมวดหมู่ขายดีที่สุด</h2></div></header>
                    {(dashboardData.top_categories || []).length ? dashboardData.top_categories.map((item, index) => (
                        <div className="commerce-rank-row" key={item.category_id}><b>{index + 1}</b><div><strong>{item.category_name}</strong><small>{Number(item.units_sold || 0).toLocaleString('th-TH')} ชิ้น</small></div><span>฿{formatMoney(item.revenue)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลหมวดหมู่</p>}
                </div>
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>TOP CUSTOMERS</span><h2>ลูกค้ายอดซื้อสูงสุด</h2></div></header>
                    {(dashboardData.top_customers || []).length ? dashboardData.top_customers.map((item, index) => (
                        <div className="commerce-rank-row" key={item.user_id}><b>{index + 1}</b><div><strong>{item.full_name || item.username}</strong><small>{Number(item.order_count || 0).toLocaleString('th-TH')} ออเดอร์</small></div><span>฿{formatMoney(item.total_spent)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลลูกค้า</p>}
                </div>
            </section>
                </>
            )}

            {showOrderManagement && (
                <>
            <section ref={orderManagementRef} className="order-management">
                <header className="order-management-heading">
                    <div>
                        <span>ORDER MANAGEMENT</span>
                        <h2>รายการสั่งซื้อและแจ้งชำระเงิน</h2>
                        <p>ค้นหา ตรวจสอบ และดำเนินการออเดอร์จำนวนมากจากพื้นที่เดียว</p>
                    </div>
                    <div className="order-export">
                        <button type="button" onClick={() => exportOrders('csv')}>CSV</button>
                        <button type="button" onClick={() => exportOrders('excel')}>Excel</button>
                        <button type="button" className="primary" onClick={() => exportOrders('pdf')}>PDF</button>
                    </div>
                </header>

                {pendingSlipReviewCount > 0 && (
                    <div className="payment-review-admin-alert">
                        <strong>มีหลักฐานการชำระเงินใหม่รอตรวจสอบ {pendingSlipReviewCount.toLocaleString('th-TH')} รายการ</strong>
                        <button type="button" onClick={() => setPaymentFilter('รอตรวจสอบ')}>ดูรายการรอตรวจสอบ</button>
                    </div>
                )}

                <div className="order-filter-panel">
                    <label className="order-search">
                        <span>⌕</span>
                        <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="ค้นหาเลขออเดอร์ ชื่อลูกค้า หรือเลขพัสดุ..." />
                    </label>
                    <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                        <option value="ทั้งหมด">การชำระเงินทั้งหมด</option>
                        {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        {orderStatuses.map((status) => <option key={status} value={status}>{status === 'ทั้งหมด' ? 'สถานะออเดอร์ทั้งหมด' : status}</option>)}
                    </select>
                    <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
                        <option value="ทั้งหมด">วิธีรับสินค้าทั้งหมด</option>
                        <option value="ส่งสินค้า">ส่งสินค้า</option>
                        <option value="รับหน้าร้าน">รับหน้าร้าน</option>
                        <option value="ขายหน้าร้าน">ขายหน้าร้าน (POS)</option>
                    </select>
                    <select value={orderDatePreset} onChange={(event) => setOrderDatePreset(event.target.value)}>
                        {DATE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <button type="button" className="order-clear" onClick={clearOrderFilters}>ล้างตัวกรอง</button>
                </div>

                {orderDatePreset === 'custom' && (
                    <div className="order-custom-date">
                        <label>ตั้งแต่ <input type="date" value={orderDateFrom} onChange={(event) => setOrderDateFrom(event.target.value)} /></label>
                        <label>ถึง <input type="date" value={orderDateTo} onChange={(event) => setOrderDateTo(event.target.value)} /></label>
                    </div>
                )}

                <div className="order-print-bulk-bar">
                    <div>
                        <strong>พิมพ์ใบจัดส่งพร้อมกัน</strong>
                        <span>เลือกได้เฉพาะออเดอร์ที่ชำระแล้ว ระบบจะเปิดหน้า PDF/Print รวมเป็นชุดเดียว</span>
                    </div>
                    <button type="button" onClick={openSelectedPrintPage} disabled={selectedPrintOrderIds.length === 0}>
                        สร้าง PDF / พิมพ์ {selectedPrintOrderIds.length > 0 ? `(${selectedPrintOrderIds.length})` : ''}
                    </button>
                </div>

                <div className="order-table-wrap">
                    <table className="order-table">
                        <thead>
                            <tr>
                                <th className="order-select-col">
                                    <input
                                        type="checkbox"
                                        checked={allVisiblePaidSelected}
                                        disabled={visiblePaidOrderIds.length === 0}
                                        onChange={toggleVisiblePaidOrders}
                                        aria-label="เลือกออเดอร์ที่ชำระแล้วในหน้านี้"
                                    />
                                </th>
                                <th><button type="button" onClick={() => changeOrderSort('id')}>เลขออเดอร์{orderSortMarker('id')}</button></th>
                                <th><button type="button" onClick={() => changeOrderSort('date')}>วันที่สั่งซื้อ{orderSortMarker('date')}</button></th>
                                <th>ลูกค้า</th>
                                <th>สถานะการชำระเงิน</th>
                                <th>วิธีรับสินค้า</th>
                                <th>เลขพัสดุ</th>
                                <th className="text-end"><button type="button" onClick={() => changeOrderSort('amount')}>ยอดสุทธิ{orderSortMarker('amount')}</button></th>
                                <th><button type="button" onClick={() => changeOrderSort('status')}>สถานะออเดอร์{orderSortMarker('status')}</button></th>
                                <th>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ordersLoading ? [...Array(6)].map((_, index) => (
                                <tr key={`order-skeleton-${index}`} className="order-skeleton"><td colSpan="10"><i /></td></tr>
                            )) : visibleOrders.length ? visibleOrders.map((order) => {
                                const paymentStatus = formatPaymentStatus(order.payment_status) || 'รอชำระ';
                                const currentStatus = order.status || 'รอจัดการ';
                                const orderIsPaid = isPaidOrder(order);
                                const orderIdText = String(order.id);
                                return (
                                    <tr key={order.id} onClick={() => loadOrderDetails(order)}>
                                        <td data-label="เลือก" className="order-select-col">
                                            <input
                                                type="checkbox"
                                                checked={selectedPrintOrderIds.includes(orderIdText)}
                                                disabled={!orderIsPaid}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={() => togglePrintOrder(order)}
                                                aria-label={`เลือกออเดอร์ #${order.id} สำหรับพิมพ์ใบจัดส่ง`}
                                            />
                                        </td>
                                        <td data-label="เลขออเดอร์"><strong className="order-number">#{order.id}</strong></td>
                                        <td data-label="วันที่สั่งซื้อ"><span className="order-date">{new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span></td>
                                        <td data-label="ลูกค้า"><strong>{order.full_name || order.username || 'ลูกค้าทั่วไป'}</strong><small>{order.username ? `@${order.username}` : ''}</small></td>
                                        <td data-label="การชำระเงิน"><span className={`payment-badge ${getPaymentStatusClass(paymentStatus)}`}>{paymentStatus}</span></td>
                                        <td data-label="วิธีรับสินค้า"><span className="delivery-badge">{order.shipping_method || '-'}</span></td>
                                        <td data-label="เลขพัสดุ"><span className={order.tracking_no ? 'order-tracking active' : 'order-tracking'}>{order.tracking_no || 'ยังไม่มี'}</span></td>
                                        <td data-label="ยอดสุทธิ" className="order-total">฿{formatMoney(order.final_price ?? order.total_price)}</td>
                                        <td data-label="สถานะออเดอร์"><span className={`admin-status ${getStatusClass(currentStatus)}`}>{currentStatus}</span></td>
                                        <td data-label="จัดการ">
                                            <div className="order-row-actions">
                                                <button type="button" className="order-detail-trigger" onClick={(event) => { event.stopPropagation(); loadOrderDetails(order); }}>ดูรายละเอียด</button>
                                                <button
                                                    type="button"
                                                    className="order-print-trigger"
                                                    disabled={!orderIsPaid}
                                                    title={orderIsPaid ? 'เปิดหน้าใบจัดส่ง PDF' : 'พิมพ์ได้เมื่อชำระแล้วเท่านั้น'}
                                                    onClick={(event) => { event.stopPropagation(); openOrderPrintPage(order.id, order); }}
                                                >
                                                    พิมพ์ใบจัดส่ง
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan="10"><div className="order-empty"><b>⌕</b><strong>ไม่พบออเดอร์</strong><span>ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่</span><button type="button" onClick={clearOrderFilters}>ล้างตัวกรองทั้งหมด</button></div></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <footer className="order-pagination">
                    <label>แสดง
                        <select value={orderPageSize} onChange={(event) => setOrderPageSize(Number(event.target.value))}>
                            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                        รายการ
                    </label>
                    <span>{filteredOrders.length ? ((orderPage - 1) * orderPageSize) + 1 : 0}–{Math.min(orderPage * orderPageSize, filteredOrders.length)} จาก {filteredOrders.length.toLocaleString('th-TH')} ออเดอร์</span>
                    <div>
                        <button type="button" disabled={orderPage === 1} onClick={() => setOrderPage(1)}>«</button>
                        <button type="button" disabled={orderPage === 1} onClick={() => setOrderPage((page) => page - 1)}>‹</button>
                        <b>{orderPage} / {orderTotalPages}</b>
                        <button type="button" disabled={orderPage === orderTotalPages} onClick={() => setOrderPage((page) => page + 1)}>›</button>
                        <button type="button" disabled={orderPage === orderTotalPages} onClick={() => setOrderPage(orderTotalPages)}>»</button>
                    </div>
                </footer>
            </section>

            {selectedOrder && (
                <div className="order-modal-backdrop" role="presentation" onMouseDown={closeOrderDetailModal}>
                    <div className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-modal-title" onMouseDown={(event) => event.stopPropagation()}>
                        <header>
                            <div>
                                <span>ORDER DETAILS</span>
                                <h2 id="order-detail-modal-title">รายละเอียดคำสั่งซื้อ #{selectedOrder.id}</h2>
                                <p>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('th-TH') : 'ไม่ระบุวันที่สั่งซื้อ'}</p>
                            </div>
                            <button type="button" onClick={closeOrderDetailModal} aria-label="ปิดหน้าต่างรายละเอียดคำสั่งซื้อ">×</button>
                        </header>
                        {orderDetailsLoading ? (
                            <div className="order-modal-loading" role="status" aria-live="polite">
                                <strong>กำลังโหลดรายละเอียดคำสั่งซื้อ...</strong>
                                <i /><i /><i />
                            </div>
                        ) : orderDetails?.error ? (
                            <div className="order-modal-state">
                                <strong>{orderDetails.error || 'ไม่พบข้อมูล'}</strong>
                                <span>ไม่สามารถแสดงรายละเอียดคำสั่งซื้อนี้ได้ กรุณาลองเปิดใหม่อีกครั้ง</span>
                                <button type="button" onClick={closeOrderDetailModal}>ปิดหน้าต่าง</button>
                            </div>
                        ) : !detailOrder ? (
                            <div className="order-modal-state">
                                <strong>ไม่พบข้อมูล</strong>
                                <span>ยังไม่มีข้อมูลรายละเอียดสำหรับคำสั่งซื้อนี้</span>
                                <button type="button" onClick={closeOrderDetailModal}>ปิดหน้าต่าง</button>
                            </div>
                        ) : (
                            <div className="order-modal-body">
                                <section className="order-detail-summary">
                                    <div><span>ลูกค้า</span><strong>{detailOrder.full_name || detailOrder.username || 'ลูกค้าทั่วไป'}</strong><small>{detailOrder.email || '-'} · {detailOrder.customer_phone || '-'}</small></div>
                                    <div><span>สถานะการชำระเงิน</span><strong>{detailPaymentStatus}</strong><small>{detailOrder.payment_method || '-'}</small></div>
                                    <div><span>ยอดสุทธิ</span><strong>฿{formatMoney(detailOrder.final_price)}</strong><small>สินค้า ฿{formatMoney(detailOrder.total_price)} · ค่าส่ง ฿{formatMoney(detailOrder.shipping_fee)}</small></div>
                                    <div><span>สถานะออเดอร์</span><strong>{detailOrder.status || '-'}</strong><small>{detailOrder.tracking_no || 'ยังไม่มีเลขพัสดุ'}</small></div>
                                </section>

                                <div className="order-modal-grid">
                                    <section className="order-detail-card">
                                        <h3>สินค้าในออเดอร์</h3>
                                        <div className="order-items">
                                            {detailItems.length ? detailItems.map((item) => (
                                                <article key={item.order_detail_id}>
                                                    {item.product_image ? <img src={item.product_image} alt={item.product_name || 'สินค้า'} /> : <b>◇</b>}
                                                    <div><strong>{item.product_name || `สินค้า #${item.product_id}`}</strong><small>{[item.selected_size && `ไซซ์ ${item.selected_size}`, item.selected_color && `สี ${item.selected_color}`].filter(Boolean).join(' · ') || 'ตัวเลือกมาตรฐาน'}</small></div>
                                                    <span>{item.quantity} × ฿{formatMoney(item.price)}</span>
                                                </article>
                                            )) : <div className="order-empty-inline">ไม่พบรายการสินค้าในออเดอร์นี้</div>}
                                        </div>
                                    </section>
                                    <section className="order-detail-card">
                                        <h3>ข้อมูลจัดส่ง</h3>
                                        <p><strong>{detailOrder.receiver_name || detailOrder.full_name || '-'}</strong></p>
                                        <p>{detailOrder.address_detail || selectedOrder.address || '-'}</p>
                                        <p>{[detailOrder.subdistrict, detailOrder.district, detailOrder.province, detailOrder.postal_code].filter(Boolean).join(' ') || '-'}</p>
                                        <p>โทร: {detailOrder.shipping_phone || detailOrder.customer_phone || '-'}</p>
                                        <span className="delivery-badge">{detailOrder.shipping_method || '-'}</span>
                                    </section>
                                    <section className="order-detail-card">
                                        <h3>หลักฐานการชำระเงิน</h3>
                                        {detailOrder.receipt_image ? (
                                            <button
                                                type="button"
                                                className="order-receipt"
                                                onClick={() => setReceiptPreview({
                                                    src: detailOrder.receipt_image,
                                                    orderId: selectedOrder.id,
                                                })}
                                            >
                                                <img src={detailOrder.receipt_image} alt={`สลิปออเดอร์ ${selectedOrder.id}`} />
                                                <span>ดูภาพขนาดใหญ่</span>
                                            </button>
                                        ) : <div className="order-no-receipt">ยังไม่มีหลักฐานการชำระเงิน</div>}
                                        {shouldWarnPaymentReview && (
                                            <div className="payment-review-warning">
                                                {detailPaymentStatus === 'ถูกปฏิเสธ' ? `หลักฐานถูกปฏิเสธ${detailOrder.review_note ? `: ${detailOrder.review_note}` : ''}` : 'ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง'}
                                            </div>
                                        )}
                                        <div className="payment-review-box">
                                            <div className="payment-review-meta">
                                                <div><span>ยอดที่ต้องชำระ</span><strong>฿{formatMoney(detailOrder.final_price)}</strong></div>
                                                <div><span>วันที่ส่งสลิป</span><strong>{detailOrder.payment_date ? new Date(detailOrder.payment_date).toLocaleString('th-TH') : '-'}</strong></div>
                                                <label>ยอดที่ตรวจพบ<input type="number" min="0" step="0.01" value={paymentReviewForm.verified_amount} onChange={(event) => updatePaymentReviewForm('verified_amount', event.target.value)} placeholder="0.00" /></label>
                                                <label>เลขอ้างอิงรายการ<input value={paymentReviewForm.transaction_ref} onChange={(event) => updatePaymentReviewForm('transaction_ref', event.target.value)} placeholder="เช่น Ref / Transaction ID" /></label>
                                                <div><span>ผู้ตรวจสอบ</span><strong>{detailOrder.reviewer_full_name || detailOrder.reviewer_username || '-'}</strong></div>
                                                <div><span>เวลาตรวจสอบ</span><strong>{detailOrder.reviewed_at ? new Date(detailOrder.reviewed_at).toLocaleString('th-TH') : '-'}</strong></div>
                                            </div>
                                            <label className="payment-review-note">
                                                หมายเหตุผลการตรวจสอบ
                                                <select value={rejectionReasons.includes(paymentReviewForm.review_note) ? paymentReviewForm.review_note : ''} onChange={(event) => updatePaymentReviewForm('review_note', event.target.value)}>
                                                    <option value="">เลือกเหตุผลสำเร็จรูป</option>
                                                    {rejectionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                                </select>
                                                <textarea value={paymentReviewForm.review_note} onChange={(event) => updatePaymentReviewForm('review_note', event.target.value)} placeholder="ระบุเหตุผลหรือรายละเอียดเพิ่มเติม..." />
                                            </label>
                                            {paymentReviewError && <div className="payment-review-error">{paymentReviewError}</div>}
                                            <div className="payment-review-actions">
                                                <button type="button" className="approve" disabled={paymentReviewDisabled} onClick={() => reviewPaymentEvidence('approve')}>{paymentReviewSaving === 'approve' ? 'กำลังบันทึก...' : 'อนุมัติการชำระเงิน'}</button>
                                                <button type="button" className="reject" disabled={paymentReviewDisabled} onClick={() => reviewPaymentEvidence('reject')}>{paymentReviewSaving === 'reject' ? 'กำลังบันทึก...' : 'ปฏิเสธหลักฐาน'}</button>
                                            </div>
                                        </div>
                                    </section>
                                    <section className="order-detail-card">
                                        <h3>ประวัติสถานะ</h3>
                                        <div className="order-timeline">
                                            {detailHistory.length ? detailHistory.map((item) => <div key={item.history_id}><i /><div><strong>{item.status}</strong><span>{new Date(item.created_at).toLocaleString('th-TH')}</span><small>{item.note || '-'}{item.full_name || item.username ? ` · โดย ${item.full_name || item.username}` : ''}</small></div></div>) : <div className="order-empty-inline">ยังไม่มีประวัติสถานะ</div>}
                                        </div>
                                    </section>
                                </div>

                                <section className="order-detail-card order-admin-notes">
                                    <h3>หมายเหตุจากแอดมิน</h3>
                                    <div className="order-note-form"><textarea value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder="เพิ่มหมายเหตุภายในสำหรับทีมงาน..." /><button type="button" disabled={noteSaving || !orderNote.trim()} onClick={saveOrderNote}>{noteSaving ? 'กำลังบันทึก...' : 'เพิ่มหมายเหตุ'}</button></div>
                                    <div className="order-note-list">{detailNotes.length ? detailNotes.map((item) => <article key={item.note_id}><p>{item.note}</p><small>{item.full_name || item.username || 'แอดมิน'} · {new Date(item.created_at).toLocaleString('th-TH')}</small></article>) : <span>ยังไม่มีหมายเหตุจากแอดมิน</span>}</div>
                                </section>

                                <section className="order-modal-actions">
                                    {!isPickupOrder(selectedOrder) && selectedOrder.status === 'เตรียมสินค้า' && (
                                        <label>เลขพัสดุ<input value={trackingInputs[selectedOrder.id] || ''} onChange={(event) => updateTrackingInput(selectedOrder.id, event.target.value)} placeholder="กรอกเลขพัสดุ" />{trackingErrors[selectedOrder.id] && <small>{trackingErrors[selectedOrder.id]}</small>}</label>
                                    )}
                                    {!detailOrderIsPaid && (
                                        <div className="order-payment-lock">
                                            ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง
                                        </div>
                                    )}
                                    <div>
                                        {selectedOrder.status === 'รอจัดการ' && <button type="button" className="success" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เตรียมสินค้า')}>เตรียมสินค้า</button>}
                                        {selectedOrder.status === 'เตรียมสินค้า' && !isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'กำลังจัดส่ง')}>เริ่มจัดส่ง</button>}
                                        {selectedOrder.status === 'เตรียมสินค้า' && isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'พร้อมรับสินค้า')}>พร้อมรับสินค้า</button>}
                                        {selectedOrder.status === 'กำลังจัดส่ง' && !isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'จัดส่งแล้ว')}>จัดส่งแล้ว</button>}
                                        {selectedOrder.status === 'จัดส่งแล้ว' && !isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เสร็จสิ้น')}>เสร็จสิ้น</button>}
                                        {selectedOrder.status === 'พร้อมรับสินค้า' && isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เสร็จสิ้น')}>เสร็จสิ้น</button>}
                                        {!isPaidOrder(detailOrder) && !isCancelledOrder(detailOrder || selectedOrder) && (
                                            <button type="button" className="danger" onClick={() => onDeleteOrder(selectedOrder.id, { onDeleted: closeOrderDetailModal })}>ลบออเดอร์</button>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {receiptPreview && (
                <div className="receipt-lightbox" role="presentation" onMouseDown={() => setReceiptPreview(null)}>
                    <section
                        className="receipt-lightbox-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="receipt-lightbox-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>PAYMENT SLIP</span>
                                <h2 id="receipt-lightbox-title">สลิปคำสั่งซื้อ #{receiptPreview.orderId}</h2>
                            </div>
                            <button type="button" onClick={() => setReceiptPreview(null)} aria-label="ปิดรูปสลิป">×</button>
                        </header>
                        <img src={receiptPreview.src} alt={`สลิปคำสั่งซื้อ ${receiptPreview.orderId}`} />
                    </section>
                </div>
            )}
                </>
            )}

        </div>
    );
}

export default AdminDashboardPage;
