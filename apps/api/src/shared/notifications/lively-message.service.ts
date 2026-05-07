import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from '../../agent/core/anthropic.service';

export interface LivelyInput {
  name: string;
  kindLabel: string;
  daysBefore: number;
  notes: string | null;
}

@Injectable()
export class LivelyMessageService {
  private readonly logger = new Logger(LivelyMessageService.name);

  constructor(private readonly anthropic: AnthropicService) {}

  async generate(input: LivelyInput): Promise<string> {
    try {
      const dayPhrase =
        input.daysBefore === 0
          ? 'hôm nay'
          : input.daysBefore > 0
            ? `còn ${input.daysBefore} ngày nữa`
            : `cách đây ${Math.abs(input.daysBefore)} ngày`;

      const system = [
        'Bạn là 1 người bạn ấm áp giúp 1 cặp đôi Việt Nam nhắc nhau ngày quan trọng qua email.',
        'Viết 2-3 câu tiếng Việt, ấm áp và mùi mẫn nhưng KHÔNG sến súa, KHÔNG dùng emoji.',
        'KHÔNG lặp lại tên sự kiện hay con số ngày — nó đã nằm ở subject của email.',
        'Câu chữ tự nhiên, gợi cảm xúc gắn kết gia đình. Nếu là giỗ chạp/death anniversary → trang trọng, không vui đùa. Nếu sinh nhật/kỷ niệm → ấm áp. Lễ quốc tế → động viên nhẹ.',
        'Trả thẳng message, không kèm "Đây là message:" hay câu mở đầu nào.',
      ].join('\n');

      const user = [
        `Sự kiện: ${input.name}`,
        `Loại: ${input.kindLabel}`,
        `Thời điểm: ${dayPhrase}`,
        input.notes ? `Ghi chú: ${input.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const resp = await this.anthropic.client.messages.create({
        model: this.anthropic.fastModel,
        max_tokens: 256,
        system: [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: user }],
      });
      const block = resp.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') return this.fallback(input);
      const text = block.text.trim();
      return text.length > 0 ? text : this.fallback(input);
    } catch (err) {
      this.logger.warn(
        `lively gen failed, using fallback: ${(err as Error).message}`,
      );
      return this.fallback(input);
    }
  }

  private fallback(input: LivelyInput): string {
    if (input.daysBefore === 0) {
      return 'Đừng quên nhé — sự kiện hôm nay là dịp để hai vợ chồng cùng chuẩn bị và dành thời gian cho nhau.';
    }
    if (input.daysBefore > 0) {
      return 'Còn vài ngày nữa thôi — tranh thủ chuẩn bị sớm để mọi thứ trọn vẹn nhé.';
    }
    return 'Concord ghi lại để hai vợ chồng cùng nhớ về dịp này.';
  }
}
