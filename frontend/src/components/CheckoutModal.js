import { useEffect, useMemo, useState } from 'react';

const emptyThaiAddressData = {
    provinces: [],
    districts: [],
    subDistricts: [],
};

const emptyNewAddress = {
    receiver_name: '',
    phone: '',
    address_detail: '',
    province: '',
    district: '',
    subdistrict: '',
    postal_code: '',
    address_type: 'บ้าน',
    is_default: 0,
};

const getPublicJsonPath = (fileName) => `${process.env.PUBLIC_URL || ''}/api-thai/json/${fileName}`;
const getName = (item) => item?.name_th || '';
const getZipCode = (item) => (item?.zip_code ? String(item.zip_code) : '');
const formatAddressLine = (address) => [
    address?.address_detail,
    address?.subdistrict ? `ต.${address.subdistrict}` : '',
    address?.district ? `อ.${address.district}` : '',
    address?.province ? `จ.${address.province}` : '',
    address?.postal_code,
].filter(Boolean).join(' ');

const formatAddressOption = (address) => {
    const prefix = Number(address.is_default) === 1 ? '[หลัก] ' : '';
    const receiverName = address.receiver_name || '-';
    const phone = address.phone || '-';
    const addressLine = formatAddressLine(address) || '-';

    return `${prefix}${receiverName} | ${phone} | ${addressLine}`;
};

