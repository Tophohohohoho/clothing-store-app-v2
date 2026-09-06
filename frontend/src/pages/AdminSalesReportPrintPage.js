import { useEffect, useState } from 'react';
import * as adminApi from '../api/adminApi';
import * as productsApi from '../api/productsApi';
import { formatThaiDate } from '../utils/date';
import { resolveMediaUrl } from '../utils/media';

const QUICK_REPORT_DATE_PRESETS = [
    { value: 'today', label: 'วันนี้' },
    { value: '7', label: '7 วันล่าสุด' },
    { value: '15', label: '15 วันล่าสุด' },
    { value: '30', label: '30 วันล่าสุด' },
    { value: '365', label: '1 ปีล่าสุด' },
    { value: 'custom', label: 'กำหนดเอง' },
];

const ORDER_STATUS_REPORT_ROWS = [
    'รอชำระเงิน',
    'รอตรวจสอบการชำระเงิน',
    'กำลังเตรียมสินค้า',
    'กำลังจัดส่ง',
    'พร้อมรับสินค้า',
    'จัดส่งแล้ว',
    'เสร็จสิ้น',
    'ยกเลิกคำสั่งซื้อ',
];

const ORDER_STATUS_DETAIL_REPORTS = ORDER_STATUS_REPORT_ROWS.map((status, index) => ({
    key: `orders-status-${index + 1}`,
    label: `รายงานคำสั่งซื้อเฉพาะสถานะ${status}`,
    status,
}));

const REPORT_GROUPS = [
    {
        title: 'ยอดขายและรายได้',
        reports: [
            { key: 'sales-summary', label: 'รายงานสรุปยอดขายและรายได้' },
            { key: 'sales-by-channel', label: 'รายงานยอดขายแยกตามช่องทางขาย' },
            { key: 'sales-by-payment-method', label: 'รายงานยอดขายแยกตามวิธีชำระเงิน' },
            { key: 'best-products', label: 'รายงานสรุปสินค้าขายดี' },
            { key: 'sold-products', label: 'รายงานจำนวนสินค้าที่ถูกขายออก' },
            { key: 'top-customers', label: 'รายงานลูกค้าซื้อสูงสุด' },
            { key: 'payments', label: 'พิมพ์รายงานการรับเงิน' },
            { key: 'payments-store', label: 'รายงานการรับเงินเฉพาะหน้าร้าน' },
            { key: 'payments-online', label: 'รายงานการรับเงินเฉพาะออนไลน์' },
        ],
    },
    {
        title: 'คำสั่งซื้อและจัดส่ง',
        reports: [
            { key: 'orders', label: 'รายงานคำสั่งซื้อ' },
            { key: 'orders-by-status', label: 'รายงานคำสั่งซื้อแต่ละสถานะ' },
            ...ORDER_STATUS_DETAIL_REPORTS,
            { key: 'orders-cancelled', label: 'รายงานคำสั่งซื้อที่ถูกยกเลิก' },
            { key: 'slip-history', label: 'รายงานตรวจสอบสลิป' },
            { key: 'pending-payment-review-overdue', label: 'รายงานรอตรวจสอบการชำระเงินค้างนาน' },
            { key: 'slips-pending-approval', label: 'รายงานสลิปที่รออนุมัติ' },
            { key: 'slips-approved', label: 'รายงานสลิปที่อนุมัติแล้ว' },
            { key: 'slips-rejected', label: 'รายงานสลิปที่ถูกปฏิเสธ' },
            { key: 'shipping', label: 'รายงานพิมพ์ใบจัดส่ง' },
        ],
    },
    {
        title: 'สินค้าและสต็อก',
        reports: [
            { key: 'categories', label: 'รายงานหมวดหมู่สินค้า' },
            { key: 'categories-active', label: 'รายงานหมวดหมู่สินค้าเฉพาะเปิดใช้งาน' },
            { key: 'categories-inactive', label: 'รายงานหมวดหมู่สินค้าเฉพาะปิดใช้งาน' },
            { key: 'category-sales', label: 'รายงานยอดขายแยกตามหมวดหมู่สินค้า' },
            { key: 'stock-status', label: 'รายงานสินค้าคงเหลือใกล้หมดและหมดสต็อก' },
            { key: 'stock-out', label: 'รายงานสต็อกหมดเฉพาะรายการ' },
            { key: 'stock-history', label: 'รายงานประวัติสต็อก' },
            { key: 'products', label: 'พิมพ์รายการสินค้า' },
            { key: 'products-active', label: 'รายงานสินค้าเฉพาะเปิดใช้งาน' },
            { key: 'products-inactive', label: 'รายงานสินค้าเฉพาะปิดใช้งาน' },
            { key: 'unsold-products', label: 'รายงานสินค้าที่ไม่เคยถูกขาย' },
        ],
    },
    {
        title: 'ผู้ใช้งานและระบบ',
        reports: [
            { key: 'admin-activity', label: 'รายงานประวัติการเคลื่อนไหวแอดมิน' },
            { key: 'users', label: 'พิมพ์รายชื่อผู้ใช้งานทั้งหมด' },
            { key: 'users-admins', label: 'พิมพ์รายชื่อเฉพาะแอดมิน' },
            { key: 'users-members', label: 'พิมพ์รายชื่อเฉพาะผู้ใช้งาน' },
            { key: 'users-suspended', label: 'พิมพ์รายชื่อผู้ใช้งานถูกระงับ' },
        ],
    },
];

const REPORT_GROUP_COLUMNS = [
    [REPORT_GROUPS[0], REPORT_GROUPS[2]],
    [REPORT_GROUPS[1], REPORT_GROUPS[3]],
];

