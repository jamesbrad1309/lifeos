import type { shell as en } from "#i18n/en/shell";

export const shell: typeof en = {
  appName: "LifeOS",
  nav: {
    groups: { habits: "Thói quen", mind: "Tâm trí", money: "Tài chính", comingSoon: "Sắp ra mắt" },
    dashboard: "Tổng quan",
    today: "Hôm nay",
    journal: "Nhật ký",
    accounts: "Tài khoản",
    transactions: "Giao dịch",
    spending: "Chi tiêu",
    budgets: "Ngân sách",
    currencies: "Tiền tệ",
    comingSoonItem: "{{label}} (sắp ra mắt)",
    toReview: "{{count}} mục cần xem lại",
    mainLabel: "Chính",
  },
  pages: {
    dashboard: { title: "Tổng quan", subtitle: "Giữ vững chuỗi ngày của bạn." },
    today: { title: "Hôm nay", subtitle: "Việc cần làm, theo từng giờ." },
    journal: {
      title: "Nhật ký",
      subtitle: "Bạn đã làm gì, cảm thấy ra sao, và điều gì đã xảy ra.",
    },
    accounts: { title: "Tài khoản", subtitle: "Tiền của bạn ở đâu, và bạn đang nợ gì." },
    transactions: {
      title: "Giao dịch",
      subtitle: "Mọi khoản đã ghi, và những gì còn cần phân loại.",
    },
    spending: { title: "Chi tiêu", subtitle: "Tiền đã đi đâu, theo danh mục." },
    budgets: {
      title: "Ngân sách",
      subtitle: "Hạn mức hằng tháng, và tốc độ chi tiêu trong tháng.",
    },
    currencies: {
      title: "Tiền tệ",
      subtitle: "Các loại tiền bạn dùng, và loại tiền dùng để tính tổng.",
    },
    notFound: { title: "Không tìm thấy", subtitle: "Liên kết này không dẫn đến đâu cả." },
  },
  appBar: {
    navigation: "Điều hướng",
    openNavigation: "Mở điều hướng",
    expandSidebar: "Mở rộng thanh bên",
    collapseSidebar: "Thu gọn thanh bên",
    lightMode: "Chế độ sáng",
    darkMode: "Chế độ tối",
    switchToLight: "Chuyển sang chế độ sáng",
    switchToDark: "Chuyển sang chế độ tối",
    language: "Ngôn ngữ",
  },
  level: {
    level: "Cấp {{level}}",
    progress: "{{into}} / {{needed}} XP để lên cấp {{next}}",
    tooltip: "Cấp {{level}} · {{title}} · {{into}}/{{needed}} XP",
    titles: [
      "Người mới bắt đầu",
      "Khởi động",
      "Tạo đà",
      "Kiên định",
      "Tận tâm",
      "Bậc thầy thói quen",
    ],
  },
  route: {
    loading: "Đang tải…",
    error: "Đã xảy ra lỗi khi tải trang này.",
    tryAgain: "Thử lại",
    notFound: "Không có trang nào ở đây.",
    goHome: "Về trang tổng quan",
  },
};
