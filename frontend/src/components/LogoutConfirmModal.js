import { useEffect } from 'react';

function LogoutConfirmModal({ user, isSubmitting, onCancel, onConfirm }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isSubmitting) onCancel();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSubmitting, onCancel]);

    return (
        <div className="logout-modal-backdrop" onMouseDown={() => !isSubmitting && onCancel()}>
            <section
                className="logout-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-modal-title"
                aria-describedby="logout-modal-description"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="logout-modal-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M10 4H6.8A2.8 2.8 0 0 0 4 6.8v10.4A2.8 2.8 0 0 0 6.8 20H10" />
                        <path d="M15 7l5 5-5 5" />
                        <path d="M20 12H9" />
                    </svg>
                </div>

                <div className="logout-modal-copy">
                    <span>{user?.role === 'admin' ? 'Admin Session' : 'Account Session'}</span>
                    <h2 id="logout-modal-title">ยืนยันการออกจากระบบ</h2>
                    <p id="logout-modal-description">
                        คุณต้องการออกจากระบบใช่หรือไม่? หากออกจากระบบแล้ว ต้องเข้าสู่ระบบใหม่อีกครั้ง
                    </p>
                </div>

                <div className="logout-modal-actions">
                    <button
                        type="button"
                        className="logout-cancel-button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        className="logout-confirm-button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default LogoutConfirmModal;
