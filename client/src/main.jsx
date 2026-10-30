import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Checkout from './pages/Checkout.jsx';
import Contact from './pages/Contact.jsx';
import Home from './pages/Home.jsx';
import Order from './pages/Order.jsx';
import Policy from './pages/Policy.jsx';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const Login = lazy(() => import('./pages/admin/Login.jsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const ProductEditor = lazy(() => import('./pages/admin/ProductEditor.jsx'));
const Orders = lazy(() => import('./pages/admin/Orders.jsx'));
const OrderDetail = lazy(() => import('./pages/admin/OrderDetail.jsx'));
const Settings = lazy(() => import('./pages/admin/Settings.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:token" element={<Order />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Policy page="privacy" />} />
            <Route path="/terms" element={<Policy page="terms" />} />
            <Route path="/refund" element={<Policy page="refund" />} />
          </Route>
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="product" element={<ProductEditor />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
