// Thêm hàm formatDate vào đầu file hoặc trước khi sử dụng
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Kiểm tra xác thực admin khi tải trang
// Thay đổi sự kiện DOMContentLoaded để khởi tạo dữ liệu thực tế thay vì dữ liệu mẫu
let realUsers = []; // Biến toàn cục để lưu trữ người dùng thực tế

document.addEventListener('DOMContentLoaded', () => {
  // Kiểm tra xem người dùng đã đăng nhập và có quyền admin không
  const userStr = localStorage.getItem('user');
  console.log('Raw user data from localStorage:', userStr);

  const user = JSON.parse(userStr || '{}');
  console.log('Admin page loaded, user data:', user);

  if (!user || !user.email) {
    // Nếu chưa đăng nhập, chuyển hướng về trang đăng nhập
    console.log('Not logged in, redirecting to login page');
    window.location.href = '../html/login.html'; // Đã sửa đường dẫn
    return;
  }

  // Danh sách email của administrators - chỉ có một tài khoản admin duy nhất
  const administrators = [
    'quangluan0305@gmail.com'
  ];

  // Kiểm tra quyền admin
  console.log('Checking admin rights, isAdmin:', user.isAdmin);
  if (!user.isAdmin && !administrators.includes(user.email)) {
    // Nếu không phải admin và email không nằm trong danh sách administrators
    console.log('Not an admin, redirecting to home page');
    alert('Bạn không có quyền truy cập trang này!');
    window.location.href = '../header.html';
    return;
  } else if (!user.isAdmin && administrators.includes(user.email)) {
    // Nếu email nằm trong danh sách administrators nhưng chưa có quyền admin
    console.log('Email in administrators list, granting admin rights');
    user.isAdmin = true;
    localStorage.setItem('user', JSON.stringify(user));
  }

  console.log('Admin access granted');
  // Hiển thị tên admin
  document.getElementById('admin-name').textContent = user.name || 'Admin';

  // Thêm trường ẩn vào form người dùng để theo dõi nếu là người dùng thực tế
  const userForm = document.getElementById('user-form');
  if (userForm && !document.getElementById('user-is-real')) {
    const hiddenField = document.createElement('input');
    hiddenField.type = 'hidden';
    hiddenField.id = 'user-is-real';
    hiddenField.name = 'isReal';
    hiddenField.value = 'false'; // Sẽ được cập nhật bởi openUserModal
    userForm.appendChild(hiddenField);
  }

  // Khởi tạo dữ liệu thực tế từ database và hiển thị
  initializeData();

  // Khởi tạo các sự kiện
  initializeEvents();

  // Xóa nút chuyển đổi dữ liệu nếu có, vì ta sẽ luôn hiển thị dữ liệu thực tế
  const toggleButton = document.querySelector('#users-tab .toggle-data-btn');
  if (toggleButton) {
    toggleButton.remove();
  }

  // --- Customer Chat Tab Functionality (API-driven) ---
  const toggleOnlineBtnChat = document.getElementById("toggleOnlineBtnChat");
  const statusDotChat = document.getElementById("statusDotChat");
  const statusTextChat = document.getElementById("statusTextChat");
  const replyTextAdmin = document.getElementById("replyTextAdmin");
  const sendReplyBtnAdmin = document.getElementById("sendReplyBtnAdmin");
  const chatSessionList = document.getElementById('chat-session-list');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  let currentSelectedCustomerId = null;

  let chatIsOnline = false;
  let chatPingInterval;

  function handleAdminChatKeyPress(event) {
    if (event.key === 'Enter') {
      sendAdminChatReply();
    }
  }

  function updateChatStatusUI() {
    if (!statusTextChat || !toggleOnlineBtnChat || !statusDotChat) return;

    statusTextChat.innerText = 'Trạng thái: ' + (chatIsOnline ? 'Online' : 'Offline');
    toggleOnlineBtnChat.innerHTML = chatIsOnline
        ? '<i class="fas fa-power-off"></i> <span>Tắt Online</span>'
        : '<i class="fas fa-power-off"></i> <span>Bật Online</span>';

    if (chatIsOnline) {
      toggleOnlineBtnChat.classList.add('online');
      statusDotChat.classList.add('online');
    } else {
      toggleOnlineBtnChat.classList.remove('online');
      statusDotChat.classList.remove('online');
    }
  }

  function toggleAdminChatOnlineStatus() {
    const newOnlineStatus = !chatIsOnline;
    const token = getAuthToken();
    if (!token) {
        showAlert('Không thể thay đổi trạng thái, token không hợp lệ.', 'error');
        return;
    }

    fetch('/api/admin-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ online: newOnlineStatus })
    }).then(response => {
      if (!response.ok) {
        console.error("Failed to update admin status on server. Status:", response.status);
        showAlert('Không thể cập nhật trạng thái online. Vui lòng thử lại.', 'error');
        return;
      }
      chatIsOnline = newOnlineStatus;
      updateChatStatusUI();

      if (chatIsOnline) {
        startAdminChatPing();
        loadChatSessions();
        if (currentSelectedCustomerId && chatMessagesContainer) {
            renderMessagesForCustomer(currentSelectedCustomerId);
        } else if (chatMessagesContainer) {
            chatMessagesContainer.innerHTML = '<div class="no-messages-admin">💬 Chọn một khách hàng để bắt đầu trò chuyện.</div>';
        }
      } else {
        stopAdminChatPing();
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '<div class="no-messages-admin">💬 Admin đang Offline. Bật Online để nhận tin nhắn.</div>';
        if (chatSessionList) chatSessionList.innerHTML = '';
      }
    }).catch(error => {
        console.error("Error toggling admin online status:", error);
        showAlert('Lỗi kết nối khi cập nhật trạng thái.', 'error');
    });
  }

  function startAdminChatPing() {
    stopAdminChatPing();
    chatPingInterval = setInterval(() => {
      const currentToken = getAuthToken();
      if (chatIsOnline && currentToken) {
        fetch('/api/admin-ping', { headers: { 'Authorization': `Bearer ${currentToken}` }})
          .then(response => {
            if (!response.ok) {
              console.warn(`Admin ping failed with status: ${response.status}`);
            }
          })
          .catch((error) => {
            console.warn("Admin ping network error:", error);
          });
      } else {
        stopAdminChatPing();
      }
    }, 5000);
  }
  function stopAdminChatPing() {
    clearInterval(chatPingInterval);
  }

  async function fetchAdminChatStatus() {
    const token = getAuthToken();
    if (!token) {
        chatIsOnline = false;
        updateChatStatusUI();
        return;
    }
    try {
        const response = await fetch('/api/admin/get-chat-status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            chatIsOnline = data.isAdminOnline;
        } else {
            chatIsOnline = false;
        }
    } catch (error) {
        console.error("Lỗi lấy trạng thái chat admin:", error);
        chatIsOnline = false;
    }
    updateChatStatusUI();
    if (chatIsOnline) {
        startAdminChatPing();
        loadChatSessions();
         if (currentSelectedCustomerId && chatMessagesContainer) {
            renderMessagesForCustomer(currentSelectedCustomerId);
        }
    }
  }

  async function loadChatSessions() {
    if (!chatSessionList || !chatIsOnline) return;
    const token = getAuthToken();
    if (!token) return;

    try {
        const response = await fetch('/api/admin/chat-sessions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Lỗi API: ${response.status}`);
        }
        const sessions = await response.json();
        renderChatSessions(sessions);
    } catch (error) {
        console.error("Lỗi tải danh sách phiên chat:", error);
        if (chatSessionList) chatSessionList.innerHTML = `<div class="chat-session-item error">Không thể tải danh sách.</div>`;
    }
  }

  function renderChatSessions(sessions) {
    if (!chatSessionList) return;
    chatSessionList.innerHTML = '';
    if (sessions.length === 0) {
        chatSessionList.innerHTML = '<div class="chat-session-item no-sessions">Chưa có khách hàng nào liên hệ.</div>';
        return;
    }

    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'chat-session-item';
        if (session.userId === currentSelectedCustomerId) {
            sessionDiv.classList.add('active');
        }
        sessionDiv.dataset.customerId = session.userId;
        sessionDiv.innerHTML = `
            <div class="session-customer-name">${session.userName || 'Khách hàng'} (${session.userEmail || 'N/A'})</div>
            <div class="session-last-message">${session.lastMessageText ? truncateText(session.lastMessageText, 30) : 'Chưa có tin nhắn'}</div>
            ${session.unreadCount > 0 ? `<span class="unread-badge">${session.unreadCount}</span>` : ''}
        `;
        sessionDiv.addEventListener('click', () => {
            currentSelectedCustomerId = session.userId;
            document.querySelectorAll('.chat-session-item.active').forEach(el => el.classList.remove('active'));
            sessionDiv.classList.add('active');
            renderMessagesForCustomer(session.userId);
        });
        chatSessionList.appendChild(sessionDiv);
    });
  }

  async function renderMessagesForCustomer(customerId) {
    if (!chatMessagesContainer || !customerId) return;
    const token = getAuthToken();
    if (!token) return;

    chatMessagesContainer.innerHTML = '<div class="loading-chat-admin">Đang tải tin nhắn...</div>';

    try {
        const response = await fetch(`/api/admin/messages/${customerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Lỗi API: ${response.status}`);
        }
        const messages = await response.json();
        chatMessagesContainer.innerHTML = '';

        if (messages.length === 0) {
          const noMessagesDiv = document.createElement('div');
          noMessagesDiv.className = 'no-messages-admin';
          noMessagesDiv.innerHTML = '💬 Chưa có tin nhắn nào trong cuộc trò chuyện này.';
          chatMessagesContainer.appendChild(noMessagesDiv);
        } else {
          const fragment = document.createDocumentFragment();
          messages.forEach(msg => {
            const div = document.createElement('div');
            let senderClass = 'user';
            let senderPrefix = '[Khách hàng]: ';

            if (msg.sender === 'admin') {
              senderClass = 'admin';
              senderPrefix = '[Admin]: ';
            } else if (msg.sender === 'bot') {
              senderClass = 'bot';
              senderPrefix = '[Bot]: ';
            }

            div.className = `message-admin-view ${senderClass}`;

            const senderStrong = document.createElement('strong');
            senderStrong.textContent = senderPrefix;
            div.appendChild(senderStrong);

            div.appendChild(document.createTextNode(msg.text || ''));
            fragment.appendChild(div);
          });
          chatMessagesContainer.appendChild(fragment);
        }
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        const sessionItem = chatSessionList.querySelector(`.chat-session-item[data-customer-id="${customerId}"] .unread-badge`);
        if (sessionItem) sessionItem.remove();

    } catch (error) {
        console.error("Lỗi tải tin nhắn cho khách hàng:", error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'no-messages-admin error-message';
        errorDiv.innerHTML = `❌ Không thể tải tin nhắn: ${error.message}. Vui lòng thử lại.`;
        chatMessagesContainer.innerHTML = '';
        chatMessagesContainer.appendChild(errorDiv);
    }
  }

  function sendAdminChatReply() {
    if (!replyTextAdmin || !sendReplyBtnAdmin) return;
    const text = replyTextAdmin.value.trim();
    const token = getAuthToken();

    if (!text) {
        showAlert('Vui lòng nhập tin nhắn!', 'error');
        return;
    }
    if (!chatIsOnline) {
        showAlert('Bạn cần Bật Online để trả lời!', 'error');
        return;
    }
    if (!currentSelectedCustomerId) {
        showAlert('Vui lòng chọn một khách hàng để trả lời!', 'error');
        return;
    }
    if (!token) {
        showAlert('Token không hợp lệ, không thể gửi tin nhắn.', 'error');
        return;
    }

    sendReplyBtnAdmin.disabled = true;
    replyTextAdmin.disabled = true;

    fetch('/api/admin-send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, targetUserId: currentSelectedCustomerId })
    }).then(response => {
      if (!response.ok) {
        return response.json().then(errData => {
          throw new Error(errData.message || 'Không thể gửi tin nhắn');
        }).catch(() => {
          throw new Error('Không thể gửi tin nhắn, lỗi không xác định từ server.');
        });
      }
      return response.json();
    }).then(() => {
      replyTextAdmin.value = '';
      renderMessagesForCustomer(currentSelectedCustomerId);
    }).catch(error => {
      showAlert(`Lỗi gửi tin nhắn: ${error.message}`, 'error');
    }).finally(() => {
      sendReplyBtnAdmin.disabled = false;
      replyTextAdmin.disabled = false;
      replyTextAdmin.focus();
    });
  }

  if (toggleOnlineBtnChat) {
    toggleOnlineBtnChat.addEventListener("click", toggleAdminChatOnlineStatus);
  }
  if (sendReplyBtnAdmin) {
    sendReplyBtnAdmin.addEventListener("click", sendAdminChatReply);
  }
  if (replyTextAdmin) {
    replyTextAdmin.addEventListener("keypress", handleAdminChatKeyPress);
  }

  fetchAdminChatStatus();

  const initialTabElement = document.querySelector(".admin-sidebar nav li.active");
  if (initialTabElement) {
    const activeTabId = initialTabElement.getAttribute("data-tab");
    if (activeTabId === "customer-chat") {
      if (chatIsOnline) {
        // Handled by fetchAdminChatStatus
      } else if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = '<div class="no-messages-admin">💬 Admin đang Offline. Bật Online để nhận tin nhắn.</div>';
      }
    }
  }

  // Auto refresh cho tour registrations
  if (getAuthToken()) {
    console.log("Bắt đầu tự động làm mới danh sách đăng ký tour.");
    setInterval(() => {
        loadTourRegistrations(); // Gọi loadTourRegistrations thay vì displayTourRegistrations
    }, 30000);
  }

  // Load dữ liệu ban đầu
  loadTourRegistrations();
});

