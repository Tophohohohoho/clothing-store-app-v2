import AdminAddProductPage from './AdminAddProductPage';
import AdminCustomersPage from './AdminCustomersPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminStockLogsPage from './AdminStockLogsPage';

const adminTabs = [
    { id: 'dashboard', label: 'Dashboard & ออเดอร์' },
    { id: 'add-product', label: 'จัดการสินค้า' },
    { id: 'customers', label: 'จัดการลูกค้า' },
    { id: 'stock-logs', label: 'ประวัติการเคลื่อนไหว' },
];

function AdminPage(props) {
    const { adminPage, setAdminPage } = props;

    return (
        <div className="admin-page">
            <div className="admin-tabs-bar">
                {adminTabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={adminPage === tab.id ? 'active' : ''}
                        onClick={() => setAdminPage(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {adminPage === 'dashboard' && <AdminDashboardPage {...props} />}
            {adminPage === 'add-product' && <AdminAddProductPage {...props} />}
            {adminPage === 'customers' && <AdminCustomersPage {...props} />}
            {adminPage === 'stock-logs' && <AdminStockLogsPage {...props} />}
        </div>
    );
}

export default AdminPage;
