import type { ValueTransformer } from 'typeorm';

/**
 * Postgres `bigint` arrives as string from the driver. We hold money as VND
 * integer (max ~200 tỷ in real life) which fits comfortably in Number.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value == null ? null : parseInt(value, 10)),
};
