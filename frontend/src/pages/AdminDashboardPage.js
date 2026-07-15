import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as adminApi from '../api/adminApi';
import { notify } from '../components/AppNotification';
import { extractPaymentReviewData, extractTextFromImage } from '../utils/imageText';
import { resolveMediaUrl } from '../utils/media';

const formatMoney = (value) => {
    const amount = Number(value) || 0;
    return amount.toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const DEFAULT_ORDER_STATUS_FILTER = '__active_orders__';
const orderStatusOptions = [
    { value: DEFAULT_ORDER_STATUS_FILTER, label: 'ทั้งหมดไม่รวมเสร็จสิ้น/ยกเลิก' },
    { value: 'รอชำระ', label: 'รอชำระ' },
    { value: 'รอตรวจสอบ', label: 'รอตรวจสอบ' },
    { value: 'จัดเตรียม', label: 'จัดเตรียม' },
    { value: 'เสร็จสิ้น', label: 'เสร็จสิ้น' },
    { value: 'ยกเลิก', label: 'ยกเลิก' },
];
const preparingOrderStatuses = ['รอจัดการ', 'เตรียมสินค้า', 'กำลังจัดส่ง', 'พร้อมรับสินค้า', 'จัดส่งแล้ว'];
const blockedFulfillmentStatuses = ['เตรียมสินค้า', 'กำลังจัดส่ง', 'จัดส่งแล้ว', 'เสร็จสิ้น'];
const rejectionReasons = ['ยอดเงินไม่ถูกต้อง', 'รูปไม่ชัด', 'ไม่พบรายการโอน', 'หลักฐานไม่ถูกต้อง', 'อื่น ๆ'];
const isPickupOrder = (order) => order.shipping_method === 'รับหน้าร้าน';
const isPaidOrder = (order) => ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status);
const isCancelledOrder = (order) => order?.status === 'ยกเลิก' || order?.payment_status === 'ยกเลิก';
const isCompletedOrder = (order) => (order?.status || '') === 'เสร็จสิ้น';
const formatPaymentStatus = (status) => (status === 'ชำระแล้ว' ? 'ชำระเงินแล้ว' : status);
const matchesOrderStatusFilter = (order, statusFilter) => {
    const orderStatus = order.status || 'รอจัดการ';
    const paymentStatus = order.payment_status || '';
    if (statusFilter === DEFAULT_ORDER_STATUS_FILTER) return !isCompletedOrder(order) && !isCancelledOrder(order);
    if (statusFilter === 'รอชำระ') return ['รอชำระเงิน', 'รอจัดการ'].includes(orderStatus) || paymentStatus === 'รอชำระ';
    if (statusFilter === 'รอตรวจสอบ') return orderStatus === 'รอตรวจสอบการชำระเงิน' || paymentStatus === 'รอตรวจสอบ';
    if (statusFilter === 'จัดเตรียม') return preparingOrderStatuses.includes(orderStatus);
    if (statusFilter === 'ยกเลิก') return isCancelledOrder(order);
    return orderStatus === statusFilter;
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

const quickReportPresetToDashboardPreset = (preset) => {
    if (preset === 'day') return 'today';
    if (preset === 'week') return '7';
    if (preset === 'month') return 'month';
    if (preset === 'year') return 'year';
    return 'custom';
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

const getOrderDate = (order = {}) => new Date(order.created_at || order.order_date || order.payment_date || 0);
const getOrderAmount = (order = {}) => Number(order.final_price ?? order.total_price ?? 0) || 0;
const getPersonName = (item = {}, fallback = 'ผู้ใช้งานทั่วไป') => item.full_name || item.username || item.name || fallback;

const getRangeBounds = (range = {}) => ({
    from: new Date(`${range.from}T00:00:00`),
    to: new Date(`${range.to}T23:59:59`),
});

const getPreviousRange = (range = {}) => {
    const { from, to } = getRangeBounds(range);
    const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const previousTo = new Date(from);
    previousTo.setDate(previousTo.getDate() - 1);
    previousTo.setHours(23, 59, 59, 999);
    const previousFrom = new Date(previousTo);
    previousFrom.setDate(previousFrom.getDate() - span + 1);
    previousFrom.setHours(0, 0, 0, 0);
    return { from: previousFrom, to: previousTo };
};

const isWithinBounds = (value, bounds) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date >= bounds.from && date <= bounds.to;
};

const getChangeMeta = (currentValue, previousValue, {
    positiveLabel = 'ดีขึ้นจากช่วงก่อนหน้า',
    negativeLabel = 'ต่ำกว่าช่วงก่อนหน้า',
    neutralLabel = 'เท่ากับช่วงก่อนหน้า',
} = {}) => {
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    if (previous <= 0) {
        if (current <= 0) return { tone: 'neutral', value: '0%', label: neutralLabel };
        return { tone: 'up', value: 'ใหม่', label: 'เริ่มมีข้อมูลในช่วงนี้' };
    }
    const diff = ((current - previous) / previous) * 100;
    const abs = Math.abs(diff).toLocaleString('th-TH', { maximumFractionDigits: 0 });
    if (Math.abs(diff) < 0.5) return { tone: 'neutral', value: '0%', label: neutralLabel };
    return {
        tone: diff > 0 ? 'up' : 'down',
        value: `${diff > 0 ? '+' : '-'}${abs}%`,
        label: diff > 0 ? positiveLabel : negativeLabel,
    };
};

const formatRelativeTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return 'เมื่อสักครู่';
    if (diffMinutes < 60) return `${diffMinutes.toLocaleString('th-TH')} นาทีที่แล้ว`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours.toLocaleString('th-TH')} ชั่วโมงที่แล้ว`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays.toLocaleString('th-TH')} วันที่แล้ว`;
};

const summarizeOrderItems = (items = [], { full = false } = {}) => {
    if (!Array.isArray(items) || items.length === 0) return '-';
    const sourceItems = full ? items : items.slice(0, 3);
    const lines = sourceItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        return `${item.product_name || 'สินค้า'} x${quantity.toLocaleString('th-TH')}`;
    });
    if (!full && items.length > 3) {
        lines.push(`+${items.length - 3} รายการ`);
    }
    return full ? lines.join('\n') : lines.join(', ');
};

const formatOrderTrackingSummary = (order = {}) => {
    const trackingNo = order.tracking_no || '';
    const shippingMethod = order.shipping_method || '-';
    return trackingNo ? trackingNo : (shippingMethod === 'รับหน้าร้าน' ? 'N/A' : 'ยังไม่มี');
};

const formatOrderContactSummary = (order = {}) => {
    const phone = order.shipping_phone || order.customer_phone || order.phone || '';
    return phone || '-';
};

const formatAuditDateTime = (value) => (value ? new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
}) : '-');

const formatReportDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const getPaymentReceivedAt = (order = {}) => order.reviewed_at || order.payment_date || order.created_at || order.order_date;
const getPaymentReceivedAmount = (order = {}) => {
    if (order.verified_amount !== undefined && order.verified_amount !== null && String(order.verified_amount).trim() !== '') {
        return Number(order.verified_amount) || 0;
    }
    if (order.payment_amount !== undefined && order.payment_amount !== null && String(order.payment_amount).trim() !== '') {
        return Number(order.payment_amount) || 0;
    }
    return Number(order.final_price ?? order.total_price ?? 0) || 0;
};

const renderReportCellHtml = (value) => {
    if (value && typeof value === 'object' && value.html) return value.html;
    return escapeHtml(value).replace(/\n/g, '<br>');
};

const renderSlipReportThumb = (order) => {
    if (!order?.receipt_image) return { text: '-' };
    const imageUrl = resolveMediaUrl(order.receipt_image);
    return {
        text: imageUrl,
        html: `<img class="report-slip-thumb" style="max-width:220px;width:100%;height:auto;object-fit:contain;border-radius:10px;border:1px solid #d0d5dd;background:#f2f4f7" src="${escapeHtml(imageUrl)}" alt="สลิปออเดอร์ ${escapeHtml(order.id)}" />`,
    };
};

const getOrderReportConfig = (orderViewTab, rows, orderRange, slipPageTab = 'review') => {
    const countText = `${rows.length.toLocaleString('th-TH')} รายการ · ${orderRange.from} ถึง ${orderRange.to}`;
    if (orderViewTab === 'slips') {
        if (slipPageTab === 'history') {
            return {
                title: 'รายงานประวัติอนุมัติ',
                subtitle: countText,
                fileName: `slip-approval-history-${orderRange.from}-${orderRange.to}`,
                headers: ['เลขออเดอร์', 'วันที่ตรวจ', 'ผู้ใช้งาน', 'รูปสลิป', 'ยอดที่ตรวจพบ', 'เลขอ้างอิง', 'ผู้ตรวจสอบ', 'ผลการตรวจ'],
                rows: rows.map((order) => ([
                    `#${order.id}`,
                    order.reviewed_at ? formatDateTime(order.reviewed_at) : order.payment_date ? formatDateTime(order.payment_date) : '-',
                    order.full_name || order.username || 'ผู้ใช้งานทั่วไป',
                    renderSlipReportThumb(order),
                    order.verified_amount !== undefined && order.verified_amount !== null && String(order.verified_amount).trim() !== ''
                        ? `฿${formatMoney(order.verified_amount)}`
                        : (order.payment_amount !== undefined && order.payment_amount !== null && String(order.payment_amount).trim() !== ''
                            ? `฿${formatMoney(order.payment_amount)}`
                            : '-'),
                    order.transaction_ref || '-',
                    order.reviewer_full_name || order.reviewer_username || (order.reviewed_at ? 'แอดมิน' : '-'),
                    ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status)
                        ? 'อนุมัติการชำระเงิน'
                        : (order.review_note || (order.payment_status ? `ปฏิเสธหลักฐาน (${formatPaymentStatus(order.payment_status)})` : '-')),
                ])),
            };
        }
        return {
            title: 'รายงานตรวจสลิป',
            subtitle: countText,
            fileName: `slip-review-report-${orderRange.from}-${orderRange.to}`,
            headers: ['เลขออเดอร์', 'วันที่ส่งสลิป', 'ผู้ใช้งาน', 'ยอดออเดอร์', 'ยอดที่ตรวจพบ', 'เลขอ้างอิง', 'สถานะสลิป', 'หมายเหตุ'],
            rows: rows.map((order) => ([
                `#${order.id}`,
                order.payment_date ? formatDateTime(order.payment_date) : '-',
                order.full_name || order.username || 'ผู้ใช้งานทั่วไป',
                `฿${formatMoney(order.final_price ?? order.total_price)}`,
                order.verified_amount ? `฿${formatMoney(order.verified_amount)}` : '-',
                order.transaction_ref || '-',
                formatPaymentStatus(order.payment_status) || '-',
                order.review_note || '-',
            ])),
        };
    }

    if (orderViewTab === 'print') {
        return {
            title: 'รายงานพิมพ์ใบจัดส่ง',
            subtitle: countText,
            fileName: `shipping-report-${orderRange.from}-${orderRange.to}`,
            headers: ['เลขออเดอร์', 'วันที่สั่งซื้อ', 'ผู้ใช้งาน', 'สินค้า', 'วิธีรับสินค้า', 'เบอร์ติดต่อ'],
            rows: rows.map((order) => ([
                `#${order.id}`,
                formatDateTime(order.created_at),
                order.full_name || order.username || 'ผู้ใช้งานทั่วไป',
                summarizeOrderItems(order.items || [], { full: true }),
                order.shipping_method || '-',
                formatOrderContactSummary(order),
            ])),
        };
    }

    return {
        title: 'รายงานออเดอร์',
        subtitle: countText,
        fileName: `order-report-${orderRange.from}-${orderRange.to}`,
        headers: ['เลขออเดอร์', 'วันที่สั่งซื้อ', 'ผู้ใช้งาน', 'สถานะการชำระเงิน', 'วิธีรับสินค้า', 'เลขพัสดุ', 'ยอดสุทธิ', 'สถานะออเดอร์'],
        rows: rows.map((order) => ([
            `#${order.id}`,
            formatDateTime(order.created_at),
            order.full_name || order.username || 'ผู้ใช้งานทั่วไป',
            formatPaymentStatus(order.payment_status) || 'รอชำระ',
            order.shipping_method || '-',
            formatOrderTrackingSummary(order),
            `฿${formatMoney(order.final_price ?? order.total_price)}`,
            order.status || 'รอจัดการ',
        ])),
    };
};

