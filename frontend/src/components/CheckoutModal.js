import { useEffect, useMemo, useRef, useState } from 'react';
import { notify } from './AppNotification';

const BANK_ACCOUNT = '123-4-56789-0';
const BANK_ACCOUNT_DIGITS = '1234567890';
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ACCEPTED_RECEIPT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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
const PHONE_REGEX = /^(?:0[689]\d{8}|\+66[689]\d{8})$/;
const cleanPhone = (value) => String(value || '').trim().replace(/[\s-]/g, '');
const formatAddressLine = (address) => [
    address?.address_detail,
    address?.subdistrict ? `ต.${address.subdistrict}` : '',
    address?.district ? `อ.${address.district}` : '',
    address?.province ? `จ.${address.province}` : '',
    address?.postal_code,
].filter(Boolean).join(' ');

const formatFileSize = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(2)} MB`;

const formatAddressOption = (address) => {
    const prefix = Number(address.is_default) === 1 ? '[หลัก] ' : '';
    const receiverName = address.receiver_name || '-';
    const phone = address.phone || '-';
    const addressLine = formatAddressLine(address) || '-';

    return `${prefix}${receiverName} | ${phone} | ${addressLine}`;
};

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
    const fields = [
        '000201',
        '010212',
        `29${String(merchantInfo.length).padStart(2, '0')}${merchantInfo}`,
        '5303764',
        `54${amount.toFixed(2).length.toString().padStart(2, '0')}${amount.toFixed(2)}`,
        '5802TH',
        '6304',
    ].join('');

    return `${fields}${crc16(fields)}`;
};

function CheckoutModal({ total, shippingInfo, setShippingInfo, addresses = [], onClose, onConfirm, onSaveNewAddress }) {
    const selectedAddressId = shippingInfo.address_id || '';
    const [isAddingAddress, setIsAddingAddress] = useState(false);
    const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
    const [newAddress, setNewAddress] = useState(emptyNewAddress);
    const [isSavingAddress, setIsSavingAddress] = useState(false);
    const [thaiAddressData, setThaiAddressData] = useState(emptyThaiAddressData);
    const [isThaiAddressLoading, setIsThaiAddressLoading] = useState(true);
    const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
    const [receiptError, setReceiptError] = useState('');
    const [validationError, setValidationError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccountCopied, setIsAccountCopied] = useState(false);
    const receiptInputRef = useRef(null);
    const shippingFee = shippingInfo.shipping_method === 'รับหน้าร้าน' ? 0 : 50;
    const finalTotal = total + shippingFee;
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
    const promptPayPayload = useMemo(
        () => createPromptPayPayload(BANK_ACCOUNT_DIGITS, finalTotal),
        [finalTotal]
    );
    const qrCodeUrl = `https://quickchart.io/qr?size=220&margin=1&ecLevel=M&text=${encodeURIComponent(promptPayPayload)}`;

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

    const getNewAddressValidationMessage = () => {
        if (!newAddress.receiver_name.trim()) return 'กรุณากรอกชื่อผู้รับ';
        if (!newAddress.phone.trim()) return 'กรุณากรอกเบอร์โทรผู้รับ';
        if (!PHONE_REGEX.test(cleanPhone(newAddress.phone))) return 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง';
        if (!newAddress.address_detail.trim()) return 'กรุณากรอกที่อยู่';
        if (!newAddress.province) return 'กรุณาเลือกจังหวัด';
        if (!newAddress.district) return 'กรุณาเลือกอำเภอ/เขต';
        if (!newAddress.subdistrict) return 'กรุณาเลือกตำบล/แขวง';
        if (!newAddress.postal_code) return 'กรุณาเลือกรหัสไปรษณีย์';
        if (!newAddress.address_type.trim()) return 'กรุณากรอกประเภทที่อยู่';
        if (thaiAddressData.provinces.length > 0 && !selectedProvince) return 'จังหวัดไม่ถูกต้อง';
        if (selectedProvince && !selectedDistrict) return 'อำเภอ/เขตไม่ตรงกับจังหวัด';
        if (selectedDistrict && !subDistrictChoices.some((subDistrict) => getName(subDistrict) === newAddress.subdistrict)) {
            return 'ตำบล/แขวงไม่ตรงกับอำเภอ/เขต';
        }
        if (postalCodeChoices.length > 0 && !postalCodeChoices.includes(String(newAddress.postal_code))) {
            return 'รหัสไปรษณีย์ไม่ตรงกับตำบล/แขวง';
        }
        return '';
    };

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
        const validationMessage = getNewAddressValidationMessage();
        if (validationMessage) {
            notify({ type: 'warning', title: 'ข้อมูลที่อยู่ยังไม่ครบ', message: validationMessage });
            return;
        }

        try {
            setIsSavingAddress(true);
            await onSaveNewAddress(newAddress);
            setIsAddingAddress(false);
            setNewAddress(emptyNewAddress);
        } catch (err) {
            notify({ type: 'error', title: 'บันทึกที่อยู่ไม่สำเร็จ', message: err.response?.data?.error || 'บันทึกที่อยู่ไม่สำเร็จ' });
        } finally {
            setIsSavingAddress(false);
        }
    };

    const processReceiptFile = (file) => {
        if (!file) return;

        if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
            setReceiptError('รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP เท่านั้น');
            return;
        }

        if (file.size > MAX_RECEIPT_SIZE) {
            setReceiptError('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
            return;
        }

        setReceiptError('');
        setValidationError('');
        const reader = new FileReader();
        reader.onload = () => {
            setShippingInfo((current) => ({
                ...current,
                receipt_image_data: reader.result,
                receipt_file_name: file.name,
                receipt_file_size: file.size,
            }));
        };
        reader.onerror = () => setReceiptError('ไม่สามารถอ่านไฟล์นี้ได้ กรุณาลองใหม่');
        reader.readAsDataURL(file);
    };

    const handleReceiptChange = (event) => {
        processReceiptFile(event.target.files?.[0]);
        event.target.value = '';
    };

    const handleReceiptDrop = (event) => {
        event.preventDefault();
        setIsDraggingReceipt(false);
        processReceiptFile(event.dataTransfer.files?.[0]);
    };

    const removeReceipt = () => {
        setShippingInfo((current) => ({
            ...current,
            receipt_image_data: '',
            receipt_file_name: '',
            receipt_file_size: 0,
        }));
        setReceiptError('');
        if (receiptInputRef.current) receiptInputRef.current.value = '';
    };

    const copyBankAccount = async () => {
        try {
            await navigator.clipboard.writeText(BANK_ACCOUNT_DIGITS);
            setIsAccountCopied(true);
            window.setTimeout(() => setIsAccountCopied(false), 1800);
        } catch {
            setValidationError(`คัดลอกอัตโนมัติไม่สำเร็จ กรุณาคัดลอกเลขบัญชี ${BANK_ACCOUNT}`);
        }
    };

    const handleConfirm = async () => {
        setValidationError('');

        if (!shippingInfo.shipping_method) {
            setValidationError('กรุณาเลือกรูปแบบการรับสินค้า');
            return;
        }
        if (shippingInfo.shipping_method === 'ส่งสินค้า' && !displayAddress) {
            setValidationError('กรุณาเลือกหรือเพิ่มที่อยู่จัดส่งให้ครบถ้วน');
            return;
        }
        if (!PHONE_REGEX.test(cleanPhone(shippingInfo.phone))) {
            setValidationError('กรุณาตรวจสอบเบอร์โทรศัพท์ให้ถูกต้อง');
            return;
        }
        try {
            setIsSubmitting(true);
            await onConfirm();
            removeReceipt();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal d-block checkout-modal-backdrop" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered checkout-modal-dialog">
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
                        <div className="checkout-payment-card mb-4">
                            <div className="checkout-bank-details">
                                <small className="fw-bold text-secondary d-block mb-2">ช่องทางการโอนเงิน</small>
                                <p className="m-0 small text-dark"><strong>ธนาคารกสิกรไทย</strong></p>
                                <div className="checkout-account-row">
                                    <span>{BANK_ACCOUNT}</span>
                                    <button type="button" onClick={copyBankAccount}>
                                        {isAccountCopied ? 'คัดลอกแล้ว ✓' : 'คัดลอกเลขบัญชี'}
                                    </button>
                                </div>
                                <p className="m-0 small text-dark"><strong>ชื่อบัญชี:</strong> บริษัท เสื้อผ้าแฟชั่น จำกัด</p>
                                <span className="checkout-payment-hint">โอนตามยอดสุทธิและแนบสลิปด้านล่าง</span>
                            </div>
                            <div className="checkout-qr">
                                <img src={qrCodeUrl} alt={`QR Code ชำระเงินจำนวน ${formatMoney(finalTotal)} บาท`} />
                                <strong>สแกนชำระ ฿{formatMoney(finalTotal)}</strong>
                                <small>PromptPay QR</small>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold text-secondary">รูปแบบการรับสินค้า</label>
                            <div className="checkout-shipping-options">
                                <button
                                    type="button"
                                    className={`checkout-shipping-option ${shippingInfo.shipping_method === 'ส่งสินค้า' ? 'is-active' : ''}`}
                                    onClick={() => setShippingInfo({ ...shippingInfo, shipping_method: 'ส่งสินค้า', shipping_fee: 50, discount: 0 })}
                                >
                                    <span className="checkout-option-check" aria-hidden="true">✓</span>
                                    <span><strong>ส่งสินค้าตามที่อยู่</strong><small>จัดส่งถึงบ้าน +฿50</small></span>
                                </button>
                                <button
                                    type="button"
                                    className={`checkout-shipping-option ${shippingInfo.shipping_method === 'รับหน้าร้าน' ? 'is-active' : ''}`}
                                    onClick={() => setShippingInfo({ ...shippingInfo, shipping_method: 'รับหน้าร้าน', shipping_fee: 0, discount: 0 })}
                                >
                                    <span className="checkout-option-check" aria-hidden="true">✓</span>
                                    <span><strong>รับเองที่หน้าร้าน</strong><small>ไม่มีค่าจัดส่ง</small></span>
                                </button>
                            </div>
                        </div>
                        {shippingInfo.shipping_method === 'ส่งสินค้า' && <div className="mb-3">
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
                        </div>}
                        <div className="mt-3">
                            <label className="form-label small fw-bold text-secondary">อัปโหลดสลิปโอนเงิน</label>
                            <input
                                ref={receiptInputRef}
                                type="file"
                                className="checkout-receipt-input"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleReceiptChange}
                            />
                            {!shippingInfo.receipt_image_data ? (
                                <button
                                    type="button"
                                    className={`checkout-upload-zone ${isDraggingReceipt ? 'is-dragging' : ''} ${receiptError ? 'has-error' : ''}`}
                                    onClick={() => receiptInputRef.current?.click()}
                                    onDragEnter={(event) => { event.preventDefault(); setIsDraggingReceipt(true); }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDragLeave={(event) => {
                                        if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingReceipt(false);
                                    }}
                                    onDrop={handleReceiptDrop}
                                >
                                    <span className="checkout-upload-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4" /></svg>
                                    </span>
                                    <strong>{isDraggingReceipt ? 'วางไฟล์เพื่ออัปโหลด' : 'ลากสลิปมาวางที่นี่'}</strong>
                                    <span>หรือคลิกเพื่อเลือกไฟล์จากอุปกรณ์</span>
                                    <small>JPG, JPEG, PNG, WEBP ขนาดไม่เกิน 5 MB</small>
                                </button>
                            ) : (
                                <div className="checkout-receipt-preview">
                                    <img src={shippingInfo.receipt_image_data} alt="ตัวอย่างสลิปโอนเงิน" />
                                    <div className="checkout-file-status">
                                        <span className="checkout-file-success" aria-hidden="true">✓</span>
                                        <div>
                                            <strong>อัปโหลดสลิปเรียบร้อยแล้ว</strong>
                                            <small>{shippingInfo.receipt_file_name}</small>
                                            {shippingInfo.receipt_file_size > 0 && <small>{formatFileSize(shippingInfo.receipt_file_size)}</small>}
                                        </div>
                                        <div className="checkout-file-actions">
                                            <button type="button" onClick={() => receiptInputRef.current?.click()}>เปลี่ยนรูป</button>
                                            <button type="button" className="is-danger" onClick={removeReceipt}>ลบรูป</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {receiptError && <div className="checkout-field-error">{receiptError}</div>}
                            {!shippingInfo.receipt_image_data && !receiptError && (
                                <div className="checkout-receipt-later-note">
                                    สามารถสร้างออเดอร์ก่อน แล้วอัปโหลดสลิปจากประวัติคำสั่งซื้อภายหลังได้
                                </div>
                            )}
                        </div>
                        <div className="border rounded-3 p-3 mt-4 bg-white">
                            <div className="d-flex justify-content-between small mb-2">
                                <span className="text-muted">ยอดสินค้า</span>
                                <strong>฿{formatMoney(total)}</strong>
                            </div>
                            <div className="d-flex justify-content-between small mb-2">
                                <span className="text-muted">ค่าส่ง</span>
                                <strong>฿{formatMoney(shippingFee)}</strong>
                            </div>
                            <div className="d-flex justify-content-between border-top pt-2">
                                <span className="fw-bold">ยอดสุทธิ</span>
                                <strong className="text-success">฿{formatMoney(finalTotal)}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer border-0 p-4 pt-0 checkout-modal-footer">
                        {validationError && (
                            <div className="checkout-validation-alert" role="alert">
                                <span aria-hidden="true">!</span>{validationError}
                            </div>
                        )}
                        <div className="d-flex gap-2 w-100">
                            <button className="btn btn-light rounded-pill px-4 py-2 fw-medium flex-grow-1" onClick={onClose} disabled={isSubmitting}>ย้อนกลับ</button>
                            <button className="btn btn-primary w-100 fw-bold py-2 checkout-confirm-button" onClick={handleConfirm} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <><span className="checkout-spinner" aria-hidden="true" />กำลังส่งข้อมูล...</>
                                ) : shippingInfo.receipt_image_data ? 'ส่งหลักฐานการชำระเงิน' : 'สร้างออเดอร์และชำระภายหลัง'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CheckoutModal;
