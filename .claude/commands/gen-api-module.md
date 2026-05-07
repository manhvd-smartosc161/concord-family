---
description: Scaffold một NestJS module mới trong apps/api/src/modules/ theo pattern Concord
argument-hint: <module-name>
---

Tôi muốn scaffold module mới `$ARGUMENTS` trong `apps/api/src/modules/$ARGUMENTS/`.

Trước khi viết code:

1. Đọc `apps/api/CLAUDE.md` để nắm convention (privacy enforcement inline, BaseEntity, ValidationPipe, agent layout).
2. Đọc `apps/api/src/modules/transactions/` làm reference (module/controller/service/dto/entities).
3. Hỏi tôi 3 câu trước khi gen:
   - Module có đụng `Transaction` hoặc `Fund` không? (nếu có → enforce privacy theo pattern `visibleFundIds()`)
   - Resource có cần CRUD đầy đủ hay chỉ vài endpoint cụ thể?
   - Có entity mới hay chỉ logic không state?

Sau khi tôi trả lời, gen các file sau (đặt trong `apps/api/src/modules/$ARGUMENTS/`):

- `$ARGUMENTS.module.ts` — `@Module` với `TypeOrmModule.forFeature([...])`, `controllers`, `providers`, `exports`
- `$ARGUMENTS.controller.ts` — `@UseGuards(JwtAuthGuard)` + `@Controller('api/$ARGUMENTS')` + endpoint tương ứng
- `$ARGUMENTS.service.ts` — `@Injectable()` + inject repo qua `@InjectRepository`. Nếu đụng transaction/fund → có method `visibleFundIds(user)` và mọi query `WHERE fund_id IN (...)`
- `dto/*.dto.ts` — class-validator (giữ một file một DTO)
- `entities/$ENTITY.entity.ts` — extends `BaseEntity` từ `@/shared/common/base.entity`, dùng `bigint`/`int` cho VND

Sau cùng:

- Đăng ký module trong `apps/api/src/app.module.ts` (`imports: [..., NewModule]`)
- Đăng ký entity mới trong `apps/api/src/data-source.ts` array `entities`
- KHÔNG generate test stubs (chưa cần)
- KHÔNG thêm comment trong code
- Báo lại tôi `migration:generate` cần chạy nếu có entity mới

Sau khi xong: `pnpm --filter api lint && pnpm --filter api build` để verify.
