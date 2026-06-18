import { useState } from 'react';
import { getAddressOptions } from '../utils/addressOptions';

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
    onSave,
    onClose,
}) {
    const [activeTab, setActiveTab] = useState('account');
    const [showAccountForm, setShowAccountForm] = useState(false);
    const [showAddressForm, setShowAddressForm] = useState(false);
    const subdistrictOptions = getAddressOptions(addresses, 'subdistrict');
    const districtOptions = getAddressOptions(addresses, 'district');
    const provinceOptions = getAddressOptions(addresses, 'province');
    const postalCodeOptions = getAddressOptions(addresses, 'postal_code');

    const handleNewAddress = () => {
        onNewAddress();
        setShowAddressForm(true);
    };

    const handleEditAddress = (address) => {
        onSelectAddress(address);
        setShowAddressForm(true);
    };

    return (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1500 }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '760px' }}>
                <div className="modal-content border-0 shadow-lg rounded-3">
                    <div className="modal-header bg-dark text-white py-3">
                        <h5 className="modal-title fw-bold">โปรไฟล์ของฉัน</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="auth-tabs mb-4" role="tablist" aria-label="เลือกเมนูโปรไฟล์">
                            <button type="button" className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}>
                                จัดการบัญชี
                            </button>
                            <button type="button" className={activeTab === 'address' ? 'active' : ''} onClick={() => setActiveTab('address')}>
                                ที่อยู่
                            </button>
                        </div>

                        {activeTab === 'account' ? (
                            <div>
                                <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                                    <small className="text-muted">บัญชีปัจจุบัน: {user?.full_name || user?.username}</small>
                                    {!showAccountForm && (
                                        <button type="button" className="btn btn-outline-dark fw-bold rounded-2 px-4" onClick={() => setShowAccountForm(true)}>
                                            แก้ไขบัญชี
                                        </button>
                                    )}
                                </div>

                                <form onSubmit={onSave}>
                                    <div className="row g-3">
                                        <div className="col-md-6 text-start">
                                            <label className="form-label fw-bold text-secondary small">ชื่อผู้ใช้</label>
                                            <input type="text" className="form-control px-3 py-2 rounded-2" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="form-label fw-bold text-secondary small">ชื่อ-นามสกุล</label>
                                            <input type="text" className="form-control px-3 py-2 rounded-2" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="form-label fw-bold text-secondary small">อีเมล</label>
                                            <input type="email" className="form-control px-3 py-2 rounded-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        <div className="col-md-6 text-start">
                                            <label className="form-label fw-bold text-secondary small">เบอร์โทร</label>
                                            <input type="tel" className="form-control px-3 py-2 rounded-2" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!showAccountForm} />
                                        </div>
                                        {showAccountForm && (
                                            <div className="col-12 text-start">
                                                <label className="form-label fw-bold text-secondary small">รหัสผ่านใหม่</label>
                                                <input type="password" className="form-control px-3 py-2 rounded-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ปล่อยว่างถ้าไม่ต้องการเปลี่ยน" />
                                            </div>
                                        )}
                                    </div>
                                    {showAccountForm && (
                                        <div className="d-flex gap-2 mt-3">
                                            <button type="button" className="btn btn-light border w-100 fw-bold py-2 rounded-2" onClick={() => setShowAccountForm(false)}>ยกเลิก</button>
                                            <button type="submit" className="btn btn-dark w-100 fw-bold py-2 rounded-2 shadow-sm">บันทึกบัญชี</button>
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
                                                <div className="list-group-item text-start" key={address.address_id}>
                                                    <div className="d-flex justify-content-between align-items-start gap-2">
                                                        <div>
                                                            <div className="fw-bold">{address.receiver_name}</div>
                                                            <small>{address.address_detail}</small>
                                                            {Number(address.is_default) === 1 && <span className="badge bg-success ms-2">หลัก</span>}
                                                        </div>
                                                        <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => handleEditAddress(address)}>
                                                            แก้ไข
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div className="col-md-7">
                                    {showAddressForm ? (
                                        <form onSubmit={onSaveAddress} className="row g-3 text-start">
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
                                                <label className="form-label fw-bold text-secondary small">ตำบล/แขวง</label>
                                                <input className="form-control" list="profile-subdistrict-options" value={addressForm.subdistrict} onChange={(e) => setAddressForm({ ...addressForm, subdistrict: e.target.value })} />
                                                <datalist id="profile-subdistrict-options">
                                                    {subdistrictOptions.map((value) => <option key={value} value={value} />)}
                                                </datalist>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">อำเภอ/เขต</label>
                                                <input className="form-control" list="profile-district-options" value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} />
                                                <datalist id="profile-district-options">
                                                    {districtOptions.map((value) => <option key={value} value={value} />)}
                                                </datalist>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">จังหวัด</label>
                                                <input className="form-control" list="profile-province-options" value={addressForm.province} onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })} />
                                                <datalist id="profile-province-options">
                                                    {provinceOptions.map((value) => <option key={value} value={value} />)}
                                                </datalist>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-bold text-secondary small">รหัสไปรษณีย์</label>
                                                <input className="form-control" list="profile-postal-code-options" value={addressForm.postal_code} onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })} />
                                                <datalist id="profile-postal-code-options">
                                                    {postalCodeOptions.map((value) => <option key={value} value={value} />)}
                                                </datalist>
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
