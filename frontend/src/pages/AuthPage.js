import { useRef, useState } from 'react';
import { requestPasswordReset, resetPasswordWithCode, verifyPasswordResetCode } from '../api/authApi';

const EMPTY_FORGOT_FORM = {
    email: '',
    code: '',
    password: '',
    confirmPassword: '',
};
const EMPTY_RESET_CODE_DIGITS = ['', '', '', '', '', ''];
const PRIVACY_NOTICE_SECTIONS = [
    {
        title: 'ผู้ควบคุมข้อมูลส่วนบุคคล',
        text: 'มหาวิทยาลัยราชภัฏเลย เลขที่ 234 ถนนเลย-เชียงคาน ตำบลเมือง อำเภอเมืองเลย จังหวัดเลย 42000 โทรศัพท์ 042-835224-8 เว็บไซต์ www.lru.ac.th',
    },
    {
        title: 'ข้อมูลที่จำเป็นต่อการสมัครและสั่งซื้อ',
        text: 'ระบบเก็บเฉพาะข้อมูลส่วนบุคคลที่จำเป็น เช่น ชื่อผู้ใช้ ชื่อ-นามสกุล อีเมล เบอร์โทรศัพท์ ที่อยู่จัดส่ง รายการสั่งซื้อ และรหัสผ่านที่จัดเก็บเป็นแฮชอย่างปลอดภัย',
    },
    {
        title: 'วัตถุประสงค์การใช้ข้อมูล',
        text: 'ใช้ข้อมูลเพื่อสมัครบัญชี ยืนยันตัวตน เข้าสู่ระบบ ติดต่อผู้ใช้ จัดส่งสินค้า และให้บริการช่วยเหลือลูกค้าเท่านั้น',
    },
    {
        title: 'ความปลอดภัยและการเปิดเผยข้อมูล',
        text: 'ระบบควรใช้งานผ่าน HTTPS จำกัดสิทธิ์การเข้าถึงข้อมูล และไม่เปิดเผยข้อมูลส่วนบุคคล ยกเว้นผู้ให้บริการขนส่ง หน้าที่ตามกฎหมาย หรือได้รับความยินยอมจากผู้ใช้',
    },
    {
        title: 'สิทธิของเจ้าของข้อมูล',
        text: 'เจ้าของข้อมูลมีสิทธิเข้าถึง ขอสำเนา แก้ไข ลบหรือทำลาย ระงับการใช้ คัดค้านการประมวลผล และขอโอนย้ายข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
    },
];

