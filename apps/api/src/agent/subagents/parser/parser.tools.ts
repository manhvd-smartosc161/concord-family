import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions sent to Claude. The LLM "calls" these by emitting a
 * `tool_use` block; we intercept the call in the subagent and execute the
 * matching service method.
 */
export const logTransactionTool: Anthropic.Tool = {
  name: 'log_transaction',
  description:
    "Log a single transaction to the user's books. Call once per transaction. " +
    'Negative amount = expense, positive = income.',
  input_schema: {
    type: 'object',
    properties: {
      fundName: {
        type: 'string',
        description:
          'Tên quỹ EXACT từ list "Quỹ user CÓ THỂ ghi vào" trong context. KHÔNG bịa.',
      },
      amount: {
        type: 'number',
        description:
          'Số VND. ÂM khi chi tiêu, DƯƠNG khi thu nhập. Ví dụ -200000 hoặc 25000000.',
      },
      categoryName: {
        type: 'string',
        description:
          'Tên category sát nhất từ context. Có thể là tên top-level hoặc sub. Để rỗng nếu không chắc.',
      },
      note: {
        type: 'string',
        description: 'Ghi chú ngắn (≤80 chars), tiếng Việt, tóm tắt giao dịch.',
      },
      date: {
        type: 'string',
        description:
          'ISO 8601 datetime (vd "2026-05-06T14:30:00+07:00"). Bỏ trống = dùng now.',
      },
    },
    required: ['fundName', 'amount'],
  },
};

export const askClarificationTool: Anthropic.Tool = {
  name: 'ask_clarification',
  description:
    'Ask the user for missing information instead of guessing. Use when amount, ' +
    'fund, or other critical info is unclear.',
  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Câu hỏi tiếng Việt ngắn, cụ thể, ≤120 chars.',
      },
    },
    required: ['question'],
  },
};

export const updateTransactionTool: Anthropic.Tool = {
  name: 'update_transaction',
  description:
    'Sửa 1 transaction đã log trước đó (đổi quỹ / số tiền / category / note). ' +
    'Dùng khi user clarify hoặc đính chính giao dịch vừa rồi (vd: "ý tôi là quỹ chung", ' +
    '"không phải 200k mà 300k"). Lấy txn_id từ list "Giao dịch gần nhất" trong context. ' +
    'Chỉ truyền các field cần đổi — field bỏ qua sẽ giữ nguyên.',
  input_schema: {
    type: 'object',
    properties: {
      txn_id: {
        type: 'string',
        description:
          'UUID của transaction cần sửa, lấy từ "Giao dịch gần nhất" trong context.',
      },
      fundName: {
        type: 'string',
        description: 'Tên quỹ mới (nếu đổi quỹ). EXACT từ list quỹ.',
      },
      amount: {
        type: 'number',
        description: 'Số VND mới (nếu đổi). ÂM = chi, DƯƠNG = thu.',
      },
      categoryName: {
        type: 'string',
        description: 'Category mới. Truyền chuỗi rỗng để xoá category.',
      },
      note: {
        type: 'string',
        description: 'Note mới. Truyền chuỗi rỗng để xoá note.',
      },
    },
    required: ['txn_id'],
  },
};

export const deleteTransactionTool: Anthropic.Tool = {
  name: 'delete_transaction',
  description:
    'Xoá 1 transaction đã log trước đó (hoàn lại số dư quỹ). Dùng khi user nói ' +
    '"huỷ giao dịch vừa rồi", "xoá đi", "bỏ giao dịch X", hoặc khi đính chính ' +
    'mà transfer 2 leg cần huỷ cả 2. Lấy txn_id từ "Giao dịch gần nhất".',
  input_schema: {
    type: 'object',
    properties: {
      txn_id: {
        type: 'string',
        description: 'UUID của transaction cần xoá.',
      },
    },
    required: ['txn_id'],
  },
};

