import { useState } from 'react';

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

    const switchToLogin = () => {
        setIsRegisterView(false);
    };

    const switchToRegister = () => {
        setIsRegisterView(true);
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
                                />
                            </label>

                            <label>
                                อีเมล
                                <input
                                    type="email"
                                    placeholder="เช่น name@example.com"
                                    value={registerForm.email}
                                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                />
                            </label>

                            <label>
                                เบอร์โทร
                                <input
                                    type="tel"
                                    placeholder="เบอร์โทรสำหรับติดต่อ"
                                    value={registerForm.phone}
                                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                                />
                            </label>

                            <label>
                                รหัสผ่าน
                                <input
                                    type="password"
                                    placeholder="ตั้งรหัสผ่าน"
                                    value={registerForm.password}
                                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
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
                                    required
                                />
                            </label>

                            <button type="submit" className="auth-submit">สร้างบัญชี</button>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={onLogin}>
                            {loginError && <div className="auth-alert error">{loginError}</div>}

                            <label htmlFor="login-username">
                                ชื่อผู้ใช้
                                <input
                                    id="login-username"
                                    type="text"
                                    placeholder="กรอกชื่อผู้ใช้"
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
                                <button type="button" className="auth-forgot" onClick={() => setShowForgotPassword(true)}>
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

            {showForgotPassword && (
                <div className="auth-forgot-backdrop" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setShowForgotPassword(false);
                }}>
                    <section className="auth-forgot-dialog" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
                        <button type="button" className="auth-forgot-close" onClick={() => setShowForgotPassword(false)} aria-label="ปิด">×</button>
                        <div className="auth-forgot-icon" aria-hidden="true">?</div>
                        <h3 id="forgot-password-title">ลืมรหัสผ่าน</h3>
                        <p>เพื่อความปลอดภัย กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันตัวตนและขอรีเซ็ตรหัสผ่าน</p>
                        <div className="auth-forgot-note">เตรียมชื่อผู้ใช้และอีเมลที่ลงทะเบียนไว้ เพื่อให้ตรวจสอบบัญชีได้รวดเร็วขึ้น</div>
                        <button type="button" className="auth-submit" onClick={() => setShowForgotPassword(false)}>กลับไปเข้าสู่ระบบ</button>
                    </section>
                </div>
            )}
        </main>
    );
}

export default AuthPage;