const ORDER_STATUS_ALIASES = {
    pending: 'รอชำระเงิน',
    'รอจัดการ': 'รอชำระเงิน',
    'รอชำระ': 'รอชำระเงิน',
    review: 'รอตรวจสอบการชำระเงิน',
    reviewing: 'รอตรวจสอบการชำระเงิน',
    'รอตรวจสอบ': 'รอตรวจสอบการชำระเงิน',
    preparing: 'กำลังเตรียมสินค้า',
    'เตรียมสินค้า': 'กำลังเตรียมสินค้า',
    shipping: 'กำลังจัดส่ง',
    delivering: 'กำลังจัดส่ง',
    shipped: 'จัดส่งแล้ว',
    ready: 'พร้อมรับสินค้า',
    completed: 'เสร็จสิ้น',
    success: 'เสร็จสิ้น',
    'สำเร็จ': 'เสร็จสิ้น',
    'ได้รับสินค้าแล้ว': 'เสร็จสิ้น',
    cancelled: 'ยกเลิกคำสั่งซื้อ',
    canceled: 'ยกเลิกคำสั่งซื้อ',
    'ยกเลิก': 'ยกเลิกคำสั่งซื้อ',
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeCsv = (value) => {
    const text = value && typeof value === 'object' && 'text' in value ? value.text : value;
    const normalized = String(text ?? '').replace(/\r?\n/g, ' ');
    return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getReportRange = (preset, customRange = {}) => {
    if (preset === 'custom') {
        return {
            from: customRange.from || '',
            to: customRange.to || customRange.from || '',
        };
    }
    const days = preset === 'today' ? 1 : Number(preset) || 30;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    return { from: formatDateInput(from), to: formatDateInput(to) };
};

const formatRangeText = ({ from, to }) => (!from || !to ? 'ข้อมูลทั้งหมด' : `${from} ถึง ${to}`);
const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatInteger = (value) => Number(value || 0).toLocaleString('th-TH');
const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${formatThaiDate(value, '-')} ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
};

const getOrderDate = (order) => new Date(order.created_at || order.order_date || 0);
const isCancelledOrder = (order) => ['ยกเลิก', 'ยกเลิกคำสั่งซื้อ'].includes(order?.status || order?.order_status);
const isPaidOrder = (order) => ['ชำระเงินแล้ว', 'อนุมัติแล้ว', 'paid', 'approved'].includes(String(order?.payment_status || '').toLowerCase())
    || ['ชำระเงินแล้ว', 'กำลังเตรียมสินค้า', 'จัดส่งแล้ว', 'สำเร็จ'].includes(order?.status || order?.order_status);

const getOrdersInDateRange = (orders, range) => orders.filter((order) => {
    if (!range.from || !range.to) return true;
    const orderDate = getOrderDate(order);
    if (Number.isNaN(orderDate.getTime())) return false;
    return orderDate >= new Date(`${range.from}T00:00:00`) && orderDate <= new Date(`${range.to}T23:59:59`);
});
const getOrdersInRange = (orders, range) => getOrdersInDateRange(orders, range).filter((order) => !isCancelledOrder(order));

const getRowsInRange = (rows, range, dateKeys = ['created_at', 'log_date']) => rows.filter((row) => {
    if (!range.from || !range.to) return true;
    const rawDate = dateKeys.map((key) => row?.[key]).find(Boolean);
    const date = new Date(rawDate || 0);
    if (Number.isNaN(date.getTime())) return false;
    return date >= new Date(`${range.from}T00:00:00`) && date <= new Date(`${range.to}T23:59:59`);
});

const getOrderItems = (order) => (Array.isArray(order?.items) ? order.items : []);
const getProductId = (product) => product.product_id ?? product.id ?? '-';
const getProductName = (product) => product.product_name || product.name || product.title || '-';
const getProductCategory = (product) => product.category_name || product.category || '-';
const getProductStock = (product) => Number(product.stock ?? product.quantity ?? product.remaining_stock ?? 0);
const getProductPrice = (product) => Number(product.price ?? product.product_price ?? 0);
const getMinStock = (product) => Number(product.min_stock ?? product.minimum_stock ?? product.low_stock_threshold ?? 5);
const isActiveProduct = (product) => Number(product.status_product ?? product.product_status ?? product.is_active ?? 1) === 1;
const getCategoryId = (category) => category.category_id ?? category.id ?? '-';
const getCategoryName = (category) => category.category_name || category.name || 'ไม่ระบุหมวดหมู่';
const isActiveCategory = (category) => Number(category.status_category ?? category.status ?? 1) === 1;
const getCustomerName = (item) => item.full_name || item.customer_name || item.username || 'ผู้ใช้งานทั่วไป';
const getSaleChannel = (order) => (String(order.delivery_type || '').trim() === 'ขายหน้าร้าน' ? 'ขายหน้าร้าน' : 'ออนไลน์');
const getPaymentMethod = (order) => order.payment_method || order.payment_type || 'โอนเงินผ่านธนาคาร';
const getOrderAmount = (order) => Number(order.verified_amount ?? order.payment_amount ?? order.final_price ?? order.total_price ?? 0);
const getUserRole = (user) => (user.role === 'admin' ? 'admin' : 'user');
const isSuspendedUser = (user) => Number(user.status_user ?? user.status ?? 1) === 0;
const getOrderStatus = (order) => order.status || order.order_status || 'ไม่ระบุสถานะ';
const getReportOrderStatus = (order) => {
    const status = getOrderStatus(order);
    return ORDER_STATUS_ALIASES[String(status).trim().toLowerCase()] || status;
};
const getStatusDetailReport = (reportKey) => ORDER_STATUS_DETAIL_REPORTS.find((report) => report.key === reportKey);
const hasPaymentSlip = (order) => Boolean(order.receipt_image);
const isPendingSlipApproval = (order) => order.payment_status === 'รอตรวจสอบ';
const isApprovedSlip = (order) => ['ชำระเงินแล้ว', 'ชำระแล้ว'].includes(order.payment_status);
const isRejectedSlip = (order) => ['ถูกปฏิเสธ', 'หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม', 'ไม่พบหลักฐาน'].includes(order.payment_status);
const getDaysSince = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};
const sumOrderQuantity = (order) => getOrderItems(order).reduce((total, item) => total + Number(item.quantity || item.qty || 0), 0);
const summarizeOrderItems = (order) => {
    const items = getOrderItems(order);
    if (!items.length) return order.product_name || '-';
    return items.map((item) => `${item.product_name || item.name || 'สินค้า'} x${formatInteger(item.quantity || item.qty || 0)}`).join(', ');
};

const formatAddress = (order) => [
    order.address_detail || order.address,
    order.subdistrict && `ต.${order.subdistrict}`,
    order.district && `อ.${order.district}`,
    order.province && `จ.${order.province}`,
    order.postal_code,
].filter(Boolean).join(' ') || '-';

const renderCell = (item) => {
    if (item && typeof item === 'object' && item.html) return item.html;
    return escapeHtml(item);
};