export const createCategoryTool: Anthropic.Tool = {
  name: 'create_category',
  description:
    'Tạo category mới khi user yêu cầu hoặc không tìm thấy category phù hợp. ' +
    'Tự quyết isEssential và parentName. ' +
    'PHẢI gọi ask_clarification để xác nhận trước (trừ khi user đã confirm rõ ràng).',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Tên category mới, tiếng Việt, ≤100 ký tự.',
      },
      icon: {
        type: 'string',
        description: 'Emoji đại diện (vd "🐾"). Bỏ trống nếu không chắc.',
      },
      isEssential: {
        type: 'boolean',
        description:
          'true = thiết yếu (ăn uống, sức khỏe, đi lại, nhà cửa, con cái, thú cưng). ' +
          'false = không thiết yếu (giải trí, mua sắm, cá nhân, quà tặng).',
      },
      parentName: {
        type: 'string',
        description:
          'Tên category cha top-level muốn xếp vào. Bỏ trống nếu nên là top-level riêng.',
      },
    },
    required: ['name', 'isEssential'],
  },
};

export const proposeImportantDateTool: Anthropic.Tool = {
  name: 'propose_important_date',
  description:
    'Đề xuất tạo 1 ngày quan trọng (sinh nhật / giỗ / kỷ niệm). ' +
    'Đây là PROPOSAL — chưa lưu DB. User sẽ confirm ở FE. ' +
    'Nếu user nói NHIỀU ngày trong 1 message, gọi tool này NHIỀU LẦN, mỗi lần 1 ngày.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Tên ngày, tiếng Việt, ≤120 chars. Vd: "Sinh nhật vợ", "Giỗ bố", "Kỷ niệm cưới".',
      },
      type: {
        type: 'string',
        enum: ['birthday', 'death_anniversary', 'anniversary', 'other'],
        description:
          '"birthday" cho sinh nhật, "death_anniversary" cho giỗ/ngày mất, ' +
          '"anniversary" cho kỷ niệm/ngày cưới/đám hỏi, "other" cho các loại khác.',
      },
      date: {
        type: 'string',
        description:
          'Ngày, định dạng ISO 8601 YYYY-MM-DD (vd "2026-12-25"). Lấy năm hiện tại nếu user không nói rõ.',
      },
      isLunar: {
        type: 'boolean',
        description:
          'true nếu user nói "âm", "âm lịch", "ÂL". false nếu dương lịch hoặc không rõ.',
      },
      remindDaysBefore: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 60 },
        description:
          'Mảng số ngày nhắc trước (0 = hôm đó). MẶC ĐỊNH dùng [0, 2] khi propose từ chat.',
      },
      notes: {
        type: 'string',
        description:
          'Ghi chú tuỳ chọn (≤2000 chars). Bỏ trống nếu user không nói.',
      },
    },
    required: ['name', 'type', 'date', 'isLunar', 'remindDaysBefore'],
  },
};

export const logDebtPaymentTool: Anthropic.Tool = {
  name: 'log_debt_payment',
  description:
    'Ghi 1 lần thanh toán cho khoản nợ/cho vay đã có. Tự động tạo transaction (chi nếu trả nợ, thu nếu nhận lại tiền cho vay) trên quỹ user chọn + giảm outstanding của debt. ' +
    'Dùng khi user nói "đã trả X cho thẻ Y", "trả nợ Z 500k bằng quỹ chung", "nhận lại 1tr từ anh A", v.v. ' +
    'PHẢI gọi sau khi đã xác định được debtId từ list "Khoản nợ/cho vay đang mở" trong context (hoặc qua match fuzzy). ' +
    'Nếu không tìm thấy debt phù hợp → dùng ask_clarification hoặc propose_new_debt thay vì bịa.',
  input_schema: {
    type: 'object',
    properties: {
      debtId: {
        type: 'string',
        description:
          'UUID của debt từ list "Khoản nợ/cho vay đang mở" trong context. KHÔNG bịa.',
      },
      fundName: {
        type: 'string',
        description:
          'Tên quỹ EXACT từ list "Quỹ user CÓ THỂ ghi vào". Nguồn tiền chi để trả nợ, hoặc đích đến khi nhận trả lại tiền cho vay.',
      },
      amount: {
        type: 'number',
        description:
          'Số VND của lần thanh toán (luôn DƯƠNG, không phụ thuộc hướng debt). Vd: 2000000.',
      },
      paidAt: {
        type: 'string',
        description: 'ISO 8601 datetime của ngày trả. Bỏ trống = now.',
      },
      note: {
        type: 'string',
        description: 'Ghi chú ngắn ≤80 chars (tuỳ chọn).',
      },
    },
    required: ['debtId', 'fundName', 'amount'],
  },
};

