import { getAddressOptions } from '../utils/addressOptions';

function CheckoutModal({ total, shippingInfo, setShippingInfo, addresses = [], onClose, onConfirm }) {
    const selectedAddressId = shippingInfo.address_id || '';
    const subdistrictOptions = getAddressOptions(addresses, 'subdistrict');
    const districtOptions = getAddressOptions(addresses, 'district');
    const provinceOptions = getAddressOptions(addresses, 'province');
    const postalCodeOptions = getAddressOptions(addresses, 'postal_code');
    const shippingFee = shippingInfo.shipping_method === 'รับหน้าร้าน' ? 0 : 50;
    const discount = Math.min(Math.max(Number(shippingInfo.discount) || 0, 0), total + shippingFee);
    const finalTotal = Math.max(total + shippingFee - discount, 0);
    const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const handleSelectAddress = (event) => {
        const addressId = Number(event.target.value) || null;
        const address = addresses.find((item) => item.address_id === addressId);

        if (!address) {
            setShippingInfo({ ...shippingInfo, address_id: null });
            return;
        }

        setShippingInfo({
            ...shippingInfo,
            address_id: address.address_id,
            address: address.address_detail || '',
            phone: address.phone || '',
            subdistrict: address.subdistrict || '',
            district: address.district || '',
            province: address.province || '',
            postal_code: address.postal_code || '',
        });
    };

    const handleReceiptChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('กรุณาเลือกไฟล์รูปภาพสลิปเท่านั้น');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setShippingInfo({
                ...shippingInfo,
                receipt_image_data: reader.result,
                receipt_file_name: file.name,
            });
        };
        reader.readAsDataURL(file);
    };

    const removeReceipt = () => {
        setShippingInfo({
            ...shippingInfo,
            receipt_image_data: '',
            receipt_file_name: '',
        });
    };

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0 bg-light rounded-top-4 p-4 pb-2">
                        <h5 className="modal-title fw-bold text-dark">ข้อมูลการจัดส่งและชำระเงิน</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4 pt-2">
                        <div className="bg-success-subtle p-3 rounded-3 mb-4 text-center" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                            <small className="d-block mb-1 text-secondary">ยอดสุทธิที่ต้องชำระ</small>
                            <h3 className="fw-bold m-0">฿{formatMoney(finalTotal)}</h3>
                        </div>
                        <div className="border rounded-3 p-3 mb-4 bg-light">
                            <small className="fw-bold text-secondary d-block mb-2">ช่องทางการโอนเงิน</small>
                            <p className="m-0 small text-dark"><strong>ธนาคารกสิกรไทย:</strong> 123-4-56789-0</p>
                            <p className="m-0 small text-dark"><strong>ชื่อบัญชี:</strong> บริษัท เสื้อผ้าแฟชั่น จำกัด</p>
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold text-secondary">รูปแบบการรับสินค้า</label>
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    className={`btn flex-grow-1 py-2 rounded-3 fw-bold border ${shippingInfo.shipping_method === 'ส่งสินค้า' ? 'btn-success border-success' : 'btn-light bg-white text-muted'}`}
                                    onClick={() => setShippingInfo({ ...shippingInfo, shipping_method: 'ส่งสินค้า', shipping_fee: 50 })}
                                >
                                    ส่งสินค้าตามที่อยู่ +฿50
                                </button>
                                <button
                                    type="button"
                                    className={`btn flex-grow-1 py-2 rounded-3 fw-bold border ${shippingInfo.shipping_method === 'รับหน้าร้าน' ? 'btn-success border-success' : 'btn-light bg-white text-muted'}`}
                                    onClick={() => setShippingInfo({ ...shippingInfo, shipping_method: 'รับหน้าร้าน', shipping_fee: 0 })}
                                >
                                    รับเองที่หน้าร้าน
                                </button>
                            </div>
                        </div>
                        <div className="mb-3">
                            {addresses.length > 0 && (
                                <>
                                    <label className="form-label small fw-bold text-secondary">เลือกที่อยู่ที่บันทึกไว้</label>
                                    <select className="form-select rounded-3 mb-3" value={selectedAddressId} onChange={handleSelectAddress}>
                                        <option value="">กรอกที่อยู่ใหม่</option>
                                        {addresses.map((address) => (
                                            <option key={address.address_id} value={address.address_id}>
                                                {Number(address.is_default) === 1 ? '[หลัก] ' : ''}{address.receiver_name} - {address.address_detail}
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                            <label className="form-label small fw-bold text-secondary">ที่อยู่จัดส่งสินค้า</label>
                            <textarea className="form-control rounded-3 border-light-subtle shadow-sm" rows="3" value={shippingInfo.address} onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })} />
                        </div>
                        <div className="row g-2 mb-3">
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-secondary">ตำบล/แขวง</label>
                                <input type="text" list="checkout-subdistrict-options" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" value={shippingInfo.subdistrict} onChange={(e) => setShippingInfo({ ...shippingInfo, subdistrict: e.target.value })} />
                                <datalist id="checkout-subdistrict-options">
                                    {subdistrictOptions.map((value) => <option key={value} value={value} />)}
                                </datalist>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-secondary">อำเภอ/เขต</label>
                                <input type="text" list="checkout-district-options" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" value={shippingInfo.district} onChange={(e) => setShippingInfo({ ...shippingInfo, district: e.target.value })} />
                                <datalist id="checkout-district-options">
                                    {districtOptions.map((value) => <option key={value} value={value} />)}
                                </datalist>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-secondary">จังหวัด</label>
                                <input type="text" list="checkout-province-options" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" value={shippingInfo.province} onChange={(e) => setShippingInfo({ ...shippingInfo, province: e.target.value })} />
                                <datalist id="checkout-province-options">
                                    {provinceOptions.map((value) => <option key={value} value={value} />)}
                                </datalist>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-secondary">รหัสไปรษณีย์</label>
                                <input type="text" list="checkout-postal-code-options" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" value={shippingInfo.postal_code} onChange={(e) => setShippingInfo({ ...shippingInfo, postal_code: e.target.value })} />
                                <datalist id="checkout-postal-code-options">
                                    {postalCodeOptions.map((value) => <option key={value} value={value} />)}
                                </datalist>
                            </div>
                        </div>
                        <div className="mb-2">
                            <label className="form-label small fw-bold text-secondary">เบอร์โทรศัพท์ที่ติดต่อได้</label>
                            <input type="text" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" value={shippingInfo.phone} onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })} />
                        </div>
                        <div className="mt-3">
                            <label className="form-label small fw-bold text-secondary">อัปโหลดสลิปโอนเงิน</label>
                            <input type="file" className="form-control rounded-3 border-light-subtle py-2 shadow-sm" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" onChange={handleReceiptChange} />
                            {shippingInfo.receipt_image_data && (
                                <div className="mt-3 border rounded-3 p-2 bg-white">
                                    <img src={shippingInfo.receipt_image_data} alt="ตัวอย่างสลิปโอนเงิน" style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }} />
                                    <div className="d-flex justify-content-between align-items-center mt-2">
                                        <small className="text-muted">{shippingInfo.receipt_file_name}</small>
                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeReceipt}>ลบสลิป</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="border rounded-3 p-3 mt-4 bg-white">
                            <label className="form-label small fw-bold text-secondary">ส่วนลด (บาท)</label>
                            <input
                                type="number"
                                min="0"
                                max={total + shippingFee}
                                className="form-control rounded-3 border-light-subtle py-2 shadow-sm mb-3"
                                value={shippingInfo.discount}
                                onChange={(e) => setShippingInfo({ ...shippingInfo, discount: e.target.value })}
                            />
                            <div className="d-flex justify-content-between small mb-2">
                                <span className="text-muted">ยอดสินค้า</span>
                                <strong>฿{formatMoney(total)}</strong>
                            </div>
                            <div className="d-flex justify-content-between small mb-2">
                                <span className="text-muted">ค่าส่ง</span>
                                <strong>฿{formatMoney(shippingFee)}</strong>
                            </div>
                            <div className="d-flex justify-content-between small mb-2">
                                <span className="text-muted">ส่วนลด</span>
                                <strong className="text-danger">-฿{formatMoney(discount)}</strong>
                            </div>
                            <div className="d-flex justify-content-between border-top pt-2">
                                <span className="fw-bold">ยอดสุทธิ</span>
                                <strong className="text-success">฿{formatMoney(finalTotal)}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer border-0 p-4 pt-0 d-flex gap-2">
                        <button className="btn btn-light rounded-pill px-4 py-2 fw-medium flex-grow-1" onClick={onClose}>ย้อนกลับ</button>
                        <button className="btn btn-primary w-100 fw-bold py-2" onClick={onConfirm}>ยืนยันชำระเงิน</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CheckoutModal;
