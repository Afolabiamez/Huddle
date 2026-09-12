import { ValidateBy, ValidationOptions } from 'class-validator';

export function MaxUtf8Bytes(
  max: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxUtf8Bytes',
      constraints: [max],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
        defaultMessage: () => `$property must be at most ${max} UTF-8 bytes.`,
      },
    },
    options,
  );
}
