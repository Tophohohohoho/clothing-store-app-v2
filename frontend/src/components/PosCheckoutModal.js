import { useEffect, useMemo, useRef, useState } from 'react';
import { getCartCount, getCartTotal, getItemPrice, getItemQuantity } from '../utils/cart';
import { formatThaiDateTime } from '../utils/date';

const PROMPTPAY_ID = '1234567890';

const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const crc16 = (value) => {
    let crc = 0xffff;
    for (let index = 0; index < value.length; index += 1) {
        crc ^= value.charCodeAt(index) << 8;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
};

const createPromptPayPayload = (promptPayId, amount) => {
    const digits = String(promptPayId || '').replace(/\D/g, '');
    const target = digits.length === 10 ? `0066${digits.slice(1)}` : digits;
    const merchantInfo = `0016A0000006770101110113${target}`;
    const amountText = amount.toFixed(2);
    const payload = [
        '000201',
        '010212',
        `29${String(merchantInfo.length).padStart(2, '0')}${merchantInfo}`,
        '5303764',
        `54${String(amountText.length).padStart(2, '0')}${amountText}`,
        '5802TH',
        '6304',
    ].join('');
    return `${payload}${crc16(payload)}`;
};

function PosCheckoutModal({ cart, cashier, onClose, onConfirm }) {
    const total = getCartTotal(cart);
    const itemCount = getCartCount(cart);
    const [paymentMethod, setPaymentMethod] = useState('เงินสด');
    const [userCode, setUserCode] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [receipt, setReceipt] = useState(null);
    const hasAutoPrintedReceipt = useRef(false);
    const cashAmount = Number(cashReceived) || 0;
    const change = Math.max(cashAmount - total, 0);
    const qrPayload = useMemo(() => createPromptPayPayload(PROMPTPAY_ID, total), [total]);
    const qrCodeUrl = `https://quickchart.io/qr?size=240&margin=1&ecLevel=M&text=${encodeURIComponent(qrPayload)}`;

    useEffect(() => {
        if (!receipt) return undefined;
        const previousTitle = document.title;
        document.title = 'ใบเสร็จรับเงิน';
        return () => { document.title = previousTitle; };
    }, [receipt]);

    useEffect(() => {
        if (!receipt || hasAutoPrintedReceipt.current) return undefined;
        hasAutoPrintedReceipt.current = true;
        const printTimer = window.setTimeout(() => window.print(), 150);
        return () => window.clearTimeout(printTimer);
    }, [receipt]);

    const submitSale = async () => {
        setError('');
        if (!userCode.trim()) {
            setError('กรุณากรอกรหัสผู้ใช้งาน');
            return;
        }
        if (paymentMethod === 'เงินสด' && cashAmount < total) {
            setError('จำนวนเงินที่รับมาต้องไม่น้อยกว่ายอดสุทธิ');
            return;
        }

        try {
            setIsSubmitting(true);
            const result = await onConfirm({
                user_code: userCode.trim(),
                payment_method: paymentMethod,
                cash_received: paymentMethod === 'เงินสด' ? cashAmount : total,
            });
            setReceipt(result);
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'บันทึกการขายไม่สำเร็จ');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (receipt) {
        return (
            <div className="pos-modal-backdrop">
                <section className="pos-receipt-dialog">
                    <div className="pos-receipt-print">
                        <header>
                            <span>SHOP LRU</span>
                            <h2>ใบเสร็จรับเงิน</h2>
                            <p>เลขที่ #{receipt.order_id}</p>
                        </header>
                        <div className="pos-receipt-meta">
                            <span>วันที่</span><strong>{formatThaiDateTime(receipt.order_date)}</strong>
                            <span>พนักงาน</span><strong>{cashier?.full_name || cashier?.username || '-'}</strong>
                            <span>รหัสผู้ใช้งาน</span><strong>{receipt.receiver_name || '-'}</strong>
                            <span>ชำระโดย</span><strong>{receipt.payment_method}</strong>
                        </div>
                        <div className="pos-receipt-items">
                            {receipt.items.map((item) => (
                                <div key={item.product_id}>
                                    <span>
                                        <strong>{item.name}</strong>
                                        <small>{item.quantity} × ฿{formatMoney(item.price)}</small>
                                    </span>
                                    <b>฿{formatMoney(item.quantity * item.price)}</b>
                                </div>
                            ))}
                        </div>
                        <div className="pos-receipt-totals">
                            <span>รวม {receipt.item_count} ชิ้น</span><strong>฿{formatMoney(receipt.total)}</strong>
                            {receipt.payment_method === 'เงินสด' && (
                                <>
                                    <span>รับเงิน</span><strong>฿{formatMoney(receipt.cash_received)}</strong>
                                    <span>เงินทอน</span><strong>฿{formatMoney(receipt.change)}</strong>
                                </>
                            )}
                        </div>
                        <footer>ขอบคุณที่ใช้บริการ</footer>
                    </div>
                    <div className="pos-receipt-actions">
                        <button type="button" className="is-secondary" onClick={onClose}>ปิด</button>
                        <button type="button" onClick={() => window.print()}>พิมพ์ใบเสร็จ</button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="pos-modal-backdrop" onMouseDown={onClose}>
            <section className="pos-checkout-dialog" onMouseDown={(event) => event.stopPropagation()}>
                <header className="pos-checkout-header">
                    <div><span>POINT OF SALE</span><h2>ชำระเงินหน้าร้าน</h2><p>ขายโดย {cashier?.full_name || cashier?.username}</p></div>
                    <button type="button" onClick={onClose} aria-label="ปิด">&times;</button>
                </header>

                <div className="pos-checkout-body">
                    <div className="pos-sale-summary">
                        <h3>รายการสินค้า <span>{itemCount} ชิ้น</span></h3>
                        <div className="pos-sale-items">
                            {cart.map((item) => {
                                const quantity = getItemQuantity(item);
                                const price = getItemPrice(item);
                                return (
                                    <div key={item.id}>
                                        <span>
                                            <strong>{item.name}</strong>
                                            <small>฿{formatMoney(price)} × {quantity}</small>
                                        </span>
                                        <b>฿{formatMoney(price * quantity)}</b>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="pos-grand-total"><span>ยอดสุทธิ</span><strong>฿{formatMoney(total)}</strong></div>
                    </div>

                    <div className="pos-payment-panel">
                        <h3>รหัสผู้ใช้งาน</h3>
                        <div className="pos-cash-box">
                            <label>รหัสผู้ใช้งาน</label>
                            <div><input type="text" value={userCode} onChange={(event) => { setUserCode(event.target.value); setError(''); }} placeholder="กรอกรหัสผู้ใช้งาน" autoFocus /></div>
                        </div>
                        <h3>เลือกวิธีชำระเงิน</h3>
                        <div className="pos-payment-methods">
                            {['เงินสด', 'QR'].map((method) => (
                                <button
                                    type="button"
                                    key={method}
                                    className={paymentMethod === method ? 'is-active' : ''}
                                    onClick={() => { setPaymentMethod(method); setError(''); }}
                                >
                                    <span>{method === 'เงินสด' ? '฿' : '▦'}</span>
                                    <strong>{method}</strong>
                                    <small>{method === 'เงินสด' ? 'รับเงินและคำนวณเงินทอน' : 'สแกนจ่ายตามยอดสุทธิ'}</small>
                                </button>
                            ))}
                        </div>

                        {paymentMethod === 'เงินสด' ? (
                            <div className="pos-cash-box">
                                <label>จำนวนเงินที่รับ</label>
                                <div><span>฿</span><input type="number" min={total} step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} /></div>
                                <div className="pos-quick-cash">
                                    {[total, Math.ceil(total / 100) * 100, 500, 1000].filter((value, index, values) => value >= total && values.indexOf(value) === index).map((value) => (
                                        <button type="button" key={value} onClick={() => setCashReceived(String(value))}>฿{formatMoney(value)}</button>
                                    ))}
                                </div>
                                <p><span>เงินทอน</span><strong>฿{formatMoney(change)}</strong></p>
                            </div>
                        ) : (
                            <div className="pos-qr-box">
                                <img src={qrCodeUrl} alt={`QR ชำระเงิน ${formatMoney(total)} บาท`} />
                                <div><strong>สแกนชำระ ฿{formatMoney(total)}</strong><span>ตรวจสอบยอดรับเงินก่อนยืนยันการขาย</span></div>
                            </div>
                        )}

                        {error && <div className="pos-payment-error">{error}</div>}
                        <button type="button" className="pos-complete-sale" onClick={submitSale} disabled={isSubmitting}>
                            {isSubmitting ? 'กำลังบันทึกการขาย...' : `ยืนยันรับชำระด้วย${paymentMethod}`}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default PosCheckoutModal;
