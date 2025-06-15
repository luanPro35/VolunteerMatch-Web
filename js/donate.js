// Đợi toàn bộ tài liệu HTML được tải xong
document.addEventListener('DOMContentLoaded', () => {
  // Lấy phần tử nút chọn hình thức quyên góp tiền mặt
  const monetaryToggle = document.getElementById('monetary-toggle');
  // Lấy phần tử nút chọn hình thức quyên góp hiện vật
  const inkindToggle = document.getElementById('inkind-toggle');
  // Lấy form quyên góp tiền
  const monetaryForm = document.getElementById('monetary-form');
  // Lấy form quyên góp hiện vật
  const inkindForm = document.getElementById('inkind-form');

  // Kiểm tra các phần tử đều tồn tại
  if (monetaryToggle && inkindToggle && monetaryForm && inkindForm) {
    // Sự kiện khi nhấn vào nút quyên góp tiền
    monetaryToggle.addEventListener('click', () => {
      monetaryToggle.classList.add('active'); // Đánh dấu nút này là đang chọn
      inkindToggle.classList.remove('active'); // Gỡ đánh dấu nút còn lại
      monetaryForm.classList.add('active'); // Hiển thị form tiền
      inkindForm.classList.remove('active'); // Ẩn form hiện vật
    });

    // Sự kiện khi nhấn vào nút quyên góp hiện vật
    inkindToggle.addEventListener('click', () => {
      inkindToggle.classList.add('active'); // Đánh dấu nút này là đang chọn
      monetaryToggle.classList.remove('active'); // Gỡ đánh dấu nút còn lại
      inkindForm.classList.add('active'); // Hiển thị form hiện vật
      monetaryForm.classList.remove('active'); // Ẩn form tiền
    });
  }
});

// ----------- Kiểm tra Form Quyên Góp Tiền -----------

function validateMonetaryDonateForm(event) {
  event.preventDefault(); // Ngăn form gửi đi và load lại trang

  const form = document.getElementById('monetary-donate-form'); // Lấy form tiền
  const message1 = document.getElementById('monetary-donate-message'); // Thông báo kết quả
  const amount = document.getElementById('monetary-amount').value.trim(); // Giá trị số tiền
  const paymentMethod = document.getElementById('monetary-payment-method').value; // Phương thức thanh toán

  message1.textContent = ''; // Xoá nội dung thông báo cũ
  message1.classList.remove('success', 'error'); // Xoá class thành công/lỗi cũ

  // Nếu thiếu thông tin
  if (!amount || !paymentMethod) {
    message1.textContent = 'Vui lòng điền đầy đủ các trường bắt buộc.';
    message1.classList.add('error'); // Gắn class lỗi
    return false;
  }

  // Nếu số tiền < 10,000 VND
  if (amount < 10000) {
    message1.textContent = 'Số tiền tối thiểu là 10,000 VND.';
    message1.classList.add('error'); // Gắn class lỗi
    return false;
  }

  // Nếu hợp lệ
  message1.textContent = 'Cảm ơn bạn đã quyên góp! Chúng tôi sẽ xử lý yêu cầu của bạn.';
  message1.classList.add('success'); // Gắn class thành công
  form.reset(); // Reset form

  return false; // Không gửi form
}

// ----------- Kiểm tra Form Quyên Góp Hiện Vật -----------

function validateInKindDonateForm(event) {
  event.preventDefault(); // Ngăn form gửi đi

  const form = document.getElementById('inkind-donate-form'); // Lấy form hiện vật
  const message2 = document.getElementById('inkind-donate-message'); // Thông báo kết quả
  const items = document.getElementById('inkind-items').value.trim(); // Mặt hàng quyên góp
  const contact = document.getElementById('inkind-contact').value.trim(); // Liên hệ (số hoặc email)
  const deliveryMethod = document.getElementById('inkind-delivery').value; // Phương thức giao hàng

  message2.textContent = ''; // Xoá thông báo cũ
  message2.classList.remove('success', 'error'); // Gỡ các class trước đó

  // Nếu thiếu thông tin bắt buộc
  if (!items || !contact || !deliveryMethod) {
    message2.textContent = 'Vui lòng điền đầy đủ các trường bắt buộc.';
    message2.classList.add('error'); // Gắn class lỗi
    return false;
  }

  // Regex kiểm tra liên hệ: số điện thoại 10-11 số hoặc email
  const contactRegex = /^(?:\d{10,11}|\w+@\w+\.\w+)$/;
  if (!contactRegex.test(contact)) {
    message2.textContent = 'Vui lòng nhập số điện thoại (10-11 số) hoặc email hợp lệ.';
    message2.classList.add('error'); // Gắn class lỗi
    return false;
  }

  // Nếu hợp lệ
  message2.textContent = 'Cảm ơn bạn đã quyên góp vật phẩm! Chúng tôi sẽ liên hệ với bạn sớm.';
  message2.classList.add('success'); // Gắn class thành công
  form.reset(); // Reset form

  return false; // Không gửi form
}

document.getElementById('monetary-payment-method').addEventListener('change', function() {
  const momoQR = document.getElementById('momo-qr');
  const bankQR = document.getElementById('bank-qr');
  const transferCode = document.getElementById('transfer-code');
  
  // Ẩn tất cả QR trước
  momoQR.style.display = 'none';
  bankQR.style.display = 'none';
  
  // Hiển thị QR tương ứng với phương thức được chọn
  if (this.value === 'momo') {
    momoQR.style.display = 'block';
  } else if (this.value === 'bank') {
    bankQR.style.display = 'block';
    // Tạo mã chuyển khoản ngẫu nhiên
    const randomCode = 'VM' + Date.now().toString().slice(-8);
    transferCode.textContent = randomCode;
  }
});
