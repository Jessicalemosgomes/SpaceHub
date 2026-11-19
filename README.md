# SpaceHub

Plataforma Full-Stack para anúncios, disponibilidade e reservas de espaços, construída com Node.js, Express, PostgreSQL e Prisma.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior
- npm

## Instalação local

1. Extraia o projeto e abra a pasta no terminal.
2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie um banco PostgreSQL chamado `spacehub`.
4. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `JWT_SECRET`.
5. Gere o Prisma Client e crie as tabelas:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

6. Inicie o servidor:

   ```bash
   npm run dev
   ```

7. Acesse http://localhost:3000.

## Perfis

- **HOST**: cria, consulta, edita e exclui os próprios anúncios; pode bloquear datas.
- **GUEST**: pesquisa espaços, reserva e consulta/cancela suas reservas.

Crie uma conta pela interface e escolha o perfil desejado.

## API principal

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/register` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/spaces` | Público |
| GET | `/api/spaces/:id` | Público |
| POST | `/api/spaces` | HOST |
| GET | `/api/spaces/mine` | HOST |
| PUT | `/api/spaces/:id` | Dono HOST |
| DELETE | `/api/spaces/:id` | Dono HOST |
| POST | `/api/bookings` | GUEST |
| GET | `/api/bookings/mine` | GUEST |
| GET | `/api/bookings/host` | HOST |
| PATCH | `/api/bookings/:id/cancel` | Participante |
| GET | `/api/calendar/:spaceId` | Público |
| POST | `/api/calendar/:spaceId/blocks` | Dono HOST |
| DELETE | `/api/calendar/blocks/:blockId` | Dono HOST |

As datas são enviadas no formato `YYYY-MM-DD`. O dia de checkout é exclusivo: uma reserva de 10 a 15 permite que outra comece no dia 15.

## Regra anti-overbooking

A rota de reserva executa uma transação no PostgreSQL e obtém um advisory lock associado ao ID do espaço antes de verificar conflitos e gravar a reserva. Assim, duas solicitações concorrentes para o mesmo espaço são serializadas. Também é usada a verificação de sobreposição:

`reservaExistente.startDate < nova.endDate AND reservaExistente.endDate > nova.startDate`

O mesmo bloqueio é aplicado ao calendário de manutenção. O PostgreSQL é obrigatório para esse mecanismo (`pg_advisory_xact_lock`).

## Uploads

As imagens são armazenadas localmente em `uploads/` e servidas em `/uploads`. Para produção, recomenda-se migrar para armazenamento de objetos (S3, Cloudinary etc.), limitar dimensões e fazer varredura de arquivos.

## Antes de produção

Este repositório entrega uma base funcional/MVP. Antes de operar com clientes reais, configure HTTPS, segredo JWT forte, backup e monitoramento do PostgreSQL, política de privacidade, rate limits específicos para login, validação de arquivos por conteúdo, armazenamento externo de imagens, logs, testes automatizados e fluxo de confirmação/pagamento. O logout atual remove o token do navegador; para revogação imediata de tokens, implemente refresh tokens ou denylist.

## Site online: https://spacehub-production-db0c4c6d.up.railway.app/
