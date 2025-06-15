document.addEventListener("DOMContentLoaded", function () {
    console.log("Bản đồ đã load!");

    const paths = document.querySelectorAll("path");
    const tooltip = document.getElementById("tooltip");
    const map = document.getElementById("map");

    paths.forEach((path) => {
        path.addEventListener("click", async function (e) {
            const provinceId = this.id;
            const provinceName = this.getAttribute('data-name') || provinceId;
            console.log(`Đã nhấp vào tỉnh: ${provinceName} (ID: ${provinceId})`); // Log tên tỉnh được lấy từ bản đồ

            tooltip.innerHTML = `<strong>${provinceName}</strong><br>Đang tải bài đăng...`;
            tooltip.style.display = "block";

            try {
                const apiUrl = `http://localhost:3000/api/public/approved-aid-posts/by-province/${encodeURIComponent(provinceName)}`;
                console.log(`Gọi API: ${apiUrl}`); // Log URL API sẽ gọi
                const response = await fetch(
                    apiUrl
                );

                if (!response.ok) {
                    tooltip.innerHTML = `<strong>${provinceName}</strong><br>Chưa có thông tin bài đăng hoặc lỗi tải.`;
                    console.error(`Lỗi API cho tỉnh ${provinceName}: ${response.status}`);
                    const errorData = await response.text(); // Log thêm nội dung lỗi từ server
                    console.error(`Nội dung lỗi từ server: ${errorData}`);
                    return;
                }

                const posts = await response.json();
                console.log(`Bài đăng nhận được cho tỉnh ${provinceName}:`, posts); // Log dữ liệu bài đăng nhận được
                let postsHtml = "";

                if (posts.length > 0) {
                    postsHtml = '<ul style="margin: 5px 0 0 0; padding-left: 15px; font-size: 0.9em;">';
                    posts.forEach((post) => {
                        postsHtml += `<li style="margin-bottom: 3px;"><a href="./html/chitiettin.html?id=${post.id}" target="_blank" style="color: #007bff; text-decoration: none;">${post.title}</a></li>`;
                    });
                    postsHtml += "</ul>";
                } else {
                    postsHtml = '<p style="font-size: 0.9em; margin-top: 5px;">Hiện chưa có bài đăng nào cho tỉnh này.</p>';
                }

                tooltip.innerHTML = `<strong>${provinceName}</strong>${postsHtml}`;
            } catch (error) {
                console.error("Lỗi khi tải bài đăng cho tỉnh:", error);
                tooltip.innerHTML = `<strong>${provinceName}</strong><br>Lỗi khi tải bài đăng: ${error.message}`;
            }
        });

        path.addEventListener("mousemove", function (e) {
            const name = this.getAttribute("data-name");

            if (name && tooltip.style.display !== 'block') {
                tooltip.innerHTML = `<strong>${name}</strong>`;
                tooltip.style.display = "block";
            }

            if (tooltip.style.display === 'block') {
                const offset = 10;
                let tooltipX = e.pageX - tooltip.offsetWidth - offset;
                let tooltipY = e.pageY + offset;

                const tooltipRect = tooltip.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                if (tooltipX < 0) {
                    tooltipX = e.pageX + offset;
                }
                if (tooltipY + tooltipRect.height > windowHeight) {
                    tooltipY = e.pageY - tooltipRect.height - offset;
                }
                if (tooltipY < 0) {
                    tooltipY = offset;
                }

                tooltip.style.left = tooltipX + "px";
                tooltip.style.top = tooltipY + "px";
            }
        });
    });

    map.addEventListener("mouseleave", function () {
        tooltip.style.display = "none";
    });

    const regionSelect = document.getElementById("choice-region");

    regionSelect.addEventListener("change", function () {
        const selectedRegion = this.value;
        paths.forEach((path) => {
            const region = path.getAttribute("data-mien");

            if (selectedRegion === "") {
                path.classList.remove("bac", "trung", "nam");
            } else if (region === selectedRegion) {
                path.classList.add(selectedRegion);
            } else {
                path.classList.remove("bac", "trung", "nam");
            }
        });
    });

    const searchInput = document.getElementById("search-province");

    searchInput.addEventListener("input", function () {
        const searchText = this.value.trim().toLowerCase();

        paths.forEach((path) => {
            const provinceName = path.getAttribute("data-name").toLowerCase();

            if (searchText === "" || provinceName.includes(searchText)) {
                path.style.opacity = "1";

                if (provinceName.includes(searchText) && searchText !== "") {
                    path.classList.add("highlight");
                } else {
                    path.classList.remove("highlight");
                }
            } else {
                path.style.opacity = "0.3";
            }
        });
    });
});