// Cập nhật số liệu thống kê
function updateStats() {
  // Nên fetch số liệu thống kê từ server để chính xác
  // const posts = JSON.parse(localStorage.getItem('adminPosts') || '[]'); // Dữ liệu mẫu
  // const pendingPosts = posts.filter(post => post.status === 'pending'); // Dữ liệu mẫu

  // Hiển thị số lượng người dùng thực tế
  document.getElementById('user-count').textContent = realUsers.length;
  // document.getElementById('post-count').textContent = posts.length; // Cần API
  // document.getElementById('pending-count').textContent = pendingPosts.length; // Cần API
}

// Hàm tiện ích để rút gọn văn bản
function truncateText(text, maxLength) {
  if (text && text.length > maxLength) { // Thêm kiểm tra text có tồn tại không
      return text.substring(0, maxLength) + '...';
  }
  return text || ''; // Trả về chuỗi rỗng nếu text là null hoặc undefined
}

// Hiển thị danh sách người dùng (phiên bản dùng dữ liệu mẫu - có thể loại bỏ nếu không cần fallback)
function displaySampleUsers() {
  const users = JSON.parse(localStorage.getItem('adminUsers') || '[]');
  const tableBody = document.getElementById('users-table-body');

  tableBody.innerHTML = '';

  if (users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Chưa có người dùng nào (dữ liệu mẫu).</td></tr>';
    return;
  }

  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.createdAt}</td>
      <td><span class="status-badge status-${user.status}">${user.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}</span></td>
      <td><span class="status-badge ${user.role === 'admin' ? 'status-approved' : 'status-pending'}">${user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" data-id="${user.id}" data-real="false" title="Chỉnh sửa"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete-btn" data-id="${user.id}" data-real="false" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
  attachUserActionEvents();
}