function CheckoutModal({ total, shippingInfo, setShippingInfo, addresses = [], onClose, onConfirm, onSaveNewAddress }) {
    const selectedAddressId = shippingInfo.address_id || '';
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
    const [newAddress, setNewAddress] = useState(emptyNewAddress);
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [thaiAddressData, setThaiAddressData] = useState(emptyThaiAddressData);
    const [isThaiAddressLoading, setIsThaiAddressLoading] = useState(true);
    const shippingFee = shippingInfo.shipping_method === 'รับหน้าร้าน' ? 0 : 50;
    const discount = Math.min(Math.max(Number(shippingInfo.discount) || 0, 0), total + shippingFee);
    const finalTotal = Math.max(total + shippingFee - discount, 0);
    const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const selectedAddress = addresses.find((item) => item.address_id === Number(selectedAddressId));
    const displayReceiverName = shippingInfo.receiver_name || selectedAddress?.receiver_name || '';
    const displayPhone = shippingInfo.phone || selectedAddress?.phone || '';
    const displayAddress = formatAddressLine({
        address_detail: shippingInfo.address,
        subdistrict: shippingInfo.subdistrict,
        district: shippingInfo.district,
        province: shippingInfo.province,
        postal_code: shippingInfo.postal_code,
    });

    useEffect(() => {
        let isMounted = true;

        Promise.all([
            fetch(getPublicJsonPath('provinces.json')).then((response) => response.json()),
            fetch(getPublicJsonPath('districts.json')).then((response) => response.json()),
            fetch(getPublicJsonPath('sub_districts.json')).then((response) => response.json()),
        ])
            .then(([provinces, districts, subDistricts]) => {
                if (!isMounted) return;
                setThaiAddressData({
                    provinces: provinces.filter((province) => !province.deleted_at),
                    districts: districts.filter((district) => !district.deleted_at),
                    subDistricts: subDistricts.filter((subDistrict) => !subDistrict.deleted_at),
                });
            })
            .catch(() => {
                if (isMounted) setThaiAddressData(emptyThaiAddressData);
            })
            .finally(() => {
                if (isMounted) setIsThaiAddressLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const selectedProvince = useMemo(
        () => thaiAddressData.provinces.find((province) => getName(province) === newAddress.province),
        [newAddress.province, thaiAddressData.provinces]
    );

    const districtChoices = useMemo(
        () => selectedProvince ? thaiAddressData.districts.filter((district) => district.province_id === selectedProvince.id) : [],
        [selectedProvince, thaiAddressData.districts]
    );

    const selectedDistrict = useMemo(
        () => districtChoices.find((district) => getName(district) === newAddress.district),
        [newAddress.district, districtChoices]
    );

    const subDistrictChoices = useMemo(
        () => selectedDistrict ? thaiAddressData.subDistricts.filter((subDistrict) => subDistrict.district_id === selectedDistrict.id) : [],
        [selectedDistrict, thaiAddressData.subDistricts]
    );

    const postalCodeChoices = useMemo(() => {
        const postalCodes = subDistrictChoices.map(getZipCode).filter(Boolean);
        return [...new Set(postalCodes)];
    }, [subDistrictChoices]);

    const handleNewProvinceChange = (provinceName) => {
        setNewAddress({
            ...newAddress,
            province: provinceName,
            district: '',
            subdistrict: '',
            postal_code: '',
        });
    };

    const handleNewDistrictChange = (districtName) => {
        setNewAddress({
            ...newAddress,
            district: districtName,
            subdistrict: '',
            postal_code: '',
        });
    };

    const handleNewSubDistrictChange = (subDistrictName) => {
        const selectedSubDistrict = subDistrictChoices.find((subDistrict) => getName(subDistrict) === subDistrictName);
        setNewAddress({
            ...newAddress,
            subdistrict: subDistrictName,
            postal_code: getZipCode(selectedSubDistrict),
        });
    };

    const handleChooseAddress = (address) => {
        setIsAddressDropdownOpen(false);
        setIsAddingAddress(false);
        setShippingInfo({
            ...shippingInfo,
            address_id: address.address_id,
            receiver_name: address.receiver_name || '',
            address: address.address_detail || '',
            phone: address.phone || '',
            subdistrict: address.subdistrict || '',
            district: address.district || '',
            province: address.province || '',
            postal_code: address.postal_code || '',
        });
    };

    const handleStartAddAddress = () => {
        setIsAddressDropdownOpen(false);
        setIsAddingAddress(true);
        setNewAddress({
            ...emptyNewAddress,
            is_default: addresses.length === 0 ? 1 : 0,
        });
    };

    const handleSaveNewAddress = async () => {
        if (!newAddress.receiver_name.trim() || !newAddress.address_detail.trim()) {
            alert('กรุณากรอกชื่อผู้รับและที่อยู่');
            return;
        }

        if (!newAddress.phone.trim()) {
            alert('กรุณากรอกเบอร์โทรศัพท์');
            return;
        }

        if (!newAddress.province || !newAddress.district || !newAddress.subdistrict || !newAddress.postal_code) {
            alert('กรุณาเลือกจังหวัด อำเภอ ตำบล และรหัสไปรษณีย์');
            return;
        }

        try {
            setIsSavingAddress(true);
            await onSaveNewAddress(newAddress);
            setIsAddingAddress(false);
            setNewAddress(emptyNewAddress);
        } catch (err) {
            alert(err.response?.data?.error || 'บันทึกที่อยู่ไม่สำเร็จ');
        } finally {
            setIsSavingAddress(false);
        }
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
                            <label className="form-label small fw-bold text-secondary">ที่อยู่จัดส่งสินค้า</label>
                            <div className="position-relative mb-3">
                                <button
                                    type="button"
                                    className="btn bg-white border rounded-3 p-3 shadow-sm w-100 text-start"
                                    onClick={() => setIsAddressDropdownOpen(!isAddressDropdownOpen)}
                                    aria-expanded={isAddressDropdownOpen}
                                >
                                    <div>
                                        <div>
                                            {displayReceiverName || displayPhone || displayAddress ? (
                                                <>
                                                    {displayReceiverName && <div className="fs-5 fw-semibold text-dark">{displayReceiverName}</div>}
                                                    {displayPhone && <div className="fs-5 text-dark mt-1">{displayPhone}</div>}
                                                    {displayAddress && <div className="text-secondary mt-3 lh-lg">{displayAddress}</div>}
                                                </>
                                            ) : (
                                                <div className="text-secondary fw-bold py-2">เลือกที่อยู่ที่บันทึกไว้</div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                                {isAddressDropdownOpen && (
                                    <div className="position-absolute start-0 end-0 mt-2 bg-white border rounded-3 shadow-lg overflow-hidden" style={{ zIndex: 1080, maxHeight: 320, overflowY: 'auto' }}>
                                        {addresses.length === 0 ? (
                                            <div className="px-3 py-3 text-secondary small">ยังไม่มีที่อยู่ที่บันทึกไว้</div>
                                        ) : (
                                            addresses.map((address) => {
                                                const addressLine = formatAddressLine(address);
                                                const isSelected = Number(address.address_id) === Number(selectedAddressId);

                                                return (
                                                    <button
                                                        type="button"
                                                        className={`btn w-100 text-start rounded-0 border-0 border-bottom px-3 py-3 ${isSelected ? 'bg-primary text-white' : 'bg-white'}`}
                                                        key={address.address_id}
                                                        onClick={() => handleChooseAddress(address)}
                                                        title={formatAddressOption(address)}
                                                    >
                                                        <div className="fw-bold">
                                                            {Number(address.is_default) === 1 ? '[หลัก] ' : ''}{address.receiver_name || '-'}
                                                        </div>
                                                        <div className={isSelected ? 'text-white mt-1' : 'text-dark mt-1'}>{address.phone || '-'}</div>
                                                        <div className={isSelected ? 'text-white-50 mt-2 lh-sm' : 'text-secondary mt-2 lh-sm'}>
                                                            {addressLine || '-'}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                        <button
                                            type="button"
                                            className="btn w-100 text-start rounded-0 border-0 px-3 py-3 fw-bold text-primary bg-white"
                                            onClick={handleStartAddAddress}
                                        >
                                            + เพิ่มที่อยู่ใหม่
                                        </button>
                                    </div>
                                )}
                            </div>
                            {!isAddingAddress && !(displayReceiverName || displayPhone || displayAddress) && (
                                <div className="text-secondary small mb-3">
                                    กรุณาเลือกที่อยู่ที่บันทึกไว้ หรือเพิ่มที่อยู่ใหม่
                                </div>
                            )}
                            {isAddingAddress && (
                                <div className="bg-white border rounded-3 p-3 mb-3 shadow-sm">
                                    <div className="row g-2">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">ชื่อผู้รับ</label>
                                            <input className="form-control rounded-3 border-light-subtle py-2" value={newAddress.receiver_name} onChange={(e) => setNewAddress({ ...newAddress, receiver_name: e.target.value })} />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">เบอร์โทร</label>
                                            <input className="form-control rounded-3 border-light-subtle py-2" value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small fw-bold text-secondary">รายละเอียดที่อยู่</label>
                                            <textarea className="form-control rounded-3 border-light-subtle" rows="2" value={newAddress.address_detail} onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })} />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">จังหวัด</label>
                                            <select className="form-select rounded-3 border-light-subtle py-2" value={newAddress.province} onChange={(e) => handleNewProvinceChange(e.target.value)} disabled={isThaiAddressLoading || thaiAddressData.provinces.length === 0}>
                                                <option value="">{isThaiAddressLoading ? 'กำลังโหลดจังหวัด' : 'เลือกจังหวัด'}</option>
                                                {thaiAddressData.provinces.map((province) => (
                                                    <option key={province.id} value={getName(province)}>{getName(province)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">อำเภอ/เขต</label>
                                            <select className="form-select rounded-3 border-light-subtle py-2" value={newAddress.district} onChange={(e) => handleNewDistrictChange(e.target.value)} disabled={!selectedProvince}>
                                                <option value="">{selectedProvince ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
                                                {districtChoices.map((district) => (
                                                    <option key={district.id} value={getName(district)}>{getName(district)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">ตำบล/แขวง</label>
                                            <select className="form-select rounded-3 border-light-subtle py-2" value={newAddress.subdistrict} onChange={(e) => handleNewSubDistrictChange(e.target.value)} disabled={!selectedDistrict}>
                                                <option value="">{selectedDistrict ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอ/เขตก่อน'}</option>
                                                {subDistrictChoices.map((subDistrict) => (
                                                    <option key={subDistrict.id} value={getName(subDistrict)}>{getName(subDistrict)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-secondary">รหัสไปรษณีย์</label>
                                            <select className="form-select rounded-3 border-light-subtle py-2" value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} disabled={!selectedDistrict}>
                                                <option value="">{selectedDistrict ? 'เลือกรหัสไปรษณีย์' : 'เลือกอำเภอ/เขตก่อน'}</option>
                                                {postalCodeChoices.map((postalCode) => (
                                                    <option key={postalCode} value={postalCode}>{postalCode}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-check fw-bold text-secondary small mt-2">
                                                <input className="form-check-input me-2" type="checkbox" checked={Number(newAddress.is_default) === 1} onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked ? 1 : 0 })} />
                                                ตั้งเป็นที่อยู่หลัก
                                            </label>
                                        </div>
                                        <div className="col-12 d-flex gap-2 mt-2">
                                            <button type="button" className="btn btn-light border w-100 fw-bold" onClick={() => setIsAddingAddress(false)} disabled={isSavingAddress}>ยกเลิก</button>
                                            <button type="button" className="btn btn-dark w-100 fw-bold" onClick={handleSaveNewAddress} disabled={isSavingAddress}>
                                                {isSavingAddress ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
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
