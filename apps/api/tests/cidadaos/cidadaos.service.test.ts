import assert from 'node:assert/strict';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '@prisma/client';
import { CidadaosService } from '../../src/cidadaos/cidadaos.service';
import type { TestCase } from '../test-helpers';
import { UpdateCidadaoProfileDto } from '../../src/cidadaos/dto/update-cidadao-profile.dto';

interface FakeCitizenUserRecord {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  role: UserRole;
  criadoEm: Date;
  eliminadoEm: Date | null;
  cidadaoPerfil: {
    userId: string;
    nomeCompleto: string | null;
    gamificationOptIn: boolean;
    notificacaoPrefs: Record<string, unknown> | null;
    dashboardWidgets: Record<string, unknown> | null;
  } | null;
}

class FakePrismaService {
  private userRecord: FakeCitizenUserRecord | null;

  readonly user = {
    findUnique: async (args: { where: { id: string } }) => {
      if (!this.userRecord || args.where.id !== this.userRecord.id) {
        return null;
      }

      return cloneUser(this.userRecord);
    },
    update: async (args: { where: { id: string }; data: { phone?: string | null } }) => {
      if (!this.userRecord || args.where.id !== this.userRecord.id) {
        throw new NotFoundException('Citizen profile not found');
      }

      if (args.data.phone !== undefined) {
        this.userRecord.phone = args.data.phone;
      }

      return cloneUser(this.userRecord);
    },
  };

  readonly cidadaoPerfil = {
    update: async (args: {
      where: { userId: string };
      data: {
        nomeCompleto?: string;
        gamificationOptIn?: boolean;
        notificacaoPrefs?: Record<string, unknown>;
        dashboardWidgets?: Record<string, unknown>;
      };
    }) => {
      if (
        !this.userRecord ||
        !this.userRecord.cidadaoPerfil ||
        args.where.userId !== this.userRecord.id
      ) {
        throw new NotFoundException('Citizen profile not found');
      }

      if (args.data.nomeCompleto !== undefined) {
        this.userRecord.cidadaoPerfil.nomeCompleto = args.data.nomeCompleto;
      }

      if (args.data.gamificationOptIn !== undefined) {
        this.userRecord.cidadaoPerfil.gamificationOptIn = args.data.gamificationOptIn;
      }

      if (args.data.notificacaoPrefs !== undefined) {
        this.userRecord.cidadaoPerfil.notificacaoPrefs = args.data.notificacaoPrefs;
      }

      if (args.data.dashboardWidgets !== undefined) {
        this.userRecord.cidadaoPerfil.dashboardWidgets = args.data.dashboardWidgets;
      }

      return cloneUser(this.userRecord);
    },
  };

  constructor(userRecord: FakeCitizenUserRecord | null) {
    this.userRecord = userRecord ? cloneUser(userRecord) : null;
  }

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

export const cidadaosServiceTests: TestCase[] = [
  {
    name: 'validates nome_completo and phone limits for citizen profile update dto',
    run: async () => {
      const invalidDto = plainToInstance(UpdateCidadaoProfileDto, {
        nome_completo: 'A',
        phone: '12',
      });

      const invalidErrors = await validate(invalidDto);
      const invalidFields = invalidErrors.map((error) => error.property).sort();
      assert.deepEqual(invalidFields, ['nome_completo', 'phone']);

      const validDto = plainToInstance(UpdateCidadaoProfileDto, {
        nome_completo: 'Ana Silva',
        phone: '+351 912 345 678',
      });

      const validErrors = await validate(validDto);
      assert.equal(validErrors.length, 0);
    },
  },
  {
    name: 'returns the authenticated citizen profile',
    run: async () => {
      const service = new CidadaosService(
        new FakePrismaService(buildCitizenUser()) as never,
      );

      const result = await service.getMe('user-1', 'CIDADAO');

      assert.deepEqual(result, {
        id: 'user-1',
        email: 'citizen@example.com',
        phone: '+351910000000',
        role: 'CIDADAO',
        email_verified: true,
        nome_completo: 'Pedro Silva',
        gamification_opt_in: true,
        notificacao_prefs: {
          email: true,
        },
        dashboard_widgets: {
          order: ['reports'],
        },
        criado_em: '2026-04-18T12:00:00.000Z',
      });
    },
  },
  {
    name: 'rejects non-citizen access',
    run: async () => {
      const service = new CidadaosService(
        new FakePrismaService(buildCitizenUser()) as never,
      );

      await assert.rejects(
        () => service.getMe('user-1', 'ADMIN'),
        (error: unknown) =>
          error instanceof ForbiddenException &&
          error.message === 'Não tem permissão para esta acção.',
      );
    },
  },
  {
    name: 'updates the allowed self-profile fields',
    run: async () => {
      const service = new CidadaosService(
        new FakePrismaService(buildCitizenUser()) as never,
      );

      const result = await service.updateMe('user-1', 'CIDADAO', {
        phone: '+351911111111',
        nome_completo: 'Pedro Teste',
        gamification_opt_in: false,
        notificacao_prefs: {
          email: false,
          push: true,
        },
        dashboard_widgets: {
          order: ['favoritos', 'reports'],
        },
      });

      assert.equal(result.phone, '+351911111111');
      assert.equal(result.nome_completo, 'Pedro Teste');
      assert.equal(result.gamification_opt_in, false);
      assert.deepEqual(result.notificacao_prefs, {
        email: false,
        push: true,
      });
      assert.deepEqual(result.dashboard_widgets, {
        order: ['favoritos', 'reports'],
      });
    },
  },
  {
    name: 'returns not found when the citizen profile is missing',
    run: async () => {
      const service = new CidadaosService(
        new FakePrismaService(null) as never,
      );

      await assert.rejects(
        () => service.getMe('user-1', 'CIDADAO'),
        (error: unknown) =>
          error instanceof NotFoundException &&
          error.message === 'Perfil de cidadão não encontrado.',
      );
    },
  },
];

function buildCitizenUser(): FakeCitizenUserRecord {
  return {
    id: 'user-1',
    email: 'citizen@example.com',
    phone: '+351910000000',
    emailVerified: true,
    role: UserRole.CIDADAO,
    criadoEm: new Date('2026-04-18T12:00:00.000Z'),
    eliminadoEm: null,
    cidadaoPerfil: {
      userId: 'user-1',
      nomeCompleto: 'Pedro Silva',
      gamificationOptIn: true,
      notificacaoPrefs: {
        email: true,
      },
      dashboardWidgets: {
        order: ['reports'],
      },
    },
  };
}

function cloneUser(user: FakeCitizenUserRecord): FakeCitizenUserRecord {
  return {
    ...user,
    criadoEm: new Date(user.criadoEm),
    eliminadoEm: user.eliminadoEm ? new Date(user.eliminadoEm) : null,
    cidadaoPerfil: user.cidadaoPerfil
      ? {
          ...user.cidadaoPerfil,
          notificacaoPrefs: user.cidadaoPerfil.notificacaoPrefs
            ? structuredClone(user.cidadaoPerfil.notificacaoPrefs)
            : null,
          dashboardWidgets: user.cidadaoPerfil.dashboardWidgets
            ? structuredClone(user.cidadaoPerfil.dashboardWidgets)
            : null,
        }
      : null,
  };
}