// Hiển thị danh sách bài đăng (API-driven)
async function displayPosts(filter = 'pending') { // Mặc định là 'pending_approval' từ server
  const tableBody = document.getElementById('posts-table-body');
  const token = getAuthToken();
  if (!tableBody || !token) {
    console.error("Table body for posts not found or no auth token.");
    if(tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="error-message">Lỗi: Không thể tải dữ liệu bài đăng.</td></tr>';
    return;
  }

  tableBody.innerHTML = '<tr><td colspan="6" class="loading-message">Đang tải bài đăng...</td></tr>';

  let apiUrl = '/api/admin/all-aid-posts'; // API mặc định
  if (filter === 'pending') {
    apiUrl = '/api/admin/pending-aid-posts';
  } else if (filter === 'approved') {
    apiUrl = '/api/admin/approved-aid-posts';
  } else if (filter === 'rejected') {
    apiUrl = '/api/admin/rejected-aid-posts';
  }

  try {
    const response = await fetch(`http://localhost:3000${apiUrl}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Lỗi API khi tải bài đăng: ${response.status}`);
    }
    const posts = await response.json();

    tableBody.innerHTML = ''; // Xóa thông báo loading

    if (posts.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">Không có bài đăng nào cho bộ lọc này.</td></tr>`;
      return;
    }

    posts.forEach(post => {
      const row = document.createElement('tr');
      let statusText = post.status;
      let statusClass = post.status;

      if (post.status === 'pending_approval') { statusText = 'Chờ duyệt'; statusClass = 'pending';}
      else if (post.status === 'approved') { statusText = 'Đã duyệt'; }
      else if (post.status === 'rejected') { statusText = 'Từ chối'; }

      row.innerHTML = `
        <td>${post.id}</td>
        <td>${truncateText(post.title, 50)}</td>
        <td>${post.author_name || 'N/A'}</td>
        <td>${new Date(post.created_at).toLocaleDateString('vi-VN')}</td>
        <td><span class="status-badge status-${statusClass}">${statusText}</span></td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view-btn" data-id="${post.id}" title="Xem chi tiết"><i class="fas fa-eye"></i></button>
            ${post.status === 'pending_approval' ? `
              <button class="action-btn approve-post-table-btn" data-id="${post.id}" title="Duyệt"><i class="fas fa-check"></i></button>
              <button class="action-btn reject-post-table-btn" data-id="${post.id}" title="Từ chối"><i class="fas fa-times"></i></button>
            ` : ''}
            <!-- <button class="action-btn delete-post-btn" data-id="${post.id}" title="Xóa"><i class="fas fa-trash"></i></button> -->
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
    attachPostActionEvents();
  } catch (error) {
    console.error(`Lỗi tải bài đăng (${filter}):`, error);
    tableBody.innerHTML = `<tr><td colspan="6" class="error-message">Lỗi: ${error.message}</td></tr>`;
  }
}


// Hiển thị hoạt động gần đây (giữ nguyên nếu vẫn dùng localStorage cho activities)
function displayActivities() {
  const activityList = document.getElementById('activity-list');
  const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');

  activityList.innerHTML = '';

  if (activities.length === 0) {
    activityList.innerHTML = '<p class="empty-message">Chưa có hoạt động nào.</p>';
    return;
  }

  activities.slice(0, 5).forEach(activity => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="activity-icon ${activity.type}">
        <i class="fas ${activity.type === 'user' ? 'fa-user' : activity.type === 'post' ? 'fa-newspaper' : 'fa-cog'}"></i>
      </div>
      <div class="activity-content">
        <p>${activity.message}</p>
        <span class="activity-time">${activity.time}</span>
      </div>
    `;
    activityList.appendChild(item);
  });
}

// Thêm hoạt động mới
function addActivity(type, message) {
  const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');
  const now = new Date();
  const time = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}`;
  activities.unshift({ type, message, time });
  if (activities.length > 20) activities.pop();
  localStorage.setItem('adminActivities', JSON.stringify(activities));
  displayActivities();
}

// Khởi tạo các sự kiện
function initializeEvents() {
  const navItems = document.querySelectorAll('.admin-nav li');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');

      // Tải lại dữ liệu cho tab bài đăng khi được chọn
      if (tabId === 'posts') {
        const currentFilter = document.getElementById('post-status-filter').value;
        displayPosts(currentFilter || 'pending'); // Mặc định là pending nếu chưa có filter
      }
    });
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    confirmAction('Bạn có chắc chắn muốn đăng xuất?', () => {
        localStorage.removeItem('user');
        addActivity('system', 'Admin đã đăng xuất khỏi hệ thống');
        window.location.href = '../html/login.html'; // Đã sửa
    });
  });

  document.getElementById('close-confirm-modal').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('active');
  });
  document.getElementById('cancel-confirm').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('active');
  });

  document.getElementById('add-user-btn').addEventListener('click', () => {
    openUserModal(null, true);
  });

  document.getElementById('close-user-modal').addEventListener('click', () => {
    document.getElementById('user-modal').classList.remove('active');
  });
  document.getElementById('cancel-user-form').addEventListener('click', () => {
    document.getElementById('user-modal').classList.remove('active');
  });
  document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveUser();
  });

  document.getElementById('post-status-filter').addEventListener('change', (e) => {
    displayPosts(e.target.value);
  });

  document.getElementById('close-post-modal').addEventListener('click', () => {
    document.getElementById('post-modal').classList.remove('active');
  });

  document.getElementById('approve-post-btn').addEventListener('click', () => {
    const postId = document.getElementById('approve-post-btn').dataset.id;
    if (postId) confirmAction('Bạn có chắc muốn duyệt bài đăng này?', () => approvePost(postId));
  });
  document.getElementById('reject-post-btn').addEventListener('click', () => {
    const postId = document.getElementById('reject-post-btn').dataset.id;
    if (postId) confirmAction('Bạn có chắc muốn từ chối bài đăng này?', () => rejectPost(postId));
  });

  document.getElementById('admin-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveAdminProfile();
  });
  document.getElementById('system-settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSystemSettings();
  });
}

// Gắn sự kiện cho các nút trong bảng người dùng
function attachUserActionEvents() {
  const userTableBody = document.getElementById('users-table-body');
  if (!userTableBody) return;

  userTableBody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id');
      const isReal = btn.getAttribute('data-real') === 'true';
      openUserModal(userId, isReal);
    });
  });

  userTableBody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id');
      const isReal = btn.getAttribute('data-real') === 'true';
      confirmDeleteUser(userId, isReal);
    });
  });
}

// Gắn sự kiện cho các nút trong bảng bài đăng
function attachPostActionEvents() {
  const postsTableBody = document.getElementById('posts-table-body');
  if (!postsTableBody) return;

  postsTableBody.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const postId = btn.getAttribute('data-id');
      openPostModal(postId);
    });
  });

  postsTableBody.querySelectorAll('.approve-post-table-btn').forEach(btn => {
    const postId = btn.getAttribute('data-id');
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmAction('Bạn có chắc muốn duyệt bài đăng này?', () => approvePost(postId)); });
  });
  postsTableBody.querySelectorAll('.reject-post-table-btn').forEach(btn => {
    const postId = btn.getAttribute('data-id');
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmAction('Bạn có chắc muốn từ chối bài đăng này?', () => rejectPost(postId)); });
  });
  // Gắn sự kiện cho nút xóa bài đăng (nếu có)
  // postsTableBody.querySelectorAll('.delete-post-btn').forEach(btn => {
  //   const postId = btn.getAttribute('data-id');
  //   btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeletePost(postId); });
  // });
}

// Hàm khởi tạo dữ liệu từ database
async function initializeData() {
  try {
    console.log('Đang lấy dữ liệu người dùng từ API...');
    const token = getAuthToken();
    if (!token) {
        showAlert('Không tìm thấy token xác thực. Vui lòng đăng nhập lại.', 'error');
        displaySampleUsers(); // Fallback to sample users
        return;
    }

    const response = await fetch('http://localhost:3000/api/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      realUsers = data.users || [];
      displayRealUsers();
      updateStats();
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Lỗi không xác định' }));
      console.error('Lỗi API người dùng:', response.status, errorData);
      showAlert(`Không thể lấy danh sách người dùng: ${errorData.message || response.statusText}`, 'error');
      displaySampleUsers(); // Fallback
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    showAlert(`Lỗi kết nối: ${error.message}`, 'error');
    displaySampleUsers(); // Fallback
  }
  // Tải bài đăng chờ duyệt mặc định khi vào trang admin
  displayPosts('pending');
  displayActivities(); // Hiển thị hoạt động (nếu vẫn dùng localStorage)
}

function getAuthToken() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.token || '';
}

function displayRealUsers() {
  const tableBody = document.getElementById('users-table-body');
  tableBody.innerHTML = '';

  if (realUsers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-message">Chưa có người dùng nào.</td></tr>';
    return;
  }

  realUsers.forEach(user => {
    const row = document.createElement('tr');
    const statusText = user.status === 'active' ? 'Hoạt động' : 'Không hoạt động';
    const roleText = user.isAdmin ? 'Quản trị viên' : 'Người dùng';

    row.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
      <td><span class="status-badge status-${user.status}">${statusText}</span></td>
      <td><span class="status-badge ${user.isAdmin ? 'status-approved' : 'status-pending'}">${roleText}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" data-id="${user.id}" data-real="true" title="Chỉnh sửa"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete-btn" data-id="${user.id}" data-real="true" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
  attachUserActionEvents();
}

async function saveUser() {
  const userId = document.getElementById('user-id').value;
  const name = document.getElementById('user-name').value;
  const email = document.getElementById('user-email').value;
  const password = document.getElementById('user-password').value;
  const status = document.getElementById('user-status').value;
  const role = document.getElementById('user-role').value;
  // const isReal = document.getElementById('user-is-real').value === 'true'; // isReal luôn là true khi lưu từ form này

  if (!name || !email) {
    showAlert('Vui lòng điền đầy đủ tên và email.', 'error');
    return;
  }

  try {
    const isAdmin = role === 'admin';
    const userData = { name, email, isAdmin, status };
    if (password) userData.password = password;

    let response;
    const token = getAuthToken();
    if (!token) {
        showAlert('Token không hợp lệ.', 'error');
        return;
    }

    if (userId) {
      response = await fetch(`http://localhost:3000/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userData)
      });
    } else {
      if (!password) {
        showAlert('Vui lòng nhập mật khẩu cho người dùng mới.', 'error');
        return;
      }
      response = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userData)
      });
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Lỗi lưu người dùng');

    document.getElementById('user-modal').classList.remove('active');
    addActivity('user', userId ? `Cập nhật người dùng ${name}` : `Thêm người dùng ${name}`);
    showAlert(userId ? 'Cập nhật thành công!' : 'Thêm mới thành công!', 'success');
    await initializeData(); // Tải lại danh sách người dùng
  } catch (error) {
    console.error('Lỗi khi lưu người dùng:', error);
    showAlert(`Lỗi: ${error.message}`, 'error');
  }
}

