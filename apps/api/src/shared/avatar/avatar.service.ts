import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

@Injectable()
export class AvatarService {
  private readonly supabase: SupabaseClient | null;
  private readonly bucket = 'avatars';
  private readonly logger = new Logger(AvatarService.name);

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      this.logger.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — avatar upload disabled');
      this.supabase = null;
      return;
    }
    this.supabase = createClient(url, key);
  }

  async upload(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!this.supabase) throw new BadGatewayException('Avatar upload not configured');

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const resized = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .toBuffer();

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, resized, { contentType: mimeType, upsert: false });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new BadGatewayException('Avatar upload failed');
    }

    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async delete(avatarUrl: string): Promise<void> {
    if (!this.supabase) return;
    try {
      const url = new URL(avatarUrl);
      const parts = url.pathname.split(`/object/public/${this.bucket}/`);
      if (parts.length < 2) return;
      const path = parts[1];
      const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
      if (error) {
        this.logger.warn(`Failed to delete old avatar (${path}): ${error.message}`);
      }
    } catch {
      this.logger.warn(`Could not parse avatarUrl for deletion: ${avatarUrl}`);
    }
  }
}