const numberCell = (value, prefix = '') => ({
    text: `${prefix}${value}`,
    html: `<span class="number">${escapeHtml(prefix)}${escapeHtml(value)}</span>`,
});

const receiptSlipCell = (order) => {
    const imageUrl = resolveMediaUrl(order.receipt_image);
    if (!imageUrl) return '-';
    return {
        text: imageUrl,
        html: `<img class="slip-report-image" src="${escapeHtml(imageUrl)}" alt="สลิปออเดอร์ ${escapeHtml(order.id)}" />`,
    };
};

const buildUserReportRows = (users) => users.map((customer) => [
    customer.id || customer.user_id || '-',
    getCustomerName(customer),
    customer.email || '-',
    customer.phone || '-',
    getUserRole(customer) === 'admin' ? 'Admin' : 'User',
    isSuspendedUser(customer) ? 'ระงับ/ปิดใช้งาน' : 'ใช้งาน',
    formatDateTime(customer.created_at || customer.registered_at || customer.createdAt),
]);

const normalizeCustomersResponse = (response) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.customers)) return data.customers;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
};

const buildReportPayload = (reportKey, { orders, products, categories, customers, stockLogs, systemLogs, range }) => {
    const rangedOrders = getOrdersInRange(orders, range);
    const paidOrders = rangedOrders.filter(isPaidOrder);
    const rangedStockLogs = getRowsInRange(stockLogs, range);
    const rangedSystemLogs = getRowsInRange(systemLogs, range);
    const rangeText = formatRangeText(range);
    const printedAt = formatDateTime(new Date());

    if (reportKey === 'sales-summary') {
        const grouped = rangedOrders.reduce((next, order) => {
            const key = formatThaiDate(order.created_at || order.order_date, '-');
            if (!next[key]) next[key] = { period: key, orders: 0, units: 0, sales: 0, discount: 0, shipping: 0, net: 0 };
            next[key].orders += 1;
            next[key].units += sumOrderQuantity(order);
            next[key].sales += Number(order.total_price ?? 0);
            next[key].discount += Number(order.discount ?? 0);
            next[key].shipping += Number(order.shipping_fee ?? 0);
            next[key].net += Number(order.final_price ?? order.total_price ?? 0);
            return next;
        }, {});
        return {
            title: 'รายงานสรุปยอดขายและรายได้',
            subtitle: `${Object.keys(grouped).length.toLocaleString('th-TH')} ช่วงเวลา · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'sales-revenue-summary',
            headers: ['วันที่', 'จำนวนออเดอร์', 'จำนวนสินค้าที่ขาย', 'ยอดขาย', 'ส่วนลด', 'ค่าส่ง', 'รายได้สุทธิ'],
            rows: Object.values(grouped).map((row) => [
                row.period,
                numberCell(formatInteger(row.orders)),
                numberCell(formatInteger(row.units)),
                numberCell(formatMoney(row.sales), '฿'),
                numberCell(formatMoney(row.discount), '฿'),
                numberCell(formatMoney(row.shipping), '฿'),
                numberCell(formatMoney(row.net), '฿'),
            ]),
        };
    }

    if (reportKey === 'best-products' || reportKey === 'sold-products') {
        const productMap = products.reduce((next, product) => ({ ...next, [String(getProductId(product))]: product }), {});
        const grouped = paidOrders.reduce((next, order) => {
            getOrderItems(order).forEach((item) => {
                const id = item.product_id ?? item.id ?? item.productId ?? item.product_name ?? item.name;
                const key = String(id);
                const product = productMap[key] || {};
                const quantity = Number(item.quantity || item.qty || 0);
                const price = Number(item.price ?? item.product_price ?? getProductPrice(product));
                if (!next[key]) {
                    next[key] = {
                        id: id || '-',
                        name: item.product_name || item.name || getProductName(product),
                        sold: 0,
                        revenue: 0,
                        stock: getProductStock(product),
                    };
                }
                next[key].sold += quantity;
                next[key].revenue += quantity * price;
            });
            return next;
        }, {});
        const sourceRows = Object.values(grouped).sort((a, b) => b.sold - a.sold || b.revenue - a.revenue);
        if (reportKey === 'best-products') {
            return {
                title: 'รายงานสรุปสินค้าขายดี',
                subtitle: `${sourceRows.length.toLocaleString('th-TH')} สินค้า · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
                fileName: 'best-selling-products',
                headers: ['อันดับ', 'รหัสสินค้า', 'ชื่อสินค้า', 'จำนวนขาย', 'ยอดขาย'],
                rows: sourceRows.map((row, index) => [
                    numberCell(formatInteger(index + 1)),
                    row.id,
                    row.name,
                    numberCell(formatInteger(row.sold)),
                    numberCell(formatMoney(row.revenue), '฿'),
                ]),
            };
        }
        return {
            title: 'รายงานจำนวนสินค้าที่ถูกขายออก',
            subtitle: `${sourceRows.length.toLocaleString('th-TH')} สินค้า · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'sold-product-quantity',
            headers: ['สินค้า', 'จำนวนก่อนขาย', 'ขายออก', 'คงเหลือ'],
            rows: sourceRows.map((row) => [
                row.name,
                numberCell(formatInteger(row.stock + row.sold)),
                numberCell(formatInteger(row.sold)),
                numberCell(formatInteger(row.stock)),
            ]),
        };
    }

    if (reportKey === 'sales-by-channel') {
        const grouped = rangedOrders.reduce((next, order) => {
            const channel = getSaleChannel(order);
            if (!next[channel]) next[channel] = { channel, orders: 0, units: 0, revenue: 0 };
            next[channel].orders += 1;
            next[channel].units += sumOrderQuantity(order);
            next[channel].revenue += getOrderAmount(order);
            return next;
        }, {});
        const rows = ['ขายหน้าร้าน', 'ออนไลน์']
            .map((channel) => grouped[channel] || { channel, orders: 0, units: 0, revenue: 0 });
        return {
            title: 'รายงานยอดขายแยกตามช่องทางขาย',
            subtitle: `${rangedOrders.length.toLocaleString('th-TH')} ออเดอร์ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'sales-by-channel',
            headers: ['ช่องทางขาย', 'จำนวนออเดอร์', 'จำนวนสินค้า', 'ยอดขาย'],
            rows: rows.map((row) => [row.channel, numberCell(formatInteger(row.orders)), numberCell(formatInteger(row.units)), numberCell(formatMoney(row.revenue), '฿')]),
        };
    }

    if (reportKey === 'sales-by-payment-method') {
        const grouped = rangedOrders.reduce((next, order) => {
            const method = getPaymentMethod(order);
            if (!next[method]) next[method] = { method, orders: 0, units: 0, revenue: 0 };
            next[method].orders += 1;
            next[method].units += sumOrderQuantity(order);
            next[method].revenue += getOrderAmount(order);
            return next;
        }, {});
        const rows = Object.values(grouped).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
        return {
            title: 'รายงานยอดขายแยกตามวิธีชำระเงิน',
            subtitle: `${rows.length.toLocaleString('th-TH')} วิธีชำระเงิน · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'sales-by-payment-method',
            headers: ['วิธีชำระเงิน', 'จำนวนออเดอร์', 'จำนวนสินค้า', 'ยอดขาย'],
            rows: rows.map((row) => [row.method, numberCell(formatInteger(row.orders)), numberCell(formatInteger(row.units)), numberCell(formatMoney(row.revenue), '฿')]),
        };
    }

    if (reportKey === 'top-customers') {
        const grouped = rangedOrders.reduce((next, order) => {
            const key = String(order.user_id || order.customer_id || getCustomerName(order));
            if (!next[key]) next[key] = { name: getCustomerName(order), orders: 0, units: 0, revenue: 0 };
            next[key].orders += 1;
            next[key].units += sumOrderQuantity(order);
            next[key].revenue += getOrderAmount(order);
            return next;
        }, {});
        const rows = Object.values(grouped).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
        return {
            title: 'รายงานลูกค้าซื้อสูงสุด',
            subtitle: `${rows.length.toLocaleString('th-TH')} ลูกค้า · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'top-customers',
            headers: ['อันดับ', 'ลูกค้า', 'จำนวนออเดอร์', 'จำนวนสินค้า', 'ยอดซื้อรวม'],
            rows: rows.map((row, index) => [numberCell(formatInteger(index + 1)), row.name, numberCell(formatInteger(row.orders)), numberCell(formatInteger(row.units)), numberCell(formatMoney(row.revenue), '฿')]),
        };
    }

    if (['payments', 'payments-store', 'payments-online'].includes(reportKey)) {
        const reportOrders = rangedOrders.filter((order) => {
            if (reportKey === 'payments-store') return getSaleChannel(order) === 'ขายหน้าร้าน';
            if (reportKey === 'payments-online') return getSaleChannel(order) === 'ออนไลน์';
            return true;
        });
        const rows = reportOrders.map((order) => [
            `#${order.id}`,
            getCustomerName(order),
            getSaleChannel(order),
            numberCell(formatMoney(getOrderAmount(order)), '฿'),
            getPaymentMethod(order),
            order.payment_status || order.status || '-',
            order.reviewer_full_name || order.reviewer_username || '-',
        ]);
        const titles = {
            payments: 'พิมพ์รายงานการรับเงิน',
            'payments-store': 'รายงานการรับเงินเฉพาะหน้าร้าน',
            'payments-online': 'รายงานการรับเงินเฉพาะออนไลน์',
        };
        const fileNames = {
            payments: 'payment-receipts',
            'payments-store': 'payment-receipts-store',
            'payments-online': 'payment-receipts-online',
        };
        return { title: titles[reportKey], subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: fileNames[reportKey], headers: ['ออเดอร์', 'ลูกค้า', 'ช่องทางขาย', 'จำนวนเงิน', 'วิธีชำระ', 'สถานะ', 'ผู้ตรวจสอบ'], rows };
    }

    if (reportKey === 'orders') {
        return {
            title: 'รายงานคำสั่งซื้อ',
            subtitle: `${rangedOrders.length.toLocaleString('th-TH')} ออเดอร์ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'orders',
            headers: ['เลขออเดอร์', 'ลูกค้า', 'สินค้า', 'จำนวน', 'ยอดรวม', 'สถานะ'],
            rows: rangedOrders.map((order) => [`#${order.id}`, getCustomerName(order), summarizeOrderItems(order), numberCell(formatInteger(sumOrderQuantity(order))), numberCell(formatMoney(order.final_price ?? order.total_price), '฿'), order.status || order.order_status || '-']),
        };
    }

    if (reportKey === 'orders-by-status') {
        const ordersWithCancelled = getOrdersInDateRange(orders, range);
        const initialRows = ORDER_STATUS_REPORT_ROWS.reduce((next, status) => ({
            ...next,
            [status]: { status, orders: 0, units: 0, total: 0, net: 0 },
        }), {});
        const grouped = ordersWithCancelled.reduce((next, order) => {
            const status = getReportOrderStatus(order);
            if (!next[status]) next[status] = { status, orders: 0, units: 0, total: 0, net: 0 };
            next[status].orders += 1;
            next[status].units += sumOrderQuantity(order);
            next[status].total += Number(order.total_price ?? 0);
            next[status].net += Number(order.final_price ?? order.total_price ?? 0);
            return next;
        }, initialRows);
        return {
            title: 'รายงานคำสั่งซื้อแต่ละสถานะ',
            subtitle: `${ordersWithCancelled.length.toLocaleString('th-TH')} ออเดอร์ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'orders-by-status',
            headers: ['สถานะคำสั่งซื้อ', 'จำนวนออเดอร์', 'จำนวนสินค้า', 'ยอดรวม', 'รายได้สุทธิ'],
            rows: Object.values(grouped).map((row) => [
                row.status,
                numberCell(formatInteger(row.orders)),
                numberCell(formatInteger(row.units)),
                numberCell(formatMoney(row.total), '฿'),
                numberCell(formatMoney(row.net), '฿'),
            ]),
        };
    }

    const statusDetailReport = getStatusDetailReport(reportKey);
    if (statusDetailReport) {
        const rows = getOrdersInDateRange(orders, range)
            .filter((order) => getReportOrderStatus(order) === statusDetailReport.status)
            .map((order) => [
                `#${order.id}`,
                getCustomerName(order),
                summarizeOrderItems(order),
                numberCell(formatInteger(sumOrderQuantity(order))),
                numberCell(formatMoney(order.final_price ?? order.total_price), '฿'),
                getReportOrderStatus(order),
            ]);
        return {
            title: `รายงานคำสั่งซื้อเฉพาะสถานะ${statusDetailReport.status}`,
            subtitle: `${rows.length.toLocaleString('th-TH')} ออเดอร์ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: `orders-status-${statusDetailReport.key.replace('orders-status-', '')}`,
            headers: ['เลขออเดอร์', 'ลูกค้า', 'สินค้า', 'จำนวน', 'ยอดรวม', 'สถานะ'],
            rows,
        };
    }

    if (reportKey === 'orders-cancelled') {
        const rows = getOrdersInDateRange(orders, range)
            .filter(isCancelledOrder)
            .map((order) => [
                `#${order.id}`,
                getCustomerName(order),
                summarizeOrderItems(order),
                numberCell(formatInteger(sumOrderQuantity(order))),
                numberCell(formatMoney(order.final_price ?? order.total_price), '฿'),
                getReportOrderStatus(order),
                formatDateTime(order.updated_at || order.order_date || order.created_at),
            ]);
        return {
            title: 'รายงานคำสั่งซื้อที่ถูกยกเลิก',
            subtitle: `${rows.length.toLocaleString('th-TH')} ออเดอร์ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'cancelled-orders',
            headers: ['เลขออเดอร์', 'ลูกค้า', 'สินค้า', 'จำนวน', 'ยอดรวม', 'สถานะ', 'วันที่อัปเดต'],
            rows,
        };
    }

    if (reportKey === 'slip-history') {
        const rows = rangedOrders.filter(hasPaymentSlip).map((order) => [
            `#${order.id}`,
            formatDateTime(order.payment_date || order.created_at),
            numberCell(formatMoney(order.verified_amount ?? order.payment_amount ?? order.final_price ?? order.total_price), '฿'),
            order.payment_status || order.status || '-',
            order.reviewer_full_name || order.reviewer_username || '-',
            order.review_note || '-',
        ]);
        return { title: 'รายงานตรวจสอบสลิป', subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: 'slip-review-history', headers: ['ออเดอร์', 'วันที่ส่งสลิป', 'จำนวนเงิน', 'ผลตรวจ', 'ผู้ตรวจสอบ', 'หมายเหตุ'], rows };
    }

    if (reportKey === 'pending-payment-review-overdue') {
        const rows = rangedOrders
            .filter(hasPaymentSlip)
            .filter(isPendingSlipApproval)
            .filter((order) => getDaysSince(order.payment_date || order.created_at || order.order_date) >= 1)
            .map((order) => [
                `#${order.id}`,
                getCustomerName(order),
                formatDateTime(order.payment_date || order.created_at || order.order_date),
                numberCell(formatInteger(getDaysSince(order.payment_date || order.created_at || order.order_date))),
                numberCell(formatMoney(getOrderAmount(order)), '฿'),
                order.payment_status || order.status || '-',
            ]);
        return {
            title: 'รายงานรอตรวจสอบการชำระเงินค้างนาน',
            subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'overdue-payment-review',
            headers: ['ออเดอร์', 'ลูกค้า', 'วันที่ส่งสลิป', 'ค้างมาแล้ว (วัน)', 'จำนวนเงิน', 'สถานะ'],
            rows,
        };
    }

    if (reportKey === 'slips-pending-approval' || reportKey === 'slips-approved' || reportKey === 'slips-rejected') {
        const isApprovedReport = reportKey === 'slips-approved';
        const isRejectedReport = reportKey === 'slips-rejected';
        const rows = rangedOrders
            .filter(hasPaymentSlip)
            .filter((order) => {
                if (isApprovedReport) return isApprovedSlip(order);
                if (isRejectedReport) return isRejectedSlip(order);
                return isPendingSlipApproval(order);
            })
            .map((order) => [
                `#${order.id}`,
                receiptSlipCell(order),
                formatDateTime(order.payment_date || order.created_at),
                numberCell(formatMoney(order.verified_amount ?? order.payment_amount ?? order.final_price ?? order.total_price), '฿'),
                order.payment_status || order.status || '-',
                order.reviewer_full_name || order.reviewer_username || '-',
                order.review_note || '-',
            ]);
        const title = isApprovedReport
            ? 'รายงานสลิปที่อนุมัติแล้ว'
            : isRejectedReport
                ? 'รายงานสลิปที่ถูกปฏิเสธ'
                : 'รายงานสลิปที่รออนุมัติ';
        return {
            title,
            subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: isApprovedReport ? 'approved-payment-slips' : isRejectedReport ? 'rejected-payment-slips' : 'pending-payment-slips',
            headers: ['ออเดอร์', 'รูปสลิป', 'วันที่ส่งสลิป', 'จำนวนเงิน', 'ผลตรวจ', 'ผู้ตรวจสอบ', 'หมายเหตุ'],
            rows,
        };
    }

    if (reportKey === 'shipping') {
        const rows = rangedOrders.map((order) => [`#${order.id}`, getCustomerName(order), formatAddress(order), summarizeOrderItems(order), numberCell(formatInteger(sumOrderQuantity(order))), order.shipping_method || '-', order.tracking_no || order.tracking_number || '-']);
        return { title: 'รายงานพิมพ์ใบจัดส่ง', subtitle: `${rows.length.toLocaleString('th-TH')} ใบจัดส่ง · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: 'shipping-documents', headers: ['ออเดอร์', 'ลูกค้า', 'ที่อยู่', 'สินค้า', 'จำนวน', 'วิธีจัดส่ง', 'Tracking Number'], rows };
    }

    if (['categories', 'categories-active', 'categories-inactive'].includes(reportKey)) {
        const isActiveReport = reportKey === 'categories-active';
        const isInactiveReport = reportKey === 'categories-inactive';
        const reportCategories = categories.filter((category) => {
            if (isActiveReport) return isActiveCategory(category);
            if (isInactiveReport) return !isActiveCategory(category);
            return true;
        });
        const categoryMap = reportCategories.reduce((next, category) => ({
            ...next,
            [String(getCategoryId(category))]: {
                id: getCategoryId(category),
                name: getCategoryName(category),
                products: 0,
                stock: 0,
                value: 0,
                status: isActiveCategory(category) ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            },
        }), {});
        products.forEach((product) => {
            const id = String(product.category_id ?? '');
            const fallbackName = getProductCategory(product);
            const key = id || fallbackName;
            if (!categoryMap[key]) {
                categoryMap[key] = {
                    id: id || '-',
                    name: fallbackName,
                    products: 0,
                    stock: 0,
                    value: 0,
                    status: 'เปิดใช้งาน',
                };
            }
            categoryMap[key].products += 1;
            categoryMap[key].stock += getProductStock(product);
            categoryMap[key].value += getProductStock(product) * getProductPrice(product);
        });
        const rows = Object.values(categoryMap).sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')).map((category) => [
            category.id,
            category.name,
            numberCell(formatInteger(category.products)),
            numberCell(formatInteger(category.stock)),
            numberCell(formatMoney(category.value), '฿'),
            category.status,
        ]);
        const title = isActiveReport
            ? 'รายงานหมวดหมู่สินค้าเฉพาะเปิดใช้งาน'
            : isInactiveReport
                ? 'รายงานหมวดหมู่สินค้าเฉพาะปิดใช้งาน'
                : 'รายงานหมวดหมู่สินค้า';
        return {
            title,
            subtitle: `${rows.length.toLocaleString('th-TH')} หมวดหมู่ · พิมพ์เมื่อ ${printedAt}`,
            fileName: isActiveReport ? 'active-product-categories' : isInactiveReport ? 'inactive-product-categories' : 'product-categories',
            headers: ['รหัสหมวดหมู่', 'ชื่อหมวดหมู่สินค้า', 'จำนวนสินค้า', 'สต็อกรวม', 'มูลค่าสต็อก', 'สถานะ'],
            rows,
        };
    }

    if (reportKey === 'category-sales') {
        const productMap = products.reduce((next, product) => ({ ...next, [String(getProductId(product))]: product }), {});
        const grouped = paidOrders.reduce((next, order) => {
            getOrderItems(order).forEach((item) => {
                const product = productMap[String(item.product_id ?? item.id ?? item.productId)] || {};
                const category = getProductCategory(product) || item.category_name || item.category || 'ไม่ระบุหมวดหมู่';
                const quantity = Number(item.quantity || item.qty || 0);
                const price = Number(item.price ?? item.product_price ?? getProductPrice(product));
                if (!next[category]) next[category] = { category, units: 0, revenue: 0 };
                next[category].units += quantity;
                next[category].revenue += quantity * price;
            });
            return next;
        }, {});
        const rows = Object.values(grouped).sort((a, b) => b.revenue - a.revenue || b.units - a.units);
        return {
            title: 'รายงานยอดขายแยกตามหมวดหมู่สินค้า',
            subtitle: `${rows.length.toLocaleString('th-TH')} หมวดหมู่ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'category-sales',
            headers: ['หมวดหมู่สินค้า', 'จำนวนขาย', 'ยอดขาย'],
            rows: rows.map((row) => [row.category, numberCell(formatInteger(row.units)), numberCell(formatMoney(row.revenue), '฿')]),
        };
    }

    if (reportKey === 'stock-status') {
        const rows = products.map((product) => {
            const stock = getProductStock(product);
            const minStock = getMinStock(product);
            const status = stock <= 0 ? 'หมดสต็อก' : stock <= minStock ? 'ใกล้หมด' : 'พร้อมขาย';
            return [getProductName(product), numberCell(formatInteger(stock)), numberCell(formatInteger(minStock)), status, numberCell(formatMoney(stock * getProductPrice(product)), '฿')];
        });
        return { title: 'รายงานสินค้าคงเหลือใกล้หมดและหมดสต็อก', subtitle: `${rows.length.toLocaleString('th-TH')} สินค้า · พิมพ์เมื่อ ${printedAt}`, fileName: 'stock-status', headers: ['สินค้า', 'สต็อก', 'ขั้นต่ำ', 'สถานะ', 'มูลค่าสต็อก'], rows };
    }

    if (reportKey === 'stock-out') {
        const rows = products
            .filter((product) => getProductStock(product) <= 0)
            .map((product) => [
                getProductId(product),
                getProductName(product),
                getProductCategory(product),
                numberCell(formatInteger(getProductStock(product))),
                numberCell(formatMoney(getProductPrice(product)), '฿'),
                isActiveProduct(product) ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            ]);
        return {
            title: 'รายงานสต็อกหมดเฉพาะรายการ',
            subtitle: `${rows.length.toLocaleString('th-TH')} สินค้า · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'stock-out-products',
            headers: ['รหัส', 'ชื่อสินค้า', 'หมวดหมู่', 'สต็อก', 'ราคา', 'สถานะ'],
            rows,
        };
    }

    if (reportKey === 'stock-history') {
        return {
            title: 'รายงานประวัติสต็อก',
            subtitle: `${rangedStockLogs.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'stock-history',
            headers: ['วันที่', 'สินค้า', 'รับเข้า/ขายออก', 'ก่อนเปลี่ยน', 'เปลี่ยนแปลง', 'หลังเปลี่ยน', 'ผู้ดำเนินการ'],
            rows: rangedStockLogs.map((log) => [formatDateTime(log.created_at || log.log_date), log.product_name || log.name || '-', log.change_type || log.type || log.reason || '-', numberCell(formatInteger(log.before_quantity ?? log.before_stock ?? log.old_stock ?? 0)), numberCell(formatInteger(log.change_quantity ?? log.amount ?? log.quantity ?? 0)), numberCell(formatInteger(log.after_quantity ?? log.after_stock ?? log.new_stock ?? 0)), log.actor_name || log.admin_name || log.username || 'ระบบ']),
        };
    }

    if (reportKey === 'unsold-products') {
        const soldProductIds = paidOrders.reduce((next, order) => {
            getOrderItems(order).forEach((item) => {
                const id = item.product_id ?? item.id ?? item.productId;
                if (id !== undefined && id !== null) next.add(String(id));
            });
            return next;
        }, new Set());
        const rows = products
            .filter((product) => !soldProductIds.has(String(getProductId(product))))
            .map((product) => [
                getProductId(product),
                getProductName(product),
                getProductCategory(product),
                numberCell(formatMoney(getProductPrice(product)), '฿'),
                numberCell(formatInteger(getProductStock(product))),
                isActiveProduct(product) ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            ]);
        return {
            title: 'รายงานสินค้าที่ไม่เคยถูกขาย',
            subtitle: `${rows.length.toLocaleString('th-TH')} สินค้า · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'unsold-products',
            headers: ['รหัส', 'ชื่อสินค้า', 'หมวดหมู่', 'ราคา', 'สต็อก', 'สถานะ'],
            rows,
        };
    }

    if (['products', 'products-active', 'products-inactive'].includes(reportKey)) {
        const isActiveReport = reportKey === 'products-active';
        const isInactiveReport = reportKey === 'products-inactive';
        const reportProducts = products.filter((product) => {
            if (isActiveReport) return isActiveProduct(product);
            if (isInactiveReport) return !isActiveProduct(product);
            return true;
        });
        const title = isActiveReport
            ? 'รายงานสินค้าเฉพาะเปิดใช้งาน'
            : isInactiveReport
                ? 'รายงานสินค้าเฉพาะปิดใช้งาน'
                : 'พิมพ์รายการสินค้า';
        return {
            title,
            subtitle: `${reportProducts.length.toLocaleString('th-TH')} สินค้า · พิมพ์เมื่อ ${printedAt}`,
            fileName: isActiveReport ? 'active-products' : isInactiveReport ? 'inactive-products' : 'product-list',
            headers: ['รหัส', 'ชื่อ', 'หมวดหมู่', 'ราคา', 'สต็อก', 'สถานะ'],
            rows: reportProducts.map((product) => [getProductId(product), getProductName(product), getProductCategory(product), numberCell(formatMoney(getProductPrice(product)), '฿'), numberCell(formatInteger(getProductStock(product))), isActiveProduct(product) ? 'เปิดใช้งาน' : 'ปิดใช้งาน']),
        };
    }

    if (reportKey === 'admin-activity') {
        return {
            title: 'รายงานประวัติการเคลื่อนไหวแอดมิน',
            subtitle: `${rangedSystemLogs.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'admin-activity',
            headers: ['วันเวลา', 'แอดมิน', 'การกระทำ', 'รายการ', 'รายละเอียด'],
            rows: rangedSystemLogs.map((log) => [formatDateTime(log.created_at || log.log_date), log.actor_name || log.admin_name || log.full_name || log.username || 'ระบบ', log.action || '-', log.target || log.table_name || log.entity || '-', log.remark || log.detail || log.reason || '-']),
        };
    }

    if (['users', 'users-admins', 'users-members', 'users-suspended'].includes(reportKey)) {
        const userReportConfig = {
            users: {
                title: 'พิมพ์รายชื่อผู้ใช้งานทั้งหมด',
                fileName: 'users',
                filter: () => true,
            },
            'users-admins': {
                title: 'พิมพ์รายชื่อเฉพาะแอดมิน',
                fileName: 'admin-users',
                filter: (customer) => getUserRole(customer) === 'admin',
            },
            'users-members': {
                title: 'พิมพ์รายชื่อเฉพาะผู้ใช้งาน',
                fileName: 'member-users',
                filter: (customer) => getUserRole(customer) === 'user',
            },
            'users-suspended': {
                title: 'พิมพ์รายชื่อผู้ใช้งานถูกระงับ',
                fileName: 'suspended-users',
                filter: isSuspendedUser,
            },
        }[reportKey];
        const rows = buildUserReportRows(customers.filter(userReportConfig.filter));
        return {
            title: userReportConfig.title,
            subtitle: `${rows.length.toLocaleString('th-TH')} ผู้ใช้งาน · พิมพ์เมื่อ ${printedAt}`,
            fileName: userReportConfig.fileName,
            headers: ['User ID', 'ชื่อ', 'อีเมล', 'เบอร์', 'บทบาท', 'สถานะ', 'วันที่สมัคร'],
            rows,
        };
    }

    return {
        title: 'ไม่พบรายงาน',
        subtitle: `0 รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
        fileName: 'unknown-report',
        headers: ['ข้อความ'],
        rows: [['ไม่พบประเภทรายงานที่เลือก']],
    };
};

const downloadReport = ({ title, subtitle, headers, rows, fileName }, format) => {
    let blob;
    let extension;
    if (format === 'excel') {
        const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>table{border-collapse:collapse}th,td{border:1px solid #d8dee8;padding:8px;vertical-align:top}.number{display:block;text-align:right;white-space:nowrap}.slip-report-image{width:150px;height:190px;object-fit:contain;border:1px solid #d8dee8;background:#fff}</style></head><body><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${renderCell(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
        blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        extension = 'xls';
    } else {
        const csv = [[title], [subtitle], [], headers, ...rows.map((row) => row.map((item) => (item && typeof item === 'object' && 'text' in item ? item.text : item)))].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
        blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
        extension = 'csv';
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
};

const printReport = ({ title, subtitle, headers, rows, fileName }) => {
    const popup = window.open('about:blank', '_blank', 'width=1200,height=820');
    if (!popup) {
        window.print();
        return;
    }
    const tableRows = rows.length
        ? rows.map((row) => `<tr>${row.map((item, columnIndex) => `<td class="${columnIndex === 0 ? 'first-column' : ''}">${renderCell(item)}</td>`).join('')}</tr>`).join('')
        : `<tr><td class="empty" colspan="${headers.length}">ไม่พบข้อมูลรายงาน</td></tr>`;
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title><style>*{box-sizing:border-box}html{background:#edf2f7}body{margin:0;padding:28px;background:#edf2f7;color:#101828;font-family:Arial,Tahoma,sans-serif;font-size:12px;line-height:1.55}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:10px;max-width:1180px;margin:0 auto 16px;padding:10px 0;background:#edf2f7}.toolbar button{min-height:40px;padding:0 16px;border:1px solid #d0d5dd;border-radius:8px;cursor:pointer;font:inherit;font-weight:800}.primary{border-color:#101828!important;background:#101828;color:#fff}.secondary{background:#fff;color:#344054}.sheet{max-width:1180px;margin:0 auto;padding:26px 28px 30px;background:#fff;border:1px solid #d8dee8;box-shadow:0 20px 50px rgba(15,23,42,.12)}.masthead{margin-bottom:18px;padding-bottom:18px;border-bottom:3px solid #101828}.brand{color:#475467;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.masthead h1{margin:4px 0 6px;color:#101828;font-size:26px;line-height:1.25;font-weight:900}.subtitle{max-width:900px;margin:0;color:#667085;font-size:12px;font-weight:700}.table-wrap{overflow:visible}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:11px}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{padding:8px 9px;border:1px solid #cbd5e1;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#e9eef5;color:#101828;font-size:10.5px;font-weight:900;white-space:nowrap}tbody tr:nth-child(even) td{background:#fafbfc}.first-column{font-weight:800;color:#101828}.number{display:block;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.slip-report-image{display:block;width:150px;height:190px;object-fit:contain;border:1px solid #cbd5e1;background:#fff}.empty{padding:32px 12px;color:#667085;text-align:center;font-weight:800}.footer{display:flex;justify-content:space-between;gap:14px;margin-top:18px;padding-top:10px;border-top:1px solid #d8dee8;color:#667085;font-size:10px;font-weight:700}@page{size:A4 landscape;margin:9mm}@media print{html,body{padding:0;background:#fff}.toolbar{display:none}.sheet{max-width:none;margin:0;padding:0;border:0;box-shadow:none}.masthead{margin-bottom:12px;padding-bottom:12px}.masthead h1{font-size:22px}th,td{border-color:#111827}th{background:#e8edf3!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}tbody tr:nth-child(even) td{background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.slip-report-image{width:128px;height:162px}.footer{position:fixed;right:0;bottom:0;left:0;margin-top:0;background:#fff}}</style></head><body><div class="toolbar"><button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button><button class="secondary" onclick="window.close()">ปิด</button></div><main class="sheet"><header class="masthead"><span class="brand">SHOP LRU REPORT</span><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></header><div class="table-wrap"><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></div><footer class="footer"><span>SHOP LRU Management System</span><span>เอกสารนี้สร้างจากข้อมูลในระบบ ณ เวลาพิมพ์</span></footer></main><script>window.onload=()=>setTimeout(()=>window.print(),150);</script></body></html>`);
    popup.document.close();
};

function AdminSalesReportPrintPage() {
    const [quickReportDatePreset, setQuickReportDatePreset] = useState('30');
    const [customReportRange, setCustomReportRange] = useState(() => {
        const today = formatDateInput(new Date());
        return { from: today, to: today };
    });
    const [loadingReportKey, setLoadingReportKey] = useState('');

    useEffect(() => {
        const previousTitle = document.title;
        document.title = 'รายงานระบบ';
        return () => { document.title = previousTitle; };
    }, []);

    const loadReportData = async () => {
        const [ordersResponse, productsResponse, categoriesResponse, customersResponse, stockLogsResponse, systemLogsResponse] = await Promise.all([
            adminApi.getAdminOrders(),
            productsApi.getProducts('', true),
            productsApi.getCategories(true),
            adminApi.getCustomers({ page: 1, limit: 10000 }),
            adminApi.getStockLogs(),
            adminApi.getSystemLogs(),
        ]);
        return {
            orders: Array.isArray(ordersResponse.data) ? ordersResponse.data : [],
            products: Array.isArray(productsResponse.data) ? productsResponse.data : [],
            categories: Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [],
            customers: normalizeCustomersResponse(customersResponse),
            stockLogs: Array.isArray(stockLogsResponse.data) ? stockLogsResponse.data : [],
            systemLogs: Array.isArray(systemLogsResponse.data) ? systemLogsResponse.data : [],
            range: getReportRange(quickReportDatePreset, customReportRange),
        };
    };

    const exportReport = async (reportKey, format) => {
        setLoadingReportKey(`${reportKey}-${format}`);
        try {
            const payload = buildReportPayload(reportKey, await loadReportData());
            if (format === 'PDF') printReport(payload);
            else downloadReport(payload, format.toLowerCase());
        } catch (err) {
            const popup = window.open('about:blank', '_blank');
            if (!popup) return;
            popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>โหลดรายงานไม่สำเร็จ</title></head><body style="font-family:Arial,Tahoma,sans-serif;padding:34px"><h1>โหลดรายงานไม่สำเร็จ</h1><p>${escapeHtml(err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด')}</p></body></html>`);
            popup.document.close();
        } finally {
            setLoadingReportKey('');
        }
    };

    return (
        <main className="sales-report-print-page">
            <section className="commerce-card commerce-report-card sales-report-quick-panel">
                <header className="commerce-card-header">
                    <div><span>SHOP LRU REPORTS</span><h2>พิมพ์รายงานระบบ SHOP LRU</h2></div>
                    <div className="commerce-date-filter commerce-report-date-filter">
                        <select value={quickReportDatePreset} onChange={(event) => setQuickReportDatePreset(event.target.value)}>
                            {QUICK_REPORT_DATE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        {quickReportDatePreset === 'custom' && (
                            <div className="sales-report-custom-dates">
                                <label>
                                    <span>จาก</span>
                                    <input
                                        type="date"
                                        value={customReportRange.from}
                                        onChange={(event) => setCustomReportRange((current) => ({ ...current, from: event.target.value }))}
                                    />
                                </label>
                                <label>
                                    <span>ถึง</span>
                                    <input
                                        type="date"
                                        value={customReportRange.to}
                                        onChange={(event) => setCustomReportRange((current) => ({ ...current, to: event.target.value }))}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                </header>
                <div className="sales-report-groups">
                    {REPORT_GROUP_COLUMNS.map((column, columnIndex) => (
                        <div className="sales-report-column" key={`report-column-${columnIndex}`}>
                            {column.map((group) => (
                                <section className="sales-report-group" key={group.title}>
                                    <h3>{group.title}</h3>
                                    <div className="commerce-report-actions">
                                        {group.reports.map((report) => (
                                            <div className="sales-report-action-row" key={report.key}>
                                                <strong>{report.label}</strong>
                                                <div className="sales-report-format-actions">
                                                    {['CSV', 'Excel', 'PDF'].map((format) => {
                                                        const loadingKey = `${report.key}-${format}`;
                                                        return (
                                                            <button type="button" key={format} className={format === 'PDF' ? 'primary' : ''} onClick={() => exportReport(report.key, format)} disabled={Boolean(loadingReportKey)}>
                                                                {loadingReportKey === loadingKey ? 'กำลังโหลด...' : format}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}

export default AdminSalesReportPrintPage;