function confirmDeleteUser(userId, isReal = false) { // isReal vẫn giữ để tương thích nếu có logic khác
    confirmAction('Bạn có chắc chắn muốn xóa người dùng này không?', () => deleteUser(userId, true)); // Luôn coi là isReal = true
}

async function deleteUser(userId, isReal = false) { // isReal vẫn giữ
  document.getElementById('confirm-modal').classList.remove('active');
  // Luôn xóa từ API
  try {
    const token = getAuthToken();
    if (!token) {
        showAlert('Token không hợp lệ.', 'error');
        return;
    }
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Lỗi xóa người dùng');
    }
    addActivity('user', 'Đã xóa người dùng');
    showAlert('Xóa người dùng thành công!', 'success');
    await initializeData(); // Tải lại danh sách
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);
    showAlert(`Lỗi: ${error.message}`, 'error');
  }
}

async function openUserModal(userId = null, isReal = false) { // isReal vẫn giữ
  const modal = document.getElementById('user-modal');
  const modalTitle = document.getElementById('user-modal-title');
  const userForm = document.getElementById('user-form');
  const userIdField = document.getElementById('user-id');
  const userNameField = document.getElementById('user-name');
  const userEmailField = document.getElementById('user-email');
  const userPasswordField = document.getElementById('user-password');
  const userStatusField = document.getElementById('user-status');
  const userRoleField = document.getElementById('user-role');
  // const userIsRealField = document.getElementById('user-is-real'); // Không cần nữa nếu luôn là real

  modalTitle.textContent = userId ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới';
  userForm.reset();
  userIdField.value = userId || '';

  if (userId) { // Luôn lấy từ API nếu có userId
    try {
      const token = getAuthToken();
      if (!token) {
          showAlert('Token không hợp lệ.', 'error');
          return;
      }
      const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Không thể lấy thông tin người dùng');
      const data = await response.json();
      const user = data.user;

      userNameField.value = user.name || '';
      userEmailField.value = user.email || '';
      userPasswordField.value = '';
      userStatusField.value = user.status || 'active';
      userRoleField.value = user.isAdmin ? 'admin' : 'user';
    } catch (error) {
      console.error('Lỗi lấy thông tin người dùng:', error);
      showAlert('Không thể lấy thông tin người dùng', 'error');
      return;
    }
    userPasswordField.required = false;
    document.querySelector('label[for="user-password"]').textContent = 'Mật khẩu (để trống nếu không thay đổi)';
  } else {
    userPasswordField.required = true;
    document.querySelector('label[for="user-password"]').textContent = 'Mật khẩu *';
  }
  modal.classList.add('active');
}