export const proposeNewDebtTool: Anthropic.Tool = {
  name: 'propose_new_debt',
  description:
    'Tạo MỚI 1 khoản nợ/cho vay khi user vừa phát sinh nợ/cho vay mới (chưa có trong list). ' +
    'Vd: "vay anh Tuấn 5tr", "cho em Hằng vay 3 triệu", "nợ thẻ Sacombank 8tr". ' +
    'Tự động tạo debt entity với outstanding = principal. ' +
    'NẾU user nói rõ quỹ (vd "vay từ quỹ chung", "cho vay bằng quỹ riêng") → truyền thêm fundName để tự tạo transaction tương ứng (vay = thu vào quỹ, cho vay = chi ra). ' +
    'NẾU user KHÔNG nói rõ quỹ → bỏ trống fundName + gọi thêm ask_clarification hỏi quỹ.',
  input_schema: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['i_owe', 'they_owe_me'],
        description:
          '"i_owe" = tôi đang nợ ai (vay tiền, thẻ tín dụng); "they_owe_me" = tôi cho ai vay.',
      },
      counterparty: {
        type: 'string',
        description:
          'Tên bên đối tác, tiếng Việt, ≤200 chars. Vd: "Thẻ Sacombank", "Anh Tuấn", "Em Hằng".',
      },
      principal: {
        type: 'number',
        description: 'Số tiền gốc (VND, luôn dương). Vd: 5000000.',
      },
      visibility: {
        type: 'string',
        enum: ['private', 'shared'],
        description:
          '"private" = chỉ mình thấy (mặc định cho khoản cá nhân); "shared" = cả nhà thấy (khi nói "gia đình", "vợ chồng", "chúng tôi").',
      },
      dueDate: {
        type: 'string',
        description: 'Ngày đến hạn YYYY-MM-DD (tuỳ chọn).',
      },
      note: {
        type: 'string',
        description: 'Ghi chú (tuỳ chọn, ≤500 chars).',
      },
      fundName: {
        type: 'string',
        description:
          'Tên quỹ EXACT từ list "Quỹ user CÓ THỂ ghi vào" — nếu user nói rõ tiền vay vào quỹ này (i_owe) hoặc tiền cho vay ra từ quỹ này (they_owe_me). Bỏ trống nếu user không nói.',
      },
    },
    required: ['direction', 'counterparty', 'principal'],
  },
};

export const parserTools: Anthropic.Tool[] = [
  logTransactionTool,
  askClarificationTool,
  updateTransactionTool,
  deleteTransactionTool,
  createCategoryTool,
  proposeImportantDateTool,
  logDebtPaymentTool,
  proposeNewDebtTool,
];

// ─── Input types (mirror of input_schema for type safety in executor) ─────

export interface LogTransactionInput {
  fundName: string;
  amount: number;
  categoryName?: string;
  note?: string;
  date?: string;
}

export interface AskClarificationInput {
  question: string;
}

export interface UpdateTransactionInput {
  txn_id: string;
  fundName?: string;
  amount?: number;
  categoryName?: string;
  note?: string;
}

export interface DeleteTransactionInput {
  txn_id: string;
}

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  isEssential: boolean;
  parentName?: string;
}

export interface ProposeImportantDateInput {
  name: string;
  type: 'birthday' | 'death_anniversary' | 'anniversary' | 'other';
  date: string;
  isLunar: boolean;
  remindDaysBefore: number[];
  notes?: string;
}

export interface LogDebtPaymentInput {
  debtId: string;
  fundName: string;
  amount: number;
  paidAt?: string;
  note?: string;
}

export interface ProposeNewDebtInput {
  direction: 'i_owe' | 'they_owe_me';
  counterparty: string;
  principal: number;
  visibility?: 'private' | 'shared';
  dueDate?: string;
  note?: string;
  fundName?: string;
}
