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
          'Tên quỹ chính xác trong context (vd "Quỹ Mạnh", "Quỹ Vợ", "Quỹ Chung").',
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

export const parserTools: Anthropic.Tool[] = [
  logTransactionTool,
  askClarificationTool,
  updateTransactionTool,
  deleteTransactionTool,
  createCategoryTool,
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