// --- Post Management Functions ---
async function openPostModal(postId) {
  const modal = document.getElementById('post-modal');
  const titleEl = document.getElementById('post-modal-title'); // Sửa ID này nếu khác
  const authorEl = document.getElementById('post-modal-author');
  const dateEl = document.getElementById('post-modal-date');
  const statusEl = document.getElementById('post-modal-status'); // Thêm nếu có
  const contentEl = document.getElementById('post-content'); // Sửa lại ID thành 'post-content'
  const imagesContainer = document.getElementById('post-modal-images'); // Thêm container cho ảnh
  const approveBtnModal = document.getElementById('approve-post-btn');
  const rejectBtnModal = document.getElementById('reject-post-btn');
  const token = getAuthToken();

  if (!token) {
    showAlert('Token không hợp lệ.', 'error');
    return;
  }

  // Cập nhật tiêu đề modal
  const modalHeaderTitle = modal.querySelector('.modal-header h3'); // Lấy thẻ h3 trong modal-header
  if (modalHeaderTitle) modalHeaderTitle.textContent = 'Chi tiết bài đăng';


  // Hiển thị loading
  if (titleEl) titleEl.textContent = 'Đang tải...';
  if (authorEl) authorEl.textContent = '';
  if (dateEl) dateEl.textContent = '';
  if (statusEl) statusEl.textContent = '';
  if (contentEl) contentEl.textContent = '';
  if (imagesContainer) imagesContainer.innerHTML = '';


  try {
    const response = await fetch(`http://localhost:3000/api/admin/aid-posts/${postId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể tải chi tiết bài đăng.');
    }
    const post = await response.json();
    console.log("Dữ liệu bài đăng nhận được từ API:", post);
    console.log("Tiêu đề:", post.title);
    console.log("Nội dung:", post.content); // Kiểm tra xem post.content có giá trị không
    console.log("Đường dẫn ảnh:", post.image_paths);
    if (titleEl) titleEl.textContent = post.title;
    if (authorEl) authorEl.textContent = `Người đăng: ${post.author_name || 'N/A'} (${post.author_email || 'N/A'})`;
    if (dateEl) dateEl.textContent = `Ngày đăng: ${new Date(post.created_at).toLocaleString('vi-VN')}`;

    let statusTextModal = post.status;
    if (post.status === 'pending_approval') statusTextModal = 'Chờ duyệt';
    else if (post.status === 'approved') statusTextModal = 'Đã duyệt';
    else if (post.status === 'rejected') statusTextModal = 'Đã từ chối';
    if (statusEl) statusEl.textContent = `Trạng thái: ${statusTextModal}`;

    if (contentEl) {
        console.log("Gán nội dung cho contentEl:", post.content);
        contentEl.textContent = post.content;
    } else {
        console.error("Không tìm thấy phần tử contentEl (ID: post-content)");
    }

    if (imagesContainer) {
        imagesContainer.innerHTML = ''; // Xóa ảnh cũ
        if (post.image_paths) {
            const imagePathsArray = post.image_paths.split(',');
            imagePathsArray.forEach(path => {
                if (path.trim()) {
                    const img = document.createElement('img');
                    const imagePath = path.trim();
                                    let fullImagePath = imagePath;
                                    if (!imagePath.startsWith('/')) {
                                        fullImagePath = '/' + imagePath;
                                    }
                                    img.src = `http://localhost:3000${fullImagePath}`;
                    img.alt = "Hình ảnh bài đăng";
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '200px'; // Giới hạn chiều cao ảnh trong modal
                    img.style.margin = '5px';
                    img.style.objectFit = 'contain';
                    img.style.cursor = 'pointer';
                    img.onclick = () => window.open(img.src, '_blank');
                    imagesContainer.appendChild(img);
                }
            });
        } else {
          console.log("post.image_paths là null hoặc rỗng.");
            imagesContainer.innerHTML = '<p>Không có hình ảnh.</p>';
        }
    }
    else {
        console.error("Không tìm thấy phần tử imagesContainer (ID: post-modal-images)");
    }



    approveBtnModal.dataset.id = postId;
    rejectBtnModal.dataset.id = postId;

    approveBtnModal.style.display = (post.status === 'pending_approval') ? 'inline-block' : 'none';
    rejectBtnModal.style.display = (post.status === 'pending_approval') ? 'inline-block' : 'none';

    modal.classList.add('active');
  } catch (error) {
    showAlert(`Lỗi tải chi tiết bài đăng: ${error.message}`, 'error');
    if (titleEl) titleEl.textContent = 'Lỗi tải dữ liệu';
  }
}
async function approvePost(postId) {
  const token = getAuthToken();
  if (!token) {
    showAlert('Token không hợp lệ.', 'error');
    return;
  }
  try {
    const response = await fetch(`http://localhost:3000/api/admin/aid-posts/${postId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Lỗi duyệt bài');

    showAlert(data.message, 'success');
    document.getElementById('post-modal').classList.remove('active');
    const currentFilter = document.getElementById('post-status-filter').value;
    displayPosts(currentFilter || 'pending'); // Tải lại danh sách bài đăng
    addActivity('post', `Đã duyệt bài đăng ID: ${postId}`);
  } catch (error) {
    showAlert(`Lỗi: ${error.message}`, 'error');
  }
}

async function rejectPost(postId) {
  const token = getAuthToken();
  if (!token) {
    showAlert('Token không hợp lệ.', 'error');
    return;
  }
  try {
    const response = await fetch(`http://localhost:3000/api/admin/aid-posts/${postId}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Lỗi từ chối bài');

    showAlert(data.message, 'success');
    document.getElementById('post-modal').classList.remove('active');
    const currentFilter = document.getElementById('post-status-filter').value;
    displayPosts(currentFilter || 'pending'); // Tải lại danh sách
    addActivity('post', `Đã từ chối bài đăng ID: ${postId}`);
  } catch (error) {
    showAlert(`Lỗi: ${error.message}`, 'error');
  }
}

// Hàm xác nhận hành động chung
function confirmAction(message, callback) {
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-modal-title');
    const confirmMessage = document.getElementById('confirm-modal-message');
    const confirmActionBtn = document.getElementById('confirm-action');

    confirmTitle.textContent = 'Xác nhận hành động';
    confirmMessage.textContent = message;
    confirmModal.classList.add('active');

    // Gỡ bỏ event listener cũ để tránh gọi nhiều lần
    const newConfirmActionBtn = confirmActionBtn.cloneNode(true);
    confirmActionBtn.parentNode.replaceChild(newConfirmActionBtn, confirmActionBtn);
    
    newConfirmActionBtn.onclick = () => {
        callback();
        confirmModal.classList.remove('active');
    };
}

// Hàm hiển thị thông báo
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container') || createAlertContainer();
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span class="alert-message">${message}</span>
    <button class="alert-close"><i class="fas fa-times"></i></button>
  `;
  alertContainer.appendChild(alert);
  setTimeout(() => {
    alert.classList.add('fade-out');
    setTimeout(() => alert.remove(), 500);
  }, 5000);
  alert.querySelector('.alert-close').addEventListener('click', () => {
    alert.classList.add('fade-out');
    setTimeout(() => alert.remove(), 500);
  });
}

function createAlertContainer() {
  const container = document.createElement('div');
  container.id = 'alert-container';
  document.body.appendChild(container);
  return container;
}

// Tour Management Functions
let currentPage = 1;
const itemsPerPage = 10;

function loadTourRegistrations() {
    const token = getAuthToken();
    fetch('/api/tour-registrations', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        displayTourRegistrations(data);
    })
    .catch(error => {
        console.error('Error loading tour registrations:', error);
        document.getElementById('tours-table-body').innerHTML = `
            <tr>
                <td colspan="11" class="empty-message">Không thể tải dữ liệu. Vui lòng thử lại sau.</td>
            </tr>
        `;
    });
}

function displayTourRegistrations(data) {
    const tbody = document.getElementById('tours-table-body');
    const selectedTour = document.getElementById('tour-filter').value;
    
    tbody.innerHTML = '';
    
    if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-message">Không có dữ liệu đăng ký tour.</td>
            </tr>
        `;
        return;
    }

    // Lọc dữ liệu theo tour được chọn
    const filteredData = selectedTour 
        ? data.filter(item => item.tour_id.toLowerCase() === selectedTour.toLowerCase())
        : data;

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-message">Không có dữ liệu cho tour này.</td>
            </tr>
        `;
        return;
    }

    filteredData.forEach(registration => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${registration.id}</td>
            <td>${registration.tour_id}</td>
            <td>${registration.full_name}</td>
            <td>${formatDate(registration.birthdate)}</td>
            <td>${registration.phone}</td>
            <td>${registration.id_card}</td>
            <td>${registration.email}</td>
            <td>${registration.trip_name}</td>
            <td>${formatDate(registration.departure_date)}</td>
            <td>${formatDate(registration.registration_date)}</td>
            <td>${registration.registration_time}</td>
        `;
        tbody.appendChild(row);
    });
}

