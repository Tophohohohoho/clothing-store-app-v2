function AuthPage({
    isRegisterView,
    setIsRegisterView,
    loginForm,
    setLoginForm,
    registerForm,
    setRegisterForm,
    loginError,
    registerMsg,
    onLogin,
    onRegister,
}) {
    const switchToLogin = () => {
        setIsRegisterView(false);
    };

    const switchToRegister = () => {
        setIsRegisterView(true);
    };

    return (
        <main className="auth-page">
            <section className="auth-shell">
                <div className="auth-visual" aria-hidden="true">
                    <div className="auth-brand-mark">CS</div>
                    <div>
                        <p className="auth-kicker">Clothing Store</p>
                        <h1>แฟชั่นที่เลือกง่าย จัดการร้านได้ครบ</h1>
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
                            <p className="auth-switch">
                                มีบัญชีอยู่แล้ว? <button type="button" onClick={switchToLogin}>เข้าสู่ระบบ</button>
                            </p>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={onLogin}>
                            {loginError && <div className="auth-alert error">{loginError}</div>}

                            <label>
                                ชื่อผู้ใช้
                                <input
                                    type="text"
                                    placeholder="กรอกชื่อผู้ใช้"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                รหัสผ่าน
                                <input
                                    type="password"
                                    placeholder="กรอกรหัสผ่าน"
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                    required
                                />
                            </label>

                            <button type="submit" className="auth-submit">เข้าสู่ระบบ</button>
                            <p className="auth-switch">
                                ยังไม่มีบัญชี? <button type="button" onClick={switchToRegister}>สมัครสมาชิก</button>
                            </p>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}

export default AuthPage;
