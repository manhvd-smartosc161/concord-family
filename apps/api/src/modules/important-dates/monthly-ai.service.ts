import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnthropicService } from '../../agent/core/anthropic.service';
import {
  AiDateItem,
  AiDateKind,
  MonthlyAiCache,
} from './entities/monthly-ai-cache.entity';

const VALID_KINDS: AiDateKind[] = [
  'lunar',
  'national',
  'international',
  'religious',
  'other',
];

@Injectable()
export class MonthlyAiService {
  private readonly logger = new Logger(MonthlyAiService.name);

  constructor(
    private readonly anthropic: AnthropicService,
    @InjectRepository(MonthlyAiCache)
    private readonly repo: Repository<MonthlyAiCache>,
  ) {}

  async getOrGenerate(year: number, month: number): Promise<MonthlyAiCache> {
    const existing = await this.repo.findOne({ where: { year, month } });
    if (existing) return existing;
    return this.regenerate(year, month);
  }

  async regenerate(year: number, month: number): Promise<MonthlyAiCache> {
    const items = await this.callAi(year, month);
    const existing = await this.repo.findOne({ where: { year, month } });
    if (existing) {
      existing.items = items;
      existing.generatedAt = new Date();
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        year,
        month,
        items,
        generatedAt: new Date(),
      }),
    );
  }

  private async callAi(year: number, month: number): Promise<AiDateItem[]> {
    const monthName = `tháng ${month}/${year}`;
    const system = [
      'Bạn là agent giúp 1 cặp đôi Việt Nam track ngày quan trọng theo lịch dương lịch hằng tháng.',
      'Trả về danh sách các ngày quan trọng (NGOẠI TRỪ sinh nhật/giỗ chạp/kỷ niệm cá nhân — user tự config).',
      'Bao gồm: mùng 1 + rằm âm lịch rơi trong tháng (chuyển sang dương), Tết, các lễ Việt Nam (30/4, 2/9, Giỗ tổ 10/3 âm…), lễ quốc tế (8/3, 1/5, 1/6, 20/10, 20/11, Trung thu, Vu Lan…).',
      'Output PHẢI là JSON array thuần, không kèm text giải thích, không markdown code fence.',
      'Mỗi item:',
      '  - date: "YYYY-MM-DD" dương lịch trong tháng',
      '  - name: tên ngắn tiếng Việt (vd "Rằm tháng 4 âm", "8/3 - Quốc tế phụ nữ", "Tết Nguyên Đán")',
      '  - kind: "lunar" | "national" | "international" | "religious" | "other"',
      '  - notes: mô tả rất ngắn (string hoặc null)',
      '  - remindDaysBefore: array số nguyên ≥0, vd [2,0] hoặc [7,3,0] cho ngày lớn như Tết. Mùng 1/rằm: [2,0]. Lễ thường: [1,0]. Tết: [7,3,0].',
      'Sort theo date ascending. Date ngày âm lịch chuyển chính xác sang dương lịch.',
    ].join('\n');

    const user = `Liệt kê ngày quan trọng cho ${monthName}. Trả JSON array.`;

    const resp = await this.anthropic.client.messages.create({
      model: this.anthropic.fastModel,
      max_tokens: 2048,
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: user }],
    });

    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      throw new Error('AI returned no text content');
    }
    const raw = block.text.trim();
    const jsonStart = raw.indexOf('[');
    const jsonEnd = raw.lastIndexOf(']');
    if (jsonStart < 0 || jsonEnd < 0) {
      this.logger.error(`AI raw output: ${raw}`);
      throw new Error('AI did not return a JSON array');
    }
    const json = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) throw new Error('AI output is not an array');

    return parsed
      .map((x) => this.sanitize(x as Record<string, unknown>, year, month))
      .filter((x): x is AiDateItem => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private sanitize(
    raw: Record<string, unknown>,
    year: number,
    month: number,
  ): AiDateItem | null {
    const date = typeof raw.date === 'string' ? raw.date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [y, m] = date.split('-').map(Number);
    if (y !== year || m !== month) return null;

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return null;

    const kind = (
      VALID_KINDS.includes(raw.kind as AiDateKind)
        ? raw.kind
        : 'other'
    ) as AiDateKind;

    const notes =
      typeof raw.notes === 'string' && raw.notes.trim()
        ? raw.notes.trim()
        : null;

    const remind = Array.isArray(raw.remindDaysBefore)
      ? (raw.remindDaysBefore as unknown[])
          .map((n) => (typeof n === 'number' ? Math.floor(n) : NaN))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 60)
      : [0];
    const dedup = Array.from(new Set(remind.length > 0 ? remind : [0])).sort(
      (a, b) => a - b,
    );

    return { date, name, kind, notes, remindDaysBefore: dedup };
  }
}
