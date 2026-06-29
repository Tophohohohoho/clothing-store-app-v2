import { useEffect, useRef, useState } from 'react';
import * as adminApi from '../api/adminApi';

const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatPrintTimestamp = () => new Date().toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
});

function AdminOrderPrintPage({ orderIds }) {
    const [payloads, setPayloads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [printTimestamp] = useState(() => formatPrintTimestamp());
    const hasAutoPrinted = useRef(false);
    const printableOrderIds = Array.isArray(orderIds) ? orderIds.filter(Boolean) : [];
    const printableOrderIdKey = printableOrderIds.join(',');
    const shouldAutoPrint = new URLSearchParams(window.location.search).get('print') === '1';

    useEffect(() => {
        let active = true;
        const idsToLoad = printableOrderIdKey.split(',').map((id) => id.trim()).filter(Boolean);

        const loadOrders = async () => {
            setLoading(true);
            setError('');
            try {
                const responses = await Promise.all(idsToLoad.map((id) => adminApi.getOrderDetails(id)));
                const loadedPayloads = responses.map((response) => response.data || null).filter(Boolean);
                const unpaidOrder = loadedPayloads.find((item) => item?.order?.payment_status !== 'ชำระเงินแล้ว');
                if (unpaidOrder) {
                    throw new Error(`ออเดอร์ #${unpaidOrder.order?.id || '-'} ยังไม่ชำระเงิน ไม่สามารถพิมพ์ใบจัดส่งได้`);
                }
                if (active) setPayloads(loadedPayloads);
            } catch (err) {
                if (active) setError(err.response?.data?.error || err.message || 'โหลดข้อมูลใบจัดส่ง PDF ไม่สำเร็จ');
            } finally {
                if (active) setLoading(false);
            }
        };

        if (idsToLoad.length) {
            loadOrders();
        } else {
            setLoading(false);
            setError('ไม่พบเลขที่ออเดอร์สำหรับพิมพ์ใบจัดส่ง');
        }
        return () => { active = false; };
    }, [printableOrderIdKey]);

    useEffect(() => {
        if (!shouldAutoPrint || hasAutoPrinted.current || loading || error || payloads.length === 0) return;
        hasAutoPrinted.current = true;
        const printTimer = window.setTimeout(() => window.print(), 150);
        return () => window.clearTimeout(printTimer);
    }, [shouldAutoPrint, loading, error, payloads.length]);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = 'ใบจัดส่งสินค้า';
        return () => { document.title = previousTitle; };
    }, []);

    const renderOrderSheet = (payload, sheetIndex) => {
    const order = payload?.order || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const isPickup = order.shipping_method === 'รับหน้าร้าน';
    const isPosSale = order.shipping_method === 'ขายหน้าร้าน';
    const receiverName = order.receiver_name || order.full_name || order.username || 'ลูกค้าทั่วไป';
    const phone = order.shipping_phone || order.customer_phone || order.phone || '-';
    const addressLine = (
        [
            order.address_detail,
            order.subdistrict ? `ต.${order.subdistrict}` : '',
            order.district ? `อ.${order.district}` : '',
            order.province ? `จ.${order.province}` : '',
            order.postal_code,
        ].filter(Boolean).join(' ')
    );

        return (
                <section className="print-order-sheet" key={order.id || sheetIndex}>
                    <div className="print-order-timestamp">{printTimestamp}</div>
                    <header className="print-order-header">
                        <div>
                            <span>Shipping Document</span>
                            <h1>ใบจัดส่งสินค้า</h1>
                            <p>สำหรับแนบพัสดุและตรวจสอบก่อนส่งมอบสินค้า</p>
                        </div>
                        <div>
                            <small>เลขที่ออเดอร์</small>
                            <strong>#{order.id || printableOrderIds[sheetIndex]}</strong>
                        </div>
                    </header>

                    <section className="print-order-grid">
                        <article>
                            <h2>ข้อมูลคำสั่งซื้อ</h2>
                            <dl>
                                <div><dt>วันที่สั่งซื้อ</dt><dd>{formatDate(order.created_at)}</dd></div>
                                <div><dt>วิธีรับสินค้า</dt><dd>{order.shipping_method || '-'}</dd></div>
                                <div><dt>สถานะชำระเงิน</dt><dd>{order.payment_status || '-'}</dd></div>
                                <div><dt>สถานะออเดอร์</dt><dd>{order.status || '-'}</dd></div>
                            </dl>
                        </article>

                        <article>
                            <h2>ข้อมูลลูกค้า</h2>
                            <dl>
                                <div><dt>ชื่อลูกค้า</dt><dd>{order.full_name || receiverName}</dd></div>
                                <div><dt>Username</dt><dd>{order.username || '-'}</dd></div>
                                <div><dt>เบอร์โทรศัพท์</dt><dd>{phone}</dd></div>
                            </dl>
                        </article>
                    </section>

                    {isPickup || isPosSale ? (
                        <section className="print-order-pickup">
                            <h2>วิธีรับสินค้า</h2>
                            <strong>ลูกค้ารับสินค้าด้วยตนเอง</strong>
                            <p>{isPosSale ? 'รายการขายหน้าร้าน ไม่ต้องจัดส่งผ่านขนส่ง' : 'ออเดอร์นี้เป็นการรับสินค้าที่หน้าร้าน'}</p>
                        </section>
                    ) : (
                        <section className="print-order-shipping">
                            <div>
                                <h2>ที่อยู่จัดส่ง</h2>
                                <p><strong>{receiverName}</strong></p>
                                <p>{addressLine || '-'}</p>
                                <p>โทร: {phone}</p>
                            </div>
                            <div>
                                <h2>ข้อมูลขนส่ง</h2>
                                <dl>
                                    <div><dt>บริษัทขนส่ง</dt><dd>{order.shipping_company || order.delivery_company || '-'}</dd></div>
                                    <div><dt>เลขพัสดุ</dt><dd>{order.tracking_no || '-'}</dd></div>
                                </dl>
                            </div>
                        </section>
                    )}

                    <section className="print-order-items">
                        <h2>รายการสินค้าในออเดอร์</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>สินค้า</th>
                                    <th>ตัวเลือก</th>
                                    <th className="number">จำนวน</th>
                                    <th className="number">ราคาต่อชิ้น</th>
                                    <th className="number">ราคารวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length ? items.map((item) => {
                                    const qty = Number(item.quantity || 0);
                                    const price = Number(item.price || 0);
                                    return (
                                        <tr key={item.order_detail_id || `${item.product_id}-${item.product_name}`}>
                                            <td>{item.product_name || '-'}</td>
                                            <td>{[item.selected_size && `ไซซ์ ${item.selected_size}`, item.selected_color && `สี ${item.selected_color}`].filter(Boolean).join(' / ') || '-'}</td>
                                            <td className="number">{qty.toLocaleString('th-TH')}</td>
                                            <td className="number">฿{formatMoney(price)}</td>
                                            <td className="number">฿{formatMoney(qty * price)}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan="5">ไม่มีรายการสินค้า</td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>

                    <section className="print-order-total">
                        <div><span>ยอดสินค้า</span><strong>฿{formatMoney(order.total_price)}</strong></div>
                        <div><span>ค่าส่ง</span><strong>฿{formatMoney(order.shipping_fee)}</strong></div>
                        <div><span>ส่วนลด</span><strong>-฿{formatMoney(order.discount)}</strong></div>
                        <div className="grand-total"><span>ยอดรวมทั้งหมด</span><strong>฿{formatMoney(order.final_price ?? order.total_price)}</strong></div>
                    </section>
                </section>
        );
    };

    return (
        <main className="print-order-page">
            <div className="print-order-actions">
                <button type="button" onClick={() => window.print()}>
                    สร้าง PDF / พิมพ์{payloads.length > 1 ? ` (${payloads.length} ใบ)` : ''}
                </button>
                <button type="button" className="secondary" onClick={() => window.close()}>ปิด</button>
            </div>

            {loading ? (
                <section className="print-order-sheet">
                    <div className="print-order-state">กำลังโหลดข้อมูลใบจัดส่ง PDF...</div>
                </section>
            ) : error ? (
                <section className="print-order-sheet">
                    <div className="print-order-state error">{error}</div>
                </section>
            ) : (
                payloads.map(renderOrderSheet)
            )}
        </main>
    );
}

export default AdminOrderPrintPage;
