import { adminServiceTests } from './admin/admin.service.test';
import { auditServiceTests } from './audit/audit.service.test';
import { authServiceTests } from './auth/auth.service.test';
import { campanhasServiceTests } from './campanhas/campanhas.service.test';
import { jwtAuthGuardTests } from './auth/jwt-auth.guard.test';
import { optionalJwtAuthGuardTests } from './auth/optional-jwt-auth.guard.test';
import { twoFactorServiceTests } from './auth/two-factor.service.test';
import { cidadaosServiceTests } from './cidadaos/cidadaos.service.test';
import { httpExceptionFilterTests } from './common/http-exception.filter.test';
import { ecopontosServiceTests } from './ecopontos/ecopontos.service.test';
import { equipasServiceTests } from './equipas/equipas.service.test';
import { filaServiceTests } from './fila/fila.service.test';
import { gamificationServiceTests } from './gamification/gamification.service.test';
import { quizAdminServiceTests } from './gamification/quiz-admin.service.test';
import { homeServiceTests } from './home/home.service.test';
import { recolhasServiceTests } from './recolhas/recolhas.service.test';
import { reportsServiceTests } from './reports/reports.service.test';
import { rotasServiceTests } from './rotas/rotas.service.test';
import { runSuite } from './test-helpers';

async function main(): Promise<void> {
  let failures = 0;

  failures += await runSuite('AdminService', adminServiceTests);
  failures += await runSuite('AuditService', auditServiceTests);
  failures += await runSuite('AuthService', authServiceTests);
  failures += await runSuite('JwtAuthGuard', jwtAuthGuardTests);
  failures += await runSuite('OptionalJwtAuthGuard', optionalJwtAuthGuardTests);
  failures += await runSuite('TwoFactorService', twoFactorServiceTests);
  failures += await runSuite('CidadaosService', cidadaosServiceTests);
  failures += await runSuite('HomeService', homeServiceTests);
  failures += await runSuite('EcopontosService', ecopontosServiceTests);
  failures += await runSuite('EquipasService', equipasServiceTests);
  failures += await runSuite('FilaService', filaServiceTests);
  failures += await runSuite('GamificationService', gamificationServiceTests);
  failures += await runSuite('QuizAdminService', quizAdminServiceTests);
  failures += await runSuite('RecolhasService', recolhasServiceTests);
  failures += await runSuite('ReportsService', reportsServiceTests);
  failures += await runSuite('RotasService', rotasServiceTests);
  failures += await runSuite('CampanhasService', campanhasServiceTests);
  failures += await runSuite('HttpExceptionFilter', httpExceptionFilterTests);

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed.`);
    process.exit(1);
  }

  console.log('\nAll tests passed.');
}

main().catch((error: unknown) => {
  console.error('Failed to run tests');
  console.error(error);
  process.exit(1);
});