const renderShippingSheetHtml = (payload, fallbackOrderId, printTimestamp) => {
    const order = payload?.order || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const isPickup = order.shipping_method === 'รับหน้าร้าน';
    const isPosSale = order.shipping_method === 'ขายหน้าร้าน';
    const receiverName = order.receiver_name || order.full_name || order.username || 'ผู้ใช้งานทั่วไป';
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
                <h2>ข้อมูลผู้ใช้งาน</h2>
                <dl>
                    <div><dt>ชื่อผู้ใช้งาน</dt><dd>${escapeHtml(order.full_name || receiverName)}</dd></div>
                    <div><dt>Username</dt><dd>${escapeHtml(order.username || '-')}</dd></div>
                    <div><dt>เบอร์โทรศัพท์</dt><dd>${escapeHtml(phone)}</dd></div>
                </dl>
            </article>
        </section>
        ${isPickup || isPosSale ? `<section class="pickup">
            <h2>วิธีรับสินค้า</h2>
            <strong>ผู้ใช้งานรับสินค้าด้วยตนเอง</strong>
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
                <thead><tr><th>สินค้า</th><th class="number">จำนวน</th><th class="number">ราคาต่อชิ้น</th><th class="number">ราคารวม</th></tr></thead>
                <tbody>${items.length ? items.map((item) => {
                    const qty = Number(item.quantity || 0);
                    const price = Number(item.price || 0);
                    return `<tr><td>${escapeHtml(item.product_name || '-')}</td><td class="number">${qty.toLocaleString('th-TH')}</td><td class="number">฿${formatMoney(price)}</td><td class="number">฿${formatMoney(qty * price)}</td></tr>`;
                }).join('') : '<tr><td colspan="4">ไม่มีรายการสินค้า</td></tr>'}</tbody>
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
    products = [],
    stockLogs = [],
    systemLogs = [],
    onCancelOrder,
    onUpdateOrderStatus,
    onReviewOrderPayment,
    onBulkReviewOrderPayments,
    setAdminPage,
    setIsAdminView,
    currentUser,
    view = 'dashboard',
}) {
    const showOrderManagement = view === 'orders';
    const showDashboard = !showOrderManagement;
    const [trackingInputs, setTrackingInputs] = useState({});
    const [statusFilter, setStatusFilter] = useState(DEFAULT_ORDER_STATUS_FILTER);
    const [trackingErrors, setTrackingErrors] = useState({});
    const [savingOrderId, setSavingOrderId] = useState(null);
    const [datePreset, setDatePreset] = useState('30');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showChartDatePicker, setShowChartDatePicker] = useState(false);
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
    const [orderViewTab, setOrderViewTab] = useState('orders');
    const [slipPageTab, setSlipPageTab] = useState('review');
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
    const [paymentReviewSaving, setPaymentReviewSaving] = useState('');
    const [paymentReviewError, setPaymentReviewError] = useState('');
    const [quickReviewOrderAction, setQuickReviewOrderAction] = useState('');
    const [bulkSlipReviewSaving, setBulkSlipReviewSaving] = useState(false);
    const [bulkSlipReviewResult, setBulkSlipReviewResult] = useState(null);
    const [paymentReviewForm, setPaymentReviewForm] = useState({
        verified_amount: '',
        transaction_ref: '',
        review_note: '',
    });
    const [slipReviewDrafts, setSlipReviewDrafts] = useState({});
    const [slipReviewFieldErrors, setSlipReviewFieldErrors] = useState({});
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [receiptOcrLoading, setReceiptOcrLoading] = useState(false);
    const [receiptOcrError, setReceiptOcrError] = useState('');
    const [tableReceiptOcrOrderId, setTableReceiptOcrOrderId] = useState(null);
    const [tableReceiptOcrError, setTableReceiptOcrError] = useState('');
    const [tableReceiptOcrErrorOrderId, setTableReceiptOcrErrorOrderId] = useState(null);
    const [tableRejectDialogOrder, setTableRejectDialogOrder] = useState(null);
    const [rejectReviewOpen, setRejectReviewOpen] = useState(false);
    const [rejectReviewReason, setRejectReviewReason] = useState('');
    const [rejectReviewError, setRejectReviewError] = useState('');
    const [quickReportRequest, setQuickReportRequest] = useState(null);
    const [quickReportDatePreset, setQuickReportDatePreset] = useState('30');
    const [quickReportPreset, setQuickReportPreset] = useState('custom');
    const [quickReportDateFrom, setQuickReportDateFrom] = useState('');
    const [quickReportDateTo, setQuickReportDateTo] = useState('');
    const [quickReportError, setQuickReportError] = useState('');
    const [selectedPrintOrderIds, setSelectedPrintOrderIds] = useState([]);
    const orderManagementRef = useRef(null);
    const paymentReviewRequestRef = useRef('');
    const printStatusFilterRef = useRef(DEFAULT_ORDER_STATUS_FILTER);
    const navigateQuickAction = useCallback((target, view = '') => {
        if (target === 'store') {
            setIsAdminView?.(false);
            return;
        }
        if (view) sessionStorage.setItem('adminProductView', view);
        setAdminPage?.(target);
    }, [setAdminPage, setIsAdminView]);
    const applyQuickReportPreset = (preset) => {
        setQuickReportPreset(preset);
        if (preset === 'custom') return;
        const range = getDateRange(quickReportPresetToDashboardPreset(preset), '', '');
        setQuickReportDateFrom(range.from);
        setQuickReportDateTo(range.to);
        setQuickReportError('');
    };
    const applyQuickReportDatePreset = (preset) => {
        setQuickReportDatePreset(preset);
        if (preset === 'custom') {
            if (!quickReportDateFrom || !quickReportDateTo) {
                const range = getDateRange('30', '', '');
                setQuickReportDateFrom(range.from);
                setQuickReportDateTo(range.to);
            }
            return;
        }
        const range = getDateRange(preset, '', '');
        setQuickReportDateFrom(range.from);
        setQuickReportDateTo(range.to);
        setQuickReportError('');
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
                order.transaction_ref,
                order.payment_date ? new Date(order.payment_date).toLocaleString('th-TH') : '',
                order.payment_status,
            ].join(' ').toLowerCase();
            return (!keyword || searchable.includes(keyword))
                && matchesOrderStatusFilter(order, statusFilter)
                && (deliveryFilter === 'ทั้งหมด' || (order.shipping_method || '-') === deliveryFilter)
                && (!Number.isNaN(orderDate.getTime()) && orderDate >= from && orderDate <= to);
        }).sort((a, b) => {
            const direction = orderSort.direction === 'asc' ? 1 : -1;
            if (orderSort.key === 'id') return (Number(a.id) - Number(b.id)) * direction;
            if (orderSort.key === 'amount') return ((Number(a.final_price) || 0) - (Number(b.final_price) || 0)) * direction;
            if (orderSort.key === 'status') return String(a.status || '').localeCompare(String(b.status || ''), 'th') * direction;
            return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) * direction;
        });
    }, [orders, orderSearch, statusFilter, deliveryFilter, orderRange.from, orderRange.to, orderSort]);
    const getOrdersWithinRange = useCallback((range) => {
        const bounds = getRangeBounds(range);
        return orders.filter((order) => {
            const orderDate = order.created_at || order.order_date;
            return !isCancelledOrder(order) && isWithinBounds(orderDate, bounds);
        });
    }, [orders]);
    const getOrderRowsByView = useCallback((nextOrderView, nextSlipPageTab = 'review', sourceOrders = filteredOrders) => {
        const nextSlipReviewOrders = sourceOrders.filter((order) => Boolean(order.receipt_image) && order.payment_status === 'รอตรวจสอบ');
        const nextSlipHistoryOrders = sourceOrders
            .filter((order) => Boolean(order.receipt_image) && Boolean(order.reviewed_at))
            .sort((a, b) => new Date(b.reviewed_at || b.payment_date || b.created_at) - new Date(a.reviewed_at || a.payment_date || a.created_at));
        if (nextOrderView === 'slips') {
            return nextSlipPageTab === 'history' ? nextSlipHistoryOrders : nextSlipReviewOrders;
        }
        if (nextOrderView === 'print') {
            return sourceOrders.filter((order) => (
                isPaidOrder(order)
                && order.status === 'เตรียมสินค้า'
                && ['ส่งสินค้า', 'รับหน้าร้าน'].includes(order.shipping_method)
            ));
        }
        return sourceOrders;
    }, [filteredOrders]);
    const activeOrderRows = useMemo(
        () => getOrderRowsByView(orderViewTab, slipPageTab),
        [getOrderRowsByView, orderViewTab, slipPageTab],
    );
    const reviewableSlipOrders = useMemo(
        () => (orderViewTab === 'slips' && slipPageTab === 'review' ? activeOrderRows : []),
        [activeOrderRows, orderViewTab, slipPageTab],
    );
    const orderTotalPages = Math.max(1, Math.ceil(activeOrderRows.length / orderPageSize));
    const visibleOrders = activeOrderRows.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);
    const pendingSlipReviewCount = orders.filter((order) => order.payment_status === 'รอตรวจสอบ').length;
    const newOrdersCount = orders.filter((order) => isWithinBounds(order.created_at || order.order_date, getRangeBounds(getDateRange('today')))).length;
    const readyToPrintCount = orders.filter((order) => (
        isPaidOrder(order)
        && order.status === 'เตรียมสินค้า'
        && ['ส่งสินค้า', 'รับหน้าร้าน'].includes(order.shipping_method)
    )).length;
    const visiblePaidOrderIds = visibleOrders.filter(isPaidOrder).map((order) => String(order.id));
    const allVisiblePaidSelected = visiblePaidOrderIds.length > 0 && visiblePaidOrderIds.every((id) => selectedPrintOrderIds.includes(id));
    const showPrintSelectionColumn = orderViewTab === 'print';
    const orderReportConfig = useMemo(
        () => getOrderReportConfig(orderViewTab, activeOrderRows, orderRange, slipPageTab),
        [activeOrderRows, orderRange, orderViewTab, slipPageTab],
    );
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
    const selectedRangeBounds = useMemo(() => getRangeBounds(selectedRange), [selectedRange]);
    const previousRangeBounds = useMemo(() => getPreviousRange(selectedRange), [selectedRange]);
    const rangeOrders = useMemo(
        () => orders.filter((order) => !isCancelledOrder(order) && isWithinBounds(order.created_at || order.order_date, selectedRangeBounds)),
        [orders, selectedRangeBounds],
    );
    const previousRangeOrders = useMemo(
        () => orders.filter((order) => !isCancelledOrder(order) && isWithinBounds(order.created_at || order.order_date, previousRangeBounds)),
        [orders, previousRangeBounds],
    );
    const currentRevenue = useMemo(
        () => rangeOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
        [rangeOrders],
    );
    const previousRevenue = useMemo(
        () => previousRangeOrders.reduce((sum, order) => sum + getOrderAmount(order), 0),
        [previousRangeOrders],
    );
    const revenueChange = useMemo(
        () => getChangeMeta(currentRevenue, previousRevenue, { positiveLabel: 'สูงกว่าช่วงก่อนหน้า', negativeLabel: 'ต่ำกว่าช่วงก่อนหน้า' }),
        [currentRevenue, previousRevenue],
    );
    const orderChange = useMemo(
        () => getChangeMeta(rangeOrders.length, previousRangeOrders.length, { positiveLabel: 'ออเดอร์เพิ่มขึ้น', negativeLabel: 'ออเดอร์ลดลง' }),
        [rangeOrders.length, previousRangeOrders.length],
    );
    const salesBreakdown = useMemo(() => {
        const activeOrders = orders.filter((order) => !isCancelledOrder(order));
        const presets = [
            ['รายวัน', getRangeBounds(getDateRange('today'))],
            ['รายสัปดาห์', getRangeBounds(getDateRange('7'))],
            ['รายเดือน', getRangeBounds(getDateRange('month'))],
            ['ปี', getRangeBounds(getDateRange('year'))],
        ];
        return presets.map(([label, bounds]) => ({
            label,
            total: activeOrders
                .filter((order) => isWithinBounds(order.created_at || order.order_date, bounds))
                .reduce((sum, order) => sum + getOrderAmount(order), 0),
        }));
    }, [orders]);
    const attentionItems = useMemo(() => ([
        ['new_orders', 'ออเดอร์ใหม่วันนี้', 'blue', () => navigateQuickAction('admin-orders')],
        ['waiting_payment', 'รอชำระเงิน', 'amber', () => navigateQuickAction('admin-orders')],
        ['waiting_review', 'รอตรวจสอบสลิป', 'purple', () => navigateQuickAction('admin-orders')],
        ['low_stock', 'สินค้าใกล้หมด', 'orange', () => navigateQuickAction('add-product', 'products')],
        ['out_of_stock', 'สินค้าหมดสต๊อก', 'red', () => navigateQuickAction('add-product', 'products')],
    ].map(([key, label, color, action]) => ({
        key,
        label,
        color,
        action,
        total: Number(dashboardData.notifications?.[key] || 0),
    }))), [dashboardData.notifications, navigateQuickAction]);
    const totalAttentionCount = useMemo(
        () => attentionItems.reduce((sum, item) => sum + item.total, 0),
        [attentionItems],
    );
    const taskInboxItems = useMemo(() => {
        const waitingReviewOrders = orders
            .filter((order) => order.payment_status === 'รอตรวจสอบ')
            .sort((a, b) => new Date(a.payment_date || a.created_at || 0) - new Date(b.payment_date || b.created_at || 0));
        const stuckOrders = orders
            .filter((order) => !isCancelledOrder(order) && ['รอจัดการ', 'เตรียมสินค้า', 'กำลังจัดส่ง', 'พร้อมรับสินค้า'].includes(order.status || 'รอจัดการ'))
            .sort((a, b) => getOrderDate(a) - getOrderDate(b));
        const readyToPrintOrders = orders
            .filter((order) => isPaidOrder(order) && order.status === 'เตรียมสินค้า')
            .sort((a, b) => getOrderDate(a) - getOrderDate(b));
        const lowStockProducts = products
            .filter((product) => Number(product.product_status ?? product.status ?? 1) === 1 && Number(product.stock ?? product.quantity ?? 0) <= 5)
            .sort((a, b) => (Number(a.stock ?? a.quantity ?? 0) || 0) - (Number(b.stock ?? b.quantity ?? 0) || 0));
        const newOrdersToday = orders.filter((order) => isWithinBounds(order.created_at || order.order_date, getRangeBounds(getDateRange('today'))));
        const items = [];
        if (waitingReviewOrders[0]) {
            const order = waitingReviewOrders[0];
            items.push({
                id: `review-${order.id}`,
                tone: 'purple',
                eyebrow: 'ตรวจสลิป',
                title: `ออเดอร์ #${order.id} ส่งหลักฐานแล้ว`,
                detail: `${getPersonName(order)} · ยอดสุทธิ ฿${formatMoney(getOrderAmount(order))}`,
                age: formatRelativeTime(order.payment_date || order.created_at),
                actionLabel: 'ตรวจเลย',
                onAction: () => loadOrderDetails(order),
            });
        }
        if (stuckOrders[0]) {
            const order = stuckOrders[0];
            items.push({
                id: `stuck-${order.id}`,
                tone: 'blue',
                eyebrow: 'ออเดอร์ค้าง',
                title: `ออเดอร์ #${order.id} ยังอยู่สถานะ ${order.status || 'รอจัดการ'}`,
                detail: `${getPersonName(order)} · ${order.shipping_method || '-'}`,
                age: formatRelativeTime(order.created_at || order.order_date),
                actionLabel: 'เปิดออเดอร์',
                onAction: () => loadOrderDetails(order),
            });
        }
        if (lowStockProducts[0]) {
            const product = lowStockProducts[0];
            const stock = Number(product.stock ?? product.quantity ?? 0) || 0;
            items.push({
                id: `stock-${product.id || product.product_id}`,
                tone: stock <= 0 ? 'red' : 'orange',
                eyebrow: stock <= 0 ? 'สินค้าหมด' : 'สต๊อกต่ำ',
                title: `${product.name || product.product_name || 'สินค้า'} เหลือ ${stock.toLocaleString('th-TH')} ชิ้น`,
                detail: `${product.category_name || 'ยังไม่ระบุหมวดหมู่'} · ควรเติมสต๊อกก่อนยอดตก`,
                age: stock <= 0 ? 'ต้องเติมทันที' : 'ควรเติมเร็ว ๆ นี้',
                actionLabel: 'ไปจัดการสต๊อก',
                onAction: () => navigateQuickAction('add-product', 'products'),
            });
        }
        if (readyToPrintOrders[0]) {
            items.push({
                id: `print-${readyToPrintOrders[0].id}`,
                tone: 'green',
                eyebrow: 'พร้อมจัดส่ง',
                title: `ออเดอร์ #${readyToPrintOrders[0].id} พร้อมพิมพ์ใบจัดส่ง`,
                detail: `${getPersonName(readyToPrintOrders[0])} · ${readyToPrintOrders.length.toLocaleString('th-TH')} รายการพร้อมทำต่อ`,
                age: formatRelativeTime(readyToPrintOrders[0].created_at || readyToPrintOrders[0].order_date),
                actionLabel: 'ไปหน้าพิมพ์',
                onAction: () => {
                    setAdminPage?.('admin-orders');
                    setOrderViewTab('print');
                },
            });
        }
        if (newOrdersToday.length) {
            items.push({
                id: 'today-orders',
                tone: 'amber',
                eyebrow: 'ออเดอร์ใหม่',
                title: `วันนี้มีออเดอร์เข้า ${newOrdersToday.length.toLocaleString('th-TH')} รายการ`,
                detail: 'เช็กคิวชำระเงินและการจัดส่งเพื่อไม่ให้มีงานตกค้าง',
                age: 'อัปเดตจากข้อมูลวันนี้',
                actionLabel: 'ดูทั้งหมด',
                onAction: () => setAdminPage?.('admin-orders'),
            });
        }
        return items.slice(0, 5);
    }, [navigateQuickAction, orders, products, setAdminPage, setOrderViewTab]);
    useEffect(() => {
        // เก็บเลขพัสดุแยกตามออเดอร์ เพื่อให้แก้ในตารางได้โดยไม่กระทบแถวอื่น
        setTrackingInputs((current) => orders.reduce((next, order) => ({
            ...next,
            [order.id]: current[order.id] ?? order.tracking_no ?? '',
        }), {}));
    }, [orders]);

    useEffect(() => {
        setOrderPage(1);
    }, [orderSearch, statusFilter, deliveryFilter, orderDatePreset, orderDateFrom, orderDateTo, orderPageSize, orderViewTab, slipPageTab]);

    useEffect(() => {
        if (orderPage > orderTotalPages) setOrderPage(orderTotalPages);
    }, [orderPage, orderTotalPages]);

    useEffect(() => {
        const paidIds = new Set(orders.filter(isPaidOrder).map((order) => String(order.id)));
        setSelectedPrintOrderIds((current) => current.filter((id) => paidIds.has(id)));
    }, [orders]);

    useEffect(() => {
        setSlipReviewDrafts((current) => orders.reduce((next, order) => {
            if (!order.receipt_image) return next;
            next[order.id] = {
                verified_amount: current[order.id]?.verified_amount ?? order.verified_amount ?? '',
                transaction_ref: current[order.id]?.transaction_ref ?? order.transaction_ref ?? '',
            };
            return next;
        }, {}));
    }, [orders]);

    useEffect(() => {
        if (orderViewTab !== 'slips') return;
        setSlipPageTab('review');
        setOrderSort((current) => (
            current.key === 'date' && current.direction === 'asc'
                ? current
                : { key: 'date', direction: 'asc' }
        ));
    }, [orderViewTab]);

    useEffect(() => {
        if (orderViewTab !== 'print') return;
        setOrderSort((current) => (
            current.key === 'date' && current.direction === 'asc'
                ? current
                : { key: 'date', direction: 'asc' }
        ));
    }, [orderViewTab]);

    useEffect(() => {
        if (orderViewTab !== 'orders') return;
        setOrderSort((current) => (
            current.key === 'date' && current.direction === 'asc'
                ? current
                : { key: 'date', direction: 'asc' }
        ));
    }, [orderViewTab]);

    useEffect(() => {
        if (orderViewTab !== 'print') return;
        if (statusFilter !== 'เตรียมสินค้า') {
            printStatusFilterRef.current = statusFilter;
            setStatusFilter('เตรียมสินค้า');
        }
    }, [orderViewTab, statusFilter]);

    useEffect(() => {
        if (orderViewTab === 'print') return;
        if (statusFilter === 'เตรียมสินค้า') {
            setStatusFilter(printStatusFilterRef.current || DEFAULT_ORDER_STATUS_FILTER);
        }
    }, [orderViewTab, statusFilter]);

    useEffect(() => {
        if (orderViewTab !== 'print') return;
        if (!['ทั้งหมด', 'ส่งสินค้า', 'รับหน้าร้าน'].includes(deliveryFilter)) {
            setDeliveryFilter('ทั้งหมด');
        }
    }, [orderViewTab, deliveryFilter]);

    useEffect(() => {
        if (!showOrderManagement) return;
        const storedOrderView = sessionStorage.getItem('adminDashboardOrderView');
        const storedSlipView = sessionStorage.getItem('adminDashboardSlipView');
        if (storedOrderView && ['orders', 'slips', 'print'].includes(storedOrderView)) {
            setOrderViewTab(storedOrderView);
            sessionStorage.removeItem('adminDashboardOrderView');
        }
        if (storedSlipView && ['review', 'history'].includes(storedSlipView)) {
            setSlipPageTab(storedSlipView);
            sessionStorage.removeItem('adminDashboardSlipView');
        }
    }, [showOrderManagement]);

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

    const openPrintPage = async (orderIds) => {
        const idsToPrint = Array.isArray(orderIds) ? orderIds.map((id) => String(id)).filter(Boolean) : [];
        if (idsToPrint.length === 0) {
            notify({ type: 'warning', title: 'ยังไม่ได้เลือกออเดอร์', message: 'กรุณาเลือกออเดอร์ที่ชำระแล้วก่อนพิมพ์ใบจัดส่ง' });
            return;
        }
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

    const openSelectedPrintPage = async () => {
        await openPrintPage(selectedPrintOrderIds);
    };

    const openSinglePrintPage = async (order) => {
        if (!isPaidOrder(order)) return;
        await openPrintPage([order.id]);
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

    const openReceiptLightbox = (order, event) => {
        event?.stopPropagation?.();
        if (!order?.receipt_image) return;
        setReceiptOcrError('');
        setReceiptPreview({
            src: resolveMediaUrl(order.receipt_image),
            orderId: order.id,
        });
    };

    const reviewReceiptEvidence = async () => {
        if (!receiptPreview?.src || receiptOcrLoading) return;

        setReceiptOcrLoading(true);
        setReceiptOcrError('');
        try {
            const extractedText = await extractTextFromImage(receiptPreview.src);
            if (!extractedText) {
                notify({
                    type: 'warning',
                    title: 'ไม่พบข้อมูลในภาพ',
                    message: 'รูปนี้อาจไม่ชัดพอสำหรับการอ่านจำนวนเงินหรืออ้างอิง',
                });
                return;
            }

            const reviewData = extractPaymentReviewData(extractedText);
            const hasAmount = Boolean(reviewData.verified_amount);
            const hasReference = Boolean(reviewData.transaction_ref);
            if (!hasAmount && !hasReference) {
                notify({
                    type: 'warning',
                    title: 'ตรวจสอบไม่พบข้อมูลที่ตรงกับฟอร์ม',
                    message: 'ลองใช้รูปที่ชัดขึ้นหรือเปิดสลิปอีกครั้ง',
                });
                return;
            }

            setPaymentReviewForm((current) => ({
                ...current,
                verified_amount: current.verified_amount?.toString().trim()
                    ? current.verified_amount
                    : (reviewData.verified_amount || current.verified_amount),
                transaction_ref: current.transaction_ref?.toString().trim()
                    ? current.transaction_ref
                    : (reviewData.transaction_ref || current.transaction_ref),
            }));

            notify({
                type: 'success',
                title: 'ตรวจสอบข้อมูลจากภาพแล้ว',
                message: [
                    hasAmount ? `จำนวนเงิน: ${reviewData.verified_amount}` : null,
                    hasReference ? `อ้างอิง: ${reviewData.transaction_ref}` : null,
                ].filter(Boolean).join(' · '),
            });
        } catch (error) {
            setReceiptOcrError('ตรวจสอบข้อมูลจากภาพไม่สำเร็จ');
            notify({
                type: 'error',
                title: 'ตรวจสอบข้อมูลจากภาพไม่สำเร็จ',
                message: 'ลองใช้รูปที่ชัดขึ้นหรือเปิดใหม่อีกครั้ง',
            });
            console.error(error);
        } finally {
            setReceiptOcrLoading(false);
        }
    };

    const reviewSlipRowEvidence = async (order) => {
        if (!order?.receipt_image || tableReceiptOcrOrderId || bulkSlipReviewSaving) return;

        setTableReceiptOcrOrderId(order.id);
        setTableReceiptOcrError('');
        setTableReceiptOcrErrorOrderId(null);
        try {
            const extractedText = await extractTextFromImage(resolveMediaUrl(order.receipt_image));
            if (!extractedText) {
                notify({
                    type: 'warning',
                    title: 'ไม่พบข้อมูลในภาพ',
                    message: 'รูปนี้อาจไม่ชัดพอสำหรับการอ่านจำนวนเงินหรืออ้างอิง',
                });
                return;
            }

            const reviewData = extractPaymentReviewData(extractedText);
            const hasAmount = Boolean(reviewData.verified_amount);
            const hasReference = Boolean(reviewData.transaction_ref);
            if (!hasAmount && !hasReference) {
                notify({
                    type: 'warning',
                    title: 'ตรวจสอบไม่พบข้อมูลที่ตรงกับฟอร์ม',
                    message: 'ลองใช้รูปที่ชัดขึ้นหรือเปิดสลิปอีกครั้ง',
                });
                return;
            }

            setSlipReviewDrafts((current) => {
                const currentDraft = current[order.id] || { verified_amount: '', transaction_ref: '' };
                return {
                    ...current,
                    [order.id]: {
                        verified_amount: currentDraft.verified_amount?.toString().trim()
                            ? currentDraft.verified_amount
                            : (reviewData.verified_amount || currentDraft.verified_amount || ''),
                        transaction_ref: currentDraft.transaction_ref?.toString().trim()
                            ? currentDraft.transaction_ref
                            : (reviewData.transaction_ref || currentDraft.transaction_ref || ''),
                    },
                };
            });

            notify({
                type: 'success',
                title: 'ตรวจสอบข้อมูลจากภาพแล้ว',
                message: [
                    hasAmount ? `จำนวนเงิน: ${reviewData.verified_amount}` : null,
                    hasReference ? `อ้างอิง: ${reviewData.transaction_ref}` : null,
                ].filter(Boolean).join(' · '),
            });
        } catch (error) {
            setTableReceiptOcrError('ตรวจสอบข้อมูลจากภาพไม่สำเร็จ');
            setTableReceiptOcrErrorOrderId(order.id);
            notify({
                type: 'error',
                title: 'ตรวจสอบข้อมูลจากภาพไม่สำเร็จ',
                message: 'ลองใช้รูปที่ชัดขึ้นหรือเปิดใหม่อีกครั้ง',
            });
            console.error(error);
        } finally {
            setTableReceiptOcrOrderId(null);
        }
    };

    const openRejectReviewDialog = () => {
        if (paymentReviewDisabled) return;
        setRejectReviewError('');
        setRejectReviewReason(rejectionReasons.includes(paymentReviewForm.review_note)
            ? paymentReviewForm.review_note
            : rejectionReasons[0]);
        setRejectReviewOpen(true);
    };

    const openTableRejectDialog = (order, event) => {
        event?.stopPropagation?.();
        if (!order?.receipt_image || quickReviewOrderAction || paymentReviewSaving) return;
        setTableRejectDialogOrder(order);
        setRejectReviewError('');
        setRejectReviewReason(rejectionReasons[0]);
    };

    const closeRejectReviewDialog = () => {
        if (paymentReviewSaving) return;
        setRejectReviewOpen(false);
        setRejectReviewError('');
    };

    const closeTableRejectDialog = () => {
        if (quickReviewOrderAction || paymentReviewSaving) return;
        setTableRejectDialogOrder(null);
        setRejectReviewError('');
    };

    const submitRejectReview = async () => {
        const reason = rejectReviewReason.trim();
        if (!reason) {
            setRejectReviewError('กรุณาเลือกเหตุผลในการปฏิเสธ');
            return;
        }

        setPaymentReviewForm((current) => ({
            ...current,
            review_note: reason,
        }));
        setRejectReviewOpen(false);
        await reviewPaymentEvidence('reject', reason);
    };

    const submitTableRejectReview = async () => {
        const order = tableRejectDialogOrder;
        const reason = rejectReviewReason.trim();
        if (!order) return;
        if (!reason) {
            setRejectReviewError('กรุณาเลือกเหตุผลในการปฏิเสธ');
            return;
        }

        setQuickReviewOrderAction(`${order.id}:reject`);
        setRejectReviewOpen(false);
        setRejectReviewError('');
        setTableRejectDialogOrder(null);

        try {
            const draft = slipReviewDrafts[order.id] || { verified_amount: '', transaction_ref: '' };
            const payload = {
                action: 'reject',
                user_id: currentUser?.id,
                verified_amount: draft.verified_amount,
                transaction_ref: draft.transaction_ref,
                review_note: reason,
            };
            if (onReviewOrderPayment) {
                await onReviewOrderPayment(order.id, payload);
            } else {
                await adminApi.reviewOrderPayment(order.id, payload);
            }
            if (selectedOrder?.id === order.id) {
                await refreshSelectedOrderDetails(order.id);
            }
            notify({
                type: 'success',
                title: 'ปฏิเสธหลักฐานแล้ว',
                message: `ออเดอร์ #${order.id} สามารถรอส่งสลิปใหม่ได้`,
            });
        } catch (err) {
            notify({
                type: 'error',
                title: 'ปฏิเสธหลักฐานไม่สำเร็จ',
                message: err.response?.data?.error || 'ไม่สามารถปฏิเสธหลักฐานได้',
            });
        } finally {
            setQuickReviewOrderAction('');
        }
    };

    const updateSlipReviewDraft = (orderId, field, value) => {
        setSlipReviewDrafts((current) => ({
            ...current,
            [orderId]: {
                verified_amount: current[orderId]?.verified_amount ?? '',
                transaction_ref: current[orderId]?.transaction_ref ?? '',
                [field]: value,
            },
        }));
        setSlipReviewFieldErrors((current) => {
            const nextErrors = current[orderId];
            if (!nextErrors?.[field]) return current;
            return {
                ...current,
                [orderId]: {
                    ...nextErrors,
                    [field]: '',
                },
            };
        });
    };

    const submitSlipReviewRow = async (order, action, event) => {
        event?.stopPropagation?.();
        if (!order?.receipt_image || quickReviewOrderAction || paymentReviewSaving || bulkSlipReviewSaving) return;

        const isApprove = action === 'approve';
        const requestKey = `${order.id}:${action}`;
        let draft = slipReviewDrafts[order.id] || { verified_amount: '', transaction_ref: '' };
        if (isApprove) {
            const verifiedAmount = String(draft.verified_amount || '').trim();
            const transactionRef = String(draft.transaction_ref || '').trim();
            const nextFieldErrors = {
                verified_amount: verifiedAmount ? '' : 'กรุณากรอกยอดที่ตรวจพบ',
                transaction_ref: transactionRef ? '' : 'กรุณากรอกเลขอ้างอิงรายการ',
            };
            if (nextFieldErrors.verified_amount || nextFieldErrors.transaction_ref) {
                if (!verifiedAmount && !transactionRef) {
                    try {
                        setTableReceiptOcrOrderId(order.id);
                        const extractedText = await extractTextFromImage(resolveMediaUrl(order.receipt_image));
                        const reviewData = extractedText ? extractPaymentReviewData(extractedText) : null;
                        const fallbackDraft = {
                            verified_amount: reviewData?.verified_amount || '',
                            transaction_ref: reviewData?.transaction_ref || '',
                        };
                        if (fallbackDraft.verified_amount || fallbackDraft.transaction_ref) {
                            draft = fallbackDraft;
                            setSlipReviewDrafts((current) => ({
                                ...current,
                                [order.id]: fallbackDraft,
                            }));
                        }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        setTableReceiptOcrOrderId(null);
                    }
                }
            }
            const retryVerifiedAmount = String(draft.verified_amount || '').trim();
            const retryTransactionRef = String(draft.transaction_ref || '').trim();
            if (!retryVerifiedAmount || !retryTransactionRef) {
                setSlipReviewFieldErrors((current) => ({
                    ...current,
                    [order.id]: nextFieldErrors,
                }));
                return;
            }
        }
        setSlipReviewFieldErrors((current) => ({
            ...current,
            [order.id]: {
                verified_amount: '',
                transaction_ref: '',
            },
        }));
        const payload = {
            action,
            user_id: currentUser?.id,
            verified_amount: draft.verified_amount,
            transaction_ref: draft.transaction_ref,
            review_note: isApprove ? '' : 'หลักฐานไม่ถูกต้อง',
        };

        try {
            setQuickReviewOrderAction(requestKey);
            if (onReviewOrderPayment) {
                await onReviewOrderPayment(order.id, payload);
            } else {
                await adminApi.reviewOrderPayment(order.id, payload);
            }
            if (selectedOrder?.id === order.id) {
                await refreshSelectedOrderDetails(order.id);
            }
            notify({
                type: 'success',
                title: isApprove ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธหลักฐานแล้ว',
                message: isApprove ? `ออเดอร์ #${order.id} พร้อมดำเนินการต่อ` : `ออเดอร์ #${order.id} สามารถรอส่งสลิปใหม่ได้`,
            });
        } catch (err) {
            notify({
                type: 'error',
                title: isApprove ? 'อนุมัติการชำระเงินไม่สำเร็จ' : 'ปฏิเสธหลักฐานไม่สำเร็จ',
                message: err.response?.data?.error || (isApprove ? 'ไม่สามารถอนุมัติการชำระเงินได้' : 'ไม่สามารถปฏิเสธหลักฐานได้'),
            });
        } finally {
            setQuickReviewOrderAction('');
        }
    };

    const bulkReviewSlipOrders = async () => {
        if (bulkSlipReviewSaving || quickReviewOrderAction || paymentReviewSaving) return;
        if (!reviewableSlipOrders.length) {
            notify({
                type: 'warning',
                title: 'ไม่มีสลิปให้เติมข้อมูล',
                message: 'ลองปรับตัวกรองหรือค้นหาดูอีกครั้ง',
            });
            return;
        }

        setBulkSlipReviewSaving(true);
        try {
            const successResults = [];
            const failureResults = [];

            for (const order of reviewableSlipOrders) {
                try {
                    const extractedText = await extractTextFromImage(resolveMediaUrl(order.receipt_image));
                    if (!extractedText) {
                        failureResults.push({
                            order_id: order.id,
                            order,
                            error: 'รูปนี้อาจไม่ชัดพอสำหรับการอ่านจำนวนเงินหรืออ้างอิง',
                        });
                        continue;
                    }

                    const reviewData = extractPaymentReviewData(extractedText);
                    const hasAmount = Boolean(reviewData.verified_amount);
                    const hasReference = Boolean(reviewData.transaction_ref);
                    if (!hasAmount && !hasReference) {
                        failureResults.push({
                            order_id: order.id,
                            order,
                            error: 'ตรวจสอบไม่พบข้อมูลที่ตรงกับฟอร์ม',
                        });
                        continue;
                    }

                    setSlipReviewDrafts((current) => {
                        const currentDraft = current[order.id] || { verified_amount: '', transaction_ref: '' };
                        return {
                            ...current,
                            [order.id]: {
                                verified_amount: currentDraft.verified_amount?.toString().trim()
                                    ? currentDraft.verified_amount
                                    : (reviewData.verified_amount || currentDraft.verified_amount || ''),
                                transaction_ref: currentDraft.transaction_ref?.toString().trim()
                                    ? currentDraft.transaction_ref
                                    : (reviewData.transaction_ref || currentDraft.transaction_ref || ''),
                            },
                        };
                    });

                    successResults.push({
                        order_id: order.id,
                        order,
                        reviewData,
                    });
                } catch (error) {
                    console.error(error);
                    failureResults.push({
                        order_id: order.id,
                        order,
                        error: 'ตรวจสอบข้อมูลจากภาพไม่สำเร็จ',
                    });
                }
            }

            const successCount = successResults.length;
            const failCount = failureResults.length;

            setBulkSlipReviewResult({
                successCount,
                failCount,
                successes: successResults,
                failures: failureResults,
            });

            if (failCount > 0) {
                notify({
                    type: 'warning',
                    title: 'เติมข้อมูลสลิปบางส่วน',
                    message: `เติมข้อมูลได้ ${successCount.toLocaleString('th-TH')} รายการ · ไม่สำเร็จ ${failCount.toLocaleString('th-TH')} รายการ`,
                });
            } else {
                notify({
                    type: 'success',
                    title: 'เติมข้อมูลสลิปทั้งหมดแล้ว',
                    message: `เติมยอดเงินและรหัสอ้างอิงสำเร็จ ${successCount.toLocaleString('th-TH')} รายการ`,
                });
            }
        } catch (err) {
            setBulkSlipReviewResult(null);
            notify({
                type: 'error',
                title: 'เติมข้อมูลสลิปแบบกลุ่มไม่สำเร็จ',
                message: err.response?.data?.error || 'ไม่สามารถเติมข้อมูลจากสลิปทั้งหมดได้',
            });
        } finally {
            setBulkSlipReviewSaving(false);
        }
    };

    const reviewPaymentEvidence = async (action, overrideReason = '') => {
        if (!selectedOrder || paymentReviewSaving || paymentReviewRequestRef.current) return;

        const currentPaymentStatus = formatPaymentStatus(orderDetails?.order?.payment_status || selectedOrder.payment_status);
        if (currentPaymentStatus !== 'รอตรวจสอบ') {
            setPaymentReviewError('คำสั่งซื้อนี้ตรวจสอบการชำระเงินแล้ว');
            return;
        }

        const needsReason = action === 'reject';
        const reasonValue = action === 'reject' ? String(overrideReason || paymentReviewForm.review_note || '').trim() : '';
        if (needsReason && !reasonValue) {
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
                review_note: reasonValue,
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
                message: action === 'approve' ? 'อัปเดตสถานะออเดอร์เรียบร้อย' : 'ผู้ใช้งานสามารถอัปโหลดสลิปใหม่ได้',
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
        setStatusFilter(DEFAULT_ORDER_STATUS_FILTER);
        setDeliveryFilter('ทั้งหมด');
        setOrderDatePreset('30');
        setOrderDateFrom('');
        setOrderDateTo('');
    };

    const exportOrders = (format, nextOrderView = orderViewTab, nextSlipPageTab = slipPageTab, customRange = null) => {
        const reportRange = customRange || orderRange;
        const sourceOrders = customRange ? getOrdersWithinRange(customRange) : undefined;
        const reportConfig = getOrderReportConfig(
            nextOrderView,
            getOrderRowsByView(nextOrderView, nextSlipPageTab, sourceOrders),
            reportRange,
            nextSlipPageTab,
        );
        const reportTitle = reportConfig.title;
        const reportSubtitle = reportConfig.subtitle;
        const headers = reportConfig.headers;
        const rows = reportConfig.rows;
        const fileName = reportConfig.fileName;
        if (format === 'pdf') {
            const popup = window.open('', '_blank', 'width=1200,height=760');
            if (!popup) return;
            popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${fileName}</title>
                <style>body{font-family:Arial,sans-serif;padding:24px;color:#17202e}h2{margin:0 0 4px}p{color:#667085}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border:1px solid #dfe4ea;text-align:left}th{background:#f2f4f7}@page{size:landscape;margin:10mm}</style>
                </head><body><h2>${reportTitle}</h2><p>${reportSubtitle}</p>
                <table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${renderReportCellHtml(item)}</td>`).join('')}</tr>`).join('')}</table>
                <script>window.onload=()=>window.print();</script></body></html>`);
            popup.document.close();
            return;
        }
        let blob;
        let extension;
        if (format === 'excel') {
            const html = `<html><head><meta charset="utf-8"></head><body><h2>${reportTitle}</h2><p>${reportSubtitle}</p><table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((item) => `<td>${renderReportCellHtml(item)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
            blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
            extension = 'xls';
        } else {
            blob = new Blob([
                '\ufeff',
                [
                    [reportTitle],
                    [reportSubtitle],
                    [],
                    headers,
                    ...rows.map((row) => row.map((item) => (item && typeof item === 'object' && item.text ? item.text : item))),
                ].map((row) => row.map(escapeCsv).join(',')).join('\r\n'),
            ], { type: 'text/csv;charset=utf-8' });
            extension = 'csv';
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportActivityReport = (activityView, customRange = null) => {
        const isStockView = activityView === 'stock';
        const bounds = customRange ? getRangeBounds(customRange) : null;
        const rows = (isStockView ? stockLogs : systemLogs)
            .filter((log) => (!bounds || isWithinBounds(log.created_at || log.log_date, bounds)))
            .map((log) => ({
            created_at: log.created_at || log.log_date,
            actor_name: log.actor_name || log.admin_name || log.full_name || log.username || 'ระบบ',
            product_name: log.product_name || '-',
            change_quantity: Number(log.change_quantity ?? log.amount ?? log.quantity ?? 0),
            reason: log.reason || log.remark || '-',
            action: log.action || '-',
            role: log.role || '-',
            username: log.username || '-',
        }));
        const title = isStockView ? 'รายงานประวัติสต็อก' : 'รายงานประวัติการเคลื่อนไหวแอดมิน';
        const subtitle = `${rows.length.toLocaleString('th-TH')} รายการ · ${new Date().toLocaleString('th-TH')}`;
        const headers = isStockView
            ? ['วันที่/เวลา', 'ผู้ใช้งาน', 'สินค้า', 'จำนวนที่เปลี่ยน', 'เหตุผล']
            : ['วันที่/เวลา', 'ผู้ใช้งาน', 'บัญชี', 'สิทธิ์', 'การทำงาน', 'หมายเหตุ'];
        const tableRows = isStockView
            ? rows.map((row) => [formatAuditDateTime(row.created_at), row.actor_name, row.product_name, row.change_quantity, row.reason])
            : rows.map((row) => [formatAuditDateTime(row.created_at), row.actor_name, row.username, row.role, row.action, row.reason]);
        const popup = window.open('', '_blank', 'width=1200,height=760');
        if (!popup) return;
        popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title>
            <style>body{font-family:Arial,sans-serif;padding:24px;color:#17202e}h2{margin:0 0 4px}p{color:#667085}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border:1px solid #dfe4ea;text-align:left}th{background:#f2f4f7}@page{size:landscape;margin:10mm}</style>
            </head><body><h2>${title}</h2><p>${subtitle}</p>
            <table><tr>${headers.map((item) => `<th>${item}</th>`).join('')}</tr>${tableRows.map((row) => `<tr>${row.map((item) => `<td>${renderReportCellHtml(item)}</td>`).join('')}</tr>`).join('')}</table>
            <script>window.onload=()=>window.print();</script></body></html>`);
        popup.document.close();
    };

    const printProductsReport = () => {
        const rows = products.map((product) => ({
            sku: product.sku || `PRD-${String(product.product_id || product.id || '').padStart(6, '0')}`,
            name: product.product_name || product.name || '-',
            category: product.category_name || 'ทั่วไป',
            stock: Number(product.quantity ?? product.stock ?? 0),
            price: Number(product.price || 0),
            status: Number(product.product_status ?? 1) === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน',
            updatedAt: formatReportDate(product.updated_at || product.created_at),
        }));

        if (!rows.length) {
            notify({ type: 'warning', title: 'ไม่มีข้อมูลสินค้า', message: 'ยังไม่มีสินค้าให้พิมพ์รายงาน' });
            return;
        }

        const popup = window.open('', '_blank', 'width=1100,height=820');
        if (!popup) {
            notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
            return;
        }

        const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
        const tableRows = rows.map((row) => `
            <tr>
                <td>${escapeHtml(row.sku)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${escapeHtml(row.stock)}</td>
                <td>${escapeHtml(formatMoney(row.price))}</td>
                <td>${escapeHtml(row.status)}</td>
                <td>${escapeHtml(row.updatedAt)}</td>
            </tr>
        `).join('');

        popup.document.write(`
            <!doctype html>
            <html lang="th">
                <head>
                    <meta charset="utf-8" />
                    <title>รายงานสินค้า</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                        h1 { margin: 0 0 8px; font-size: 24px; }
                        p { margin: 0 0 18px; color: #4b5563; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                        th { background: #f3f4f6; }
                        .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                        .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                        .primary { background: #111827; color: #fff; }
                        .secondary { background: #e5e7eb; color: #111827; }
                        @media print { .actions { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="actions">
                        <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                        <button class="secondary" onclick="window.close()">ปิด</button>
                    </div>
                    <h1>รายงานสินค้า</h1>
                    <p>จำนวน ${escapeHtml(rows.length)} รายการ • พิมพ์เมื่อ ${escapeHtml(printedAt)}</p>
                    <table>
                        <thead>
                            <tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สต็อก</th><th>ราคา</th><th>สถานะ</th><th>แก้ไขล่าสุด</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
    };

    const printCustomersReport = async () => {
        try {
            const limit = 100;
            let page = 1;
            let totalPages = 1;
            const customers = [];

            do {
                const res = await adminApi.getCustomers({ page, limit });
                customers.push(...(Array.isArray(res.data?.items) ? res.data.items : []));
                totalPages = Number(res.data?.pagination?.total_pages || 1);
                page += 1;
            } while (page <= totalPages);

            if (!customers.length) {
                notify({ type: 'warning', title: 'ไม่มีข้อมูลผู้ใช้งาน', message: 'ยังไม่มีผู้ใช้งานให้พิมพ์รายงาน' });
                return;
            }

            const popup = window.open('', '_blank', 'width=1200,height=820');
            if (!popup) {
                notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
                return;
            }

            const money = (value) => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
            const statusLabels = {
                0: 'ระงับการใช้งาน',
                1: 'ใช้งาน',
                2: 'รอการยืนยัน',
            };
            const printedAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
            const tableRows = customers.map((customer) => `
                <tr>
                    <td>${escapeHtml(customer.id)}</td>
                    <td>${escapeHtml(customer.full_name || customer.username || '-')}</td>
                    <td>${escapeHtml(customer.username || '-')}</td>
                    <td>${escapeHtml(customer.email || '-')}</td>
                    <td>${escapeHtml(customer.phone || '-')}</td>
                    <td>${escapeHtml(customer.role === 'admin' ? 'Admin' : 'User')}</td>
                    <td>${escapeHtml(statusLabels[Number(customer.status_user)] || '-')}</td>
                    <td>${escapeHtml(Number(customer.total_orders || 0))}</td>
                    <td>${escapeHtml(money(customer.total_spent))}</td>
                    <td>${escapeHtml(formatReportDate(customer.created_at))}</td>
                </tr>
            `).join('');

            popup.document.write(`
                <!doctype html>
                <html lang="th">
                    <head>
                        <meta charset="utf-8" />
                        <title>รายงานผู้ใช้งาน</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                            h1 { margin: 0 0 8px; font-size: 24px; }
                            p { margin: 0 0 18px; color: #4b5563; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                            th { background: #f3f4f6; }
                            .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                            .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                            .primary { background: #111827; color: #fff; }
                            .secondary { background: #e5e7eb; color: #111827; }
                            @media print { .actions { display: none; } body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        <div class="actions">
                            <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                            <button class="secondary" onclick="window.close()">ปิด</button>
                        </div>
                        <h1>รายงานผู้ใช้งาน</h1>
                        <p>จำนวน ${escapeHtml(customers.length)} รายการ • พิมพ์เมื่อ ${escapeHtml(printedAt)}</p>
                        <table>
                            <thead>
                                <tr><th>ID</th><th>ชื่อ</th><th>Username</th><th>อีเมล</th><th>เบอร์โทร</th><th>สิทธิ์</th><th>สถานะ</th><th>ออเดอร์</th><th>ยอดสะสม</th><th>วันที่สมัคร</th></tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </body>
                </html>
            `);
            popup.document.close();
        } catch (error) {
            notify({ type: 'error', title: 'พิมพ์รายงานผู้ใช้งานไม่สำเร็จ', message: error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด' });
        }
    };

    const printPaymentReceiveReport = (customRange = null) => {
        const bounds = customRange ? getRangeBounds(customRange) : null;
        const rows = orders
            .filter((order) => isPaidOrder(order))
            .filter((order) => {
                if (!bounds) return true;
                return isWithinBounds(getPaymentReceivedAt(order), bounds);
            })
            .sort((a, b) => new Date(getPaymentReceivedAt(b) || 0) - new Date(getPaymentReceivedAt(a) || 0))
            .map((order) => {
                const receivedAmount = getPaymentReceivedAmount(order);
                return {
                    id: order.id,
                    receivedAt: getPaymentReceivedAt(order),
                    customerName: order.full_name || order.receiver_name || order.username || 'ผู้ใช้งานทั่วไป',
                    paymentMethod: order.payment_method || order.payment_type || '-',
                    orderAmount: Number(order.final_price ?? order.total_price ?? 0) || 0,
                    receivedAmount,
                    paymentStatus: formatPaymentStatus(order.payment_status) || '-',
                    shippingMethod: order.shipping_method || '-',
                };
            });

        if (!rows.length) {
            notify({ type: 'warning', title: 'ไม่มีข้อมูลการรับเงิน', message: 'ไม่พบรายการรับเงินในช่วงวันที่ที่เลือก' });
            return;
        }

        const popup = window.open('', '_blank', 'width=1200,height=820');
        if (!popup) {
            notify({ type: 'warning', title: 'เปิดหน้าพิมพ์ไม่สำเร็จ', message: 'กรุณาอนุญาตป๊อปอัปสำหรับเบราว์เซอร์นี้' });
            return;
        }

        const totalReceived = rows.reduce((sum, row) => sum + row.receivedAmount, 0);
        const dateLabel = customRange
            ? `${customRange.from} ถึง ${customRange.to}`
            : `พิมพ์เมื่อ ${new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`;
        const tableRows = rows.map((row) => `
            <tr>
                <td>#${escapeHtml(row.id)}</td>
                <td>${escapeHtml(formatDateTime(row.receivedAt))}</td>
                <td>${escapeHtml(row.customerName)}</td>
                <td>${escapeHtml(row.paymentMethod)}</td>
                <td>${escapeHtml(row.shippingMethod)}</td>
                <td>${escapeHtml(`฿${formatMoney(row.orderAmount)}`)}</td>
                <td>${escapeHtml(`฿${formatMoney(row.receivedAmount)}`)}</td>
                <td>${escapeHtml(row.paymentStatus)}</td>
            </tr>
        `).join('');

        popup.document.write(`
            <!doctype html>
            <html lang="th">
                <head>
                    <meta charset="utf-8" />
                    <title>รายงานการรับเงิน</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
                        h1 { margin: 0 0 8px; font-size: 24px; }
                        p { margin: 0 0 18px; color: #4b5563; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; }
                        th { background: #f3f4f6; }
                        .actions { margin-bottom: 18px; display: flex; gap: 10px; }
                        .actions button { padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; }
                        .primary { background: #111827; color: #fff; }
                        .secondary { background: #e5e7eb; color: #111827; }
                        .summary { display: flex; gap: 18px; margin: 0 0 18px; flex-wrap: wrap; }
                        .summary strong { display: block; font-size: 18px; color: #111827; }
                        .summary span { color: #6b7280; font-size: 12px; }
                        @media print { .actions { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="actions">
                        <button class="primary" onclick="window.print()">สร้าง PDF / พิมพ์</button>
                        <button class="secondary" onclick="window.close()">ปิด</button>
                    </div>
                    <h1>รายงานการรับเงิน</h1>
                    <p>${escapeHtml(dateLabel)}</p>
                    <div class="summary">
                        <div><strong>${escapeHtml(rows.length.toLocaleString('th-TH'))}</strong><span>จำนวนรายการรับเงิน</span></div>
                        <div><strong>${escapeHtml(`฿${formatMoney(totalReceived)}`)}</strong><span>ยอดรับรวม</span></div>
                    </div>
                    <table>
                        <thead>
                            <tr><th>เลขออเดอร์</th><th>วันที่รับเงิน</th><th>ลูกค้า/ผู้รับ</th><th>ช่องทางชำระ</th><th>วิธีรับสินค้า</th><th>ยอดออเดอร์</th><th>ยอดรับชำระ</th><th>สถานะ</th></tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
    };
    const runQuickReportRequest = (request, customRange) => {
        if (!request) return;
        const { type } = request;
        if (type === 'orders') {
            exportOrders('pdf', 'orders', 'review', customRange);
            return;
        }
        if (type === 'slip-history') {
            exportOrders('pdf', 'slips', 'history', customRange);
            return;
        }
        if (type === 'print') {
            exportOrders('pdf', 'print', 'review', customRange);
            return;
        }
        if (type === 'payments') {
            printPaymentReceiveReport(customRange);
            return;
        }
        if (type === 'stock') {
            exportActivityReport('stock', customRange);
            return;
        }
        if (type === 'system') {
            exportActivityReport('system', customRange);
        }
    };
    const closeQuickReportDateModal = () => {
        setQuickReportRequest(null);
        setQuickReportError('');
    };
    const submitQuickReportDateModal = () => {
        const from = quickReportDateFrom.trim();
        const to = quickReportDateTo.trim();
        if (!quickReportRequest) return;
        if (!from || !to) {
            setQuickReportError('กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด');
            return;
        }
        if (from > to) {
            setQuickReportError('วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด');
            return;
        }
        const customRange = { from, to };
        closeQuickReportDateModal();
        runQuickReportRequest(quickReportRequest, customRange);
    };
    const handleQuickReportAction = (request) => {
        const preset = quickReportDatePreset;
        if (preset === 'custom') {
            const from = quickReportDateFrom.trim();
            const to = quickReportDateTo.trim();
            if (!from || !to) {
                setQuickReportError('กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด');
                return;
            }
            if (from > to) {
                setQuickReportError('วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด');
                return;
            }
            runQuickReportRequest(request, { from, to });
            return;
        }
        setQuickReportError('');
        runQuickReportRequest(request, getDateRange(preset, '', ''));
    };

    const runOrderStep = async (order, nextStatus) => {
        if (savingOrderId) return;
        const trackingNo = trackingInputs[order.id] || '';
        const paymentStatus = orderDetails?.order?.payment_status || order.payment_status;

        if (blockedFulfillmentStatuses.includes(nextStatus) && !isPaidOrder({ payment_status: paymentStatus })) {
            notify({ type: 'warning', title: 'ยังดำเนินการจัดส่งไม่ได้', message: 'ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง' });
            return;
        }

        if (!isPickupOrder(order) && nextStatus === 'เสร็จสิ้น' && !trackingNo.trim()) {
            setTrackingErrors((current) => ({
                ...current,
                [order.id]: 'กรุณากรอกเลขพัสดุก่อนปิดงานจัดส่ง',
            }));
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
    const detailPaymentStatus = formatPaymentStatus(detailOrder?.payment_status) || 'รอชำระ';
    const detailOrderIsPaid = isPaidOrder(detailOrder || selectedOrder || {});
    const paymentReviewDisabled = !detailOrder?.receipt_image || Boolean(paymentReviewSaving) || detailPaymentStatus !== 'รอตรวจสอบ';
    const paymentReviewReady = Boolean(String(paymentReviewForm.verified_amount || '').trim() && String(paymentReviewForm.transaction_ref || '').trim());
    const shouldWarnPaymentReview = detailOrder && !detailOrderIsPaid && ['ถูกปฏิเสธ', 'หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม', 'รอตรวจสอบ'].includes(detailPaymentStatus);

    return (
        <div className="commerce-dashboard">
            {showDashboard && (
                <>
            <section className="commerce-heading">
                <div>
                    <span>STORE PERFORMANCE</span>
                    <h1>ภาพรวมร้านค้า</h1>
                    <p>เปิดมาแล้วรู้ทันทีว่าอะไรต้องทำก่อน พร้อมดูยอดขาย ออเดอร์ และสต๊อกในหน้าเดียว</p>
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

            <section className="commerce-action-row">
                <button type="button" className="commerce-card commerce-action-card blue" onClick={() => setAdminPage?.('admin-orders')}>
                    <span>TO DO</span>
                    <strong>คำสั่งซื้อใหม่</strong>
                    <b>{newOrdersCount.toLocaleString('th-TH')}</b>
                    <small>รายการที่เข้ามาวันนี้</small>
                </button>
                <button type="button" className="commerce-card commerce-action-card purple" onClick={() => {
                    setAdminPage?.('admin-orders');
                    setOrderViewTab('slips');
                    setSlipPageTab('review');
                }}>
                    <span>PAYMENT CHECK</span>
                    <strong>รอตรวจสอบสลิป</strong>
                    <b>{pendingSlipReviewCount.toLocaleString('th-TH')}</b>
                    <small>ออเดอร์ที่ต้องตรวจหลักฐาน</small>
                </button>
                <button type="button" className="commerce-card commerce-action-card green" onClick={() => {
                    setAdminPage?.('admin-orders');
                    setOrderViewTab('print');
                }}>
                    <span>SHIPPING</span>
                    <strong>พิมพ์ใบจัดส่ง</strong>
                    <b>{readyToPrintCount.toLocaleString('th-TH')}</b>
                    <small>รายการที่พร้อมดำเนินการต่อ</small>
                </button>
            </section>

            <section className="commerce-sales-row">
                <div className="commerce-card commerce-chart-card">
                    <header className="commerce-card-header">
                        <div><span>SALES ANALYTICS</span><h2>ยอดขาย</h2></div>
                        <div className="commerce-chart-controls">
                            <div className="commerce-chart-tabs">
                                {[['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'ปี']].map(([value, label]) => (
                                    <button key={value} type="button" className={chartInterval === value ? 'active' : ''} onClick={() => setChartInterval(value)}>{label}</button>
                                ))}
                                <button
                                    type="button"
                                    className={showChartDatePicker ? 'active custom-trigger' : 'custom-trigger'}
                                    onClick={() => {
                                        setDatePreset('custom');
                                        setShowChartDatePicker((current) => !current);
                                    }}
                                >
                                    กำหนดวัน
                                </button>
                            </div>
                            {showChartDatePicker ? (
                                <div className="commerce-chart-date-picker">
                                    <span>กำหนดวัน</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(event) => {
                                            setDatePreset('custom');
                                            setDateFrom(event.target.value);
                                            if (!dateTo) setDateTo(event.target.value);
                                        }}
                                    />
                                    <small>ถึง</small>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(event) => {
                                            setDatePreset('custom');
                                            setDateTo(event.target.value);
                                            if (!dateFrom) setDateFrom(event.target.value);
                                        }}
                                    />
                                </div>
                            ) : null}
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

                <aside className="commerce-card commerce-sales-summary-card">
                    <header className="commerce-card-header">
                        <div><span>TOTAL SALES</span><h2>ยอดขาย</h2></div>
                    </header>
                    <div className="commerce-sales-summary">
                        <strong>฿{formatMoney(currentRevenue)}</strong>
                        <p>{selectedRange.from} ถึง {selectedRange.to}</p>
                        <div className="commerce-signal-chips">
                            <span className={`tone-${revenueChange.tone}`}>ยอดขาย {revenueChange.value}</span>
                            <span className={`tone-${orderChange.tone}`}>ออเดอร์ {orderChange.value}</span>
                        </div>
                    </div>
                    <div className="commerce-sales-summary-list">
                        {salesBreakdown.map((item) => (
                            <div key={item.label}>
                                <span>{item.label}</span>
                                <strong>฿{formatMoney(item.total)}</strong>
                            </div>
                        ))}
                    </div>
                </aside>
            </section>

            <section className="commerce-overview-grid">
                <aside className="commerce-card commerce-priority-card">
                    <header className="commerce-card-header">
                        <div><span>ATTENTION NEEDED</span><h2>งานด่วน</h2></div>
                        <b>{totalAttentionCount.toLocaleString('th-TH')}</b>
                    </header>
                    <div className="commerce-priority-list">
                        {attentionItems.map((item) => (
                            <button type="button" key={item.key} onClick={item.action}>
                                <i className={item.color} />
                                <span>{item.label}</span>
                                <strong>{item.total.toLocaleString('th-TH')}</strong>
                                <em>›</em>
                            </button>
                        ))}
                    </div>
                </aside>
                <section className="commerce-card commerce-task-inbox">
                    <header className="commerce-card-header">
                        <div><span>TASK INBOX</span><h2>งานที่ต้องทำตอนนี้</h2></div>
                        <button type="button" className="commerce-inline-link" onClick={() => setAdminPage?.('admin-orders')}>ดูออเดอร์ทั้งหมด</button>
                    </header>
                    <div className="commerce-task-grid">
                        {taskInboxItems.length ? taskInboxItems.map((item) => (
                            <article key={item.id} className={`commerce-task-card ${item.tone}`}>
                                <span>{item.eyebrow}</span>
                                <strong>{item.title}</strong>
                                <p>{item.detail}</p>
                                <footer>
                                    <small>{item.age}</small>
                                    <button type="button" onClick={item.onAction}>{item.actionLabel}</button>
                                </footer>
                            </article>
                        )) : (
                            <div className="commerce-task-empty">ยังไม่มีงานเร่งด่วนในตอนนี้</div>
                        )}
                    </div>
                </section>
            </section>

            <section className="commerce-card commerce-report-card">
                <header className="commerce-card-header">
                    <div><span>QUICK REPORTS</span><h2>พิมพ์รายงานด่วน</h2></div>
                    <div className="commerce-date-filter commerce-report-date-filter">
                        <select value={quickReportDatePreset} onChange={(event) => applyQuickReportDatePreset(event.target.value)}>
                            {DATE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                        {quickReportDatePreset === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    value={quickReportDateFrom}
                                    onChange={(event) => {
                                        setQuickReportDateFrom(event.target.value);
                                        setQuickReportError('');
                                    }}
                                />
                                <input
                                    type="date"
                                    value={quickReportDateTo}
                                    onChange={(event) => {
                                        setQuickReportDateTo(event.target.value);
                                        setQuickReportError('');
                                    }}
                                />
                            </>
                        )}
                    </div>
                </header>
                {quickReportError ? <div className="commerce-report-error">{quickReportError}</div> : null}
                <div className="commerce-report-actions">
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'orders', title: 'รายงานคำสั่งซื้อ' })}>
                        <strong>รายงานคำสั่งซื้อ</strong>
                    </button>
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'slip-history', title: 'รายงานประวัติการตรวจสลิป' })}>
                        <strong>รายงานประวัติการตรวจสลิป</strong>
                    </button>
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'print', title: 'รายงานพิมพ์ใบจัดส่ง' })}>
                        <strong>รายงานพิมพ์ใบจัดส่ง</strong>
                    </button>
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'payments', title: 'รายงานการรับเงิน' })}>
                        <strong>พิมพ์รายงานการรับเงิน</strong>
                    </button>
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'stock', title: 'รายงานประวัติสต็อก' })}>
                        <strong>รายงานประวัติสต็อก</strong>
                    </button>
                    <button type="button" onClick={() => handleQuickReportAction({ type: 'system', title: 'รายงานประวัติการเคลื่อนไหวแอดมิน' })}>
                        <strong>รายงานประวัติการเคลื่อนไหวแอดมิน</strong>
                    </button>
                    <button type="button" onClick={printProductsReport}>
                        <strong>พิมพ์รายการสินค้า</strong>
                    </button>
                    <button type="button" onClick={printCustomersReport}>
                        <strong>พิมพ์รายชื่อผู้ใช้งาน</strong>
                    </button>
                </div>
            </section>

            <section className="commerce-top-grid">
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>POPULAR PRODUCTS</span><h2>สินค้ายอดนิยม</h2></div></header>
                    {(dashboardData.top_products || []).length ? dashboardData.top_products.map((item, index) => (
                        <div className="commerce-rank-row" key={item.product_id}><b>{index + 1}</b><div><strong>{item.product_name}</strong><small>{Number(item.units_sold || 0).toLocaleString('th-TH')} ชิ้น</small></div><span>฿{formatMoney(item.revenue)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลสินค้า</p>}
                </div>
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>POPULAR CATEGORIES</span><h2>หมวดหมู่ยอดนิยม</h2></div></header>
                    {(dashboardData.top_categories || []).length ? dashboardData.top_categories.map((item, index) => (
                        <div className="commerce-rank-row" key={item.category_id}><b>{index + 1}</b><div><strong>{item.category_name}</strong><small>{Number(item.units_sold || 0).toLocaleString('th-TH')} ชิ้น</small></div><span>฿{formatMoney(item.revenue)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลหมวดหมู่</p>}
                </div>
                <div className="commerce-card commerce-ranking">
                    <header className="commerce-card-header"><div><span>TOP CUSTOMERS</span><h2>ผู้ใช้ที่ซื้อเยอะ</h2></div></header>
                    {(dashboardData.top_customers || []).length ? dashboardData.top_customers.map((item, index) => (
                        <div className="commerce-rank-row" key={item.user_id}><b>{index + 1}</b><div><strong>{item.full_name || item.username}</strong><small>{Number(item.order_count || 0).toLocaleString('th-TH')} ออเดอร์</small></div><span>฿{formatMoney(item.total_spent)}</span></div>
                    )) : <p className="commerce-mini-empty">ยังไม่มีข้อมูลผู้ใช้</p>}
                </div>
            </section>

            <section className="commerce-card commerce-quick-actions">
                <header className="commerce-card-header"><div><span>SHORTCUTS</span><h2>เมนูใช้งานด่วน</h2></div></header>
                <div>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'products')}><b className="blue">＋</b><span>เพิ่มสินค้า<small>สร้างสินค้าใหม่</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'categories')}><b className="purple">▦</b><span>เพิ่มหมวดหมู่<small>จัดระเบียบสินค้า</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('store')}><b className="green">▣</b><span>สร้างออเดอร์<small>ไปยังหน้าร้าน</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('customers')}><b className="amber">♙</b><span>จัดการผู้ใช้งาน<small>ดูข้อมูลผู้ใช้งาน</small></span></button>
                    <button type="button" onClick={() => navigateQuickAction('add-product', 'products')}><b className="red">▤</b><span>จัดการสต๊อก<small>ตรวจจำนวนคงเหลือ</small></span></button>
                </div>
            </section>
                </>
            )}

            {showOrderManagement && (
                <>
            <section ref={orderManagementRef} className="order-management">
                <header className="order-management-heading">
                    <div>
                        <span>REPORT PRINT</span>
                        <h2>{orderReportConfig.title}</h2>
                        <p>
                            {orderViewTab === 'orders' && 'ดูข้อมูลออเดอร์ทั้งหมด เลือกช่วงที่ต้องการ แล้วส่งออกเป็น CSV, Excel หรือ PDF'}
                            {orderViewTab === 'slips' && (slipPageTab === 'history' ? 'ดูรายการที่ตรวจแล้วทั้งหมด เพื่อย้อนดูผลการอนุมัติและส่งออกเป็นรายงานประวัติ' : 'ดูเฉพาะออเดอร์ที่แนบสลิป เพื่อส่งออกเป็นรายงานตรวจสลิป')}
                            {orderViewTab === 'print' && 'ดูเฉพาะออเดอร์ที่พร้อมจัดส่ง เพื่อส่งออกเป็นรายงานใบจัดส่ง'}
                        </p>
                    </div>
                    <div className="order-export">
                        <button type="button" onClick={() => exportOrders('csv')}>CSV</button>
                        <button type="button" onClick={() => exportOrders('excel')}>Excel</button>
                        <button type="button" className="primary" onClick={() => exportOrders('pdf')}>PDF</button>
                    </div>
                </header>

                <div className="admin-tabs-bar order-view-tabs" role="tablist" aria-label="เมนูหน้าจัดออเดอร์">
                    <button type="button" className={orderViewTab === 'orders' ? 'active' : ''} onClick={() => setOrderViewTab('orders')}>หน้าออเดอร์หลัก</button>
                    <button type="button" className={orderViewTab === 'slips' ? 'active' : ''} onClick={() => setOrderViewTab('slips')}>หน้าตรวจสลิป</button>
                    <button type="button" className={orderViewTab === 'print' ? 'active' : ''} onClick={() => setOrderViewTab('print')}>หน้าพิมพ์ใบจัดส่ง</button>
                </div>

                {orderViewTab === 'slips' && (
                    <div className="admin-tabs-bar slip-review-tabs" role="tablist" aria-label="เมนูหน้าตรวจสลิป">
                        <button type="button" className={slipPageTab === 'review' ? 'active' : ''} onClick={() => setSlipPageTab('review')}>หน้าอนุมัติ</button>
                        <button type="button" className={slipPageTab === 'history' ? 'active' : ''} onClick={() => setSlipPageTab('history')}>หน้าประวัติอนุมัติ</button>
                    </div>
                )}

                {orderViewTab === 'slips' && slipPageTab === 'review' && pendingSlipReviewCount > 0 && (
                    <div className="payment-review-admin-alert">
                        <strong>มีหลักฐานการชำระเงินใหม่รอตรวจสอบ {pendingSlipReviewCount.toLocaleString('th-TH')} รายการ</strong>
                    </div>
                )}

                <div className="order-view-banner">
                    {orderViewTab === 'orders' && (
                        <>
                            <strong>หน้าออเดอร์หลัก</strong>
                            <span>แสดงคำสั่งซื้อทั้งหมดตามตัวกรองปัจจุบัน เพื่อเช็กสถานะและเปิดรายละเอียดออเดอร์ได้จากหน้าหลักเดียว</span>
                        </>
                    )}
                    {orderViewTab === 'slips' && (
                        <>
                            <strong>{slipPageTab === 'history' ? 'หน้าประวัติอนุมัติ' : 'หน้าตรวจสลิป'}</strong>
                            <span>
                                {slipPageTab === 'history'
                                    ? 'แสดงรายการที่ตรวจสอบแล้วทั้งหมด เพื่อย้อนดูผลการอนุมัติ หมายเหตุ และวันที่ตรวจ'
                                    : 'แสดงเฉพาะออเดอร์ที่มีการแนบสลิป เพื่อให้ตรวจสอบหลักฐานการชำระเงินได้เร็วขึ้น'}
                            </span>
                        </>
                    )}
                    {orderViewTab === 'print' && (
                        <>
                            <strong>หน้าพิมพ์ใบจัดส่ง</strong>
                            <span>แสดงเฉพาะออเดอร์ที่ชำระแล้ว เพื่อเลือกพิมพ์ใบจัดส่งได้ทั้งแบบรายออเดอร์และแบบรวมหลายใบ</span>
                        </>
                    )}
                </div>

                <div className="order-filter-panel">
                    <label className="order-search">
                        <span>⌕</span>
                        <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="ค้นหาเลขออเดอร์ ชื่อผู้ใช้งาน หรือเลขพัสดุ..." />
                    </label>
                    {orderViewTab === 'slips' ? (
                        <div className="order-filter-locked" aria-live="polite">
                            <span>สถานะสลิป</span>
                            <strong>{slipPageTab === 'history' ? 'รายการที่ตรวจแล้วเท่านั้น' : 'รอตรวจสอบสลิปเท่านั้น'}</strong>
                        </div>
                    ) : orderViewTab === 'print' ? (
                        <div className="order-filter-locked" aria-live="polite">
                            <span>สถานะออเดอร์</span>
                            <strong>เตรียมสินค้าเท่านั้น</strong>
                        </div>
                    ) : (
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            {orderStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                        </select>
                    )}
                    <select value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)}>
                        {orderViewTab === 'print' ? (
                            <>
                                <option value="ทั้งหมด">วิธีรับสินค้าทั้งหมด</option>
                                <option value="ส่งสินค้า">จัดส่งตามที่อยู่</option>
                                <option value="รับหน้าร้าน">ผู้ใช้งานสั่งรับหน้าร้าน</option>
                            </>
                        ) : (
                            <>
                                <option value="ทั้งหมด">วิธีรับสินค้าทั้งหมด</option>
                                <option value="ส่งสินค้า">จัดส่งตามที่อยู่</option>
                                <option value="รับหน้าร้าน">ผู้ใช้งานสั่งรับหน้าร้าน</option>
                                <option value="ขายหน้าร้าน">แอดมินขายหน้าร้าน</option>
                            </>
                        )}
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

                {orderViewTab === 'slips' && slipPageTab === 'review' && (
                    <div className="order-print-bulk-bar order-slip-bulk-bar">
                        <div>
                            <strong>เติมข้อมูลสลิปทีเดียวทั้งหมด</strong>
                            <span>อ่านยอดเงินและรหัสอ้างอิงจากสลิปที่รอตรวจสอบในผลการกรองปัจจุบันทั้งหมด {reviewableSlipOrders.length.toLocaleString('th-TH')} รายการ แล้วค่อยอนุมัติหรือปฏิเสธเอง</span>
                        </div>
                        <button
                            type="button"
                            onClick={bulkReviewSlipOrders}
                            disabled={reviewableSlipOrders.length === 0 || bulkSlipReviewSaving || Boolean(quickReviewOrderAction) || Boolean(paymentReviewSaving)}
                        >
                            {bulkSlipReviewSaving ? 'กำลังเติมข้อมูล...' : `เติมข้อมูลทั้งหมด (${reviewableSlipOrders.length.toLocaleString('th-TH')})`}
                        </button>
                    </div>
                )}

                {orderViewTab === 'slips' && slipPageTab === 'review' && bulkSlipReviewResult && (
                    <div className="bulk-slip-review-result">
                        {bulkSlipReviewResult.successes.length > 0 && (
                            <section className="bulk-slip-review-group success">
                                <header>
                                    <strong>เติมข้อมูลแล้ว</strong>
                                    <span>{bulkSlipReviewResult.successCount.toLocaleString('th-TH')} รายการ</span>
                                </header>
                                <ul>
                                    {bulkSlipReviewResult.successes.map((item) => {
                                        const order = item.order || {};
                                        return (
                                            <li key={`bulk-success-${item.order_id}`}>
                                                <span>#{item.order_id}</span>
                                                <small>{order.username || order.full_name || 'ผู้ใช้งานทั่วไป'}</small>
                                                {Boolean([item.reviewData?.verified_amount, item.reviewData?.transaction_ref].filter(Boolean).length) && (
                                                    <small>
                                                        {[
                                                            item.reviewData?.verified_amount ? `ยอดเงิน: ${item.reviewData.verified_amount}` : null,
                                                            item.reviewData?.transaction_ref ? `รหัสอ้างอิง: ${item.reviewData.transaction_ref}` : null,
                                                        ].filter(Boolean).join(' · ')}
                                                    </small>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}
                        {bulkSlipReviewResult.failures.length > 0 && (
                            <section className="bulk-slip-review-group fail">
                                <header>
                                    <strong>เติมไม่ได้</strong>
                                    <span>{bulkSlipReviewResult.failCount.toLocaleString('th-TH')} รายการ</span>
                                </header>
                                <ul>
                                    {bulkSlipReviewResult.failures.map((item) => {
                                        const order = item.order || {};
                                        return (
                                            <li key={`bulk-fail-${item.order_id}`}>
                                                <span>#{item.order_id}</span>
                                                <small>{order.username || order.full_name || 'ผู้ใช้งานทั่วไป'}</small>
                                                {item.error && <em>{item.error}</em>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}
                    </div>
                )}

                {orderViewTab === 'print' && (
                <div className="order-print-bulk-bar">
                    <div>
                        <strong>พิมพ์ใบจัดส่งพร้อมกัน</strong>
                        <span>เลือกได้เฉพาะออเดอร์ที่ชำระแล้ว ระบบจะเปิดหน้า PDF/Print รวมเป็นชุดเดียว</span>
                    </div>
                    <button type="button" onClick={openSelectedPrintPage} disabled={selectedPrintOrderIds.length === 0}>
                        สร้าง PDF / พิมพ์ {selectedPrintOrderIds.length > 0 ? `(${selectedPrintOrderIds.length})` : ''}
                    </button>
                </div>
                )}

                <div className="order-table-wrap">
                    {orderViewTab === 'slips' ? (
                        slipPageTab === 'review' ? (
                            <table className="order-table slip-review-table">
                                <thead>
                                    <tr>
                                        <th><button type="button" onClick={() => changeOrderSort('id')}>ออเดอร์{orderSortMarker('id')}</button></th>
                                        <th><button type="button" onClick={() => changeOrderSort('date')}>วันที่ส่งสลิป{orderSortMarker('date')}</button></th>
                                        <th>ชื่อผู้ใช้</th>
                                        <th className="text-end">ยอดเงิน</th>
                                        <th>สลิป</th>
                                        <th>ยอดที่พบ</th>
                                        <th>เลขอ้างอิง</th>
                                        <th>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersLoading ? [...Array(6)].map((_, index) => (
                                        <tr key={`slip-skeleton-${index}`} className="order-skeleton"><td colSpan="8"><i /></td></tr>
                                    )) : visibleOrders.length ? visibleOrders.map((order) => {
                                        const draft = slipReviewDrafts[order.id] || { verified_amount: '', transaction_ref: '' };
                                        const fieldErrors = slipReviewFieldErrors[order.id] || {};
                                        const paymentStatus = formatPaymentStatus(order.payment_status) || '';
                                        const isPendingReview = paymentStatus === 'รอตรวจสอบ';
                                        return (
                                            <tr
                                                key={`slip-${order.id}`}
                                                onClick={orderViewTab === 'slips' ? undefined : () => loadOrderDetails(order)}
                                            >
                                                <td data-label="ออเดอร์"><strong className="order-number">#{order.id}</strong></td>
                                                <td data-label="วันที่ส่งสลิป"><span className="order-date">{order.payment_date ? new Date(order.payment_date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span></td>
                                            <td data-label="ผู้ใช้งาน"><strong>{order.username || order.full_name || 'ผู้ใช้งานทั่วไป'}</strong><small>{order.full_name && order.username ? order.full_name : ''}</small></td>
                                                <td data-label="ยอดเงิน" className="order-total">฿{formatMoney(order.final_price ?? order.total_price)}</td>
                                                <td data-label="สลิป">
                                                    <button type="button" className="slip-review-thumb" onClick={(event) => openReceiptLightbox(order, event)} aria-label={`ดูสลิปออเดอร์ #${order.id}`}>
                                                        <img src={resolveMediaUrl(order.receipt_image)} alt={`สลิปออเดอร์ ${order.id}`} />
                                                        <span>กดขยาย</span>
                                                    </button>
                                                </td>
                                                <td data-label="ยอดที่พบ">
                                                    <input
                                                        className="slip-review-input"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={draft.verified_amount}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => updateSlipReviewDraft(order.id, 'verified_amount', event.target.value)}
                                                        placeholder="0.00"
                                                        disabled={!isPendingReview || Boolean(quickReviewOrderAction) || bulkSlipReviewSaving}
                                                        aria-invalid={Boolean(fieldErrors.verified_amount)}
                                                    />
                                                    {fieldErrors.verified_amount && <small className="slip-review-field-error">{fieldErrors.verified_amount}</small>}
                                                </td>
                                                <td data-label="เลขอ้างอิง">
                                                    <input
                                                        className="slip-review-input"
                                                        value={draft.transaction_ref}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onChange={(event) => updateSlipReviewDraft(order.id, 'transaction_ref', event.target.value)}
                                                        placeholder="เช่น Ref / Transaction ID"
                                                        disabled={!isPendingReview || Boolean(quickReviewOrderAction) || bulkSlipReviewSaving}
                                                        aria-invalid={Boolean(fieldErrors.transaction_ref)}
                                                    />
                                                    {fieldErrors.transaction_ref && <small className="slip-review-field-error">{fieldErrors.transaction_ref}</small>}
                                                </td>
                                                <td data-label="จัดการ">
                                                    <div className="slip-review-actions">
                                                        <button
                                                            type="button"
                                                            className="order-table-slip-check"
                                                            onClick={(event) => reviewSlipRowEvidence(order, event)}
                                                            disabled={tableReceiptOcrOrderId === order.id || !order.receipt_image || Boolean(quickReviewOrderAction) || bulkSlipReviewSaving}
                                                        >
                                                            {tableReceiptOcrOrderId === order.id ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="order-table-slip-approve"
                                                            onClick={(event) => submitSlipReviewRow(order, 'approve', event)}
                                                            disabled={!isPendingReview || quickReviewOrderAction === `${order.id}:approve` || Boolean(quickReviewOrderAction) || bulkSlipReviewSaving}
                                                        >
                                                            {quickReviewOrderAction === `${order.id}:approve` ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="order-table-slip-reject"
                                                            onClick={(event) => openTableRejectDialog(order, event)}
                                                            disabled={!isPendingReview || quickReviewOrderAction === `${order.id}:reject` || Boolean(quickReviewOrderAction) || bulkSlipReviewSaving}
                                                        >
                                                            {quickReviewOrderAction === `${order.id}:reject` ? 'กำลังปฏิเสธ...' : 'ปฏิเสธ'}
                                                        </button>
                                                    </div>
                                                    {tableReceiptOcrError && tableReceiptOcrErrorOrderId === order.id && <small className="slip-review-error">{tableReceiptOcrError}</small>}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan="8"><div className="order-empty"><b>⌕</b><strong>ไม่พบออเดอร์ที่มีสลิป</strong><span>ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่ เพื่อดูออเดอร์ที่แนบสลิป</span><button type="button" onClick={clearOrderFilters}>ล้างตัวกรองทั้งหมด</button></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="order-table slip-history-table">
                                <thead>
                                    <tr>
                                        <th><button type="button" onClick={() => changeOrderSort('id')}>ออเดอร์{orderSortMarker('id')}</button></th>
                                        <th>วันที่ตรวจ</th>
                                        <th>ผู้ใช้งาน</th>
                                        <th>รูปสลิป</th>
                                        <th className="text-end">ยอดที่ตรวจพบ</th>
                                        <th>เลขอ้างอิง</th>
                                        <th>ผู้ตรวจสอบ</th>
                                        <th>ผลการตรวจ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersLoading ? [...Array(6)].map((_, index) => (
                                        <tr key={`slip-history-skeleton-${index}`} className="order-skeleton"><td colSpan="8"><i /></td></tr>
                                    )) : visibleOrders.length ? visibleOrders.map((order) => {
                                        const approved = ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status);
                                        return (
                                            <tr key={`slip-history-${order.id}`} onClick={() => loadOrderDetails(order)}>
                                                <td data-label="ออเดอร์"><strong className="order-number">#{order.id}</strong></td>
                                                <td data-label="วันที่ตรวจ"><span className="order-date">{order.reviewed_at ? new Date(order.reviewed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : (order.payment_date ? new Date(order.payment_date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-')}</span></td>
                                                <td data-label="ผู้ใช้งาน"><strong>{order.username || order.full_name || 'ผู้ใช้งานทั่วไป'}</strong><small>{order.full_name && order.username ? order.full_name : ''}</small></td>
                                                <td data-label="รูปสลิป">
                                                    <button type="button" className="slip-review-thumb" onClick={(event) => openReceiptLightbox(order, event)} aria-label={`ดูสลิปออเดอร์ #${order.id}`}>
                                                        <img src={resolveMediaUrl(order.receipt_image)} alt={`สลิปออเดอร์ ${order.id}`} />
                                                        <span>กดขยาย</span>
                                                    </button>
                                                </td>
                                                <td data-label="ยอดที่ตรวจพบ" className="order-total">฿{order.verified_amount !== undefined && order.verified_amount !== null && String(order.verified_amount).trim() !== '' ? formatMoney(order.verified_amount) : (order.payment_amount !== undefined && order.payment_amount !== null && String(order.payment_amount).trim() !== '' ? formatMoney(order.payment_amount) : '-')}</td>
                                                <td data-label="เลขอ้างอิง"><span className="order-address-tracking">{order.transaction_ref || '-'}</span></td>
                                                <td data-label="ผู้ตรวจสอบ"><strong>{order.reviewer_full_name || order.reviewer_username || (order.reviewed_at ? 'แอดมิน' : '-')}</strong></td>
                                                <td data-label="ผลการตรวจ">
                                                    <span className={`payment-badge ${approved ? 'paid' : 'rejected'}`}>
                                                        {approved ? 'อนุมัติแล้ว' : (formatPaymentStatus(order.payment_status) || 'ปฏิเสธแล้ว')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan="8"><div className="order-empty"><b>⌕</b><strong>ไม่พบประวัติอนุมัติ</strong><span>ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่ เพื่อดูรายการที่ตรวจแล้ว</span><button type="button" onClick={clearOrderFilters}>ล้างตัวกรองทั้งหมด</button></div></td></tr>
                                    )}
                                </tbody>
                            </table>
                        )
                    ) : (
                        <table className="order-table">
                            <thead>
                                <tr>
                                    {showPrintSelectionColumn && (
                                        <th className="order-select-col">
                                            <input
                                                type="checkbox"
                                                checked={allVisiblePaidSelected}
                                                disabled={visiblePaidOrderIds.length === 0}
                                                onChange={toggleVisiblePaidOrders}
                                                aria-label="เลือกออเดอร์ที่ชำระแล้วในหน้านี้"
                                            />
                                        </th>
                                    )}
                                    <th><button type="button" onClick={() => changeOrderSort('id')}>เลขออเดอร์{orderSortMarker('id')}</button></th>
                                    <th><button type="button" onClick={() => changeOrderSort('date')}>วันที่สั่งซื้อ{orderSortMarker('date')}</button></th>
                                    <th>ลูกค้า</th>
                                    <th>สลิปการชำระเงิน</th>
                                    <th>วิธีรับสินค้า</th>
                                    <th>เลขพัสดุ</th>
                                    <th><button type="button" onClick={() => changeOrderSort('amount')}>ยอดสุทธิ{orderSortMarker('amount')}</button></th>
                                    <th><button type="button" onClick={() => changeOrderSort('status')}>สถานะออเดอร์{orderSortMarker('status')}</button></th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordersLoading ? [...Array(6)].map((_, index) => (
                                    <tr key={`order-skeleton-${index}`} className="order-skeleton"><td colSpan={showPrintSelectionColumn ? '10' : '9'}><i /></td></tr>
                                )) : visibleOrders.length ? visibleOrders.map((order) => {
                                    const orderIsPaid = isPaidOrder(order);
                                    const trackingSummary = formatOrderTrackingSummary(order);
                                    const orderIdText = String(order.id);
                                    return (
                                        <tr key={order.id} onClick={() => loadOrderDetails(order)}>
                                            {showPrintSelectionColumn && (
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
                                            )}
                                            <td data-label="เลขออเดอร์"><strong className="order-number">#{order.id}</strong></td>
                                            <td data-label="วันที่สั่งซื้อ"><span className="order-date">{new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span></td>
                                            <td data-label="ลูกค้า"><strong>{order.username || order.full_name || 'ผู้ใช้งานทั่วไป'}</strong><small>{order.full_name && order.username ? order.full_name : ''}</small></td>
                                            <td data-label="สลิปการชำระเงิน">
                                                {order.receipt_image ? (
                                                    <button type="button" className="slip-review-thumb" onClick={(event) => openReceiptLightbox(order, event)} aria-label={`ดูสลิปออเดอร์ #${order.id}`}>
                                                        <img src={resolveMediaUrl(order.receipt_image)} alt={`สลิปออเดอร์ ${order.id}`} />
                                                        <span>กดขยาย</span>
                                                    </button>
                                                ) : (
                                                    <div className="order-no-receipt">ยังไม่มีสลิป</div>
                                                )}
                                            </td>
                                            <td data-label="วิธีรับสินค้า"><span className="delivery-badge">{order.shipping_method || '-'}</span></td>
                                            <td data-label="เลขพัสดุ">
                                                <div className="order-address-tracking">
                                                    <span>{trackingSummary}</span>
                                                </div>
                                            </td>
                                            <td data-label="ยอดสุทธิ" className="order-total">฿{formatMoney(order.final_price ?? order.total_price)}</td>
                                            <td data-label="สถานะออเดอร์"><span className="admin-status">{order.status || 'รอจัดการ'}</span></td>
                                            <td data-label="จัดการ">
                                                <div className="order-row-actions">
                                                    {orderViewTab === 'print' && (
                                                        <button type="button" className="order-print-trigger" onClick={(event) => { event.stopPropagation(); openSinglePrintPage(order); }} disabled={!orderIsPaid}>
                                                            พิมพ์
                                                        </button>
                                                    )}
                                                    <button type="button" className="order-detail-trigger" onClick={(event) => { event.stopPropagation(); loadOrderDetails(order); }}>ดูรายละเอียด</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan={showPrintSelectionColumn ? '10' : '9'}><div className="order-empty"><b>⌕</b><strong>{orderViewTab === 'print' ? 'ไม่พบออเดอร์ที่พร้อมพิมพ์ใบจัดส่ง' : 'ไม่พบออเดอร์'}</strong><span>{orderViewTab === 'print' ? 'ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่ เพื่อดูออเดอร์ที่ชำระแล้ว' : 'ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่'}</span><button type="button" onClick={clearOrderFilters}>ล้างตัวกรองทั้งหมด</button></div></td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <footer className="order-pagination">
                    <label>แสดง
                        <select value={orderPageSize} onChange={(event) => setOrderPageSize(Number(event.target.value))}>
                            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                        รายการ
                    </label>
                    <span>{activeOrderRows.length ? ((orderPage - 1) * orderPageSize) + 1 : 0}–{Math.min(orderPage * orderPageSize, activeOrderRows.length)} จาก {activeOrderRows.length.toLocaleString('th-TH')} ออเดอร์</span>
                    <div>
                        <button type="button" disabled={orderPage === 1} onClick={() => setOrderPage(1)}>«</button>
                        <button type="button" disabled={orderPage === 1} onClick={() => setOrderPage((page) => page - 1)}>‹</button>
                        <b>{orderPage} / {orderTotalPages}</b>
                        <button type="button" disabled={orderPage === orderTotalPages} onClick={() => setOrderPage((page) => page + 1)}>›</button>
                        <button type="button" disabled={orderPage === orderTotalPages} onClick={() => setOrderPage(orderTotalPages)}>»</button>
                    </div>
                </footer>
            </section>

            {quickReportRequest && typeof document !== 'undefined' && createPortal(
                <div className="reject-review-backdrop" role="presentation" onMouseDown={closeQuickReportDateModal}>
                    <section
                        className="reject-review-dialog quick-report-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quick-report-dialog-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>QUICK REPORT</span>
                                <h2 id="quick-report-dialog-title">{quickReportRequest.title}</h2>
                            </div>
                            <button type="button" aria-label="ปิด" onClick={closeQuickReportDateModal}>×</button>
                        </header>
                        <div className="reject-review-body quick-report-body">
                            <div className="commerce-chart-tabs quick-report-tabs">
                                {[['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'ปี'], ['custom', 'กำหนดวัน']].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={quickReportPreset === value ? 'active' : ''}
                                        onClick={() => applyQuickReportPreset(value)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="quick-report-date-grid">
                                <label>
                                    <span>วันที่เริ่ม</span>
                                    <input
                                        type="date"
                                        value={quickReportDateFrom}
                                        disabled={quickReportPreset !== 'custom'}
                                        onChange={(event) => {
                                            setQuickReportPreset('custom');
                                            setQuickReportDateFrom(event.target.value);
                                        }}
                                    />
                                </label>
                                <label>
                                    <span>วันที่สิ้นสุด</span>
                                    <input
                                        type="date"
                                        value={quickReportDateTo}
                                        disabled={quickReportPreset !== 'custom'}
                                        onChange={(event) => {
                                            setQuickReportPreset('custom');
                                            setQuickReportDateTo(event.target.value);
                                        }}
                                    />
                                </label>
                            </div>
                            {quickReportError && <div className="reject-review-error">{quickReportError}</div>}
                        </div>
                        <div className="reject-review-actions">
                            <button type="button" className="secondary" onClick={closeQuickReportDateModal}>ยกเลิก</button>
                            <button type="button" className="danger" onClick={submitQuickReportDateModal}>พิมพ์รายงาน</button>
                        </div>
                    </section>
                </div>,
                document.body,
            )}

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
                                    <div><span>ผู้ใช้งาน</span><strong>{detailOrder.full_name || detailOrder.username || 'ผู้ใช้งานทั่วไป'}</strong><small>{detailOrder.email || '-'} · {detailOrder.customer_phone || '-'}</small></div>
                                    <div><span>วิธีชำระเงิน</span><strong>{detailOrder.payment_method || '-'}</strong><small>{detailOrder.payment_date ? `ส่งสลิป ${new Date(detailOrder.payment_date).toLocaleString('th-TH')}` : 'ยังไม่มีสลิป'}</small></div>
                                    <div><span>ยอดสุทธิ</span><strong>฿{formatMoney(detailOrder.final_price)}</strong><small>สินค้า ฿{formatMoney(detailOrder.total_price)} · ค่าส่ง ฿{formatMoney(detailOrder.shipping_fee)}</small></div>
                                    <div><span>สถานะออเดอร์</span><strong>{detailOrder.status || '-'}</strong><small>{isPickupOrder(detailOrder || selectedOrder) ? 'เลขพัสดุ N/A' : (detailOrder.tracking_no || 'ยังไม่มีเลขพัสดุ')}</small></div>
                                </section>

                                <div className="order-modal-grid">
                                    <section className="order-detail-card">
                                        <h3>สินค้าในออเดอร์</h3>
                                        <div className="order-items">
                                            {detailItems.length ? detailItems.map((item) => (
                                                <article key={item.order_detail_id}>
                                                    {item.product_image ? <img src={item.product_image} alt={item.product_name || 'สินค้า'} /> : <b>◇</b>}
                                                    <div><strong>{item.product_name || `สินค้า #${item.product_id}`}</strong></div>
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
                                                    onClick={(event) => openReceiptLightbox({
                                                    id: selectedOrder.id,
                                                    receipt_image: detailOrder.receipt_image,
                                                }, event)}
                                                >
                                                <img src={resolveMediaUrl(detailOrder.receipt_image)} alt={`สลิปออเดอร์ ${selectedOrder.id}`} />
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
                                                <label>ยอดที่ตรวจพบ<input type="number" min="0" step="0.01" value={paymentReviewForm.verified_amount} onChange={(event) => updatePaymentReviewForm('verified_amount', event.target.value)} placeholder="0.00" disabled={paymentReviewDisabled} /></label>
                                                <label>เลขอ้างอิงรายการ<input value={paymentReviewForm.transaction_ref} onChange={(event) => updatePaymentReviewForm('transaction_ref', event.target.value)} placeholder="เช่น Ref / Transaction ID" disabled={paymentReviewDisabled} /></label>
                                                <div><span>ผู้ตรวจสอบ</span><strong>{detailOrder.reviewer_full_name || detailOrder.reviewer_username || '-'}</strong></div>
                                                <div><span>เวลาตรวจสอบ</span><strong>{detailOrder.reviewed_at ? new Date(detailOrder.reviewed_at).toLocaleString('th-TH') : '-'}</strong></div>
                                            </div>
                                            {paymentReviewError && <div className="payment-review-error">{paymentReviewError}</div>}
                                            <div className="payment-review-actions">
                                                <button type="button" className="approve" disabled={paymentReviewDisabled || !paymentReviewReady} onClick={() => reviewPaymentEvidence('approve')}>{paymentReviewSaving === 'approve' ? 'กำลังบันทึก...' : 'อนุมัติการชำระเงิน'}</button>
                                                <button type="button" className="reject" disabled={paymentReviewDisabled} onClick={openRejectReviewDialog}>{paymentReviewSaving === 'reject' ? 'กำลังบันทึก...' : 'ปฏิเสธหลักฐาน'}</button>
                                            </div>
                                            {!paymentReviewReady && (
                                                <small className="payment-review-hint">อนุมัติได้เมื่อกรอกยอดที่ตรวจพบและเลขอ้างอิงเรียบร้อย</small>
                                            )}
                                        </div>
                                    </section>
                                    <section className="order-detail-card">
                                        <h3>ประวัติสถานะ</h3>
                                        <div className="order-timeline">
                                            {detailHistory.length ? detailHistory.map((item) => <div key={item.history_id}><i /><div><strong>{item.status}</strong><span>{new Date(item.created_at).toLocaleString('th-TH')}</span><small>{item.note || '-'}{item.full_name || item.username ? ` · โดย ${item.full_name || item.username}` : ''}</small></div></div>) : <div className="order-empty-inline">ยังไม่มีประวัติสถานะ</div>}
                                        </div>
                                    </section>
                                </div>

                                <section className="order-modal-actions">
                                    {!isPickupOrder(selectedOrder) && ['เตรียมสินค้า', 'กำลังจัดส่ง', 'จัดส่งแล้ว'].includes(selectedOrder.status) && (
                                        <label>เลขพัสดุ<input value={trackingInputs[selectedOrder.id] || ''} onChange={(event) => updateTrackingInput(selectedOrder.id, event.target.value)} placeholder="กรอกเลขพัสดุ" />{trackingErrors[selectedOrder.id] && <small>{trackingErrors[selectedOrder.id]}</small>}</label>
                                    )}
                                    {!detailOrderIsPaid && (
                                        <div className="order-payment-lock">
                                            ยังไม่พบยอดชำระเงิน กรุณาตรวจสอบก่อนดำเนินการจัดส่ง
                                        </div>
                                    )}
                                    <div>
                                        {selectedOrder.status === 'รอจัดการ' && <button type="button" className="success" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เตรียมสินค้า')}>เตรียมสินค้า</button>}
                                        {['เตรียมสินค้า', 'กำลังจัดส่ง', 'จัดส่งแล้ว'].includes(selectedOrder.status) && !isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เสร็จสิ้น')}>บันทึกเลขพัสดุและเสร็จสิ้น</button>}
                                        {selectedOrder.status === 'เตรียมสินค้า' && isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'พร้อมรับสินค้า')}>พร้อมรับสินค้า</button>}
                                        {selectedOrder.status === 'พร้อมรับสินค้า' && isPickupOrder(selectedOrder) && <button type="button" className="primary" disabled={!detailOrderIsPaid || savingOrderId === selectedOrder.id} onClick={() => runOrderStep(selectedOrder, 'เสร็จสิ้น')}>เสร็จสิ้น</button>}
                                        {!isPaidOrder(detailOrder) && !isCancelledOrder(detailOrder || selectedOrder) && (
                                            <button type="button" className="danger" onClick={() => onCancelOrder(selectedOrder.id, { onCancelled: closeOrderDetailModal })}>ยกเลิกคำสั่งซื้อ</button>
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
                            <div className="receipt-lightbox-actions">
                                <button
                                    type="button"
                                    className="receipt-lightbox-copy"
                                    onClick={reviewReceiptEvidence}
                                    disabled={receiptOcrLoading}
                                >
                                    {receiptOcrLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบจำนวนเงินและอ้างอิง'}
                                </button>
                                <button type="button" onClick={() => setReceiptPreview(null)} aria-label="ปิดรูปสลิป">×</button>
                            </div>
                        </header>
                        <div className="receipt-lightbox-body">
                            {receiptOcrError && <div className="receipt-lightbox-error">{receiptOcrError}</div>}
                            <img src={receiptPreview.src} alt={`สลิปคำสั่งซื้อ ${receiptPreview.orderId}`} />
                        </div>
                    </section>
                </div>
            )}

            {rejectReviewOpen && (
                <div className="reject-review-backdrop" role="presentation" onMouseDown={closeRejectReviewDialog}>
                    <section
                        className="reject-review-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-review-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>REJECT REASON</span>
                                <h2 id="reject-review-title">เลือกเหตุผลในการปฏิเสธ</h2>
                            </div>
                            <button type="button" onClick={closeRejectReviewDialog} aria-label="ปิดกล่องเหตุผล">×</button>
                        </header>
                        <div className="reject-review-body">
                            <p>กรุณาเลือกเหตุผลที่ตรงกับสลิป เพื่อบันทึกลงประวัติการตรวจสอบ</p>
                            <select value={rejectReviewReason} onChange={(event) => {
                                setRejectReviewError('');
                                setRejectReviewReason(event.target.value);
                            }}>
                                <option value="">เลือกเหตุผล</option>
                                {rejectionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                            </select>
                            {rejectReviewError && <div className="reject-review-error">{rejectReviewError}</div>}
                        </div>
                        <div className="reject-review-actions">
                            <button type="button" className="secondary" onClick={closeRejectReviewDialog} disabled={paymentReviewSaving}>ยกเลิก</button>
                            <button type="button" className="danger" onClick={submitRejectReview} disabled={paymentReviewSaving}>ยืนยันปฏิเสธ</button>
                        </div>
                    </section>
                </div>
            )}

            {tableRejectDialogOrder && (
                <div className="reject-review-backdrop" role="presentation" onMouseDown={closeTableRejectDialog}>
                    <section
                        className="reject-review-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="table-reject-review-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>REJECT REASON</span>
                                <h2 id="table-reject-review-title">เลือกหมายเหตุการปฏิเสธ</h2>
                            </div>
                            <button type="button" onClick={closeTableRejectDialog} aria-label="ปิดกล่องเหตุผล">×</button>
                        </header>
                        <div className="reject-review-body">
                            <p>กรุณาเลือกหมายเหตุ แล้วกดตกลงเพื่อบันทึกการปฏิเสธออเดอร์ #{tableRejectDialogOrder.id}</p>
                            <select value={rejectReviewReason} onChange={(event) => {
                                setRejectReviewError('');
                                setRejectReviewReason(event.target.value);
                            }}>
                                <option value="">เลือกหมายเหตุ</option>
                                {rejectionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                            </select>
                            {rejectReviewError && <div className="reject-review-error">{rejectReviewError}</div>}
                        </div>
                        <div className="reject-review-actions">
                            <button type="button" className="secondary" onClick={closeTableRejectDialog} disabled={Boolean(quickReviewOrderAction)}>ยกเลิก</button>
                            <button type="button" className="danger" onClick={submitTableRejectReview} disabled={Boolean(quickReviewOrderAction)}>ตกลง</button>
                        </div>
                    </section>
                </div>
            )}
                </>
            )}

        </div>
    );
}

export default AdminDashboardPage;
