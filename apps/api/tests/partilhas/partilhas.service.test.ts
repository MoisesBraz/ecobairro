import assert from 'node:assert/strict';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PartilhasService } from '../../src/partilhas/partilhas.service';
import type { TestCase } from '../test-helpers';

interface FakePartilhaRow {
  id: string;
  titulo: string;
  zona: string;
  userId: string | null;
}

interface SentMail {
  template: string;
  to: string;
  subject: string;
  variables: Record<string, string | number>;
}

function makeDeps(opts: {
  partilha?: FakePartilhaRow | null;
  users?: Record<string, { email: string }>;
  perfis?: Record<string, { nomeCompleto: string }>;
}) {
  const sent: SentMail[] = [];
  const prisma = {
    partilha: {
      findUnique: async (_args: { where: { id: string } }) =>
        opts.partilha ? { ...opts.partilha } : null,
    },
    user: {
      findUnique: async (args: { where: { id: string } }) =>
        opts.users?.[args.where.id] ?? null,
    },
    cidadaoPerfil: {
      findUnique: async (args: { where: { userId: string } }) =>
        opts.perfis?.[args.where.userId] ?? null,
    },
  };
  const mail = {
    send: async (template: string, options: Omit<SentMail, 'template'>) => {
      sent.push({ template, ...options });
    },
  };
  return { prisma, mail, sent };
}

export const partilhasServiceTests: TestCase[] = [
  {
    name: 'expressInterest notifica o autor por email com o contacto do interessado',
    run: async () => {
      const { prisma, mail, sent } = makeDeps({
        partilha: { id: 'p1', titulo: 'Sofá', zona: 'Glória', userId: 'autor' },
        users: { autor: { email: 'autor@x.pt' }, interessado: { email: 'quero@x.pt' } },
        perfis: { interessado: { nomeCompleto: 'Ana Cidadã' } },
      });
      const service = new PartilhasService(prisma as never, mail as never);
      const res = await service.expressInterest('interessado', 'p1', { mensagem: 'Posso ao sábado' });
      assert.equal(res.notificado, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.template, 'partilha-interesse');
      assert.equal(sent[0]!.to, 'autor@x.pt');
      assert.equal(sent[0]!.variables.interessadoNome, 'Ana Cidadã');
      assert.equal(sent[0]!.variables.interessadoEmail, 'quero@x.pt');
      assert.equal(sent[0]!.variables.mensagem, 'Posso ao sábado');
    },
  },
  {
    name: 'expressInterest usa "(sem mensagem)" quando não há mensagem',
    run: async () => {
      const { prisma, mail, sent } = makeDeps({
        partilha: { id: 'p1', titulo: 'Sofá', zona: 'Glória', userId: 'autor' },
        users: { autor: { email: 'autor@x.pt' }, interessado: { email: 'quero@x.pt' } },
      });
      const service = new PartilhasService(prisma as never, mail as never);
      await service.expressInterest('interessado', 'p1', {});
      assert.equal(sent[0]!.variables.mensagem, '(sem mensagem)');
      // sem perfil → cai para o email como nome
      assert.equal(sent[0]!.variables.interessadoNome, 'quero@x.pt');
    },
  },
  {
    name: 'expressInterest rejeita interesse na própria partilha (400)',
    run: async () => {
      const { prisma, mail } = makeDeps({
        partilha: { id: 'p1', titulo: 'Sofá', zona: 'Glória', userId: 'mesmo' },
        users: { mesmo: { email: 'm@x.pt' } },
      });
      const service = new PartilhasService(prisma as never, mail as never);
      await assert.rejects(
        () => service.expressInterest('mesmo', 'p1', {}),
        BadRequestException,
      );
    },
  },
  {
    name: 'expressInterest devolve 404 quando a partilha não existe',
    run: async () => {
      const { prisma, mail } = makeDeps({ partilha: null });
      const service = new PartilhasService(prisma as never, mail as never);
      await assert.rejects(
        () => service.expressInterest('u', 'inexistente', {}),
        NotFoundException,
      );
    },
  },
  {
    name: 'expressInterest devolve 503 quando o autor está anonimizado (userId nulo)',
    run: async () => {
      const { prisma, mail } = makeDeps({
        partilha: { id: 'p1', titulo: 'Sofá', zona: 'Glória', userId: null },
      });
      const service = new PartilhasService(prisma as never, mail as never);
      await assert.rejects(
        () => service.expressInterest('u', 'p1', {}),
        ServiceUnavailableException,
      );
    },
  },
  {
    name: 'expressInterest devolve 503 quando o interessado não existe na BD',
    run: async () => {
      const { prisma, mail } = makeDeps({
        partilha: { id: 'p1', titulo: 'Sofá', zona: 'Glória', userId: 'autor' },
        users: { autor: { email: 'autor@x.pt' } }, // interessado ausente
      });
      const service = new PartilhasService(prisma as never, mail as never);
      await assert.rejects(
        () => service.expressInterest('inexistente', 'p1', {}),
        ServiceUnavailableException,
      );
    },
  },
];
