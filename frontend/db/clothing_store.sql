-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 06, 2026 at 06:56 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `clothing_store`
--

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(100) DEFAULT 'ลูกค้าทั่วไป',
  `total_price` decimal(10,2) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT 'โอนเงินผ่านธนาคาร',
  `shipping_method` varchar(50) DEFAULT 'ส่งสินค้า',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `user_id`, `username`, `total_price`, `address`, `phone`, `status`, `payment_method`, `shipping_method`, `created_at`) VALUES
(25, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '11111111', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:13:39'),
(26, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '11111111', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:15:53'),
(27, 3, '123', 250.00, 'รับสินค้าเองที่หน้าร้าน', '11111111', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:17:43'),
(28, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '11111111', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:19:07'),
(29, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '12345', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:23:52'),
(30, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '15616565', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:25:54'),
(31, 3, '123', 150.00, 'รับสินค้าเองที่หน้าร้าน', '272872', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'รับหน้าร้าน', '2026-05-24 08:39:02'),
(34, 3, '123', 150.00, 'ะ้ะพ้พะ้', '5935363', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 03:15:31'),
(35, 1, 'admin', 500.00, '78/78', '0651078576', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 04:23:38'),
(36, 3, '123', 500.00, '45', '45', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 04:24:27'),
(37, 3, '123', 890.00, '1', '1', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 04:27:09'),
(38, 3, '123', 300.00, '555', '555', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 04:31:10'),
(39, 3, '123', 200.00, '123', '123', 'รอตรวจสอบ', 'โอนเงินผ่านธนาคาร', 'ส่งสินค้า', '2026-06-06 04:55:18');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `price_at_purchase` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `price`, `price_at_purchase`) VALUES
(24, 25, 3, 1, 150.00, NULL),
(25, 26, 3, 1, 150.00, NULL),
(26, 27, 1, 1, 250.00, NULL),
(27, 28, 3, 1, 150.00, NULL),
(28, 29, 3, 1, 150.00, NULL),
(29, 30, 3, 1, 150.00, NULL),
(30, 31, 3, 1, 150.00, NULL),
(33, 34, 3, 1, 150.00, NULL),
(34, 35, 9, 5, 100.00, NULL),
(35, 36, 9, 5, 100.00, NULL),
(36, 37, 2, 1, 890.00, NULL),
(37, 38, 9, 3, 100.00, NULL),
(38, 39, 9, 2, 100.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `stock` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `description`, `price`, `image_url`, `stock`, `created_at`) VALUES
(1, 'เสื้อยืดคอกลม', 'เสื้อยืดผ้าฝ้าย 100% สวมใส่สบาย ระบายอากาศได้ดี', 250.00, 'https://via.placeholder.com/150/0000FF/808080?Text=T-Shirt', 10, '2026-05-12 06:11:41'),
(2, 'กางเกงยีนส์ขากระบอก', 'กางเกงยีนส์ทรงสวย ซักแล้วสีไม่ตก', 890.00, 'https://via.placeholder.com/150/FF0000/FFFFFF?Text=Jeans', 21, '2026-05-12 06:11:41'),
(3, 'หมวกแก๊ป', 'หมวกแก๊ปสไตล์มินิมอล กันแดดได้ดี', 150.00, 'https://via.placeholder.com/150/FFFF00/000000?Text=Cap', 87, '2026-05-12 06:11:41'),
(9, 'ทดสอบ', 'แมวววว', 100.00, 'https://th.bing.com/th/id/OIP.63sunskLxuvM0rxI8L5NCAHaEK?w=319&h=180&c=7&r=0&o=7&pid=1.7&rm=3', 35, '2026-06-06 04:22:43');

-- --------------------------------------------------------

--
-- Table structure for table `stock_logs`
--

CREATE TABLE `stock_logs` (
  `id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `amount` int(11) NOT NULL,
  `change_amount` int(11) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_logs`
--

INSERT INTO `stock_logs` (`id`, `product_id`, `user_id`, `amount`, `change_amount`, `remark`, `created_at`) VALUES
(61, 1, 1, 0, 5, 'ขอมาครบ', '2026-06-03 16:24:47');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`, `created_at`) VALUES
(1, 'admin', 'password123', 'admin', '2026-05-13 12:37:33'),
(3, '123', '123', 'user', '2026-05-13 12:37:33');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `stock_logs`
--
ALTER TABLE `stock_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `stock_logs`
--
ALTER TABLE `stock_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `stock_logs`
--
ALTER TABLE `stock_logs`
  ADD CONSTRAINT `stock_logs_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