// Cập nhật hàm exportToExcel để áp dụng bộ lọc khi xuất Excel
function exportToExcel() {
    const token = getAuthToken();
    const selectedTour = document.getElementById('tour-filter').value;

    fetch('/api/tour-registrations', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
            showAlert('Không có dữ liệu để xuất', 'error');
            return;
        }

        // Lọc dữ liệu theo tour được chọn trước khi xuất
        const filteredData = selectedTour 
            ? data.filter(item => item.tour_id === selectedTour)
            : data;

        if (filteredData.length === 0) {
            showAlert('Không có dữ liệu để xuất cho tour này', 'error');
            return;
        }

        // Format data for Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
            'ID': item.id,
            'Mã Tour': item.tour_id,
            'Tên khách hàng': item.full_name,
            'Ngày sinh': formatDate(item.birthdate),
            'Số điện thoại': item.phone,
            'CMND/CCCD': item.id_card,
            'Email': item.email,
            'Tên Tour': item.trip_name,
            'Ngày khởi hành': formatDate(item.departure_date),
            'Ngày đăng ký': formatDate(item.registration_date),
            'Giờ đăng ký': item.registration_time
        })));

        const fileName = selectedTour 
            ? `danh_sach_dang_ky_tour_${selectedTour}_${new Date().toISOString().split('T')[0]}.xlsx`
            : `danh_sach_dang_ky_tour_${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tour Registrations');
        XLSX.writeFile(workbook, fileName);
    })
    .catch(error => {
        console.error('Error exporting to Excel:', error);
        showAlert('Lỗi khi xuất file Excel', 'error');
    });
}

// Add event listener cho filter
document.addEventListener('DOMContentLoaded', () => {
    const tourFilter = document.getElementById('tour-filter');
    const exportBtn = document.getElementById('export-excel-btn');
    
    if (tourFilter) {
        tourFilter.addEventListener('change', () => {
            loadTourRegistrations();
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
    }

    // Load dữ liệu ban đầu
    loadTourRegistrations();
});

function updateDashboardStats() {
    const token = getAuthToken();

    // Cập nhật số lượng người dùng
    fetch('http://localhost:3000/api/admin/users/count', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        document.getElementById('user-count').textContent = data.count || 0;
    })
    .catch(error => {
        console.error('Error fetching user count:', error);
        document.getElementById('user-count').textContent = '0';
    });

    // Cập nhật số lượng bài đã duyệt
    fetch('http://localhost:3000/api/admin/posts/approved/count', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        document.getElementById('post-count').textContent = data.count || 0;
    })
    .catch(error => {
        console.error('Error fetching approved posts count:', error);
        document.getElementById('post-count').textContent = '0';
    });

    // Cập nhật số lượng bài chờ duyệt
    fetch('http://localhost:3000/api/admin/posts/pending/count', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        document.getElementById('pending-count').textContent = data.count || 0;
    })
    .catch(error => {
        console.error('Error fetching pending posts count:', error);
        document.getElementById('pending-count').textContent = '0';
    });
}

// Thêm vào DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    
    // Cập nhật thống kê dashboard
    updateDashboardStats();
    
    // Cập nhật tự động mỗi 30 giây
    setInterval(updateDashboardStats, 30000);
});
