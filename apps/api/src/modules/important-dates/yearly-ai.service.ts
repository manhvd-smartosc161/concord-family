import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnthropicService } from '../../agent/core/anthropic.service';
import {
  AiDateItem,
  AiDateKind,
  YearlyAiCache,
} from './entities/yearly-ai-cache.entity';

const VALID_KINDS: AiDateKind[] = [
  'lunar',
  'national',
  'international',
  'religious',
  'other',
];

@Injectable()
export class YearlyAiService {
  private readonly logger = new Logger(YearlyAiService.name);

  constructor(
    private readonly anthropic: AnthropicService,
    @InjectRepository(YearlyAiCache)
    private readonly repo: Repository<YearlyAiCache>,
  ) {}

  async findCache(year: number, familyId: string): Promise<YearlyAiCache | null> {
    return this.repo.findOne({ where: { year, familyId } });
  }

  async ensureCache(year: number, familyId: string): Promise<YearlyAiCache> {
    const existing = await this.repo.findOne({ where: { year, familyId } });
    if (existing) return existing;
    return this.regenerate(year, familyId);
  }

  async regenerate(year: number, familyId: string): Promise<YearlyAiCache> {
    const items = await this.callAi(year);
    const existing = await this.repo.findOne({ where: { year, familyId } });
    if (existing) {
      existing.items = items;
      existing.generatedAt = new Date();
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        familyId,
        year,
        items,
        generatedAt: new Date(),
      }),
    );
  }

  private async callAi(year: number): Promise<AiDateItem[]> {
    const system = [
      'Bạn là agent giúp 1 cặp đôi Việt Nam liệt kê ngày quan trọng cho cả năm dương lịch.',
      'Trả về danh sách các ngày quan trọng trong CẢ NĂM (NGOẠI TRỪ sinh nhật/giỗ chạp/kỷ niệm cá nhân — user tự config).',
      'Bao gồm:',
      '  - Mùng 1 + rằm âm lịch của 12 tháng âm (chuyển chính xác sang dương lịch)',
      '  - Tết Nguyên Đán (mùng 1 tháng giêng âm)',
      '  - Tết Đoan Ngọ (mùng 5 tháng 5 âm), Vu Lan (rằm tháng 7 âm), Trung Thu (rằm tháng 8 âm), Ông Công Ông Táo (23 tháng chạp âm)',
      '  - Lễ Việt Nam dương lịch: Tết Dương lịch (1/1), Giỗ tổ Hùng Vương (10/3 âm), Giải phóng miền Nam (30/4), Quốc tế lao động (1/5), Quốc khánh (2/9)',
      '  - Lễ quốc tế: 8/3 (Quốc tế phụ nữ), 1/6 (Quốc tế thiếu nhi), 20/10 (Phụ nữ VN), 20/11 (Nhà giáo VN), 24/12 + 25/12 (Giáng sinh)',
      'Output PHẢI là JSON array thuần, KHÔNG kèm text giải thích, KHÔNG markdown code fence.',
      'Mỗi item:',
      '  - date: "YYYY-MM-DD" dương lịch trong năm',
      '  - name: tên ngắn tiếng Việt (vd "Rằm tháng 4 âm", "8/3 - Quốc tế phụ nữ", "Tết Nguyên Đán")',
      '  - kind: "lunar" | "national" | "international" | "religious" | "other"',
      '  - notes: mô tả rất ngắn (string hoặc null)',
      '  - remindDaysBefore: array số nguyên ≥0. Tết Nguyên Đán: [7,3,0]. Mùng 1/rằm thường: [2,0]. Lễ lớn (30/4, 2/9, Trung Thu): [3,0]. Lễ quốc tế thường (8/3, 20/10, 20/11): [1,0]. Lễ nhỏ: [0].',
      'Sort theo date ascending. Đảm bảo conversion âm-dương chuẩn xác (ví dụ Tết 2026 = 17/02/2026).',
    ].join('\n');

    const user = `Liệt kê ngày quan trọng cho cả năm ${year}. Trả JSON array đầy đủ, đúng format.`;

    const resp = await this.anthropic.client.messages.create({
      model: this.anthropic.fastModel,
      max_tokens: 8192,
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
      .map((x) => this.sanitize(x as Record<string, unknown>, year))
      .filter((x): x is AiDateItem => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private sanitize(
    raw: Record<string, unknown>,
    year: number,
  ): AiDateItem | null {
    const date = typeof raw.date === 'string' ? raw.date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [y] = date.split('-').map(Number);
    if (y !== year) return null;

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return null;

    const kind = (
      VALID_KINDS.includes(raw.kind as AiDateKind) ? raw.kind : 'other'
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
