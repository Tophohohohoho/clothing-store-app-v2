import { useEffect, useState } from 'react';
import * as adminApi from '../api/adminApi';
import * as productsApi from '../api/productsApi';
import { formatThaiDate } from '../utils/date';

const QUICK_REPORT_DATE_PRESETS = [
    { value: '7', label: '7 วันล่าสุด' },
    { value: '30', label: '30 วันล่าสุด' },
    { value: '90', label: '90 วันล่าสุด' },
    { value: 'all', label: 'ทั้งหมด' },
];

const REPORT_GROUPS = [
    {
        title: 'ยอดขายและรายได้',
        reports: [
            { key: 'sales-summary', label: 'รายงานสรุปยอดขายและรายได้' },
            { key: 'best-products', label: 'รายงานสรุปสินค้าขายดี' },
            { key: 'sold-products', label: 'รายงานจำนวนสินค้าที่ถูกขายออก' },
            { key: 'payments', label: 'พิมพ์รายงานการรับเงิน' },
        ],
    },
    {
        title: 'คำสั่งซื้อและจัดส่ง',
        reports: [
            { key: 'orders', label: 'รายงานคำสั่งซื้อ' },
            { key: 'slip-history', label: 'รายงานประวัติการตรวจสลิป' },
            { key: 'shipping', label: 'รายงานพิมพ์ใบจัดส่ง' },
        ],
    },
    {
        title: 'สินค้าและสต็อก',
        reports: [
            { key: 'stock-status', label: 'รายงานสินค้าคงเหลือใกล้หมดและหมดสต็อก' },
            { key: 'stock-history', label: 'รายงานประวัติสต็อก' },
            { key: 'products', label: 'พิมพ์รายการสินค้า' },
        ],
    },
    {
        title: 'ผู้ใช้งานและระบบ',
        reports: [
            { key: 'admin-activity', label: 'รายงานประวัติการเคลื่อนไหวแอดมิน' },
            { key: 'users', label: 'พิมพ์รายชื่อผู้ใช้งาน' },
        ],
    },
];

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

const getReportRange = (preset) => {
    if (preset === 'all') return { from: '', to: '' };
    const days = Number(preset) || 30;
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

const getOrdersInRange = (orders, range) => orders.filter((order) => {
    if (isCancelledOrder(order)) return false;
    if (!range.from || !range.to) return true;
    const orderDate = getOrderDate(order);
    if (Number.isNaN(orderDate.getTime())) return false;
    return orderDate >= new Date(`${range.from}T00:00:00`) && orderDate <= new Date(`${range.to}T23:59:59`);
});

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
const getCustomerName = (item) => item.full_name || item.customer_name || item.username || 'ผู้ใช้งานทั่วไป';
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

const normalizeCustomersResponse = (response) => {
    const data = response?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.customers)) return data.customers;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
};