function AuthPage({
    isRegisterView,
    setIsRegisterView,
    loginForm,
    setLoginForm,
    rememberLogin,
    setRememberLogin,
    registerForm,
    setRegisterForm,
    loginError,
    isLoginLoading,
    registerMsg,
    onLogin,
    onRegister,
}) {
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotStep, setForgotStep] = useState('request');
    const [forgotForm, setForgotForm] = useState(EMPTY_FORGOT_FORM);
    const [forgotCodeDigits, setForgotCodeDigits] = useState(EMPTY_RESET_CODE_DIGITS);
    const [forgotMsg, setForgotMsg] = useState({ type: '', text: '' });
    const [isForgotLoading, setIsForgotLoading] = useState(false);
    const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
    const [hasScrolledPrivacyNotice, setHasScrolledPrivacyNotice] = useState(false);
    const [consentNotice, setConsentNotice] = useState('');
    const resetCodeInputRefs = useRef([]);
    const forgotCode = forgotCodeDigits.join('');

    const switchToLogin = () => {
        setIsRegisterView(false);
    };

    const switchToRegister = () => {
        setIsRegisterView(true);
    };

    const closeForgotPassword = () => {
        setShowForgotPassword(false);
        setForgotStep('request');
        setForgotForm(EMPTY_FORGOT_FORM);
        setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
        setForgotMsg({ type: '', text: '' });
        setIsForgotLoading(false);
    };

    const openForgotPassword = () => {
        setForgotForm(EMPTY_FORGOT_FORM);
        setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
        setForgotStep('request');
        setForgotMsg({ type: '', text: '' });
        setShowForgotPassword(true);
    };

    const openPrivacyNotice = () => {
        setShowPrivacyNotice(true);
        setHasScrolledPrivacyNotice(false);
    };

    const acknowledgePrivacyNotice = () => {
        setRegisterForm({
            ...registerForm,
            privacyNoticeAcknowledged: true,
        });
        setConsentNotice('');
        setShowPrivacyNotice(false);
    };

    const handlePrivacyScroll = (event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 4) {
            setHasScrolledPrivacyNotice(true);
        }
    };

    const requestPrivacyBeforeConsent = () => {
        if (!registerForm.privacyNoticeAcknowledged) {
            setConsentNotice('กรุณาอ่าน Privacy Notice ก่อน');
        }
    };

    const handleConsentChange = (event) => {
        if (!registerForm.privacyNoticeAcknowledged) {
            setConsentNotice('กรุณาอ่าน Privacy Notice ก่อน');
            return;
        }

        setConsentNotice('');
        setRegisterForm({ ...registerForm, consentAnalytics: event.target.checked });
    };

    const getForgotError = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

    const handleRequestResetCode = async (event) => {
        event.preventDefault();
        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await requestPasswordReset({
                email: forgotForm.email.trim(),
            });
            const devCodeText = data.dev_code ? ` รหัสทดสอบ: ${data.dev_code}` : '';
            setForgotMsg({ type: 'success', text: `${data.message || 'ส่งรหัสยืนยันแล้ว'}${devCodeText}` });
            setForgotCodeDigits(EMPTY_RESET_CODE_DIGITS);
            setForgotForm((currentForm) => ({ ...currentForm, code: '' }));
            setForgotStep('verify');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'ส่งรหัสยืนยันไม่สำเร็จ') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    const handleVerifyResetCode = async (event) => {
        event.preventDefault();
        if (forgotCode.length !== 6) {
            setForgotMsg({ type: 'error', text: 'กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก' });
            const firstEmptyIndex = forgotCodeDigits.findIndex((digit) => !digit);
            resetCodeInputRefs.current[firstEmptyIndex === -1 ? 5 : firstEmptyIndex]?.focus();
            return;
        }

        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await verifyPasswordResetCode({
                email: forgotForm.email.trim(),
                code: forgotCode,
            });
            setForgotMsg({ type: 'success', text: data.message || 'ยืนยันรหัสสำเร็จ' });
            setForgotStep('reset');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    const setResetCodeAtIndex = (index, value) => {
        const cleanValue = value.replace(/\D/g, '').slice(0, 6);
        if (cleanValue.length > 1) {
            const nextDigits = [...forgotCodeDigits];
            cleanValue.split('').forEach((digit, offset) => {
                const nextIndex = index + offset;
                if (nextIndex < 6) nextDigits[nextIndex] = digit;
            });
            const nextCode = nextDigits.join('').slice(0, 6);
            setForgotCodeDigits(nextDigits);
            setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
            setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));
            resetCodeInputRefs.current[Math.min(index + cleanValue.length, 5)]?.focus();
            return;
        }

        const digit = cleanValue;
        const nextDigits = [...forgotCodeDigits];
        nextDigits[index] = digit;
        const nextCode = nextDigits.join('').slice(0, 6);

        setForgotCodeDigits(nextDigits);
        setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
        setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));

        if (digit && index < 5) {
            resetCodeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleResetCodePaste = (event, index = 0) => {
        event.preventDefault();
        const pastedCode = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pastedCode) return;

        const nextDigits = [...forgotCodeDigits];
        pastedCode.split('').forEach((digit, offset) => {
            const nextIndex = index + offset;
            if (nextIndex < 6) nextDigits[nextIndex] = digit;
        });

        const nextCode = nextDigits.join('').slice(0, 6);
        setForgotCodeDigits(nextDigits);
        setForgotForm((currentForm) => ({ ...currentForm, code: nextCode }));
        setForgotMsg((message) => (message.type === 'error' ? { type: '', text: '' } : message));
        resetCodeInputRefs.current[Math.min(index + pastedCode.length, 5)]?.focus();
    };

    const handleResetCodeKeyDown = (event, index) => {
        if (event.key === 'Backspace' && !forgotCodeDigits[index] && index > 0) {
            resetCodeInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            resetCodeInputRefs.current[index - 1]?.focus();
        }
        if (event.key === 'ArrowRight' && index < 5) {
            event.preventDefault();
            resetCodeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleCompleteReset = async (event) => {
        event.preventDefault();
        if (forgotForm.password !== forgotForm.confirmPassword) {
            setForgotMsg({ type: 'error', text: 'กรุณายืนยันรหัสผ่านใหม่ให้ตรงกัน' });
            return;
        }

        setIsForgotLoading(true);
        setForgotMsg({ type: '', text: '' });

        try {
            const { data } = await resetPasswordWithCode({
                email: forgotForm.email.trim(),
                code: forgotCode,
                password: forgotForm.password,
            });
            setLoginForm({ ...loginForm, password: '' });
            setForgotMsg({ type: 'success', text: data.message || 'ตั้งรหัสผ่านใหม่สำเร็จ' });
            setForgotStep('done');
        } catch (err) {
            setForgotMsg({ type: 'error', text: getForgotError(err, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ') });
        } finally {
            setIsForgotLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-shell">
                <div className="auth-visual">
                    <div className="auth-visual-top">
                        <div className="auth-brand-mark" aria-hidden="true">CS</div>
                        <span>Clothing Store</span>
                    </div>
                    <div className="auth-hero-copy">
                        <p className="auth-kicker">Clothing Store</p>
                        <h1>แฟชั่นที่เลือกง่าย จัดการร้านได้ครบ</h1>
                        <p className="auth-hero-description">
                            เลือกช้อปเสื้อผ้าดีไซน์ทันสมัย พร้อมระบบสั่งซื้อที่รวดเร็วและติดตามสถานะได้ในที่เดียว
                        </p>
                        <div className="auth-benefits" aria-label="จุดเด่นของร้านค้า">
                            <div><span aria-hidden="true">✓</span><strong>สินค้าคัดสรร</strong><small>สไตล์ร่วมสมัย อัปเดตคอลเลกชันเสมอ</small></div>
                            <div><span aria-hidden="true">✓</span><strong>ชำระเงินสะดวก</strong><small>ขั้นตอนสั่งซื้อชัดเจนและปลอดภัย</small></div>
                            <div><span aria-hidden="true">✓</span><strong>ติดตามคำสั่งซื้อ</strong><small>ตรวจสอบสถานะได้จากบัญชีของคุณ</small></div>
                        </div>
                    </div>
                    <div className="auth-preview">
                        <div className="auth-preview-row">
                            <span>New collection</span>
                            <strong>2026</strong>
                        </div>
                        <div className="auth-preview-card">
                            <div className="auth-preview-image auth-preview-image-one" />
                            <div>
                                <span>Minimal Linen Shirt</span>
                                <strong>฿690</strong>
                            </div>
                        </div>
                        <div className="auth-preview-card">
                            <div className="auth-preview-image auth-preview-image-two" />
                            <div>
                                <span>Daily Smart Pants</span>
                                <strong>฿890</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="auth-panel">
                    <div className="auth-panel-header">
                        <p>{isRegisterView ? 'เริ่มต้นใช้งาน' : 'ยินดีต้อนรับกลับ'}</p>
                        <h2>{isRegisterView ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h2>
                        <span>{isRegisterView ? 'สร้างบัญชีเพื่อเริ่มต้นช้อปสินค้า' : 'กรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบอย่างรวดเร็ว'}</span>
                    </div>

                    <div className="auth-tabs" role="tablist" aria-label="เลือกหน้าฟอร์ม">
                        <button
                            type="button"
                            role="tab"
                            className={!isRegisterView ? 'active' : ''}
                            onClick={switchToLogin}
                            aria-selected={!isRegisterView}
                        >
                            เข้าสู่ระบบ
                        </button>
                        <button
                            type="button"
                            role="tab"
                            className={isRegisterView ? 'active' : ''}
                            onClick={switchToRegister}
                            aria-selected={isRegisterView}
                        >
                            สมัครสมาชิก
                        </button>
                    </div>

                    {isRegisterView ? (
                        <form className="auth-form" onSubmit={onRegister}>
                            {registerMsg.text && (
                                <div className={`auth-alert ${registerMsg.type === 'success' ? 'success' : 'error'}`}>
                                    {registerMsg.text}
                                </div>
                            )}

                            <label>
                                ชื่อผู้ใช้
                                <input
                                    type="text"
                                    placeholder="ตั้งชื่อผู้ใช้"
                                    value={registerForm.username}
                                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                ชื่อ-นามสกุล
                                <input
                                    type="text"
                                    placeholder="กรอกชื่อสำหรับติดต่อ"
                                    value={registerForm.full_name}
                                    onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                อีเมล
                                <input
                                    type="email"
                                    placeholder="เช่น name@example.com"
                                    value={registerForm.email}
                                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                เบอร์โทร
                                <input
                                    type="tel"
                                    placeholder="เบอร์โทรสำหรับติดต่อ"
                                    value={registerForm.phone}
                                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                รหัสผ่าน
                                <input
                                    type="password"
                                    placeholder="ตั้งรหัสผ่าน"
                                    value={registerForm.password}
                                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                    minLength="8"
                                    required
                                />
                            </label>

                            <label>
                                ยืนยันรหัสผ่าน
                                <input
                                    type="password"
                                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                                    value={registerForm.confirmPassword}
                                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                                    minLength="8"
                                    required
                                />
                            </label>

                            <button
                                type="button"
                                className={`auth-privacy-open ${registerForm.privacyNoticeAcknowledged ? 'accepted' : ''}`}
                                onClick={openPrivacyNotice}
                            >
                                {registerForm.privacyNoticeAcknowledged ? 'อ่าน Privacy Notice แล้ว' : 'อ่าน Privacy Notice'}
                            </button>

                            <section className="auth-consent-box" aria-labelledby="consent-analytics-title">
                                <label
                                    className={`auth-consent-row ${!registerForm.privacyNoticeAcknowledged ? 'disabled' : ''}`}
                                    onClick={requestPrivacyBeforeConsent}
                                >
                                    <input
                                        type="checkbox"
                                        checked={registerForm.consentAnalytics}
                                        disabled={!registerForm.privacyNoticeAcknowledged}
                                        onChange={handleConsentChange}
                                    />
                                    <span>
                                        <strong id="consent-analytics-title">ยินยอมการประมวลผลข้อมูลส่วนบุคคล</strong>
                                    </span>
                                </label>
                                {consentNotice && <small className="auth-consent-warning">{consentNotice}</small>}
                            </section>

                            <button type="submit" className="auth-submit">สร้างบัญชี</button>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={onLogin}>
                            {loginError && <div className="auth-alert error">{loginError}</div>}

                            <label htmlFor="login-username">
                                ชื่อผู้ใช้หรืออีเมล
                                <input
                                    id="login-username"
                                    type="text"
                                    placeholder="กรอกชื่อผู้ใช้หรืออีเมล"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                    autoComplete="username"
                                    required
                                />
                            </label>

                            <label htmlFor="login-password">
                                รหัสผ่าน
                                <div className="auth-password-field">
                                    <input
                                        id="login-password"
                                        type={showLoginPassword ? 'text' : 'password'}
                                        placeholder="กรอกรหัสผ่าน"
                                        value={loginForm.password}
                                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="auth-password-toggle"
                                        onClick={() => setShowLoginPassword((visible) => !visible)}
                                        aria-label={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                        aria-pressed={showLoginPassword}
                                    >
                                        {showLoginPassword ? (
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.5 9 5.5a15.4 15.4 0 01-2.1 2.7M6.6 6.7C4.3 8.2 3 10 3 10s3.5 5.5 9 5.5c1.2 0 2.3-.3 3.3-.7" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.5" /></svg>
                                        )}
                                    </button>
                                </div>
                            </label>

                            <div className="auth-login-options">
                                <label className="auth-remember">
                                    <input
                                        type="checkbox"
                                        checked={rememberLogin}
                                        onChange={(e) => setRememberLogin(e.target.checked)}
                                    />
                                    <span>จดจำการเข้าสู่ระบบ</span>
                                </label>
                                <button type="button" className="auth-forgot" onClick={openForgotPassword}>
                                    ลืมรหัสผ่าน?
                                </button>
                            </div>

                            <button type="submit" className="auth-submit" disabled={isLoginLoading}>
                                {isLoginLoading && <span className="auth-submit-spinner" aria-hidden="true"></span>}
                                {isLoginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                            </button>
                        </form>
                    )}
                </div>
            </section>

            {showPrivacyNotice && (
                <div className="auth-privacy-modal-backdrop" role="presentation">
                    <section
                        className="auth-privacy-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="privacy-notice-modal-title"
                    >
                        <header>
                            <div>
                                <span>Privacy Notice</span>
                                <h3 id="privacy-notice-modal-title">ประกาศนโยบายความเป็นส่วนตัว</h3>
                                <p>กรุณาเลื่อนอ่านเนื้อหาจนสุดก่อนกดรับทราบ</p>
                            </div>
                            <button type="button" onClick={() => setShowPrivacyNotice(false)} aria-label="ปิด Privacy Notice">
                                ×
                            </button>
                        </header>
                        <div className="auth-privacy-modal-scroll" tabIndex="0" onScroll={handlePrivacyScroll}>
                            {PRIVACY_NOTICE_SECTIONS.map((section) => (
                                <article key={section.title}>
                                    <h4>{section.title}</h4>
                                    <p>{section.text}</p>
                                </article>
                            ))}
                        </div>
                        <footer>
                            {!hasScrolledPrivacyNotice && (
                                <small>เลื่อนอ่าน Privacy Notice ให้ถึงท้ายเอกสารก่อน</small>
                            )}
                            <button type="button" onClick={acknowledgePrivacyNotice} disabled={!hasScrolledPrivacyNotice}>
                                รับทราบ
                            </button>
                        </footer>
                    </section>
                </div>
            )}

            {showForgotPassword && (
                <div className="auth-forgot-backdrop" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeForgotPassword();
                }}>
                    <section className="auth-forgot-dialog" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
                        <button type="button" className="auth-forgot-close" onClick={closeForgotPassword} aria-label="ปิด">×</button>
                        <div className="auth-forgot-icon" aria-hidden="true">?</div>
                        <h3 id="forgot-password-title">ลืมรหัสผ่าน</h3>
                        <p>
                            {forgotStep === 'request' && 'กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งรหัสยืนยัน 6 หลักไปทางอีเมล'}
                            {forgotStep === 'verify' && 'กรอกรหัสยืนยัน 6 หลักจากอีเมล รหัสจะหมดอายุภายใน 10 นาที'}
                            {forgotStep === 'reset' && 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ'}
                            {forgotStep === 'done' && 'รีเซ็ตรหัสผ่านเรียบร้อยแล้ว คุณสามารถกลับไปเข้าสู่ระบบด้วยรหัสใหม่ได้ทันที'}
                        </p>

                        {forgotMsg.text && (
                            <div className={`auth-alert ${forgotMsg.type === 'success' ? 'success' : 'error'}`}>
                                {forgotMsg.text}
                            </div>
                        )}

                        {forgotStep === 'request' && (
                            <form className="auth-forgot-form" onSubmit={handleRequestResetCode}>
                                <label>
                                    อีเมล
                                    <input
                                        type="email"
                                        value={forgotForm.email}
                                        onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
                                        placeholder="name@example.com"
                                        autoComplete="email"
                                        required
                                    />
                                </label>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading}>
                                    {isForgotLoading ? 'กำลังส่งรหัส...' : 'ส่งรหัสยืนยันทางอีเมล'}
                                </button>
                            </form>
                        )}

                        {forgotStep === 'verify' && (
                            <form className="auth-forgot-form" onSubmit={handleVerifyResetCode}>
                                <fieldset className="auth-code-fieldset">
                                    <legend>รหัสยืนยัน</legend>
                                    <div className="auth-code-inputs" aria-label="กรอกรหัสยืนยัน 6 หลัก">
                                        {forgotCodeDigits.map((digit, index) => (
                                            <input
                                                key={index}
                                                ref={(element) => {
                                                    resetCodeInputRefs.current[index] = element;
                                                }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="1"
                                                value={digit.trim()}
                                                onChange={(event) => setResetCodeAtIndex(index, event.target.value)}
                                                onKeyDown={(event) => handleResetCodeKeyDown(event, index)}
                                                onPaste={(event) => handleResetCodePaste(event, index)}
                                                onFocus={(event) => event.target.select()}
                                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                                aria-label={`รหัสหลักที่ ${index + 1}`}
                                            />
                                        ))}
                                    </div>
                                </fieldset>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading || forgotCode.length !== 6}>
                                    {isForgotLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
                                </button>
                                <button type="button" className="auth-forgot-secondary" onClick={handleRequestResetCode} disabled={isForgotLoading}>
                                    ส่งรหัสอีกครั้ง
                                </button>
                            </form>
                        )}

                        {forgotStep === 'reset' && (
                            <form className="auth-forgot-form" onSubmit={handleCompleteReset}>
                                <label>
                                    รหัสผ่านใหม่
                                    <input
                                        type="password"
                                        value={forgotForm.password}
                                        onChange={(e) => setForgotForm({ ...forgotForm, password: e.target.value })}
                                        placeholder="อย่างน้อย 8 ตัวอักษร"
                                        autoComplete="new-password"
                                        minLength="8"
                                        required
                                    />
                                </label>
                                <label>
                                    ยืนยันรหัสผ่านใหม่
                                    <input
                                        type="password"
                                        value={forgotForm.confirmPassword}
                                        onChange={(e) => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })}
                                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                                        autoComplete="new-password"
                                        minLength="8"
                                        required
                                    />
                                </label>
                                <button type="submit" className="auth-submit" disabled={isForgotLoading}>
                                    {isForgotLoading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
                                </button>
                            </form>
                        )}

                        {forgotStep === 'done' && (
                            <button type="button" className="auth-submit" onClick={closeForgotPassword}>กลับไปเข้าสู่ระบบ</button>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

export default AuthPage;
