import { useEffect, useState } from 'react';
import { notify } from './AppNotification';
import { copyTextToClipboard, extractTextFromImage } from '../utils/imageText';
import { resolveMediaUrl } from '../utils/media';

const BANK_ACCOUNT = '123-4-56789-0';
const BANK_ACCOUNT_DIGITS = '1234567890';
const BANK_NAME = 'ธนาคารกสิกรไทย';
const BANK_ACCOUNT_NAME = 'บริษัท เสื้อผ้าแฟชั่น จำกัด';
const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const REJECTED_PAYMENT_STATUSES = ['ถูกปฏิเสธ', 'หลักฐานไม่ถูกต้อง', 'ไม่พบยอดเงินเข้า', 'สงสัยสลิปปลอม'];

function OrderHistoryModal({
    orders,
    username,
    mode = 'customer',
    isPageView = false,
    title = 'คำสั่งซื้อ',
    eyebrow = 'Order History',
    description = 'ตรวจสอบคำสั่งซื้อ สถานะชำระเงิน และแนบสลิปได้ในที่เดียว',
    activeTabLabel = 'คำสั่งซื้อ',
    historyTabLabel = 'ประวัติคำสั่งซื้อ',
    onClose,
    onUploadReceipt,
    onCancelReceipt,
    onCancelOrder,
}) {
    const [uploadingOrderId, setUploadingOrderId] = useState(null);
    const [cancellingReceiptOrderId, setCancellingReceiptOrderId] = useState(null);
    const [uploadError, setUploadError] = useState({ orderId: null, message: '' });
    const [receiptDrafts, setReceiptDrafts] = useState({});
    const [expandedOrders, setExpandedOrders] = useState({});
    const [activeView, setActiveView] = useState('active');
    const [activePaymentView, setActivePaymentView] = useState('pending');
    const [activeHistoryView, setActiveHistoryView] = useState('completed');
    const [customerOrderFilter, setCustomerOrderFilter] = useState('all');
    const [detailOrder, setDetailOrder] = useState(null);
    const [receiptOrder, setReceiptOrder] = useState(null);
    const [slipPreview, setSlipPreview] = useState(null);
    const [slipOcrLoading, setSlipOcrLoading] = useState(false);
    const [slipOcrError, setSlipOcrError] = useState('');
    const [salesOrderSearch, setSalesOrderSearch] = useState('');
    const [isAccountCopied, setIsAccountCopied] = useState(false);
    const cancelableStatuses = ['รอชำระเงิน', 'รอตรวจสอบการชำระเงิน', 'รอจัดการ', 'เตรียมสินค้า'];
    const completedHistoryStatuses = ['สำเร็จ', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น'];
    const cancelledHistoryStatuses = ['ยกเลิก', 'ยกเลิกคำสั่งซื้อ'];
    const historyStatuses = [...completedHistoryStatuses, ...cancelledHistoryStatuses];
    const completedSaleStatuses = ['สำเร็จ', 'ได้รับสินค้าแล้ว', 'เสร็จสิ้น'];
    const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
    const reuploadPaymentStatuses = ['รอชำระ', ...REJECTED_PAYMENT_STATUSES];
    const orderList = Array.isArray(orders) ? orders : [];
    const isSalesMode = mode === 'sales';
    const isCompactCustomerPage = isPageView && !isSalesMode;
    const isHistoryOrder = (order) => historyStatuses.includes(order.status);
    const isPendingPaymentOrder = (order) => reuploadPaymentStatuses.includes(order.payment_status) || ['รอชำระเงิน', 'รอจัดการ'].includes(order.status);
    const isCancelledOrder = (order) => cancelledHistoryStatuses.includes(order.status);
    const isCompletedOrder = (order) => completedHistoryStatuses.includes(order.status);
    const isProcessingOrder = (order) => !isPendingPaymentOrder(order) && !isCompletedOrder(order) && !isCancelledOrder(order);
    const isStoreSale = (order) => (order.shipping_method || order.delivery_type) === 'ขายหน้าร้าน';
    const activeOrders = isSalesMode
        ? orderList.filter((order) => isStoreSale(order))
        : orderList.filter((order) => !isHistoryOrder(order));
    const pendingPaymentOrders = activeOrders.filter((order) => isPendingPaymentOrder(order));
    const reviewPaymentOrders = activeOrders.filter((order) => order.payment_status === 'รอตรวจสอบ');
    const paidActiveOrders = activeOrders.filter((order) => ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(order.payment_status));
    const historyOrders = isSalesMode
        ? orderList.filter((order) => !isStoreSale(order) && completedSaleStatuses.includes(order.status))
        : orderList.filter((order) => isHistoryOrder(order));
    const completedHistoryOrders = isSalesMode
        ? historyOrders
        : historyOrders.filter((order) => completedHistoryStatuses.includes(order.status));
    const cancelledHistoryOrders = isSalesMode
        ? []
        : historyOrders.filter((order) => cancelledHistoryStatuses.includes(order.status));
    const visibleOrders = activeView === 'active'
        ? (isSalesMode ? activeOrders : (activePaymentView === 'pending' ? pendingPaymentOrders : activePaymentView === 'review' ? reviewPaymentOrders : paidActiveOrders))
        : (isSalesMode ? historyOrders : (activeHistoryView === 'completed' ? completedHistoryOrders : cancelledHistoryOrders));
    const normalizedSalesSearch = salesOrderSearch.replace(/#/g, '').trim();
    const displayedOrders = isCompactCustomerPage
        ? orderList.filter((order) => {
            if (customerOrderFilter === 'pending') return isPendingPaymentOrder(order);
            if (customerOrderFilter === 'processing') return isProcessingOrder(order);
            if (customerOrderFilter === 'completed') return isCompletedOrder(order);
            return !isCancelledOrder(order);
        })
        : isSalesMode && normalizedSalesSearch
        ? visibleOrders.filter((order) => {
            const orderId = String(order.id || order.order_id || order.orderNumber || '').replace(/#/g, '').trim();
            return orderId === normalizedSalesSearch;
        })
        : visibleOrders;
    const canUploadReceipt = !isSalesMode && Boolean(onUploadReceipt);
    const canCancelOrder = !isSalesMode && Boolean(onCancelOrder);
    const canCancelReceipt = !isSalesMode && Boolean(onCancelReceipt);
    const rootClassName = isPageView ? 'order-history-page' : 'order-history-backdrop';
    const dialogClassName = isPageView ? 'order-history-dialog order-history-dialog-page' : 'order-history-dialog';
    const bodyClassName = isPageView ? 'order-history-body order-history-body-page' : 'order-history-body';
    const toggleExpandedOrder = (orderId) => {
        setExpandedOrders((current) => ({
            ...current,
            [orderId]: !current[orderId],
        }));
    };
    const openOrderDetail = (order, orderKey) => {
        if (isCompactCustomerPage) {
            setDetailOrder(order);
            return;
        }
        toggleExpandedOrder(orderKey);
    };

    useEffect(() => {
        if (!detailOrder?.id) return;
        const sourceOrders = Array.isArray(orders) ? orders : [];
        const refreshedOrder = sourceOrders.find((order) => String(order.id) === String(detailOrder.id));
        if (refreshedOrder && refreshedOrder !== detailOrder) setDetailOrder(refreshedOrder);
    }, [detailOrder, orders]);
    const stopCardToggle = (event) => {
        event.stopPropagation();
    };

    const formatMoney = (value) => Number(value || 0).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const formatPaymentStatus = (status) => (status === 'ชำระแล้ว' ? 'ชำระเงินแล้ว' : status);

    const formatFileSize = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(2)} MB`;

    const formatDateTime = (value) => {
        if (!value) return 'ไม่ระบุวันที่ขาย';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'ไม่ระบุวันที่ขาย';

        return date.toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    };

    const getSellerName = (order) => (
        order.cashier_name
        || order.created_by_username
        || order.full_name
        || order.username
        || username
        || 'admin'
    );

    const getPaymentMethod = (order) => order.payment_method || order.payment_type || 'ไม่ระบุ';
    const getCompactItemSummary = (orderItems) => {
        const productNames = orderItems
            .map((orderItem) => orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น')
            .filter(Boolean);

        if (productNames.length === 0) return '';

        const visibleNames = productNames.slice(0, 3).join(', ');
        const remainingCount = productNames.length - 3;

        return remainingCount > 0
            ? `${visibleNames} และอีก ${remainingCount} รายการ`
            : visibleNames;
    };

    const renderProductThumb = (orderItem, fallbackText) => {
        const imageSrc = resolveMediaUrl(orderItem.product_image || orderItem.image_url || orderItem.image);
        if (imageSrc) {
            return <img src={imageSrc} alt={orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'} />;
        }
        return <span>{fallbackText}</span>;
    };

    const copyBankAccount = async () => {
        try {
            await navigator.clipboard.writeText(BANK_ACCOUNT_DIGITS);
            setIsAccountCopied(true);
            window.setTimeout(() => setIsAccountCopied(false), 1800);
        } catch {
            setIsAccountCopied(false);
        }
    };

    const copySlipText = async () => {
        if (!slipPreview?.src || slipOcrLoading) return;

        setSlipOcrLoading(true);
        setSlipOcrError('');
        try {
            const extractedText = await extractTextFromImage(slipPreview.src);
            if (!extractedText) {
                notify({
                    type: 'warning',
                    title: 'ไม่พบข้อความในภาพ',
                    message: 'รูปนี้อาจไม่ชัดพอสำหรับการอ่านตัวอักษร',
                });
                return;
            }

            const copied = await copyTextToClipboard(extractedText);
            if (!copied) throw new Error('copy_failed');

            notify({
                type: 'success',
                title: 'คัดลอกข้อความจากภาพแล้ว',
                message: 'ข้อความจากสลิปถูกคัดลอกไปยังคลิปบอร์ด',
            });
        } catch (error) {
            setSlipOcrError('คัดลอกข้อความจากภาพไม่สำเร็จ');
            notify({
                type: 'error',
                title: 'คัดลอกข้อความจากภาพไม่สำเร็จ',
                message: 'ลองใช้รูปที่ชัดขึ้นหรือเปิดใหม่อีกครั้ง',
            });
            console.error(error);
        } finally {
            setSlipOcrLoading(false);
        }
    };

    const getReceiptAmounts = (order, finalPrice) => {
        const cashReceived = Number(order.cash_received ?? order.payment_amount ?? finalPrice);
        const change = Number(order.change ?? Math.max(cashReceived - Number(finalPrice || 0), 0));
        return { cashReceived, change };
    };

    const getOrderItems = (order) => {
        if (Array.isArray(order.items) && order.items.length > 0) return order.items;
        if (order.product_id || order.product_name || order.name) {
            return [{
                product_id: order.product_id,
                product_name: order.product_name || order.name,
                product_image: order.product_image || order.image_url || order.image,
                product_description: order.product_description || order.description || '',
                quantity: order.qty || order.quantity || 1,
                price: order.price || 0,
            }];
        }
        return [];
    };

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const handleReceiptChange = async (orderId, file) => {
        if (!file || !onUploadReceipt) return;

        if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
            setUploadError({ orderId, message: 'รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP เท่านั้น' });
            setReceiptDrafts((current) => {
                const next = { ...current };
                delete next[orderId];
                return next;
            });
            return;
        }

        if (file.size > MAX_RECEIPT_SIZE) {
            setUploadError({ orderId, message: 'ขนาดไฟล์ต้องไม่เกิน 5MB' });
            setReceiptDrafts((current) => {
                const next = { ...current };
                delete next[orderId];
                return next;
            });
            return;
        }

        try {
            setUploadError({ orderId: null, message: '' });
            const imageData = await readFileAsDataUrl(file);
            setReceiptDrafts((current) => ({
                ...current,
                [orderId]: {
                    imageData,
                    fileName: file.name,
                    fileSize: file.size,
                },
            }));
        } catch (err) {
            setUploadError({ orderId, message: 'ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่' });
        }
    };

    const removeReceiptDraft = (orderId) => {
        setReceiptDrafts((current) => {
            const next = { ...current };
            delete next[orderId];
            return next;
        });
        setUploadError({ orderId: null, message: '' });
    };

    const submitReceiptDraft = async (orderId) => {
        const draft = receiptDrafts[orderId];
        if (!draft || !onUploadReceipt) {
            setUploadError({ orderId, message: 'กรุณาอัปโหลดสลิปโอนเงิน' });
            return;
        }

        try {
            setUploadError({ orderId: null, message: '' });
            setUploadingOrderId(orderId);
            await onUploadReceipt(orderId, {
                receipt_image_data: draft.imageData,
                receipt_file_name: draft.fileName,
            });
            removeReceiptDraft(orderId);
        } catch (err) {
            setUploadError({ orderId, message: err.response?.data?.error || 'ไม่สามารถส่งหลักฐานการชำระเงินได้' });
        } finally {
            setUploadingOrderId(null);
        }
    };

    const cancelCurrentReceipt = async (orderId) => {
        if (!onCancelReceipt || cancellingReceiptOrderId) return;

        try {
            setUploadError({ orderId: null, message: '' });
            setCancellingReceiptOrderId(orderId);
            await onCancelReceipt(orderId);
            removeReceiptDraft(orderId);
        } catch (err) {
            setUploadError({ orderId, message: err.response?.data?.error || 'ไม่สามารถยกเลิกสลิปเดิมได้' });
        } finally {
            setCancellingReceiptOrderId(null);
        }
    };

    return (
        <div className={rootClassName} onMouseDown={isPageView ? undefined : onClose}>
            <section
                className={dialogClassName}
                role={isPageView ? 'region' : 'dialog'}
                aria-modal={isPageView ? undefined : 'true'}
                aria-labelledby="order-history-title"
                onMouseDown={isPageView ? undefined : ((event) => event.stopPropagation())}
            >
                <header className="order-history-header">
                    <div>
                        <span>{eyebrow}</span>
                        <h2 id="order-history-title">{title}</h2>
                        <p>{description}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={isPageView ? `กลับจากหน้า${title}` : `ปิดหน้าต่าง${title}`}>
                        {isPageView ? '←' : '×'}
                    </button>
                </header>

                <div className={bodyClassName}>
                    {isCompactCustomerPage ? (
                        <div className="order-history-compact-tabs" role="tablist" aria-label="ตัวกรองคำสั่งซื้อของฉัน">
                            <button
                                type="button"
                                className={customerOrderFilter === 'all' ? 'is-active' : ''}
                                onClick={() => setCustomerOrderFilter('all')}
                                role="tab"
                                aria-selected={customerOrderFilter === 'all'}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                type="button"
                                className={customerOrderFilter === 'pending' ? 'is-active' : ''}
                                onClick={() => setCustomerOrderFilter('pending')}
                                role="tab"
                                aria-selected={customerOrderFilter === 'pending'}
                            >
                                รอชำระ
                            </button>
                            <button
                                type="button"
                                className={customerOrderFilter === 'processing' ? 'is-active' : ''}
                                onClick={() => setCustomerOrderFilter('processing')}
                                role="tab"
                                aria-selected={customerOrderFilter === 'processing'}
                            >
                                ดำเนินการ
                            </button>
                            <button
                                type="button"
                                className={customerOrderFilter === 'completed' ? 'is-active' : ''}
                                onClick={() => setCustomerOrderFilter('completed')}
                                role="tab"
                                aria-selected={customerOrderFilter === 'completed'}
                            >
                                สำเร็จ
                            </button>
                        </div>
                    ) : (
                        <div className="order-history-tabs" role="tablist" aria-label="ประเภทคำสั่งซื้อ">
                            <button
                                type="button"
                                className={activeView === 'active' ? 'is-active' : ''}
                                onClick={() => setActiveView('active')}
                                role="tab"
                                aria-selected={activeView === 'active'}
                            >
                                {activeTabLabel}
                                <span>{activeOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activeView === 'history' ? 'is-active' : ''}
                                onClick={() => setActiveView('history')}
                                role="tab"
                                aria-selected={activeView === 'history'}
                            >
                                {historyTabLabel}
                                <span>{historyOrders.length}</span>
                            </button>
                        </div>
                    )}

                    {!isCompactCustomerPage && !isSalesMode && activeView === 'active' && (
                        <div className="order-history-payment-tabs" role="tablist" aria-label="สถานะชำระเงิน">
                            <button
                                type="button"
                                className={activePaymentView === 'pending' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('pending')}
                                role="tab"
                                aria-selected={activePaymentView === 'pending'}
                            >
                                รอชำระ
                                <span>{pendingPaymentOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activePaymentView === 'review' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('review')}
                                role="tab"
                                aria-selected={activePaymentView === 'review'}
                            >
                                รอตรวจสอบ
                                <span>{reviewPaymentOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activePaymentView === 'paid' ? 'is-active' : ''}
                                onClick={() => setActivePaymentView('paid')}
                                role="tab"
                                aria-selected={activePaymentView === 'paid'}
                            >
                                ชำระแล้ว
                                <span>{paidActiveOrders.length}</span>
                            </button>
                        </div>
                    )}

                    {!isCompactCustomerPage && !isSalesMode && activeView === 'history' && (
                        <div className="order-history-payment-tabs" role="tablist" aria-label="สถานะประวัติคำสั่งซื้อ">
                            <button
                                type="button"
                                className={activeHistoryView === 'completed' ? 'is-active' : ''}
                                onClick={() => setActiveHistoryView('completed')}
                                role="tab"
                                aria-selected={activeHistoryView === 'completed'}
                            >
                                เสร็จสิ้น
                                <span>{completedHistoryOrders.length}</span>
                            </button>
                            <button
                                type="button"
                                className={activeHistoryView === 'cancelled' ? 'is-active' : ''}
                                onClick={() => setActiveHistoryView('cancelled')}
                                role="tab"
                                aria-selected={activeHistoryView === 'cancelled'}
                            >
                                ยกเลิก
                                <span>{cancelledHistoryOrders.length}</span>
                            </button>
                        </div>
                    )}

                    {isSalesMode && (
                        <div className="order-history-search" role="search">
                            <span aria-hidden="true">⌕</span>
                            <input
                                type="search"
                                value={salesOrderSearch}
                                onChange={(event) => setSalesOrderSearch(event.target.value)}
                                placeholder="ค้นหาด้วยเลขออเดอร์ เช่น #39"
                                aria-label="ค้นหาด้วยเลขออเดอร์"
                            />
                            {salesOrderSearch && (
                                <button type="button" onClick={() => setSalesOrderSearch('')}>
                                    ล้าง
                                </button>
                            )}
                        </div>
                    )}

                    {orderList.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>{isSalesMode ? 'ยังไม่มีประวัติการขาย' : 'ยังไม่มีประวัติคำสั่งซื้อ'}</strong>
                            <span>{isSalesMode ? 'ยังไม่พบรายการขายในระบบ' : `ไม่พบรายการของบัญชี: ${username}`}</span>
                        </div>
                    ) : displayedOrders.length === 0 ? (
                        <div className="order-history-empty">
                            <strong>
                                {isCompactCustomerPage
                                    ? 'ยังไม่มีคำสั่งซื้อในหมวดนี้'
                                    : isSalesMode && normalizedSalesSearch
                                    ? 'ไม่พบคำสั่งซื้อที่ค้นหา'
                                    : activeView === 'active'
                                    ? (isSalesMode ? 'ยังไม่มีประวัติการขายหน้าร้าน' : (activePaymentView === 'pending' ? 'ยังไม่มีออเดอร์รอชำระ' : activePaymentView === 'review' ? 'ยังไม่มีออเดอร์รอตรวจสอบ' : 'ยังไม่มีออเดอร์ที่ชำระแล้วและกำลังดำเนินการ'))
                                    : (isSalesMode ? 'ยังไม่มีรายการขายออนไลน์' : 'ยังไม่มีประวัติคำสั่งซื้อย้อนหลัง')}
                            </strong>
                            <span>
                                {isCompactCustomerPage
                                    ? 'ลองเปลี่ยนตัวกรองเพื่อดูรายการคำสั่งซื้ออื่น'
                                    : isSalesMode && normalizedSalesSearch
                                    ? 'ลองตรวจสอบเลขออเดอร์ หรือกดล้างเพื่อดูรายการทั้งหมด'
                                    : activeView === 'active'
                                        ? (isSalesMode ? 'รายการ POS หรือรายการที่ขายผ่านหน้าร้านจะแสดงที่นี่' : (activePaymentView === 'pending' ? 'ออเดอร์ที่ยังไม่แนบสลิปหรือยังไม่ชำระจะแสดงที่นี่' : activePaymentView === 'review' ? 'ออเดอร์ที่แนบสลิปแล้วและรอแอดมินยืนยันจะแสดงที่นี่' : 'ออเดอร์ที่ชำระแล้วแต่ยังไม่จบกระบวนการจะแสดงที่นี่'))
                                    : (isSalesMode ? 'รายการที่ลูกค้าสั่งผ่านหน้าร้านออนไลน์จะแสดงที่นี่' : (activeHistoryView === 'completed' ? 'ออเดอร์ที่จบกระบวนการแล้วจะแสดงในแท็บนี้' : 'ออเดอร์ที่ถูกยกเลิกจะแสดงในแท็บนี้'))}
                            </span>
                        </div>
                    ) : (
                        displayedOrders.map((item, index) => {
                            const orderItems = getOrderItems(item);
                            const itemCount = orderItems.reduce((sum, orderItem) => sum + Number(orderItem.qty || orderItem.quantity || 0), 0);
                            const productTotal = Number(item.total_price ?? orderItems.reduce((sum, orderItem) => {
                                const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                const price = Number(orderItem.price || 0);
                                return sum + (qty * price);
                            }, 0));
                            const shippingFee = Number(item.shipping_fee || 0);
                            const discount = Number(item.discount || 0);
                            const finalPrice = Number(item.final_price ?? (productTotal + shippingFee - discount));
                            const { cashReceived, change } = getReceiptAmounts(item, finalPrice);
                            const canCancel = canCancelOrder && cancelableStatuses.includes(item.status);
                            const hasSubmittedReceipt = Boolean(item.receipt_image);
                            const isReceiptWaitingReview = item.payment_status === 'รอตรวจสอบ';
                            const isReceiptApproved = ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(item.payment_status);
                            const isReceiptRejected = REJECTED_PAYMENT_STATUSES.includes(item.payment_status);
                            const canSendReceipt = canUploadReceipt
                                && !isReceiptWaitingReview
                                && !isReceiptApproved
                                && (isReceiptRejected || reuploadPaymentStatuses.includes(item.payment_status) || ['รอชำระเงิน', 'รอจัดการ'].includes(item.status));
                            const canCancelSubmittedReceipt = canCancelReceipt && isReceiptWaitingReview && hasSubmittedReceipt;
                            const uploadInputId = `receipt-upload-${item.id || index}`;
                            const receiptDraft = receiptDrafts[item.id];
                            const orderKey = item.id || index;
                            const isExpanded = Boolean(expandedOrders[orderKey]);
                            const showExpandedDetails = isSalesMode || isExpanded;
                            const saleDateTime = item.created_at || item.order_date;
                            const sellerName = getSellerName(item);
                            const compactItemSummary = getCompactItemSummary(orderItems);
                            const orderTitle = isSalesMode
                                ? (isStoreSale(item) ? 'คำสั่งซื้อหน้าร้าน' : `คำสั่งซื้อของ ${item.full_name || item.username || 'ลูกค้าทั่วไป'}`)
                                : (isCompactCustomerPage
                                    ? (compactItemSummary || item.name || item.product_name || 'สินค้าแฟชั่น')
                                    : (orderItems.length > 1 ? `สินค้า ${orderItems.length} รายการ` : (item.name || item.product_name || 'สินค้าแฟชั่น')));
                            const receiptPayload = {
                                ...item,
                                items: orderItems,
                                item_count: itemCount,
                                product_total: productTotal,
                                final_price: finalPrice,
                                sale_date_time: saleDateTime,
                                seller_name: sellerName,
                            };

                            return (
                                <article
                                    className={`order-history-card ${isCompactCustomerPage ? 'is-compact-card' : ''}`}
                                    key={item.id || index}
                                >
                                    <div className="order-history-card-header">
                                        <div>
                                            <span>{isCompactCustomerPage ? 'คำสั่งซื้อ' : 'รหัสคำสั่งซื้อ'}</span>
                                            <strong>#{item.id}</strong>
                                            {isCompactCustomerPage ? (
                                                <small className="order-history-sale-date">
                                                    {formatDateTime(saleDateTime)}
                                                </small>
                                            ) : isSalesMode && (
                                                <small className="order-history-sale-date">
                                                    {formatDateTime(saleDateTime)}
                                                </small>
                                            )}
                                        </div>
                                        <div className="order-history-card-header-side">
                                            <span className="order-history-status">{isCompactCustomerPage ? formatPaymentStatus(item.payment_status || item.status || 'รอชำระ') : (item.status || 'สำเร็จ')}</span>
                                            {item.tracking_no && (
                                                <small className="order-history-tracking-code">
                                                    เลขพัสดุ {item.tracking_no}
                                                </small>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`order-history-product ${isCompactCustomerPage ? 'is-compact' : ''}`}>
                                        <div className="order-history-product-main">
                                            <h3>{orderTitle}</h3>
                                            {isCompactCustomerPage ? (
                                                <div className="order-history-compact-stats">
                                                    <span>{`สินค้า ${orderItems.length || 0} รายการ`}</span>
                                                    <span>{`จำนวน ${itemCount || 0} ชิ้น`}</span>
                                                    <span>{`รวม ฿${formatMoney(productTotal)}`}</span>
                                                </div>
                                            ) : item.detail && <p>{item.detail}</p>}
                                            <div className={`order-history-tags ${isCompactCustomerPage ? 'is-compact' : ''}`}>
                                                {isSalesMode && isStoreSale(item) && <span className="order-history-seller-badge">ขายโดย: {sellerName}</span>}
                                                {isSalesMode && !isStoreSale(item) && item.username && <span>ลูกค้า {item.username}</span>}
                                                {isSalesMode && getPaymentMethod(item) && <span>{getPaymentMethod(item)}</span>}
                                                {!isCompactCustomerPage && <span>สินค้า {orderItems.length || 1} รายการ</span>}
                                                {!isCompactCustomerPage && <span>จำนวน {itemCount || Number(item.qty || item.quantity || 1)} ชิ้น</span>}
                                            </div>
                                        </div>
                                        {isCompactCustomerPage && item.tracking_no && (
                                            <div className="order-history-inline-meta is-side">
                                                <span>เลขพัสดุ</span>
                                                <strong>{item.tracking_no}</strong>
                                            </div>
                                        )}
                                        {isSalesMode && !isCompactCustomerPage && (
                                            <div className="order-history-price">
                                                <span>ยอดขาย</span>
                                                <strong>฿{formatMoney(finalPrice)}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {isSalesMode && (item.tracking_no || item.payment_status) && (
                                        <div className="order-history-meta">
                                            {item.tracking_no && (
                                                <div>
                                                    <span>เลขพัสดุ</span>
                                                    <strong>{item.tracking_no}</strong>
                                                </div>
                                            )}
                                            {item.payment_status && (
                                                <div>
                                                    <span>สถานะชำระเงิน</span>
                                                    <strong>{formatPaymentStatus(item.payment_status)}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(!isCompactCustomerPage || showExpandedDetails) && (
                                        <div className={isSalesMode ? 'order-history-sale-items' : 'order-history-item-list'}>
                                            {isSalesMode && <h4>รายการสินค้า</h4>}
                                            {orderItems.length === 0 && (
                                                <div className="order-history-item-empty">ไม่พบรายการสินค้าในออเดอร์นี้</div>
                                            )}
                                            {orderItems.map((orderItem, itemIndex) => {
                                                const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                                const unitPrice = Number(orderItem.price || 0);

                                                if (isSalesMode) {
                                                    return (
                                                        <div className="order-history-sale-item-row" key={`${item.id || index}-${orderItem.product_id || itemIndex}`}>
                                                            <div>
                                                                <strong>{orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'}</strong>
                                                            </div>
                                                            <span>x{qty}</span>
                                                            <span>฿{formatMoney(unitPrice)}</span>
                                                            <b>฿{formatMoney(unitPrice * qty)}</b>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div className="order-history-item-row" key={`${item.id || index}-${orderItem.product_id || itemIndex}`}>
                                                        <div className={`order-history-item-identity ${isCompactCustomerPage ? 'is-image-only' : ''}`}>
                                                            <div className="order-history-item-thumb">
                                                                {renderProductThumb(orderItem, (orderItem.product_name || orderItem.name || 'ส').charAt(0))}
                                                            </div>
                                                            {!isCompactCustomerPage && (
                                                                <div className="order-history-item-copy">
                                                                    <strong>{orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'}</strong>
                                                                    {orderItem.product_description && <small>{orderItem.product_description}</small>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="order-history-item-qty">
                                                            <span>จำนวน</span>
                                                            <strong>{qty} ชิ้น</strong>
                                                        </div>
                                                        <div className="order-history-item-unit">
                                                            <span>ราคาต่อชิ้น</span>
                                                            <strong>฿{formatMoney(unitPrice)}</strong>
                                                        </div>
                                                        <div className="order-history-item-total">
                                                            <span>รวม</span>
                                                            <b>฿{formatMoney(unitPrice * qty)}</b>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {showExpandedDetails && (
                                        <>
                                            {!isSalesMode && item.tracking_no && (
                                                <div className="order-history-meta">
                                                    <div>
                                                        <span>เลขพัสดุ</span>
                                                        <strong>{item.tracking_no}</strong>
                                                    </div>
                                                </div>
                                            )}

                                            {!isSalesMode && item.payment_status === 'รอตรวจสอบ' && (
                                                <div className="order-history-payment-alert is-warning">
                                                    ส่งหลักฐานการชำระเงินเรียบร้อย กรุณารอแอดมินตรวจสอบ ถ้าส่งรูปผิดให้ ยกเลิกสลิปเดิม ก่อนอัปโหลดใหม่
                                                </div>
                                            )}

                                            {!isSalesMode && REJECTED_PAYMENT_STATUSES.includes(item.payment_status) && (
                                                <div className="order-history-payment-alert is-danger">
                                                    หลักฐานถูกปฏิเสธ{item.review_note ? `: ${item.review_note}` : ''}
                                                </div>
                                            )}

                                            {!isSalesMode && hasSubmittedReceipt && (
                                                <div className="order-history-submitted-slip">
                                                    <div className="order-history-submitted-slip-info">
                                                        <span>สลิปที่ส่งไปแล้ว</span>
                                                        {item.receipt_file_name && <small>ไฟล์: {item.receipt_file_name}</small>}
                                                        {item.payment_date && <small>ส่งเมื่อ {formatDateTime(item.payment_date)}</small>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="order-history-slip-preview"
                                                        onClick={(event) => {
                                                            stopCardToggle(event);
                                                            setSlipOcrError('');
                                                            setSlipPreview({ src: resolveMediaUrl(item.receipt_image), orderId: item.id });
                                                        }}
                                                    >
                                                        <img src={resolveMediaUrl(item.receipt_image)} alt={`สลิปคำสั่งซื้อ ${item.id}`} />
                                                        <span>ดูรูปใหญ่</span>
                                                    </button>
                                                    {canCancelSubmittedReceipt && (
                                                        <button
                                                            type="button"
                                                            className="order-history-cancel-slip"
                                                            onClick={(event) => {
                                                                stopCardToggle(event);
                                                                cancelCurrentReceipt(item.id);
                                                            }}
                                                            disabled={cancellingReceiptOrderId === item.id}
                                                        >
                                                            {cancellingReceiptOrderId === item.id ? 'กำลังยกเลิกสลิป...' : 'ยกเลิกสลิปเดิม'}
                                                        </button>
                                                    )}
                                                    {isReceiptApproved && (
                                                        <small className="order-history-slip-note">แอดมินอนุมัติแล้ว ไม่สามารถยกเลิกหรือเปลี่ยนสลิปได้</small>
                                                    )}
                                                </div>
                                            )}

                                            {!canSendReceipt && uploadError.orderId === item.id && uploadError.message && (
                                                <div className="order-history-upload-error">{uploadError.message}</div>
                                            )}

                                            {canSendReceipt && (
                                                <div className="order-history-upload-panel">
                                                    <div className="order-history-bank-card">
                                                        <div>
                                                            <span>ชื่อบัญชี</span>
                                                            <strong>{BANK_ACCOUNT_NAME}</strong>
                                                        </div>
                                                        <div>
                                                            <span>ธนาคาร</span>
                                                            <strong>{BANK_NAME}</strong>
                                                        </div>
                                                        <div className="order-history-bank-account">
                                                            <span>เลขบัญชี</span>
                                                            <strong>{BANK_ACCOUNT}</strong>
                                                            <button type="button" onClick={(event) => {
                                                                stopCardToggle(event);
                                                                copyBankAccount();
                                                            }}>
                                                                {isAccountCopied ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <input
                                                        id={uploadInputId}
                                                        className="order-history-upload-input"
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/jpg,image/webp"
                                                        disabled={uploadingOrderId === item.id}
                                                        onClick={stopCardToggle}
                                                        onChange={(event) => {
                                                            handleReceiptChange(item.id, event.target.files?.[0]);
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                    {!receiptDraft ? (
                                                        <label className="order-history-upload-box" htmlFor={uploadInputId} onClick={stopCardToggle}>
                                                            <span className="order-history-upload-icon" aria-hidden="true">
                                                                <svg viewBox="0 0 24 24">
                                                                    <path d="M12 16V4" />
                                                                    <path d="m7 9 5-5 5 5" />
                                                                    <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
                                                                </svg>
                                                            </span>
                                                            <span>
                                                                <strong>อัปโหลดสลิปโอนเงิน</strong>
                                                                <small>รองรับไฟล์ JPG, JPEG, PNG, WEBP ขนาดไม่เกิน 5MB</small>
                                                            </span>
                                                        </label>
                                                    ) : (
                                                        <div className="order-history-receipt-preview">
                                                            <img src={receiptDraft.imageData} alt="ตัวอย่างสลิปโอนเงิน" />
                                                            <div className="order-history-receipt-file">
                                                                <span className="order-history-receipt-check" aria-hidden="true">✓</span>
                                                                <div>
                                                                    <strong>เลือกสลิปแล้ว</strong>
                                                                    <small>{receiptDraft.fileName}</small>
                                                                    <small>{formatFileSize(receiptDraft.fileSize)}</small>
                                                                </div>
                                                                <div className="order-history-receipt-actions">
                                                                    <label htmlFor={uploadInputId} onClick={stopCardToggle}>เปลี่ยนรูป</label>
                                                                    <button type="button" onClick={(event) => {
                                                                        stopCardToggle(event);
                                                                        removeReceiptDraft(item.id);
                                                                    }}>ลบรูป</button>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="order-history-submit-receipt"
                                                                onClick={(event) => {
                                                                    stopCardToggle(event);
                                                                    submitReceiptDraft(item.id);
                                                                }}
                                                                disabled={uploadingOrderId === item.id}
                                                            >
                                                                {uploadingOrderId === item.id ? 'กำลังส่งหลักฐาน...' : 'ส่งหลักฐานการชำระเงิน'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {uploadError.orderId === item.id && uploadError.message && (
                                                        <div className="order-history-upload-error">{uploadError.message}</div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="order-history-summary">
                                                <div>
                                                    <span>ยอดสินค้า</span>
                                                    <strong>฿{formatMoney(productTotal)}</strong>
                                                </div>
                                                <div>
                                                    <span>ค่าส่ง</span>
                                                    <strong>฿{formatMoney(shippingFee)}</strong>
                                                </div>
                                                <div>
                                                    <span>ส่วนลด</span>
                                                    <strong className="is-discount">-฿{formatMoney(discount)}</strong>
                                                </div>
                                                <div className="is-total">
                                                    <span>ยอดสุทธิ</span>
                                                    <strong>฿{formatMoney(finalPrice)}</strong>
                                                </div>
                                                {isSalesMode && (
                                                    <>
                                                        <div>
                                                            <span>รับเงิน</span>
                                                            <strong>฿{formatMoney(cashReceived)}</strong>
                                                        </div>
                                                        <div>
                                                            <span>เงินทอน</span>
                                                            <strong>฿{formatMoney(change)}</strong>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {isSalesMode && (
                                        <div className="order-history-actions">
                                            <button
                                                type="button"
                                                className="order-history-action primary"
                                                onClick={() => setReceiptOrder(receiptPayload)}
                                            >
                                                ใบรับ
                                            </button>
                                        </div>
                                    )}

                                    {!isSalesMode && (
                                        <div className="order-history-actions order-history-actions-customer">
                                            <button
                                                type="button"
                                                className="order-history-action secondary"
                                                onClick={() => openOrderDetail(item, orderKey)}
                                            >
                                                ดูรายละเอียด
                                            </button>
                                            {canCancel && (
                                                <button
                                                    type="button"
                                                    className="order-history-action danger"
                                                    onClick={() => onCancelOrder?.(item.id)}
                                                >
                                                    ยกเลิกคำสั่งซื้อ
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })
                    )}
                </div>

                {!isPageView && (
                    <footer className="order-history-footer">
                        <button type="button" onClick={onClose}>ปิดหน้าต่าง</button>
                    </footer>
                )}
            </section>

            {detailOrder && (() => {
                const orderItems = getOrderItems(detailOrder);
                const itemCount = orderItems.reduce((sum, orderItem) => sum + Number(orderItem.qty || orderItem.quantity || 0), 0);
                const productTotal = Number(detailOrder.total_price ?? orderItems.reduce((sum, orderItem) => {
                    const qty = Number(orderItem.qty || orderItem.quantity || 1);
                    const price = Number(orderItem.price || 0);
                    return sum + (qty * price);
                }, 0));
                const shippingFee = Number(detailOrder.shipping_fee || 0);
                const discount = Number(detailOrder.discount || 0);
                const finalPrice = Number(detailOrder.final_price ?? (productTotal + shippingFee - discount));
                const canCancel = canCancelOrder && cancelableStatuses.includes(detailOrder.status);
                const hasSubmittedReceipt = Boolean(detailOrder.receipt_image);
                const isReceiptWaitingReview = detailOrder.payment_status === 'รอตรวจสอบ';
                const isReceiptApproved = ['ชำระแล้ว', 'ชำระเงินแล้ว'].includes(detailOrder.payment_status);
                const isReceiptRejected = REJECTED_PAYMENT_STATUSES.includes(detailOrder.payment_status);
                const canSendReceipt = canUploadReceipt
                    && !isReceiptWaitingReview
                    && !isReceiptApproved
                    && (isReceiptRejected || reuploadPaymentStatuses.includes(detailOrder.payment_status) || ['รอชำระเงิน', 'รอจัดการ'].includes(detailOrder.status));
                const canCancelSubmittedReceipt = canCancelReceipt && isReceiptWaitingReview && hasSubmittedReceipt;
                const uploadInputId = `receipt-upload-detail-${detailOrder.id}`;
                const receiptDraft = receiptDrafts[detailOrder.id];

                return (
                    <div className="order-detail-popup-backdrop" role="presentation" onMouseDown={() => setDetailOrder(null)}>
                        <section
                            className="order-detail-popup"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="order-detail-popup-title"
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <header className="order-detail-popup-header">
                                <div>
                                    <span>คำสั่งซื้อ</span>
                                    <h2 id="order-detail-popup-title">#{detailOrder.id}</h2>
                                </div>
                                <strong>{formatPaymentStatus(detailOrder.payment_status || detailOrder.status || 'รอชำระเงิน')}</strong>
                                <button type="button" onClick={() => setDetailOrder(null)} aria-label="ปิดรายละเอียดคำสั่งซื้อ">×</button>
                            </header>

                            <div className="order-detail-popup-body">
                                {!!detailOrder.tracking_no && (
                                    <section className="order-detail-popup-section">
                                        <div className="order-detail-popup-meta">
                                            <div>
                                                <span>รหัสพัสดุ</span>
                                                <strong>{detailOrder.tracking_no}</strong>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                <section className="order-detail-popup-section">
                                    <div className="order-detail-popup-table">
                                        <div className="order-detail-popup-row is-head">
                                            <span>สินค้า</span>
                                            <span>จำนวน</span>
                                            <span>ราคาต่อชิ้น</span>
                                        </div>
                                        {orderItems.length ? orderItems.map((orderItem, itemIndex) => {
                                            const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                            const unitPrice = Number(orderItem.price || 0);
                                            return (
                                                    <div className="order-detail-popup-row" key={`${detailOrder.id}-${orderItem.product_id || itemIndex}`}>
                                                        <div className="order-detail-popup-item">
                                                            <div className="order-detail-popup-thumb">
                                                                {renderProductThumb(orderItem, (orderItem.product_name || orderItem.name || 'ส').charAt(0))}
                                                            </div>
                                                            <div className="order-detail-popup-copy">
                                                                <strong>{orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'}</strong>
                                                                {orderItem.product_description && <small>{orderItem.product_description}</small>}
                                                            </div>
                                                        </div>
                                                        <span>{qty} ชิ้น</span>
                                                        <span>฿{formatMoney(unitPrice)}</span>
                                                    </div>
                                            );
                                        }) : (
                                            <div className="order-detail-popup-empty">ไม่พบรายการสินค้าในคำสั่งซื้อนี้</div>
                                        )}
                                    </div>
                                    <div className="order-detail-popup-total">
                                        <span>รวม</span>
                                        <strong>สินค้า {orderItems.length || 0} รายการจำนวน {itemCount || 0} ชิ้น</strong>
                                        <b>฿{formatMoney(finalPrice)}</b>
                                    </div>
                                    {(shippingFee > 0 || discount > 0) && (
                                        <div className="order-detail-popup-breakdown">
                                            <span>ยอดสินค้า ฿{formatMoney(productTotal)}</span>
                                            <span>ค่าส่ง ฿{formatMoney(shippingFee)}</span>
                                            {discount > 0 && <span>ส่วนลด -฿{formatMoney(discount)}</span>}
                                        </div>
                                    )}
                                </section>

                                {!isReceiptApproved && (
                                    <section className="order-detail-popup-section">
                                        <div className="order-history-bank-card order-detail-bank-card">
                                            <div>
                                                <span>บัญชีบริษัท</span>
                                                <strong>{BANK_ACCOUNT_NAME}</strong>
                                            </div>
                                            <div>
                                                <span>ธนาคาร</span>
                                                <strong>{BANK_NAME}</strong>
                                            </div>
                                            <div className="order-history-bank-account">
                                                <span>เลขบัญชี</span>
                                                <strong>{BANK_ACCOUNT}</strong>
                                                <button type="button" onClick={copyBankAccount}>
                                                    {isAccountCopied ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {isReceiptWaitingReview && (
                                    <div className="order-history-payment-alert is-warning">
                                        ส่งหลักฐานการชำระเงินเรียบร้อย กรุณารอแอดมินตรวจสอบ
                                    </div>
                                )}

                                {isReceiptRejected && (
                                    <div className="order-history-payment-alert is-danger">
                                        หลักฐานถูกปฏิเสธ{detailOrder.review_note ? `: ${detailOrder.review_note}` : ''}
                                    </div>
                                )}

                                {hasSubmittedReceipt && (
                                    <div className="order-history-submitted-slip">
                                        <div className="order-history-submitted-slip-info">
                                            <span>สลิปที่ส่งไปแล้ว</span>
                                            {detailOrder.receipt_file_name && <small>ไฟล์: {detailOrder.receipt_file_name}</small>}
                                            {detailOrder.payment_date && <small>ส่งเมื่อ {formatDateTime(detailOrder.payment_date)}</small>}
                                        </div>
                                        <button
                                            type="button"
                                            className="order-history-slip-preview"
                                            onClick={() => {
                                                setSlipOcrError('');
                                                setSlipPreview({ src: resolveMediaUrl(detailOrder.receipt_image), orderId: detailOrder.id });
                                            }}
                                        >
                                            <img src={resolveMediaUrl(detailOrder.receipt_image)} alt={`สลิปคำสั่งซื้อ ${detailOrder.id}`} />
                                            <span>ดูรูปใหญ่</span>
                                        </button>
                                        {canCancelSubmittedReceipt && (
                                            <button
                                                type="button"
                                                className="order-history-cancel-slip"
                                                onClick={() => cancelCurrentReceipt(detailOrder.id)}
                                                disabled={cancellingReceiptOrderId === detailOrder.id}
                                            >
                                                {cancellingReceiptOrderId === detailOrder.id ? 'กำลังยกเลิกสลิป...' : 'ยกเลิกสลิปเดิม'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {canSendReceipt && (
                                    <section className="order-history-upload-panel order-detail-upload-panel">
                                        <input
                                            id={uploadInputId}
                                            className="order-history-upload-input"
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            disabled={uploadingOrderId === detailOrder.id}
                                            onChange={(event) => {
                                                handleReceiptChange(detailOrder.id, event.target.files?.[0]);
                                                event.target.value = '';
                                            }}
                                        />
                                        {!receiptDraft ? (
                                            <label className="order-history-upload-box" htmlFor={uploadInputId}>
                                                <span className="order-history-upload-icon" aria-hidden="true">
                                                    <svg viewBox="0 0 24 24">
                                                        <path d="M12 16V4" />
                                                        <path d="m7 9 5-5 5 5" />
                                                        <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" />
                                                    </svg>
                                                </span>
                                                <span>
                                                    <strong>อัปโหลดสลิปโอนเงิน</strong>
                                                    <small>รองรับไฟล์ JPG, JPEG, PNG, WEBP ขนาดไม่เกิน 5MB</small>
                                                </span>
                                            </label>
                                        ) : (
                                            <div className="order-history-receipt-preview">
                                                <img src={receiptDraft.imageData} alt="ตัวอย่างสลิปโอนเงิน" />
                                                <div className="order-history-receipt-file">
                                                    <span className="order-history-receipt-check" aria-hidden="true">✓</span>
                                                    <div>
                                                        <strong>เลือกสลิปแล้ว</strong>
                                                        <small>{receiptDraft.fileName}</small>
                                                        <small>{formatFileSize(receiptDraft.fileSize)}</small>
                                                    </div>
                                                    <div className="order-history-receipt-actions">
                                                        <label htmlFor={uploadInputId}>เปลี่ยนรูป</label>
                                                        <button type="button" onClick={() => removeReceiptDraft(detailOrder.id)}>ลบรูป</button>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="order-history-submit-receipt"
                                                    onClick={() => submitReceiptDraft(detailOrder.id)}
                                                    disabled={uploadingOrderId === detailOrder.id}
                                                >
                                                    {uploadingOrderId === detailOrder.id ? 'กำลังส่งหลักฐาน...' : 'ส่งหลักฐานการชำระเงิน'}
                                                </button>
                                            </div>
                                        )}
                                        {uploadError.orderId === detailOrder.id && uploadError.message && (
                                            <div className="order-history-upload-error">{uploadError.message}</div>
                                        )}
                                    </section>
                                )}

                                {canCancel && (
                                    <button
                                        type="button"
                                        className="order-history-cancel order-detail-cancel"
                                        onClick={() => {
                                            onCancelOrder?.(detailOrder.id);
                                            setDetailOrder(null);
                                        }}
                                    >
                                        ยกเลิกคำสั่งซื้อ
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>
                );
            })()}

            {slipPreview && (
                <div
                    className="order-slip-lightbox"
                    role="presentation"
                    onMouseDown={(event) => {
                        event.stopPropagation();
                        setSlipPreview(null);
                    }}
                >
                    <section
                        className="order-slip-lightbox-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="order-slip-lightbox-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span>PAYMENT SLIP</span>
                                <h2 id="order-slip-lightbox-title">สลิปคำสั่งซื้อ #{slipPreview.orderId}</h2>
                            </div>
                            <div className="order-slip-lightbox-actions">
                                <button
                                    type="button"
                                    className="order-slip-copy"
                                    onClick={copySlipText}
                                    disabled={slipOcrLoading}
                                >
                                    {slipOcrLoading ? 'กำลังอ่านข้อความ...' : 'คัดลอกข้อความจากภาพ'}
                                </button>
                                <button type="button" onClick={() => setSlipPreview(null)} aria-label="ปิดรูปสลิป">×</button>
                            </div>
                        </header>
                        <div className="order-slip-lightbox-body">
                            {slipOcrError && <div className="order-slip-lightbox-error">{slipOcrError}</div>}
                            <img src={slipPreview.src} alt={`สลิปคำสั่งซื้อ ${slipPreview.orderId}`} />
                        </div>
                    </section>
                </div>
            )}

            {receiptOrder && (() => {
                const receiptItems = getOrderItems(receiptOrder);
                const receiptTotal = Number(receiptOrder.final_price || receiptOrder.product_total || 0);
                const receiptItemCount = receiptItems.reduce((sum, orderItem) => sum + Number(orderItem.qty || orderItem.quantity || 1), 0);
                const { cashReceived, change } = getReceiptAmounts(receiptOrder, receiptTotal);

                return (
                    <div
                        className="sales-receipt-backdrop"
                        role="presentation"
                        onMouseDown={(event) => {
                            event.stopPropagation();
                            setReceiptOrder(null);
                        }}
                    >
                        <section
                            className="sales-receipt-dialog"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="sales-receipt-title"
                            onMouseDown={(event) => event.stopPropagation()}
                        >
                            <div className="sales-receipt-print">
                                <header>
                                    <span>SHOP LRU</span>
                                    <h2 id="sales-receipt-title">ใบเสร็จรับเงิน</h2>
                                    <p>เลขที่คำสั่งซื้อ #{receiptOrder.id}</p>
                                </header>

                                <div className="sales-receipt-meta">
                                    <span>วันที่/เวลา</span><strong>{formatDateTime(receiptOrder.sale_date_time || receiptOrder.created_at || receiptOrder.order_date)}</strong>
                                    <span>พนักงาน</span><strong>{receiptOrder.seller_name || getSellerName(receiptOrder)}</strong>
                                    <span>ชำระโดย</span><strong>{getPaymentMethod(receiptOrder)}</strong>
                                </div>

                                <div className="sales-receipt-items">
                                    <h3>รายการสินค้า</h3>
                                    {receiptItems.map((orderItem, itemIndex) => {
                                        const qty = Number(orderItem.qty || orderItem.quantity || 1);
                                        const unitPrice = Number(orderItem.price || 0);
                                        return (
                                            <div key={`receipt-${receiptOrder.id}-${orderItem.product_id || itemIndex}`}>
                                                <span>
                                                    <strong>{orderItem.product_name || orderItem.name || 'สินค้าแฟชั่น'}</strong>
                                                    <small>x{qty} @ ฿{formatMoney(unitPrice)}</small>
                                                </span>
                                                <b>฿{formatMoney(unitPrice * qty)}</b>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="sales-receipt-totals">
                                    <span>รวมจำนวนชิ้น</span><strong>{receiptItemCount} ชิ้น</strong>
                                    <span>ยอดรวม</span><strong>฿{formatMoney(receiptTotal)}</strong>
                                    <span>รับเงิน</span><strong>฿{formatMoney(cashReceived)}</strong>
                                    <span>เงินทอน</span><strong>฿{formatMoney(change)}</strong>
                                </div>
                            </div>

                            <div className="sales-receipt-actions">
                                <button type="button" className="is-secondary" onClick={() => setReceiptOrder(null)}>ปิด</button>
                                <button type="button" onClick={() => window.print()}>พิมพ์ใบเสร็จ</button>
                            </div>
                        </section>
                    </div>
                );
            })()}
        </div>
    );
}

export default OrderHistoryModal;