const buildReportPayload = (reportKey, { orders, products, customers, stockLogs, systemLogs, range }) => {
    const rangedOrders = getOrdersInRange(orders, range);
    const paidOrders = rangedOrders.filter(isPaidOrder);
    const rangedStockLogs = getRowsInRange(stockLogs, range);
    const rangedSystemLogs = getRowsInRange(systemLogs, range);
    const rangedCustomers = getRowsInRange(customers, range, ['created_at', 'registered_at', 'createdAt']);
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

    if (reportKey === 'payments') {
        const rows = rangedOrders.map((order) => [
            `#${order.id}`,
            getCustomerName(order),
            numberCell(formatMoney(order.verified_amount ?? order.payment_amount ?? order.final_price ?? order.total_price), '฿'),
            order.payment_method || 'โอนเงินผ่านธนาคาร',
            order.payment_status || order.status || '-',
            order.reviewer_full_name || order.reviewer_username || '-',
        ]);
        return { title: 'พิมพ์รายงานการรับเงิน', subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: 'payment-receipts', headers: ['ออเดอร์', 'ลูกค้า', 'จำนวนเงิน', 'วิธีชำระ', 'สถานะ', 'ผู้ตรวจสอบ'], rows };
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

    if (reportKey === 'slip-history') {
        const rows = rangedOrders.filter((order) => order.receipt_image || order.payment_date || order.reviewed_at).map((order) => [
            `#${order.id}`,
            formatDateTime(order.payment_date || order.created_at),
            numberCell(formatMoney(order.verified_amount ?? order.payment_amount ?? order.final_price ?? order.total_price), '฿'),
            order.payment_status || order.status || '-',
            order.reviewer_full_name || order.reviewer_username || '-',
            order.review_note || '-',
        ]);
        return { title: 'รายงานประวัติการตรวจสลิป', subtitle: `${rows.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: 'slip-review-history', headers: ['ออเดอร์', 'วันที่ส่งสลิป', 'จำนวนเงิน', 'ผลตรวจ', 'ผู้ตรวจสอบ', 'หมายเหตุ'], rows };
    }

    if (reportKey === 'shipping') {
        const rows = rangedOrders.map((order) => [`#${order.id}`, getCustomerName(order), formatAddress(order), summarizeOrderItems(order), numberCell(formatInteger(sumOrderQuantity(order))), order.shipping_method || '-', order.tracking_no || order.tracking_number || '-']);
        return { title: 'รายงานพิมพ์ใบจัดส่ง', subtitle: `${rows.length.toLocaleString('th-TH')} ใบจัดส่ง · ${rangeText} · พิมพ์เมื่อ ${printedAt}`, fileName: 'shipping-documents', headers: ['ออเดอร์', 'ลูกค้า', 'ที่อยู่', 'สินค้า', 'จำนวน', 'วิธีจัดส่ง', 'Tracking Number'], rows };
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

    if (reportKey === 'stock-history') {
        return {
            title: 'รายงานประวัติสต็อก',
            subtitle: `${rangedStockLogs.length.toLocaleString('th-TH')} รายการ · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'stock-history',
            headers: ['วันที่', 'สินค้า', 'รับเข้า/ขายออก', 'ก่อนเปลี่ยน', 'เปลี่ยนแปลง', 'หลังเปลี่ยน', 'ผู้ดำเนินการ'],
            rows: rangedStockLogs.map((log) => [formatDateTime(log.created_at || log.log_date), log.product_name || log.name || '-', log.change_type || log.type || log.reason || '-', numberCell(formatInteger(log.before_quantity ?? log.before_stock ?? log.old_stock ?? 0)), numberCell(formatInteger(log.change_quantity ?? log.amount ?? log.quantity ?? 0)), numberCell(formatInteger(log.after_quantity ?? log.after_stock ?? log.new_stock ?? 0)), log.actor_name || log.admin_name || log.username || 'ระบบ']),
        };
    }

    if (reportKey === 'products') {
        return {
            title: 'พิมพ์รายการสินค้า',
            subtitle: `${products.length.toLocaleString('th-TH')} สินค้า · พิมพ์เมื่อ ${printedAt}`,
            fileName: 'product-list',
            headers: ['รหัส', 'ชื่อ', 'หมวดหมู่', 'ราคา', 'สต็อก', 'สถานะ'],
            rows: products.map((product) => [getProductId(product), getProductName(product), getProductCategory(product), numberCell(formatMoney(getProductPrice(product)), '฿'), numberCell(formatInteger(getProductStock(product))), Number(product.status_product ?? product.is_active ?? 1) === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน']),
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

    return {
        title: 'พิมพ์รายชื่อผู้ใช้งาน',
        subtitle: `${rangedCustomers.length.toLocaleString('th-TH')} ผู้ใช้งาน · ${rangeText} · พิมพ์เมื่อ ${printedAt}`,
        fileName: 'users',
        headers: ['User ID', 'ชื่อ', 'อีเมล', 'เบอร์', 'บทบาท', 'สถานะ', 'วันที่สมัคร'],
        rows: rangedCustomers.map((customer) => [customer.id || customer.user_id || '-', getCustomerName(customer), customer.email || '-', customer.phone || '-', customer.role || '-', Number(customer.status_user ?? customer.status ?? 1) === 1 ? 'ใช้งาน' : 'ระงับ/ปิดใช้งาน', formatDateTime(customer.created_at || customer.registered_at || customer.createdAt)]),
    };
};

const downloadReport = ({ title, subtitle, headers, rows, fileName }, format) => {
    let blob;
    let extension;
    if (format === 'excel') {
        const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"></head><body><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${renderCell(item)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
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
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;color:#101828;font-family:Arial,Tahoma,sans-serif}.actions{display:flex;gap:10px;margin-bottom:18px}.actions button{padding:10px 14px;border:0;border-radius:8px;cursor:pointer;font-weight:700}.primary{background:#111827;color:#fff}.secondary{background:#e5e7eb;color:#111827}h1{margin:0 0 6px;font-size:24px;font-weight:900}p{margin:0 0 18px;color:#667085}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border:1px solid #d8dee8;text-align:left;vertical-align:top}th{background:#f1f4f8;font-weight:900}.number{display:block;text-align:right;white-space:nowrap}@page{size:landscape;margin:10mm}@media print{body{padding:0}.actions{display:none}}</style></head><body><div class="actions"><button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button><button class="secondary" onclick="window.close()">ปิด</button></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((item) => `<td>${renderCell(item)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">ไม่พบข้อมูลรายงาน</td></tr>`}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),150);</script></body></html>`);
    popup.document.close();
};

function AdminSalesReportPrintPage() {
    const [quickReportDatePreset, setQuickReportDatePreset] = useState('30');
    const [loadingReportKey, setLoadingReportKey] = useState('');

    useEffect(() => {
        const previousTitle = document.title;
        document.title = 'รายงานระบบ';
        return () => { document.title = previousTitle; };
    }, []);

    const loadReportData = async () => {
        const [ordersResponse, productsResponse, customersResponse, stockLogsResponse, systemLogsResponse] = await Promise.all([
            adminApi.getAdminOrders(),
            productsApi.getProducts('', true),
            adminApi.getCustomers({ page: 1, limit: 10000 }),
            adminApi.getStockLogs(),
            adminApi.getSystemLogs(),
        ]);
        return {
            orders: Array.isArray(ordersResponse.data) ? ordersResponse.data : [],
            products: Array.isArray(productsResponse.data) ? productsResponse.data : [],
            customers: normalizeCustomersResponse(customersResponse),
            stockLogs: Array.isArray(stockLogsResponse.data) ? stockLogsResponse.data : [],
            systemLogs: Array.isArray(systemLogsResponse.data) ? systemLogsResponse.data : [],
            range: getReportRange(quickReportDatePreset),
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
                    </div>
                </header>
                <div className="sales-report-groups">
                    {REPORT_GROUPS.map((group) => (
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
            </section>
        </main>
    );
}

export default AdminSalesReportPrintPage;
