import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import type { CreateRotaRequest, RotaParagem } from '@ecobairro/contracts';

/** Valida que o valor é uma lista de pares `[lat, lng]` (coordenadas). */
function IsCoordPairArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCoordPairArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            Array.isArray(value) &&
            value.every(
              (p) =>
                Array.isArray(p) &&
                p.length === 2 &&
                typeof p[0] === 'number' &&
                typeof p[1] === 'number',
            )
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} deve ser uma lista de pares [lat, lng].`;
        },
      },
    });
  };
}

class RotaParagemDto implements RotaParagem {
  @IsUUID()
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nome!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  ocupacao!: number;

  @IsInt()
  @Min(1)
  ordem!: number;
}

export class CreateRotaDto implements CreateRotaRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nome!: string;

  // Zona de recolha (opcional). `null` = sem zona.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  zona?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cor?: string;

  @IsString()
  @MaxLength(40)
  distancia!: string;

  @IsString()
  @MaxLength(40)
  duracao!: string;

  // Paragens (markers) na ordem de visita.
  @IsCoordPairArray()
  waypoints!: [number, number][];

  // Traçado por estradas (OSRM) ou linhas retas (greedy); pode ser uma lista longa.
  @IsCoordPairArray()
  geometria!: [number, number][];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RotaParagemDto)
  paragens!: RotaParagemDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  ecopontoIds!: string[];
}
