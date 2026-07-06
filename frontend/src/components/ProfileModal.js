import { useEffect, useMemo, useState } from 'react';
import { notify } from './AppNotification';

const emptyThaiAddressData = {
    provinces: [],
    districts: [],
    subDistricts: [],
};

const getPublicJsonPath = (fileName) => `${process.env.PUBLIC_URL || ''}/api-thai/json/${fileName}`;
const getName = (item) => item?.name_th || '';
const getZipCode = (item) => (item?.zip_code ? String(item.zip_code) : '');
const PHONE_REGEX = /^(?:0[689]\d{8}|\+66[689]\d{8})$/;
const cleanPhone = (value) => String(value || '').trim().replace(/[\s-]/g, '');

function ProfileModal({
    user,
    username,
    password,
    fullName,
    email,
    phone,
    setUsername,
    setPassword,
    setFullName,
    setEmail,
    setPhone,
    addresses,
    addressForm,
    setAddressForm,
    onSaveAddress,
    onSelectAddress,
    onNewAddress,
    onSetDefaultAddress,
    onDeleteAddress,
    onSave,
    onClose,
}) {
    const [activeTab, setActiveTab] = useState('account');
    const [showAccountForm, setShowAccountForm] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSavingAccount, setIsSavingAccount] = useState(false);
    const [accountNotice, setAccountNotice] = useState({ type: '', text: '' });
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [thaiAddressData, setThaiAddressData] = useState(emptyThaiAddressData);
    const [isThaiAddressLoading, setIsThaiAddressLoading] = useState(true);

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
        () => thaiAddressData.provinces.find((province) => getName(province) === addressForm.province),
        [addressForm.province, thaiAddressData.provinces]
    );

    const districtChoices = useMemo(
        () => selectedProvince ? thaiAddressData.districts.filter((district) => district.province_id === selectedProvince.id) : [],
        [selectedProvince, thaiAddressData.districts]
    );

    const selectedDistrict = useMemo(
        () => districtChoices.find((district) => getName(district) === addressForm.district),
        [addressForm.district, districtChoices]
    );

    const subDistrictChoices = useMemo(
        () => selectedDistrict ? thaiAddressData.subDistricts.filter((subDistrict) => subDistrict.district_id === selectedDistrict.id) : [],
        [selectedDistrict, thaiAddressData.subDistricts]
    );

    const postalCodeChoices = useMemo(() => {
        const postalCodes = subDistrictChoices.map(getZipCode).filter(Boolean);
        return [...new Set(postalCodes)];
    }, [subDistrictChoices]);

    const hasThaiAddressData = thaiAddressData.provinces.length > 0;

    const handleProvinceChange = (provinceName) => {
        setAddressForm({
            ...addressForm,
            province: provinceName,
            district: '',
            subdistrict: '',
            postal_code: '',
        });
    };

    const handleDistrictChange = (districtName) => {
        setAddressForm({
            ...addressForm,
            district: districtName,
            subdistrict: '',
            postal_code: '',
        });
    };

    const handleSubDistrictChange = (subDistrictName) => {
        const selectedSubDistrict = subDistrictChoices.find((subDistrict) => getName(subDistrict) === subDistrictName);
        setAddressForm({
            ...addressForm,
            subdistrict: subDistrictName,
            postal_code: getZipCode(selectedSubDistrict),
        });
    };

    const getAddressValidationMessage = () => {
        if (!addressForm.receiver_name.trim()) return 'กรุณากรอกชื่อผู้รับ';
        if (!addressForm.phone.trim()) return 'กรุณากรอกเบอร์โทรผู้รับ';
        if (!PHONE_REGEX.test(cleanPhone(addressForm.phone))) return 'รูปแบบเบอร์โทรผู้รับไม่ถูกต้อง';
        if (!addressForm.address_detail.trim()) return 'กรุณากรอกที่อยู่';
        if (!addressForm.province.trim()) return 'กรุณาเลือกจังหวัด';
        if (!addressForm.district.trim()) return 'กรุณาเลือกอำเภอ/เขต';
        if (!addressForm.subdistrict.trim()) return 'กรุณาเลือกตำบล/แขวง';
        if (!String(addressForm.postal_code || '').trim()) return 'กรุณาเลือกรหัสไปรษณีย์';
        if (!addressForm.address_type.trim()) return 'กรุณากรอกประเภทที่อยู่';
        if (hasThaiAddressData && !selectedProvince) return 'จังหวัดไม่ถูกต้อง';
        if (selectedProvince && !selectedDistrict) return 'อำเภอ/เขตไม่ตรงกับจังหวัด';
        if (selectedDistrict && !subDistrictChoices.some((subDistrict) => getName(subDistrict) === addressForm.subdistrict)) {
            return 'ตำบล/แขวงไม่ตรงกับอำเภอ/เขต';
        }
        if (postalCodeChoices.length > 0 && !postalCodeChoices.includes(String(addressForm.postal_code))) {
            return 'รหัสไปรษณีย์ไม่ตรงกับตำบล/แขวง';
        }
        return '';
    };

    const handleAddressSubmit = (event) => {
        const validationMessage = getAddressValidationMessage();
        if (validationMessage) {
            event.preventDefault();
            notify({ type: 'warning', title: 'ข้อมูลที่อยู่ยังไม่ครบ', message: validationMessage });
            return;
        }

        onSaveAddress(event);
    };

    const handleNewAddress = () => {
        onNewAddress();
        setShowAddressForm(true);
    };

    const handleEditAddress = (address) => {
        onSelectAddress(address);
        setShowAddressForm(true);
    };

    const displayName = user?.full_name || user?.username || 'ผู้ใช้งาน';
    const initials = displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase() || 'U';
    const accountStatus = Number(user?.status_user ?? 1);
    const statusDetails = accountStatus === 1
        ? { label: 'ใช้งาน', className: 'active' }
        : accountStatus === 2
            ? { label: 'รอการยืนยัน', className: 'pending' }
            : { label: 'ระงับการใช้งาน', className: 'suspended' };
    const roleLabel = user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก';

    const resetAccountForm = () => {
        setUsername(user?.username || '');
        setFullName(user?.full_name || user?.username || '');
        setEmail(user?.email || '');
        setPhone(user?.phone || '');
        setPassword('');
        setShowPassword(false);
        setAccountNotice({ type: '', text: '' });
    };

    const handleCancelAccount = () => {
        resetAccountForm();
        setShowAccountForm(false);
    };

    const handleAccountSubmit = async (event) => {
        event.preventDefault();
        setAccountNotice({ type: '', text: '' });

        if (!username.trim()) {
            setAccountNotice({ type: 'error', text: 'กรุณากรอกชื่อผู้ใช้' });
            return;
        }

        if (password && password.length < 8) {
            setAccountNotice({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
            return;
        }

        setIsSavingAccount(true);
        const result = await onSave();
        setIsSavingAccount(false);

        if (result?.success) {
            setPassword('');
            setShowPassword(false);
            setShowAccountForm(false);
            setAccountNotice({ type: 'success', text: result.message || 'บันทึกข้อมูลสำเร็จ' });
        } else {
            setAccountNotice({ type: 'error', text: result?.error || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' });
        }
    };

    return (
        <div className="modal fade show d-block profile-modal-backdrop" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <div className="modal-dialog modal-dialog-centered profile-modal-dialog">
                <div className="modal-content border-0 shadow-lg profile-modal-content">
                    <div className="modal-header profile-modal-header">
                        <div>
                            <span className="profile-modal-eyebrow">ACCOUNT SETTINGS</span>
                            <h5 id="profile-modal-title" className="modal-title">จัดการโปรไฟล์</h5>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose} aria-label="ปิดหน้าต่าง"></button>
                    </div>
                    <div className="modal-body profile-modal-body">
                        <section className="profile-identity" aria-label="ข้อมูลบัญชีผู้ใช้">
                            <div className="profile-avatar" aria-hidden="true">{initials}</div>
                            <h4>{displayName}</h4>
                            <p>@{user?.username || username}</p>
                            <div className="profile-badges">
                                <span className={`profile-status-badge ${statusDetails.className}`}>
                                    <span className="profile-status-dot"></span>
                                    {statusDetails.label}
                                </span>
                                <span className={`profile-role-badge ${user?.role === 'admin' ? 'admin' : ''}`}>
                                    {roleLabel}
                                </span>
                            </div>
                        </section>

                        <div className="auth-tabs profile-tabs" role="tablist" aria-label="เลือกเมนูโปรไฟล์">
                            <button type="button" className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}>
                                จัดการบัญชี
                            </button>
                            <button type="button" className={activeTab === 'address' ? 'active' : ''} onClick={() => setActiveTab('address')}>
                                ที่อยู่
                            </button>
                        </div>

                        {activeTab === 'account' ? (
                            <div className="profile-account-panel">
                                {accountNotice.text && (
                                    <div className={`profile-toast ${accountNotice.type}`} role={accountNotice.type === 'error' ? 'alert' : 'status'} aria-live="polite">
                                        <span className="profile-toast-icon" aria-hidden="true">
                                            {accountNotice.type === 'success' ? '✓' : '!'}
                                        </span>
                                        <span>{accountNotice.text}</span>
                                        <button type="button" onClick={() => setAccountNotice({ type: '', text: '' })} aria-label="ปิดข้อความแจ้งเตือน">×</button>
                                    </div>
                                )}

                                <div className="profile-section-heading">
                                    <div>
                                        <h6>ข้อมูลบัญชี</h6>
                                        <p>จัดการข้อมูลที่ใช้แสดงผลและเข้าสู่ระบบ</p>
                                    </div>
                                    {!showAccountForm && (
                                        <button type="button" className="profile-edit-button" onClick={() => {
                                            setAccountNotice({ type: '', text: '' });
                                            setShowAccountForm(true);
                                        }}>
                                            แก้ไขบัญชี
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={handleAccountSubmit}>
                                    <div className="row g-4">
                                        <div className="col-md-6 text-start">
                                            <label className="profile-form-label" htmlFor="profile-username">ชื่อผู้ใช้</label>
                                            <input id="profile-username" type="text" className="form-control profile-form-control" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="profile-form-label" htmlFor="profile-fullname">ชื่อ-นามสกุล</label>
                                            <input id="profile-fullname" type="text" className="form-control profile-form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="profile-form-label" htmlFor="profile-email">อีเมล</label>
                                            <input id="profile-email" type="email" className="form-control profile-form-control" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="profile-form-label" htmlFor="profile-phone">เบอร์โทร</label>
                                            <input id="profile-phone" type="tel" className="form-control profile-form-control" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        {showAccountForm && (
                                            <div className="col-12 text-start">
                                                <label className="profile-form-label" htmlFor="profile-password">รหัสผ่านใหม่</label>
                                                <div className="profile-password-field">
                                                    <input
                                                        id="profile-password"
                                                        type={showPassword ? 'text' : 'password'}
                                                        className="form-control profile-form-control"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="ปล่อยว่างถ้าไม่ต้องการเปลี่ยน"
                                                        autoComplete="new-password"
                                                        aria-describedby="profile-password-help"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="profile-password-toggle"
                                                        onClick={() => setShowPassword((visible) => !visible)}
                                                        aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                                        aria-pressed={showPassword}
                                                    >
                                                        {showPassword ? (
                                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.5 9 5.5a15.4 15.4 0 01-2.1 2.7M6.6 6.7C4.3 8.2 3 10 3 10s3.5 5.5 9 5.5c1.2 0 2.3-.3 3.3-.7" /></svg>
                                                        ) : (
                                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.5" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                                <small id="profile-password-help" className={`profile-password-help ${password && password.length < 8 ? 'invalid' : ''}`}>
                                                    รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                    {showAccountForm && (
                                        <div className="profile-form-actions">
                                            <button type="button" className="profile-secondary-button" onClick={handleCancelAccount} disabled={isSavingAccount}>ยกเลิก</button>
                                            <button type="submit" className="profile-primary-button" disabled={isSavingAccount}>
                                                {isSavingAccount ? <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> : null}
                                                {isSavingAccount ? 'กำลังบันทึก...' : 'บันทึกบัญชี'}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            </div>
                        ) : (
                            <div className="row g-4">
                                <div className="col-md-5">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <strong>ที่อยู่ของฉัน</strong>
                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleNewAddress}>เพิ่มใหม่</button>
                                    </div>
                                    <div className="list-group">
                                        {addresses.length === 0 ? (
                                            <div className="list-group-item text-muted small">ยังไม่มีที่อยู่</div>
                                        ) : (
                                            addresses.map((address) => (
                                                <div className="list-group-item text-start p-0" key={address.address_id}>
                                                    <div className="d-flex justify-content-between align-items-stretch">
                                                        <button
                                                            type="button"
                                                            className="btn text-start border-0 rounded-0 flex-grow-1 p-3"
                                                            onClick={() => handleEditAddress(address)}
                                                        >
                                                            <div className="fw-bold">{address.receiver_name}</div>
                                                            <small>{address.address_detail}</small>
                                                            {Number(address.is_default) === 1 && <span className="badge bg-success ms-2">หลัก</span>}
                                                        </button>
                                                        <div className="d-flex align-items-center p-3 ps-2">
                                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDeleteAddress(address)}>
                                                                ลบ
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className="col-md-7">
                                    {showAddressForm ? (
                                        <form onSubmit={handleAddressSubmit} className="row g-3 text-start">
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">ชื่อผู้รับ</label>
                                                <input className="form-control" value={addressForm.receiver_name} onChange={(e) => setAddressForm({ ...addressForm, receiver_name: e.target.value })} required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">เบอร์โทร</label>
                                                <input className="form-control" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label fw-bold text-secondary small">ที่อยู่</label>
                                                <textarea className="form-control" rows="3" value={addressForm.address_detail} onChange={(e) => setAddressForm({ ...addressForm, address_detail: e.target.value })} required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">จังหวัด</label>
                                                <select
                                                    className="form-select"
                                                    value={addressForm.province}
                                                    onChange={(e) => handleProvinceChange(e.target.value)}
                                                    disabled={isThaiAddressLoading || !hasThaiAddressData}
                                                    required
                                                >
                                                    <option value="">{isThaiAddressLoading ? 'กำลังโหลดจังหวัด' : 'เลือกจังหวัด'}</option>
                                                    {addressForm.province && !thaiAddressData.provinces.some((province) => getName(province) === addressForm.province) && (
                                                        <option value={addressForm.province}>{addressForm.province}</option>
                                                    )}
                                                    {thaiAddressData.provinces.map((province) => (
                                                        <option key={province.id} value={getName(province)}>{getName(province)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">อำเภอ/เขต</label>
                                                <select
                                                    className="form-select"
                                                    value={addressForm.district}
                                                    onChange={(e) => handleDistrictChange(e.target.value)}
                                                    disabled={!selectedProvince}
                                                    required
                                                >
                                                    <option value="">{selectedProvince ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}</option>
                                                    {addressForm.district && !districtChoices.some((district) => getName(district) === addressForm.district) && (
                                                        <option value={addressForm.district}>{addressForm.district}</option>
                                                    )}
                                                    {districtChoices.map((district) => (
                                                        <option key={district.id} value={getName(district)}>{getName(district)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">ตำบล/แขวง</label>
                                                <select
                                                    className="form-select"
                                                    value={addressForm.subdistrict}
                                                    onChange={(e) => handleSubDistrictChange(e.target.value)}
                                                    disabled={!selectedDistrict}
                                                    required
                                                >
                                                    <option value="">{selectedDistrict ? 'เลือกตำบล/แขวง' : 'เลือกอำเภอ/เขตก่อน'}</option>
                                                    {addressForm.subdistrict && !subDistrictChoices.some((subDistrict) => getName(subDistrict) === addressForm.subdistrict) && (
                                                        <option value={addressForm.subdistrict}>{addressForm.subdistrict}</option>
                                                    )}
                                                    {subDistrictChoices.map((subDistrict) => (
                                                        <option key={subDistrict.id} value={getName(subDistrict)}>{getName(subDistrict)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">รหัสไปรษณีย์</label>
                                                <select
                                                    className="form-select"
                                                    value={addressForm.postal_code}
                                                    onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                                                    disabled={!selectedDistrict}
                                                    required
                                                >
                                                    <option value="">{selectedDistrict ? 'เลือกรหัสไปรษณีย์' : 'เลือกอำเภอ/เขตก่อน'}</option>
                                                    {addressForm.postal_code && !postalCodeChoices.includes(String(addressForm.postal_code)) && (
                                                        <option value={addressForm.postal_code}>{addressForm.postal_code}</option>
                                                    )}
                                                    {postalCodeChoices.map((postalCode) => (
                                                        <option key={postalCode} value={postalCode}>{postalCode}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">ประเภทที่อยู่</label>
                                                <input className="form-control" value={addressForm.address_type} onChange={(e) => setAddressForm({ ...addressForm, address_type: e.target.value })} />
                                            </div>
                                            <div className="col-md-6 d-flex align-items-end">
                                                <label className="form-check fw-bold text-secondary small mb-2">
                                                    <input
                                                        className="form-check-input me-2"
                                                        type="checkbox"
                                                        checked={Number(addressForm.is_default) === 1}
                                                        onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked ? 1 : 0 })}
                                                    />
                                                    ตั้งเป็นที่อยู่หลัก
                                                </label>
                                            </div>
                                            <div className="col-12 d-flex gap-2">
                                                {addressForm.address_id && Number(addressForm.is_default) !== 1 && (
                                                    <button type="button" className="btn btn-outline-success w-100 fw-bold" onClick={() => onSetDefaultAddress(addressForm)}>
                                                        ใช้เป็นที่อยู่หลัก
                                                    </button>
                                                )}
                                                <button type="button" className="btn btn-light border w-100 fw-bold" onClick={() => setShowAddressForm(false)}>
                                                    ยกเลิก
                                                </button>
                                                <button type="submit" className="btn btn-dark w-100 fw-bold">
                                                    บันทึกที่อยู่
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="border rounded-3 p-4 text-muted text-center">
                                            กดเพิ่มใหม่หรือแก้ไขเพื่อกรอกข้อมูลที่อยู่
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProfileModal;
