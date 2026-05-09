export interface CategorySeed {
  name: string;
  icon?: string;
  isEssential: boolean;
  children?: Array<{ name: string; icon?: string }>;
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Ăn uống',
    icon: '🍜',
    isEssential: true,
    children: [
      { name: 'Ăn ngoài', icon: '🍽️' },
      { name: 'Cà phê / Trà sữa', icon: '☕' },
      { name: 'Đi chợ / Siêu thị', icon: '🛒' },
    ],
  },
  {
    name: 'Đi lại',
    icon: '🚗',
    isEssential: true,
    children: [
      { name: 'Xăng', icon: '⛽' },
      { name: 'Grab / Taxi', icon: '🚕' },
      { name: 'Bảo dưỡng xe', icon: '🔧' },
    ],
  },
  {
    name: 'Nhà cửa',
    icon: '🏠',
    isEssential: true,
    children: [
      { name: 'Tiền nhà / Điện nước', icon: '💡' },
      { name: 'Internet / Điện thoại', icon: '📡' },
      { name: 'Sửa chữa', icon: '🔨' },
    ],
  },
  {
    name: 'Con cái',
    icon: '👶',
    isEssential: true,
    children: [
      { name: 'Sữa / Bỉm', icon: '🍼' },
      { name: 'Học phí', icon: '📚' },
      { name: 'Đồ chơi / Sách', icon: '🧸' },
      { name: 'Khám sức khỏe', icon: '💊' },
    ],
  },
  {
    name: 'Sức khỏe',
    icon: '💪',
    isEssential: true,
    children: [
      { name: 'Khám / Thuốc', icon: '🏥' },
      { name: 'Tập gym / Thể thao', icon: '🏋️' },
    ],
  },
  {
    name: 'Chuyển nội bộ',
    icon: '🔄',
    isEssential: false,
    children: [],
  },
  {
    name: 'Mua sắm',
    icon: '🛍️',
    isEssential: false,
    children: [
      { name: 'Quần áo', icon: '👕' },
      { name: 'Đồ điện tử', icon: '📱' },
      { name: 'Mỹ phẩm', icon: '💄' },
    ],
  },
  {
    name: 'Giải trí',
    icon: '🎬',
    isEssential: false,
    children: [
      { name: 'Du lịch', icon: '✈️' },
      { name: 'Phim / Game', icon: '🎮' },
      { name: 'Hội hè / Cưới hỏi', icon: '🎉' },
    ],
  },
  {
    name: 'Cá nhân',
    icon: '💼',
    isEssential: false,
    children: [
      { name: 'Học hành', icon: '📖' },
      { name: 'Quà tặng', icon: '🎁' },
    ],
  },
  {
    name: 'Thu nhập',
    icon: '💰',
    isEssential: false,
    children: [
      { name: 'Lương', icon: '💵' },
      { name: 'Thưởng', icon: '🏅' },
      { name: 'Freelance / Khác', icon: '🪙' },
    ],
  },
];
